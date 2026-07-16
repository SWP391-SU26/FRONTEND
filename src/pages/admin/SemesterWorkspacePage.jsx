import { useEffect, useState } from 'react'
import { Archive, BookOpen, Edit3, FileText, Loader2, Plus, Trash2, Upload, X } from 'lucide-react'
import { Button, EmptyState, Panel, StatusBadge } from '../../components/ui.jsx'
import { AdminPageHeader } from '../../layouts/AdminLayout.jsx'
import { deleteDocument, getDocuments } from '../../services/documentService.js'
import {
  createCourse,
  createSemesterWorkspace,
  deleteCourse,
  deleteSemesterWorkspace,
  getSemesterCourses,
  getSemesterWorkspaces,
  setSemesterStatus,
  updateCourse,
  updateSemesterWorkspace,
} from '../../services/courseService.js'
import { uploadFile } from '../../services/uploadService.js'

const emptyCourse = { courseCode: '', courseName: '', description: '' }

export default function SemesterWorkspacePage() {
  const [semesters, setSemesters] = useState([])
  const [selected, setSelected] = useState('')
  const [courses, setCourses] = useState([])
  const [activeCourse, setActiveCourse] = useState(null)
  const [mode, setMode] = useState('')
  const [semesterName, setSemesterName] = useState('')
  const [courseForm, setCourseForm] = useState(emptyCourse)
  const [documents, setDocuments] = useState([])
  const [busy, setBusy] = useState(false)
  const [uploadingCourseId, setUploadingCourseId] = useState('')
  const [togglingCourseId, setTogglingCourseId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadSemesters() }, [])
  useEffect(() => {
    if (selected) loadCourses(selected)
  }, [selected])

  async function loadSemesters() {
    try {
      const data = await getSemesterWorkspaces()
      setSemesters(data)
      setSelected((id) => id || data[0]?.id || '')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadCourses(semesterId) {
    try {
      const [courseItems, documentItems] = await Promise.all([
        getSemesterCourses(semesterId),
        getDocuments(),
      ])
      setCourses(courseItems)
      setDocuments(documentItems)
      setActiveCourse((current) => courseItems.find((course) => course.id === current?.id) || null)
    } catch (e) {
      setError(e.message)
    }
  }

  function replaceSemester(item) {
    setSemesters((items) => items.map((old) => old.id === item.id ? item : old))
  }

  function replaceCourse(item) {
    setCourses((items) => items.map((old) => old.id === item.id ? item : old))
    setActiveCourse((current) => current?.id === item.id ? item : current)
  }

  async function submitForm(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'semester') {
        const item = await createSemesterWorkspace({ semesterName })
        setSemesters((items) => [item, ...items])
        setSelected(item.id)
        setSemesterName('')
      }
      if (mode === 'edit-semester') {
        replaceSemester(await updateSemesterWorkspace(selected, { semesterName }))
        setSemesterName('')
      }
      if (mode === 'course') {
        const item = await createCourse({ ...courseForm, semesterWorkspaceId: selected })
        setCourses((items) => [item, ...items])
        setCourseForm(emptyCourse)
        setNotice(`${item.name} was created as inactive. Upload a document before activation.`)
      }
      if (mode === 'edit-course') {
        replaceCourse(await updateCourse(activeCourse.id, courseForm))
        setCourseForm(emptyCourse)
      }
      setMode('')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function changeSemesterStatus(status) {
    try {
      replaceSemester(await setSemesterStatus(selected, status))
      if (status === 'ARCHIVED') await loadCourses(selected)
    } catch (e) {
      setError(e.message)
    }
  }

  async function toggleCourseActive(course) {
    const activating = !course.isActive
    setTogglingCourseId(course.id)
    setError('')
    try {
      const item = await updateCourse(course.id, { isActive: activating })
      replaceCourse(item)
      setNotice(`${item.name} is now ${item.isActive ? 'available to all signed-in users' : 'inactive'}.`)
    } catch (e) {
      setError(
        activating && e.status === 409
          ? 'Course cần ít nhất một tài liệu đã xử lý trước khi kích hoạt.'
          : e.message,
      )
    } finally {
      setTogglingCourseId('')
    }
  }

  async function removeSemester() {
    if (!window.confirm('Archive this semester and all of its courses?')) return
    try {
      await deleteSemesterWorkspace(selected)
      setSelected('')
      setActiveCourse(null)
      await loadSemesters()
    } catch (e) {
      setError(e.message)
    }
  }

  async function removeCourse() {
    if (!window.confirm('Archive this course? It will no longer be available for chat.')) return
    try {
      await deleteCourse(activeCourse.id)
      setActiveCourse(null)
      await loadCourses(selected)
    } catch (e) {
      setError(e.message)
    }
  }

  async function upload(course, file) {
    if (!file) return
    setUploadingCourseId(course.id)
    setError('')
    setNotice(`Uploading and processing ${file.name}...`)
    try {
      await uploadFile(file, { courseId: course.id })
      setDocuments(await getDocuments())
      setNotice(`${file.name} was processed and indexed for ${course.name}.`)
    } catch (e) {
      setError(`Upload failed: ${e.message}`)
    } finally {
      setUploadingCourseId('')
    }
  }

  async function removeDocument(document) {
    if (!window.confirm(`Delete ${document.name}?`)) return
    try {
      await deleteDocument(document.id)
      await loadCourses(selected)
    } catch (e) {
      setError(e.message)
    }
  }

  const current = semesters.find((semester) => semester.id === selected)
  const openEditSemester = () => {
    setSemesterName(current?.name || '')
    setMode('edit-semester')
  }
  const openEditCourse = () => {
    setCourseForm({
      courseCode: activeCourse.code,
      courseName: activeCourse.name,
      description: activeCourse.description || '',
    })
    setMode('edit-course')
  }

  return <div className="space-y-4">
    <AdminPageHeader
      title="Course Management"
      description="Organize courses by semester, upload materials, and control availability."
      actions={<Button onClick={() => setMode('semester')}><Plus size={16}/>New semester</Button>}
    />
    {error && <Message tone="red" text={error} onClose={() => setError('')}/>}
    {notice && <Message text={notice} onClose={() => setNotice('')}/>}

    {loading
      ? <Panel className="p-8 text-center"><Loader2 className="mx-auto animate-spin"/></Panel>
      : !semesters.length
        ? <EmptyState
            title="No semester workspace"
            description="Create a semester before adding courses and materials."
            action={<Button onClick={() => setMode('semester')}>Create semester</Button>}
          />
        : <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
            <Panel className="p-4">
              <h2 className="mb-3 font-black">Semesters</h2>
              {semesters.map((semester) => <button
                key={semester.id}
                type="button"
                onClick={() => { setSelected(semester.id); setActiveCourse(null) }}
                className={`mb-2 w-full rounded-xl border p-3 text-left transition ${semester.id === selected ? 'border-teal-400 bg-teal-50' : 'border-slate-200 bg-white hover:border-teal-200'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <b>{semester.name}</b>
                  <StatusBadge status={semester.status}/>
                </div>
              </button>)}
            </Panel>

            <div className="min-w-0 space-y-4">
              <Panel className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <p className="text-xs font-bold text-slate-500">Selected semester</p>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black">{current?.name}</h2>
                    <StatusBadge status={current?.status}/>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ActivityToggle
                    checked={current?.status === 'ACTIVE'}
                    label="Semester active"
                    onChange={() => changeSemesterStatus(current?.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE')}
                  />
                  <Button size="sm" variant="secondary" onClick={openEditSemester}><Edit3 size={14}/>Edit</Button>
                  <Button size="sm" variant="secondary" onClick={() => setMode('course')}><Plus size={14}/>Add course</Button>
                  <Button size="icon" variant="danger" aria-label="Archive semester" onClick={removeSemester}><Trash2 size={15}/></Button>
                </div>
              </Panel>

              {!activeCourse
                ? <CourseList
                    courses={courses}
                    documents={documents}
                    uploadingCourseId={uploadingCourseId}
                    togglingCourseId={togglingCourseId}
                    onManage={setActiveCourse}
                    onUpload={upload}
                    onToggleActive={toggleCourseActive}
                    onDeleteDocument={removeDocument}
                  />
                : <CourseDetail
                    course={activeCourse}
                    documents={documents.filter((document) => document.courseId === activeCourse.id)}
                    uploading={uploadingCourseId === activeCourse.id}
                    toggling={togglingCourseId === activeCourse.id}
                    onBack={() => setActiveCourse(null)}
                    onEdit={openEditCourse}
                    onToggleActive={() => toggleCourseActive(activeCourse)}
                    onArchive={removeCourse}
                    onUpload={upload}
                    onDeleteDocument={removeDocument}
                  />}
            </div>
          </div>}

    {mode && <EditorModal
      mode={mode}
      semesterName={semesterName}
      setSemesterName={setSemesterName}
      courseForm={courseForm}
      setCourseForm={setCourseForm}
      busy={busy}
      onSubmit={submitForm}
      onClose={() => setMode('')}
    />}
  </div>
}

function CourseList({ courses, documents, uploadingCourseId, togglingCourseId, onManage, onUpload, onToggleActive, onDeleteDocument }) {
  return <Panel className="p-5">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="font-black">Courses</h3>
      <span className="text-xs font-bold text-slate-500">{courses.length} course{courses.length === 1 ? '' : 's'}</span>
    </div>
    {courses.length
      ? <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {courses.map((course) => {
            const courseDocuments = documents.filter((document) => document.courseId === course.id)
            return <article className="p-4" key={course.id}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-primary"><BookOpen size={18}/></div>
                <div className="min-w-48 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{course.name}</b>
                    <AvailabilityBadge active={course.isActive}/>
                  </div>
                  <p className="text-sm text-slate-600">{course.code} · {course.description || 'Course knowledge base'}</p>
                </div>
                <ActivityToggle
                  checked={course.isActive}
                  disabled={togglingCourseId === course.id}
                  label="Course active"
                  onChange={() => onToggleActive(course)}
                />
                <UploadButton course={course} busy={uploadingCourseId === course.id} onUpload={onUpload}/>
                <Button size="sm" onClick={() => onManage(course)}>Manage</Button>
              </div>
              <DocumentList
                className="mt-3 sm:ml-14"
                documents={courseDocuments}
                compact
                onDeleteDocument={onDeleteDocument}
              />
            </article>
          })}
        </div>
      : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">No course in this semester yet.</p>}
  </Panel>
}

function CourseDetail({ course, documents, uploading, toggling, onBack, onEdit, onToggleActive, onArchive, onUpload, onDeleteDocument }) {
  return <Panel className="overflow-hidden">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5">
      <div>
        <button className="mb-2 text-sm font-bold text-teal-700 hover:text-teal-900" onClick={onBack}>← All courses</button>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-black">{course.name}</h2>
          <AvailabilityBadge active={course.isActive}/>
        </div>
        <p className="text-sm text-slate-600">{course.code}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ActivityToggle checked={course.isActive} disabled={toggling} label="Course active" onChange={onToggleActive}/>
        <Button size="sm" variant="secondary" onClick={onEdit}><Edit3 size={14}/>Edit</Button>
        <Button size="sm" variant="secondary" onClick={onArchive}><Archive size={14}/>Archive</Button>
      </div>
    </div>
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-black">Course materials</h3>
          <p className="text-sm text-slate-600">Uploaded files are chunked and indexed automatically.</p>
        </div>
        <UploadButton course={course} busy={uploading} primary onUpload={onUpload}/>
      </div>
      <DocumentList documents={documents} onDeleteDocument={onDeleteDocument}/>
    </div>
  </Panel>
}

function DocumentList({ className = '', documents, compact = false, onDeleteDocument }) {
  return <div className={className}>
    {documents.length
      ? <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50/70">
          {documents.map((document) => <div className="flex min-w-0 flex-wrap items-center gap-3 p-3" key={document.id}>
            <FileText className="shrink-0 text-teal-700" size={18}/>
            <div className="min-w-48 flex-1">
              <b className="block truncate text-sm text-slate-800">{document.name}</b>
              <p className="text-xs text-slate-500">{document.pages || 0} pages{Number.isFinite(document.chunks) ? ` · ${document.chunks} chunks` : ''}</p>
            </div>
            <StatusBadge status={document.processingStatus}/>
            <Button size="icon" variant="danger" aria-label={`Delete ${document.name}`} onClick={() => onDeleteDocument(document)}><Trash2 size={15}/></Button>
          </div>)}
        </div>
      : <p className={`rounded-xl border border-dashed border-slate-300 text-sm text-slate-600 ${compact ? 'p-3' : 'p-5'}`}>No materials uploaded.</p>}
  </div>
}

function UploadButton({ course, busy, primary = false, onUpload }) {
  return <label className={`inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition ${busy ? 'cursor-wait bg-slate-200 text-slate-500' : primary ? 'bg-primary text-white hover:bg-teal-800' : 'border border-teal-200 bg-white text-teal-800 hover:bg-teal-50'}`}>
    {busy ? <Loader2 className="animate-spin" size={15}/> : <Upload size={15}/>} {busy ? 'Processing...' : 'Upload'}
    <input
      className="hidden"
      type="file"
      accept=".pdf,.docx,.pptx,.txt"
      disabled={busy}
      onChange={(event) => {
        onUpload(course, event.target.files?.[0])
        event.target.value = ''
      }}
    />
  </label>
}

function AvailabilityBadge({ active }) {
  return <span className={`rounded-lg px-2 py-1 text-xs font-bold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
    {active ? 'Active' : 'Inactive'}
  </span>
}

function EditorModal({ mode, semesterName, setSemesterName, courseForm, setCourseForm, busy, onSubmit, onClose }) {
  const semester = mode.includes('semester')
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form onSubmit={onSubmit} className="os-panel w-full max-w-md p-5">
      <h2 className="text-xl font-black">{mode.startsWith('edit') ? 'Edit' : 'Create'} {semester ? 'semester' : 'course'}</h2>
      <div className="mt-4 space-y-3">
        {semester
          ? <Input label="Semester name" value={semesterName} onChange={setSemesterName}/>
          : <>
              <Input label="Course code" value={courseForm.courseCode} onChange={(value) => setCourseForm((old) => ({ ...old, courseCode: value }))}/>
              <Input label="Course name" value={courseForm.courseName} onChange={(value) => setCourseForm((old) => ({ ...old, courseName: value }))}/>
              <Input label="Description" required={false} value={courseForm.description} onChange={(value) => setCourseForm((old) => ({ ...old, description: value }))}/>
            </>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={busy} type="submit">{busy ? 'Saving...' : 'Save'}</Button>
      </div>
    </form>
  </div>
}

function Input({ label, onChange, required = true, ...props }) {
  return <label className="block text-sm font-bold text-slate-700">
    {label}
    <input
      required={required}
      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      onChange={(event) => onChange(event.target.value)}
      {...props}
    />
  </label>
}

function ActivityToggle({ checked, disabled = false, label, onChange }) {
  return <label className={`inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 ${disabled ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}>
    <span>{label}</span>
    <input type="checkbox" className="peer sr-only" checked={Boolean(checked)} disabled={disabled} onChange={onChange}/>
    <span className="relative h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-teal-600 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-500 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4"/>
    <span className={checked ? 'text-emerald-700' : 'text-slate-500'}>{checked ? 'On' : 'Off'}</span>
  </label>
}

function Message({ tone, text, onClose }) {
  return <div className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-sm font-bold ${tone === 'red' ? 'border-red-200 bg-red-50 text-red-700' : 'border-teal-200 bg-teal-50 text-teal-800'}`}>
    <span>{text}</span>
    <button aria-label="Dismiss" onClick={onClose}><X size={16}/></button>
  </div>
}
