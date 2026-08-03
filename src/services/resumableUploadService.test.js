import { beforeEach, describe, expect, it, vi } from 'vitest'

const httpMocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('./httpClient.js', () => httpMocks)

const { request } = httpMocks

import { shouldUseResumable, uploadFileResumable } from './resumableUploadService.js'

/** A file large enough to be split into several 2 MB ranges. */
function bigFile(sizeBytes) {
  return new File([new Uint8Array(sizeBytes)], 'giaotrinh.pdf', { type: 'application/pdf' })
}

function httpError(status, message = 'failed') {
  const error = new Error(message)
  error.status = status
  return error
}

/** Server that stores ranges in memory and answers like the real controller. */
function fakeServer(totalBytes) {
  const state = { received: 0 }
  return {
    state,
    handle(path, options = {}) {
      if (path === '/uploads' && options.method === 'POST') {
        return Promise.resolve({ uploadId: 'session-1', nextOffset: 0, totalBytes })
      }
      if (path === '/uploads/session-1' && options.method === 'PUT') {
        const offset = Number(options.headers['X-Upload-Offset'])
        if (offset !== state.received) return Promise.reject(httpError(409, 'wrong offset'))
        state.received += options.body.size
        return Promise.resolve({ nextOffset: state.received, totalBytes })
      }
      if (path === '/uploads/session-1' && !options.method) {
        return Promise.resolve({ nextOffset: state.received, totalBytes })
      }
      if (path === '/uploads/session-1/complete') {
        return Promise.resolve({ documentId: 'document-1', status: 'PROCESSING' })
      }
      return Promise.reject(new Error(`unexpected call ${path}`))
    },
  }
}

describe('resumableUploadService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    request.mockReset()
  })

  it('leaves small files to the plain single-request upload', () => {
    expect(shouldUseResumable(bigFile(1024))).toBe(false)
    expect(shouldUseResumable(bigFile(6 * 1024 * 1024))).toBe(true)
  })

  it('sends a large file as ranges and reports progress from confirmed bytes', async () => {
    const size = 5 * 1024 * 1024 + 1
    const server = fakeServer(size)
    request.mockImplementation((path, options) => server.handle(path, options))
    const seen = []

    const result = await uploadFileResumable({
      file: bigFile(size),
      onUploadProgress: (percent) => seen.push(percent),
    })

    expect(result.documentId).toBe('document-1')
    expect(server.state.received).toBe(size)
    // 2 MB ranges: 0% then 40%, 80%, 100%.
    expect(seen).toEqual([0, 40, 80, 100])
  })

  it('resumes from the server offset instead of restarting after a dropped connection', async () => {
    const size = 5 * 1024 * 1024 + 1
    const server = fakeServer(size)
    const offsetsSent = []
    let dropped = false
    request.mockImplementation((path, options = {}) => {
      if (options.method === 'PUT') {
        offsetsSent.push(Number(options.headers['X-Upload-Offset']))
        if (!dropped && server.state.received > 0) {
          dropped = true
          // The range reached the server, then the socket died before the reply.
          server.state.received += options.body.size
          return Promise.reject(new TypeError('Failed to fetch'))
        }
      }
      return server.handle(path, options)
    })

    const promise = uploadFileResumable({ file: bigFile(size) })
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.documentId).toBe('document-1')
    expect(server.state.received).toBe(size)
    // The retry must not resend byte 0; it continues where the server stopped.
    expect(offsetsSent).toEqual([0, 2097152, 4194304])
  })

  it('does not retry a rejection the server will keep refusing', async () => {
    const size = 6 * 1024 * 1024
    request.mockImplementation((path, options = {}) => {
      if (path === '/uploads' && options.method === 'POST') {
        return Promise.resolve({ uploadId: 'session-1', nextOffset: 0 })
      }
      if (options.method === 'PUT') return Promise.reject(httpError(413, 'File is too large.'))
      if (options.method === 'DELETE') return Promise.resolve(null)
      return Promise.reject(new Error(`unexpected call ${path}`))
    })

    const promise = uploadFileResumable({ file: bigFile(size) })
    const rejects = expect(promise).rejects.toThrow('File is too large.')
    await vi.runAllTimersAsync()
    await rejects
    // The staged bytes are released rather than waiting for the hourly purge.
    expect(request).toHaveBeenCalledWith('/uploads/session-1', { method: 'DELETE' })
  })
})
