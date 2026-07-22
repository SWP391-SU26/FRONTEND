import { request } from './httpClient.js'
import { env } from '../config/env.js'

export async function getSessions(scope) {
  const params = typeof scope === 'string' ? { courseId: scope } : scope
  const query = params?.scopeType === 'PERSONAL'
    ? 'scopeType=PERSONAL'
    : params?.semesterId
    ? `semesterId=${encodeURIComponent(params.semesterId)}`
    : `courseId=${encodeURIComponent(params?.courseId ?? '')}`
  const result = await request(`/chat/sessions?${query}`)
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

export async function askQuestion(sessionId, question, { mode = 'rag' } = {}) {
  const response = await request(`/chat/sessions/${sessionId}/ask`, {
    method: 'POST',
    body: JSON.stringify({ question, mode, answerMode: mode }),
  })
  return {
    ...response,
    generationMode: response?.generationMode ?? 'LOCAL_EXTRACTIVE',
    citations: (response?.citations ?? []).map(toUiCitation),
  }
}

export async function pinSession(sessionId, pinned) {
  return toUiSession(await request(`/chat/sessions/${sessionId}/pin`, {
    method: 'PATCH',
    body: JSON.stringify({ pinned }),
  }))
}

export async function askQuestionStream(sessionId, question, { onStage } = {}) {
  const token = localStorage.getItem('fstu_access_token')
  const response = await fetch(`${env.apiBaseUrl}/chat/sessions/${sessionId}/ask/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ question, answerMode: 'RAG' }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.message || payload?.error || `Chat stream failed with status ${response.status}`)
  }
  if (!response.body) throw new Error('Trình duyệt không nhận được luồng trả lời từ máy chủ.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let completedResponse = null

  const consumeBlock = (block) => {
    if (!block.trim()) return
    let eventName = 'message'
    const dataLines = []
    block.split(/\r?\n/).forEach((line) => {
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
    })
    if (!dataLines.length) return
    const rawData = dataLines.join('\n')
    let payload
    try { payload = JSON.parse(rawData) } catch { payload = { message: rawData } }
    const stage = payload.stage || eventName
    onStage?.({ ...payload, stage })
    if (stage === 'ERROR') throw new Error(payload.message || 'Máy chủ không thể hoàn tất câu trả lời.')
    if (stage === 'COMPLETED') completedResponse = normalizeAskResponse(payload.response)
  }

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() ?? ''
    blocks.forEach(consumeBlock)
    if (done) break
  }
  consumeBlock(buffer)

  if (!completedResponse) throw new Error('Luồng trả lời đã ngắt trước khi hoàn tất. Bạn có thể gửi lại câu hỏi.')
  return completedResponse
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
    createdAt: session.startedAt ?? session.createdAt,
    updatedAt: session.updatedAt ?? session.startedAt ?? session.createdAt,
    isPinned: Boolean(session.isPinned),
    pinnedAt: session.pinnedAt ?? null,
  }
}

function toUiMessage(message) {
  const role = String(message.senderRole ?? message.role ?? 'assistant').toLowerCase()
  return {
    id: message.messageId ?? message.id,
    role: role === 'assistant' ? 'assistant' : 'user',
    content: message.messageContent ?? message.content ?? '',
    generationMode: message.generationMode ?? message.llmModel ?? null,
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

function normalizeAskResponse(response) {
  return {
    ...response,
    generationMode: response?.generationMode ?? 'LOCAL_EXTRACTIVE',
    citations: (response?.citations ?? []).map(toUiCitation),
  }
}

function unwrapList(value) {
  return Array.isArray(value) ? value : (value?.items ?? value?.content ?? [])
}
