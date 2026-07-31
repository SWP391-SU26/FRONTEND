import { fireEvent, render, screen, within } from '@testing-library/react'
import { LocaleProvider } from '../../i18n/LocaleContext.jsx'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { comparison } = vi.hoisted(() => ({ comparison: {
  datasetId: 'dataset-1',
  datasetChecksum: 'same-checksum',
  dataset: { datasetId: 'dataset-1', name: 'Philosophy 50 questions', questionCount: 50, documentCount: 1 },
  metricStandard: 'RAGAS_OFFICIAL',
  formulaVersion: 'ragas-0.4',
  benchmarkProfile: { version: 'full-batch-v1', batchSize: 4, maxInputTokens: 448, maxNewTokens: 64 },
  ragExperiment: {
    name: 'RAG 6', status: 'COMPLETED', tokenOverlapProxy: 0.11, answerRelevance: 0.11,
    faithfulness: 0.60, contextPrecision: 0.97, contextRecall: 0.44,
    latencyMs: 5235, successCount: 50, failureCount: 0, totalCount: 50,
  },
  fineTunedExperiment: {
    name: 'Fine-tuned 6', status: 'COMPLETED', tokenOverlapProxy: 0.26, answerRelevance: 0.26,
    faithfulness: null, contextPrecision: null, contextRecall: null,
    latencyMs: 2925, successCount: 50, failureCount: 0, totalCount: 50,
  },
  perQuestion: [
    { questionId: 'q-1', question: 'What is philosophy?', groundTruth: 'A system of knowledge.', ragAnswer: 'Knowledge.', fineTunedAnswer: 'A system of knowledge.', ragTokenOverlapProxy: 0.2, fineTunedTokenOverlapProxy: 0.5, tokenOverlapProxyDelta: 0.3, ragLatencyMs: 5000, fineTunedLatencyMs: 2800, ragCitations: [{ title: 'Textbook, page 12' }] },
    { questionId: 'q-2', question: 'What is the source of cognition?', groundTruth: 'Practice.', ragAnswer: 'Practice.', fineTunedAnswer: 'Society.', ragTokenOverlapProxy: 0.8, fineTunedTokenOverlapProxy: 0.2, tokenOverlapProxyDelta: -0.6, ragLatencyMs: 5100, fineTunedLatencyMs: 2900 },
  ],
} }))

vi.mock('../../services/evaluationService.js', () => ({
  getDatasets: vi.fn().mockResolvedValue([{ id: 'dataset-1', name: 'Philosophy 50 questions', status: 'FROZEN' }]),
  getExperiments: vi.fn().mockResolvedValue([
    { id: 'rag-1', datasetId: 'dataset-1', name: 'RAG 6', experimentType: 'RAG', status: 'COMPLETED', datasetChecksum: 'same-checksum' },
    { id: 'fine-1', datasetId: 'dataset-1', name: 'Fine-tuned 6', experimentType: 'FINE_TUNED', status: 'COMPLETED', datasetChecksum: 'same-checksum' },
  ]),
  getComparison: vi.fn().mockResolvedValue(comparison),
}))

import * as evaluationService from '../../services/evaluationService.js'
import { AdminResearchDashboardPage, buildComparisonCsv, buildResearchConclusions, filterComparisonRows } from './AdminResearchDashboardPage.jsx'

function renderPage() {
  return render(<LocaleProvider><AdminResearchDashboardPage /></LocaleProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.removeItem('fstu_locale')
})

it('renders official RAGAS metrics while keeping token overlap labeled as a proxy', async () => {
  renderPage()

  expect(await screen.findByText('Kết luận thực nghiệm')).toBeInTheDocument()
  expect(screen.getByText(/Fine-tuned khớp ground truth cao hơn 15 điểm phần trăm/)).toBeInTheDocument()
  expect(screen.getByText(/faithfulness, answer relevancy, context precision và context recall là RAGAS chính thức/i)).toBeInTheDocument()
  expect(screen.getAllByText(/Không áp dụng/).length).toBeGreaterThanOrEqual(3)
  expect(await screen.findByRole('heading', { name: 'Kết quả trực quan trên cùng snapshot dữ liệu' }, { timeout: 15000 })).toBeInTheDocument()
  expect(screen.getByText('Fine-tuned +15 pp')).toBeInTheDocument()
  const grounding = screen.getByRole('figure', { name: /Độ bám nguồn RAG/i })
  expect(within(grounding).queryByRole('columnheader', { name: /Fine-tuned/i })).not.toBeInTheDocument()
  expect(evaluationService.getComparison).toHaveBeenCalledWith({ datasetId: 'dataset-1', ragExperimentId: 'rag-1', fineTunedExperimentId: 'fine-1' })
})

it('filters question rows by winner and expands evidence without relying on color', async () => {
  renderPage()
  await screen.findByText('What is philosophy?')

  fireEvent.change(screen.getByLabelText('Lọc kết quả'), { target: { value: 'RAG' } })
  expect(screen.queryByText('What is philosophy?')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('What is the source of cognition?'))
  expect(screen.getByText('Đáp án chuẩn')).toBeInTheDocument()
  expect(screen.getAllByText('Practice.')).toHaveLength(2)
})

it('rerenders research report chrome in English when the stored locale is English', async () => {
  localStorage.setItem('fstu_locale', 'en')
  renderPage()

  expect(await screen.findByText('Experimental conclusion')).toBeInTheDocument()
  expect(screen.getByText('Quality comparison')).toBeInTheDocument()
  expect(screen.getByLabelText('Filter results')).toBeInTheDocument()
})

describe('report helpers', () => {
  it('describes differences below two percentage points as near-equivalent', () => {
    const result = buildResearchConclusions({ ...comparison, ragExperiment: { ...comparison.ragExperiment, tokenOverlapProxy: 0.50 }, fineTunedExperiment: { ...comparison.fineTunedExperiment, tokenOverlapProxy: 0.51 } })
    expect(result[0]).toMatch(/gần tương đương/)
  })

  it('exports UTF-8 BOM, complete headers and exactly 50 data rows', () => {
    const rows = Array.from({ length: 50 }, (_, index) => ({ ...comparison.perQuestion[0], questionId: `q-${index}`, question: `Question ${index}, with comma` }))
    const csv = buildComparisonCsv({ ...comparison, perQuestion: rows })
    expect(csv.charCodeAt(0)).toBe(0xFEFF)
    expect(csv).toContain('rag_context_precision')
    expect(csv.split('\r\n')).toHaveLength(51)
    expect(csv).toContain('"Question 0, with comma"')
  })

  it('classifies errors and keeps winner filters deterministic', () => {
    const rows = [...comparison.perQuestion, { ...comparison.perQuestion[0], questionId: 'q-error', ragError: 'timeout' }]
    expect(filterComparisonRows(rows, '', 'FINE')).toHaveLength(1)
    expect(filterComparisonRows(rows, '', 'RAG')).toHaveLength(1)
    expect(filterComparisonRows(rows, '', 'ERROR')).toHaveLength(1)
  })
})
