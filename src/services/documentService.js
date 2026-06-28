import { getSavedUser } from './authService.js'
import { request } from './httpClient.js'
import { env } from '../config/env.js'

function getRequesterId() {
  const requesterId = getSavedUser()?.id
  if (!requesterId) {
    throw new Error('Sign in before opening document APIs.')
  }
  return requesterId
}

export async function getDocuments() {
  const requesterId = getRequesterId()
  const documents = await request(`/documents?requesterId=${requesterId}`)
  const list = Array.isArray(documents) ? documents : (documents?.data ?? [])
  return list.map((doc) => toUiDocument(doc))
}

export async function getDocumentsByWorkspace(workspaceId) {
  const requesterId = getRequesterId()
  const documents = await request(`/documents/workspace/${workspaceId}?requesterId=${requesterId}`)
  const list = Array.isArray(documents) ? documents : (documents?.data ?? [])
  return list.map((doc) => toUiDocument(doc))
}

export async function getDocument(documentId) {
  const requesterId = getRequesterId()
  const document = await request(`/documents/${documentId}?requesterId=${requesterId}`)
  return toUiDocument(document?.data ?? document)
}

export async function getDocumentPages(documentId) {
  const requesterId = getRequesterId()
  const result = await request(`/documents/${documentId}/pages?requesterId=${requesterId}`)
  const pages = Array.isArray(result) ? result : (result?.data ?? [])
  return pages.map(toUiPage)
}

export async function getDocumentChunks(documentId) {
  const requesterId = getRequesterId()
  const result = await request(`/documents/${documentId}/chunks?requesterId=${requesterId}`)
  const chunks = Array.isArray(result) ? result : (result?.data ?? [])
  return chunks.map(toUiChunk)
}

export function deleteDocument(documentId) {
  const requesterId = getRequesterId()
  return request(`/documents/${documentId}?requesterId=${requesterId}`, {
    method: 'DELETE',
  })
}

export function getDocumentFileUrl(documentId) {
  const requesterId = getRequesterId()
  return `${env.apiBaseUrl}/documents/${documentId}/file?requesterId=${requesterId}`
}

export function getDocumentPreviewUrl(documentId) {
  const requesterId = getRequesterId()
  return `${env.apiBaseUrl}/documents/${documentId}/preview?requesterId=${requesterId}`
}

export async function uploadDocument({ file, workspaceId, courseId, chapterId, uploadedBy }) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('workspaceId', workspaceId)
  if (courseId) formData.append('courseId', courseId)
  if (chapterId) formData.append('chapterId', chapterId)
  if (uploadedBy) formData.append('uploadedBy', uploadedBy)

  const result = await fetch(`${env.apiBaseUrl}/documents/upload`, {
    method: 'POST',
    body: formData,
  })

  let json = null
  try {
    json = await result.json()
  } catch {
    // Ignore JSON parse errors for non-200 responses
  }

  if (!result.ok) {
    const errorMsg = json?.message ?? `Upload failed with status ${result.status}`
    const error = new Error(errorMsg)
    if (
      errorMsg.toLowerCase().includes('cloudinary') ||
      errorMsg.toLowerCase().includes('cloudinary is not configured')
    ) {
      error.code = 'CLOUDINARY_NOT_CONFIGURED'
    }
    throw error
  }

  const doc = json?.data ?? json
  return toUiDocument(doc)
}

export function toUiDocument(document, extra = {}) {
  if (!document) return null
  const status = toUiStatus(document.processingStatus)
  const hasEmbeddings = extra.hasEmbeddings ?? extra.chunks > 0

  const uploadedAt = document.uploadedAt || document.createdAt
    ? new Date(document.uploadedAt ?? document.createdAt).toLocaleDateString('en-US', {
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
    processingStatus: status,
    embeddingStatus: hasEmbeddings ? 'Prepared' : 'Not prepared',
    chunks: extra.chunks ?? 0,
    embeddingModel: hasEmbeddings ? 'keyword-hash-128' : 'Not prepared',
    uploadedAt,
    size: extra.size ?? 'Stored',
    pages: document.totalPages ?? 0,
    workspaceId: document.workspaceId,
    courseId: document.courseId,
    chapterId: document.chapterId ?? null,
    preview:
      document.errorMessage ??
      'Document processed and stored.',
  }
}

export function toUiPage(page) {
  return {
    id: page.pageId,
    documentId: page.documentId,
    pageNumber: page.pageNumber,
    content: page.cleanedText,
    wordCount: page.wordCount ?? 0,
    charCount: page.charCount ?? 0,
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
      return 'Indexed'
    case 'PROCESSED':
      return 'Processed'
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
