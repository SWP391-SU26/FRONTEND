import { beforeEach, describe, expect, it, vi } from 'vitest'

const documentMocks = vi.hoisted(() => ({
  deleteDocument: vi.fn(),
  uploadDocument: vi.fn(),
  waitForDocumentIndexing: vi.fn(),
  waitForIndexingJob: vi.fn(),
}))

vi.mock('./documentService.js', () => documentMocks)

import { clearFinishedUploads, getUploads, uploadFile } from './uploadService.js'

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
})
