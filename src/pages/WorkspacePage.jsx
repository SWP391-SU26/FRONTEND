import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Bot,
  BookOpenCheck,
  Check,
  Clipboard,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  NotebookPen,
  Plus,
  RefreshCcw,
  Save,
  Send,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, IconButton, Panel, StatusBadge } from '../components/ui.jsx'
import { getSavedUser } from '../services/authService.js'
import {
  clearLocalConversations,
  createLocalConversation,
  getLocalConversations,
  removeLocalConversation,
  saveLocalConversation,
} from '../services/chatHistoryStore.js'
import {
  askQuestion,
  createSession,
  getMessages,
  getNotes,
  saveNote,
} from '../services/chatService.js'
import { getWorkspaces } from '../services/courseService.js'
import { getDocumentsByWorkspace } from '../services/documentService.js'
import { cn } from '../utils/cn.js'

const suggestions = [
  'Tóm tắt các ý chính trong workspace này',
  'Giải thích khái niệm quan trọng nhất và kèm nguồn',
  'Tạo 5 câu hỏi ôn tập từ tài liệu',
]

function WorkspacePage() {
  const user = getSavedUser()
  const [workspaces, setWorkspaces] = useState([])
  const [activeWorkspace, setActiveWorkspace] = useState('')
  const [documents, setDocuments] = useState([])
  const [session, setSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [notes, setNotes] = useState([])
  const [input, setInput] = useState('')
  const [activeCitation, setActiveCitation] = useState(null)
  const [loading, setLoading] = useState(Boolean(user?.id))
  const [isAnswering, setIsAnswering] = useState(false)
  const [error, setError] = useState(user?.id ? '' : 'Sign in with a backend account before opening a chat workspace.')
  const [copiedId, setCopiedId] = useState('')
  const [noteDraft, setNoteDraft] = useState(null)
  const [savingNote, setSavingNote] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // ─── History panel state ────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false)
  const [conversations, setConversations] = useState([])
  const [activeConvId, setActiveConvId] = useState(null)
  const [clearConfirm, setClearConfirm] = useState(false)
  const messagesEndRef = useRef(null)

  // ─── Load workspaces ────────────────────────────────────────────
  useEffect(() => {
    let active = true
    if (!user?.id) return undefined
    getWorkspaces()
      .then((items) => {
        if (!active) return
        setWorkspaces(items)
        setActiveWorkspace((current) => current || items[0]?.id || '')
        if (!items.length) setLoading(false)
      })
      .catch((err) => {
        if (active) { setError(err.message); setLoading(false) }
      })
    return () => { active = false }
  }, [user?.id])

  // ─── Load workspace data + session + backend history ───────────
  useEffect(() => {
    if (!activeWorkspace || !user?.id) return undefined
    let active = true

    Promise.all([
      getDocumentsByWorkspace(activeWorkspace),
      getNotes(activeWorkspace),
      createSession(activeWorkspace),
    ])
      .then(async ([nextDocuments, nextNotes, nextSession]) => {
        const history = await getMessages(nextSession.id)
        if (!active) return
        let localConversations = getLocalConversations(user.id, activeWorkspace)
        if (!localConversations.length) {
          const initialConversation = createLocalConversation({
            userId: user.id,
            workspaceId: activeWorkspace,
            backendSessionId: nextSession.id,
            messages: history,
          })
          localConversations = [initialConversation]
        }
        const activeConversation = localConversations[0]
        setDocuments(nextDocuments)
        setNotes(nextNotes)
        setSession(nextSession)
        setConversations(localConversations)
        setActiveConvId(activeConversation.id)
        setMessages(activeConversation.messages ?? [])
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))

    return () => { active = false }
  }, [activeWorkspace, reloadKey, user?.id])

  // ─── Load local history when workspace changes ──────────────────
  // ─── Scroll to bottom on new messages ──────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const activeWorkspaceData = workspaces.find((item) => item.id === activeWorkspace)
  const indexedDocuments = useMemo(
    () => documents.filter((document) => ['Indexed', 'Processed'].includes(document.status)),
    [documents],
  )
  const canChat = Boolean(session && indexedDocuments.length && !isAnswering)

  // ─── Messages to display: either live session or a historical conversation ──
  const displayMessages = messages

  // ─── Submit question ───────────────────────────────────────────
  async function handleSubmit(event) {
    event.preventDefault()
    const question = input.trim()
    if (!question || !session) return
    if (!indexedDocuments.length) {
      setError('This workspace has no processed document available for RAG.')
      return
    }

    const optimisticId = `pending-${globalThis.crypto.randomUUID()}`
    setInput('')
    setError('')
    setIsAnswering(true)
    const optimisticMessages = [...messages, { id: optimisticId, role: 'user', content: question }]
    setMessages(optimisticMessages)
    persistConversationMessages(activeConvId, optimisticMessages)
    try {
      const response = await askQuestion(session.chatSessionId, question)
      const answer = {
        id: response.assistantMessageId,
        role: 'assistant',
        content: response.answer,
        citations: response.citations ?? [],
      }
      const completedMessages = [...optimisticMessages, answer]
      setMessages(completedMessages)
      setActiveCitation(answer.citations[0] ?? null)
      persistConversationMessages(activeConvId, completedMessages)
    } catch (requestError) {
      setMessages(messages)
      persistConversationMessages(activeConvId, messages)
      setInput(question)
      setError(`${requestError.message} Your question is ready to retry.`)
    } finally {
      setIsAnswering(false)
    }
  }

  function copyAnswer(message) {
    navigator.clipboard?.writeText(message.content)
    setCopiedId(message.id)
    window.setTimeout(() => setCopiedId(''), 1200)
  }

  function openNote(message) {
    setNoteDraft({
      title: `Chat note - ${activeWorkspaceData?.name || 'Workspace'}`,
      content: message.content,
    })
  }

  async function handleSaveNote(event) {
    event.preventDefault()
    setSavingNote(true)
    setError('')
    try {
      const created = await saveNote({
        workspaceId: activeWorkspace,
        noteTitle: noteDraft.title.trim(),
        noteContent: noteDraft.content.trim(),
      })
      setNotes((current) => [created, ...current])
      setNoteDraft(null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSavingNote(false)
    }
  }

  async function handleDeleteConversation(convId) {
    const updated = removeLocalConversation(user.id, activeWorkspace, convId)
    setConversations(updated)
    if (activeConvId === convId) {
      if (updated.length) {
        setActiveConvId(updated[0].id)
        setMessages(updated[0].messages ?? [])
      } else {
        handleNewChat()
      }
    }
  }

  function handleClearHistory() {
    clearLocalConversations(user.id, activeWorkspace)
    setConversations([])
    setClearConfirm(false)
    handleNewChat()
  }

  function handleSelectConversation(convId) {
    const selected = conversations.find((item) => item.id === convId)
    if (!selected) {
      setHistoryOpen(false)
      return
    }
    setActiveConvId(selected.id)
    setMessages(selected.messages ?? [])
    setActiveCitation(null)
    setHistoryOpen(false)
  }

  function handleNewChat() {
    if (!activeWorkspace || !session) return
    setError('')
    const created = createLocalConversation({
      userId: user.id,
      workspaceId: activeWorkspace,
      backendSessionId: session.chatSessionId,
    })
    setConversations(getLocalConversations(user.id, activeWorkspace))
    setActiveConvId(created.id)
    setMessages([])
    setInput('')
    setActiveCitation(null)
  }

  function persistConversationMessages(conversationId, nextMessages) {
    if (!conversationId) return
    const current = conversations.find((item) => item.id === conversationId)
    if (!current) return
    const updated = {
      ...current,
      messages: nextMessages,
      updatedAt: new Date().toISOString(),
    }
    const nextConversations = saveLocalConversation(user.id, activeWorkspace, updated)
    setConversations(nextConversations)
  }

  return (
    <div className="workspace-fixed-page flex min-h-0 flex-col gap-4">
      <Panel className="workspace-hero-panel shrink-0 overflow-hidden p-5">
        <div className="pointer-events-none absolute inset-0 opacity-55"><div className="abstract-canvas" /></div>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-teal-700">Source-grounded study</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">AI Chat Workspace</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              Ask questions from processed course documents and keep useful answers as learning notes.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setHistoryOpen(true)} variant="secondary">
              <Clock size={16} /> Lịch sử
              {conversations.length > 0 && (
                <span className="ml-1 rounded-full bg-teal-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                  {conversations.length}
                </span>
              )}
            </Button>
            <Button
              onClick={() => { setLoading(true); setError(''); setActiveCitation(null); setReloadKey((value) => value + 1) }}
              variant="secondary"
            >
              <RefreshCcw size={16} />Refresh
            </Button>
          </div>
        </div>
      </Panel>

      {error ? <ErrorBanner message={error} /> : null}

      <div className="workspace-chat-grid grid min-h-0 flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/* Left panel: workspaces + documents */}
        <Panel className="min-h-0 overflow-y-auto p-4 [scrollbar-color:theme(colors.teal.300)_transparent] [scrollbar-width:thin]">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black">Workspaces</h2>
            <BookOpenCheck className="text-primary" size={18} />
          </div>
          <div className="mt-4 space-y-2">
            {workspaces.map((workspace) => (
              <button
                className={cn(
                  'w-full rounded-lg border p-3 text-left transition',
                  workspace.id === activeWorkspace
                    ? 'border-teal-300 bg-teal-50'
                    : 'border-slate-200 bg-white/80 hover:border-teal-200',
                )}
                key={workspace.id}
                onClick={() => { setLoading(true); setError(''); setActiveCitation(null); setActiveWorkspace(workspace.id) }}
                type="button"
              >
                <p className="truncate text-sm font-black">{workspace.name}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{workspace.visibility}</p>
              </button>
            ))}
            {!workspaces.length && !loading ? <p className="text-sm font-semibold text-slate-500">No workspace is available.</p> : null}
          </div>

          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="text-xs font-black uppercase text-slate-500">Documents</p>
            <div className="mt-3 space-y-2">
              {documents.map((document, index) => (
                <div className="rounded-lg bg-white/80 p-3" key={document.id || `doc-${index}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-xs font-black">{document.displayName}</p>
                    <StatusBadge status={document.status} />
                  </div>
                </div>
              ))}
              {!documents.length && !loading ? <p className="text-xs font-semibold text-slate-500">No documents in this workspace.</p> : null}
            </div>
          </div>
        </Panel>

        {/* Center panel: chat */}
        <Panel className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <div>
              <p className="text-xs font-black uppercase text-slate-500">Active session</p>
              <h2 className="mt-1 text-base font-black">
                {conversations.find((item) => item.id === activeConvId)?.title || activeWorkspaceData?.name || 'Select a workspace'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-black text-teal-700 transition hover:bg-teal-100"
                onClick={handleNewChat}
                type="button"
              >
                <Plus size={13} /> New chat
              </button>
              {session ? (
                <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">Connected</span>
              ) : null}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto scroll-smooth p-4 pb-6 [scrollbar-color:theme(colors.teal.300)_transparent] [scrollbar-width:thin]">
            {loading ? <LoadingSpinner /> : displayMessages.length ? displayMessages.map((message, index) => (
              <Message
                copied={copiedId === message.id}
                key={message.id || `msg-${index}`}
                message={message}
                onCitation={setActiveCitation}
                onCopy={() => copyAnswer(message)}
                onSaveNote={() => openNote(message)}
              />
            )) : (
              <div className="grid min-h-72 place-items-center text-center">
                <div>
                  <div className="mx-auto grid size-12 place-items-center rounded-xl bg-teal-50 text-primary"><Bot size={22} /></div>
                  <h3 className="mt-4 text-lg font-black">Start a grounded conversation</h3>
                  <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
                    Choose a prompt or ask a question about processed documents in this workspace.
                  </p>
                </div>
              </div>
            )}
            {isAnswering ? (
              <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                <Loader2 className="animate-spin text-primary" size={17} />Đang tạo câu trả lời dựa trên tài liệu...
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 bg-white/70 p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-bold text-slate-600 hover:border-teal-300"
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  type="button"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={handleSubmit}>
              <textarea
                aria-label="Question"
                className="min-h-12 flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100 disabled:opacity-50"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
                placeholder={
                  indexedDocuments.length
                    ? 'Hỏi bằng tiếng Việt từ các tài liệu đã index...'
                    : 'Workspace này cần ít nhất một tài liệu đã index'
                }
                value={input}
              />
              <Button
                aria-label="Send question"
                disabled={!canChat || !input.trim()}
                size="icon"
                type="submit"
              >
                <Send size={17} />
              </Button>
            </form>
          </div>
        </Panel>

        {/* Right panel: citations + notes */}
        <Panel className="min-h-0 overflow-y-auto p-4 [scrollbar-color:theme(colors.teal.300)_transparent] [scrollbar-width:thin]">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black">Citation</h2>
            <FileText className="text-primary" size={18} />
          </div>
          {activeCitation ? (
            <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-4">
              <p className="text-sm font-black text-slate-950">{activeCitation.documentTitle || 'Source document'}</p>
              <p className="mt-1 text-xs font-black text-teal-700">{pageLabel(activeCitation)}</p>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{activeCitation.quoteText || 'No source preview returned.'}</p>
            </div>
          ) : <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">Select a citation from an answer.</p>}

          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
            <h2 className="text-base font-black">Learning notes</h2>
            <NotebookPen className="text-primary" size={18} />
          </div>
          <div className="mt-3 space-y-2">
            {notes.map((note, index) => (
              <div className="rounded-lg border border-slate-200 bg-white/80 p-3" key={note.noteId || `note-${index}`}>
                <p className="text-sm font-black">{note.noteTitle}</p>
                <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-slate-500">{note.noteContent}</p>
              </div>
            ))}
            {!notes.length && !loading ? <p className="text-sm font-semibold text-slate-500">No notes saved in this workspace.</p> : null}
          </div>
        </Panel>
      </div>

      {/* ─── History Drawer ─────────────────────────────────────────── */}
      <AnimatePresence>
        {historyOpen && (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setHistoryOpen(false)} />

            {/* Drawer */}
            <motion.aside
              animate={{ x: 0 }}
              className="relative ml-auto flex h-full w-full max-w-sm flex-col bg-white shadow-2xl"
              exit={{ x: '100%' }}
              initial={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <div className="grid size-8 place-items-center rounded-lg bg-teal-50 text-teal-600">
                    <Clock size={16} />
                  </div>
                  <div>
                    <h2 className="text-base font-black">Lịch sử hội thoại</h2>
                    <p className="text-xs font-semibold text-slate-500">
                      {activeWorkspaceData?.name || 'Workspace'} · {conversations.length} cuộc
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-black text-teal-700 transition hover:bg-teal-100"
                    onClick={() => { handleNewChat(); setHistoryOpen(false) }}
                    type="button"
                  >
                    <Plus size={13} /> Mới
                  </button>
                  <button
                    aria-label="Close"
                    className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                    onClick={() => setHistoryOpen(false)}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Conversation list */}
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <div className="grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-400">
                      <MessageSquare size={22} />
                    </div>
                    <p className="text-sm font-black text-slate-500">Chưa có lịch sử</p>
                    <p className="max-w-[200px] text-xs font-semibold text-slate-400">
                      Các cuộc trò chuyện sẽ được lưu tự động tại đây.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {conversations.map((conv) => (
                      <li
                        key={conv.id}
                        className={cn(
                          'group flex cursor-pointer items-start gap-3 p-4 transition hover:bg-slate-50',
                          activeConvId === conv.id && 'bg-teal-50',
                        )}
                        onClick={() => handleSelectConversation(conv.id)}
                      >
                        <div className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg', activeConvId === conv.id ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-400')}>
                          <MessageSquare size={13} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn('truncate text-sm font-black', activeConvId === conv.id ? 'text-teal-700' : 'text-slate-800')}>
                            {conv.title}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-400">
                            {conv.messageCount} messages · {formatRelativeTime(conv.updatedAt)}
                          </p>
                        </div>
                        <button
                          aria-label="Xoá"
                          className="ml-auto grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500 sm:invisible sm:group-hover:visible"
                          onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id) }}
                          type="button"
                        >
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Footer: clear all */}
              {conversations.length > 0 && (
                <div className="border-t border-slate-200 p-4">
                  {clearConfirm ? (
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="mb-2 text-xs font-black text-red-700">Xoá toàn bộ lịch sử của workspace này?</p>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-black text-white transition hover:bg-red-700"
                          onClick={handleClearHistory}
                          type="button"
                        >
                          Xoá tất cả
                        </button>
                        <button
                          className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                          onClick={() => setClearConfirm(false)}
                          type="button"
                        >
                          Huỷ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 py-2 text-xs font-black text-red-500 transition hover:bg-red-50"
                      onClick={() => setClearConfirm(true)}
                      type="button"
                    >
                      <Trash2 size={13} /> Xoá toàn bộ lịch sử
                    </button>
                  )}
                </div>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <NoteDialog
        draft={noteDraft}
        onChange={setNoteDraft}
        onClose={() => setNoteDraft(null)}
        onSubmit={handleSaveNote}
        saving={savingNote}
      />
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Message({ copied, message, onCitation, onCopy, onSaveNote }) {
  const isUser = message.role === 'user'
  const parsedAnswer = parseAssistantAnswer(message.content, message.citations)
  const isRefusal = !isUser && isRefusalAnswer(message.content)
  return (
    <motion.article
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
      initial={{ opacity: 0, y: 10 }}
    >
      {!isUser ? <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-white"><Bot size={17} /></div> : null}
      <div className={cn('max-w-[82%] rounded-lg p-4', isUser ? 'bg-slate-900 text-white' : isRefusal ? 'border border-amber-200 bg-amber-50/70' : 'border border-slate-200 bg-white', message.isHistory && 'opacity-80')}>
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm font-semibold leading-6">{message.content}</p>
        ) : (
          <AssistantAnswer parsedAnswer={parsedAnswer} refusal={isRefusal} />
        )}
        {message.citations?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.citations.map((citation, index) => (
              <button
                className="rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-black text-teal-700"
                key={citation.id || `${citation.documentTitle}-${citation.pageStart}-${index}`}
                onClick={() => onCitation(citation)}
                type="button"
              >
                {citation.documentTitle || `Nguồn ${index + 1}`} / {pageLabel(citation)}
              </button>
            ))}
          </div>
        ) : null}
        {!isUser && parsedAnswer.inlineSources.length ? (
          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Nguồn trong câu trả lời</p>
            <div className="flex flex-wrap gap-2">
              {parsedAnswer.inlineSources.map((source) => (
                <span
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-600"
                  key={source}
                >
                  {source}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {!isUser && !message.isHistory ? (
          <div className="mt-3 flex gap-1 border-t border-slate-100 pt-2">
            <IconButton label="Copy answer" onClick={onCopy}>{copied ? <Check size={15} /> : <Clipboard size={15} />}</IconButton>
            <IconButton label="Save as note" onClick={onSaveNote}><Save size={15} /></IconButton>
          </div>
        ) : null}
      </div>
      {isUser ? <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-primary"><UserRound size={17} /></div> : null}
    </motion.article>
  )
}

function AssistantAnswer({ parsedAnswer, refusal }) {
  const paragraphs = splitAnswerParagraphs(parsedAnswer.body)

  if (refusal) {
    return (
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={17} />
        <div>
          <p className="text-sm font-black text-amber-900">Chưa tìm thấy bằng chứng trong tài liệu</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-amber-800">
            {parsedAnswer.body}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 text-sm font-semibold leading-7 text-slate-900">
      {paragraphs.map((paragraph, index) => (
        <p key={`${paragraph}-${index}`}>{paragraph}</p>
      ))}
    </div>
  )
}

function parseAssistantAnswer(content, citations = []) {
  const raw = String(content ?? '').trim()
  const sourceMatch = raw.match(/\n?\s*Nguồn:\s*/i)
  if (!sourceMatch) return { body: raw, inlineSources: [] }

  const body = raw.slice(0, sourceMatch.index).trim()
  const sourceText = raw.slice(sourceMatch.index + sourceMatch[0].length).trim()
  const inlineSources = sourceText
    .split(/;\s*|\]\s*,\s*\[/)
    .map((item) => item.replace(/^\[/, '').replace(/\]$/, '').trim())
    .filter(Boolean)

  if (citations?.length) return { body, inlineSources: [] }
  return { body, inlineSources }
}

function splitAnswerParagraphs(content) {
  const text = String(content ?? '').trim()
  if (!text) return ['Không có nội dung trả lời.']

  const explicitParagraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean)
  if (explicitParagraphs.length > 1) return explicitParagraphs

  return text
    .replace(/\s+-\s+/g, '\n- ')
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function isRefusalAnswer(content) {
  const normalized = String(content ?? '').toLowerCase()
  return normalized.includes('không tìm thấy nội dung liên quan') ||
    normalized.includes('không tìm thấy bằng chứng') ||
    normalized.includes('outside the scope') ||
    normalized.includes('out of scope')
}

function NoteDialog({ draft, onChange, onClose, onSubmit, saving }) {
  if (!draft) return null
  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
      >
        <motion.form animate={{ y: 0 }} className="os-panel w-full max-w-lg p-5 shadow-2xl" initial={{ y: 20 }} onSubmit={onSubmit}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Save learning note</h2>
            <button aria-label="Close" className="grid size-9 place-items-center rounded-lg hover:bg-slate-100" onClick={onClose} type="button"><X size={17} /></button>
          </div>
          <label className="mt-5 block text-sm font-black">
            Title
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-semibold outline-none focus:border-teal-400" onChange={(e) => onChange({ ...draft, title: e.target.value })} required value={draft.title} />
          </label>
          <label className="mt-3 block text-sm font-black">
            Content
            <textarea className="mt-1 min-h-48 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-semibold leading-6 outline-none focus:border-teal-400" onChange={(e) => onChange({ ...draft, content: e.target.value })} required value={draft.content} />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
            <Button disabled={saving} type="submit">{saving ? <Loader2 className="animate-spin" size={16} /> : <NotebookPen size={16} />}Save note</Button>
          </div>
        </motion.form>
      </motion.div>
    </AnimatePresence>
  )
}

function pageLabel(citation) {
  if (!citation.pageStart) return 'Chưa có trang'
  return citation.pageEnd && citation.pageEnd !== citation.pageStart
    ? `Trang ${citation.pageStart}-${citation.pageEnd}`
    : `Trang ${citation.pageStart}`
}

function formatRelativeTime(ts) {
  const value = typeof ts === 'number' ? ts : new Date(ts).getTime()
  if (!Number.isFinite(value)) return 'recently'
  const diff = Date.now() - value
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  return new Date(value).toLocaleDateString('vi-VN')
}

function LoadingSpinner() {
  return (
    <div className="flex min-h-72 items-center justify-center gap-3 text-sm font-black text-slate-500">
      <Loader2 className="animate-spin text-primary" size={20} />Loading workspace data...
    </div>
  )
}

function ErrorBanner({ message }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
      <AlertTriangle className="mt-0.5 shrink-0" size={17} />{message}
    </div>
  )
}

export default WorkspacePage
