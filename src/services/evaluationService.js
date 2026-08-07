import { request } from './httpClient.js'

export async function getEvaluationScopes() {
  return unwrapList(await request('/evaluation/scopes')).map((semester) => ({
    id: semester.semesterId,
    semesterId: semester.semesterId,
    name: semester.semesterName,
    status: semester.status,
    courses: unwrapList(semester.courses).map((course) => ({
      id: course.courseId,
      courseId: course.courseId,
      code: course.courseCode,
      name: course.courseName,
      status: course.status,
      documentCount: Number(course.documentCount ?? 0),
      processedDocumentCount: Number(course.processedDocumentCount ?? 0),
    })),
  }))
}

export async function getDatasets() {
  return unwrapList(await request('/evaluation/datasets')).map(toUiDataset)
}

export async function createDataset({ datasetName, courseId, documentIds }) {
  return toUiDataset(await request('/evaluation/datasets', {
    method: 'POST',
    body: JSON.stringify({ datasetName, courseId, documentIds }),
  }))
}

export async function getDatasetDocuments(datasetId) {
  return unwrapList(await request(`/evaluation/datasets/${datasetId}/documents`))
}

export async function importQuestions(datasetId, file) {
  const formData = new FormData()
  formData.append('file', file)
  return request(`/evaluation/datasets/${datasetId}/questions/import`, { method: 'POST', body: formData })
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
  return toUiExperiment(await request(`/evaluation/experiments/${experimentId}`))
}

export async function createExperiment(payload) {
  return toUiExperiment(await request('/evaluation/experiments', {
    method: 'POST',
    body: JSON.stringify({
      datasetId: payload.datasetId,
      experimentName: payload.experimentName,
      experimentType: payload.experimentType,
      llmModel: payload.llmModel,
      configJson: payload.configJson || '{}',
    }),
  }))
}

export async function runBenchmark(experimentId, { allowUnverifiedModel = false } = {}) {
  return toUiExperiment(await request(`/evaluation/experiments/${experimentId}/run`, {
    method: 'POST',
    body: JSON.stringify({ allowUnverifiedModel }),
  }))
}

export async function runBenchmarkPair({
  ragExperimentId,
  fineTunedExperimentId,
  allowUnverifiedModel = false,
}) {
  const response = await request('/evaluation/experiments/run-pair', {
    method: 'POST',
    body: JSON.stringify({ ragExperimentId, fineTunedExperimentId, allowUnverifiedModel }),
  })
  return {
    rag: toUiExperiment(response?.rag),
    fineTuned: toUiExperiment(response?.fineTuned),
  }
}

export async function cancelBenchmark(experimentId) {
  return toUiExperiment(await request(`/evaluation/experiments/${experimentId}/cancel`, { method: 'POST' }))
}

export async function waitForExperiment(experimentId, { onProgress, timeoutMs = 1800000 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const experiment = await getExperiment(experimentId)
    onProgress?.(experiment)
    if (experiment.status === 'CANCELLED') return experiment
    if (experiment.status === 'COMPLETED'
      && (!experiment.ragasStatus || ['COMPLETED', 'FAILED'].includes(experiment.ragasStatus))) {
      return experiment
    }
    if (experiment.status === 'FAILED') {
      const error = new Error(experiment.errorMessage || 'Benchmark failed.')
      error.code = 'BENCHMARK_FAILED'
      error.experiment = experiment
      throw error
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 1500))
  }
  const error = new Error('Benchmark is still running. You can leave this page and return later.')
  error.code = 'BENCHMARK_TIMEOUT'
  throw error
}

export async function getReadiness(datasetId, experimentType) {
  return request(`/evaluation/readiness?datasetId=${encodeURIComponent(datasetId)}&experimentType=${encodeURIComponent(experimentType)}`)
}

export async function getModelReadiness() {
  return request('/evaluation/model-readiness')
}

export async function getExperimentResults(experimentId) {
  return unwrapList(await request(`/evaluation/experiments/${experimentId}/results`)).map(toUiExperimentResult)
}

export async function getComparison({ datasetId, ragExperimentId, fineTunedExperimentId }) {
  const query = new URLSearchParams({ datasetId, ragExperimentId, fineTunedExperimentId })
  return request(`/evaluation/comparison?${query}`)
}

export async function createEvaluationReport({
  datasetId,
  ragExperimentId,
  fineTunedExperimentId,
  language,
  title,
}) {
  return request('/evaluation/reports', {
    method: 'POST',
    body: JSON.stringify({ datasetId, ragExperimentId, fineTunedExperimentId, language, title }),
  })
}

export async function getEvaluationReport(reportId) {
  return request(`/evaluation/reports/${reportId}`)
}

export async function waitForEvaluationReport(reportId, { onProgress, timeoutMs = 120000 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const report = await getEvaluationReport(reportId)
    onProgress?.(report)
    if (report.status === 'COMPLETED') return report
    if (report.status === 'FAILED') {
      throw new Error(report.errorMessage || 'Report generation failed.')
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 1000))
  }
  throw new Error('Report generation is still running. Please try downloading it again shortly.')
}

export function downloadEvaluationReport(reportId, format) {
  const query = new URLSearchParams({ format: String(format).toUpperCase() })
  return request(`/evaluation/reports/${reportId}/download?${query}`, { responseType: 'blob' })
}

export function createFineTuningRecord({ name, datasetId, llmModel, configJson }) {
  return request('/fine-tuning/experiments', {
    method: 'POST',
    body: JSON.stringify({ name, datasetId, llmModel, configJson }),
  }).then(toUiExperiment)
}

export function getFineTuningFiles() {
  return request('/fine-tuning/files').then(unwrapList)
}

export function getFineTuningStatus() {
  return getModelReadiness()
}

export function exportJsonl(datasetId) {
  return request(`/fine-tuning/export-jsonl/${datasetId}`, { method: 'POST', responseType: 'blob' })
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
    semesterId: ds.semesterWorkspaceId,
    courseId: ds.courseId,
    documentIds: ds.documentIds ?? [],
    status: ds.status ?? 'DRAFT',
    validationError: ds.validationError ?? null,
    checksum: ds.checksum ?? null,
    createdAt: ds.createdAt,
    updatedAt: ds.updatedAt,
  }
}

function toUiQuestion(question) {
  return {
    id: question.evaluationQuestionId,
    evaluationQuestionId: question.evaluationQuestionId,
    datasetId: question.datasetId,
    questionNo: question.questionNo,
    question: question.questionText,
    questionText: question.questionText,
    groundTruth: question.groundTruthAnswer,
    groundTruthAnswer: question.groundTruthAnswer,
    expectedDocumentId: question.expectedDocumentId,
    expectedPage: question.expectedPage,
    type: question.questionType,
    difficulty: question.difficulty,
  }
}

function toUiExperiment(experiment) {
  if (!experiment) return null
  const type = String(experiment.experimentType ?? 'RAG').includes('FINE') ? 'FINE_TUNED' : 'RAG'
  const parsedConfig = parseJson(experiment.configJson, {})
  return {
    id: experiment.experimentId,
    experimentId: experiment.experimentId,
    datasetId: experiment.datasetId,
    courseId: experiment.courseId,
    name: experiment.experimentName,
    experimentName: experiment.experimentName,
    experimentType: type,
    method: type === 'FINE_TUNED' ? 'Fine-tuned' : 'RAG',
    llmModel: experiment.llmModel,
    configJson: experiment.configJson,
    benchmarkProfile: parsedConfig.benchmarkProfile ?? null,
    modelVerificationStatus: parsedConfig.modelVerificationStatus ?? null,
    allowUnverifiedModel: Boolean(parsedConfig.allowUnverifiedModel),
    status: experiment.status || 'PENDING',
    progress: Number(experiment.progress ?? 0),
    successCount: Number(experiment.successCount ?? 0),
    failureCount: Number(experiment.failureCount ?? 0),
    datasetChecksum: experiment.datasetChecksum ?? null,
    startedAt: experiment.startedAt,
    completedAt: experiment.completedAt,
    createdAt: experiment.createdAt,
    updatedAt: experiment.updatedAt,
    errorMessage: experiment.errorMessage ?? null,
    ragasStatus: experiment.ragasStatus ?? null,
    ragasProgress: Number(experiment.ragasProgress ?? 0),
    ragasError: experiment.ragasError ?? null,
    ragasStartedAt: experiment.ragasStartedAt ?? null,
    ragasCompletedAt: experiment.ragasCompletedAt ?? null,
    localDurationMs: experiment.localDurationMs == null ? null : Number(experiment.localDurationMs),
    requestedBatchSize: experiment.requestedBatchSize == null ? null : Number(experiment.requestedBatchSize),
    effectiveBatchSize: experiment.effectiveBatchSize == null ? null : Number(experiment.effectiveBatchSize),
    oomFallbackCount: Number(experiment.oomFallbackCount ?? 0),
  }
}

function toUiExperimentResult(result) {
  return {
    id: result.experimentResultId,
    experimentResultId: result.experimentResultId,
    experimentId: result.experimentId,
    evaluationQuestionId: result.evaluationQuestionId,
    questionText: result.questionText,
    groundTruthAnswer: result.groundTruthAnswer,
    generatedAnswer: result.generatedAnswer,
    contexts: parseJson(result.retrievedContextJson, []),
    citations: parseJson(result.citationsJson, []),
    faithfulness: result.faithfulness,
    answerRelevance: result.answerRelevance,
    contextPrecision: result.contextPrecision,
    contextRecall: result.contextRecall,
    tokenOverlapProxy: result.answerCorrectness,
    providerUsed: result.providerUsed,
    baseModel: result.baseModel,
    adapterVersion: result.adapterVersion,
    embeddingModel: result.embeddingModel,
    generationMode: result.generationMode,
    datasetVersion: result.datasetVersion,
    promptVersion: result.promptVersion,
    metricStandard: result.metricStandard,
    ragasStatus: result.ragasStatus ?? null,
    ragasError: result.ragasError ?? null,
    ragasEvaluatedAt: result.ragasEvaluatedAt ?? null,
    judgeModel: result.judgeModel,
    evaluatorEmbedding: result.evaluatorEmbedding,
    sourceHit: result.sourceHit,
    pageHit: result.pageHit,
    refusalCorrect: result.refusalCorrect,
    throughputQps: result.throughputQps,
    peakVramBytes: result.peakVramBytes,
    modelVerificationStatus: result.modelVerificationStatus,
    qualityGatePassed: result.qualityGatePassed,
    latencyMs: result.latencyMs,
    batchLatencyMs: result.batchLatencyMs,
    effectiveLatencyMs: result.effectiveLatencyMs ?? result.latencyMs,
    batchSize: result.batchSize,
    errorMessage: result.errorMessage,
  }
}

function parseJson(value, fallback) {
  if (!value) return fallback
  try { return JSON.parse(value) } catch { return fallback }
}
