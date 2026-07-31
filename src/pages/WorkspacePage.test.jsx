import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssistantMessage } from './WorkspacePage.jsx'

describe('AssistantMessage typewriter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reveals a new complete answer character by character', () => {
    render(
      <AssistantMessage
        copied={false}
        message={{
          id: 'assistant-1',
          role: 'assistant',
          content: 'Triết học',
          citations: [{ id: 'citation-1', documentTitle: 'Giáo trình', pageStart: 5 }],
          animateResponse: true,
          streaming: false,
          latencyMs: 8500,
        }}
        onCitation={vi.fn()}
        onCopy={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(screen.queryByText('Triết học')).not.toBeInTheDocument()
    expect(screen.queryByText('Giáo trình')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(10)
    })
    expect(screen.getByText('T')).toBeInTheDocument()

    act(() => {
      vi.runAllTimers()
    })
    expect(screen.getByText('Triết học')).toBeInTheDocument()
    expect(screen.getByText('Giáo trình')).toBeInTheDocument()
    expect(screen.getByText('Phản hồi trong 8,5 giây')).toBeInTheDocument()
  })

  it('renders history immediately without replaying the animation', () => {
    render(
      <AssistantMessage
        copied={false}
        message={{
          id: 'assistant-history',
          role: 'assistant',
          content: 'Nội dung lịch sử',
          citations: [],
          streaming: false,
        }}
        onCitation={vi.fn()}
        onCopy={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByText('Nội dung lịch sử')).toBeInTheDocument()
  })

  it('renders structured markdown answers as headings, lists, and tables', () => {
    render(
      <AssistantMessage
        copied={false}
        message={{
          id: 'assistant-markdown',
          role: 'assistant',
          content: [
            '### Trả lời',
            '',
            '- **Luận điểm:** Vật chất có trước ý thức.',
            '- **Ý nghĩa:** Ý thức phản ánh thế giới vật chất.',
            '',
            '| Tiêu chí | Nội dung |',
            '|---|---|',
            '| Quan hệ | Vật chất quyết định ý thức |',
          ].join('\n'),
          citations: [],
          streaming: false,
        }}
        onCitation={vi.fn()}
        onCopy={vi.fn()}
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Trả lời' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('restores a persisted processing trace in a collapsed timeline', () => {
    const labels = {
      'chat.processTitle': 'Quá trình xử lý',
      'chat.phaseRetrieval': 'Tìm nội dung liên quan',
      'chat.evidenceSummary': '8 đoạn bằng chứng trên 5 trang',
    }
    render(
      <AssistantMessage
        copied={false}
        message={{
          id: 'assistant-trace',
          role: 'assistant',
          content: 'Câu trả lời đã kiểm chứng.',
          citations: [],
          streaming: false,
          latencyMs: 32000,
          processingTrace: [{
            step: 'RETRIEVAL',
            status: 'COMPLETED',
            elapsedMs: 4200,
            metadata: { evidenceCount: 8, pageCount: 5 },
          }],
        }}
        onCitation={vi.fn()}
        onCopy={vi.fn()}
        onSave={vi.fn()}
        t={(key) => labels[key] ?? key}
      />,
    )

    expect(screen.queryByText('Tìm nội dung liên quan')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Quá trình xử lý/i }))
    expect(screen.getByText('Tìm nội dung liên quan')).toBeInTheDocument()
    expect(screen.getByText('8 đoạn bằng chứng trên 5 trang')).toBeInTheDocument()
  })
})
