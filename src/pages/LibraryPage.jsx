/* eslint-disable react-hooks/set-state-in-effect -- initial request state is owned by this page */
import {
  BookOpen, Check, Clock3, Eye, FileText, FolderLock, Loader2, Search,
  RotateCcw, Send, Trash2, Upload, X, XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, ConfirmModal, EmptyState, Field, IconButton, Panel, SelectField, StatusBadge } from '../components/ui.jsx'
import { getLearningScope } from '../services/courseService.js'
import {
  cancelDocumentSubmission, getDocuments, getDocumentTrash, getMyDocuments,
  permanentlyDeleteDocument, restoreDocument, submitDocument,
} from '../services/documentService.js'
import { deleteFile, updateFile, uploadPersonalFiles } from '../services/uploadService.js'
import { cn } from '../utils/cn.js'

const MAX_FILE_SIZE = 20 * 1024 * 1024
const ACCEPTED_TYPES = ['pdf', 'docx', 'pptx']

export default function LibraryPage() {
  const [tab, setTab] = useState('mine')
  const [mine, setMine] = useState([])
  const [shared, setShared] = useState([])
  const [trashed, setTrashed] = useState([])
  const [courses, setCourses] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitTarget, setSubmitTarget] = useState(null)
  const [submitCourseId, setSubmitCourseId] = useState('')
  const [busyId, setBusyId] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteMode, setDeleteMode] = useState('trash')
  const fileInputRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [myDocuments, courseDocuments, trashDocuments, scope] = await Promise.all([
        getMyDocuments(), getDocuments(), getDocumentTrash(), getLearningScope(),
      ])
      setMine(myDocuments)
      setShared(courseDocuments.filter((item) => item.documentScope === 'COURSE' && item.reviewStatus === 'APPROVED'))
      setTrashed(trashDocuments)
      setCourses((Array.isArray(scope) ? scope : []).flatMap((semester) =>
        (semester.courses ?? []).map((course) => ({
          id: course.courseId,
          label: `${course.courseCode} · ${course.courseName}`,
          semester: semester.semesterName,
        })),
      ))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const documents = tab === 'mine' ? mine : tab === 'course' ? shared : trashed
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase()
    return documents.filter((document) => !value || document.displayName.toLowerCase().includes(value))
  }, [documents, query])

  async function uploadFiles(event) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    const invalid = files.find((file) => !ACCEPTED_TYPES.includes(file.name.split('.').pop()?.toLowerCase()) || file.size > MAX_FILE_SIZE)
    if (invalid) {
      setError('Chỉ nhận PDF, DOCX, PPTX và tối đa 20 MB mỗi file.')
      return
    }
    setUploading(true)
    setError('')
    try {
      const tasks = uploadPersonalFiles(files)
      const results = await Promise.allSettled(tasks.map((task) => task.promise))
      const uploaded = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value)
      if (uploaded.length) setMine((current) => [...uploaded.reverse(), ...current])
      const failed = results.filter((result) => result.status === 'rejected')
      if (failed.length) setError(`${failed.length} tài liệu tải lên không thành công. Xem chi tiết trong popup tiến trình.`)
    } finally {
      setUploading(false)
    }
  }

  async function submit() {
    if (!submitTarget || !submitCourseId) return
    setBusyId(submitTarget.id)
    setError('')
    try {
      const updated = await updateFile(
        submitTarget,
        () => submitDocument(submitTarget.id, submitCourseId),
        {
          pendingText: 'Đang gửi tài liệu vào môn học...',
          completedText: 'Đã gửi tài liệu để duyệt.',
        },
      )
      setMine((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item))
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
      const updated = await updateFile(
        document,
        () => cancelDocumentSubmission(document.id),
        {
          pendingText: 'Đang hủy yêu cầu gửi tài liệu...',
          completedText: 'Đã hủy yêu cầu gửi tài liệu.',
        },
      )
      setMine((current) => current.map((item) => item.id === updated.id ? { ...item, ...updated } : item))
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
      if (deleteMode === 'permanent') {
        await permanentlyDeleteDocument(deleteTarget.id)
        setTrashed((current) => current.filter((item) => item.id !== deleteTarget.id))
      } else {
        await deleteFile(deleteTarget)
        setMine((current) => current.filter((item) => item.id !== deleteTarget.id))
        setTrashed((current) => [{ ...deleteTarget, deletedAt: new Date().toISOString() }, ...current])
      }
      setDeleteTarget(null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  async function restore(document) {
    setBusyId(document.id)
    setError('')
    try {
      const restored = await restoreDocument(document.id)
      setTrashed((current) => current.filter((item) => item.id !== document.id))
      setMine((current) => [restored, ...current])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-teal-700"><FolderLock size={15} />Library</div>
          <h1 className="text-3xl font-black text-slate-950">Kho tài liệu</h1>
        </div>
        {tab === 'mine' ? (
          <Button disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? <Loader2 className="animate-spin" size={17} /> : <Upload size={17} />}
            {uploading ? 'Đang tải lên...' : 'Tải tài liệu lên'}
          </Button>
        ) : null}
        <input ref={fileInputRef} className="hidden" type="file" multiple accept=".pdf,.docx,.pptx" onChange={uploadFiles} />
      </header>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit rounded-lg bg-slate-100 p-1" role="tablist">
          <Tab active={tab === 'mine'} icon={FolderLock} onClick={() => setTab('mine')}>Tài liệu của tôi</Tab>
          <Tab active={tab === 'course'} icon={BookOpen} onClick={() => setTab('course')}>Tài liệu môn học</Tab>
          <Tab active={tab === 'trash'} icon={Trash2} onClick={() => setTab('trash')}>Thùng rác</Tab>
        </div>
        <Field className="w-full sm:max-w-sm" icon={Search} label="Tìm tài liệu" placeholder="Tìm theo tên tài liệu" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center text-sm font-bold text-slate-500"><Loader2 className="mr-2 animate-spin" size={18} />Đang tải tài liệu</div>
      ) : filtered.length ? (
        <Panel className="overflow-hidden p-0">
          <div className="divide-y divide-slate-100">
            {filtered.map((document) => (
              <DocumentRow key={document.id} document={document} mine={tab === 'mine'} trashed={tab === 'trash'} busy={busyId === document.id}
                onCancel={() => cancelSubmission(document)} onDelete={() => { setDeleteMode(tab === 'trash' ? 'permanent' : 'trash'); setDeleteTarget(document) }}
                onRestore={() => restore(document)}
                onSubmit={() => { setSubmitTarget(document); setSubmitCourseId(document.targetCourseId ?? courses[0]?.id ?? '') }} />
            ))}
          </div>
        </Panel>
      ) : (
        <EmptyState title={tab === 'mine' ? 'Chưa có tài liệu cá nhân' : tab === 'course' ? 'Chưa có tài liệu môn học' : 'Thùng rác trống'}
          description={tab === 'mine' ? 'Tải lên PDF, DOCX hoặc PPTX để bắt đầu.' : tab === 'course' ? 'Các tài liệu đã được duyệt sẽ xuất hiện tại đây.' : 'Tài liệu đã xóa sẽ xuất hiện tại đây.'} />
      )}

      {submitTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && setSubmitTarget(null)}>
          <section className="os-panel w-full max-w-md p-5">
            <div className="flex items-center justify-between"><h2 className="text-lg font-black">Gửi vào môn học</h2><IconButton label="Đóng" onClick={() => setSubmitTarget(null)}><X size={17} /></IconButton></div>
            <p className="mt-2 truncate text-sm font-semibold text-slate-600">{submitTarget.displayName}</p>
            <SelectField className="mt-5 w-full" label="Môn học" value={submitCourseId} onChange={(event) => setSubmitCourseId(event.target.value)}>
              <option value="">Chọn môn học</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.semester} · {course.label}</option>)}
            </SelectField>
            <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setSubmitTarget(null)}>Hủy</Button><Button disabled={!submitCourseId || busyId === submitTarget.id} onClick={submit}><Send size={16} />Gửi duyệt</Button></div>
          </section>
        </div>
      ) : null}

      {deleteTarget ? <ConfirmModal title={deleteMode === 'permanent' ? 'Xóa vĩnh viễn?' : 'Chuyển vào thùng rác?'} actionLabel={deleteMode === 'permanent' ? 'Xóa vĩnh viễn' : 'Chuyển vào thùng rác'} busy={busyId === deleteTarget.id} onCancel={() => setDeleteTarget(null)} onConfirm={removeDocument}>{deleteMode === 'permanent' ? 'Không thể hoàn tác. Hệ thống sẽ chặn nếu chat hoặc benchmark còn phụ thuộc.' : deleteTarget.documentScope === 'COURSE' ? 'Tài liệu đang chia sẻ sẽ bị thu hồi khỏi môn học và có thể làm môn học chuyển sang Inactive.' : `“${deleteTarget.displayName}” sẽ bị ẩn khỏi chat và RAG.`}</ConfirmModal> : null}
    </main>
  )
}

function Tab({ active, children, icon: Icon, onClick }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={cn('flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-bold', active ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-800')}><Icon size={15} />{children}</button>
}

function DocumentRow({ document, mine, trashed, busy, onCancel, onDelete, onRestore, onSubmit }) {
  const review = reviewMeta(document)
  return (
    <article className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center">
      <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700"><FileText size={20} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-black text-slate-900">{document.displayName}</h2><StatusBadge status={document.status} /><ReviewBadge {...review} /></div>
        <p className="mt-1 text-xs font-semibold text-slate-500">{document.type || 'FILE'} · {formatBytes(document.fileSizeBytes)} · {document.pages || 0} trang</p>
        {document.rejectionReason ? <p className="mt-2 text-sm font-semibold text-red-700">{document.rejectionReason}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!trashed ? <Link to={`/library/documents/${document.id}`}><IconButton label="Xem tài liệu"><Eye size={16} /></IconButton></Link> : null}
        {mine && document.status === 'Processed' && ['NOT_SUBMITTED', 'REJECTED'].includes(document.reviewStatus) ? <Button size="sm" variant="secondary" onClick={onSubmit}><Send size={15} />Gửi vào môn học</Button> : null}
        {mine && document.reviewStatus === 'PENDING' ? <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}><X size={15} />Hủy yêu cầu</Button> : null}
        {mine && document.canDelete ? <IconButton label="Xóa" disabled={busy} onClick={onDelete}><Trash2 size={16} /></IconButton> : null}
        {trashed ? <><Button size="sm" variant="secondary" disabled={busy} onClick={onRestore}><RotateCcw size={15} />Khôi phục</Button><IconButton label="Xóa vĩnh viễn" disabled={busy} onClick={onDelete}><Trash2 size={16} /></IconButton></> : null}
      </div>
    </article>
  )
}

function ReviewBadge({ label, tone, icon: Icon }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold', tone)}><Icon size={13} />{label}</span>
}

function reviewMeta(document) {
  if (document.reviewStatus === 'PENDING') return { label: 'Chờ duyệt', tone: 'bg-amber-50 text-amber-700', icon: Clock3 }
  if (document.reviewStatus === 'REJECTED') return { label: 'Bị từ chối', tone: 'bg-red-50 text-red-700', icon: XCircle }
  if (document.documentScope === 'COURSE' && document.reviewStatus === 'APPROVED') return { label: 'Đã chia sẻ', tone: 'bg-emerald-50 text-emerald-700', icon: Check }
  return { label: 'Cá nhân', tone: 'bg-slate-100 text-slate-600', icon: FolderLock }
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.ceil(bytes / 1024)} KB`
}
