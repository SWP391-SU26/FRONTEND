import { AnimatePresence, motion } from 'framer-motion'
import {
  Archive,
  Bot,
  Check,
  ChevronDown,
  Clipboard,
  Clock3,
  ExternalLink,
  FileText,
  Files,
  Library,
  Loader2,
  Lock,
  Menu,
  MessageSquareText,
  NotebookPen,
  PanelRight,
  Plus,
  Send,
  Square,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'
import { LanguageSwitch } from '../components/LanguageSwitch.jsx'
import StudentSidebar from '../components/StudentSidebar.jsx'
import { useLocale } from '../i18n/LocaleContext.jsx'
import {
  createSession,
  deleteSession,
  getMessages,
  getNotes,
  getSessions,
  pinSession,
  renameSession,
  saveNote,
  streamQuestion,
} from '../services/chatService.js'
import { getCourseMaterials, getLearningScope } from '../services/courseService.js'
import { getMyDocuments } from '../services/documentService.js'
import {
  clearSession,
  getSavedUser,
  logout,
} from '../services/authService.js'
import { cn } from '../utils/cn.js'

const EMPTY_MATERIALS = { chapters: [], unclassifiedMaterials: [] }
const CHAT_DEADLINE_MS = 55_000
const PHASE_LABELS = {
  SCOPE_CHECK: 'chat.phaseScope',
  RETRIEVAL: 'chat.phaseRetrieval',
  GENERATION_START: 'chat.phaseGeneration',
}

const FALLBACK_T = (key, params = {}) => {
  const labels = {
    'chat.aiTyping': 'AI đang trả lời',
    'chat.sourceDocument': 'Tài liệu nguồn',
    'chat.pagePrefix': 'tr.',
    'chat.respondedIn': `Phản hồi trong ${params.time ?? ''}`,
    'chat.copy': 'Sao chép',
    'chat.saveAsNote': 'Lưu thành ghi chú',
  }
  return labels[key] ?? key
}

export default function WorkspacePage() {
  const navigate = useNavigate()
  const { t } = useLocale()
  const [urlSearchParams, setUrlSearchParams] = useSearchParams()
  const user = getSavedUser()
  const [semesters, setSemesters] = useState([])
  const [personalDocuments, setPersonalDocuments] = useState([])
  const [semesterId, setSemesterId] = useState('')
  const [courseId, setCourseId] = useState('')
  const [scopeType, setScopeType] = useState('COURSE')
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([])
  const [materials, setMaterials] = useState(EMPTY_MATERIALS)
  const [sessions, setSessions] = useState([])
  const [session, setSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [notes, setNotes] = useState([])
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('fstu_chat_sidebar_collapsed') === 'true',
  )
  const [scopeOpen, setScopeOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState(null)
  const [activeCitation, setActiveCitation] = useState(null)
  const [noteDraft, setNoteDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [answering, setAnswering] = useState(false)
  const [answerElapsedMs, setAnswerElapsedMs] = useState(0)
  const [processingPhase, setProcessingPhase] = useState('')
  const [streamError, setStreamError] = useState(null)
  const [copiedId, setCopiedId] = useState('')
  const [sessionMenuId, setSessionMenuId] = useState('')
  const [renaming, setRenaming] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busySessionId, setBusySessionId] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const abortRef = useRef(null)
  const answerStartedAtRef = useRef(0)
  const messagesEndRef = useRef(null)
  const initialSessionIdRef = useRef(urlSearchParams.get('session'))
  const skipHistorySessionIdRef = useRef('')

  const semester = useMemo(
    () => semesters.find((item) => String(item.semesterId) === String(semesterId)) ?? null,
    [semesters, semesterId],
  )
  const courses = semester?.courses ?? []
  const course = courses.find((item) => String(item.courseId) === String(courseId)) ?? null
  const documents = useMemo(() => deduplicateMaterials(materials), [materials])
  const scopeValid = scopeType === 'PERSONAL'
    ? selectedDocumentIds.length > 0
    : scopeType === 'SEMESTER'
      ? Boolean(semester?.courses?.some((item) => item.processedDocumentCount > 0))
      : scopeType === 'DOCUMENTS'
        ? Boolean(course && selectedDocumentIds.length)
        : Boolean(course?.processedDocumentCount)
  const scopeLabel = session?.scopeLabel
    || buildScopeLabel(scopeType, semester, course, selectedDocumentIds.length, t)

  useEffect(() => {
    if (!answering) return undefined
    const updateElapsed = () => {
      setAnswerElapsedMs(Math.min(
        CHAT_DEADLINE_MS,
        Math.max(0, performance.now() - answerStartedAtRef.current),
      ))
    }
    updateElapsed()
    const intervalId = window.setInterval(updateElapsed, 250)
    return () => window.clearInterval(intervalId)
  }, [answering])

  useEffect(() => {
    let active = true
    Promise.all([getLearningScope(), getMyDocuments(), getSessions()])
      .then(([scope, mine, history]) => {
        if (!active) return
        const next = Array.isArray(scope) ? scope : []
        setSemesters(next)
        setSemesterId(next[0]?.semesterId ?? '')
        setCourseId(next[0]?.courses?.[0]?.courseId ?? '')
        setPersonalDocuments((mine ?? []).filter(isProcessedDocument))
        const sortedHistory = sortSessions(history)
        setSessions(sortedHistory)
        const requestedSession = sortedHistory.find(
          (item) => String(item.id) === String(initialSessionIdRef.current),
        )
        if (requestedSession) setSession(requestedSession)
      })
      .catch((error) => setStreamError({ message: readError(error, t('chat.loadWorkspaceError'), t) }))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  // Keep initial workspace loading independent from locale changes so switching
  // language does not reset chat scope or the selected session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      getSessions({}, search)
        .then((items) => setSessions(sortSessions(items)))
        .catch(() => {})
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    let active = true
    if (!courseId || scopeType === 'PERSONAL') {
      queueMicrotask(() => active && setMaterials(EMPTY_MATERIALS))
      return () => { active = false }
    }
    getCourseMaterials(courseId)
      .then((value) => active && setMaterials(value ?? EMPTY_MATERIALS))
      .catch(() => active && setMaterials(EMPTY_MATERIALS))
    return () => { active = false }
  }, [courseId, scopeType])

  useEffect(() => {
    let active = true
    if (!session?.id) {
      queueMicrotask(() => active && setMessages([]))
      return () => { active = false }
    }
    if (skipHistorySessionIdRef.current === session.id) {
      skipHistorySessionIdRef.current = ''
      queueMicrotask(() => active && setLoadingMessages(false))
      return () => { active = false }
    }
    queueMicrotask(() => active && setLoadingMessages(true))
    getMessages(session.id)
      .then((items) => active && setMessages(items))
      .catch((error) => active && setStreamError({
        message: readError(error, t('chat.loadMessagesError'), t),
      }))
      .finally(() => active && setLoadingMessages(false))
    return () => { active = false }
  // Keep message history stable while toggling UI language.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id])

  useEffect(() => {
    let active = true
    const workspaceId = session?.workspaceId || (
      scopeType === 'PERSONAL'
        ? personalDocuments.find((item) => selectedDocumentIds.includes(item.id))?.workspaceId
        : course?.workspaceId
    )
    if (!workspaceId || scopeType === 'SEMESTER') {
      queueMicrotask(() => active && setNotes([]))
      return () => { active = false }
    }
    getNotes(workspaceId)
      .then((items) => active && setNotes(Array.isArray(items) ? items : []))
      .catch(() => active && setNotes([]))
    return () => { active = false }
  }, [course?.workspaceId, personalDocuments, scopeType, selectedDocumentIds, session?.workspaceId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, processingPhase])

  function toggleSidebar() {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    localStorage.setItem('fstu_chat_sidebar_collapsed', String(next))
  }

  function startNewChat() {
    abortRef.current?.abort()
    setSession(null)
    setMessages([])
    setScopeType('COURSE')
    setSelectedDocumentIds([])
    setInput('')
    setStreamError(null)
    setProcessingPhase('')
    setDrawerMode(null)
    setScopeOpen(false)
    setSidebarOpen(false)
    setUrlSearchParams({}, { replace: true })
  }

  function changeSemester(nextId) {
    const next = semesters.find((item) => String(item.semesterId) === String(nextId))
    setSemesterId(nextId)
    setCourseId(next?.courses?.[0]?.courseId ?? '')
    setSelectedDocumentIds([])
  }

  function changeScope(nextType) {
    if (session) return
    setScopeType(nextType)
    setSelectedDocumentIds([])
  }

  function toggleDocument(id) {
    if (session) return
    setSelectedDocumentIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id])
  }

  async function selectSession(next) {
    setSessionMenuId('')
    setSidebarOpen(false)
    setDrawerMode(null)
    setActiveCitation(null)
    setScopeType(next.scopeType ?? 'COURSE')
    setSelectedDocumentIds(next.documentIds ?? [])
    if (next.semesterId) {
      const nextSemester = semesters.find(
        (item) => String(item.semesterId) === String(next.semesterId),
      )
      setSemesterId(next.semesterId)
      if (next.courseId) setCourseId(next.courseId)
      else if (nextSemester?.courses?.[0]) setCourseId(nextSemester.courses[0].courseId)
    }
    setSession(next)
    setUrlSearchParams({ session: next.id }, { replace: true })
  }

  async function submit(event, retryQuestion = '') {
    event?.preventDefault()
    const question = (retryQuestion || input).trim()
    if (!question || !scopeValid || answering) return
    setInput('')
    setStreamError(null)
    answerStartedAtRef.current = performance.now()
    setAnswerElapsedMs(0)
    setAnswering(true)
    setProcessingPhase('SCOPE_CHECK')
    const pendingUserId = `user-${crypto.randomUUID()}`
    const pendingAssistantId = `assistant-${crypto.randomUUID()}`
    let receivedDeltaCount = 0
    let bufferedDelta = ''
    setMessages((current) => [
      ...current,
      { id: pendingUserId, role: 'user', content: question, citations: [] },
      { id: pendingAssistantId, role: 'assistant', content: '', citations: [], streaming: true },
    ])

    let activeSession = session
    let createdSession = false
    try {
      if (!activeSession) {
        activeSession = await createSession({
          scopeType,
          semesterId: scopeType === 'PERSONAL' ? null : semesterId,
          courseId: ['PERSONAL', 'SEMESTER'].includes(scopeType) ? null : courseId,
          documentIds: ['PERSONAL', 'DOCUMENTS'].includes(scopeType)
            ? selectedDocumentIds : [],
        })
        createdSession = true
        skipHistorySessionIdRef.current = activeSession.id
        setSession(activeSession)
        setSessions((current) => sortSessions([activeSession, ...current]))
        setUrlSearchParams({ session: activeSession.id }, { replace: true })
      }

      const controller = new AbortController()
      abortRef.current = controller
      const result = await streamQuestion(activeSession.id, question, {
        mode: 'rag',
        signal: controller.signal,
        onEvent: ({ type, data }) => {
          if (PHASE_LABELS[type]) setProcessingPhase(type)
          if (type === 'DELTA') {
            receivedDeltaCount += 1
            bufferedDelta += data?.text ?? ''
            setProcessingPhase('')
            if (receivedDeltaCount > 1) {
              setMessages((current) => current.map((message) => (
                message.id === pendingAssistantId
                  ? {
                      ...message,
                      content: receivedDeltaCount === 2
                        ? bufferedDelta
                        : message.content + (data?.text ?? ''),
                    }
                  : message
              )))
            }
          }
          if (type === 'CITATIONS') {
            setMessages((current) => current.map((message) => (
              message.id === pendingAssistantId
                ? { ...message, citations: data?.citations ?? [] }
                : message
            )))
          }
        },
      })
      setMessages((current) => {
        const hasUser = current.some((message) => message.id === pendingUserId)
        const hasAssistant = current.some((message) => message.id === pendingAssistantId)
        const next = current.map((message) => {
          if (message.id === pendingUserId) {
            return { ...message, id: result.userMessageId ?? message.id }
          }
          if (message.id === pendingAssistantId) {
            return {
              ...message,
              id: result.assistantMessageId ?? message.id,
              content: result.answer || message.content,
              citations: result.citations ?? message.citations,
              generationMode: result.generationMode,
              latencyMs: result.latencyMs ?? Math.round(performance.now() - answerStartedAtRef.current),
              streaming: false,
              animateResponse: receivedDeltaCount <= 1,
            }
          }
          return message
        })
        if (!hasUser) {
          next.push({
            id: result.userMessageId ?? pendingUserId,
            role: 'user',
            content: question,
            citations: [],
          })
        }
        if (!hasAssistant) {
          next.push({
            id: result.assistantMessageId ?? pendingAssistantId,
            role: 'assistant',
            content: result.answer || '',
            citations: result.citations ?? [],
            generationMode: result.generationMode,
            latencyMs: result.latencyMs ?? Math.round(performance.now() - answerStartedAtRef.current),
            streaming: false,
            animateResponse: receivedDeltaCount <= 1,
          })
        }
        return next
      })
      const refreshed = await getSessions({}, search)
      setSessions(sortSessions(refreshed))
      setSession(refreshed.find((item) => item.id === activeSession.id) ?? activeSession)
    } catch (error) {
      if (error.code === 'CHAT_DEADLINE_EXCEEDED') {
        error.message = t('chat.deadline')
      }
      setMessages((current) => current.filter((message) => message.id !== pendingAssistantId))
      if (activeSession?.id) {
        try {
          const savedMessages = await getMessages(activeSession.id)
          if (savedMessages.length) {
            setMessages(savedMessages)
            const refreshed = await getSessions({}, search)
            setSessions(sortSessions(refreshed))
            setSession(refreshed.find((item) => item.id === activeSession.id) ?? activeSession)
          } else if (createdSession) {
            await deleteSession(activeSession.id)
            setSessions((current) => current.filter((item) => item.id !== activeSession.id))
            setSession(null)
            setMessages((current) => current.filter((message) => message.id !== pendingUserId))
          }
        } catch {
          // Keep the optimistic user message when history cannot be reconciled safely.
        }
      }
      if (error.name === 'AbortError') {
        setStreamError({ message: t('chat.stopped'), question })
      } else {
        setStreamError({
          message: readError(error, t('chat.fallbackError'), t),
          question,
          code: error.code,
          elapsedMs: error.elapsedMs,
        })
      }
    } finally {
      abortRef.current = null
      setAnswering(false)
      setProcessingPhase('')
    }
  }

  function stopAnswer() {
    abortRef.current?.abort()
  }

  async function copyMessage(message) {
    await navigator.clipboard.writeText(message.content)
    setCopiedId(message.id)
    window.setTimeout(() => setCopiedId(''), 1400)
  }

  async function updatePin(item) {
    setBusySessionId(item.id)
    try {
      const updated = await pinSession(item.id, !item.isPinned)
      setSessions((current) => sortSessions(
        current.map((candidate) => candidate.id === item.id ? updated : candidate),
      ))
      if (session?.id === item.id) setSession(updated)
    } finally {
      setBusySessionId('')
      setSessionMenuId('')
    }
  }

  async function submitRename(event) {
    event.preventDefault()
    const title = renaming?.title?.trim()
    if (!renaming || !title) return
    setBusySessionId(renaming.id)
    try {
      const updated = await renameSession(renaming.id, title)
      setSessions((current) => sortSessions(
        current.map((candidate) => candidate.id === renaming.id ? updated : candidate),
      ))
      if (session?.id === renaming.id) setSession(updated)
      setRenaming(null)
    } finally {
      setBusySessionId('')
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setBusySessionId(deleteTarget.id)
    try {
      await deleteSession(deleteTarget.id)
      setSessions((current) => current.filter((item) => item.id !== deleteTarget.id))
      if (session?.id === deleteTarget.id) startNewChat()
      setDeleteTarget(null)
    } finally {
      setBusySessionId('')
    }
  }

  function prepareNote(message) {
    setNoteDraft({
      noteTitle: session?.title && session.title !== 'New conversation'
        ? session.title : t('chat.defaultNoteTitle'),
      noteContent: message.content,
    })
    setDrawerMode('notes')
  }

  async function submitNote(event) {
    event.preventDefault()
    const workspaceId = session?.workspaceId || (
      scopeType === 'PERSONAL'
        ? personalDocuments.find((item) => selectedDocumentIds.includes(item.id))?.workspaceId
        : course?.workspaceId
    )
    if (!workspaceId || !noteDraft || savingNote) return
    setSavingNote(true)
    try {
      const saved = await saveNote({ workspaceId, ...noteDraft })
      setNotes((current) => [saved, ...current])
      setNoteDraft(null)
    } finally {
      setSavingNote(false)
    }
  }

  function handleLogout() {
    logout().catch(() => {})
    clearSession()
    navigate('/login')
  }

  if (loading) {
    return <FullScreenState icon={Loader2} spin title={t('chat.loadingWorkspace')} />
  }

  if (!semesters.length) {
    return <FullScreenState icon={Archive} title={t('chat.noAvailableDocuments')} />
  }

  return (
    <div className="chat-shell-page flex bg-white text-slate-950">
      <StudentSidebar
        activeSessionId={session?.id}
        busySessionId={busySessionId}
        collapsed={sidebarCollapsed}
        menuId={sessionMenuId}
        onClose={() => setSidebarOpen(false)}
        onCollapse={toggleSidebar}
        onDelete={setDeleteTarget}
        onLogout={handleLogout}
        onMenu={setSessionMenuId}
        onNew={startNewChat}
        onPin={updatePin}
        onRename={(item) => { setRenaming({ id: item.id, title: item.title }); setSessionMenuId('') }}
        onSearch={setSearch}
        onSelect={selectSession}
        open={sidebarOpen}
        search={search}
        sessions={sessions}
        user={user}
      />

      <main className="relative flex min-w-0 flex-1 flex-col bg-white">
        <ChatTopbar
          onMenu={() => setSidebarOpen(true)}
          onNew={startNewChat}
          onSources={() => setDrawerMode('sources')}
          scopeLabel={scopeLabel}
          t={t}
          title={session?.title || t('chat.newConversation')}
        />

        <ChatThread
          activeScopeLabel={scopeLabel}
          copiedId={copiedId}
          loading={loadingMessages}
          messages={messages}
          onCitation={(citation) => { setActiveCitation(citation); setDrawerMode('sources') }}
          onCopy={copyMessage}
          onSave={prepareNote}
          answerElapsedMs={answerElapsedMs}
          processingPhase={processingPhase}
          streamError={streamError}
          t={t}
          onReuseQuestion={(question) => { setInput(question); setStreamError(null) }}
          endRef={messagesEndRef}
        />

        <ChatComposer
          answering={answering}
          input={input}
          onChange={setInput}
          onOpenScope={() => setScopeOpen(true)}
          onStop={stopAnswer}
          onSubmit={submit}
          scopeLabel={scopeLabel}
          scopeValid={scopeValid}
          t={t}
        />

        <ScopePicker
          courseId={courseId}
          courses={courses}
          documents={documents}
          locked={Boolean(session)}
          onChangeCourse={(id) => { setCourseId(id); setSelectedDocumentIds([]) }}
          onChangeScope={changeScope}
          onChangeSemester={changeSemester}
          onClose={() => setScopeOpen(false)}
          onToggleDocument={toggleDocument}
          open={scopeOpen}
          personalDocuments={personalDocuments}
          scopeType={scopeType}
          selectedDocumentIds={selectedDocumentIds}
          semesterId={semesterId}
          semesters={semesters}
          t={t}
        />
      </main>

      <DetailDrawer
        activeCitation={activeCitation}
        mode={drawerMode}
        noteDraft={noteDraft}
        notes={notes}
        onClose={() => { setDrawerMode(null); setActiveCitation(null); setNoteDraft(null) }}
        onDraftChange={setNoteDraft}
        onSaveNote={submitNote}
        savingNote={savingNote}
        t={t}
      />

      {renaming ? (
        <RenameDialog
          busy={busySessionId === renaming.id}
          onCancel={() => setRenaming(null)}
          onChange={(title) => setRenaming((current) => ({ ...current, title }))}
          onSubmit={submitRename}
          title={renaming.title}
        />
      ) : null}
      {deleteTarget ? (
        <ConfirmDeleteDialog
          busy={busySessionId === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          title={deleteTarget.title}
        />
      ) : null}
    </div>
  )
}

function ChatTopbar({ onMenu, onNew, onSources, scopeLabel, t, title }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 px-3 sm:px-5">
      <IconAction className="lg:hidden" label={t('chat.openHistory')} onClick={onMenu}><Menu size={19} /></IconAction>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold text-slate-900">{title}</h1>
        <p className="truncate text-xs text-slate-500">{scopeLabel}</p>
      </div>
      <span className="hidden sm:inline-flex">
        <LanguageSwitch compact />
      </span>
      <IconAction label={t('chat.sources')} onClick={onSources}><PanelRight size={18} /></IconAction>
      <IconAction label={t('chat.newChat')} onClick={onNew}><Plus size={18} /></IconAction>
    </header>
  )
}

function ChatThread({
  activeScopeLabel, answerElapsedMs, copiedId, endRef, loading, messages, onCitation, onCopy, onReuseQuestion,
  onSave, processingPhase, streamError, t,
}) {
  return (
    <section className="min-h-0 flex-1 overflow-y-auto" aria-label={t('chat.threadLabel')}>
      <div className="mx-auto flex min-h-full w-full max-w-[820px] flex-col px-4 pb-36 pt-8 sm:px-8">
        {loading ? (
          <div className="space-y-7" aria-label={t('chat.loadingMessages')}>
            <MessageSkeleton /><MessageSkeleton />
          </div>
        ) : messages.length ? (
          <div className="space-y-8">
            {messages.map((message) => (
              <ChatMessage
                copied={copiedId === message.id}
                key={message.id}
                message={message}
                onCitation={onCitation}
                onCopy={() => onCopy(message)}
                onSave={() => onSave(message)}
                t={t}
              />
            ))}
            {processingPhase ? (
              <ProcessingStatus elapsedMs={answerElapsedMs} phase={processingPhase} t={t} />
            ) : null}
            {streamError ? (
              <div className="ml-11 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                <p>{streamError.message}</p>
                {streamError.question ? (
                  <button
                    className="mt-2 font-semibold text-red-700 underline underline-offset-2"
                    onClick={() => onReuseQuestion(streamError.question)}
                    type="button"
                  >
                    {t('common.retry')}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid flex-1 place-items-center py-16 text-center">
            <div className="max-w-lg">
              <div className="mx-auto grid size-12 place-items-center rounded-xl bg-teal-50 text-teal-800">
                <Bot size={23} />
              </div>
              <h2 className="mt-5 text-2xl font-semibold text-slate-950">{t('chat.welcomeTitle')}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                {t('chat.welcomeBody', { scope: activeScopeLabel })}
              </p>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </section>
  )
}

function ChatMessage({ copied, message, onCitation, onCopy, onSave, t }) {
  if (message.role === 'user') {
    return (
      <article className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-900 sm:max-w-[72%]">
          {message.content}
        </div>
      </article>
    )
  }
  return (
    <AssistantMessage
      copied={copied}
      message={message}
      onCitation={onCitation}
      onCopy={onCopy}
      onSave={onSave}
      t={t}
    />
  )
}

export function AssistantMessage({ copied, message, onCitation, onCopy, onSave, t = FALLBACK_T }) {
  const shouldAnimate = Boolean(message.animateResponse && message.content)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const animate = shouldAnimate && !reducedMotion
  const [displayContent, setDisplayContent] = useState('')
  const [typing, setTyping] = useState(animate)

  useEffect(() => {
    if (!animate) return undefined

    const characters = Array.from(message.content)
    let visibleCount = 0

    const intervalId = window.setInterval(() => {
      visibleCount += 1
      setDisplayContent(characters.slice(0, visibleCount).join(''))
      if (visibleCount >= characters.length) {
        window.clearInterval(intervalId)
        setTyping(false)
      }
    }, 10)

    return () => window.clearInterval(intervalId)
  }, [animate, message.content, message.id])

  const renderedContent = animate ? displayContent : message.content
  const isTyping = animate && typing

  return (
    <article className="group flex items-start gap-3">
      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-teal-700 text-white">
        <Bot size={16} />
      </div>
      <div className="min-w-0 flex-1">
        {message.content ? (
          <div aria-live="polite">
            <MarkdownMessage content={renderedContent} />
            {isTyping ? <span aria-hidden="true" className="typewriter-caret" /> : null}
          </div>
        ) : (
          <span className="inline-flex gap-1 py-3" aria-label={t('chat.aiTyping')}>
            {[0, 1, 2].map((item) => <span className="size-1.5 animate-pulse rounded-full bg-slate-400" key={item} />)}
          </span>
        )}
        {!isTyping && message.citations?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {message.citations.map((citation, index) => (
              <button
                className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs font-medium text-slate-600 transition hover:border-teal-300 hover:text-teal-800"
                key={citation.id || `${citation.documentTitle}-${index}`}
                onClick={() => onCitation({ ...citation, citationNumber: index + 1 })}
                type="button"
              >
                <span className="font-bold text-teal-700">[{index + 1}]</span>
                <span className="max-w-52 truncate">{citation.documentTitle || t('chat.sourceDocument')}</span>
                {citation.pageStart ? <span>· {t('chat.pagePrefix')} {citation.pageStart}</span> : null}
              </button>
            ))}
          </div>
        ) : null}
        {!isTyping && !message.streaming && message.content && Number.isFinite(message.latencyMs) ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Clock3 size={13} />
            {t('chat.respondedIn', { time: formatResponseTime(message.latencyMs) })}
          </p>
        ) : null}
        {!isTyping && !message.streaming && message.content ? (
          <div className="mt-3 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <IconAction label={t('chat.copy')} onClick={onCopy}>
              {copied ? <Check className="text-emerald-600" size={15} /> : <Clipboard size={15} />}
            </IconAction>
            <IconAction label={t('chat.saveAsNote')} onClick={onSave}><NotebookPen size={15} /></IconAction>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function MarkdownMessage({ content }) {
  return (
    <div className="chat-markdown text-[15px] leading-7 text-slate-800">
      <ReactMarkdown
        rehypePlugins={[rehypeKatex]}
        remarkPlugins={[remarkGfm, remarkMath]}
        components={{
          a: ({ children, ...props }) => <a className="font-medium text-teal-700 underline underline-offset-2" rel="noreferrer" target="_blank" {...props}>{children}</a>,
          code: ({ children, className }) => className
            ? <code className={cn('block overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm text-slate-100', className)}>{children}</code>
            : <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.92em] text-slate-900">{children}</code>,
          table: ({ children }) => <div className="my-4 overflow-x-auto"><table className="w-full border-collapse text-sm">{children}</table></div>,
          th: ({ children }) => <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-slate-200 px-3 py-2 align-top">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function ChatComposer({ answering, input, onChange, onOpenScope, onStop, onSubmit, scopeLabel, scopeValid, t }) {
  const textareaRef = useRef(null)
  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = '0px'
    element.style.height = `${Math.min(element.scrollHeight, 180)}px`
  }, [input])

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white to-transparent px-3 pb-3 pt-10 sm:px-6">
      <form className="pointer-events-auto mx-auto max-w-[820px]" onSubmit={onSubmit}>
        <div className="rounded-2xl border border-slate-300 bg-white p-2 shadow-[0_6px_18px_rgba(15,23,42,.10)] focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
          <textarea
            aria-label={t('chat.questionLabel')}
            className="block max-h-[180px] min-h-12 w-full resize-none bg-transparent px-2 py-2 text-[15px] leading-6 text-slate-900 outline-none placeholder:text-slate-500"
            disabled={answering || !scopeValid}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                onSubmit()
              }
            }}
            placeholder={scopeValid ? t('chat.placeholderReady') : t('chat.placeholderNoScope')}
            ref={textareaRef}
            rows={1}
            value={input}
          />
          <div className="flex items-center gap-2">
            <button
              className="inline-flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
              onClick={onOpenScope}
              type="button"
            >
              <Files size={16} />
              <span className="max-w-[48vw] truncate sm:max-w-sm">{scopeLabel}</span>
              <ChevronDown size={14} />
            </button>
            <span className="flex-1" />
            {answering ? (
              <button
                aria-label={t('chat.stop')}
                className="grid size-9 place-items-center rounded-full bg-slate-900 text-white hover:bg-slate-700"
                onClick={onStop}
                type="button"
              >
                <Square fill="currentColor" size={13} />
              </button>
            ) : (
              <button
                aria-label={t('chat.send')}
                className="grid size-9 place-items-center rounded-full bg-teal-700 text-white hover:bg-teal-800 disabled:bg-slate-300"
                disabled={!input.trim() || !scopeValid}
                type="submit"
              >
                <Send size={17} />
              </button>
            )}
          </div>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-slate-500">
          {t('chat.disclaimer')}
        </p>
      </form>
    </div>
  )
}

function ScopePicker({
  courseId, courses, documents, locked, onChangeCourse, onChangeScope, onChangeSemester,
  onClose, onToggleDocument, open, personalDocuments, scopeType, selectedDocumentIds,
  semesterId, semesters, t,
}) {
  if (!open) return null
  const selectable = scopeType === 'PERSONAL' ? personalDocuments : documents
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/20" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <motion.section
        aria-label={t('chat.scopeTitle')}
        className="absolute bottom-0 left-0 right-0 max-h-[82vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:bottom-28 sm:left-1/2 sm:right-auto sm:w-[520px] sm:-translate-x-1/2 sm:rounded-xl sm:border sm:border-slate-200"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-slate-950">{t('chat.scopeTitle')}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {locked ? t('chat.scopeLocked') : t('chat.scopeHint')}
            </p>
          </div>
          <IconAction label={t('common.close')} onClick={onClose}><X size={18} /></IconAction>
        </div>

        <div className="mt-4 grid grid-cols-4 rounded-lg bg-slate-100 p-1">
          {[
            ['PERSONAL', t('chat.personal'), UserRound],
            ['DOCUMENTS', t('chat.documents'), FileText],
            ['COURSE', t('chat.course'), Library],
            ['SEMESTER', t('chat.semester'), Archive],
          ].map(([value, label, Icon]) => (
            <button
              className={cn(
                'flex min-h-10 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium',
                scopeType === value ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600',
              )}
              disabled={locked}
              key={value}
              onClick={() => onChangeScope(value)}
              type="button"
            >
              <Icon size={14} /><span>{label}</span>
            </button>
          ))}
        </div>

        {scopeType !== 'PERSONAL' ? (
          <label className="mt-4 block text-xs font-medium text-slate-600">
            {t('chat.semester')}
            <select
              className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              disabled={locked}
              onChange={(event) => onChangeSemester(event.target.value)}
              value={semesterId}
            >
              {semesters.map((item) => <option key={item.semesterId} value={item.semesterId}>{item.semesterName}</option>)}
            </select>
          </label>
        ) : null}
        {!['PERSONAL', 'SEMESTER'].includes(scopeType) ? (
          <label className="mt-3 block text-xs font-medium text-slate-600">
            {t('chat.course')}
            <select
              className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              disabled={locked}
              onChange={(event) => onChangeCourse(event.target.value)}
              value={courseId}
            >
              {courses.map((item) => <option key={item.courseId} value={item.courseId}>{item.courseCode} · {item.courseName}</option>)}
            </select>
          </label>
        ) : null}

        {['PERSONAL', 'DOCUMENTS'].includes(scopeType) ? (
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-600">{t('chat.documents')}</p>
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
              {selectable.length ? selectable.map((item) => {
                const id = item.documentId ?? item.id
                const name = item.originalFilename ?? item.displayName ?? item.name ?? t('chat.documents')
                return (
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50" key={id}>
                    <input
                      checked={selectedDocumentIds.includes(id)}
                      disabled={locked}
                      onChange={() => onToggleDocument(id)}
                      type="checkbox"
                    />
                    <FileText className="shrink-0 text-teal-700" size={16} />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{name}</span>
                  </label>
                )
              }) : <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">{t('chat.noProcessedDocuments')}</p>}
            </div>
          </div>
        ) : null}

        <button
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-teal-700 text-sm font-semibold text-white hover:bg-teal-800"
          onClick={onClose}
          type="button"
        >
          {locked ? <Lock size={14} /> : <Check size={14} />}
          {locked ? t('chat.lockedScope') : t('chat.useScope')}
        </button>
      </motion.section>
    </div>
  )
}

function DetailDrawer({ activeCitation, mode, noteDraft, notes, onClose, onDraftChange, onSaveNote, savingNote, t }) {
  return (
    <AnimatePresence>
      {mode ? (
        <motion.div
          className="fixed inset-0 z-50 bg-slate-950/25 lg:static lg:z-auto lg:bg-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
          <motion.aside
            className="absolute bottom-0 right-0 flex max-h-[80vh] w-full flex-col rounded-t-2xl border-l border-slate-200 bg-white shadow-2xl lg:static lg:h-full lg:max-h-none lg:w-[360px] lg:rounded-none lg:shadow-none"
            initial={{ x: 380 }}
            animate={{ x: 0 }}
            exit={{ x: 380 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4">
              <h2 className="font-semibold">{mode === 'sources' ? t('chat.sources') : t('chat.notes')}</h2>
              <IconAction label={t('common.close')} onClick={onClose}><X size={18} /></IconAction>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {mode === 'sources' ? (
                activeCitation ? <CitationDetail citation={activeCitation} t={t} /> : (
                  <DrawerEmpty text={t('chat.selectSourceHint')} />
                )
              ) : noteDraft ? (
                <form onSubmit={onSaveNote}>
                  <label className="text-xs font-medium text-slate-600">{t('chat.noteTitle')}</label>
                  <input
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500"
                    onChange={(event) => onDraftChange({ ...noteDraft, noteTitle: event.target.value })}
                    value={noteDraft.noteTitle}
                  />
                  <label className="mt-4 block text-xs font-medium text-slate-600">{t('chat.noteContent')}</label>
                  <textarea
                    className="mt-1 min-h-48 w-full rounded-lg border border-slate-200 p-3 text-sm leading-6 outline-none focus:border-teal-500"
                    onChange={(event) => onDraftChange({ ...noteDraft, noteContent: event.target.value })}
                    value={noteDraft.noteContent}
                  />
                  <button className="mt-3 h-10 w-full rounded-lg bg-teal-700 text-sm font-semibold text-white disabled:bg-slate-300" disabled={savingNote} type="submit">
                    {savingNote ? t('chat.savingNote') : t('chat.saveNote')}
                  </button>
                </form>
              ) : notes.length ? (
                <div className="space-y-3">{notes.map((note) => (
                  <article className="rounded-lg border border-slate-200 p-3" key={note.noteId ?? note.id}>
                    <h3 className="text-sm font-semibold">{note.noteTitle}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{note.noteContent}</p>
                  </article>
                ))}</div>
              ) : <DrawerEmpty text={t('chat.noNotes')} />}
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function CitationDetail({ citation, t }) {
  return (
    <article>
      <div className="flex items-center gap-2 text-sm font-semibold text-teal-800">
        <span>[{citation.citationNumber || 1}]</span>
        <span>{citation.documentTitle || t('chat.sourceDocument')}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {citation.pageStart
          ? `${t('chat.pagePrefix')} ${citation.pageStart}${citation.pageEnd && citation.pageEnd !== citation.pageStart ? `-${citation.pageEnd}` : ''}`
          : t('chat.noPage')}
      </p>
      <blockquote className="mt-4 rounded-lg bg-slate-50 p-4 text-sm leading-7 text-slate-700">
        {citation.quoteText || t('chat.noPreview')}
      </blockquote>
      {citation.documentId ? (
        <Link className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-teal-700" to={`/library/documents/${citation.documentId}`}>
          {t('chat.openDocument')} <ExternalLink size={14} />
        </Link>
      ) : null}
    </article>
  )
}

function RenameDialog({ busy, onCancel, onChange, onSubmit, title }) {
  const { t } = useLocale()
  return (
    <DialogShell onCancel={onCancel}>
      <form onSubmit={onSubmit}>
        <h2 className="text-lg font-semibold">{t('sidebar.renameTitle')}</h2>
        <input
          autoFocus
          className="mt-4 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          maxLength={120}
          onChange={(event) => onChange(event.target.value)}
          value={title}
        />
        <DialogActions busy={busy} confirmLabel={t('common.save')} onCancel={onCancel} />
      </form>
    </DialogShell>
  )
}

function ConfirmDeleteDialog({ busy, onCancel, onConfirm, title }) {
  const { t } = useLocale()
  return (
    <DialogShell onCancel={onCancel}>
      <h2 className="text-lg font-semibold">{t('sidebar.deleteTitle')}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {t('sidebar.deleteBody', { title })}
      </p>
      <DialogActions busy={busy} confirmLabel={t('common.delete')} danger onCancel={onCancel} onConfirm={onConfirm} />
    </DialogShell>
  )
}

function DialogShell({ children, onCancel }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/35 p-4" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">{children}</div>
    </div>
  )
}

function DialogActions({ busy, confirmLabel, danger, onCancel, onConfirm }) {
  const { t } = useLocale()
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button className="h-10 rounded-lg px-4 text-sm font-medium text-slate-600 hover:bg-slate-100" disabled={busy} onClick={onCancel} type="button">{t('common.cancel')}</button>
      <button
        className={cn('h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:bg-slate-300', danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-700 hover:bg-teal-800')}
        disabled={busy}
        onClick={onConfirm}
        type={onConfirm ? 'button' : 'submit'}
      >
        {busy ? t('common.deleting') : confirmLabel}
      </button>
    </div>
  )
}

function ProcessingStatus({ elapsedMs, phase, t }) {
  const warning = elapsedMs >= 40_000
  return (
    <div className="ml-11 max-w-sm space-y-2 text-sm text-slate-500" role="status">
      <div className="flex items-center justify-between gap-4">
        <span className="inline-flex min-w-0 items-center gap-2">
          <Loader2 className={cn('shrink-0 animate-spin', warning ? 'text-amber-600' : 'text-teal-700')} size={15} />
          <span className="truncate">{PHASE_LABELS[phase] ? t(PHASE_LABELS[phase]) : t('chat.processingDefault')}</span>
        </span>
        <span className={cn('shrink-0 font-mono text-xs tabular-nums', warning && 'font-semibold text-amber-700')}>
          {formatTimer(elapsedMs)}
        </span>
      </div>
      <div className="relative h-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div
          className={cn(
            'chat-progress-indicator absolute inset-y-0 w-1/3 rounded-full',
            warning ? 'bg-amber-500' : 'bg-teal-600',
          )}
        />
      </div>
    </div>
  )
}

function formatTimer(milliseconds) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function formatResponseTime(milliseconds) {
  return `${(Math.max(0, milliseconds) / 1000).toLocaleString('vi-VN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} giây`
}

function MessageSkeleton() {
  return <div className="flex gap-3"><span className="size-8 animate-pulse rounded-full bg-slate-200" /><span className="mt-1 h-20 flex-1 animate-pulse rounded-lg bg-slate-100" /></div>
}

function DrawerEmpty({ text }) {
  return <div className="grid min-h-56 place-items-center text-center text-sm text-slate-500"><p className="max-w-56">{text}</p></div>
}

function FullScreenState({ icon: Icon, spin, title }) {
  return (
    <div className="grid min-h-screen place-items-center bg-white text-center">
      <div><Icon className={cn('mx-auto text-teal-700', spin && 'animate-spin')} size={28} /><h1 className="mt-3 font-semibold">{title}</h1></div>
    </div>
  )
}

function IconAction({ children, className, label, ...props }) {
  return (
    <button
      aria-label={label}
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600',
        className,
      )}
      title={label}
      type="button"
      {...props}
    >
      {children}
    </button>
  )
}

function sortSessions(items) {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    if (a.isPinned && b.isPinned) return dateValue(b.pinnedAt) - dateValue(a.pinnedAt)
    return dateValue(b.updatedAt) - dateValue(a.updatedAt)
  })
}

function deduplicateMaterials(value) {
  const map = new Map()
  const all = [
    ...(value?.chapters ?? []).flatMap((chapter) => chapter.materials ?? []),
    ...(value?.unclassifiedMaterials ?? []),
  ]
  all.forEach((item) => {
    if (!item?.documentId || item.processingStatus !== 'PROCESSED') return
    if (!map.has(item.documentId)) map.set(item.documentId, item)
  })
  return [...map.values()]
}

function buildScopeLabel(type, semester, course, count, t) {
  if (type === 'PERSONAL') return t('chat.scopePersonalLabel', { count })
  if (type === 'SEMESTER') return semester?.semesterName || t('chat.defaultSemester')
  const courseLabel = course ? `${course.courseCode} · ${course.courseName}` : t('chat.defaultCourse')
  return type === 'DOCUMENTS' ? t('chat.scopeDocumentsLabel', { count, course: courseLabel }) : courseLabel
}

function isProcessedDocument(document) {
  return ['Processed', 'Indexed'].includes(document?.status)
}

function dateValue(value) {
  const result = new Date(value || 0).getTime()
  return Number.isNaN(result) ? 0 : result
}

function readError(error, fallback, t = null) {
  if (error?.status === 403) return t ? t('chat.forbidden') : 'Bạn không có quyền truy cập nội dung này.'
  return error?.message || fallback
}
