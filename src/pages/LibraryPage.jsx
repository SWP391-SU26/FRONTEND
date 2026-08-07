/* eslint-disable react-hooks/set-state-in-effect -- initial request state is owned by this page */
import {
  BookOpen, CalendarDays, Check, ChevronRight, Clock3, Eye, File,
  FileSpreadsheet, FileText, FileType2, Folder, FolderInput, FolderLock, Grid2X2,
  HardDrive, Home, List as ListIcon, Loader2, MoreHorizontal, Presentation,
  RefreshCw, Search, Send, Trash2, Upload, UserRound, X, XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MoveDocumentModal } from '../components/MoveDocumentModal.jsx'
import { PersonalWorkspacePanel } from '../components/PersonalWorkspacePanel.jsx'
import StudentShell from '../components/StudentShell.jsx'
import { Button, ConfirmModal, EmptyState, IconButton, SelectField } from '../components/ui.jsx'
import { getCurrentUserId } from '../services/authService.js'
import { getLearningScope } from '../services/courseService.js'
import {
  cancelDocumentSubmission, getDocuments, getMyDocuments, submitDocument,
} from '../services/documentService.js'
import { deleteFile, uploadPersonalFiles } from '../services/uploadService.js'
import { moveDocumentToWorkspace } from '../services/workspaceService.js'
import { cn } from '../utils/cn.js'
import { useLocale } from '../i18n/LocaleContext.jsx'
import { localizeApiError } from '../i18n/apiErrorCopy.js'
import {
  buildLibraryHierarchy, searchLibraryDocuments, sortLibraryDocuments,
} from './libraryModel.js'

const ACCEPTED_TYPES = ['pdf', 'docx', 'pptx']
const VIEW_STORAGE_KEY = 'fstu.library.view'

const libraryCopy = {
  vi: {
    title: 'Thư viện', invalidFile: 'Chỉ nhận tệp PDF, DOCX hoặc PPTX. Hạn mức kích thước được kiểm tra theo gói hiện tại của bạn.', uploaded: (count) => `Đã tải lên ${count} tài liệu vào Tài liệu của tôi.`, submitted: 'Đã gửi tài liệu để xét duyệt vào môn học.', cancelled: 'Đã hủy yêu cầu gửi tài liệu.', deleted: 'Đã xóa tài liệu.', moved: 'Đã chuyển tài liệu sang không gian khác.', searchResult: (query) => `Kết quả cho “${query}”`, myDocuments: 'Tài liệu của tôi', repository: 'Kho tài liệu', found: (count) => `${count} tài liệu được tìm thấy trong toàn bộ thư viện.`, uploading: 'Đang tải tài liệu...', upload: 'Tải tài liệu lên', retry: 'Thử lại', closeNotice: 'Đóng thông báo', searchLabel: 'Tìm toàn bộ thư viện', searchPlaceholder: 'Tìm theo tên, loại tệp, người đăng hoặc môn học', clearSearch: 'Xóa tìm kiếm', sort: 'Sắp xếp tài liệu', newest: 'Mới nhất', oldest: 'Cũ nhất', name: 'Tên A–Z', display: 'Kiểu hiển thị', grid: 'Dạng lưới', list: 'Dạng danh sách', personal: 'Cá nhân', you: 'Bạn', documents: 'tài liệu', noCourses: 'Học kỳ chưa có môn học', noCoursesBody: 'Các môn học được cấp quyền sẽ xuất hiện tại đây.', submitTitle: 'Gửi vào môn học', close: 'Đóng', course: 'Môn học', selectCourse: 'Chọn môn học', cancel: 'Hủy', submit: 'Gửi duyệt', deleteTitle: 'Xóa tài liệu?', deleteAction: 'Xóa', deleteBody: (name) => `“${name}” sẽ bị xóa khỏi Tài liệu của tôi.`, breadcrumb: 'Đường dẫn thư mục',
  },
  en: {
    title: 'Library', invalidFile: 'Only PDF, DOCX, and PPTX files are accepted. File-size limits follow your current plan.', uploaded: (count) => `Uploaded ${count} document(s) to My documents.`, submitted: 'Document submitted for course review.', cancelled: 'Document submission cancelled.', deleted: 'Document deleted.', moved: 'Document moved to another workspace.', searchResult: (query) => `Results for “${query}”`, myDocuments: 'My documents', repository: 'Document library', found: (count) => `${count} document(s) found across the library.`, uploading: 'Uploading documents...', upload: 'Upload documents', retry: 'Retry', closeNotice: 'Dismiss notification', searchLabel: 'Search the library', searchPlaceholder: 'Search by name, file type, uploader, or course', clearSearch: 'Clear search', sort: 'Sort documents', newest: 'Newest', oldest: 'Oldest', name: 'Name A–Z', display: 'Display style', grid: 'Grid view', list: 'List view', personal: 'Personal', you: 'You', documents: 'documents', noCourses: 'No courses in this semester', noCoursesBody: 'Courses you can access will appear here.', submitTitle: 'Submit to course', close: 'Close', course: 'Course', selectCourse: 'Select a course', cancel: 'Cancel', submit: 'Submit for review', deleteTitle: 'Delete document?', deleteAction: 'Delete', deleteBody: (name) => `“${name}” will be removed from My documents.`, breadcrumb: 'Folder breadcrumb',
  },
}

function useLibraryCopy() { const { locale } = useLocale(); return { c: libraryCopy[locale] ?? libraryCopy.vi, locale } }

export default function LibraryPage() {
  const { c } = useLibraryCopy()
  return (
    <StudentShell mobileTitle={c.title}>
      <LibraryContent />
    </StudentShell>
  )
}

function LibraryContent() {
  const { c, locale } = useLibraryCopy()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [mine, setMine] = useState([])
  const [shared, setShared] = useState([])
  const [scope, setScope] = useState([])
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [view, setView] = useState(() => localStorage.getItem(VIEW_STORAGE_KEY) || 'grid')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitTarget, setSubmitTarget] = useState(null)
  const [submitCourseId, setSubmitCourseId] = useState('')
  const [busyId, setBusyId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [moveTarget, setMoveTarget] = useState(null)
  // Bumped after any action that changes quota (upload, delete, move) so the
  // storage/workspace panel re-fetches instead of showing stale numbers.
  const [quotaRefreshSignal, setQuotaRefreshSignal] = useState(0)
  const refreshQuota = useCallback(() => setQuotaRefreshSignal((current) => current + 1), [])
  const fileInputRef = useRef(null)
  const currentUserId = getCurrentUserId()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [myDocuments, courseDocuments, learningScope] = await Promise.all([
        getMyDocuments(), getDocuments(), getLearningScope(),
      ])
      setMine(myDocuments)
      setShared(courseDocuments)
      setScope(Array.isArray(learningScope) ? learningScope : [])
    } catch (requestError) {
      setError(localizeApiError(requestError.message, locale))
    } finally {
      setLoading(false)
    }
  }, [locale])

  useEffect(() => { load() }, [load])

  const hierarchy = useMemo(
    () => buildLibraryHierarchy(scope, mine, shared),
    [scope, mine, shared],
  )
  const folder = searchParams.get('folder')
  const workspaceId = searchParams.get('workspace')
  const semesterId = searchParams.get('semester')
  const courseId = searchParams.get('course')
  const selectedSemester = hierarchy.semesters.find((semester) => semester.id === semesterId)
    ?? hierarchy.semesters.find((semester) => semester.courses.some((course) => course.id === courseId))
    ?? null
  const selectedCourse = selectedSemester?.courses.find((course) => course.id === courseId) ?? null
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === workspaceId) ?? null
  const location = courseId && selectedCourse
    ? 'course'
    : semesterId && selectedSemester
      ? 'semester'
      : folder === 'personal'
        ? workspaceId ? 'workspace' : 'personal'
        : 'root'
  const courses = hierarchy.semesters.flatMap((semester) =>
    semester.courses.map((course) => ({ ...course, semesterName: semester.name })))
  const searchedDocuments = useMemo(
    () => searchLibraryDocuments(hierarchy.allDocuments, hierarchy.documentLocations, query),
    [hierarchy, query],
  )
  const folderDocuments = location === 'workspace'
    ? hierarchy.personalDocuments.filter((document) => document.workspaceId === workspaceId)
    : location === 'course'
      ? selectedCourse.documents
      : []
  const workspaceDocumentCounts = useMemo(() => hierarchy.personalDocuments.reduce((counts, document) => {
    if (document.workspaceId) counts[document.workspaceId] = (counts[document.workspaceId] ?? 0) + 1
    return counts
  }, {}), [hierarchy.personalDocuments])
  const displayedDocuments = sortLibraryDocuments(
    query.trim() ? searchedDocuments : folderDocuments,
    sortBy,
  )

  function openRoot() {
    navigate('/library')
  }

  function openPersonal() {
    navigate('/library?folder=personal')
  }

  function openWorkspace(workspace) {
    navigate(`/library?folder=personal&workspace=${encodeURIComponent(workspace.id)}`)
  }

  function openSemester(id) {
    navigate(`/library?semester=${encodeURIComponent(id)}`)
  }

  function openCourse(id) {
    navigate(`/library?course=${encodeURIComponent(id)}`)
  }

  function changeView(nextView) {
    setView(nextView)
    localStorage.setItem(VIEW_STORAGE_KEY, nextView)
  }

  async function uploadFiles(event) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    const invalid = files.find((file) =>
      !ACCEPTED_TYPES.includes(file.name.split('.').pop()?.toLowerCase()))
    if (invalid) {
      setError(c.invalidFile)
      return
    }
    setUploading(true)
    setError('')
    setNotice('')
    try {
      const tasks = uploadPersonalFiles(files, workspaceId)
      const documents = await Promise.all(tasks.map((task) => task.promise))
      setMine((current) => [
        ...documents,
        ...current.filter((item) => !documents.some((document) => document.id === item.id)),
      ])
      setNotice(c.uploaded(files.length))
      refreshQuota()
      navigate(`/library?folder=personal&workspace=${encodeURIComponent(workspaceId)}`)
    } catch (requestError) {
      setError(localizeApiError(requestError.message, locale))
    } finally {
      setUploading(false)
    }
  }

  async function submit() {
    if (!submitTarget || !submitCourseId) return
    setBusyId(submitTarget.id)
    setError('')
    try {
      const updated = await submitDocument(submitTarget.id, submitCourseId)
      setMine((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item))
      setNotice(c.submitted)
      setSubmitTarget(null)
      setSubmitCourseId('')
    } catch (requestError) {
      setError(localizeApiError(requestError.message, locale))
    } finally {
      setBusyId('')
    }
  }

  async function cancelSubmission(document) {
    setBusyId(document.id)
    setError('')
    try {
      const updated = await cancelDocumentSubmission(document.id)
      setMine((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item))
      setNotice(c.cancelled)
    } catch (requestError) {
      setError(localizeApiError(requestError.message, locale))
    } finally {
      setBusyId('')
    }
  }

  async function removeDocument() {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    try {
      await deleteFile(deleteTarget)
      setMine((current) => current.filter((item) => item.id !== deleteTarget.id))
      setShared((current) => current.filter((item) => item.id !== deleteTarget.id))
      setNotice(c.deleted)
      setDeleteTarget(null)
      refreshQuota()
    } catch (requestError) {
      setError(localizeApiError(requestError.message, locale))
    } finally {
      setBusyId('')
    }
  }

  function prepareSubmit(document) {
    setSubmitTarget(document)
    setSubmitCourseId(document.targetCourseId ?? courses[0]?.id ?? '')
  }

  async function moveDocument(workspaceId) {
    await moveDocumentToWorkspace(moveTarget.id, workspaceId)
    setMine((current) => current.map((item) =>
      item.id === moveTarget.id ? { ...item, workspaceId } : item))
    setNotice(c.moved)
    setMoveTarget(null)
  }

  const breadcrumb = buildBreadcrumb(location, selectedSemester, selectedCourse, selectedWorkspace, c)
  const heading = query.trim()
    ? c.searchResult(query.trim())
    : location === 'workspace'
      ? selectedWorkspace?.title ?? c.myDocuments
      : location === 'personal'
      ? c.myDocuments
      : location === 'semester'
        ? selectedSemester.name
        : location === 'course'
          ? selectedCourse.label
          : c.repository

  return (
    <main className="library-page mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Breadcrumb items={breadcrumb} onRoot={openRoot} onPersonal={openPersonal} onSemester={openSemester} />
          <h1 className="mt-3 text-3xl font-black text-slate-950">{heading}</h1>
          <p className="mt-1 text-sm font-medium text-slate-600">
            {query.trim()
              ? c.found(displayedDocuments.length)
              : contextDescription(location, hierarchy, selectedSemester, selectedCourse, selectedWorkspace, folderDocuments.length, workspaces.length, locale)}
          </p>
        </div>
        {location === 'workspace' && selectedWorkspace ? (
          <Button disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? <Loader2 className="animate-spin" size={17} /> : <Upload size={17} />}
            {uploading ? c.uploading : c.upload}
          </Button>
        ) : null}
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          multiple
          accept=".pdf,.docx,.pptx"
          onChange={uploadFiles}
        />
      </header>

      {error ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <span>{error}</span>
          <Button size="sm" variant="danger" onClick={load}><RefreshCw size={15} />{c.retry}</Button>
        </div>
      ) : null}
      {notice ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <span>{notice}</span>
          <IconButton label={c.closeNotice} onClick={() => setNotice('')}><X size={16} /></IconButton>
        </div>
      ) : null}

      <section className="mt-5 flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <label className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-slate-500 focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-100 lg:max-w-xl">
          <Search size={17} />
          <span className="sr-only">{c.searchLabel}</span>
          <input
            className="w-full bg-transparent text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-500"
            placeholder={c.searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? <IconButton label={c.clearSearch} onClick={() => setQuery('')}><X size={15} /></IconButton> : null}
        </label>
        <div className="flex items-center gap-2">
          {(query.trim() || ['workspace', 'course'].includes(location)) ? (
            <>
              <SelectField label={c.sort} value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="newest">{c.newest}</option>
                <option value="oldest">{c.oldest}</option>
                <option value="name">{c.name}</option>
              </SelectField>
              <div className="flex rounded-lg border border-slate-300 bg-white p-1" aria-label={c.display}>
                <ViewButton active={view === 'grid'} label={c.grid} onClick={() => changeView('grid')}><Grid2X2 size={16} /></ViewButton>
                <ViewButton active={view === 'list'} label={c.list} onClick={() => changeView('list')}><ListIcon size={17} /></ViewButton>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section className="mt-5" aria-live="polite">
        {loading ? <LibrarySkeleton /> : query.trim() ? (
          <DocumentCollection
            documents={displayedDocuments}
            locations={hierarchy.documentLocations}
            view={view}
            currentUserId={currentUserId}
            busyId={busyId}
            onCancel={cancelSubmission}
            onDelete={setDeleteTarget}
            onSubmit={prepareSubmit}
            navigate={navigate}
            searching
          />
        ) : location === 'root' ? (
          <FolderGrid>
            <FolderCard
              icon={FolderLock}
              title={c.myDocuments}
              code="PERSONAL"
              status={c.personal}
              creatorName={c.you}
              createdAt={latestDocumentDate(hierarchy.personalDocuments)}
              count={hierarchy.personalDocuments.length}
              countLabel={c.documents}
              tone="personal"
              onClick={openPersonal}
            />
            {hierarchy.semesters.map((semester) => (
              <FolderCard
                key={semester.id}
                icon={Folder}
                title={semester.name}
                code={semester.code}
                status={semester.status}
                creatorName={semester.creatorName}
                createdAt={semester.createdAt}
                count={semester.documentCount}
                countLabel={c.documents}
                onClick={() => openSemester(semester.id)}
              />
            ))}
          </FolderGrid>
        ) : location === 'semester' ? (
          selectedSemester.courses.length ? (
            <FolderGrid>
              {selectedSemester.courses.map((course) => (
                <FolderCard
                  key={course.id}
                  icon={BookOpen}
                  title={course.label}
                  code={course.code}
                  status={course.status}
                  creatorName={course.creatorName}
                  createdAt={course.createdAt}
                  count={course.documents.length}
                  countLabel={c.documents}
                  tone="course"
                  onClick={() => openCourse(course.id)}
                />
              ))}
            </FolderGrid>
          ) : <FolderEmpty title={c.noCourses} description={c.noCoursesBody} onBack={openRoot} />
        ) : (
          <>
            {['personal', 'workspace'].includes(location) ? (
              <PersonalWorkspacePanel
                activeWorkspaceId={location === 'workspace' ? workspaceId : null}
                documentCounts={workspaceDocumentCounts}
                onOpenWorkspace={openWorkspace}
                onWorkspaceDeleted={(deletedId) => deletedId === workspaceId && openPersonal()}
                onWorkspacesChange={setWorkspaces}
                refreshSignal={quotaRefreshSignal}
              />
            ) : null}
            {location !== 'personal' ? (
              <DocumentCollection
                documents={displayedDocuments}
                locations={hierarchy.documentLocations}
                view={view}
                currentUserId={currentUserId}
                busyId={busyId}
                onCancel={cancelSubmission}
                onDelete={setDeleteTarget}
                onMove={location === 'workspace' ? setMoveTarget : null}
                onSubmit={prepareSubmit}
                navigate={navigate}
                workspaces={workspaces}
              />
            ) : null}
          </>
        )}
      </section>

      {submitTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && setSubmitTarget(null)}>
          <section className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-950">{c.submitTitle}</h2>
              <IconButton label={c.close} onClick={() => setSubmitTarget(null)}><X size={17} /></IconButton>
            </div>
            <p className="mt-2 truncate text-sm font-semibold text-slate-600">{submitTarget.displayName}</p>
            <SelectField className="mt-5 w-full" label={c.course} value={submitCourseId} onChange={(event) => setSubmitCourseId(event.target.value)}>
              <option value="">{c.selectCourse}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.semesterName} · {course.label}</option>
              ))}
            </SelectField>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSubmitTarget(null)}>{c.cancel}</Button>
              <Button disabled={!submitCourseId || busyId === submitTarget.id} onClick={submit}>
                <Send size={16} />{c.submit}
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {deleteTarget ? (
        <ConfirmModal
          title={c.deleteTitle}
          actionLabel={c.deleteAction}
          busy={busyId === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={removeDocument}
        >
          {c.deleteBody(deleteTarget.displayName)}
        </ConfirmModal>
      ) : null}

      {moveTarget ? (
        <MoveDocumentModal
          document={moveTarget}
          workspaces={workspaces}
          onCancel={() => setMoveTarget(null)}
          onConfirm={moveDocument}
        />
      ) : null}
    </main>
  )
}

function Breadcrumb({ items, onPersonal, onRoot, onSemester }) {
  const { c } = useLibraryCopy()
  return (
    <nav className="flex max-w-full items-center gap-1 overflow-x-auto text-sm font-bold text-slate-500" aria-label={c.breadcrumb}>
      {items.map((item, index) => (
        <div className="flex shrink-0 items-center gap-1" key={`${item.label}-${index}`}>
          {index ? <ChevronRight aria-hidden="true" size={14} /> : null}
          <button
            type="button"
            className={cn('inline-flex min-h-8 items-center gap-1 rounded-md px-2 hover:bg-slate-100 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500', item.current && 'text-slate-900')}
            aria-current={item.current ? 'page' : undefined}
            onClick={() => item.type === 'root'
              ? onRoot()
              : item.type === 'personal'
                ? onPersonal()
                : item.type === 'semester'
                  ? onSemester(item.id)
                  : undefined}
            disabled={item.current}
          >
            {item.type === 'root' ? <Home size={14} /> : null}{item.label}
          </button>
        </div>
      ))}
    </nav>
  )
}

function FolderGrid({ children }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
}

function FolderCard({
  count, countLabel, code, createdAt, creatorName, icon: Icon, onClick, status, title,
  tone = 'semester',
}) {
  const { locale } = useLibraryCopy()
  const tones = {
    semester: {
      body: 'border-amber-200 bg-amber-50',
      tab: 'border-amber-200 bg-amber-100',
      icon: 'bg-amber-200/70 text-amber-800',
    },
    personal: {
      body: 'border-teal-200 bg-teal-50',
      tab: 'border-teal-200 bg-teal-100',
      icon: 'bg-teal-200/70 text-teal-800',
    },
    course: {
      body: 'border-sky-200 bg-sky-50',
      tab: 'border-sky-200 bg-sky-100',
      icon: 'bg-sky-200/70 text-sky-800',
    },
  }
  const colors = tones[tone]
  return (
    <button
      type="button"
      className="group relative mt-5 min-h-56 text-left focus-visible:outline-none"
      onClick={onClick}
    >
      <span className={cn(
        'absolute left-0 top-0 h-8 w-28 rounded-t-lg border border-b-0 transition group-hover:-translate-y-1',
        colors.tab,
      )} />
      <span className={cn(
        'relative mt-7 flex min-h-48 flex-col rounded-b-lg rounded-tr-lg border p-4 shadow-sm transition',
        'group-hover:-translate-y-1 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-teal-600 group-focus-visible:ring-offset-2',
        colors.body,
      )}>
        <span className="flex items-start justify-between gap-3">
          <span className={cn('grid size-11 shrink-0 place-items-center rounded-md', colors.icon)}><Icon size={22} /></span>
          <ChevronRight className="mt-1 shrink-0 text-slate-500 transition group-hover:translate-x-1 group-hover:text-teal-800" size={18} />
        </span>
        <span className="mt-3 line-clamp-2 text-base font-black text-slate-950">{title}</span>
        <span className="mt-1 text-xs font-bold uppercase text-slate-500">{code || (locale === 'vi' ? 'Không có mã' : 'No code')}</span>
        <span className="mt-auto grid gap-1 border-t border-slate-900/10 pt-3 text-xs font-semibold text-slate-600">
          <span className="flex items-center justify-between gap-2"><span>{statusLabel(status, locale)}</span><span>{count} {countLabel}</span></span>
          <span className="truncate"><UserRound className="mr-1 inline" size={13} />{folderCreatorName(creatorName, tone, locale)}</span>
          <span><CalendarDays className="mr-1 inline" size={13} />{createdAt || (locale === 'vi' ? 'Chưa có thông tin' : 'No information')}</span>
        </span>
      </span>
    </button>
  )
}

function DocumentCollection(props) {
  const { locale } = useLibraryCopy()
  if (!props.documents.length) {
    return (
      <FolderEmpty
        title={props.searching ? (locale === 'vi' ? 'Không tìm thấy tài liệu' : 'No documents found') : (locale === 'vi' ? 'Thư mục chưa có tài liệu' : 'This folder is empty')}
        description={props.searching
          ? (locale === 'vi' ? 'Thử tên tài liệu, loại tệp, người đăng hoặc tên môn học khác.' : 'Try another document name, file type, uploader, or course.')
          : (locale === 'vi' ? 'Tài liệu phù hợp với quyền truy cập sẽ xuất hiện tại đây.' : 'Documents available to you will appear here.')}
      />
    )
  }
  return props.view === 'list' ? <DocumentList {...props} /> : <DocumentGrid {...props} />
}

function DocumentGrid({ documents, locations, currentUserId, busyId, onCancel, onDelete, onMove, onSubmit, navigate, searching, workspaces }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {documents.map((document) => (
        <DocumentCard
          key={document.id}
          document={document}
          location={searching ? locations.get(document.id) : null}
          currentUserId={currentUserId}
          busy={busyId === document.id}
          onCancel={() => onCancel(document)}
          onDelete={() => onDelete(document)}
          onMove={onMove ? () => onMove(document) : null}
          onSubmit={() => onSubmit(document)}
          onOpen={() => navigate(`/library/documents/${document.id}`)}
          workspaces={workspaces}
        />
      ))}
    </div>
  )
}

function DocumentCard({ document, location, currentUserId, busy, onCancel, onDelete, onMove, onOpen, onSubmit, workspaces }) {
  const { locale } = useLibraryCopy()
  const visual = fileVisual(document.type)
  const Icon = visual.icon
  const owner = document.uploadedBy === currentUserId ? (locale === 'vi' ? 'Bạn' : 'You') : document.uploaderName
  return (
    <article
      className="group relative min-h-72 cursor-pointer pb-2 pr-2 transition duration-200 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
      role="link"
      tabIndex={0}
      onClick={(event) => {
        if (!event.target.closest('button, a, summary, details')) onOpen()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen()
      }}
    >
      <span
        aria-hidden="true"
        className={cn('pointer-events-none absolute inset-x-0 bottom-0 top-3 translate-x-2 translate-y-2 border bg-white/70', visual.paper)}
        style={{ clipPath: 'polygon(0 0, calc(100% - 48px) 0, 100% 48px, 100% 100%, 0 100%)' }}
      />
      <div
        className={cn('relative min-h-72 overflow-hidden border bg-white p-5 shadow-sm transition group-hover:shadow-lg', visual.paper)}
        style={{ clipPath: 'polygon(0 0, calc(100% - 48px) 0, 100% 48px, 100% 100%, 0 100%)' }}
      >
        <span aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-1.5', visual.accent)} />
        <span
          aria-hidden="true"
          className={cn('pointer-events-none absolute right-0 top-0 size-12 border-b border-l', visual.fold)}
          style={{ clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }}
        />
        <div className="flex items-start gap-3">
          <span className={cn('grid size-12 shrink-0 place-items-center rounded-md', visual.tone)}><Icon size={23} /></span>
          <span className="pt-1 text-[11px] font-black uppercase text-slate-400">{locale === 'vi' ? 'Tài liệu' : 'Document'}</span>
        </div>
        <h2 className="mt-5 line-clamp-2 min-h-11 pr-2 text-[15px] font-black leading-[1.45] text-slate-950 group-hover:text-teal-800">{document.displayName}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={cn('rounded-md px-2 py-1 text-xs font-black', visual.badge)}>{visual.label}</span>
          <DocumentState document={document} />
        </div>
        <dl className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-600">
          <Meta icon={UserRound} value={owner || (locale === 'vi' ? 'Không rõ người đăng' : 'Unknown uploader')} />
          <Meta icon={CalendarDays} value={document.uploadedAt} />
          <Meta icon={HardDrive} value={`${formatBytes(document.fileSizeBytes)} · ${pageLabel(document, locale)}`} />
        </dl>
        {location?.breadcrumb?.length ? (
          <p className="mt-4 truncate border-t border-slate-100 pt-3 text-xs font-bold text-slate-500">
            {location.breadcrumb.join(' / ')}
          </p>
        ) : null}
      </div>
      <div className="absolute right-14 top-4 z-20">
        <DocumentMenu document={document} busy={busy} onCancel={onCancel} onDelete={onDelete} onMove={onMove} onOpen={onOpen} onSubmit={onSubmit} workspaces={workspaces} />
      </div>
    </article>
  )
}

function DocumentList({ documents, locations, currentUserId, busyId, onCancel, onDelete, onMove, onSubmit, navigate, searching, workspaces }) {
  const { locale } = useLibraryCopy()
  const headers = locale === 'vi' ? ['Tài liệu', 'Người đăng', 'Ngày đăng', 'Trạng thái', 'Kích thước', 'Thao tác'] : ['Document', 'Uploader', 'Uploaded', 'Status', 'Size', 'Actions']
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[820px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-600">
          <tr>
            <th className="px-4 py-3">{headers[0]}</th>
            <th className="px-4 py-3">{headers[1]}</th>
            <th className="px-4 py-3">{headers[2]}</th>
            <th className="px-4 py-3">{headers[3]}</th>
            <th className="px-4 py-3">{headers[4]}</th>
            <th className="w-14 px-2 py-3"><span className="sr-only">{headers[5]}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {documents.map((document) => {
            const visual = fileVisual(document.type)
            const Icon = visual.icon
            return (
              <tr className="hover:bg-slate-50" key={document.id}>
                <td className="px-4 py-3">
                  <button className="flex max-w-md items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500" type="button" onClick={() => navigate(`/library/documents/${document.id}`)}>
                    <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg', visual.tone)}><Icon size={19} /></span>
                    <span className="min-w-0">
                      <span className="block truncate font-black text-slate-950">{document.displayName}</span>
                      <span className="mt-1 block truncate text-xs font-semibold text-slate-500">
                        {visual.label}{searching && locations.get(document.id)?.breadcrumb?.length
                          ? ` · ${locations.get(document.id).breadcrumb.join(' / ')}`
                          : ''}
                      </span>
                    </span>
                  </button>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700">{document.uploadedBy === currentUserId ? (locale === 'vi' ? 'Bạn' : 'You') : document.uploaderName}</td>
                <td className="px-4 py-3 font-semibold text-slate-600">{document.uploadedAt}</td>
                <td className="px-4 py-3"><DocumentState document={document} /></td>
                <td className="px-4 py-3 font-semibold text-slate-600">{formatBytes(document.fileSizeBytes)}</td>
                <td className="px-2 py-3">
                  <DocumentMenu
                    document={document}
                    busy={busyId === document.id}
                    onCancel={() => onCancel(document)}
                    onDelete={() => onDelete(document)}
                    onMove={onMove ? () => onMove(document) : null}
                    onOpen={() => navigate(`/library/documents/${document.id}`)}
                    onSubmit={() => onSubmit(document)}
                    workspaces={workspaces}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DocumentMenu({ document, busy, onCancel, onDelete, onMove, onOpen, onSubmit, workspaces }) {
  const { locale } = useLibraryCopy()
  const labels = locale === 'vi'
    ? { actions: 'Thao tác với', view: 'Xem tài liệu', move: 'Chuyển không gian', moveHint: 'Nâng cấp gói để có thêm không gian cá nhân và chuyển tài liệu.', submit: 'Gửi vào môn học', cancel: 'Hủy yêu cầu', remove: 'Xóa tài liệu' }
    : { actions: 'Actions for', view: 'View document', move: 'Move workspace', moveHint: 'Upgrade your plan to create another personal workspace and move this document.', submit: 'Submit to course', cancel: 'Cancel submission', remove: 'Delete document' }
  const canSubmit = document.status === 'Processed'
    && ['NOT_SUBMITTED', 'REJECTED'].includes(document.reviewStatus)
    && document.documentScope !== 'COURSE'
  const movable = Boolean(onMove) && document.documentScope === 'PERSONAL'
  const hasOtherWorkspace = (workspaces?.length ?? 0) > 1
  return (
    <details className="relative z-10">
      <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500" aria-label={`${labels.actions} ${document.displayName}`}>
        <MoreHorizontal size={18} />
      </summary>
      <div className="absolute right-0 top-10 z-30 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
        <MenuAction icon={Eye} label={labels.view} onClick={onOpen} />
        {movable ? (
          hasOtherWorkspace ? (
            <MenuAction icon={FolderInput} label={labels.move} onClick={onMove} />
          ) : (
            <MenuAction
              disabled
              hint={labels.moveHint}
              icon={FolderInput}
              label={labels.move}
            />
          )
        ) : null}
        {canSubmit ? <MenuAction icon={Send} label={labels.submit} onClick={onSubmit} /> : null}
        {document.reviewStatus === 'PENDING' ? <MenuAction disabled={busy} icon={X} label={labels.cancel} onClick={onCancel} /> : null}
        {document.canDelete ? <MenuAction danger disabled={busy} icon={Trash2} label={labels.remove} onClick={onDelete} /> : null}
      </div>
    </details>
  )
}

function MenuAction({ danger, disabled, hint, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={hint}
      className={cn(
        'flex min-h-9 w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent',
        danger ? 'text-red-700 hover:bg-red-50' : 'text-slate-700',
      )}
      onClick={disabled ? undefined : (event) => {
        event.currentTarget.closest('details')?.removeAttribute('open')
        onClick()
      }}
    >
      <Icon className="mt-0.5 shrink-0" size={15} />
      <span>
        {label}
        {disabled && hint ? <span className="block text-xs font-semibold text-slate-500">{hint}</span> : null}
      </span>
    </button>
  )
}

function DocumentState({ document }) {
  const { locale } = useLibraryCopy()
  const state = reviewMeta(document, locale)
  const Icon = state.icon
  return <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold', state.tone)}><Icon className={state.spin ? 'animate-spin' : ''} size={13} />{state.label}</span>
}

function Meta({ icon: Icon, value }) {
  return <div className="flex min-w-0 items-center gap-2"><Icon className="shrink-0 text-slate-400" size={14} /><dd className="truncate">{value}</dd></div>
}

function ViewButton({ active, children, label, onClick }) {
  return <button type="button" aria-label={label} aria-pressed={active} className={cn('grid size-9 place-items-center rounded-md text-slate-500 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500', active && 'bg-teal-50 text-teal-700')} onClick={onClick}>{children}</button>
}

function FolderEmpty({ description, onBack, title }) {
  const { locale } = useLibraryCopy()
  return (
    <EmptyState
      title={title}
      description={description}
      action={onBack ? <Button variant="secondary" onClick={onBack}><Home size={16} />{locale === 'vi' ? 'Về thư viện' : 'Back to library'}</Button> : null}
    />
  )
}

function LibrarySkeleton() {
  const { locale } = useLibraryCopy()
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={locale === 'vi' ? 'Đang tải thư viện' : 'Loading library'}>
      {[1, 2, 3, 4].map((item) => (
        <div className="min-h-36 animate-pulse rounded-lg border border-slate-200 bg-white p-4" key={item}>
          <div className="size-12 rounded-lg bg-slate-200" />
          <div className="mt-4 h-4 w-2/3 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-full rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

function buildBreadcrumb(location, semester, course, workspace, c) {
  const items = [{ type: 'root', label: c.title, current: location === 'root' }]
  if (['personal', 'workspace'].includes(location)) {
    items.push({ type: 'personal', label: c.myDocuments, current: location === 'personal' })
  }
  if (location === 'workspace') {
    items.push({ type: 'workspace', id: workspace?.id, label: workspace?.title ?? c.myDocuments, current: true })
  }
  if (semester) items.push({ type: 'semester', id: semester.id, label: semester.name, current: location === 'semester' })
  if (course) items.push({ type: 'course', id: course.id, label: course.code || course.name, current: true })
  return items
}

function contextDescription(location, hierarchy, semester, course, workspace, workspaceDocumentCount, workspaceCount, locale) {
  if (locale === 'en') {
    if (location === 'personal') return `${workspaceCount} workspace(s) · ${hierarchy.personalDocuments.length} personal or pending document(s).`
    if (location === 'workspace') return `${workspaceDocumentCount} document(s) in ${workspace?.title ?? 'this workspace'}.`
    if (location === 'semester') return `${semester.courses.length} course(s) · ${semester.documentCount} document(s).`
    if (location === 'course') return `${course.documents.length} approved course document(s).`
    return `${hierarchy.semesters.length} semester(s) · ${hierarchy.allDocuments.length} accessible document(s).`
  }
  if (location === 'personal') return `${workspaceCount} workspace · ${hierarchy.personalDocuments.length} tài liệu cá nhân hoặc đang chờ duyệt.`
  if (location === 'workspace') return `${workspaceDocumentCount} tài liệu trong ${workspace?.title ?? 'workspace này'}.`
  if (location === 'semester') return `${semester.courses.length} môn học · ${semester.documentCount} tài liệu.`
  if (location === 'course') return `${course.documents.length} tài liệu đã được duyệt cho môn học.`
  return `${hierarchy.semesters.length} học kỳ · ${hierarchy.allDocuments.length} tài liệu có thể truy cập.`
}

function fileVisual(type) {
  const normalized = String(type ?? '').toUpperCase()
  if (normalized === 'PDF') return {
    icon: FileText, label: 'PDF', tone: 'bg-red-50 text-red-700', badge: 'bg-red-50 text-red-700',
    paper: 'border-red-200', fold: 'border-red-200 bg-red-50', accent: 'bg-red-500',
  }
  if (['DOC', 'DOCX'].includes(normalized)) return {
    icon: FileType2, label: normalized, tone: 'bg-blue-50 text-blue-700', badge: 'bg-blue-50 text-blue-700',
    paper: 'border-blue-200', fold: 'border-blue-200 bg-blue-50', accent: 'bg-blue-500',
  }
  if (['PPT', 'PPTX'].includes(normalized)) return {
    icon: Presentation, label: normalized, tone: 'bg-orange-50 text-orange-700', badge: 'bg-orange-50 text-orange-700',
    paper: 'border-orange-200', fold: 'border-orange-200 bg-orange-50', accent: 'bg-orange-500',
  }
  if (['XLS', 'XLSX', 'CSV'].includes(normalized)) return {
    icon: FileSpreadsheet, label: normalized, tone: 'bg-green-50 text-green-700', badge: 'bg-green-50 text-green-700',
    paper: 'border-green-200', fold: 'border-green-200 bg-green-50', accent: 'bg-green-500',
  }
  return {
    icon: File, label: normalized || 'FILE', tone: 'bg-slate-100 text-slate-700', badge: 'bg-slate-100 text-slate-700',
    paper: 'border-slate-200', fold: 'border-slate-200 bg-slate-100', accent: 'bg-slate-500',
  }
}

function reviewMeta(document, locale) {
  const labels = locale === 'vi' ? ['Chờ duyệt', 'Bị từ chối', 'Đang xử lý', 'Xử lý lỗi', 'Môn học', 'Cá nhân'] : ['Pending review', 'Rejected', 'Processing', 'Processing failed', 'Course', 'Personal']
  if (document.reviewStatus === 'PENDING') return { label: labels[0], tone: 'bg-amber-50 text-amber-800', icon: Clock3 }
  if (document.reviewStatus === 'REJECTED') return { label: labels[1], tone: 'bg-red-50 text-red-700', icon: XCircle }
  if (document.status === 'Processing') return { label: labels[2], tone: 'bg-amber-50 text-amber-800', icon: Loader2, spin: true }
  if (document.status === 'Failed') return { label: labels[3], tone: 'bg-red-50 text-red-700', icon: XCircle }
  if (document.documentScope === 'COURSE' && document.reviewStatus === 'APPROVED') return { label: labels[4], tone: 'bg-emerald-50 text-emerald-700', icon: Check }
  return { label: labels[5], tone: 'bg-slate-100 text-slate-700', icon: FolderLock }
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.ceil(bytes / 1024)} KB`
}

function pageLabel(document, locale) {
  const count = Number(document.pages ?? 0)
  if (['PPT', 'PPTX'].includes(String(document.type).toUpperCase())) return `${count} slide`
  return `${count} ${locale === 'vi' ? 'trang' : 'pages'}`
}

function statusLabel(status, locale) {
  const normalized = String(status ?? '').toUpperCase()
  if (['ACTIVE', 'PUBLISHED'].includes(normalized)) return locale === 'vi' ? 'Đang hoạt động' : 'Active'
  if (normalized === 'INACTIVE') return locale === 'vi' ? 'Ngừng hoạt động' : 'Inactive'
  if (normalized === 'CÁ NHÂN') return locale === 'vi' ? 'Cá nhân' : 'Personal'
  return status || (locale === 'vi' ? 'Chưa rõ trạng thái' : 'Unknown status')
}

function latestDocumentDate(documents) {
  const latest = [...documents].sort(
    (left, right) => Number(right.uploadedAtTimestamp ?? 0) - Number(left.uploadedAtTimestamp ?? 0),
  )[0]
  return latest?.uploadedAt || 'Chưa có tài liệu'
}

function folderCreatorName(creatorName, tone, locale) {
  if (tone === 'personal') return locale === 'vi' ? 'Bạn' : 'You'
  const normalized = String(creatorName ?? '').trim()
  if (!normalized || /admin/i.test(normalized)) return 'FStu'
  return normalized
}
