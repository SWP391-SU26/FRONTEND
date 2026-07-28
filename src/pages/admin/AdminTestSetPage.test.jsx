import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('../../services/documentService.js', () => ({
  getDocuments: vi.fn().mockResolvedValue([
    { id: 'doc-1', courseId: 'course-1', status: 'Processed', displayName: 'Lecture.pdf', pages: 12 },
  ]),
}))

vi.mock('../../services/evaluationService.js', () => ({
  getEvaluationScopes: vi.fn().mockResolvedValue([
    { id: 'semester-1', name: 'Fall 2026', courses: [{ id: 'course-1', code: 'SWP391', name: 'Software Project' }] },
  ]),
  getDatasets: vi.fn().mockResolvedValue([
    { id: 'dataset-1', name: 'Snapshot', status: 'DRAFT', documentIds: ['doc-1'] },
  ]),
  getExperiments: vi.fn().mockResolvedValue([
    {
      id: 'experiment-1', datasetId: 'dataset-1', name: 'RAG baseline', method: 'RAG', experimentType: 'RAG',
      llmModel: 'qwen-rag-lora', status: 'PENDING', successCount: 0, failureCount: 0,
    },
  ]),
  getQuestions: vi.fn().mockResolvedValue([{ id: 'q-1', questionText: 'What is RAG?', groundTruthAnswer: 'Retrieval augmented generation.' }]),
  getReadiness: vi.fn().mockResolvedValue({
    ready: false,
    checks: [
      { code: 'documents', passed: true, message: '1 processed document is frozen.' },
      { code: 'model', passed: false, message: 'Strict RAG model is not ready.' },
    ],
    blockers: [{ code: 'model', message: 'Strict RAG model is not ready.' }],
  }),
  createDataset: vi.fn().mockResolvedValue({ id: 'dataset-2', name: 'SU2026 MLN123 benchmark', status: 'DRAFT', documentIds: ['doc-1'] }),
  cancelBenchmark: vi.fn().mockResolvedValue({
    id: 'experiment-1', datasetId: 'dataset-1', name: 'RAG baseline', method: 'RAG', experimentType: 'RAG',
    llmModel: 'qwen-rag-lora', status: 'CANCELLED', progress: 35, successCount: 1, failureCount: 0,
  }),
  waitForExperiment: vi.fn(() => new Promise(() => {})),
}))

import * as evaluationService from '../../services/evaluationService.js'
import { AdminTestSetPage } from './AdminTestSetPage.jsx'

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:test-set')
  URL.revokeObjectURL = vi.fn()
})

async function openStep(name) {
  const button = await screen.findByRole('button', { name: new RegExp(name, 'i') })
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
}

it('shows the five-step workflow and keeps document selection in the dataset snapshot step', async () => {
  render(<AdminTestSetPage />)

  expect(await screen.findByRole('navigation', { name: 'Benchmark workflow' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Dataset snapshot/i })).toHaveAttribute('aria-current', 'step')
  expect(await screen.findByRole('heading', { name: 'Dataset snapshot' })).toBeInTheDocument()
  expect(await screen.findByText('Lecture.pdf')).toBeInTheDocument()
  expect(screen.getByText('1 selected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Monitor runs/i })).toBeDisabled()
})

it('moves to Ground truth after snapshot creation and confirms the selected snapshot', async () => {
  render(<AdminTestSetPage />)
  const nameInput = await screen.findByPlaceholderText('Example: SU2026 MLN123 benchmark')
  fireEvent.change(nameInput, { target: { value: 'SU2026 MLN123 benchmark' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create snapshot' }))

  expect(await screen.findByRole('status')).toHaveTextContent('Dataset snapshot "SU2026 MLN123 benchmark" created successfully.')
  expect(await screen.findByRole('heading', { name: 'Ground truth' })).toBeInTheDocument()
  expect(screen.getAllByText('SU2026 MLN123 benchmark')).toHaveLength(2)
})

it('keeps questions bounded in Step 2 and gates launch behind backend readiness in Step 4', async () => {
  render(<AdminTestSetPage />)

  await openStep('Ground truth')
  expect(screen.getByTestId('benchmark-question-list')).toHaveClass('max-h-[420px]', 'overflow-y-auto')

  await openStep('Review and launch')
  expect(await screen.findByText('Strict RAG model is not ready.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Run benchmark' })).toBeDisabled()
})

it('exports the selected test set and ground truth as JSON from Step 2', async () => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  render(<AdminTestSetPage />)

  await openStep('Ground truth')
  const exportButton = await screen.findByRole('button', { name: 'Export JSON' })
  fireEvent.click(exportButton)

  expect(URL.createObjectURL).toHaveBeenCalledOnce()
  const blob = URL.createObjectURL.mock.calls[0][0]
  const exported = JSON.parse(await blob.text())
  expect(exported.dataset).toMatchObject({
    datasetId: 'dataset-1',
    datasetName: 'Snapshot',
    questionCount: 1,
  })
  expect(exported.questions).toEqual([expect.objectContaining({
    questionNo: 1,
    questionText: 'What is RAG?',
    groundTruthAnswer: 'Retrieval augmented generation.',
  })])
  expect(click).toHaveBeenCalledOnce()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-set')
  click.mockRestore()
})

it('allows a running benchmark to be cancelled from Step 5 and keeps partial progress', async () => {
  evaluationService.getExperiments.mockResolvedValueOnce([{
    id: 'experiment-1', datasetId: 'dataset-1', name: 'RAG baseline', method: 'RAG', experimentType: 'RAG',
    llmModel: 'qwen-rag-lora', status: 'RUNNING', progress: 35, successCount: 1, failureCount: 0,
  }])
  render(<AdminTestSetPage />)

  await openStep('Monitor runs')
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel run' }))

  await waitFor(() => expect(evaluationService.cancelBenchmark).toHaveBeenCalledWith('experiment-1'))
  expect(await screen.findAllByText('Cancelled')).toHaveLength(2)
  expect(screen.getByText('Cancelled at 35%. You can rerun it from the beginning.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Rerun' })).toBeEnabled()
})

it('shows a queued benchmark profile and allows cancellation before GPU execution', async () => {
  evaluationService.getExperiments.mockResolvedValueOnce([{
    id: 'experiment-1', datasetId: 'dataset-1', name: 'Fine queued', method: 'Fine-tuned',
    experimentType: 'FINE_TUNED', llmModel: 'qwen-rag-lora', status: 'QUEUED', progress: 0,
    successCount: 0, failureCount: 0,
    benchmarkProfile: { questionCount: 50, batchSize: 4, maxInputTokens: 448, maxNewTokens: 64 },
  }])
  render(<AdminTestSetPage />)

  await openStep('Monitor runs')
  expect(await screen.findAllByText('Queued')).toHaveLength(2)
  expect(screen.getByText('Full 50 / Batch 4 / 64 tokens')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel run' }))

  await waitFor(() => expect(evaluationService.cancelBenchmark).toHaveBeenCalledWith('experiment-1'))
})
