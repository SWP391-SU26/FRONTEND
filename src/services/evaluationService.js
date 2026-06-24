import { request } from './httpClient.js'
import { env } from '../config/env.js'

export async function getDatasets() {
  const result = await request('/evaluation/datasets')
  const list = Array.isArray(result) ? result : (result?.data ?? [])
  return list.map(toUiDataset)
}

export async function createDataset({ datasetName, courseId, workspaceId, createdBy }) {
  const result = await request('/evaluation/datasets', {
    method: 'POST',
    body: JSON.stringify({ datasetName, courseId, workspaceId, createdBy }),
  })
  return toUiDataset(result)
}

export async function getQuestions(datasetId) {
  const result = await request(`/evaluation/datasets/${datasetId}/questions`)
  const list = Array.isArray(result) ? result : (result?.data ?? [])
  return list.map(toUiQuestion)
}

export async function addQuestion({ datasetId, questionText, groundTruthAnswer }) {
  const result = await request('/evaluation/questions', {
    method: 'POST',
    body: JSON.stringify({ datasetId, questionText, groundTruthAnswer }),
  })
  return toUiQuestion(result)
}

export async function getExperiments() {
  const result = await request('/evaluation/experiments')
  const list = Array.isArray(result) ? result : (result?.data ?? [])
  return list.map(toUiExperiment)
}

export async function createExperiment({ datasetId, experimentName, experimentType, llmModel, configJson, createdBy }) {
  const result = await request('/evaluation/experiments', {
    method: 'POST',
    body: JSON.stringify({ datasetId, experimentName, experimentType, llmModel, configJson, createdBy }),
  })
  return toUiExperiment(result)
}

export async function createFineTuningRecord({ name, datasetId, researcherId, llmModel, configJson }) {
  const result = await request('/fine-tuning/experiments', {
    method: 'POST',
    body: JSON.stringify({ name, datasetId, researcherId, llmModel, configJson }),
  })
  return toUiExperiment(result)
}

export async function getFineTuningFiles() {
  const result = await request('/fine-tuning/files')
  return Array.isArray(result) ? result : (result?.data ?? [])
}

export async function exportJsonl(datasetId) {
  const response = await fetch(`${env.apiBaseUrl}/fine-tuning/export-jsonl/${datasetId}`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`)
  }
  return await response.blob()
}

// ── Simulation Engine for Benchmark Run ──
export async function runSimulation(experiment, onProgress) {
  const steps = [15, 38, 62, 85, 100]
  for (const progress of steps) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    onProgress(progress)
  }

  // Generate realistic metrics based on configuration
  const isFT = experiment.method === 'Fine-tuning' || experiment.experimentType === 'FINE_TUNING'
  
  if (isFT) {
    return {
      ragas: 0.74,
      latency: 1.3,
      accuracy: 0.71,
      cost: 4.2,
      metrics: [
        { label: 'Faithfulness', value: 72 },
        { label: 'Answer relevancy', value: 75 },
        { label: 'Context precision', value: 64 },
        { label: 'Context recall', value: 70 },
      ]
    }
  } else {
    // RAG baseline / semantic
    const isSemantic = (experiment.chunking || '').toLowerCase().includes('semantic')
    return {
      ragas: isSemantic ? 0.85 : 0.78,
      latency: isSemantic ? 2.3 : 1.9,
      accuracy: isSemantic ? 0.82 : 0.75,
      cost: isSemantic ? 3.1 : 2.5,
      metrics: [
        { label: 'Faithfulness', value: isSemantic ? 84 : 79 },
        { label: 'Answer relevancy', value: isSemantic ? 88 : 83 },
        { label: 'Context precision', value: isSemantic ? 81 : 75 },
        { label: 'Context recall', value: isSemantic ? 78 : 73 },
      ]
    }
  }
}

// ── Mappers ──
function toUiDataset(ds) {
  return {
    id: ds.datasetId,
    name: ds.datasetName,
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
    datasetId: q.datasetId,
    courseId: q.courseId,
    chapterId: q.chapterId,
    questionNo: q.questionNo,
    question: q.questionText,
    groundTruth: q.groundTruthAnswer,
    expectedDocumentId: q.expectedDocumentId,
    expectedPage: q.expectedPage,
    type: q.questionType,
    difficulty: q.difficulty,
  }
}

function toUiExperiment(e) {
  return {
    id: e.experimentId,
    datasetId: e.datasetId,
    courseId: e.courseId,
    workspaceId: e.workspaceId,
    name: e.experimentName,
    method: e.experimentType === 'FINE_TUNING' ? 'Fine-tuning' : 'RAG',
    llmModel: e.llmModel,
    embedding: e.embeddingModelId ? 'bge-m3' : 'multilingual-e5-base',
    chunking: e.chunkingStrategy || 'Fixed-size',
    status: e.status || 'PENDING',
    configJson: e.configJson,
    createdBy: e.createdBy,
    startedAt: e.startedAt,
    completedAt: e.completedAt,
    createdAt: e.createdAt,
    // Placeholder default metrics that will be filled after simulation
    ragas: 0.0,
    latency: 0.0,
    accuracy: 0.0,
    cost: 0.0,
  }
}
