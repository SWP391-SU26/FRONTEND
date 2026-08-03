import { request } from './httpClient.js'

/**
 * Resumable upload client.
 *
 * A single `multipart/form-data` POST has to start over from byte zero whenever
 * the connection drops, which on a flaky campus network means a 60 MB textbook
 * can fail at 95% and cost the student the whole transfer again. Here the file
 * is sent as a sequence of byte ranges: the server confirms how much it has
 * stored, so after an interruption we only send what is missing.
 *
 * Scope note: this survives network interruptions *within the page session*.
 * It cannot survive a reload, because the browser will not let us re-read a
 * `File` the user picked earlier without them picking it again.
 */

/**
 * Below this size a plain single request is faster than the extra round-trips.
 * A couple of megabytes is already tens of seconds on a weak mobile connection,
 * which is long enough for a drop to be worth recovering from.
 */
export const RESUMABLE_MIN_BYTES = 2 * 1024 * 1024

const CHUNK_BYTES = 2 * 1024 * 1024
const MAX_ATTEMPTS_PER_CHUNK = 4
const RETRY_BASE_DELAY_MS = 800

export function shouldUseResumable(file) {
  return Boolean(file) && file.size > RESUMABLE_MIN_BYTES
}

export function beginUpload({ filename, mimeType, totalBytes, workspaceId, courseId, chapterId }) {
  return request('/uploads', {
    method: 'POST',
    body: JSON.stringify({
      filename,
      mimeType: mimeType || 'application/octet-stream',
      totalBytes,
      workspaceId: workspaceId ?? null,
      courseId: courseId ?? null,
      chapterId: chapterId ?? null,
    }),
  })
}

export function getUploadStatus(uploadId) {
  return request(`/uploads/${uploadId}`)
}

export function appendChunk(uploadId, offset, blob, signal) {
  return request(`/uploads/${uploadId}`, {
    method: 'PUT',
    body: blob,
    signal,
    // The default JSON content type would make Spring try to parse the bytes.
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Upload-Offset': String(offset),
    },
  })
}

export function completeUpload(uploadId) {
  return request(`/uploads/${uploadId}/complete`, { method: 'POST' })
}

export function abortUpload(uploadId) {
  return request(`/uploads/${uploadId}`, { method: 'DELETE' })
}

/**
 * A failure worth retrying is one where sending the same bytes again could
 * plausibly succeed: the connection died, the server was momentarily busy, or
 * two writes raced. A 400/403/409-with-offset answer means our idea of the
 * offset is wrong, which we fix by re-reading the session rather than giving up.
 */
function isRetryable(error) {
  if (!error) return false
  if (error.name === 'AbortError') return false
  if (!error.status) return true // fetch threw: network/DNS/timeout
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(error.status)
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/**
 * Uploads `file` in ranges and returns the raw backend document response.
 * `onUploadProgress` receives 0-100 based on bytes the server has confirmed.
 */
export async function uploadFileResumable({
  file,
  workspaceId,
  courseId,
  chapterId,
  onUploadProgress,
  signal,
}) {
  const session = await beginUpload({
    filename: file.name,
    mimeType: file.type,
    totalBytes: file.size,
    workspaceId,
    courseId,
    chapterId,
  })
  const uploadId = session.uploadId
  let offset = session.nextOffset ?? 0
  report(onUploadProgress, offset, file.size)

  try {
    while (offset < file.size) {
      if (signal?.aborted) throw abortError()
      const end = Math.min(offset + CHUNK_BYTES, file.size)
      offset = await sendRangeWithRetry(uploadId, file, offset, end, signal)
      report(onUploadProgress, offset, file.size)
    }
    return await completeUpload(uploadId)
  } catch (error) {
    // Free the staged bytes right away instead of waiting for the hourly purge.
    abortUpload(uploadId).catch(() => {})
    throw error
  }
}

/** Sends one range, re-syncing with the server on recoverable failures. Returns the new offset. */
async function sendRangeWithRetry(uploadId, file, start, end, signal) {
  let from = start
  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_CHUNK; attempt += 1) {
    try {
      const status = await appendChunk(uploadId, from, file.slice(from, end), signal)
      return status.nextOffset
    } catch (error) {
      if (attempt === MAX_ATTEMPTS_PER_CHUNK || !isRetryable(error)) throw error
      await delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1))
      // Ask what actually landed; the failed request may still have been stored.
      const status = await getUploadStatus(uploadId).catch(() => null)
      if (status) {
        from = status.nextOffset
        if (from >= end) return from
        if (from >= file.size) return from
      }
    }
  }
  throw new Error('Could not upload this part of the file.')
}

function report(onUploadProgress, sent, total) {
  if (!onUploadProgress || total <= 0) return
  onUploadProgress(Math.min(100, Math.round((sent / total) * 100)))
}

function abortError() {
  const error = new Error('Document upload was aborted.')
  error.name = 'AbortError'
  return error
}
