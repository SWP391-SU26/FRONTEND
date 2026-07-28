import { describe, expect, it } from 'vitest'
import {
  buildDashboardKpis, buildLatencyChartData, buildOutcomeChartData,
  buildScatterChartData,
} from './researchChartData.js'

describe('research chart transformations', () => {
  const rows = [
    { questionId: 'rag', question: 'RAG wins', ragTokenOverlapProxy: 0.8, fineTunedTokenOverlapProxy: 0.2, tokenOverlapProxyDelta: -0.6 },
    { questionId: 'fine', question: 'Fine wins', ragTokenOverlapProxy: 0.2, fineTunedTokenOverlapProxy: 0.7, tokenOverlapProxyDelta: 0.5 },
    { questionId: 'tie', question: 'Tie', ragTokenOverlapProxy: 0.5, fineTunedTokenOverlapProxy: 0.51, tokenOverlapProxyDelta: 0.01 },
    { questionId: 'error', question: 'Error', ragTokenOverlapProxy: 0.3, fineTunedTokenOverlapProxy: 0.3, tokenOverlapProxyDelta: 0, ragError: 'timeout' },
  ]

  it('counts RAG, Fine-tuned, near-equivalent and error outcomes exactly', () => {
    const result = buildOutcomeChartData(rows)
    expect(result.counts).toEqual({ rag: 1, fine: 1, tie: 1, error: 1 })
    expect(result.percentages).toEqual({ rag: 25, fine: 25, tie: 25, error: 25 })
    expect(result.total).toBe(4)
  })

  it('omits failed or incomplete scatter samples and reports the omitted count', () => {
    const result = buildScatterChartData([...rows, { questionId: 'missing', question: 'Missing', ragAnswerCorrectness: null, fineTunedAnswerCorrectness: 0.4 }])
    expect(result.points).toHaveLength(3)
    expect(result.omittedCount).toBe(2)
    expect(result.points[0]).toMatchObject({ rag: 80, fine: 20, delta: -60 })
  })

  it('never produces NaN when latency or summary metrics are missing', () => {
    const comparison = { dataset: { questionCount: 50 }, ragExperiment: { successCount: 4, latencyMs: undefined }, fineTunedExperiment: { successCount: 3, latencyMs: Number.NaN } }
    expect(buildLatencyChartData(comparison)).toEqual([{ model: 'RAG', latency: 0 }, { model: 'Fine-tuned', latency: 0 }])
    expect(buildDashboardKpis(comparison)).toMatchObject({ qualityLabel: 'Insufficient data', latencyLabel: 'Insufficient data' })
  })
})
