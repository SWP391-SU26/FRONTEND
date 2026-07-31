import { request } from './httpClient.js'
import { env } from '../config/env.js'

export async function getSessions(scope = {}, searchQuery = '') {
  const params = typeof scope === 'string' ? { courseId: scope } : scope
  const query = new URLSearchParams()
  if (params?.scopeType === 'PERSONAL') query.set('scopeType', 'PERSONAL')
  else if (params?.semesterId) query.set('semesterId', params.semesterId)
  else if (params?.courseId) query.set('courseId', params.courseId)
  if (searchQuery.trim()) query.set('query', searchQuery.trim())
  const result = await request(`/chat/sessions${query.size ? `?${query}` : ''}`)
  return unwrapList(result).map(toUiSession)
}

export async function createSession(scope, title = 'New conversation') {
  const payload = typeof scope === 'string' ? { courseId: scope } : scope
  return toUiSession(await request('/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ ...payload, title }),
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
  return request(`/chat/sessions/${sessionId}`, { method: 'DELETE' })
}

export async function renameSession(sessionId, title) {
  return toUiSession(await request(`/chat/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  }))
}

export async function pinSession(sessionId, pinned) {
  return toUiSession(await request(`/chat/sessions/${sessionId}/pin`, {
    method: 'PATCH',
    body: JSON.stringify({ pinned }),
  }))
}

export async function askQuestion(sessionId, question, { mode = 'rag', signal } = {}) {
  const response = await request(`/chat/sessions/${sessionId}/ask`, {
    method: 'POST',
    body: JSON.stringify({ question, mode, answerMode: mode }),
    signal,
  })
  return {
    ...response,
    generationMode: response?.generationMode ?? 'LOCAL_EXTRACTIVE',
    citations: (response?.citations ?? []).map(toUiCitation),
  }
}

export async function streamQuestion(sessionId, question, { mode = 'rag', signal, onEvent } = {}) {
  const token = localStorage.getItem('fstu_access_token')
  const response = await fetch(`${env.apiBaseUrl}/chat/sessions/${sessionId}/ask/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ question, mode, answerMode: mode }),
    signal,
  })

  if (!response.ok || !response.body) {
    const message = await readStreamError(response)
    throw new Error(message || `AI stream failed with status ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let completed = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() ?? ''

    for (const block of blocks) {
      const parsed = parseSseBlock(block)
      if (!parsed.type) continue
      onEvent?.(parsed)
      if (parsed.type === 'ERROR') {
        throw toStreamError(parsed.data)
      }
      if (parsed.type === 'COMPLETED') {
        completed = parsed.data
      }
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseBlock(buffer)
    if (parsed.type) {
      onEvent?.(parsed)
      if (parsed.type === 'ERROR') throw toStreamError(parsed.data)
      if (parsed.type === 'COMPLETED') completed = parsed.data
    }
  }

  if (!completed) throw new Error('AI stream ended before completion.')
  return {
    ...completed,
    generationMode: completed?.generationMode ?? 'LOCAL_EXTRACTIVE',
    citations: (completed?.citations ?? []).map(toUiCitation),
  }
}

export function saveNote(payload) {
  return request('/chat/notes', {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: payload.workspaceId,
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
    semesterId: session.semesterId ?? null,
    courseId: session.courseId ?? null,
    scopeType: session.scopeType ?? 'COURSE',
    documentIds: session.documentIds ?? [],
    scopeLabel: session.scopeLabel ?? '',
    title: session.sessionTitle ?? session.title ?? 'New conversation',
    messageCount: session.messageCount ?? 0,
    isPinned: Boolean(session.isPinned),
    pinnedAt: session.pinnedAt ?? null,
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
    generationMode: message.generationMode ?? message.llmModel ?? null,
    latencyMs: message.latencyMs ?? null,
    answerDepth: message.answerDepth ?? null,
    questionIntent: message.questionIntent ?? null,
    processingTrace: Array.isArray(message.processingTrace)
      ? message.processingTrace
      : parseProcessingTrace(message.processingTraceJson),
    citations: (message.citations ?? []).map(toUiCitation),
    createdAt: message.createdAt,
  }
}

function parseProcessingTrace(value) {
  if (!value || typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
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

function parseSseBlock(block) {
  let type = ''
  const dataLines = []
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('event:')) type = line.slice(6).trim()
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }
  const rawData = dataLines.join('\n')
  let data = {}
  if (rawData) {
    try {
      data = JSON.parse(rawData)
    } catch {
      data = { text: rawData }
    }
  }
  return { type, data }
}

function toStreamError(data = {}) {
  const error = new Error(data.message || 'AI stream failed.')
  error.code = data.code
  error.elapsedMs = data.elapsedMs
  error.retryable = Boolean(data.retryable)
  return error
}

async function readStreamError(response) {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => null)
    return payload?.message || payload?.error || payload?.detail
  }
  return response.text().catch(() => '')
}
