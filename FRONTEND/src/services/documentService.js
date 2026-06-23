import { getSavedUser } from './authService.js'
import { request } from './httpClient.js'
import { env } from '../config/env.js'

function getRequesterId() {
  return getSavedUser()?.id ?? ''
}

export async function getDocumentsByWorkspace(workspaceId) {
  const requesterId = getRequesterId()
  const documents = await request(`/documents/workspace/${workspaceId}?requesterId=${requesterId}`)
  return Promise.all(documents.map((document) => toUiDocument(document)))
}

export async function getDocument(documentId) {
  const requesterId = getRequesterId()
  const document = await request(`/documents/${documentId}?requesterId=${requesterId}`)
  return toUiDocument(document)
}

export async function getDocumentPages(documentId) {
  const requesterId = getRequesterId()
  return request(`/documents/${documentId}/pages?requesterId=${requesterId}`)
}

export async function getDocumentChunks(documentId) {
  const requesterId = getRequesterId()
  const chunks = await request(`/documents/${documentId}/chunks?requesterId=${requesterId}`)
  return chunks.map(toUiChunk)
}

export function deleteDocument(documentId) {
  const requesterId = getRequesterId()
  return request(`/documents/${documentId}?requesterId=${requesterId}`, {
    method: 'DELETE',
  })
}

export function getDocumentFileUrl(documentId) {
  return `${env.apiBaseUrl}/documents/${documentId}/file`
}

export function getDocumentPreviewUrl(documentId) {
  const requesterId = getRequesterId()
  return `${env.apiBaseUrl}/documents/${documentId}/preview?requesterId=${requesterId}`
}

export async function uploadDocument({ file, workspaceId, courseId, chapterId, uploadedBy }) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('workspaceId', workspaceId)
  formData.append('courseId', courseId)

  if (chapterId) formData.append('chapterId', chapterId)
  if (uploadedBy) formData.append('uploadedBy', uploadedBy)

  const document = await request('/documents/upload', {
    method: 'POST',
    body: formData,
  })

  return toUiDocument(document)
}

export function toUiDocument(document, extra = {}) {
  const status = toUiStatus(document.processingStatus)

  const uploadedAt = document.uploadedAt
    ? new Date(document.uploadedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : document.createdAt
    ? new Date(document.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—'

  return {
    id: document.documentId,
    name: document.originalFilename,
    displayName: document.documentTitle || document.originalFilename,
    type: (document.fileType ?? '').toUpperCase(),
    subject: extra.subject ?? 'Course Workspace',
    chapter: extra.chapter ?? 'General',
    status,
    chunks: extra.chunks ?? 0,
    embeddingModel: status === 'Indexed' ? 'keyword-hash-128' : 'Not embedded',
    uploadedAt,
    size: extra.size ?? 'Stored',
    pages: document.totalPages ?? 0,
    workspaceId: document.workspaceId,
    courseId: document.courseId,
    chapterId: document.chapterId ?? null,
    preview:
      document.errorMessage ??
      'Document processed by Spring Boot: file stored, text extracted, and chunks prepared.',
  }
}

export function toUiChunk(chunk) {
  return {
    id: chunk.chunkId,
    documentId: chunk.documentId,
    page: chunk.pageStart ?? 1,
    tokenLength: chunk.tokenCount ?? 0,
    metadata: chunk.chunkStrategy ?? 'fixed chunk',
    relevance: 80,
    content: chunk.content,
  }
}

function toUiStatus(status) {
  switch (status) {
    case 'INDEXED':
    case 'PROCESSED':
      return 'Indexed'
    case 'PROCESSING':
      return 'Processing'
    case 'FAILED':
      return 'Failed'
    case 'NO_TEXT':
      return 'Uploaded'
    default:
      return status ?? 'Uploaded'
  }
}
