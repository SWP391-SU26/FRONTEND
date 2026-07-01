import { request } from './httpClient.js'
import { getCurrentUserId } from './authService.js'

export async function getSessions(workspaceId) {
  try {
    const result = await request(`/chat/sessions/workspace/${workspaceId}`)
    return unwrapList(result).map(toUiSession)
  } catch (error) {
    if ([404, 405].includes(error.status)) return []
    throw error
  }
}

export async function createSession(workspaceId, title = 'New conversation') {
  return toUiSession(await request('/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ userId: getCurrentUserId(), workspaceId, title }),
  }))
}

export async function getMessages(sessionId, { page = 0, size = 50 } = {}) {
  void page
  void size
  const result = await request(`/chat/sessions/${sessionId}/history`)
  const messages = unwrapList(result).map(toUiMessage)
  return Promise.all(messages.map(enrichMessageCitations))
}

export async function deleteSession(sessionId) {
  try {
    return await request(`/chat/sessions/${sessionId}`, { method: 'DELETE' })
  } catch (error) {
    if ([404, 405].includes(error.status)) {
      throw new Error('The backend does not expose a delete chat session API yet.', { cause: error })
    }
    throw error
  }
}

export async function clearWorkspaceSessions(workspaceId) {
  try {
    return await request(`/chat/sessions/workspace/${workspaceId}`, { method: 'DELETE' })
  } catch (error) {
    if ([404, 405].includes(error.status)) {
      throw new Error('The backend does not expose a clear chat history API yet.', { cause: error })
    }
    throw error
  }
}

export async function askQuestion(sessionId, question) {
  const response = await request(`/chat/sessions/${sessionId}/ask`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  })
  return {
    ...response,
    citations: (response?.citations ?? []).map(toUiCitation),
  }
}

export function saveNote(payload) {
  return request('/chat/notes', {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: payload.workspaceId,
      userId: getCurrentUserId(),
      noteTitle: payload.noteTitle,
      noteContent: payload.noteContent,
    }),
  })
}

export const getNotes = (workspaceId) => request(`/chat/notes/workspace/${workspaceId}`)

function toUiSession(session) {
  return {
    id: session.chatSessionId ?? session.sessionId ?? session.id,
    chatSessionId: session.chatSessionId ?? session.sessionId ?? session.id,
    workspaceId: session.workspaceId,
    title: session.sessionTitle ?? session.title ?? 'New conversation',
    messageCount: session.messageCount ?? 0,
    createdAt: session.startedAt ?? session.createdAt,
    updatedAt: session.updatedAt ?? session.startedAt ?? session.createdAt,
  }
}

function toUiMessage(message) {
  const role = String(message.senderRole ?? message.role ?? 'assistant').toLowerCase()
  return {
    id: message.messageId ?? message.id,
    role: role === 'assistant' ? 'assistant' : 'user',
    content: message.messageContent ?? message.content ?? '',
    citations: (message.citations ?? []).map(toUiCitation),
    createdAt: message.createdAt,
  }
}

async function enrichMessageCitations(message) {
  if (!message || message.role === 'user' || message.citations.length || !message.id) return message

  try {
    const result = await request(`/rag/citations?assistantMessageId=${encodeURIComponent(message.id)}`)
    return {
      ...message,
      citations: unwrapList(result).map(toUiCitation),
    }
  } catch (error) {
    if ([404, 405].includes(error.status)) return message
    throw error
  }
}

function toUiCitation(citation) {
  return {
    id: citation.citationId ?? citation.id ?? null,
    assistantMessageId: citation.assistantMessageId ?? null,
    documentTitle: citation.documentTitle ?? citation.filename ?? citation.source ?? '',
    pageStart: citation.pageStart ?? citation.page ?? citation.sourcePage ?? null,
    pageEnd: citation.pageEnd ?? citation.pageStart ?? citation.page ?? citation.sourcePage ?? null,
    quoteText: citation.quoteText ?? citation.excerpt ?? citation.preview ?? '',
  }
}

function unwrapList(value) {
  return Array.isArray(value) ? value : (value?.items ?? value?.content ?? [])
}
