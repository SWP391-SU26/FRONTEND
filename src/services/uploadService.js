import { uploadDocument } from './documentService.js'

let uploads = []
const listeners = new Set()

export function getUploads() {
  return uploads
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify() {
  const currentUploads = [...uploads]
  listeners.forEach((listener) => listener(currentUploads))
}

export async function uploadFile(file, metadata) {
  const uploadId = `upload-${Date.now()}-${file.name}`
  const newUpload = {
    id: uploadId,
    name: file.name,
    displayName: file.name.replace(/\.[^/.]+$/, ''),
    type: file.name.split('.').pop()?.toUpperCase() || 'PDF',
    status: 'Processing',
    chunks: 0,
    size: `${Math.max(0.1, file.size / 1024 / 1024).toFixed(1)} MB`,
    uploadedAt: new Date().toLocaleString(),
    preview: 'Uploading file to server and preparing text extraction...',
    workspaceId: metadata.workspaceId,
    courseId: metadata.courseId,
    chapterId: metadata.chapterId,
    isUploading: true,
  }

  uploads = [newUpload, ...uploads]
  notify()

  try {
    const uploadedDoc = await uploadDocument({
      file,
      workspaceId: metadata.workspaceId,
      courseId: metadata.courseId,
      chapterId: metadata.chapterId,
      uploadedBy: metadata.uploadedBy,
    })

    // Update status once backend upload is complete
    uploads = uploads.map((item) =>
      item.id === uploadId ? { ...item, ...uploadedDoc, isUploading: false, status: 'Indexed' } : item
    )
    notify()
    return uploadedDoc
  } catch (error) {
    uploads = uploads.map((item) =>
      item.id === uploadId ? { ...item, status: 'Failed', preview: error.message, isUploading: false } : item
    )
    notify()
    throw error
  }
}

export function removeUpload(id) {
  uploads = uploads.filter((item) => item.id !== id)
  notify()
}
