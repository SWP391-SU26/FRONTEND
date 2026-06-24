import { request } from './httpClient.js'

/** Lấy embedding model active đầu tiên, hoặc null nếu không có */
export async function getActiveEmbeddingModel() {
  const models = await request('/rag/embedding-models')
  const list = Array.isArray(models) ? models : []
  return list.find((m) => m.isActive) ?? list[0] ?? null
}

/**
 * Chuẩn bị embeddings (re-index) cho 1 document.
 * @param {string} documentId
 * @param {string} workspaceId
 * @param {string} embeddingModelId
 */
export async function prepareEmbeddings(documentId, workspaceId, embeddingModelId) {
  return request('/rag/embeddings/prepare', {
    method: 'POST',
    body: JSON.stringify({ documentId, workspaceId, embeddingModelId }),
  })
}
