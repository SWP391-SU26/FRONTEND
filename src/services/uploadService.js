import {
  deleteDocument,
  uploadDocument,
  waitForDocumentIndexing,
  waitForIndexingJob,
} from './documentService.js'

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

export function deleteFile(document) {
  const id = `delete-${Date.now()}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
  const task = { id, action: 'DELETE', name: document.displayName ?? document.name ?? document.originalFilename ?? 'Document', status: 'Deleting', stage: 'Deleting', progress: 10, preview: 'Removing document, chunks, and stored file…', isUploading: true, createdAt: Date.now() }
  uploads = [task, ...uploads]
  notify()
  return deleteDocument(document.id ?? document.documentId).then(() => {
    updateUpload(id, { status: 'Deleted', stage: 'Completed', progress: 100, preview: 'Document deleted.', isUploading: false, completedAt: Date.now() })
  }).catch((error) => {
    updateUpload(id, { status: 'Failed', stage: 'Failed', progress: 100, preview: error.message, errorMessage: error.message, isUploading: false, completedAt: Date.now() })
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
    preview: 'Waiting to upload...',
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
      preview: 'Sending file to backend...',
    })

    const result = await uploadDocument({
      file,
      workspaceId: metadata.workspaceId,
      courseId: metadata.courseId,
      chapterId: metadata.chapterId,
      onUploadProgress: (percent) => {
        updateUpload(uploadId, {
          uploadProgress: percent,
          progress: clampProgress(Math.round(percent * 0.45)),
          preview: 'Uploading file...',
        })
      },
    })

    const uploadedDoc = result.document
    updateUpload(uploadId, {
      ...uploadedDoc,
      status: result.job?.id ? 'Processing' : uploadedDoc.status,
      stage: result.job?.id ? 'Indexing' : 'Uploaded',
      progress: result.job?.id ? 50 : 100,
      uploadProgress: 100,
      preview: result.job?.id ? 'Indexing document chunks...' : 'Upload completed.',
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
            progress: clampProgress(45 + Math.round(indexingProgress * 0.55)),
            preview: `Indexing: ${formatStage(job.stage)}`,
          })
        },
      })
    } else if (
      uploadedDoc.id
      && ['Pending', 'Processing', 'Processed', 'Uploaded'].includes(uploadedDoc.status)
    ) {
      indexedDocument = await waitForDocumentIndexing(uploadedDoc.id, {
        onProgress: (document) => {
          updateUpload(uploadId, {
            ...document,
            status: document.status,
            stage: document.status === 'Indexed' ? 'Completed' : 'Indexing',
            progress: document.status === 'Indexed' ? 100 : 55,
            preview: document.status === 'Indexed'
              ? 'Upload and indexing completed.'
              : 'Creating semantic embeddings...',
          })
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
      preview: 'Upload completed.',
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
