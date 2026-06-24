import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Database,
  Eye,
  FilePlus2,
  FileText,
  Filter,
  Grid2X2,
  Layers,
  RefreshCcw,
  Search,
  Table2,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Button,
  ConfirmModal,
  EmptyState,
  Field,
  IconButton,
  Panel,
  SelectField,
  StatusBadge,
} from '../components/ui.jsx'
import { getSavedUser } from '../services/authService.js'
import { getCourses, getChapters, getWorkspaces, getWorkspacesByCourse } from '../services/courseService.js'
import {
  deleteDocument,
  getDocumentChunks,
  getDocumentPreviewUrl,
  getDocumentsByWorkspace,
  uploadDocument,
} from '../services/documentService.js'
import { getActiveEmbeddingModel, prepareEmbeddings } from '../services/ragService.js'
import { cn } from '../utils/cn.js'

const allOption = 'All'
const fileTypes = [allOption, 'PDF', 'DOCX', 'PPTX', 'TXT']
const statuses = [allOption, 'Uploaded', 'Processing', 'Indexed', 'Failed']

// ─── File type colour helpers ────────────────────────────────────────────────

function fileTypeColors(type) {
  switch ((type ?? '').toUpperCase()) {
    case 'PDF':
      return { bg: 'bg-red-50', text: 'text-red-600', icon: 'bg-red-100' }
    case 'DOCX':
    case 'DOC':
      return { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'bg-blue-100' }
    case 'PPTX':
    case 'PPT':
      return { bg: 'bg-orange-50', text: 'text-orange-600', icon: 'bg-orange-100' }
    case 'TXT':
      return { bg: 'bg-slate-50', text: 'text-slate-500', icon: 'bg-slate-100' }
    default:
      return { bg: 'bg-teal-50', text: 'text-teal-600', icon: 'bg-teal-100' }
  }
}

// ─── LibraryPage ──────────────────────────────────────────────────────────────

function LibraryPage() {
  // Data
  const [docs, setDocs] = useState([])
  const [workspaceList, setWorkspaceList] = useState([])
  const [courses, setCourses] = useState([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('')

  // UI state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('bento')
  const [docToDelete, setDocToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [reindexingIds, setReindexingIds] = useState(new Set()) // doc IDs currently re-indexing

  // Filters
  const [query, setQuery] = useState('')
  const [filterCourseId, setFilterCourseId] = useState(allOption)
  const [filterType, setFilterType] = useState(allOption)
  const [filterStatus, setFilterStatus] = useState(allOption)

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false)

  // Load courses + workspaces once on mount
  useEffect(() => {
    getCourses()
      .then(setCourses)
      .catch(() => {})
  }, [])

  // Load documents whenever workspace changes
  useEffect(() => {
    let isMounted = true

    async function loadLibrary() {
      setLoading(true)
      setError('')

      try {
        const workspaces = await getWorkspaces()
        if (!isMounted) return

        setWorkspaceList(workspaces)
        const selectedId = activeWorkspaceId || workspaces[0]?.id || ''
        if (!activeWorkspaceId && workspaces[0]?.id) {
          setActiveWorkspaceId(workspaces[0].id)
          // the state change will trigger this effect again, so bail early
          return
        }

        if (!selectedId) {
          setDocs([])
          return
        }

        const documents = await getDocumentsByWorkspace(selectedId)
        

        const documentsWithChunks = await Promise.all(
          documents.map(async (doc) => {
            const chunks = await getDocumentChunks(doc.id).catch(() => [])
            const workspace = workspaces.find((w) => w.id === doc.workspaceId)
            const course = courses.find((c) => c.id === doc.courseId)
            return {
              ...doc,
              subject: workspace?.name ?? doc.subject,
              courseName: course?.name ?? '',
              chunks: chunks.length,
              embeddingModel: chunks.length > 0 ? doc.embeddingModel : 'Not embedded',
            }
          }),
        )

        if (isMounted) setDocs(documentsWithChunks)
      } catch (loadError) {
        if (isMounted) setError(loadError.message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadLibrary()
    return () => { isMounted = false }
  }, [activeWorkspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered list
  const filteredDocs = useMemo(() => {
    return docs.filter((doc) => {
      const q = query.trim().toLowerCase()
      const matchesQuery = !q || doc.displayName.toLowerCase().includes(q)
      const matchesCourse =
        filterCourseId === allOption || doc.courseId === filterCourseId
      const matchesType =
        filterType === allOption || doc.type === filterType
      const matchesStatus =
        filterStatus === allOption || doc.status === filterStatus
      return matchesQuery && matchesCourse && matchesType && matchesStatus
    })
  }, [docs, query, filterCourseId, filterType, filterStatus])

  function resetFilters() {
    setQuery('')
    setFilterCourseId(allOption)
    setFilterType(allOption)
    setFilterStatus(allOption)
  }

  // Delete
  async function confirmDeleteDocument() {
    if (!docToDelete) return
    setDeleting(true)
    setError('')
    try {
      await deleteDocument(docToDelete.id)
      setDocs((curr) => curr.filter((d) => d.id !== docToDelete.id))
      setDocToDelete(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  // After upload: add docs to list
  function handleUploaded(newDocs) {
    setDocs((curr) => [...newDocs, ...curr])
  }

  // Re-index: call real API
  async function handleReindex(doc) {
    if (reindexingIds.has(doc.id)) return
    setReindexingIds((prev) => new Set([...prev, doc.id]))
    setError('')

    try {
      // Mark as Processing immediately
      setDocs((curr) =>
        curr.map((d) => (d.id === doc.id ? { ...d, status: 'Processing' } : d)),
      )

      const model = await getActiveEmbeddingModel()
      if (!model) throw new Error('No active embedding model found. Ask admin to configure one.')

      const result = await prepareEmbeddings(doc.id, doc.workspaceId, model.embeddingModelId)

      setDocs((curr) =>
        curr.map((d) =>
          d.id === doc.id
            ? {
                ...d,
                status: 'Indexed',
                chunks: result?.totalChunks ?? result?.createdEmbeddings ?? d.chunks,
                embeddingModel: model.modelName,
              }
            : d,
        ),
      )
    } catch (err) {
      setError(`Re-index failed for "${doc.displayName}": ${err.message}`)
      setDocs((curr) =>
        curr.map((d) => (d.id === doc.id ? { ...d, status: 'Failed' } : d)),
      )
    } finally {
      setReindexingIds((prev) => {
        const next = new Set(prev)
        next.delete(doc.id)
        return next
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Hero Header ──────────────────────────────────────────────────── */}
      <Panel className="overflow-hidden p-5">
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="abstract-canvas" />
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="grid size-10 place-items-center rounded-xl bg-teal-500 text-white shadow-lg shadow-teal-200">
                <BookOpen size={20} />
              </div>
              <span className="text-xs font-black uppercase tracking-[0.16em] text-teal-600">
                Knowledge Base
              </span>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Library
            </h1>
            <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              Upload, manage and index course documents for AI-powered Q&A.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SelectField
              label="Workspace"
              onChange={(e) => setActiveWorkspaceId(e.target.value)}
              value={activeWorkspaceId}
            >
              {workspaceList.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </SelectField>

            <Button
              disabled={!activeWorkspaceId}
              onClick={() => setShowUploadModal(true)}
            >
              <Upload size={16} />
              Upload
            </Button>

            <Button onClick={resetFilters} variant="secondary">
              <RefreshCcw size={15} />
              Reset
            </Button>
          </div>
        </div>

        {/* Error banner */}
        {error ? (
          <div className="relative mt-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <XCircle className="mt-0.5 shrink-0 text-red-500" size={16} />
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </div>
        ) : null}

        {/* Loading banner */}
        {loading ? (
          <div className="relative mt-4 rounded-lg border border-teal-100 bg-teal-50 p-3 text-sm font-semibold text-teal-700">
            Loading documents…
          </div>
        ) : null}

        {/* Stats */}
        <div className="relative mt-5 grid gap-3 md:grid-cols-3">
          <StatCard icon={FileText} label="Documents" value={docs.length} />
          <StatCard
            icon={Database}
            label="Indexed"
            value={docs.filter((d) => d.status === 'Indexed').length}
          />
          <StatCard
            icon={Layers}
            label="Chunks"
            value={docs.reduce((t, d) => t + d.chunks, 0)}
          />
        </div>
      </Panel>

      {/* ── Filter Toolbar ────────────────────────────────────────────────── */}
      <Panel className="p-3 sm:p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <Field
            icon={Search}
            label="Search documents"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by filename…"
            value={query}
          />

          {/* Course filter */}
          <SelectField
            label="Course"
            onChange={(e) => setFilterCourseId(e.target.value)}
            value={filterCourseId}
          >
            <option value={allOption}>All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="File type"
            onChange={(e) => setFilterType(e.target.value)}
            value={filterType}
          >
            {fileTypes.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </SelectField>

          <SelectField
            label="Status"
            onChange={(e) => setFilterStatus(e.target.value)}
            value={filterStatus}
          >
            {statuses.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </SelectField>

          {/* View toggle */}
          <div className="flex rounded-lg bg-white/72 p-1 shadow-inner">
            <IconButton
              className={
                viewMode === 'bento'
                  ? 'bg-primary text-white hover:bg-teal-800 hover:text-white'
                  : ''
              }
              label="Grid view"
              onClick={() => setViewMode('bento')}
            >
              <Grid2X2 size={15} />
            </IconButton>
            <IconButton
              className={
                viewMode === 'table'
                  ? 'bg-primary text-white hover:bg-teal-800 hover:text-white'
                  : ''
              }
              label="Table view"
              onClick={() => setViewMode('table')}
            >
              <Table2 size={15} />
            </IconButton>
          </div>
        </div>
      </Panel>

      {/* ── Content area ─────────────────────────────────────────────────── */}
      {!loading && docs.length === 0 ? (
        <EmptyUploadZone
          hasWorkspace={!!activeWorkspaceId}
          onUpload={() => setShowUploadModal(true)}
        />
      ) : !loading && filteredDocs.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={resetFilters} variant="secondary">
              Clear filters
            </Button>
          }
          description="No documents match the current filters."
          title="No matching documents"
        />
      ) : viewMode === 'bento' ? (
        <DocumentCards docs={filteredDocs} onDelete={setDocToDelete} onReindex={handleReindex} reindexingIds={reindexingIds} />
      ) : (
        <DocumentTable docs={filteredDocs} onDelete={setDocToDelete} onReindex={handleReindex} reindexingIds={reindexingIds} />
      )}

      {/* Compact table always under bento */}
      {viewMode === 'bento' && filteredDocs.length > 0 ? (
        <DocumentTable docs={filteredDocs} onDelete={setDocToDelete} onReindex={handleReindex} reindexingIds={reindexingIds} compact />
      ) : null}

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      {docToDelete ? (
        <ConfirmModal
          actionLabel="Delete document"
          onCancel={() => setDocToDelete(null)}
          onConfirm={confirmDeleteDocument}
          title="Delete document?"
        >
          "{docToDelete.displayName}" will be permanently removed.
          {deleting ? ' Deleting…' : ''}
        </ConfirmModal>
      ) : null}

      {/* ── Upload Modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showUploadModal ? (
          <UploadModal
            courses={courses}
            defaultWorkspaceId={activeWorkspaceId}
            workspaces={workspaceList}
            onClose={() => setShowUploadModal(false)}
            onUploaded={handleUploaded}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

// ─── Empty upload zone ────────────────────────────────────────────────────────

function EmptyUploadZone({ hasWorkspace, onUpload }) {
  return (
    <motion.div
      className="drop-zone-base flex min-h-[320px] flex-col items-center justify-center gap-6 rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/40 p-10 text-center"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="grid size-20 place-items-center rounded-2xl bg-teal-100 text-teal-500 shadow-inner">
        <FilePlus2 size={36} />
      </div>
      <div>
        <h2 className="text-xl font-black tracking-tight text-slate-900">No documents yet</h2>
        <p className="mt-2 max-w-sm text-sm font-semibold text-slate-500">
          {hasWorkspace
            ? 'Upload PDF, DOCX, PPTX, or TXT files to start indexing documents for AI-powered Q&A.'
            : 'No workspace found. Ask an admin to create a course and workspace first.'}
        </p>
      </div>
      {hasWorkspace ? (
        <Button onClick={onUpload}>
          <Upload size={16} />
          Upload first document
        </Button>
      ) : null}
    </motion.div>
  )
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

function UploadModal({ courses, defaultWorkspaceId, workspaces, onClose, onUploaded }) {
  const [files, setFiles] = useState([])
  const [progresses, setProgresses] = useState({}) // filename → 0-100
  const [uploadCourseId, setUploadCourseId] = useState('')
  const [uploadChapterId, setUploadChapterId] = useState('')
  const [uploadWorkspaceId, setUploadWorkspaceId] = useState(defaultWorkspaceId)
  const [chapters, setChapters] = useState([])
  const [courseWorkspaces, setCourseWorkspaces] = useState([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)


  const acceptFiles = useCallback((incoming) => {
    const accepted = Array.from(incoming).filter((f) =>
      /\.(pdf|docx|pptx|txt)$/i.test(f.name),
    )
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name))
      return [...prev, ...accepted.filter((f) => !existingNames.has(f.name))]
    })
  }, [])

  function handleDrop(e) {
    e.preventDefault()
    setIsDragOver(false)
    acceptFiles(e.dataTransfer.files)
  }

  function removeFile(name) {
    setFiles((prev) => prev.filter((f) => f.name !== name))
  }

  async function handleSubmit() {
    if (files.length === 0 || !uploadWorkspaceId) return

    setUploading(true)
    setError('')

    const user = getSavedUser()
    const targetWorkspace =
      workspaces.find((w) => w.id === uploadWorkspaceId) ??
      courseWorkspaces.find((w) => w.id === uploadWorkspaceId)

    const uploadedDocs = []

    for (const file of files) {
      setProgresses((prev) => ({ ...prev, [file.name]: 10 }))
      try {
        // Fake mid-progress
        setProgresses((prev) => ({ ...prev, [file.name]: 45 }))

        const doc = await uploadDocument({
          file,
          workspaceId: uploadWorkspaceId,
          courseId: uploadCourseId || targetWorkspace?.courseId,
          chapterId: uploadChapterId || undefined,
          uploadedBy: user?.id,
        })

        setProgresses((prev) => ({ ...prev, [file.name]: 100 }))
        uploadedDocs.push({
          ...doc,
          subject: targetWorkspace?.name ?? doc.subject,
          chunks: 0,
        })
      } catch (err) {
        setProgresses((prev) => ({ ...prev, [file.name]: -1 })) // -1 = error
        setError(`Failed to upload "${file.name}": ${err.message}`)
      }
    }

    setUploading(false)
    if (uploadedDocs.length > 0) {
      onUploaded(uploadedDocs)
      onClose()
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        className="os-panel w-full max-w-lg p-6 shadow-2xl"
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-teal-500 text-white">
              <Upload size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-950">
                Upload Documents
              </h2>
              <p className="text-xs font-semibold text-slate-500">PDF · DOCX · PPTX · TXT</p>
            </div>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        {/* Drop zone */}
        <div
          className={cn(
            'drop-zone-base mb-5 flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
            isDragOver
              ? 'drop-zone-active border-teal-400 bg-teal-50'
              : 'border-slate-200 bg-slate-50 hover:border-teal-300 hover:bg-teal-50/50',
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="grid size-14 place-items-center rounded-2xl bg-white shadow-sm text-teal-500">
            <Upload size={26} />
          </div>
          <div>
            <p className="font-black text-slate-800">Drag & drop or click to browse</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">Max file types: PDF, DOCX, PPTX, TXT</p>
          </div>
        </div>

        <input
          accept=".pdf,.docx,.pptx,.txt"
          className="sr-only"
          multiple
          onChange={(e) => acceptFiles(e.target.files)}
          ref={fileInputRef}
          type="file"
        />

        {/* Cascading selectors */}
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Course"
            onChange={(e) => {
              const cid = e.target.value
              setUploadCourseId(cid)
              setUploadChapterId('')
              if (!cid) {
                setChapters([])
                setCourseWorkspaces([])
                setUploadWorkspaceId(defaultWorkspaceId)
              } else {
                getChapters(cid)
                  .then(setChapters)
                  .catch(() => setChapters([]))

                getWorkspacesByCourse(cid)
                  .then((ws) => {
                    setCourseWorkspaces(ws)
                    if (ws.length > 0) setUploadWorkspaceId(ws[0].id)
                  })
                  .catch(() => setCourseWorkspaces([]))
              }
            }}
            value={uploadCourseId}
          >
            <option value="">Select course…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Chapter (optional)"
            disabled={!uploadCourseId || chapters.length === 0}
            onChange={(e) => setUploadChapterId(e.target.value)}
            value={uploadChapterId}
          >
            <option value="">No chapter</option>
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.title}
              </option>
            ))}
          </SelectField>

          <div className="sm:col-span-2">
            <SelectField
              label="Workspace"
              onChange={(e) => setUploadWorkspaceId(e.target.value)}
              value={uploadWorkspaceId}
            >
              <option value="">Select workspace…</option>
              {(courseWorkspaces.length > 0 ? courseWorkspaces : workspaces).map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </SelectField>
          </div>
        </div>

        {/* File list */}
        {files.length > 0 ? (
          <div className="mb-4 max-h-48 space-y-2 overflow-y-auto">
            {files.map((file) => {
              const prog = progresses[file.name]
              const isError = prog === -1
              const isDone = prog === 100

              return (
                <div
                  key={file.name}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-2.5 text-sm',
                    isError ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-white',
                  )}
                >
                  <FileText className={isError ? 'text-red-400' : 'text-teal-500'} size={16} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">{file.name}</p>
                    {prog != null && prog >= 0 ? (
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <motion.div
                          className={cn(
                            'h-full rounded-full',
                            isDone ? 'bg-emerald-400' : 'bg-teal-400',
                          )}
                          animate={{ width: `${prog}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    ) : null}
                  </div>
                  {isDone ? (
                    <CheckCircle2 className="shrink-0 text-emerald-500" size={16} />
                  ) : !uploading ? (
                    <button
                      className="shrink-0 text-slate-400 hover:text-red-500"
                      onClick={() => removeFile(file.name)}
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}

        {/* Error */}
        {error ? (
          <div className="mb-3 space-y-2">
            <p className="rounded-lg bg-red-50 p-2.5 text-sm font-semibold text-red-600">
              {error}
            </p>
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-2">

          <Button disabled={uploading} onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={uploading || files.length === 0 || !uploadWorkspaceId}
            onClick={handleSubmit}
          >
            <Upload size={16} />
            {uploading ? 'Uploading…' : `Upload ${files.length || ''} file${files.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value }) {
  return (
    <motion.div className="bento-card p-4" whileHover={{ y: -4 }}>
      <div className="flex items-center justify-between">
        <div className="grid size-10 place-items-center rounded-xl bg-teal-50 text-primary shadow-sm">
          <Icon size={17} />
        </div>
        <p className="text-3xl font-black">{value}</p>
      </div>
      <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
    </motion.div>
  )
}

// ─── DocumentCards ────────────────────────────────────────────────────────────

function DocumentCards({ docs, onDelete, onReindex, reindexingIds = new Set() }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {docs.map((doc, index) => {
        const colors = fileTypeColors(doc.type)
        const isReindexing = reindexingIds.has(doc.id)
        return (
          <motion.article
            className="bento-card group p-4"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03, duration: 0.32 }}
            key={doc.id}
            whileHover={{ y: -6 }}
            style={{ '--glow': 'rgba(20,184,166,0.12)' }}
          >
            {/* Card header */}
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-xl shadow-sm transition group-hover:scale-105',
                  colors.icon,
                  colors.text,
                )}
              >
                <FileText size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-black text-slate-950">{doc.displayName}</h2>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-400">
                  {doc.subject}
                </p>
              </div>
              <StatusBadge status={doc.status} />
            </div>

            {/* Metadata chips */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              <span className={cn('rounded-md px-2 py-1 text-xs font-black', colors.bg, colors.text)}>
                {doc.type}
              </span>
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">
                {doc.chunks} chunks
              </span>
              {doc.pages > 0 ? (
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                  {doc.pages} pages
                </span>
              ) : null}
            </div>

            {/* Uploaded at */}
            <p className="mt-3 text-xs font-semibold text-slate-400">{doc.uploadedAt}</p>

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="flex-1" to={`/library/documents/${doc.id}`}>
                <Button className="w-full" variant="secondary">
                  <Eye size={15} />
                  View
                </Button>
              </Link>
              <IconButton
                label="Preview file"
                onClick={() =>
                  window.open(getDocumentPreviewUrl(doc.id), '_blank', 'noopener,noreferrer')
                }
              >
                <FileText size={15} />
              </IconButton>
              <IconButton
                label={isReindexing ? 'Re-indexing…' : 'Re-index'}
                disabled={isReindexing}
                onClick={() => onReindex(doc)}
                className={isReindexing ? 'animate-spin text-teal-500' : ''}
              >
                <RefreshCcw size={15} />
              </IconButton>
              <IconButton label="Delete" onClick={() => onDelete(doc)}>
                <Trash2 size={15} />
              </IconButton>
            </div>
          </motion.article>
        )
      })}
    </div>
  )
}

// ─── DocumentTable ────────────────────────────────────────────────────────────

function DocumentTable({ compact = false, docs, onDelete, onReindex, reindexingIds = new Set() }) {
  return (
    <Panel className={cn('overflow-hidden', compact ? 'hidden xl:block' : '')}>
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="text-lg font-black tracking-tight">All documents</h2>
          <p className="text-sm font-semibold text-slate-500">
            {docs.length} document{docs.length !== 1 ? 's' : ''} in this workspace
          </p>
        </div>
        <Table2 className="text-slate-400" size={20} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="bg-white/52 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            <tr>
              {['Document', 'Type', 'Workspace', 'Status', 'Chunks', 'Pages', 'Uploaded', 'Actions'].map(
                (h) => (
                  <th className="border-b border-slate-200 px-4 py-3" key={h}>
                    <span className="inline-flex items-center gap-1">
                      {h}
                      {h === 'Document' ? <ArrowUpDown size={13} /> : null}
                    </span>
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {docs.map((doc) => {
              const colors = fileTypeColors(doc.type)
              return (
                <motion.tr
                  className="bg-white/70 transition hover:bg-teal-50/60"
                  key={doc.id}
                  whileHover={{ scale: 1.002 }}
                >
                  <td className="max-w-[240px] px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'grid size-9 shrink-0 place-items-center rounded-xl',
                          colors.icon,
                          colors.text,
                        )}
                      >
                        <FileText size={15} />
                      </div>
                      <p className="truncate font-black text-slate-950">{doc.displayName}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={cn('rounded-md px-2 py-1 text-xs font-black', colors.bg, colors.text)}>
                      {doc.type}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{doc.subject}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-600">{doc.chunks}</td>
                  <td className="px-4 py-4 font-semibold text-slate-500">{doc.pages || '—'}</td>
                  <td className="px-4 py-4 text-slate-500">{doc.uploadedAt}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <Link to={`/library/documents/${doc.id}`}>
                        <IconButton label="View details">
                          <Eye size={15} />
                        </IconButton>
                      </Link>
                      <IconButton
                        label="Preview file"
                        onClick={() =>
                          window.open(
                            getDocumentPreviewUrl(doc.id),
                            '_blank',
                            'noopener,noreferrer',
                          )
                        }
                      >
                        <FileText size={15} />
                      </IconButton>
                      <IconButton
                        label={reindexingIds.has(doc.id) ? 'Re-indexing…' : 'Re-index'}
                        disabled={reindexingIds.has(doc.id)}
                        onClick={() => onReindex(doc)}
                        className={reindexingIds.has(doc.id) ? 'animate-spin text-teal-500' : ''}
                      >
                        <RefreshCcw size={15} />
                      </IconButton>
                      <IconButton label="Delete" onClick={() => onDelete(doc)}>
                        <Trash2 size={15} />
                      </IconButton>
                    </div>
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

export default LibraryPage
