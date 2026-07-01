import { env } from '../config/env'

export async function request(path, options = {}) {
  const { responseType = 'auto', ...fetchOptions } = options
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const token = localStorage.getItem('fstu_access_token')
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...fetchOptions.headers,
  }

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...fetchOptions,
    headers,
  })

  if (responseType === 'blob' && response.ok) return response.blob()

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '')

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && (payload.message || payload.error || payload.detail)) ||
      (typeof payload === 'string' && payload) ||
      `Request failed with status ${response.status}`
    const error = new Error(message)
    error.status = response.status
    error.code = payload?.code ?? `HTTP_${response.status}`
    error.details = payload?.details ?? null
    error.requestId = payload?.requestId ?? response.headers.get('x-request-id') ?? null
    error.payload = payload
    if (response.status === 401) {
      localStorage.removeItem('fstu_access_token')
      localStorage.removeItem('fstu_refresh_token')
      localStorage.removeItem('fstu_user')
      window.dispatchEvent(new CustomEvent('fstu:unauthorized'))
    }
    throw error
  }

  if (payload && typeof payload === 'object' && 'success' in payload) {
    if (!payload.success) {
      const error = new Error(payload.message || 'Request failed')
      error.code = payload.code ?? 'API_REQUEST_FAILED'
      error.details = payload.details ?? null
      error.requestId = payload.requestId ?? null
      throw error
    }
    return payload.data
  }

  return payload
}

