import { request } from './httpClient.js'
import { env } from '../config/env.js'

export async function getDatasets() {
  const result = await request('/evaluation/datasets')
  return unwrapList(result).map(toUiDataset)
}

export async function createDataset({ datasetName, courseId, workspaceId, createdBy }) {
  const result = await request('/evaluation/datasets', {
    method: 'POST',
    body: JSON.stringify({ datasetName, courseId, workspaceId, createdBy }),
  })
  return toUiDataset(unwrapOne(result))
}

export async function getQuestions(datasetId) {
  const result = await request(`/evaluation/datasets/${datasetId}/questions`)
  return unwrapList(result).map(toUiQuestion)
}

export async function addQuestion({ datasetId, questionText, groundTruthAnswer }) {
  const result = await request('/evaluation/questions', {
    method: 'POST',
    body: JSON.stringify({ datasetId, questionText, groundTruthAnswer }),
  })
  return toUiQuestion(unwrapOne(result))
}

export async function getExperiments() {
  const result = await request('/evaluation/experiments')
  return unwrapList(result).map(toUiExperiment).filter(Boolean)
}

export async function createExperiment({ datasetId, experimentName, experimentType, llmModel, configJson, createdBy }) {
  const result = await request('/evaluation/experiments', {
    method: 'POST',
    body: JSON.stringify({ datasetId, experimentName, experimentType, llmModel, configJson, createdBy }),
  })
  return toUiExperiment(unwrapOne(result))
}

export async function runBenchmark(experimentId) {
  try {
    return await request(`/evaluation/experiments/${experimentId}/run`, {
      method: 'POST',
    })
  } catch (error) {
    const message = error.message || ''
    const unavailable =
      error.status === 500 ||
      error.status === 501 ||
      message.toLowerCase().includes('unsupported') ||
      message.toLowerCase().includes('not implemented')

    if (unavailable) {
      const nextError = new Error('Benchmark execution is not available yet. The experiment record was created successfully.')
      nextError.status = error.status
      throw nextError
    }

    throw error
  }
}

export async function getExperimentResults(experimentId) {
  const result = await request(`/evaluation/experiments/${experimentId}/results`)
  return unwrapList(result).map(toUiExperimentResult)
}

export async function createFineTuningRecord({ name, datasetId, researcherId, llmModel, configJson }) {
  const result = await request('/fine-tuning/experiments', {
    method: 'POST',
    body: JSON.stringify({ name, datasetId, researcherId, llmModel, configJson }),
  })
  return toUiExperiment(unwrapOne(result))
}

export async function getFineTuningFiles() {
  const result = await request('/fine-tuning/files')
  return unwrapList(result)
}

export async function exportJsonl(datasetId) {
  const response = await fetch(`${env.apiBaseUrl}/fine-tuning/export-jsonl/${datasetId}`, {
    method: 'POST',
  })

  if (!response.ok) {
    let message = `Export failed with status ${response.status}`
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => null)
      message = payload?.message || payload?.error || message
    }
    throw new Error(message)
  }

  return await response.blob()
}

function unwrapList(result) {
  return Array.isArray(result) ? result : (result?.data ?? [])
}

function unwrapOne(result) {
  return result?.data ?? result
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
    createdBy: ds.createdBy,
    createdAt: ds.createdAt,
  }
}

function toUiQuestion(q) {
  return {
    id: q.evaluationQuestionId,
    evaluationQuestionId: q.evaluationQuestionId,
    datasetId: q.datasetId,
    courseId: q.courseId,
    chapterId: q.chapterId,
    questionNo: q.questionNo,
    question: q.questionText,
    questionText: q.questionText,
    groundTruth: q.groundTruthAnswer,
    groundTruthAnswer: q.groundTruthAnswer,
    expectedDocumentId: q.expectedDocumentId,
    expectedPage: q.expectedPage,
    type: q.questionType,
    questionType: q.questionType,
    difficulty: q.difficulty,
  }
}

function toUiExperiment(e) {
  if (!e) return null
  const experimentType = e.experimentType ?? 'RAG'

  return {
    id: e.experimentId,
    experimentId: e.experimentId,
    datasetId: e.datasetId,
    courseId: e.courseId,
    workspaceId: e.workspaceId,
    name: e.experimentName,
    experimentName: e.experimentName,
    experimentType,
    method: experimentType === 'FINE_TUNING' ? 'Fine-tuning' : 'RAG',
    llmModel: e.llmModel,
    embeddingModelId: e.embeddingModelId,
    chunkingStrategy: e.chunkingStrategy,
    topK: e.topK,
    temperature: e.temperature,
    fineTunedModelName: e.fineTunedModelName,
    configJson: e.configJson,
    status: e.status || 'PENDING',
    createdBy: e.createdBy,
    startedAt: e.startedAt,
    completedAt: e.completedAt,
    createdAt: e.createdAt,
  }
}

function toUiExperimentResult(result) {
  return {
    id: result.experimentResultId,
    experimentResultId: result.experimentResultId,
    experimentId: result.experimentId,
    evaluationQuestionId: result.evaluationQuestionId,
    generatedAnswer: result.generatedAnswer,
    retrievedContextJson: result.retrievedContextJson,
    citationsJson: result.citationsJson,
    faithfulness: result.faithfulness,
    answerRelevance: result.answerRelevance,
    contextPrecision: result.contextPrecision,
    contextRecall: result.contextRecall,
    answerCorrectness: result.answerCorrectness,
    semanticSimilarity: result.semanticSimilarity,
    latencyMs: result.latencyMs,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    totalTokens: result.totalTokens,
    cost: result.cost,
    errorMessage: result.errorMessage,
    createdAt: result.createdAt,
  }
}
