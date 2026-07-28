import { beforeEach, describe, expect, it, vi } from 'vitest'
import { request } from './httpClient.js'
import { askQuestion, streamQuestion } from './chatService.js'

vi.mock('./httpClient.js', () => ({
  request: vi.fn(),
}))

describe('chatService.askQuestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })

  it('uses the standard ask endpoint and forwards the abort signal', async () => {
    const signal = new AbortController().signal
    request.mockResolvedValue({
      answer: 'Cau tra loi',
      citations: [],
      generationMode: 'LOCAL_EXTRACTIVE',
    })

    const result = await askQuestion('session-1', 'Cau hoi', { mode: 'rag', signal })

    expect(request).toHaveBeenCalledWith('/chat/sessions/session-1/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'Cau hoi', mode: 'rag', answerMode: 'rag' }),
      signal,
    })
    expect(result.answer).toBe('Cau tra loi')
  })

  it('uses the stream endpoint and parses SSE events', async () => {
    const signal = new AbortController().signal
    const events = []
    localStorage.setItem('fstu_access_token', 'token-1')
    const body = [
      'event:SCOPE_CHECK',
      'data:{"message":"scope"}',
      '',
      'event:DELTA',
      'data:{"text":"Cau tra loi"}',
      '',
      'event:CITATIONS',
      'data:{"citations":[]}',
      '',
      'event:COMPLETED',
      'data:{"answer":"Cau tra loi","citations":[],"generationMode":"LOCAL_EXTRACTIVE","latencyMs":18700}',
      '',
      '',
    ].join('\n')
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body))
        controller.close()
      },
    })
    fetch.mockResolvedValue({
      ok: true,
      body: stream,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    })

    const result = await streamQuestion('session-1', 'Cau hoi', {
      mode: 'rag',
      signal,
      onEvent: (event) => events.push(event.type),
    })

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/chat/sessions/session-1/ask/stream',
      expect.objectContaining({
        method: 'POST',
        signal,
        body: JSON.stringify({ question: 'Cau hoi', mode: 'rag', answerMode: 'rag' }),
      }),
    )
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token-1')
    expect(events).toEqual(['SCOPE_CHECK', 'DELTA', 'CITATIONS', 'COMPLETED'])
    expect(result.answer).toBe('Cau tra loi')
    expect(result.latencyMs).toBe(18700)
  })

  it('preserves deadline metadata from an SSE error', async () => {
    const body = [
      'event:ERROR',
      'data:{"code":"CHAT_DEADLINE_EXCEEDED","message":"Timed out","elapsedMs":55000,"retryable":true}',
      '',
      '',
    ].join('\n')
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body))
        controller.close()
      },
    })
    fetch.mockResolvedValue({
      ok: true,
      body: stream,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    })

    await expect(streamQuestion('session-1', 'Cau hoi')).rejects.toMatchObject({
      code: 'CHAT_DEADLINE_EXCEEDED',
      elapsedMs: 55000,
      retryable: true,
    })
  })
})
