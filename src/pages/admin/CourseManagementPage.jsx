import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, BookOpen, Boxes, Layers3, Loader2, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, EmptyState, Panel, StatusBadge } from '../../components/ui.jsx'
import {
  createChapter,
  createCourse,
  createWorkspace,
  getChapters,
  getCourses,
  getWorkspacesByCourse,
} from '../../services/courseService.js'
import { AdminPageHeader } from '../../layouts/AdminLayout.jsx'
import { cn } from '../../utils/cn.js'

const blankForm = {
  courseCode: '',
  courseName: '',
  description: '',
  chapterTitle: '',
  orderIndex: '',
  workspaceTitle: '',
  visibility: 'COURSE',
}

export default function CourseManagementPage() {
  const [courses, setCourses] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [chapters, setChapters] = useState([])
  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [structureLoading, setStructureLoading] = useState(false)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState('')
  const [form, setForm] = useState(blankForm)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    getCourses()
      .then((items) => {
        if (!active) return
        setCourses(items)
        if (items[0]) setStructureLoading(true)
        setSelectedId((current) => current || items[0]?.id || '')
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return undefined

    let active = true
    Promise.all([getChapters(selectedId), getWorkspacesByCourse(selectedId)])
      .then(([nextChapters, nextWorkspaces]) => {
        if (!active) return
        setChapters(nextChapters)
        setWorkspaces(nextWorkspaces)
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setStructureLoading(false))
    return () => {
      active = false
    }
  }, [selectedId])

  const selectedCourse = courses.find((course) => course.id === selectedId)

  function openDialog(type) {
    setForm(blankForm)
    setError('')
    setDialog(type)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      if (dialog === 'course') {
        const created = await createCourse({
          courseCode: form.courseCode.trim(),
          courseName: form.courseName.trim(),
          description: form.description.trim() || null,
        })
        setCourses((current) => [created, ...current])
        setStructureLoading(true)
        setSelectedId(created.id)
      } else if (dialog === 'chapter') {
        const created = await createChapter(selectedId, {
          chapterTitle: form.chapterTitle.trim(),
          description: form.description.trim() || null,
          orderIndex: form.orderIndex ? Number(form.orderIndex) : null,
        })
        setChapters((current) => [...current, created].sort((a, b) => a.orderIndex - b.orderIndex))
      } else {
        const created = await createWorkspace(selectedId, {
          workspaceTitle: form.workspaceTitle.trim(),
          description: form.description.trim() || null,
          visibility: form.visibility,
        })
        setWorkspaces((current) => [created, ...current])
      }
      setDialog('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        actions={<Button onClick={() => openDialog('course')}><Plus size={16} />New course</Button>}
        description="Create courses and organize their chapters and learning workspaces."
        icon={BookOpen}
        title="Courses"
      />

      {error ? <Alert message={error} /> : null}
      {loading ? <Loading label="Loading courses" /> : courses.length === 0 ? (
        <EmptyState
          action={<Button onClick={() => openDialog('course')}><Plus size={16} />Create first course</Button>}
          description="Create a course before adding chapters and workspaces."
          title="No courses yet"
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.5fr)]">
          <Panel className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">Available courses</h2>
                <p className="text-sm font-semibold text-slate-500">{courses.length} active courses</p>
              </div>
              <BookOpen className="text-primary" size={20} />
            </div>
            <div className="space-y-2">
              {courses.map((course) => (
                <button
                  className={cn(
                    'w-full rounded-lg border p-3 text-left transition',
                    selectedId === course.id
                      ? 'border-teal-300 bg-teal-50 shadow-sm'
                      : 'border-slate-200 bg-white/80 hover:border-teal-200',
                  )}
                  key={course.id}
                  onClick={() => { setStructureLoading(true); setError(''); setSelectedId(course.id) }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{course.name}</p>
                      <p className="mt-1 text-xs font-black uppercase text-slate-500">{course.code}</p>
                    </div>
                    <StatusBadge status={course.isActive ? 'Indexed' : 'Uploaded'} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-600">
                    {course.description || 'No description'}
                  </p>
                </button>
              ))}
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-xs font-black uppercase text-slate-500">Selected course</p>
                <h2 className="mt-1 text-xl font-black">{selectedCourse?.name}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => openDialog('chapter')} variant="secondary"><Plus size={16} />Chapter</Button>
                <Button onClick={() => openDialog('workspace')} variant="accent"><Plus size={16} />Workspace</Button>
              </div>
            </Panel>

            {structureLoading ? <Loading label="Loading course structure" /> : (
              <div className="grid gap-4 md:grid-cols-2">
                <StructurePanel
                  empty="No chapters in this course."
                  icon={Layers3}
                  items={chapters.map((chapter) => ({
                    id: chapter.id,
                    title: chapter.title,
                    meta: `Order ${chapter.orderIndex}`,
                    description: chapter.description,
                  }))}
                  title="Chapters"
                />
                <StructurePanel
                  empty="No workspaces in this course."
                  icon={Boxes}
                  items={workspaces.map((workspace) => ({
                    id: workspace.id,
                    title: workspace.name,
                    meta: workspace.visibility,
                    description: workspace.description,
                  }))}
                  title="Workspaces"
                />
              </div>
            )}
          </div>
        </div>
      )}

      <EditorDialog
        form={form}
        mode={dialog}
        onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
        onClose={() => setDialog('')}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  )
}

function StructurePanel({ empty, icon: Icon, items, title }) {
  return (
    <Panel className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-black">{title}</h3>
        <Icon className="text-primary" size={18} />
      </div>
      <div className="space-y-2">
        {items.length ? items.map((item) => (
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3" key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-black">{item.title}</p>
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">{item.meta}</span>
            </div>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{item.description || 'No description'}</p>
          </div>
        )) : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">{empty}</p>}
      </div>
    </Panel>
  )
}

function EditorDialog({ form, mode, onChange, onClose, onSubmit, submitting }) {
  if (!mode) return null
  const title = mode === 'course' ? 'Create course' : mode === 'chapter' ? 'Create chapter' : 'Create workspace'

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.form className="os-panel w-full max-w-lg p-5 shadow-2xl" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} onSubmit={onSubmit}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">{title}</h2>
            <button aria-label="Close" className="grid size-9 place-items-center rounded-lg hover:bg-slate-100" onClick={onClose} type="button"><X size={17} /></button>
          </div>
          <div className="mt-5 space-y-3">
            {mode === 'course' ? (
              <>
                <Input label="Course code" onChange={(value) => onChange('courseCode', value)} required value={form.courseCode} />
                <Input label="Course name" onChange={(value) => onChange('courseName', value)} required value={form.courseName} />
              </>
            ) : mode === 'chapter' ? (
              <>
                <Input label="Chapter title" onChange={(value) => onChange('chapterTitle', value)} required value={form.chapterTitle} />
                <Input label="Order index (optional)" min="1" onChange={(value) => onChange('orderIndex', value)} type="number" value={form.orderIndex} />
              </>
            ) : (
              <>
                <Input label="Workspace title" onChange={(value) => onChange('workspaceTitle', value)} required value={form.workspaceTitle} />
                <label className="block text-sm font-black text-slate-700">Visibility
                  <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-teal-400" onChange={(event) => onChange('visibility', event.target.value)} value={form.visibility}>
                    <option value="COURSE">Course</option>
                    <option value="PRIVATE">Private</option>
                    <option value="PUBLIC">Public</option>
                  </select>
                </label>
              </>
            )}
            <label className="block text-sm font-black text-slate-700">Description
              <textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-semibold outline-none focus:border-teal-400" onChange={(event) => onChange('description', event.target.value)} value={form.description} />
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={onClose} type="button" variant="secondary">Cancel</Button>
            <Button disabled={submitting} type="submit">{submitting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}{title}</Button>
          </div>
        </motion.form>
      </motion.div>
    </AnimatePresence>
  )
}

function Input({ label, onChange, ...props }) {
  return <label className="block text-sm font-black text-slate-700">{label}<input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-semibold outline-none focus:border-teal-400" onChange={(event) => onChange(event.target.value)} {...props} /></label>
}

function Loading({ label }) {
  return <Panel className="flex min-h-40 items-center justify-center gap-3 p-5 text-sm font-black text-slate-600"><Loader2 className="animate-spin text-primary" size={20} />{label}</Panel>
}

function Alert({ message }) {
  return <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700"><AlertTriangle className="mt-0.5 shrink-0" size={17} />{message}</div>
}
