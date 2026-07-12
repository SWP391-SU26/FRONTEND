import { request } from './httpClient.js'
import { getCurrentUserId } from './authService.js'

export async function getDatasets() {
  return unwrapList(await request('/evaluation/datasets')).map(toUiDataset)
}

export async function createDataset({ datasetName, courseId, workspaceId, documentIds = [] }) {
  void documentIds
  return toUiDataset(await request('/evaluation/datasets', {
    method: 'POST',
    body: JSON.stringify({ datasetName, courseId, workspaceId, createdBy: getCurrentUserId() }),
  }))
}

export async function importQuestions(datasetId, file) {
  const formData = new FormData()
  formData.append('file', file)
  return request(`/evaluation/datasets/${datasetId}/questions/import`, {
    method: 'POST',
    body: formData,
  })
}

export async function getQuestions(datasetId) {
  return unwrapList(await request(`/evaluation/datasets/${datasetId}/questions`)).map(toUiQuestion)
}

export async function addQuestion(payload) {
  return toUiQuestion(await request('/evaluation/questions', {
    method: 'POST',
    body: JSON.stringify({
      datasetId: payload.datasetId,
      questionText: payload.questionText,
      groundTruthAnswer: payload.groundTruthAnswer,
    }),
  }))
}

export async function getExperiments() {
  return unwrapList(await request('/evaluation/experiments')).map(toUiExperiment).filter(Boolean)
}

export async function getExperiment(experimentId) {
  const experiments = await getExperiments()
  return experiments.find((experiment) => experiment.id === experimentId) ?? null
}

export async function createExperiment(payload) {
  return toUiExperiment(await request('/evaluation/experiments', {
    method: 'POST',
    body: JSON.stringify({
      datasetId: payload.datasetId,
      experimentName: payload.experimentName,
      experimentType: payload.experimentType,
      llmModel: payload.llmModel || payload.embeddingModelName || payload.generationMode || 'rag',
      configJson: payload.configJson || '{}',
      createdBy: getCurrentUserId(),
    }),
  }))
}

export async function runBenchmark(experimentId) {
  const result = await request(`/evaluation/experiments/${experimentId}/run`, { method: 'POST' })
  return {
    jobId: result.jobId ?? result.benchmarkJobId ?? result.experimentId ?? experimentId,
    experimentId: result.experimentId ?? experimentId,
    status: result.status ?? 'COMPLETED',
  }
}

export async function waitForExperiment(experimentId, { onProgress, timeoutMs = 1800000 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const experiment = await getExperiment(experimentId)
    if (!experiment) return { id: experimentId, experimentId, status: 'COMPLETED', progress: 100 }
    onProgress?.(experiment)
    if (experiment.status === 'COMPLETED') return experiment
    if (experiment.status === 'FAILED') {
      const error = new Error(experiment.errorMessage || 'Benchmark failed.')
      error.code = 'BENCHMARK_FAILED'
      throw error
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1500))
  }
  const error = new Error('Benchmark is still running. Refresh to check its progress.')
  error.code = 'BENCHMARK_TIMEOUT'
  throw error
}

export async function getExperimentResults(experimentId) {
  return unwrapList(await request(`/evaluation/experiments/${experimentId}/results`)).map(toUiExperimentResult)
}

export function getEvaluationDashboard(filters = {}) {
  void filters
  return Promise.resolve({
    summary: {},
    configurations: [],
    recommended: null,
    metricMetadata: {
      officialRagas: false,
      note: 'Current Java backend does not expose /evaluation/dashboard yet.',
    },
  })
}

export function getEvaluationCapabilities() {
  return Promise.resolve({
    officialRagasEnabled: false,
    judgeModel: 'Not available',
    evaluatorEmbedding: 'Not available',
  })
}

export function createFineTuningRecord({ name, datasetId, llmModel, configJson }) {
  return request('/fine-tuning/experiments', {
    method: 'POST',
    body: JSON.stringify({ name, datasetId, researcherId: getCurrentUserId(), llmModel, configJson }),
  }).then(toUiExperiment)
}

export function getFineTuningFiles() {
  return request('/fine-tuning/files').then(unwrapList)
}

export function getFineTuningStatus() {
  return Promise.resolve({ ready: false, status: 'UNAVAILABLE' })
}

export function exportJsonl(datasetId) {
  return request(`/fine-tuning/export-jsonl/${datasetId}`, {
    method: 'POST',
    responseType: 'blob',
  })
}

export function exportEvaluationReport(format = 'csv') {
  const content = format === 'json' ? '[]' : 'experiment,metric,value\n'
  const type = format === 'json' ? 'application/json' : 'text/csv'
  return Promise.resolve(new Blob([content], { type }))
}

function unwrapList(result) {
  return Array.isArray(result) ? result : (result?.items ?? result?.content ?? [])
}

function toUiDataset(ds) {
  return {
    id: ds.datasetId,
    datasetId: ds.datasetId,
    name: ds.datasetName,
    datasetName: ds.datasetName,
    version: ds.datasetVersion,
    description: ds.description,
    courseId: ds.courseId,
    workspaceId: ds.workspaceId,
    documentIds: ds.documentIds ?? [],
    questionCount: ds.questionCount ?? 0,
    checksum: ds.checksum ?? null,
    createdAt: ds.createdAt,
  }
}

function toUiQuestion(q) {
  return {
    id: q.evaluationQuestionId,
    evaluationQuestionId: q.evaluationQuestionId,
    datasetId: q.datasetId,
    questionNo: q.questionNo,
    question: q.questionText,
    questionText: q.questionText,
    groundTruth: q.groundTruthAnswer,
    groundTruthAnswer: q.groundTruthAnswer,
    expectedDocumentId: q.expectedDocumentId,
    expectedPage: q.expectedPage,
    isOutOfScope: Boolean(q.isOutOfScope),
    type: q.questionType,
    difficulty: q.difficulty,
  }
}

function toUiExperiment(e) {
  if (!e) return null
  const type = e.experimentType ?? 'RAG'
  return {
    id: e.experimentId,
    experimentId: e.experimentId,
    datasetId: e.datasetId,
    name: e.experimentName,
    experimentType: type,
    method: type === 'FINE_TUNING' ? 'Fine-tuning' : 'RAG',
    embeddingModelId: e.embeddingModelId,
    embeddingModelName: e.embeddingModelName,
    chunkingStrategy: e.chunkingStrategy,
    generationMode: e.generationMode,
    topK: e.topK,
    temperature: e.temperature,
    seed: e.seed,
    configJson: e.configJson,
    status: e.status || 'PENDING',
    progress: Number(e.progress ?? 0),
    startedAt: e.startedAt,
    completedAt: e.completedAt,
    createdAt: e.createdAt,
    errorMessage: e.errorMessage ?? null,
  }
}

function toUiExperimentResult(result) {
  return {
    id: result.experimentResultId,
    experimentId: result.experimentId,
    evaluationQuestionId: result.evaluationQuestionId,
    generatedAnswer: result.generatedAnswer,
    contexts: result.contexts ?? parseJson(result.retrievedContextJson, []),
    citations: result.citations ?? parseJson(result.citationsJson, []),
    faithfulness: result.faithfulness,
    answerRelevance: result.answerRelevance,
    contextPrecision: result.contextPrecision,
    contextRecall: result.contextRecall,
    answerCorrectness: result.answerCorrectness,
    semanticSimilarity: result.semanticSimilarity,
    latencyMs: result.latencyMs,
    cost: result.cost,
    errorMessage: result.errorMessage,
    createdAt: result.createdAt,
  }
}

function parseJson(value, fallback) {
  if (!value) return fallback
  try { return JSON.parse(value) } catch { return fallback }
}
