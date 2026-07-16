import { request } from './httpClient.js'

export async function getEmbeddingModels() {
  const result = await request('/rag/embedding-models')
  return (Array.isArray(result) ? result : result?.items ?? []).map((model) => ({
    id: model.embeddingModelId ?? model.id,
    embeddingModelId: model.embeddingModelId ?? model.id,
    name: model.modelName,
    provider: model.provider,
    dimension: model.dimension,
    status: model.status ?? (model.isActive ? 'AVAILABLE' : 'DISABLED'),
    isActive: Boolean(model.isActive),
  }))
}

export async function getActiveEmbeddingModel() {
  const models = await getEmbeddingModels()
  return models.find((model) => model.isActive && model.status === 'AVAILABLE') ?? null
}

export function getModelCapabilities() {
  return Promise.resolve({
    models: [],
    officialRagasEnabled: false,
    note: 'Current Java backend exposes /rag/embedding-models but not model capabilities.',
  })
}
