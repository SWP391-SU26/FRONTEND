/* eslint-disable react-hooks/set-state-in-effect -- request-bound resets prevent stale course/session data */
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  Clipboard,
  ExternalLink,
  FileText,
  Files,
  FolderLock,
  History,
  Library,
  Loader2,
  Menu,
  MessageSquare,
  NotebookPen,
  PanelRight,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, IconButton, StatusBadge } from '../components/ui.jsx'
import {
  askQuestion,
  createSession,
  deleteSession,
  getMessages,
  getNotes,
  getSessions,
  saveNote,
} from '../services/chatService.js'
import { getCourseMaterials, getLearningScope } from '../services/courseService.js'
import { getMyDocuments } from '../services/documentService.js'
import { cn } from '../utils/cn.js'

const EMPTY_MATERIALS = { chapters: [], unclassifiedMaterials: [] }

export default function WorkspacePage() {
  const navigate = useNavigate()
  const [semesters, setSemesters] = useState([])
  const [semesterId, setSemesterId] = useState('')
  const [courseId, setCourseId] = useState('')
  const [scopeType, setScopeType] = useState('COURSE')
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([])
  const [personalDocuments, setPersonalDocuments] = useState([])
  const [sessions, setSessions] = useState([])
  const [session, setSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [materials, setMaterials] = useState(EMPTY_MATERIALS)
  const [notes, setNotes] = useState([])
  const [sidebarTab, setSidebarTab] = useState('history')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState(null)
  const [activeCitation, setActiveCitation] = useState(null)
  const [noteDraft, setNoteDraft] = useState(null)
  const [input, setInput] = useState('')
  const [chatMode, setChatMode] = useState('rag')
  const [loadingScope, setLoadingScope] = useState(true)
  const [loadingCourse, setLoadingCourse] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [answering, setAnswering] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [copiedId, setCopiedId] = useState('')
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)
  const courseRequestRef = useRef(0)
  const messageRequestRef = useRef(0)

  const semester = useMemo(
    () => semesters.find((item) => String(item.semesterId) === String(semesterId)) ?? null,
    [semesters, semesterId],
  )
  const courses = useMemo(() => semester?.courses ?? [], [semester])
  const course = useMemo(
    () => courses.find((item) => String(item.courseId) === String(courseId)) ?? null,
    [courses, courseId],
  )
  const courseWorkspaceId = course?.workspaceId ?? ''
  const scopeValid = scopeType === 'PERSONAL'
    ? selectedDocumentIds.length > 0
    : scopeType === 'SEMESTER'
    ? Boolean(semester?.courses?.some((item) => item.processedDocumentCount > 0))
    : scopeType === 'DOCUMENTS'
      ? Boolean(course && selectedDocumentIds.length)
      : Boolean(course?.processedDocumentCount)
  const activeScopeLabel = session?.scopeLabel || buildScopeLabel(scopeType, semester, course, selectedDocumentIds.length)

  useEffect(() => {
    let mounted = true
    setLoadingScope(true)
    Promise.all([getLearningScope(), getMyDocuments()])
      .then(([items, myDocuments]) => {
        if (!mounted) return
        const next = Array.isArray(items) ? items : []
        setSemesters(next)
        const firstSemester = next[0]
        setSemesterId(firstSemester?.semesterId ?? '')
        setCourseId(firstSemester?.courses?.[0]?.courseId ?? '')
        setPersonalDocuments((myDocuments ?? []).filter((document) => document.status === 'Processed'))
      })
      .catch((requestError) => mounted && setError(readError(requestError, 'Không thể tải phạm vi học tập.')))
      .finally(() => mounted && setLoadingScope(false))
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (scopeType !== 'PERSONAL' && !semesterId) {
      setSessions([])
      return undefined
    }

    let mounted = true
    getSessions(scopeType === 'PERSONAL' ? { scopeType: 'PERSONAL' } : { semesterId })
      .then((items) => mounted && setSessions(items))
      .catch((requestError) => mounted && setError(readError(requestError, 'Không thể tải lịch sử trò chuyện.')))
    return () => { mounted = false }
  }, [scopeType, semesterId])

  useEffect(() => {
    if (scopeType === 'PERSONAL') {
      setMaterials(EMPTY_MATERIALS)
      const workspaceId = session?.workspaceId || personalDocuments.find((document) => selectedDocumentIds.includes(document.id))?.workspaceId
      if (!workspaceId) {
        setNotes([])
        return undefined
      }
      let mounted = true
      getNotes(workspaceId).then((items) => mounted && setNotes(Array.isArray(items) ? items : [])).catch(() => mounted && setNotes([]))
      return () => { mounted = false }
    }
    if (!courseId || !courseWorkspaceId) {
      setMaterials(EMPTY_MATERIALS)
      setNotes([])
      return undefined
    }

    const requestId = ++courseRequestRef.current
    setLoadingCourse(true)
    setError('')

    Promise.all([
      getCourseMaterials(courseId),
      courseWorkspaceId ? getNotes(courseWorkspaceId) : Promise.resolve([]),
    ])
      .then(([nextMaterials, nextNotes]) => {
        if (requestId !== courseRequestRef.current) return
        setMaterials(nextMaterials ?? EMPTY_MATERIALS)
        setNotes(Array.isArray(nextNotes) ? nextNotes : [])
      })
      .catch((requestError) => {
        if (requestId === courseRequestRef.current) setError(readError(requestError, 'Không thể tải dữ liệu môn học.'))
      })
      .finally(() => {
        if (requestId === courseRequestRef.current) setLoadingCourse(false)
      })
  }, [courseId, courseWorkspaceId, scopeType, session?.workspaceId, personalDocuments, selectedDocumentIds])

  useEffect(() => {
    if (!session?.id) {
      setMessages([])
      return undefined
    }
    const requestId = ++messageRequestRef.current
    setLoadingMessages(true)
    getMessages(session.id)
      .then((items) => {
        if (requestId === messageRequestRef.current) setMessages(items)
      })
      .catch((requestError) => {
        if (requestId === messageRequestRef.current) setError(readError(requestError, 'Không thể tải cuộc trò chuyện.'))
      })
      .finally(() => {
        if (requestId === messageRequestRef.current) setLoadingMessages(false)
      })
  }, [session?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, answering])

  function changeSemester(nextSemesterId) {
    const nextSemester = semesters.find((item) => String(item.semesterId) === String(nextSemesterId))
    setSemesterId(nextSemesterId)
    setCourseId(nextSemester?.courses?.[0]?.courseId ?? '')
    setScopeType('COURSE')
    setSelectedDocumentIds([])
    setSession(null)
    setMessages([])
  }

  function changeCourse(nextCourseId) {
    setCourseId(nextCourseId)
    setSelectedDocumentIds([])
  }

  function changeScope(nextScopeType) {
    if (session) return
    setScopeType(nextScopeType)
    setSelectedDocumentIds([])
    if (['DOCUMENTS', 'PERSONAL'].includes(nextScopeType)) setSidebarTab('materials')
  }

  function toggleDocument(documentId) {
    if (session || !['DOCUMENTS', 'PERSONAL'].includes(scopeType)) return
    setSelectedDocumentIds((current) => current.includes(documentId)
      ? current.filter((id) => id !== documentId)
      : [...current, documentId])
  }

  function startNewChat() {
    setSession(null)
    setMessages([])
    setScopeType('COURSE')
    setSelectedDocumentIds([])
    setInput('')
    setActiveCitation(null)
    setDrawerMode(null)
  }

  async function selectSession(nextSession) {
    setSidebarOpen(false)
    setActiveCitation(null)
    setDrawerMode(null)
    setScopeType(nextSession.scopeType ?? 'COURSE')
    setSelectedDocumentIds(nextSession.documentIds ?? [])
    if (nextSession.courseId) setCourseId(nextSession.courseId)
    setSession(nextSession)
  }

  async function removeSession(event, item) {
    event.stopPropagation()
    if (deletingId) return
    setDeletingId(item.id)
    setError('')
    try {
      await deleteSession(item.id)
      const nextSessions = sessions.filter((candidate) => candidate.id !== item.id)
      setSessions(nextSessions)
      if (session?.id === item.id) {
        if (nextSessions[0]) {
          await selectSession(nextSessions[0])
        } else {
          startNewChat()
        }
      }
    } catch (requestError) {
      setError(readError(requestError, 'Không thể xóa cuộc trò chuyện.'))
    } finally {
      setDeletingId('')
    }
  }

  async function submit(event) {
    event?.preventDefault()
    const question = input.trim()
    if (!question || !scopeValid || answering) return

    setInput('')
    setError('')
    setAnswering(true)
    const optimisticUser = { id: `pending-${Date.now()}`, role: 'user', content: question, citations: [] }
    setMessages((current) => [...current, optimisticUser])

    try {
      let activeSession = session
      if (!activeSession) {
        activeSession = await createSession({
          scopeType,
          semesterId: scopeType === 'PERSONAL' ? null : semesterId,
          courseId: ['SEMESTER', 'PERSONAL'].includes(scopeType) ? null : course?.courseId,
          documentIds: ['DOCUMENTS', 'PERSONAL'].includes(scopeType) ? selectedDocumentIds : [],
        })
        setSessions((current) => [activeSession, ...current])
      }
      const answer = await askQuestion(activeSession.id, question, { mode: chatMode })
      setMessages((current) => [
        ...current,
        {
          id: answer.assistantMessageId ?? `answer-${Date.now()}`,
          role: 'assistant',
          content: answer.answer ?? '',
          citations: answer.citations ?? [],
          generationMode: answer.generationMode,
        },
      ])
      const refreshed = await getSessions(scopeType === 'PERSONAL' ? { scopeType: 'PERSONAL' } : { semesterId })
      setSessions(refreshed)
      const refreshedActive = refreshed.find((item) => item.id === activeSession.id)
      setSession(refreshedActive ?? activeSession)
    } catch (requestError) {
      setMessages((current) => current.filter((message) => message.id !== optimisticUser.id))
      setInput(question)
      setError(readError(requestError, 'AI chưa phản hồi. Bạn có thể thử gửi lại.'))
    } finally {
      setAnswering(false)
    }
  }

  async function copyMessage(message) {
    await navigator.clipboard.writeText(message.content)
    setCopiedId(message.id)
    window.setTimeout(() => setCopiedId(''), 1600)
  }

  function prepareNote(message) {
    setNoteDraft({
      noteTitle: session?.title && session.title !== 'New conversation' ? session.title : 'Ghi chú từ AI',
      noteContent: message.content,
    })
    setDrawerMode('notes')
  }

  async function submitNote(event) {
    event.preventDefault()
    const workspaceId = session?.workspaceId || (scopeType === 'PERSONAL'
      ? personalDocuments.find((document) => selectedDocumentIds.includes(document.id))?.workspaceId
      : course?.workspaceId)
    if (!noteDraft || !workspaceId || savingNote) return
    setSavingNote(true)
    try {
      const saved = await saveNote({ workspaceId, ...noteDraft })
      setNotes((current) => [saved, ...current])
      setNoteDraft(null)
    } catch (requestError) {
      setError(readError(requestError, 'Không thể lưu ghi chú.'))
    } finally {
      setSavingNote(false)
    }
  }

  if (loadingScope) {
    return <CenteredState icon={Loader2} title="Đang tải không gian học tập" spin />
  }

  if (!semesters.length) {
    return <CenteredState icon={BookOpen} title="Chưa có môn học khả dụng" description="Các môn đã được phân quyền sẽ xuất hiện tại đây." />
  }

  return (
    <div className="workspace-fixed-page relative min-h-0 px-3 pb-3 sm:px-5">
      <div className="grid h-full min-h-0 overflow-hidden rounded-[24px] border border-white/80 bg-white/70 shadow-[0_24px_70px_rgba(15,118,110,.12)] backdrop-blur-2xl lg:grid-cols-[288px_minmax(0,1fr)]">
        <Sidebar
          activeSessionId={session?.id}
          deletingId={deletingId}
          materials={materials}
          personalDocuments={personalDocuments}
          courses={courses}
          scopeType={scopeType}
          selectedDocumentIds={selectedDocumentIds}
          navigate={navigate}
          onClose={() => setSidebarOpen(false)}
          onDelete={removeSession}
          onSelectSession={selectSession}
          onToggleDocument={toggleDocument}
          open={sidebarOpen}
          sessions={sessions}
          setTab={setSidebarTab}
          tab={sidebarTab}
        />

        <main className="flex min-h-0 min-w-0 flex-col bg-white/65">
          <header className="flex flex-col gap-3 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-xl xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <IconButton className="lg:hidden" label="Mở thanh bên" onClick={() => setSidebarOpen(true)}>
                <Menu size={19} />
              </IconButton>
              <ScopeModeControl disabled={Boolean(session)} onChange={changeScope} value={scopeType} />
              {scopeType !== 'PERSONAL' ? <ScopeSelect disabled={Boolean(session)} label="Học kỳ" value={semesterId} onChange={(event) => changeSemester(event.target.value)}>
                {semesters.map((item) => <option key={item.semesterId} value={item.semesterId}>{item.semesterName}</option>)}
              </ScopeSelect> : null}
              {!['SEMESTER', 'PERSONAL'].includes(scopeType) ? <ChevronRight className="hidden shrink-0 text-slate-300 sm:block" size={18} /> : null}
              {!['SEMESTER', 'PERSONAL'].includes(scopeType) ? (
                <ScopeSelect disabled={Boolean(session)} label="Môn học" value={courseId} onChange={(event) => changeCourse(event.target.value)}>
                  {courses.map((item) => <option key={item.courseId} value={item.courseId}>{item.courseCode} · {item.courseName}</option>)}
                </ScopeSelect>
              ) : null}
              {!['SEMESTER', 'PERSONAL'].includes(scopeType) && course ? (
                <div className="hidden shrink-0 items-center gap-2 2xl:flex">
                  <StatusBadge status={titleCase(course.status)} />
                  <span className="text-xs font-bold text-slate-500">{course.processedDocumentCount} tài liệu đã xử lý</span>
                </div>
              ) : null}
            </div>
            <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5 self-stretch xl:self-auto">
              <Button aria-label="Chat mới" size="sm" variant="secondary" onClick={startNewChat}><Plus size={16} /><span className="hidden sm:inline">Chat mới</span></Button>
              <Button aria-label="Nguồn" size="sm" variant="ghost" onClick={() => setDrawerMode('sources')}><PanelRight size={16} /><span className="hidden sm:inline">Nguồn</span></Button>
              <Button aria-label="Ghi chú" disabled={scopeType === 'SEMESTER'} size="sm" variant="ghost" onClick={() => setDrawerMode('notes')}><NotebookPen size={16} /><span className="hidden sm:inline">Ghi chú</span></Button>
            </div>
          </header>

          <div className="grid min-h-10 grid-cols-1 items-center gap-2 border-b border-slate-100 px-4 py-2 text-xs font-semibold text-slate-500 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {session ? <span className="inline-flex items-center gap-1 text-primary"><Check size={14} />Phạm vi đã cố định</span> : null}
              <span className="max-w-full break-words font-bold text-slate-700">{activeScopeLabel}</span>
            </div>
            <ChatModeToggle disabled={answering} onChange={setChatMode} value={chatMode} />
            <div className="hidden sm:block" aria-hidden="true" />
            {!scopeValid ? <span className="whitespace-normal text-amber-700 sm:col-span-3">{['DOCUMENTS', 'PERSONAL'].includes(scopeType) ? 'Chọn ít nhất một tài liệu đã xử lý.' : 'Phạm vi chưa có tài liệu khả dụng.'}</span> : null}
          </div>

          {error ? (
            <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">
              <AlertCircle className="mt-0.5 shrink-0" size={16} />
              <span className="flex-1">{error}</span>
              <IconButton className="size-7 text-red-600" label="Đóng thông báo" onClick={() => setError('')}><X size={15} /></IconButton>
            </div>
          ) : null}

          <section className="min-h-0 flex-1 overflow-y-auto" aria-label="Nội dung trò chuyện">
            <div className="mx-auto flex min-h-full w-full max-w-[800px] flex-col px-4 py-8 sm:px-8">
              {loadingCourse || loadingMessages ? (
                <InlineLoading label="Đang tải cuộc trò chuyện" />
              ) : messages.length ? (
                <div className="space-y-7">
                  {messages.map((message, index) => (
                    <ChatMessage
                      copied={copiedId === message.id}
                      key={message.id ?? index}
                      message={message}
                      onCitation={(citation) => { setActiveCitation(citation); setDrawerMode('sources') }}
                      onCopy={() => copyMessage(message)}
                      onSave={() => prepareNote(message)}
                    />
                  ))}
                  {answering ? <AssistantThinking /> : null}
                </div>
              ) : (
                <div className="grid flex-1 place-items-center py-16 text-center">
                  <div className="max-w-full px-3 sm:max-w-md">
                    <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-teal-50 text-primary"><Bot size={25} /></div>
                    <h1 className="mt-4 break-words text-xl font-black text-slate-950">Hỏi từ {activeScopeLabel}</h1>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-500">Câu trả lời sẽ dùng các tài liệu đã xử lý và kèm nguồn để bạn kiểm tra.</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </section>

          <form className="sticky bottom-0 border-t border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-xl" onSubmit={submit}>
            <div className="mx-auto max-w-[800px] rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_12px_36px_rgba(15,23,42,.08)] focus-within:border-teal-400 focus-within:ring-4 focus-within:ring-teal-100">
              <div className="flex items-end gap-2">
              <textarea
                aria-label="Câu hỏi"
                className="max-h-40 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                disabled={!scopeValid || answering}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() }
                }}
                placeholder={scopeValid ? 'Hỏi về nội dung trong phạm vi đã chọn…' : 'Chọn phạm vi tài liệu trước khi hỏi'}
                rows={1}
                value={input}
              />
              <Button aria-label="Gửi câu hỏi" disabled={!input.trim() || !scopeValid || answering} size="icon" type="submit">
                {answering ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              </Button>
              </div>
            </div>
            <p className="mx-auto mt-1.5 max-w-[800px] px-2 text-[11px] font-medium text-slate-400">Enter để gửi · Shift + Enter để xuống dòng</p>
          </form>
        </main>
      </div>

      <DetailDrawer
        activeCitation={activeCitation}
        mode={drawerMode}
        noteDraft={noteDraft}
        notes={notes}
        onClose={() => { setDrawerMode(null); setNoteDraft(null) }}
        onDraftChange={setNoteDraft}
        onSaveNote={submitNote}
        savingNote={savingNote}
      />
    </div>
  )
}

function Sidebar({ activeSessionId, courses, deletingId, materials, personalDocuments, navigate, onClose, onDelete,
  onSelectSession, onToggleDocument, open, scopeType, selectedDocumentIds, sessions, setTab, tab }) {
  const content = (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200/80 bg-slate-50/80">
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[.16em] text-primary">Course chat</p>
          <h2 className="text-lg font-black text-slate-950">Học tập</h2>
        </div>
        <IconButton className="lg:hidden" label="Đóng thanh bên" onClick={onClose}><X size={18} /></IconButton>
      </div>
      <div className="mx-3 grid grid-cols-2 rounded-xl bg-slate-200/70 p-1">
        <SidebarTab active={tab === 'history'} icon={History} label="Lịch sử" onClick={() => setTab('history')} />
        <SidebarTab active={tab === 'materials'} icon={Library} label="Tài liệu" onClick={() => setTab('materials')} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'history' ? (
          sessions.length ? <div className="space-y-1.5">{sessions.map((item) => (
            <button
              className={cn('group flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition', activeSessionId === item.id ? 'border-teal-200 bg-white text-slate-950 shadow-sm' : 'border-transparent text-slate-600 hover:bg-white')}
              key={item.id}
              onClick={() => onSelectSession(item)}
              type="button"
            >
              <MessageSquare className="shrink-0 text-primary" size={16} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{item.title || 'Cuộc trò chuyện mới'}</span>
                <span className="block truncate text-[11px] font-semibold text-slate-400">{item.scopeLabel || 'Môn học'} · {formatDate(item.updatedAt)}</span>
              </span>
              <span
                aria-label="Xóa cuộc trò chuyện"
                className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus:opacity-100"
                onClick={(event) => onDelete(event, item)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onDelete(event, item) }}
                role="button"
                tabIndex={0}
              >
                {deletingId === item.id ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
              </span>
            </button>
          ))}</div> : <SidebarEmpty icon={History} text="Chưa có cuộc trò chuyện." />
        ) : (
          scopeType === 'PERSONAL'
            ? <PersonalMaterialsList documents={personalDocuments} onToggle={onToggleDocument} selectedDocumentIds={selectedDocumentIds} selectable={!activeSessionId} />
            : scopeType === 'SEMESTER'
            ? <SemesterMaterials courses={courses} />
            : <MaterialsList
                materials={materials}
                onOpen={(documentId) => { onClose(); navigate(`/library/documents/${documentId}`) }}
                onToggle={onToggleDocument}
                selectedDocumentIds={selectedDocumentIds}
                selectable={scopeType === 'DOCUMENTS' && !activeSessionId}
              />
        )}
      </div>
    </aside>
  )

  return (
    <>
      <div className="hidden min-h-0 lg:block">{content}</div>
      <AnimatePresence>
        {open ? (
          <motion.div className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
            <motion.div className="h-full w-[min(88vw,320px)]" initial={{ x: -330 }} animate={{ x: 0 }} exit={{ x: -330 }} transition={{ type: 'spring', stiffness: 350, damping: 34 }}>{content}</motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

function MaterialsList({ materials, onOpen, onToggle, selectable, selectedDocumentIds }) {
  const documents = deduplicateMaterials(materials)
  if (!documents.length) return <SidebarEmpty icon={FileText} text="Chưa có tài liệu trong môn học." />
  return (
    <div className="space-y-1">
      {selectable ? <p className="px-2 pb-2 text-xs font-bold text-slate-500">Đã chọn {selectedDocumentIds.length}/{documents.length} tài liệu</p> : null}
      {documents.map((material) => (
        <MaterialButton
          key={material.documentId}
          material={material}
          onOpen={onOpen}
          onToggle={onToggle}
          selectable={selectable}
          selected={selectedDocumentIds.includes(material.documentId)}
        />
      ))}
    </div>
  )
}

function PersonalMaterialsList({ documents, onToggle, selectable, selectedDocumentIds }) {
  if (!documents.length) return <SidebarEmpty icon={FolderLock} text="Chưa có tài liệu cá nhân đã xử lý." />
  return (
    <div className="space-y-1">
      {selectable ? <p className="px-2 pb-2 text-xs font-bold text-slate-500">Đã chọn {selectedDocumentIds.length}/{documents.length} tài liệu</p> : null}
      {documents.map((document) => (
        <MaterialButton
          key={document.id}
          material={{
            documentId: document.id,
            documentTitle: document.displayName,
            originalFilename: document.name,
            processingStatus: 'PROCESSED',
            totalPages: document.pages,
          }}
          onOpen={() => window.location.assign(`/library/documents/${document.id}`)}
          onToggle={onToggle}
          selectable={selectable}
          selected={selectedDocumentIds.includes(document.id)}
        />
      ))}
    </div>
  )
}

function MaterialButton({ material, onOpen, onToggle, selectable, selected }) {
  return (
    <div className={cn('flex w-full items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition', selected ? 'border-teal-200 bg-white' : 'border-transparent hover:border-slate-200 hover:bg-white')}>
      {selectable ? (
        <input
          aria-label={`Chọn ${material.documentTitle || material.originalFilename}`}
          checked={selected}
          className="mt-1 size-4 accent-teal-600"
          onChange={() => onToggle(material.documentId)}
          type="checkbox"
        />
      ) : <FileText className="mt-0.5 shrink-0 text-primary" size={15} />}
      <button className="min-w-0 flex-1 text-left" onClick={() => selectable && onToggle(material.documentId)} type="button">
        <span className="block truncate text-xs font-bold text-slate-700">{material.documentTitle || material.originalFilename}</span>
        <span className="block text-[11px] font-semibold text-slate-400">{material.totalPages ? `${material.totalPages} trang` : pageRange(material)} · {titleCase(material.processingStatus)}</span>
      </button>
      <IconButton className="size-7 shrink-0" label="Mở tài liệu" onClick={() => onOpen(material.documentId)}><ExternalLink size={13} /></IconButton>
    </div>
  )
}

function SemesterMaterials({ courses }) {
  if (!courses.length) return <SidebarEmpty icon={Files} text="Học kỳ chưa có tài liệu khả dụng." />
  return <div className="space-y-1.5">{courses.map((course) => (
    <div className="flex items-center gap-2 rounded-xl border border-transparent px-2.5 py-2.5 hover:border-slate-200 hover:bg-white" key={course.courseId}>
      <BookOpen className="shrink-0 text-primary" size={15} />
      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-slate-700">{course.courseCode} · {course.courseName}</span><span className="text-[11px] font-semibold text-slate-400">{course.processedDocumentCount} tài liệu đã xử lý</span></span>
    </div>
  ))}</div>
}

function ChatMessage({ copied, message, onCitation, onCopy, onSave }) {
  const assistant = message.role === 'assistant'
  return (
    <article className={cn('flex gap-3', assistant ? 'items-start' : 'justify-end')}>
      {assistant ? <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-white"><Bot size={17} /></div> : null}
      <div className={cn('min-w-0', assistant ? 'w-full' : 'max-w-[82%]')}>
        <div className={cn('whitespace-pre-wrap text-sm font-medium leading-7', assistant ? 'text-slate-800' : 'rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-white shadow-sm')}>
          {message.content}
        </div>
        {assistant ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {message.generationMode ? <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-500">{generationLabel(message.generationMode)}</span> : null}
            {(message.citations ?? []).map((citation, index) => (
              <button className="inline-flex max-w-full items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-bold text-primary transition hover:bg-teal-100" key={citation.id ?? `${message.id}-${index}`} onClick={() => onCitation(citation)} type="button">
                <BookOpen size={12} /><span className="truncate">{citation.documentTitle || `Nguồn ${index + 1}`}</span>{citation.pageStart ? ` · tr. ${citation.pageStart}` : ''}
              </button>
            ))}
            <IconButton className="size-7" label="Sao chép câu trả lời" onClick={onCopy}>{copied ? <Check size={14} /> : <Clipboard size={14} />}</IconButton>
            <IconButton className="size-7" label="Lưu ghi chú" onClick={onSave}><Save size={14} /></IconButton>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function DetailDrawer({ activeCitation, mode, noteDraft, notes, onClose, onDraftChange, onSaveNote, savingNote }) {
  return (
    <AnimatePresence>
      {mode ? (
        <motion.div className="fixed inset-0 z-50 bg-slate-950/25 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
          <motion.aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/70 bg-white shadow-2xl sm:w-[420px]" initial={{ x: 440 }} animate={{ x: 0 }} exit={{ x: 440 }} transition={{ type: 'spring', stiffness: 350, damping: 34 }}>
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                {mode === 'sources' ? <BookOpen className="text-primary" size={20} /> : <NotebookPen className="text-primary" size={20} />}
                <h2 className="text-lg font-black text-slate-950">{mode === 'sources' ? 'Nguồn trích dẫn' : 'Ghi chú học tập'}</h2>
              </div>
              <IconButton label="Đóng" onClick={onClose}><X size={18} /></IconButton>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {mode === 'sources' ? <SourceDetail citation={activeCitation} /> : (
                <div className="space-y-5">
                  {noteDraft ? (
                    <form className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4" onSubmit={onSaveNote}>
                      <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Tiêu đề</label>
                      <input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100" onChange={(event) => onDraftChange({ ...noteDraft, noteTitle: event.target.value })} value={noteDraft.noteTitle} />
                      <label className="mt-3 block text-xs font-black uppercase tracking-wide text-slate-500">Nội dung</label>
                      <textarea className="mt-1 min-h-40 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium leading-6 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100" onChange={(event) => onDraftChange({ ...noteDraft, noteContent: event.target.value })} value={noteDraft.noteContent} />
                      <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="ghost" type="button" onClick={() => onDraftChange(null)}>Hủy</Button><Button disabled={savingNote || !noteDraft.noteContent.trim()} size="sm" type="submit">{savingNote ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}Lưu</Button></div>
                    </form>
                  ) : null}
                  {notes.length ? notes.map((note) => (
                    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={note.noteId ?? note.id}>
                      <h3 className="font-black text-slate-900">{note.noteTitle}</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-600">{note.noteContent}</p>
                      <p className="mt-3 text-[11px] font-semibold text-slate-400">{formatDate(note.createdAt)}</p>
                    </article>
                  )) : <SidebarEmpty icon={NotebookPen} text="Chưa có ghi chú trong môn học." />}
                </div>
              )}
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function SourceDetail({ citation }) {
  if (!citation) return <SidebarEmpty icon={BookOpen} text="Chọn một thẻ nguồn dưới câu trả lời để xem chi tiết." />
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-primary">{citation.documentTitle || 'Tài liệu nguồn'}</p>
      <p className="mt-1 text-sm font-bold text-slate-500">{citation.pageStart ? `Trang ${citation.pageStart}${citation.pageEnd && citation.pageEnd !== citation.pageStart ? `–${citation.pageEnd}` : ''}` : 'Không có thông tin trang'}</p>
      <blockquote className="mt-4 border-l-2 border-teal-400 pl-4 text-sm font-medium italic leading-7 text-slate-700">{citation.quoteText || 'Không có đoạn trích xem trước.'}</blockquote>
    </article>
  )
}

function ScopeSelect({ children, label, ...props }) {
  return (
    <label className="min-w-0 flex-1 sm:flex-none">
      <span className="sr-only">{label}</span>
      <select className="h-10 w-full max-w-[290px] truncate rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100" {...props}>{children}</select>
    </label>
  )
}

function ChatModeToggle({ disabled, onChange, value }) {
  const modes = [
    { value: 'rag', label: 'RAG', icon: BookOpen },
    { value: 'fine_tuning', label: 'Fine-tuning', icon: Bot },
  ]
  return (
    <div className="mx-auto flex h-9 shrink-0 items-center rounded-xl bg-slate-100 p-1 shadow-inner shadow-slate-200/60" aria-label="AI model">
      {modes.map(({ value: mode, label, icon: Icon }) => (
        <button
          aria-pressed={value === mode}
          className={cn(
            'relative isolate flex h-7 items-center gap-1.5 overflow-hidden rounded-lg px-2.5 text-xs font-black transition-colors sm:px-3',
            value === mode ? 'text-primary' : 'text-slate-500 hover:text-slate-800',
            disabled && 'cursor-not-allowed opacity-70',
          )}
          disabled={disabled}
          key={mode}
          onClick={() => onChange(mode)}
          type="button"
        >
          {value === mode ? (
            <motion.span
              className="absolute inset-0 -z-10 rounded-lg bg-white shadow-sm"
              layoutId="chat-mode-active"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          ) : null}
          <motion.span
            animate={{ scale: value === mode ? 1.08 : 1 }}
            className="grid place-items-center"
            transition={{ type: 'spring', stiffness: 380, damping: 24 }}
          >
            <Icon size={13} />
          </motion.span>
          <span className="relative">{label}</span>
        </button>
      ))}
    </div>
  )
}

function ScopeModeControl({ disabled, onChange, value }) {
  const modes = [
    { value: 'PERSONAL', label: 'Cá nhân', icon: FolderLock },
    { value: 'DOCUMENTS', label: 'Tài liệu', icon: FileText },
    { value: 'COURSE', label: 'Môn học', icon: BookOpen },
    { value: 'SEMESTER', label: 'Học kỳ', icon: Files },
  ]
  return (
    <div className="flex h-10 shrink-0 items-center rounded-xl bg-slate-100 p-1" aria-label="Phạm vi trả lời">
      {modes.map(({ value: mode, label, icon: Icon }) => (
        <button
          aria-label={label}
          className={cn('flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-black transition', value === mode ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800', disabled && 'cursor-not-allowed opacity-70')}
          disabled={disabled}
          key={mode}
          onClick={() => onChange(mode)}
          type="button"
        >
          <Icon size={13} /><span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}

function SidebarTab({ active, icon: Icon, label, onClick }) {
  return <button className={cn('flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-black transition', active ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800')} onClick={onClick} type="button"><Icon size={14} />{label}</button>
}

function SidebarEmpty({ icon: Icon, text }) {
  return <div className="grid place-items-center px-4 py-12 text-center"><Icon className="text-slate-300" size={25} /><p className="mt-2 text-xs font-bold leading-5 text-slate-400">{text}</p></div>
}

function CenteredState({ description, icon: Icon, spin, title }) {
  return <div className="grid min-h-[60vh] place-items-center px-4 text-center"><div><Icon className={cn('mx-auto text-primary', spin && 'animate-spin')} size={30} /><h1 className="mt-3 text-xl font-black text-slate-950">{title}</h1>{description ? <p className="mt-2 text-sm font-medium text-slate-500">{description}</p> : null}</div></div>
}

function InlineLoading({ label }) {
  return <div className="grid flex-1 place-items-center py-16 text-sm font-bold text-slate-400"><span className="flex items-center gap-2"><Loader2 className="animate-spin text-primary" size={18} />{label}</span></div>
}

function AssistantThinking() {
  return <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-primary text-white"><Bot size={17} /></div><div className="flex gap-1 rounded-xl bg-slate-100 px-4 py-3"><span className="size-1.5 animate-bounce rounded-full bg-slate-400" /><span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" /><span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" /></div></div>
}

function pageRange(material) {
  if (material.pageStart && material.pageEnd) return material.pageStart === material.pageEnd ? `Trang ${material.pageStart}` : `Trang ${material.pageStart}–${material.pageEnd}`
  if (material.totalPages) return `${material.totalPages} trang`
  return 'Chưa có trang'
}

function deduplicateMaterials(materials) {
  const byId = new Map()
  const all = [
    ...(materials?.chapters ?? []).flatMap((chapter) => chapter.materials ?? []),
    ...(materials?.unclassifiedMaterials ?? []),
  ]
  all.forEach((material) => {
    if (!material?.documentId || material.processingStatus !== 'PROCESSED') return
    const current = byId.get(material.documentId)
    if (!current) byId.set(material.documentId, { ...material })
    else byId.set(material.documentId, { ...current, totalPages: Math.max(current.totalPages ?? 0, material.totalPages ?? 0) || null })
  })
  return [...byId.values()]
}

function buildScopeLabel(scopeType, semester, course, selectedCount) {
  if (scopeType === 'PERSONAL') return `${selectedCount} tài liệu cá nhân`
  if (scopeType === 'SEMESTER') return semester?.semesterName || 'Học kỳ'
  const courseLabel = course ? `${course.courseCode} · ${course.courseName}` : 'Môn học'
  return scopeType === 'DOCUMENTS' ? `${selectedCount} tài liệu · ${courseLabel}` : courseLabel
}

function generationLabel(mode) {
  if (mode === 'GREETING') return 'Chào hỏi'
  if (mode === 'LOCAL_FALLBACK') return 'RAG dự phòng'
  if (mode === 'FINE_TUNED') return 'Fine-tuned'
  return 'RAG local'
}

function formatDate(value) {
  if (!value) return 'Vừa tạo'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Vừa tạo'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)
}

function titleCase(value) {
  const text = String(value ?? '').toLowerCase()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Unknown'
}

function readError(error, fallback) {
  if (error?.status === 403) return 'Bạn không còn quyền truy cập môn học hoặc học kỳ này.'
  return error?.message || fallback
}
