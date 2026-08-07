import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

import { getDatasets } from '../../services/evaluationService.js'
import {
  getFeedbackStats, getNegativeFeedback, promoteFeedback,
} from '../../services/feedbackService.js'

vi.mock('../../layouts/AdminLayout.jsx', () => ({
  AdminPageHeader: ({ actions, title }) => <header><h1>{title}</h1>{actions}</header>,
}))
vi.mock('../../services/feedbackService.js', () => ({
  getFeedbackStats: vi.fn(), getNegativeFeedback: vi.fn(), promoteFeedback: vi.fn(),
}))
vi.mock('../../services/evaluationService.js', () => ({ getDatasets: vi.fn() }))

import AdminFeedbackPage from './AdminFeedbackPage.jsx'

const stats = {
  total: 10,
  helpfulCount: 6,
  notHelpfulCount: 4,
  helpfulRate: 0.6,
  promotedCount: 1,
  byReason: {
    WRONG_INFORMATION: 3, MISSING_CITATION: 1, OFF_TOPIC: 0, TOO_SLOW: 0, OTHER: 0,
  },
}

const rejected = {
  feedbackId: 'fb-1',
  messageId: 'msg-1',
  reasonCode: 'WRONG_INFORMATION',
  comment: 'sai chương',
  questionText: 'Triết học là gì?',
  answerText: 'Câu trả lời sai',
  promotedQuestionId: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  getFeedbackStats.mockResolvedValue(stats)
  getNegativeFeedback.mockResolvedValue({ items: [rejected], totalNegative: 4 })
  getDatasets.mockResolvedValue([{ datasetId: 'ds-1', datasetName: 'Triết học 2026' }])
  promoteFeedback.mockResolvedValue({ questionNo: 7 })
})

it('shows the helpful rate and the reason breakdown', async () => {
  render(<AdminFeedbackPage />)

  expect(await screen.findByText('60%')).toBeInTheDocument()
  // Once in the breakdown chart, once as the label on the rejected answer below.
  expect(screen.getAllByText('Wrong information')).toHaveLength(2)
  expect(screen.getByText('Rejected answers (4)')).toBeInTheDocument()
})

it('reports no data instead of 0% when nobody has rated anything', async () => {
  getFeedbackStats.mockResolvedValue({ ...stats, total: 0, helpfulRate: null, notHelpfulCount: 0 })
  getNegativeFeedback.mockResolvedValue({ items: [], totalNegative: 0 })

  render(<AdminFeedbackPage />)

  expect(await screen.findByText('No data yet')).toBeInTheDocument()
})

it('promotes a rejected answer into an evaluation dataset', async () => {
  render(<AdminFeedbackPage />)
  fireEvent.click(await screen.findByRole('button', { name: /Add to dataset/ }))

  expect(screen.getByLabelText('Question')).toHaveValue('Triết học là gì?')

  fireEvent.change(screen.getByLabelText('Expected answer'), {
    target: { value: 'Đáp án đúng' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Add question' }))

  await waitFor(() => expect(promoteFeedback).toHaveBeenCalledWith('fb-1', {
    datasetId: 'ds-1',
    questionText: 'Triết học là gì?',
    groundTruthAnswer: 'Đáp án đúng',
  }))
  expect(await screen.findByText('Added as question #7 in the dataset.')).toBeInTheDocument()
})

it('refuses to promote without an expected answer', async () => {
  render(<AdminFeedbackPage />)
  fireEvent.click(await screen.findByRole('button', { name: /Add to dataset/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Add question' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Write the answer this question should have had.',
  )
  expect(promoteFeedback).not.toHaveBeenCalled()
})

it('marks answers already turned into questions instead of offering them again', async () => {
  getNegativeFeedback.mockResolvedValue({
    items: [{ ...rejected, promotedQuestionId: 'q-1' }],
    totalNegative: 4,
  })

  render(<AdminFeedbackPage />)

  expect(await screen.findByText('In dataset')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Add to dataset/ })).not.toBeInTheDocument()
})
