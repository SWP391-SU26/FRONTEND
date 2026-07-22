// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { askQuestionStream } from './chatService.js'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

it('parses verifiable SSE stages and returns the completed answer', async () => {
  localStorage.setItem('fstu_access_token', 'test-token')
  const body = [
    'event:SCOPE_CHECK\ndata:{"stage":"SCOPE_CHECK","elapsedMs":4}\n\n',
    'event:RETRIEVAL\ndata:{"stage":"RETRIEVAL","elapsedMs":18}\n\n',
    'event:COMPLETED\ndata:{"stage":"COMPLETED","elapsedMs":25,"response":{"answer":"Grounded answer","generationMode":"LOCAL_EXTRACTIVE","citations":[{"documentTitle":"Lecture.pdf","pageStart":2}]}}\n\n',
  ].join('')
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  }))
  const stages = []

  const result = await askQuestionStream('session-1', 'Question?', { onStage: (event) => stages.push(event.stage) })

  expect(stages).toEqual(['SCOPE_CHECK', 'RETRIEVAL', 'COMPLETED'])
  expect(result).toMatchObject({ answer: 'Grounded answer', generationMode: 'LOCAL_EXTRACTIVE' })
  expect(result.citations[0]).toMatchObject({ documentTitle: 'Lecture.pdf', pageStart: 2 })
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token')
})

it('reports a disconnected stream without creating an empty assistant answer', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
    'event:RETRIEVAL\ndata:{"stage":"RETRIEVAL","elapsedMs":8}\n\n',
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  ))

  await expect(askQuestionStream('session-1', 'Question?')).rejects.toThrow(/ngắt trước khi hoàn tất/i)
})
