/**
 * chatHistoryStore.js
 * Lưu trữ lịch sử hội thoại theo workspaceId vào localStorage.
 * Mỗi workspace có một danh sách các "conversation" (cuộc trò chuyện).
 * Mỗi conversation có: { id, title, createdAt, messages: [{role, content, ts}] }
 */

const STORAGE_KEY = 'fstu_chat_history_v1'
const MAX_CONVERSATIONS = 30   // tối đa 30 cuộc trò chuyện / workspace
const MAX_MESSAGES_PER_CONV = 100

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage đầy → bỏ qua
  }
}

/** Lấy tất cả conversation của một workspace, mới nhất trước. */
export function getConversations(workspaceId) {
  const data = load()
  return (data[workspaceId] ?? []).slice().sort((a, b) => b.createdAt - a.createdAt)
}

/** Tạo conversation mới và trả về id của nó. */
export function createConversation(workspaceId, title = 'New conversation') {
  const data = load()
  if (!data[workspaceId]) data[workspaceId] = []
  const conv = { id: `conv_${Date.now()}`, title, createdAt: Date.now(), messages: [] }
  data[workspaceId] = [conv, ...data[workspaceId]].slice(0, MAX_CONVERSATIONS)
  save(data)
  return conv
}

/** Thêm tin nhắn vào conversation. */
export function appendMessage(workspaceId, convId, role, content) {
  const data = load()
  const list = data[workspaceId] ?? []
  const conv = list.find((c) => c.id === convId)
  if (!conv) return
  conv.messages = [...conv.messages, { role, content, ts: Date.now() }].slice(-MAX_MESSAGES_PER_CONV)
  // Đặt tiêu đề tự động từ câu hỏi đầu tiên của user
  if (role === 'user' && conv.title === 'New conversation') {
    conv.title = content.trim().slice(0, 60) + (content.length > 60 ? '…' : '')
  }
  save(data)
}

/** Xoá một conversation. */
export function deleteConversation(workspaceId, convId) {
  const data = load()
  data[workspaceId] = (data[workspaceId] ?? []).filter((c) => c.id !== convId)
  save(data)
}

/** Xoá toàn bộ history của workspace. */
export function clearWorkspaceHistory(workspaceId) {
  const data = load()
  delete data[workspaceId]
  save(data)
}
