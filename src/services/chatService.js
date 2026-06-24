import { request } from './httpClient.js'

export function createOrGetSession(userId, workspaceId) {
  return request('/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ userId, workspaceId }),
  })
}

export const getHistory = (sessionId) => request(`/chat/sessions/${sessionId}/history`)

export function askQuestion(sessionId, question) {
  return request(`/chat/sessions/${sessionId}/ask`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  })
}

export function getCitations(assistantMessageId) {
  return request(`/rag/citations?assistantMessageId=${encodeURIComponent(assistantMessageId)}`)
}

export function saveNote(payload) {
  return request('/chat/notes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export const getNotes = (workspaceId) => request(`/chat/notes/workspace/${workspaceId}`)
