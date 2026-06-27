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
  appendMessage,
  clearWorkspaceHistory,
  createConversation,
  deleteConversation,
  getConversations,
} from '../services/chatHistoryStore.js'
import {
  askQuestion,
  createOrGetSession,
  getCitations,
  getHistory,
  getNotes,
  saveNote,
} from '../services/chatService.js'
import { getWorkspaces } from '../services/courseService.js'
import { getDocumentsByWorkspace } from '../services/documentService.js'
import { cn } from '../utils/cn.js'

const suggestions = [
  'Summarize the key ideas in this workspace',
  'Explain the most important concept with citations',
  'Create five review questions from the documents',
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
      createOrGetSession(user.id, activeWorkspace),
    ])
      .then(async ([nextDocuments, nextNotes, nextSession]) => {
        const history = await getHistory(nextSession.chatSessionId)
        const mappedHistory = await Promise.all(
          history.map(async (message) => {
            const isAssistant = message.senderRole?.toLowerCase() === 'assistant'
            const citations = isAssistant ? await getCitations(message.messageId).catch(() => []) : []
            return toUiMessage(message, citations)
          }),
        )
        if (!active) return
        setDocuments(nextDocuments)
        setNotes(nextNotes)
        setSession(nextSession)
        setMessages(mappedHistory)
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))

    return () => { active = false }
  }, [activeWorkspace, reloadKey, user?.id])

  // ─── Load local history when workspace changes ──────────────────
  useEffect(() => {
    if (!activeWorkspace) return
    const convs = getConversations(activeWorkspace)
    setConversations(convs)
    // Don't auto-select a conversation; let the chat be "current session" by default
    setActiveConvId(null)
  }, [activeWorkspace])

  // ─── Scroll to bottom on new messages ──────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const activeWorkspaceData = workspaces.find((item) => item.id === activeWorkspace)
  const indexedDocuments = useMemo(
    () => documents.filter((document) => document.status === 'Indexed'),
    [documents],
  )
  const canChat = Boolean(session && indexedDocuments.length && !isAnswering)

  // ─── Messages to display: either live session or a historical conversation ──
  const displayMessages = useMemo(() => {
    if (activeConvId) {
      const conv = conversations.find((c) => c.id === activeConvId)
      return (conv?.messages ?? []).map((m, i) => ({
        id: `hist-${activeConvId}-${i}`,
        role: m.role,
        content: m.content,
        citations: [],
        isHistory: true,
      }))
    }
    return messages
  }, [activeConvId, conversations, messages])

  // ─── Submit question ───────────────────────────────────────────
  async function handleSubmit(event) {
    event.preventDefault()
    const question = input.trim()
    if (!question || !session) return
    if (!indexedDocuments.length) {
      setError('This workspace has no processed document available for RAG.')
      return
    }

    // If viewing a historical conversation, switch back to live session first
    if (activeConvId) setActiveConvId(null)

    // Ensure a live localStorage conversation is active
    let convId = activeConvId
    if (!convId) {
      // Use today's ongoing conv or create one
      const convs = getConversations(activeWorkspace)
      const todayConv = convs[0]
      if (todayConv && Date.now() - todayConv.createdAt < 24 * 60 * 60 * 1000 && todayConv.messages.length === 0) {
        convId = todayConv.id
      } else {
        const newConv = createConversation(activeWorkspace)
        convId = newConv.id
        setConversations(getConversations(activeWorkspace))
      }
    }

    const optimisticId = `pending-${Date.now()}`
    setInput('')
    setError('')
    setIsAnswering(true)
    setMessages((current) => [...current, { id: optimisticId, role: 'user', content: question }])
    appendMessage(activeWorkspace, convId, 'user', question)

    try {
      const response = await askQuestion(session.chatSessionId, question)
      const answer = {
        id: response.assistantMessageId,
        role: 'assistant',
        content: response.answer,
        citations: response.citations ?? [],
      }
      setMessages((current) => [...current, answer])
      setActiveCitation(answer.citations[0] ?? null)
      appendMessage(activeWorkspace, convId, 'assistant', response.answer)
    } catch (requestError) {
      setMessages((current) => current.filter((message) => message.id !== optimisticId))
      setInput(question)
      setError(`${requestError.message} Your question is ready to retry.`)
    } finally {
      setIsAnswering(false)
      setConversations(getConversations(activeWorkspace))
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
        userId: user.id,
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

  function handleDeleteConversation(convId) {
    deleteConversation(activeWorkspace, convId)
    const updated = getConversations(activeWorkspace)
    setConversations(updated)
    if (activeConvId === convId) setActiveConvId(null)
  }

  function handleClearHistory() {
    clearWorkspaceHistory(activeWorkspace)
    setConversations([])
    setActiveConvId(null)
    setClearConfirm(false)
  }

  function handleSelectConversation(convId) {
    setActiveConvId(convId === activeConvId ? null : convId)
    setHistoryOpen(false)
  }

  function handleNewChat() {
    setActiveConvId(null)
    setMessages([])
    setInput('')
    setError('')
    setActiveCitation(null)
  }

  return (
    <div className="space-y-4">
      <Panel className="overflow-hidden p-5">
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

      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
        <AlertTriangle className="mt-0.5 shrink-0" size={16} />
        Development warning: the current backend AI integration does not yet guarantee workspace-isolated retrieval.
      </div>
      {error ? <ErrorBanner message={error} /> : null}

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/* Left panel: workspaces + documents */}
        <Panel className="p-4 xl:min-h-[720px]">
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
        <Panel className="flex h-[720px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <div>
              <p className="text-xs font-black uppercase text-slate-500">
                {activeConvId ? 'Lịch sử cuộc trò chuyện' : 'Active session'}
              </p>
              <h2 className="mt-1 text-base font-black">
                {activeConvId
                  ? (conversations.find(c => c.id === activeConvId)?.title ?? 'Conversation')
                  : (activeWorkspaceData?.name || 'Select a workspace')}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {activeConvId && (
                <button
                  className="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-black text-teal-700 transition hover:bg-teal-100"
                  onClick={handleNewChat}
                  type="button"
                >
                  <Plus size={13} /> Cuộc trò chuyện mới
                </button>
              )}
              {session && !activeConvId ? (
                <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">Connected</span>
              ) : null}
              {activeConvId && (
                <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">Xem lại</span>
              )}
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
                <Loader2 className="animate-spin text-primary" size={17} />Generating a source-grounded answer...
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 bg-white/70 p-4">
            {activeConvId ? (
              <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs font-semibold text-amber-700">
                Đang xem cuộc trò chuyện cũ.{' '}
                <button className="font-black underline" onClick={handleNewChat} type="button">
                  Nhấn đây để chat mới
                </button>
              </div>
            ) : (
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
            )}
            <form className="flex gap-2" onSubmit={handleSubmit}>
              <textarea
                aria-label="Question"
                className="min-h-12 flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100 disabled:opacity-50"
                disabled={Boolean(activeConvId)}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
                placeholder={
                  activeConvId
                    ? 'Đang xem lịch sử — nhấn "Cuộc trò chuyện mới" để tiếp tục chat'
                    : indexedDocuments.length
                      ? 'Ask from the indexed documents...'
                      : 'This workspace needs a processed document'
                }
                value={input}
              />
              <Button
                aria-label="Send question"
                disabled={!canChat || !input.trim() || Boolean(activeConvId)}
                size="icon"
                type="submit"
              >
                <Send size={17} />
              </Button>
            </form>
          </div>
        </Panel>

        {/* Right panel: citations + notes */}
        <Panel className="p-4 xl:min-h-[720px]">
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
                            {conv.messages.length} tin nhắn · {formatRelativeTime(conv.createdAt)}
                          </p>
                        </div>
                        <button
                          aria-label="Xoá"
                          className="invisible ml-auto grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500 group-hover:visible"
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
  return (
    <motion.article
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
      initial={{ opacity: 0, y: 10 }}
    >
      {!isUser ? <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-white"><Bot size={17} /></div> : null}
      <div className={cn('max-w-[82%] rounded-lg p-4', isUser ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white', message.isHistory && 'opacity-80')}>
        <p className="whitespace-pre-wrap text-sm font-semibold leading-6">{message.content}</p>
        {message.citations?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.citations.map((citation, index) => (
              <button
                className="rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-black text-teal-700"
                key={`${citation.documentTitle}-${index}`}
                onClick={() => onCitation(citation)}
                type="button"
              >
                {citation.documentTitle || `Source ${index + 1}`} / {pageLabel(citation)}
              </button>
            ))}
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

function toUiMessage(message, citations = []) {
  return {
    id: message.messageId,
    role: message.senderRole?.toLowerCase() === 'assistant' ? 'assistant' : 'user',
    content: message.messageContent,
    citations,
  }
}

function pageLabel(citation) {
  if (!citation.pageStart) return 'Page unavailable'
  return citation.pageEnd && citation.pageEnd !== citation.pageStart
    ? `Pages ${citation.pageStart}-${citation.pageEnd}`
    : `Page ${citation.pageStart}`
}

function formatRelativeTime(ts) {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  return new Date(ts).toLocaleDateString('vi-VN')
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
