const TIE_THRESHOLD = 0.02

export function buildQualityChartData(comparison, labels = {}) {
  const rag = comparison?.ragExperiment ?? {}
  const fine = comparison?.fineTunedExperiment ?? {}
  return [
    metricRow(labels.tokenOverlap ?? 'Token overlap (proxy)', rag.tokenOverlapProxy, fine.tokenOverlapProxy),
    metricRow(labels.answerRelevance ?? 'Answer relevancy', rag.answerRelevance, fine.answerRelevance),
  ]
}

export function buildGroundingChartData(comparison, labels = {}) {
  const rag = comparison?.ragExperiment ?? {}
  return [
    singleMetricRow(labels.faithfulness ?? 'Faithfulness', rag.faithfulness),
    singleMetricRow(labels.contextPrecision ?? 'Context precision', rag.contextPrecision),
    singleMetricRow(labels.contextRecall ?? 'Context recall', rag.contextRecall),
  ]
}

export function buildOutcomeChartData(rows = [], labels = {}) {
  const counts = { rag: 0, fine: 0, tie: 0, error: 0 }
  rows.forEach((row) => { counts[classifyOutcome(row)] += 1 })
  const total = rows.length
  const percentages = Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, total ? round(value * 100 / total) : 0]))
  return { counts, percentages, total, chartData: [{ name: labels.questionGroup?.replace('{count}', total) ?? `${total} questions`, ...percentages }] }
}

export function buildScatterChartData(rows = []) {
  const points = rows.filter((row) => !row.ragError && !row.fineTunedError
      && isFiniteNumber(row.ragTokenOverlapProxy) && isFiniteNumber(row.fineTunedTokenOverlapProxy))
    .map((row, index) => ({
      id: row.questionId,
      index: index + 1,
      question: row.question,
      rag: round(row.ragTokenOverlapProxy * 100),
      fine: round(row.fineTunedTokenOverlapProxy * 100),
      delta: round((row.fineTunedTokenOverlapProxy - row.ragTokenOverlapProxy) * 100),
    }))
  return { points, omittedCount: rows.length - points.length }
}

export function buildLatencyChartData(comparison, labels = {}) {
  return [
    { model: 'RAG', latency: safeNumber(comparison?.ragExperiment?.latencyMs) },
    { model: labels.fineTuned ?? 'Fine-tuned', latency: safeNumber(comparison?.fineTunedExperiment?.latencyMs) },
  ]
}

export function buildDashboardKpis(comparison, labels = {}) {
  const rag = comparison?.ragExperiment ?? {}
  const fine = comparison?.fineTunedExperiment ?? {}
  const total = comparison?.dataset?.questionCount ?? comparison?.perQuestion?.length ?? 0
  const ragValid = safeNumber(rag.successCount)
  const fineValid = safeNumber(fine.successCount)
  const qualityDelta = isFiniteNumber(rag.tokenOverlapProxy) && isFiniteNumber(fine.tokenOverlapProxy)
    ? fine.tokenOverlapProxy - rag.tokenOverlapProxy : null
  const latencyDelta = isFiniteNumber(rag.latencyMs) && isFiniteNumber(fine.latencyMs) && Math.max(rag.latencyMs, fine.latencyMs) > 0
    ? 1 - Math.min(rag.latencyMs, fine.latencyMs) / Math.max(rag.latencyMs, fine.latencyMs) : null
  return {
    validLabel: `RAG ${ragValid}/${total} · ${labels.fineTuned ?? 'Fine-tuned'} ${fineValid}/${total}`,
    qualityLabel: qualityDelta == null ? (labels.insufficientData ?? 'Insufficient data') : Math.abs(qualityDelta) < TIE_THRESHOLD
      ? (labels.nearEquivalent ?? 'Near equivalent') : `${qualityDelta > 0 ? (labels.fineTuned ?? 'Fine-tuned') : 'RAG'} +${Math.round(Math.abs(qualityDelta) * 100)} pp`,
    latencyLabel: latencyDelta == null ? (labels.insufficientData ?? 'Insufficient data') : `${rag.latencyMs < fine.latencyMs ? 'RAG' : (labels.fineTuned ?? 'Fine-tuned')} ${labels.fasterBy?.replace('{percent}', Math.round(latencyDelta * 100)) ?? `faster by ${Math.round(latencyDelta * 100)}%`}`,
    compatibilityLabel: comparison?.datasetChecksum && comparison?.benchmarkProfile ? (labels.sameSnapshot ?? 'Same snapshot and profile') : (labels.needsReview ?? 'Needs review'),
  }
}

export function classifyOutcome(row) {
  if (row?.ragError || row?.fineTunedError) return 'error'
  const delta = row?.tokenOverlapProxyDelta
  if (!isFiniteNumber(delta) || Math.abs(delta) < TIE_THRESHOLD) return 'tie'
  return delta > 0 ? 'fine' : 'rag'
}

function metricRow(label, rag, fine) {
  return { metric: label, rag: percentage(rag), fine: percentage(fine) }
}

function singleMetricRow(label, value) {
  return { metric: label, value: percentage(value) }
}

function percentage(value) {
  return isFiniteNumber(value) ? round(value * 100) : null
}

function safeNumber(value) {
  return isFiniteNumber(value) ? value : 0
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function round(value) {
  return Math.round(value * 10) / 10
}
