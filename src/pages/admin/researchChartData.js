const TIE_THRESHOLD = 0.02

export function buildQualityChartData(comparison) {
  const rag = comparison?.ragExperiment ?? {}
  const fine = comparison?.fineTunedExperiment ?? {}
  return [
    metricRow('Correctness', rag.answerCorrectness, fine.answerCorrectness),
    metricRow('Relevance', rag.answerRelevance, fine.answerRelevance),
    metricRow('Similarity', rag.semanticSimilarity, fine.semanticSimilarity),
  ]
}

export function buildGroundingChartData(comparison) {
  const rag = comparison?.ragExperiment ?? {}
  return [
    singleMetricRow('Faithfulness', rag.faithfulness),
    singleMetricRow('Context precision', rag.contextPrecision),
    singleMetricRow('Context recall', rag.contextRecall),
  ]
}

export function buildOutcomeChartData(rows = []) {
  const counts = { rag: 0, fine: 0, tie: 0, error: 0 }
  rows.forEach((row) => { counts[classifyOutcome(row)] += 1 })
  const total = rows.length
  const percentages = Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, total ? round(value * 100 / total) : 0]))
  return { counts, percentages, total, chartData: [{ name: `${total} questions`, ...percentages }] }
}

export function buildScatterChartData(rows = []) {
  const points = rows.filter((row) => !row.ragError && !row.fineTunedError
      && isFiniteNumber(row.ragAnswerCorrectness) && isFiniteNumber(row.fineTunedAnswerCorrectness))
    .map((row, index) => ({
      id: row.questionId,
      index: index + 1,
      question: row.question,
      rag: round(row.ragAnswerCorrectness * 100),
      fine: round(row.fineTunedAnswerCorrectness * 100),
      delta: round((row.fineTunedAnswerCorrectness - row.ragAnswerCorrectness) * 100),
    }))
  return { points, omittedCount: rows.length - points.length }
}

export function buildLatencyChartData(comparison) {
  return [
    { model: 'RAG', latency: safeNumber(comparison?.ragExperiment?.latencyMs) },
    { model: 'Fine-tuned', latency: safeNumber(comparison?.fineTunedExperiment?.latencyMs) },
  ]
}

export function buildDashboardKpis(comparison) {
  const rag = comparison?.ragExperiment ?? {}
  const fine = comparison?.fineTunedExperiment ?? {}
  const total = comparison?.dataset?.questionCount ?? comparison?.perQuestion?.length ?? 0
  const ragValid = safeNumber(rag.successCount)
  const fineValid = safeNumber(fine.successCount)
  const qualityDelta = isFiniteNumber(rag.answerCorrectness) && isFiniteNumber(fine.answerCorrectness)
    ? fine.answerCorrectness - rag.answerCorrectness : null
  const latencyDelta = isFiniteNumber(rag.latencyMs) && isFiniteNumber(fine.latencyMs) && Math.max(rag.latencyMs, fine.latencyMs) > 0
    ? 1 - Math.min(rag.latencyMs, fine.latencyMs) / Math.max(rag.latencyMs, fine.latencyMs) : null
  return {
    validLabel: `RAG ${ragValid}/${total} · Fine-tuned ${fineValid}/${total}`,
    qualityLabel: qualityDelta == null ? 'Insufficient data' : Math.abs(qualityDelta) < TIE_THRESHOLD
      ? 'Near equivalent' : `${qualityDelta > 0 ? 'Fine-tuned' : 'RAG'} +${Math.round(Math.abs(qualityDelta) * 100)} pp`,
    latencyLabel: latencyDelta == null ? 'Insufficient data' : `${rag.latencyMs < fine.latencyMs ? 'RAG' : 'Fine-tuned'} faster by ${Math.round(latencyDelta * 100)}%`,
    compatibilityLabel: comparison?.datasetChecksum && comparison?.benchmarkProfile ? 'Same snapshot and profile' : 'Needs review',
  }
}

export function classifyOutcome(row) {
  if (row?.ragError || row?.fineTunedError) return 'error'
  const delta = row?.answerCorrectnessDelta
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
