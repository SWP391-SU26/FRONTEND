import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./authService.js', () => ({
  getCurrentUserId: vi.fn(() => 'user-1'),
  isAdminSession: vi.fn(() => false),
}))

vi.mock('./httpClient.js', () => ({ request: vi.fn() }))

vi.mock('./resumableUploadService.js', () => ({
  shouldUseResumable: vi.fn(() => false),
  uploadFileResumable: vi.fn(),
}))

import { request } from './httpClient.js'
import { getMyDocuments } from './documentService.js'

const API_DOCUMENT = {
  documentId: 'document-1',
  originalFilename: 'notes.pdf',
  processingStatus: 'INDEXED',
  chunkCount: null,
  uploadedBy: 'user-1',
}

describe('documentService.getMyDocuments', () => {
  beforeEach(() => request.mockReset())

  it('skips per-document chunk requests when the caller only needs chat scope metadata', async () => {
    request.mockResolvedValueOnce([API_DOCUMENT])

    const documents = await getMyDocuments({ enrichChunkCounts: false })

    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('/documents/mine')
    expect(documents[0]).toMatchObject({ id: 'document-1', status: 'Indexed', chunks: null })
  })

  it('keeps chunk enrichment enabled by default for Library and existing callers', async () => {
    request
      .mockResolvedValueOnce([API_DOCUMENT])
      .mockResolvedValueOnce([{ chunkId: 'chunk-1' }, { chunkId: 'chunk-2' }])

    const documents = await getMyDocuments()

    expect(request).toHaveBeenNthCalledWith(1, '/documents/mine')
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/documents/document-1/chunks?requesterId=user-1',
    )
    expect(documents[0].chunks).toBe(2)
  })
})
