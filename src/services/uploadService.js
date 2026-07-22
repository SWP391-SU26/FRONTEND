import {
  deleteDocument,
  uploadDocument,
  uploadPersonalDocument,
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
  return () => listeners.delete(listener)
}

export function uploadFiles(files, metadata) {
  return Array.from(files).map((file) => startUpload(file, metadata))
}

export function uploadFile(file, metadata) {
  return startUpload(file, metadata).promise
}

export function uploadPersonalFiles(files) {
  let queue = Promise.resolve()
  return Array.from(files).map((file) => {
    const task = createPersonalUpload(file)
    const promise = queue.then(() => runPersonalUpload(task.id, file))
    queue = promise.catch(() => undefined)
    return { id: task.id, promise }
  })
}

export function uploadPersonalFile(file) {
  const task = createPersonalUpload(file)
  return runPersonalUpload(task.id, file)
}

export function deleteFile(document) {
  return trackDocumentOperation({
    action: 'DELETE',
    document,
    pendingText: 'Đang xóa tài liệu và dữ liệu liên quan...',
    completedText: 'Đã xóa tài liệu.',
    operation: () => deleteDocument(document.id ?? document.documentId),
    eventName: 'fstu:document-deleted',
  })
}

export function updateFile(document, operation, {
  pendingText = 'Đang cập nhật tài liệu...',
  completedText = 'Đã cập nhật tài liệu.',
} = {}) {
  return trackDocumentOperation({
    action: 'UPDATE',
    document,
    pendingText,
    completedText,
    operation,
    eventName: 'fstu:document-updated',
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
    action: 'UPLOAD',
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

function createPersonalUpload(file) {
  const uniqueId = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  const id = `personal-upload-${Date.now()}-${uniqueId}`
  const createdAt = Date.now()
  const task = {
    id,
    action: 'UPLOAD',
    name: file.name,
    displayName: file.name.replace(/\.[^/.]+$/, ''),
    type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
    status: 'Queued',
    stage: 'Queued',
    progress: 0,
    uploadProgress: 0,
    size: `${Math.max(0.1, file.size / 1024 / 1024).toFixed(1)} MB`,
    preview: 'Đang chờ tải lên...',
    isUploading: true,
    createdAt,
  }
  uploads = [task, ...uploads]
  notify()
  return task
}

async function runPersonalUpload(id, file) {
  try {
    updateUpload(id, {
      status: 'Uploading',
      stage: 'Uploading',
      progress: 1,
      preview: 'Đang gửi tài liệu lên hệ thống...',
    })
    const document = await uploadPersonalDocument({
      file,
      onUploadProgress: (percent) => updateUpload(id, {
        uploadProgress: percent,
        progress: clampProgress(Math.round(percent * 0.95)),
        preview: 'Đang tải tài liệu lên...',
      }),
    })
    updateUpload(id, {
      ...document,
      status: 'Completed',
      stage: 'Completed',
      progress: 100,
      preview: 'Tải tài liệu hoàn tất.',
      isUploading: false,
      completedAt: Date.now(),
    })
    window.dispatchEvent(new CustomEvent('fstu:document-uploaded', { detail: document }))
    return document
  } catch (error) {
    failUpload(id, error)
    throw error
  }
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
      onUploadProgress: (percent) => updateUpload(uploadId, {
        uploadProgress: percent,
        progress: clampProgress(Math.round(percent * 0.45)),
        preview: 'Uploading file...',
      }),
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
    }

    const completedDoc = {
      ...uploadedDoc,
      status: result.job ? 'Indexed' : uploadedDoc.status,
      embeddingStatus: result.job ? 'Prepared' : uploadedDoc.embeddingStatus,
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
    failUpload(uploadId, error)
    throw error
  }
}

function trackDocumentOperation({ action, document, pendingText, completedText, operation, eventName }) {
  const id = `${action.toLowerCase()}-${Date.now()}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
  const task = {
    id,
    action,
    documentId: document.id ?? document.documentId,
    name: document.displayName ?? document.name ?? document.originalFilename ?? 'Tài liệu',
    status: action === 'DELETE' ? 'Deleting' : 'Updating',
    stage: action === 'DELETE' ? 'Deleting' : 'Updating',
    progress: 20,
    preview: pendingText,
    indeterminate: true,
    isUploading: true,
    createdAt: Date.now(),
  }
  uploads = [task, ...uploads]
  notify()

  return Promise.resolve()
    .then(operation)
    .then((result) => {
      updateUpload(id, {
        status: 'Completed',
        stage: 'Completed',
        progress: 100,
        preview: completedText,
        indeterminate: false,
        isUploading: false,
        completedAt: Date.now(),
      })
      window.dispatchEvent(new CustomEvent(eventName, { detail: result ?? document }))
      return result
    })
    .catch((error) => {
      failUpload(id, error)
      throw error
    })
}

function failUpload(id, error) {
  updateUpload(id, {
    status: 'Failed',
    stage: 'Failed',
    progress: 100,
    preview: error.message,
    errorMessage: error.message,
    indeterminate: false,
    isUploading: false,
    completedAt: Date.now(),
  })
}

function updateUpload(id, patch) {
  uploads = uploads.map((item) => (item.id === id ? { ...item, ...patch } : item))
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
