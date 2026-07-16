const STORAGE_KEY = 'fstu_chat_history_v2'

export function getLocalConversations(userId, workspaceId) {
  if (!userId || !workspaceId) return []
  return readStore()[scopeKey(userId, workspaceId)] ?? []
}

export function createLocalConversation({ userId, workspaceId, backendSessionId, messages = [] }) {
  const now = new Date().toISOString()
  const conversation = {
    id: globalThis.crypto?.randomUUID?.() ?? `conversation-${Date.now()}`,
    backendSessionId,
    workspaceId,
    title: deriveTitle(messages),
    messages,
    messageCount: messages.length,
    createdAt: now,
    updatedAt: now,
  }
  saveLocalConversation(userId, workspaceId, conversation)
  return conversation
}

export function saveLocalConversation(userId, workspaceId, conversation) {
  if (!userId || !workspaceId || !conversation?.id) return []
  const store = readStore()
  const key = scopeKey(userId, workspaceId)
  const current = store[key] ?? []
  const normalized = {
    ...conversation,
    title: !conversation.title || conversation.title === 'New conversation'
      ? deriveTitle(conversation.messages)
      : conversation.title,
    messageCount: conversation.messages?.length ?? 0,
    updatedAt: conversation.updatedAt ?? new Date().toISOString(),
  }
  store[key] = [normalized, ...current.filter((item) => item.id !== normalized.id)]
  writeStore(store)
  return store[key]
}

export function removeLocalConversation(userId, workspaceId, conversationId) {
  const store = readStore()
  const key = scopeKey(userId, workspaceId)
  store[key] = (store[key] ?? []).filter((item) => item.id !== conversationId)
  writeStore(store)
  return store[key]
}

export function clearLocalConversations(userId, workspaceId) {
  const store = readStore()
  delete store[scopeKey(userId, workspaceId)]
  writeStore(store)
}

function deriveTitle(messages = []) {
  const firstQuestion = messages.find((message) => message.role === 'user')?.content?.trim()
  if (!firstQuestion) return 'New conversation'
  return firstQuestion.length > 54 ? `${firstQuestion.slice(0, 54)}...` : firstQuestion
}

function scopeKey(userId, workspaceId) {
  return `${userId}:${workspaceId}`
}

function readStore() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch {
    return {}
  }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}
