/* eslint-disable react-hooks/set-state-in-effect -- initial request state is owned by this page */
import {
  BookOpen, CalendarDays, Check, ChevronRight, Clock3, Eye, File,
  FileSpreadsheet, FileText, FileType2, Folder, FolderLock, Grid2X2,
  HardDrive, Home, List as ListIcon, Loader2, MoreHorizontal, Presentation,
  RefreshCw, Search, Send, Trash2, Upload, UserRound, X, XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import StudentShell from '../components/StudentShell.jsx'
import { Button, ConfirmModal, EmptyState, IconButton, SelectField } from '../components/ui.jsx'
import { getCurrentUserId } from '../services/authService.js'
import { getLearningScope } from '../services/courseService.js'
import {
  cancelDocumentSubmission, getDocuments, getMyDocuments, submitDocument,
} from '../services/documentService.js'
import { deleteFile, uploadPersonalFiles } from '../services/uploadService.js'
import { cn } from '../utils/cn.js'
import {
  buildLibraryHierarchy, searchLibraryDocuments, sortLibraryDocuments,
} from './libraryModel.js'

const ACCEPTED_TYPES = ['pdf', 'docx', 'pptx']
const VIEW_STORAGE_KEY = 'fstu.library.view'

export default function LibraryPage() {
  return (
    <StudentShell mobileTitle="Thư viện">
      <LibraryContent />
    </StudentShell>
  )
}

function LibraryContent() {
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
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const hierarchy = useMemo(
    () => buildLibraryHierarchy(scope, mine, shared),
    [scope, mine, shared],
  )
  const folder = searchParams.get('folder')
  const semesterId = searchParams.get('semester')
  const courseId = searchParams.get('course')
  const selectedSemester = hierarchy.semesters.find((semester) => semester.id === semesterId)
    ?? hierarchy.semesters.find((semester) => semester.courses.some((course) => course.id === courseId))
    ?? null
  const selectedCourse = selectedSemester?.courses.find((course) => course.id === courseId) ?? null
  const location = courseId && selectedCourse
    ? 'course'
    : semesterId && selectedSemester
      ? 'semester'
      : folder === 'personal'
        ? 'personal'
        : 'root'
  const courses = hierarchy.semesters.flatMap((semester) =>
    semester.courses.map((course) => ({ ...course, semesterName: semester.name })))
  const searchedDocuments = useMemo(
    () => searchLibraryDocuments(hierarchy.allDocuments, hierarchy.documentLocations, query),
    [hierarchy, query],
  )
  const folderDocuments = location === 'personal'
    ? hierarchy.personalDocuments
    : location === 'course'
      ? selectedCourse.documents
      : []
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
      setError('Chỉ nhận tệp PDF, DOCX hoặc PPTX. Hạn mức kích thước được kiểm tra theo gói hiện tại của bạn.')
      return
    }
    setUploading(true)
    setError('')
    setNotice('')
    try {
      const tasks = uploadPersonalFiles(files)
      const documents = await Promise.all(tasks.map((task) => task.promise))
      setMine((current) => [
        ...documents,
        ...current.filter((item) => !documents.some((document) => document.id === item.id)),
      ])
      setNotice(`Đã tải lên ${files.length} tài liệu vào Tài liệu của tôi.`)
      navigate('/library?folder=personal')
    } catch (requestError) {
      setError(requestError.message)
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
      setNotice('Đã gửi tài liệu để xét duyệt vào môn học.')
      setSubmitTarget(null)
      setSubmitCourseId('')
    } catch (requestError) {
      setError(requestError.message)
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
      setNotice('Đã hủy yêu cầu gửi tài liệu.')
    } catch (requestError) {
      setError(requestError.message)
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
      setNotice('Đã xóa tài liệu.')
      setDeleteTarget(null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  function prepareSubmit(document) {
    setSubmitTarget(document)
    setSubmitCourseId(document.targetCourseId ?? courses[0]?.id ?? '')
  }

  const breadcrumb = buildBreadcrumb(location, selectedSemester, selectedCourse)
  const heading = query.trim()
    ? `Kết quả cho “${query.trim()}”`
    : location === 'personal'
      ? 'Tài liệu của tôi'
      : location === 'semester'
        ? selectedSemester.name
        : location === 'course'
          ? selectedCourse.label
          : 'Kho tài liệu'

  return (
    <main className="library-page mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Breadcrumb items={breadcrumb} onRoot={openRoot} onSemester={openSemester} />
          <h1 className="mt-3 text-3xl font-black text-slate-950">{heading}</h1>
          <p className="mt-1 text-sm font-medium text-slate-600">
            {query.trim()
              ? `${displayedDocuments.length} tài liệu được tìm thấy trong toàn bộ thư viện.`
              : contextDescription(location, hierarchy, selectedSemester, selectedCourse)}
          </p>
        </div>
        <Button disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" size={17} /> : <Upload size={17} />}
          {uploading ? 'Đang tải tài liệu...' : 'Tải tài liệu lên'}
        </Button>
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
          <Button size="sm" variant="danger" onClick={load}><RefreshCw size={15} />Thử lại</Button>
        </div>
      ) : null}
      {notice ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <span>{notice}</span>
          <IconButton label="Đóng thông báo" onClick={() => setNotice('')}><X size={16} /></IconButton>
        </div>
      ) : null}

      <section className="mt-5 flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <label className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-slate-500 focus-within:border-teal-500 focus-within:ring-4 focus-within:ring-teal-100 lg:max-w-xl">
          <Search size={17} />
          <span className="sr-only">Tìm toàn bộ thư viện</span>
          <input
            className="w-full bg-transparent text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-500"
            placeholder="Tìm theo tên, loại tệp, người đăng hoặc môn học"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? <IconButton label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={15} /></IconButton> : null}
        </label>
        <div className="flex items-center gap-2">
          {(query.trim() || ['personal', 'course'].includes(location)) ? (
            <>
              <SelectField label="Sắp xếp tài liệu" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
                <option value="name">Tên A–Z</option>
              </SelectField>
              <div className="flex rounded-lg border border-slate-300 bg-white p-1" aria-label="Kiểu hiển thị">
                <ViewButton active={view === 'grid'} label="Dạng lưới" onClick={() => changeView('grid')}><Grid2X2 size={16} /></ViewButton>
                <ViewButton active={view === 'list'} label="Dạng danh sách" onClick={() => changeView('list')}><ListIcon size={17} /></ViewButton>
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
              title="Tài liệu của tôi"
              code="PERSONAL"
              status="Cá nhân"
              creatorName="Bạn"
              createdAt={latestDocumentDate(hierarchy.personalDocuments)}
              count={hierarchy.personalDocuments.length}
              countLabel="tài liệu"
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
                countLabel="tài liệu"
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
                  countLabel="tài liệu"
                  tone="course"
                  onClick={() => openCourse(course.id)}
                />
              ))}
            </FolderGrid>
          ) : <FolderEmpty title="Semester chưa có môn học" description="Các môn học được cấp quyền sẽ xuất hiện tại đây." onBack={openRoot} />
        ) : (
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
          />
        )}
      </section>

      {submitTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && setSubmitTarget(null)}>
          <section className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-950">Gửi vào môn học</h2>
              <IconButton label="Đóng" onClick={() => setSubmitTarget(null)}><X size={17} /></IconButton>
            </div>
            <p className="mt-2 truncate text-sm font-semibold text-slate-600">{submitTarget.displayName}</p>
            <SelectField className="mt-5 w-full" label="Môn học" value={submitCourseId} onChange={(event) => setSubmitCourseId(event.target.value)}>
              <option value="">Chọn môn học</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.semesterName} · {course.label}</option>
              ))}
            </SelectField>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSubmitTarget(null)}>Hủy</Button>
              <Button disabled={!submitCourseId || busyId === submitTarget.id} onClick={submit}>
                <Send size={16} />Gửi duyệt
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      {deleteTarget ? (
        <ConfirmModal
          title="Xóa tài liệu?"
          actionLabel="Xóa"
          busy={busyId === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={removeDocument}
        >
          “{deleteTarget.displayName}” sẽ bị xóa khỏi Tài liệu của tôi.
        </ConfirmModal>
      ) : null}
    </main>
  )
}

function Breadcrumb({ items, onRoot, onSemester }) {
  return (
    <nav className="flex max-w-full items-center gap-1 overflow-x-auto text-sm font-bold text-slate-500" aria-label="Đường dẫn thư mục">
      {items.map((item, index) => (
        <div className="flex shrink-0 items-center gap-1" key={`${item.label}-${index}`}>
          {index ? <ChevronRight aria-hidden="true" size={14} /> : null}
          <button
            type="button"
            className={cn('inline-flex min-h-8 items-center gap-1 rounded-md px-2 hover:bg-slate-100 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500', item.current && 'text-slate-900')}
            aria-current={item.current ? 'page' : undefined}
            onClick={() => item.type === 'root' ? onRoot() : item.type === 'semester' ? onSemester(item.id) : undefined}
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
        <span className="mt-1 text-xs font-bold uppercase text-slate-500">{code || 'Không có mã'}</span>
        <span className="mt-auto grid gap-1 border-t border-slate-900/10 pt-3 text-xs font-semibold text-slate-600">
          <span className="flex items-center justify-between gap-2"><span>{statusLabel(status)}</span><span>{count} {countLabel}</span></span>
          <span className="truncate"><UserRound className="mr-1 inline" size={13} />{folderCreatorName(creatorName, tone)}</span>
          <span><CalendarDays className="mr-1 inline" size={13} />{createdAt || 'Chưa có thông tin'}</span>
        </span>
      </span>
    </button>
  )
}

function DocumentCollection(props) {
  if (!props.documents.length) {
    return (
      <FolderEmpty
        title={props.searching ? 'Không tìm thấy tài liệu' : 'Folder chưa có tài liệu'}
        description={props.searching
          ? 'Thử tên tài liệu, loại tệp, người đăng hoặc tên môn học khác.'
          : 'Tài liệu phù hợp với quyền truy cập sẽ xuất hiện tại đây.'}
      />
    )
  }
  return props.view === 'list' ? <DocumentList {...props} /> : <DocumentGrid {...props} />
}

function DocumentGrid({ documents, locations, currentUserId, busyId, onCancel, onDelete, onSubmit, navigate, searching }) {
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
          onSubmit={() => onSubmit(document)}
          onOpen={() => navigate(`/library/documents/${document.id}`)}
        />
      ))}
    </div>
  )
}

function DocumentCard({ document, location, currentUserId, busy, onCancel, onDelete, onOpen, onSubmit }) {
  const visual = fileVisual(document.type)
  const Icon = visual.icon
  const owner = document.uploadedBy === currentUserId ? 'Bạn' : document.uploaderName
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
          <span className="pt-1 text-[11px] font-black uppercase text-slate-400">Tài liệu</span>
        </div>
        <h2 className="mt-5 line-clamp-2 min-h-11 pr-2 text-[15px] font-black leading-[1.45] text-slate-950 group-hover:text-teal-800">{document.displayName}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={cn('rounded-md px-2 py-1 text-xs font-black', visual.badge)}>{visual.label}</span>
          <DocumentState document={document} />
        </div>
        <dl className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-xs font-semibold text-slate-600">
          <Meta icon={UserRound} value={owner || 'Không rõ người đăng'} />
          <Meta icon={CalendarDays} value={document.uploadedAt} />
          <Meta icon={HardDrive} value={`${formatBytes(document.fileSizeBytes)} · ${pageLabel(document)}`} />
        </dl>
        {location?.breadcrumb?.length ? (
          <p className="mt-4 truncate border-t border-slate-100 pt-3 text-xs font-bold text-slate-500">
            {location.breadcrumb.join(' / ')}
          </p>
        ) : null}
      </div>
      <div className="absolute right-14 top-4 z-20">
        <DocumentMenu document={document} busy={busy} onCancel={onCancel} onDelete={onDelete} onOpen={onOpen} onSubmit={onSubmit} />
      </div>
    </article>
  )
}

function DocumentList({ documents, locations, currentUserId, busyId, onCancel, onDelete, onSubmit, navigate, searching }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[820px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black text-slate-600">
          <tr>
            <th className="px-4 py-3">Tài liệu</th>
            <th className="px-4 py-3">Người đăng</th>
            <th className="px-4 py-3">Ngày đăng</th>
            <th className="px-4 py-3">Trạng thái</th>
            <th className="px-4 py-3">Kích thước</th>
            <th className="w-14 px-2 py-3"><span className="sr-only">Thao tác</span></th>
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
                <td className="px-4 py-3 font-semibold text-slate-700">{document.uploadedBy === currentUserId ? 'Bạn' : document.uploaderName}</td>
                <td className="px-4 py-3 font-semibold text-slate-600">{document.uploadedAt}</td>
                <td className="px-4 py-3"><DocumentState document={document} /></td>
                <td className="px-4 py-3 font-semibold text-slate-600">{formatBytes(document.fileSizeBytes)}</td>
                <td className="px-2 py-3">
                  <DocumentMenu
                    document={document}
                    busy={busyId === document.id}
                    onCancel={() => onCancel(document)}
                    onDelete={() => onDelete(document)}
                    onOpen={() => navigate(`/library/documents/${document.id}`)}
                    onSubmit={() => onSubmit(document)}
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

function DocumentMenu({ document, busy, onCancel, onDelete, onOpen, onSubmit }) {
  const canSubmit = document.status === 'Processed'
    && ['NOT_SUBMITTED', 'REJECTED'].includes(document.reviewStatus)
    && document.documentScope !== 'COURSE'
  return (
    <details className="relative z-10">
      <summary className="grid size-9 cursor-pointer list-none place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-500" aria-label={`Thao tác với ${document.displayName}`}>
        <MoreHorizontal size={18} />
      </summary>
      <div className="absolute right-0 top-10 z-30 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
        <MenuAction icon={Eye} label="Xem tài liệu" onClick={onOpen} />
        {canSubmit ? <MenuAction icon={Send} label="Gửi vào môn học" onClick={onSubmit} /> : null}
        {document.reviewStatus === 'PENDING' ? <MenuAction disabled={busy} icon={X} label="Hủy yêu cầu" onClick={onCancel} /> : null}
        {document.canDelete ? <MenuAction danger disabled={busy} icon={Trash2} label="Xóa tài liệu" onClick={onDelete} /> : null}
      </div>
    </details>
  )
}

function MenuAction({ danger, disabled, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn('flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-bold hover:bg-slate-100 disabled:opacity-50', danger ? 'text-red-700 hover:bg-red-50' : 'text-slate-700')}
      onClick={(event) => {
        event.currentTarget.closest('details')?.removeAttribute('open')
        onClick()
      }}
    >
      <Icon size={15} />{label}
    </button>
  )
}

function DocumentState({ document }) {
  const state = reviewMeta(document)
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
  return (
    <EmptyState
      title={title}
      description={description}
      action={onBack ? <Button variant="secondary" onClick={onBack}><Home size={16} />Về Library</Button> : null}
    />
  )
}

function LibrarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Đang tải thư viện">
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

function buildBreadcrumb(location, semester, course) {
  const items = [{ type: 'root', label: 'Library', current: location === 'root' }]
  if (location === 'personal') items.push({ type: 'personal', label: 'Tài liệu của tôi', current: true })
  if (semester) items.push({ type: 'semester', id: semester.id, label: semester.name, current: location === 'semester' })
  if (course) items.push({ type: 'course', id: course.id, label: course.code || course.name, current: true })
  return items
}

function contextDescription(location, hierarchy, semester, course) {
  if (location === 'personal') return `${hierarchy.personalDocuments.length} tài liệu cá nhân hoặc đang chờ duyệt.`
  if (location === 'semester') return `${semester.courses.length} môn học · ${semester.documentCount} tài liệu.`
  if (location === 'course') return `${course.documents.length} tài liệu đã được duyệt cho môn học.`
  return `${hierarchy.semesters.length} semester · ${hierarchy.allDocuments.length} tài liệu có thể truy cập.`
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

function reviewMeta(document) {
  if (document.reviewStatus === 'PENDING') return { label: 'Chờ duyệt', tone: 'bg-amber-50 text-amber-800', icon: Clock3 }
  if (document.reviewStatus === 'REJECTED') return { label: 'Bị từ chối', tone: 'bg-red-50 text-red-700', icon: XCircle }
  if (document.status === 'Processing') return { label: 'Đang xử lý', tone: 'bg-amber-50 text-amber-800', icon: Loader2, spin: true }
  if (document.status === 'Failed') return { label: 'Xử lý lỗi', tone: 'bg-red-50 text-red-700', icon: XCircle }
  if (document.documentScope === 'COURSE' && document.reviewStatus === 'APPROVED') return { label: 'Môn học', tone: 'bg-emerald-50 text-emerald-700', icon: Check }
  return { label: 'Cá nhân', tone: 'bg-slate-100 text-slate-700', icon: FolderLock }
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.ceil(bytes / 1024)} KB`
}

function pageLabel(document) {
  const count = Number(document.pages ?? 0)
  if (['PPT', 'PPTX'].includes(String(document.type).toUpperCase())) return `${count} slide`
  return `${count} trang`
}

function statusLabel(status) {
  const normalized = String(status ?? '').toUpperCase()
  if (['ACTIVE', 'PUBLISHED'].includes(normalized)) return 'Đang hoạt động'
  if (normalized === 'INACTIVE') return 'Ngừng hoạt động'
  if (normalized === 'CÁ NHÂN') return 'Cá nhân'
  return status || 'Chưa rõ trạng thái'
}

function latestDocumentDate(documents) {
  const latest = [...documents].sort(
    (left, right) => Number(right.uploadedAtTimestamp ?? 0) - Number(left.uploadedAtTimestamp ?? 0),
  )[0]
  return latest?.uploadedAt || 'Chưa có tài liệu'
}

function folderCreatorName(creatorName, tone) {
  if (tone === 'personal') return 'Bạn'
  const normalized = String(creatorName ?? '').trim()
  if (!normalized || /admin/i.test(normalized)) return 'FStu'
  return normalized
}
