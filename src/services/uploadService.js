import {
  deleteDocument,
  getMyDocuments,
  retryDocumentProcessing,
  uploadDocument,
  uploadPersonalDocument,
  waitForDocumentIndexing,
  waitForIndexingJob,
} from './documentService.js'

const RESUMABLE_STATUSES = new Set(['Pending', 'Processing', 'Uploaded'])

// The raw file transfer owns 0-UPLOAD_PHASE_END%; everything from there to 100%
// is the backend job's own percent (QUEUED..EXTRACTING..OCR..CHUNKING..EMBEDDING..
// COMPLETED, already 0-100 across the whole pipeline) rescaled into the remainder,
// so the bar rises continuously through every stage instead of sitting on a floor
// value until embedding starts and then jumping straight to 100.
const UPLOAD_PHASE_END = 15

function scaleIndexingPercent(percent) {
  const safePercent = Number.isFinite(percent) ? percent : 0
  return UPLOAD_PHASE_END + Math.round(safePercent * ((100 - UPLOAD_PHASE_END) / 100))
}

/**
 * Maps a polled document (optionally carrying live job progress) onto the upload
 * card. Server-side percent covers extraction → OCR → chunking → embedding, so
 * the bar advances continuously instead of jumping 45% → 100%.
 */
function indexingPatch(document) {
  const job = document.job
  const indexed = document.status === 'Indexed'
  if (indexed) {
    return {
      status: document.status,
      stage: 'Completed',
      progress: 100,
      indexingProgress: 100,
      previewKey: 'uploadProgress.uploadIndexed',
    }
  }
  if (!job) {
    return {
      status: document.status,
      stage: 'Indexing',
      progress: UPLOAD_PHASE_END,
      previewKey: 'uploadProgress.embedding',
    }
  }
  const progress = Math.min(99, Math.max(UPLOAD_PHASE_END, scaleIndexingPercent(job.percent)))
  const hasCounts = Number.isFinite(job.processedItems) && Number.isFinite(job.totalItems)
  return {
    status: document.status,
    stage: 'Indexing',
    progress,
    indexingProgress: job.percent,
    previewKey: hasCounts ? 'uploadProgress.embeddingCount' : stepPreviewKey(job.step),
    previewParams: hasCounts
      ? { done: job.processedItems, total: job.totalItems }
      : undefined,
  }
}

function stepPreviewKey(step) {
  switch (step) {
    case 'EXTRACTING': return 'uploadProgress.extracting'
    case 'OCR': return 'uploadProgress.ocr'
    case 'CHUNKING': return 'uploadProgress.chunking'
    case 'EMBEDDING': return 'uploadProgress.embedding'
    default: return 'uploadProgress.preparingDocument'
  }
}

let uploads = []
const listeners = new Set()

export function getUploads() {
  return uploads
}

export function subscribe(listener) {
  listeners.add(listener)
  listener([...uploads])
  return () => {
    listeners.delete(listener)
  }
}

export function uploadFiles(files, metadata) {
  return Array.from(files).map((file) => startUpload(file, metadata))
}

export function uploadFile(file, metadata) {
  return startUpload(file, metadata).promise
}

export function uploadPersonalFiles(files, workspaceId) {
  return Array.from(files).map((file) => startUpload(file, { scope: 'PERSONAL', workspaceId }))
}

export function uploadPersonalFile(file, workspaceId) {
  return startUpload(file, { scope: 'PERSONAL', workspaceId }).promise
}

export function deleteFile(document) {
  const id = `delete-${Date.now()}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
  const task = { id, action: 'DELETE', name: document.displayName ?? document.name ?? document.originalFilename ?? 'Document', status: 'Deleting', stage: 'Deleting', progress: 10, previewKey: 'uploadProgress.removingDocument', isUploading: true, createdAt: Date.now() }
  uploads = [task, ...uploads]
  notify()
  return deleteDocument(document.id ?? document.documentId).then(() => {
    updateUpload(id, { status: 'Deleted', stage: 'Completed', progress: 100, previewKey: 'uploadProgress.documentDeleted', isUploading: false, completedAt: Date.now() })
  }).catch((error) => {
    updateUpload(id, { status: 'Failed', stage: 'Failed', progress: 100, previewKey: '', preview: error.message, errorMessage: error.message, isUploading: false, completedAt: Date.now() })
    throw error
  })
}

export function removeUpload(id) {
  uploads = uploads.filter((item) => item.id !== id)
  notify()
}

export function clearFinishedUploads() {
  uploads = uploads.filter((item) => item.isUploading && item.status !== 'Failed' && item.progress < 100)
  notify()
}

/**
 * Re-attaches the activity popup to any document still processing on the
 * backend. Call once when the app mounts so navigating away, reloading, or
 * logging back in doesn't make an in-progress upload disappear from view —
 * the job itself keeps running server-side regardless.
 */
export function resumeActiveUploads() {
  // Resuming only needs identity and processing state. Live job polling below
  // supplies progress/counts, so fetching every document's chunks here delays
  // the whole app without improving the restored upload card.
  return getMyDocuments({ enrichChunkCounts: false })
    .then((documents) => {
      documents
        .filter((doc) => RESUMABLE_STATUSES.has(doc.status))
        .filter((doc) => !uploads.some((item) => item.documentId === doc.id))
        .forEach((doc) => trackExistingDocument(doc))
    })
    .catch(() => {
      // Best-effort: if this fails, the popup just stays empty until the next upload.
    })
}

export function retryUpload(document) {
  const documentId = document.id ?? document.documentId
  return retryDocumentProcessing(documentId).then(() => {
    uploads = uploads.filter((item) => item.documentId !== documentId)
    trackExistingDocument({ ...document, id: documentId, status: 'Processing' })
  })
}

function trackExistingDocument(document) {
  const uploadId = `resume-${document.id}-${Date.now()}`
  const newUpload = {
    id: uploadId,
    documentId: document.id,
    name: document.name ?? 'Document',
    displayName: document.displayName ?? document.name ?? 'Document',
    type: document.type || 'FILE',
    status: document.status,
    stage: 'Indexing',
    progress: UPLOAD_PHASE_END,
    uploadProgress: 100,
    indexingProgress: null,
    chunks: document.chunks ?? 0,
    previewKey: 'uploadProgress.embedding',
    isUploading: true,
    createdAt: Date.now(),
  }
  uploads = [newUpload, ...uploads]
  notify()

  waitForDocumentIndexing(document.id, {
    onProgress: (doc) => {
      updateUpload(uploadId, { ...doc, ...indexingPatch(doc) })
    },
  })
    .then((indexedDocument) => {
      const completedDoc = { ...indexedDocument, status: 'Indexed', embeddingStatus: 'Prepared' }
      updateUpload(uploadId, {
        ...completedDoc,
        isUploading: false,
        status: 'Indexed',
        stage: 'Completed',
        progress: 100,
        previewKey: 'uploadProgress.uploadCompleted',
        completedAt: Date.now(),
      })
      window.dispatchEvent(new CustomEvent('fstu:document-uploaded', { detail: completedDoc }))
    })
    .catch((error) => {
      const indexingStillRunning = error.code === 'INDEXING_TIMEOUT'
      updateUpload(uploadId, {
        status: indexingStillRunning ? 'Processing' : 'Failed',
        stage: indexingStillRunning ? 'Indexing' : 'Failed',
        progress: indexingStillRunning ? 90 : 100,
        previewKey: '',
        preview: error.message,
        isUploading: false,
        errorMessage: indexingStillRunning ? '' : error.message,
        completedAt: Date.now(),
      })
    })
}

function startUpload(file, metadata) {
  const uniqueId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  const uploadId = `upload-${Date.now()}-${uniqueId}`
  const createdAt = Date.now()
  const newUpload = {
    id: uploadId,
    name: file.name,
    displayName: file.name.replace(/\.[^/.]+$/, ''),
    type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
    status: 'Queued',
    stage: 'Queued',
    progress: 0,
    uploadProgress: 0,
    indexingProgress: null,
    chunks: 0,
    size: `${Math.max(0.1, file.size / 1024 / 1024).toFixed(1)} MB`,
    uploadedAt: new Date(createdAt).toLocaleString(),
    previewKey: 'uploadProgress.waiting',
    workspaceId: metadata.workspaceId,
    courseId: metadata.courseId,
    chapterId: metadata.chapterId,
    isUploading: true,
    createdAt,
  }

  uploads = [newUpload, ...uploads]
  notify()

  const promise = runUpload(uploadId, file, metadata)
  return { id: uploadId, promise }
}

async function runUpload(uploadId, file, metadata) {
  try {
    updateUpload(uploadId, {
      status: 'Uploading',
      stage: 'Uploading',
      progress: 1,
      previewKey: 'uploadProgress.sending',
    })

    if (metadata.scope === 'PERSONAL') {
      const personalDocument = await uploadPersonalDocument({
        file,
        workspaceId: metadata.workspaceId,
        onUploadProgress: (percent) => {
          updateUpload(uploadId, {
            uploadProgress: percent,
            progress: percent >= 100
              ? UPLOAD_PHASE_END
              : clampProgress(Math.round(percent * (UPLOAD_PHASE_END / 100))),
            stage: percent >= 100 ? 'Processing' : 'Uploading',
            previewKey: percent >= 100
              ? 'uploadProgress.preparingDocument'
              : 'uploadProgress.uploading',
          })
        },
        onIndexingProgress: (document) => {
          updateUpload(uploadId, { ...document, ...indexingPatch(document) })
        },
      })
      const completedPersonalDocument = {
        ...personalDocument,
        status: 'Indexed',
        embeddingStatus: 'Prepared',
      }
      updateUpload(uploadId, {
        ...completedPersonalDocument,
        isUploading: false,
        status: 'Indexed',
        stage: 'Completed',
        progress: 100,
        previewKey: 'uploadProgress.uploadCompleted',
        completedAt: Date.now(),
      })
      window.dispatchEvent(new CustomEvent('fstu:document-uploaded', {
        detail: completedPersonalDocument,
      }))
      return completedPersonalDocument
    }

    const result = await uploadDocument({
      file,
      workspaceId: metadata.workspaceId,
      courseId: metadata.courseId,
      chapterId: metadata.chapterId,
      onUploadProgress: (percent) => {
        updateUpload(uploadId, {
          uploadProgress: percent,
          progress: clampProgress(Math.round(percent * (UPLOAD_PHASE_END / 100))),
          previewKey: 'uploadProgress.uploading',
        })
      },
    })

    const uploadedDoc = result.document
    updateUpload(uploadId, {
      ...uploadedDoc,
      status: result.job?.id ? 'Processing' : uploadedDoc.status,
      stage: result.job?.id ? 'Indexing' : 'Uploaded',
      progress: result.job?.id ? UPLOAD_PHASE_END : 100,
      uploadProgress: 100,
      previewKey: result.job?.id
        ? 'uploadProgress.indexingChunks'
        : 'uploadProgress.uploadCompleted',
    })

    let indexedDocument = uploadedDoc
    if (result.job?.id) {
      await waitForIndexingJob(result.job.id, {
        onProgress: (job) => {
          const indexingProgress = clampProgress(job.progress)
          updateUpload(uploadId, {
            status: job.stage === 'INDEXED' ? 'Indexed' : 'Processing',
            stage: formatStage(job.stage),
            indexingProgress,
            progress: clampProgress(scaleIndexingPercent(indexingProgress)),
            previewKey: 'uploadProgress.indexingStage',
            previewParams: { stage: formatStage(job.stage) },
          })
        },
      })
    } else if (
      uploadedDoc.id
      && ['Pending', 'Processing', 'Processed', 'Uploaded'].includes(uploadedDoc.status)
    ) {
      indexedDocument = await waitForDocumentIndexing(uploadedDoc.id, {
        onProgress: (document) => {
          updateUpload(uploadId, { ...document, ...indexingPatch(document) })
        },
      })
    }

    const completedDoc = {
      ...uploadedDoc,
      ...indexedDocument,
      status: 'Indexed',
      embeddingStatus: 'Prepared',
    }

    updateUpload(uploadId, {
      ...completedDoc,
      isUploading: false,
      status: 'Indexed',
      stage: 'Completed',
      progress: 100,
      previewKey: 'uploadProgress.uploadCompleted',
      completedAt: Date.now(),
    })

    window.dispatchEvent(new CustomEvent('fstu:document-uploaded', { detail: completedDoc }))
    return completedDoc
  } catch (error) {
    const indexingStillRunning = error.code === 'INDEXING_TIMEOUT'
    updateUpload(uploadId, {
      status: indexingStillRunning ? 'Processing' : 'Failed',
      stage: indexingStillRunning ? 'Indexing' : 'Failed',
      progress: indexingStillRunning ? 90 : 100,
      previewKey: '',
      preview: error.message,
      isUploading: false,
      errorMessage: indexingStillRunning ? '' : error.message,
      completedAt: Date.now(),
    })
    throw error
  }
}

function updateUpload(id, patch) {
  uploads = uploads.map((item) => {
    if (item.id !== id) return item
    const { id: documentId, ...safePatch } = patch
    return {
      ...item,
      ...safePatch,
      id: item.id,
      documentId: documentId ?? item.documentId,
    }
  })
  notify()
}

function notify() {
  const currentUploads = [...uploads]
  listeners.forEach((listener) => listener(currentUploads))
}

function clampProgress(value) {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

function formatStage(stage) {
  const normalized = String(stage ?? '').toUpperCase()
  if (!normalized) return 'Processing'
  return normalized.charAt(0) + normalized.slice(1).toLowerCase()
}
