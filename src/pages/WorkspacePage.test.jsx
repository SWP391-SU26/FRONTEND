import { act, render, screen } from '@testing-library/react'
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
})
