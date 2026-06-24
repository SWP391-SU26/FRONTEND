import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  HardDrive,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BentoCard, Button, ConfirmModal, EmptyState, Panel, StatusBadge } from '../components/ui.jsx'
import {
  deleteDocument,
  getDocument,
  getDocumentFileUrl,
  getDocumentPreviewUrl,
} from '../services/documentService.js'

function DocumentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [previewState, setPreviewState] = useState({ loading: true, available: false, message: '' })

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setLoading(true)
      setError('')
      try {
        if (id.startsWith('mock_doc_')) {
          const simulatedList = JSON.parse(localStorage.getItem('fstu_simulated_docs') ?? '[]')
          const found = simulatedList.find((d) => d.id === id)
          if (!found) throw new Error('Simulated document not found')

          if (isMounted) {
            setDoc(found)
          }
          return
        }

        const docData = await getDocument(id)
        if (!isMounted) return
        setDoc(docData)
      } catch (err) {
        if (isMounted) setError(err.message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [id])

  useEffect(() => {
    if (!doc) return

    let isMounted = true

    async function checkPreview() {
      if (id.startsWith('mock_doc_')) {
        setPreviewState({
          loading: false,
          available: false,
          message: 'Preview is not available for simulated mock documents (mock documents do not store real files).',
        })
        return
      }

      if (doc.type === 'PDF') {
        setPreviewState({ loading: false, available: true, message: '' })
        return
      }

      setPreviewState({ loading: true, available: false, message: '' })

      try {
        const response = await fetch(getDocumentPreviewUrl(doc.id), { method: 'HEAD' })
        if (!isMounted) return

        if (response.ok) {
          setPreviewState({ loading: false, available: true, message: '' })
          return
        }

        setPreviewState({
          loading: false,
          available: false,
          message:
            response.status === 501
              ? 'DOCX/PPTX preview cần cài LibreOffice ở backend để convert sang PDF.'
              : 'Không tạo được preview hoàn chỉnh cho file này.',
        })
      } catch {
        if (isMounted) {
          setPreviewState({
            loading: false,
            available: false,
            message: 'Không kết nối được preview API.',
          })
        }
      }
    }

    checkPreview()

    return () => {
      isMounted = false
    }
  }, [doc, id])

  const fileUrl = doc ? (id.startsWith('mock_doc_') ? '#' : getDocumentFileUrl(doc.id)) : '#'
  const previewUrl = doc ? (doc.type === 'PDF' ? fileUrl : (id.startsWith('mock_doc_') ? '#' : getDocumentPreviewUrl(doc.id))) : '#'

  async function handleDeleteDocument() {
    setDeleting(true)
    try {
      if (id.startsWith('mock_doc_')) {
        const simulatedList = JSON.parse(localStorage.getItem('fstu_simulated_docs') ?? '[]')
        const updated = simulatedList.filter((d) => d.id !== id)
        localStorage.setItem('fstu_simulated_docs', JSON.stringify(updated))
      } else {
        await deleteDocument(id)
      }
      navigate('/library')
    } catch (err) {
      setError(err.message)
      setShowDeleteModal(false)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-teal-100 bg-teal-50/20 text-teal-600">
        <div className="text-center font-bold">
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent mx-auto"></div>
          Loading document details…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        action={
          <Link to="/library">
            <Button variant="secondary">
              <ArrowLeft size={16} />
              Back to Library
            </Button>
          </Link>
        }
        description={`Error loading document: ${error}`}
        title="Error loading document"
      />
    )
  }

  if (!doc) {
    return (
      <EmptyState
        action={
          <Link to="/library">
            <Button variant="secondary">
              <ArrowLeft size={16} />
              Back to Library
            </Button>
          </Link>
        }
        description="This document does not exist in the knowledge base."
        title="Document not found"
      />
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12 min-h-[calc(100vh-4rem)] items-start">
      {/* LEFT COLUMN: PDF View Panel (70% width on large screens) */}
      <div className="lg:col-span-8 space-y-4 h-full flex flex-col">
        {/* Navigation link / back button - neat & small */}
        <div className="flex items-center justify-between">
          <Link
            className="inline-flex items-center gap-2 rounded-full bg-white/72 px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-950"
            to="/library"
          >
            <ArrowLeft size={14} />
            Back to Library
          </Link>
          <StatusBadge status={doc.status} />
        </div>

        {/* PDF viewer panel - stretching to fill space */}
        <Panel className="overflow-hidden flex-1 flex flex-col p-0 border border-slate-100/80 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 bg-slate-50/50">
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">Original document view</h2>
              <p className="text-xs font-semibold text-slate-500">
                PDF preview inside workspace environment
              </p>
            </div>
            {!id.startsWith('mock_doc_') && (
              <Button onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')} size="sm" type="button" variant="secondary" className="text-xs py-1 px-3">
                <ExternalLink size={12} className="mr-1" />
                Open tab
              </Button>
            )}
          </div>
          <div className="flex-1 min-h-[600px] lg:min-h-[72vh] flex flex-col bg-slate-100/50">
            {previewState.loading ? (
              <div className="flex-1 grid place-items-center p-6 text-center">
                <div className="text-center">
                  <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent mx-auto"></div>
                  <p className="text-xs font-semibold text-slate-500">Preparing document preview...</p>
                </div>
              </div>
            ) : previewState.available ? (
              <iframe
                className="flex-1 w-full border-0 bg-slate-50 min-h-[500px]"
                src={previewUrl}
                title={`Original file preview for ${doc.displayName}`}
              />
            ) : (
              <div className="flex-1 grid place-items-center p-8 text-center">
                <div className="max-w-md">
                  <div className="mx-auto grid size-12 place-items-center rounded-xl bg-teal-50 text-primary mb-4 shadow-sm">
                    <FileText size={20} />
                  </div>
                  <h3 className="text-base font-black text-slate-900 leading-snug">{doc.displayName}</h3>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">
                    {previewState.message}
                  </p>
                  {!id.startsWith('mock_doc_') && (
                    <div className="mt-5">
                      <Button onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')} type="button" size="sm" className="text-xs">
                        <ExternalLink size={12} className="mr-1" />
                        Open original file
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* RIGHT COLUMN: Document Info, Actions, Metadata & Timeline (30% width) */}
      <aside className="lg:col-span-4 space-y-4">
        {/* Document Title & Actions Panel */}
        <Panel className="p-5 border border-slate-100/80 shadow-sm relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-45">
            <div className="abstract-canvas" />
          </div>
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-black text-primary tracking-wide uppercase">{doc.type}</span>
              {doc.relevance && (
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 tracking-wide uppercase">relevance: {doc.relevance}%</span>
              )}
            </div>
            
            <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight text-slate-950">
              {doc.displayName}
            </h1>
            
            <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500 border-l-2 border-slate-200 pl-3 py-1">
              {doc.preview}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {!id.startsWith('mock_doc_') ? (
                <Button onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')} variant="secondary" className="w-full text-xs justify-center py-2">
                  <ExternalLink size={12} className="mr-1.5" />
                  View original
                </Button>
              ) : (
                <div className="col-span-1" />
              )}
              <Button onClick={() => setShowDeleteModal(true)} variant="danger" className="w-full text-xs justify-center py-2">
                <Trash2 size={12} className="mr-1.5" />
                Delete
              </Button>
            </div>
          </div>
        </Panel>

        {/* Stats Bento */}
        <div className="grid grid-cols-3 gap-2">
          <CompactStatTile label="Pages" value={doc.pages} />
          <CompactStatTile label="Chunks" value={doc.chunks} />
          <CompactStatTile label="Status" value={doc.status} />
        </div>

        {/* Metadata Panel */}
        <Panel className="p-5 border border-slate-100/80 shadow-sm">
          <h2 className="text-sm font-black tracking-tight text-slate-900">Document metadata</h2>
          <div className="mt-4 grid gap-2">
            <MetaRow icon={FileText} label="File name" value={doc.name} />
            <MetaRow icon={HardDrive} label="File size" value={doc.size} />
            <MetaRow icon={FileText} label="Subject" value={doc.subject} />
            <MetaRow icon={FileText} label="Chapter" value={doc.chapter} />
            <MetaRow icon={CalendarDays} label="Uploaded" value={doc.uploadedAt} />
          </div>
        </Panel>

        {/* Timeline Panel */}
        <Panel className="p-5 border border-slate-100/80 shadow-sm">
          <h2 className="text-sm font-black tracking-tight text-slate-900">Processing timeline</h2>
          <div className="mt-4 space-y-3">
            {['Uploaded', 'Extracting text', 'Chunking', 'Embedding', doc.status].map((step, index) => (
              <div className="flex gap-3 items-center" key={`${step}-${index}`}>
                <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-teal-50 text-primary">
                  <CheckCircle2 size={13} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 leading-none">{step}</p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-1">Pipeline step {index + 1}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </aside>

      {showDeleteModal ? (
        <ConfirmModal
          actionLabel="Delete document"
          onCancel={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteDocument}
          title="Delete document?"
        >
          "{doc.displayName}" will be permanently removed.
          {deleting ? ' Deleting…' : ''}
        </ConfirmModal>
      ) : null}
    </div>
  )
}

function CompactStatTile({ label, value }) {
  return (
    <BentoCard className="p-3 text-center border border-slate-100/80 shadow-xs flex flex-col justify-center items-center">
      <p className="text-lg font-black tracking-tight text-slate-950">{value}</p>
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mt-1">{label}</p>
    </BentoCard>
  )
}

function Notice({ children, tone }) {
  const styles =
    tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-800 shadow-red-100'
      : 'border-amber-200 bg-amber-50 text-amber-800 shadow-amber-100'

  return (
    <div className={`m-5 rounded-lg border p-4 text-sm font-semibold leading-6 shadow-lg ${styles}`}>
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 shrink-0" size={17} />
        {children}
      </div>
    </div>
  )
}

function MetaRow({ icon: Icon, label, value }) {
  return (
    <motion.div className="bento-card flex items-center gap-3 px-3 py-2.5" whileHover={{ x: 3, y: -1 }}>
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal-50/70 text-primary shadow-xs">
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p>
        <p className="truncate text-xs font-black text-slate-800">{value}</p>
      </div>
    </motion.div>
  )
}

export default DocumentDetailPage
