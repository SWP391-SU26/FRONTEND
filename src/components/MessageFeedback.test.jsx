import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

import { MessageFeedback } from './MessageFeedback.jsx'

// The component only needs the leaf key, so echo it back as the visible label.
const t = (key) => key

let onSubmit

beforeEach(() => {
  onSubmit = vi.fn().mockResolvedValue({})
})

it('sends a thumbs up straight away without asking for a reason', async () => {
  render(<MessageFeedback messageId="msg-1" onSubmit={onSubmit} t={t} />)

  fireEvent.click(screen.getByRole('button', { name: 'chat.feedbackHelpful' }))

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('msg-1', { helpful: true }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('asks for a reason before sending negative feedback', async () => {
  render(<MessageFeedback messageId="msg-1" onSubmit={onSubmit} t={t} />)

  fireEvent.click(screen.getByRole('button', { name: 'chat.feedbackNotHelpful' }))

  // The API rejects a thumbs down with no reason, so nothing may be sent yet.
  expect(onSubmit).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toBeInTheDocument()

  fireEvent.click(screen.getByLabelText('chat.feedbackReasonMissingCitation'))
  fireEvent.change(screen.getByLabelText('chat.feedbackCommentLabel'), {
    target: { value: 'thiếu nguồn chương 2' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'chat.feedbackSubmit' }))

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('msg-1', {
    helpful: false,
    reasonCode: 'MISSING_CITATION',
    comment: 'thiếu nguồn chương 2',
  }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

it('marks the stored rating so a reload shows which thumb was pressed', () => {
  render(
    <MessageFeedback
      feedback={{ helpful: true, messageId: 'msg-1' }}
      messageId="msg-1"
      onSubmit={onSubmit}
      t={t}
    />,
  )

  expect(screen.getByRole('button', { name: 'chat.feedbackHelpful' }))
    .toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'chat.feedbackNotHelpful' }))
    .toHaveAttribute('aria-pressed', 'false')
})

it('keeps the dialog open and warns when the request fails', async () => {
  onSubmit.mockRejectedValue(new Error('network down'))
  render(<MessageFeedback messageId="msg-1" onSubmit={onSubmit} t={t} />)

  fireEvent.click(screen.getByRole('button', { name: 'chat.feedbackNotHelpful' }))
  fireEvent.click(screen.getByRole('button', { name: 'chat.feedbackSubmit' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('chat.feedbackFailed')
  // Losing the reason the user just picked would be worse than showing the error.
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})

it('prefills the previous reason when editing an existing rating', () => {
  render(
    <MessageFeedback
      feedback={{ helpful: false, reasonCode: 'TOO_SLOW', comment: 'chậm quá' }}
      messageId="msg-1"
      onSubmit={onSubmit}
      t={t}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'chat.feedbackNotHelpful' }))

  expect(screen.getByLabelText('chat.feedbackReasonTooSlow')).toBeChecked()
  expect(screen.getByLabelText('chat.feedbackCommentLabel')).toHaveValue('chậm quá')
})
