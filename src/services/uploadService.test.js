import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./documentService.js', () => ({
  deleteDocument: vi.fn(),
  uploadDocument: vi.fn(),
  uploadPersonalDocument: vi.fn(),
  waitForIndexingJob: vi.fn(),
}))

import { deleteDocument, uploadPersonalDocument } from './documentService.js'
import {
  clearFinishedUploads,
  deleteFile,
  getUploads,
  updateFile,
  uploadPersonalFiles,
} from './uploadService.js'

describe('document operation progress tasks', () => {
  beforeEach(() => {
    clearFinishedUploads()
    vi.clearAllMocks()
  })

  it('queues personal uploads and marks each file as completed', async () => {
    uploadPersonalDocument.mockImplementation(async ({ file, onUploadProgress }) => {
      onUploadProgress(50)
      onUploadProgress(100)
      return { id: `doc-${file.name}`, displayName: file.name, status: 'Processed' }
    })

    const tasks = uploadPersonalFiles([
      new File(['one'], 'one.pdf', { type: 'application/pdf' }),
      new File(['two'], 'two.pdf', { type: 'application/pdf' }),
    ])

    expect(getUploads().filter((task) => task.action === 'UPLOAD')).toHaveLength(2)
    await Promise.all(tasks.map((task) => task.promise))

    const completed = getUploads().filter((task) => task.action === 'UPLOAD')
    expect(completed.every((task) => task.stage === 'Completed' && task.progress === 100)).toBe(true)
  })

  it('tracks document updates until the request completes', async () => {
    const result = await updateFile(
      { id: 'doc-1', displayName: 'Lecture.pdf' },
      () => Promise.resolve({ id: 'doc-1', reviewStatus: 'PENDING' }),
      { pendingText: 'Đang cập nhật...', completedText: 'Đã cập nhật.' },
    )

    expect(result.reviewStatus).toBe('PENDING')
    expect(getUploads()[0]).toMatchObject({
      action: 'UPDATE',
      stage: 'Completed',
      progress: 100,
      preview: 'Đã cập nhật.',
    })
  })

  it('tracks document deletion and calls the backend service', async () => {
    deleteDocument.mockResolvedValue(undefined)

    await deleteFile({ id: 'doc-2', displayName: 'Delete.pdf' })

    expect(deleteDocument).toHaveBeenCalledWith('doc-2')
    expect(getUploads()[0]).toMatchObject({
      action: 'DELETE',
      stage: 'Completed',
      progress: 100,
    })
  })
})
