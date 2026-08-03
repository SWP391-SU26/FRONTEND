import { beforeEach, describe, expect, it, vi } from 'vitest'

const documentMocks = vi.hoisted(() => ({
  deleteDocument: vi.fn(),
  uploadDocument: vi.fn(),
  uploadPersonalDocument: vi.fn(),
  waitForDocumentIndexing: vi.fn(),
  waitForIndexingJob: vi.fn(),
}))

vi.mock('./documentService.js', () => documentMocks)

import {
  clearFinishedUploads, deleteFile, getUploads, uploadFile, uploadPersonalFile,
} from './uploadService.js'

describe('uploadService', () => {
  beforeEach(() => {
    clearFinishedUploads()
  })

  it('waits for the document to be indexed before reporting upload completion', async () => {
    documentMocks.uploadDocument.mockResolvedValue({
      document: {
        id: 'document-1',
        name: 'lesson.pdf',
        status: 'Pending',
        chunks: 236,
      },
      job: null,
    })
    documentMocks.waitForDocumentIndexing.mockResolvedValue({
      id: 'document-1',
      name: 'lesson.pdf',
      status: 'Indexed',
      chunks: 236,
      embeddedChunks: 236,
    })

    const result = await uploadFile(
      new File(['pdf'], 'lesson.pdf', { type: 'application/pdf' }),
      { courseId: 'course-1' },
    )

    expect(documentMocks.waitForDocumentIndexing).toHaveBeenCalledWith(
      'document-1',
      expect.objectContaining({ onProgress: expect.any(Function) }),
    )
    expect(result.status).toBe('Indexed')
    expect(getUploads()[0]).toMatchObject({
      status: 'Indexed',
      stage: 'Completed',
      progress: 100,
    })
  })

  it('reports upload and indexing progress for a personal document', async () => {
    documentMocks.uploadPersonalDocument.mockImplementation(async ({
      onIndexingProgress,
      onUploadProgress,
    }) => {
      onUploadProgress(100)
      onIndexingProgress({
        id: 'personal-1',
        name: 'notes.pdf',
        status: 'Processing',
      })
      onIndexingProgress({
        id: 'personal-1',
        name: 'notes.pdf',
        status: 'Indexed',
      })
      return {
        id: 'personal-1',
        name: 'notes.pdf',
        status: 'Indexed',
      }
    })

    const result = await uploadPersonalFile(
      new File(['pdf'], 'notes.pdf', { type: 'application/pdf' }),
    )

    expect(result).toMatchObject({ id: 'personal-1', status: 'Indexed' })
    expect(getUploads()[0]).toMatchObject({
      documentId: 'personal-1',
      stage: 'Completed',
      progress: 100,
      previewKey: 'uploadProgress.uploadCompleted',
    })
  })

  it('shows document deletion as a file task', async () => {
    documentMocks.deleteDocument.mockResolvedValue(undefined)

    await deleteFile({ id: 'personal-1', displayName: 'notes.pdf' })

    expect(documentMocks.deleteDocument).toHaveBeenCalledWith('personal-1')
    expect(getUploads()[0]).toMatchObject({
      action: 'DELETE',
      name: 'notes.pdf',
      stage: 'Completed',
      progress: 100,
      previewKey: 'uploadProgress.documentDeleted',
    })
  })
})
