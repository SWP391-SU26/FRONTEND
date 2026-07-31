import { env } from '../config/env.js'
import { getCurrentUserId, isAdminSession } from './authService.js'
import { request } from './httpClient.js'

export async function getDocuments() {
  const documents = unwrapList(await request(`/documents${withRequesterQuery()}`)).map(toUiDocument)
  return enrichDocumentChunkCounts(documents)
}

export async function getMyDocuments() {
  const documents = unwrapList(await request('/documents/mine')).map(toUiDocument)
  return enrichDocumentChunkCounts(documents)
}

export async function getReviewQueue() {
  return unwrapList(await request('/documents/review-queue')).map(toUiDocument)
}

export async function getDocumentsByWorkspace(workspaceId) {
  const documents = unwrapList(
    await request(`/documents/workspace/${workspaceId}${withRequesterQuery()}`),
  ).map(toUiDocument)
  return enrichDocumentChunkCounts(documents)
}

export async function getDocument(documentId) {
  return toUiDocument(await request(`/documents/${documentId}${withRequesterQuery()}`))
}

export async function getDocumentPages(documentId) {
  return unwrapList(await request(`/documents/${documentId}/pages${withRequesterQuery()}`)).map(toUiPage)
}

export async function getDocumentChunks(documentId) {
  return unwrapList(await request(`/documents/${documentId}/chunks${withRequesterQuery()}`)).map(toUiChunk)
}

export function deleteDocument(documentId) {
  return request(`/documents/${documentId}${withRequesterQuery()}`, { method: 'DELETE' })
}

export async function getDocumentFileBlob(documentId, preview = false) {
  return request(`/documents/${documentId}/${preview ? 'preview' : 'file'}${withRequesterQuery()}`, {
    responseType: 'blob',
  })
}

export function getDocumentFileUrl(document) {
  return document?.fileUrl ?? buildDocumentAssetUrl(document, 'file')
}

export function getDocumentPreviewUrl(document) {
  return document?.previewUrl ?? document?.fileUrl ?? buildDocumentAssetUrl(document, 'preview')
}

export async function uploadDocument({ file, workspaceId, courseId, chapterId, onUploadProgress }) {
  const formData = new FormData()
  formData.append('file', file)
  if (workspaceId) formData.append('workspaceId', workspaceId)
  if (courseId) formData.append('courseId', courseId)
  if (chapterId) formData.append('chapterId', chapterId)

  const result = onUploadProgress
    ? await uploadFormData('/documents/upload', formData, onUploadProgress)
    : await request('/documents/upload', {
        method: 'POST',
        body: formData,
      })
  const document = result?.document ?? result
  return {
    document: await enrichDocumentChunkCount(toUiDocument(document)),
    job: result?.indexingJob ? toUiIndexingJob(result.indexingJob) : null,
  }
}

export async function uploadPersonalDocument({ file, onUploadProgress }) {
  const formData = new FormData()
  formData.append('file', file)
  const result = onUploadProgress
    ? await uploadFormData('/documents/personal', formData, onUploadProgress)
    : await request('/documents/personal', { method: 'POST', body: formData })
  const document = await enrichDocumentChunkCount(toUiDocument(result?.document ?? result))
  if (
    document.id
    && ['Pending', 'Processing', 'Processed', 'Uploaded'].includes(document.status)
  ) {
    return waitForDocumentIndexing(document.id)
  }
  return document
}

export async function submitDocument(documentId, courseId) {
  return toUiDocument(await request(`/documents/${documentId}/submission`, {
    method: 'POST',
    body: JSON.stringify({ courseId }),
  }))
}

export async function cancelDocumentSubmission(documentId) {
  return toUiDocument(await request(`/documents/${documentId}/submission`, { method: 'DELETE' }))
}

export async function reviewDocument(documentId, status, { courseId = null, rejectionReason = '' } = {}) {
  return toUiDocument(await request(`/documents/${documentId}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ status, courseId, rejectionReason }),
  }))
}

export async function reindexDocument(documentId, embeddingModelId, workspaceId = null) {
  const result = await request('/rag/embeddings/prepare', {
    method: 'POST',
    body: JSON.stringify({ documentId, embeddingModelId, workspaceId }),
  })
  return toUiIndexingJob({
    jobId: `sync-${documentId}-${Date.now()}`,
    documentId,
    stage: 'INDEXED',
    progress: 100,
    ...result,
  })
}

export async function getIndexingJob(jobId) {
  if (String(jobId).startsWith('sync-')) {
    return toUiIndexingJob({ jobId, stage: 'INDEXED', progress: 100 })
  }
  return toUiIndexingJob(await request(`/indexing-jobs/${jobId}`))
}

export async function retryIndexingJob(jobId) {
  return toUiIndexingJob(await request(`/indexing-jobs/${jobId}/retry`, { method: 'POST' }))
}

export async function waitForIndexingJob(jobId, { onProgress, timeoutMs = 300000 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const job = await getIndexingJob(jobId)
    onProgress?.(job)
    if (job.stage === 'INDEXED') return job
    if (job.stage === 'FAILED') {
      const error = new Error(job.errorMessage || 'Document indexing failed.')
      error.code = job.errorCode || 'INDEXING_FAILED'
      throw error
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1000))
  }
  const error = new Error('Document indexing is still running. Refresh to check its status.')
  error.code = 'INDEXING_TIMEOUT'
  throw error
}

export async function waitForDocumentIndexing(
  documentId,
  { onProgress, timeoutMs = 900000, pollIntervalMs = 1500 } = {},
) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const document = await getDocument(documentId)
    onProgress?.(document)
    if (document.status === 'Indexed') {
      return enrichDocumentChunkCount(document)
    }
    if (document.status === 'Failed' || document.status === 'No text') {
      const error = new Error(
        document.indexError
          || document.errorMessage
          || (document.status === 'No text'
            ? 'Document does not contain extractable text.'
            : 'Document indexing failed.'),
      )
      error.code = document.status === 'No text' ? 'DOCUMENT_NO_TEXT' : 'INDEXING_FAILED'
      throw error
    }
    await new Promise((resolve) => window.setTimeout(resolve, pollIntervalMs))
  }
  const error = new Error(
    'The file was uploaded, but semantic indexing is still running. Refresh to check its status.',
  )
  error.code = 'INDEXING_TIMEOUT'
  throw error
}

export function toUiDocument(document) {
  if (!document) return null
  const chunkCount = toOptionalCount(document.chunkCount)
  const embeddedChunkCount = toOptionalCount(document.embeddedChunkCount)
  const status = toUiStatus(document.indexingStatus ?? document.processingStatus)
  const currentUserId = getCurrentUserId()
  const explicitPermission = document.canEdit ?? document.canDelete
  const canManage = explicitPermission !== undefined
    ? Boolean(explicitPermission)
    : Boolean(isAdminSession() || document.uploadedBy === currentUserId)
  const uploadedAtValue = document.uploadedAt ?? document.createdAt ?? null
  const uploadedAtDate = uploadedAtValue ? new Date(uploadedAtValue) : null
  const uploadedAtTimestamp = uploadedAtDate && !Number.isNaN(uploadedAtDate.getTime())
    ? uploadedAtDate.getTime()
    : 0
  const uploadedAt = uploadedAtTimestamp
    ? uploadedAtDate.toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    : 'Chưa rõ'

  return {
    id: document.documentId,
    name: document.originalFilename,
    displayName: document.documentTitle || document.originalFilename,
    type: (document.fileType ?? '').toUpperCase(),
    status,
    processingStatus: status,
    embeddingStatus: status === 'Indexed' ? 'Prepared' : status,
    chunks: chunkCount,
    embeddedChunks: embeddedChunkCount,
    embeddingModel: document.embeddingModel?.modelName ?? document.embeddingModelName ?? 'Not indexed',
    uploadedAt,
    uploadedAtIso: uploadedAtTimestamp ? uploadedAtDate.toISOString() : null,
    uploadedAtTimestamp,
    pages: document.totalPages ?? 0,
    workspaceId: document.workspaceId,
    courseId: document.courseId,
    chapterId: document.chapterId ?? null,
    uploadedBy: document.uploadedBy,
    uploaderName: document.uploaderName?.trim() || 'Không rõ người đăng',
    canEdit: canManage,
    canDelete: canManage,
    documentScope: document.documentScope ?? (document.courseId ? 'COURSE' : 'PERSONAL'),
    reviewStatus: document.reviewStatus ?? (document.courseId ? 'APPROVED' : 'NOT_SUBMITTED'),
    targetCourseId: document.targetCourseId ?? null,
    submittedAt: document.submittedAt ?? null,
    reviewedBy: document.reviewedBy ?? null,
    reviewedAt: document.reviewedAt ?? null,
    rejectionReason: document.rejectionReason ?? '',
    indexError: document.indexError ?? '',
    errorMessage: document.errorMessage ?? '',
    fileSizeBytes: Number(document.fileSizeBytes ?? 0),
    indexingJobId: document.indexingJobId ?? null,
    fileUrl: document.fileUrl ?? document.cloudinarySecureUrl ?? null,
    previewUrl: document.previewUrl ?? document.cloudinaryPreviewUrl ?? null,
    preview: document.errorMessage ?? 'Document stored in the workspace.',
  }
}

function withRequesterQuery() {
  const requesterId = getCurrentUserId()
  return requesterId ? `?requesterId=${encodeURIComponent(requesterId)}` : ''
}

function buildDocumentAssetUrl(document, kind) {
  if (!document?.documentId && !document?.id) return null
  const requesterId = getCurrentUserId()
  if (!requesterId) return null
  const documentId = document.documentId ?? document.id
  return `${env.apiBaseUrl}/documents/${documentId}/${kind}?requesterId=${encodeURIComponent(requesterId)}`
}

function uploadFormData(path, formData, onUploadProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${env.apiBaseUrl}${path}`)

    const token = localStorage.getItem('fstu_access_token')
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onUploadProgress(Math.round((event.loaded / event.total) * 100))
    }

    xhr.onload = () => {
      const contentType = xhr.getResponseHeader('content-type') ?? ''
      const payload = contentType.includes('application/json')
        ? parseJson(xhr.responseText)
        : xhr.responseText

      if (xhr.status < 200 || xhr.status >= 300) {
        const message =
          (payload && typeof payload === 'object' && (payload.message || payload.error || payload.detail)) ||
          (typeof payload === 'string' && payload) ||
          `Request failed with status ${xhr.status}`
        const error = new Error(message)
        error.status = xhr.status
        error.code = payload?.code ?? `HTTP_${xhr.status}`
        error.details = payload?.details ?? null
        error.requestId = payload?.requestId ?? xhr.getResponseHeader('x-request-id') ?? null
        error.payload = payload
        if (xhr.status === 401) {
          localStorage.removeItem('fstu_access_token')
          localStorage.removeItem('fstu_refresh_token')
          localStorage.removeItem('fstu_user')
          window.dispatchEvent(new CustomEvent('fstu:unauthorized'))
        }
        reject(error)
        return
      }

      if (payload && typeof payload === 'object' && 'success' in payload) {
        if (!payload.success) {
          const error = new Error(payload.message || 'Request failed')
          error.code = payload.code ?? 'API_REQUEST_FAILED'
          error.details = payload.details ?? null
          error.requestId = payload.requestId ?? null
          reject(error)
          return
        }
        resolve(payload.data)
        return
      }

      resolve(payload)
    }

    xhr.onerror = () => reject(new Error('Network error while uploading document.'))
    xhr.onabort = () => reject(new Error('Document upload was aborted.'))
    xhr.send(formData)
  })
}

function parseJson(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
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
    metadata: chunk.chunkStrategy ?? 'unknown',
    content: chunk.content,
  }
}

export function toUiIndexingJob(job) {
  if (!job) return null
  return {
    id: job.jobId ?? job.indexingJobId,
    documentId: job.documentId,
    stage: job.stage ?? job.status ?? 'UPLOADED',
    progress: Number(job.progress ?? 0),
    errorCode: job.errorCode ?? null,
    errorMessage: job.errorMessage ?? null,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
  }
}

function unwrapList(value) {
  return Array.isArray(value) ? value : (value?.items ?? value?.content ?? [])
}

async function enrichDocumentChunkCounts(documents) {
  return Promise.all(documents.map(enrichDocumentChunkCount))
}

async function enrichDocumentChunkCount(document) {
  if (!document || Number.isFinite(document.chunks)) return document

  try {
    const chunks = await getDocumentChunks(document.id)
    return { ...document, chunks: chunks.length }
  } catch {
    // Shared documents may be listable while the current backend still denies
    // their chunk endpoint. Keep the count unknown instead of showing a false 0.
    return document
  }
}

function toOptionalCount(value) {
  if (value === null || value === undefined || value === '') return null
  const count = Number(value)
  return Number.isFinite(count) ? count : null
}

function toUiStatus(status) {
  const normalized = String(status ?? 'UPLOADED').toUpperCase()
  if (normalized === 'INDEXED') return 'Indexed'
  if (normalized === 'FAILED') return 'Failed'
  if (normalized === 'NO_TEXT') return 'No text'
  if (normalized === 'UPLOADED') return 'Uploaded'
  if (['EXTRACTING', 'CHUNKING', 'EMBEDDING', 'PROCESSING'].includes(normalized)) return 'Processing'
  return normalized.charAt(0) + normalized.slice(1).toLowerCase()
}
