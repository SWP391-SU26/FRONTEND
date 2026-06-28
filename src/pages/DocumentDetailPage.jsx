import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Database,
  ExternalLink,
  FileText,
  HardDrive,
  Layers3,
  Loader2,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BentoCard, Button, ConfirmModal, EmptyState, Field, Panel, StatusBadge } from '../components/ui.jsx'
import {
  deleteDocument,
  getDocument,
  getDocumentChunks,
  getDocumentFileUrl,
  getDocumentPages,
  getDocumentPreviewUrl,
} from '../services/documentService.js'

function DocumentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [doc, setDoc] = useState(null)
  const [chunks, setChunks] = useState([])
  const [pages, setPages] = useState([])
  const [activeChunkId, setActiveChunkId] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [previewState, setPreviewState] = useState({ loading: true, available: false, message: '' })

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      setLoading(true)
      setError('')
      try {
        const [docData, chunksData, pagesData] = await Promise.all([
          getDocument(id),
          getDocumentChunks(id).catch(() => []), // fallback to empty array if endpoint fails or not implemented
          getDocumentPages(id).catch(() => []),
        ])

        if (!isMounted) return
        setDoc(docData)
        setChunks(chunksData)
        setPages(pagesData)
        if (chunksData && chunksData.length > 0) {
          setActiveChunkId(chunksData[0].id)
        }
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
              ? 'DOCX and PPTX previews require backend document conversion support.'
              : 'A complete preview is not available for this file.',
        })
      } catch {
        if (isMounted) {
          setPreviewState({
            loading: false,
            available: false,
            message: 'The preview API could not be reached.',
          })
        }
      }
    }

    checkPreview()

    return () => {
      isMounted = false
    }
  }, [doc, id])

  const fileUrl = doc ? getDocumentFileUrl(doc.id) : '#'
  const previewUrl = doc ? (doc.type === 'PDF' ? fileUrl : getDocumentPreviewUrl(doc.id)) : '#'

  const docChunks = useMemo(() => {
    return chunks.filter((chunk) => {
      const normalizedQuery = query.trim().toLowerCase()
      return (
        !normalizedQuery ||
        chunk.content?.toLowerCase().includes(normalizedQuery) ||
        chunk.metadata?.toLowerCase().includes(normalizedQuery) ||
        chunk.id?.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [chunks, query])

  const docPages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return pages.filter((page) => (
      !normalizedQuery ||
      page.content?.toLowerCase().includes(normalizedQuery) ||
      String(page.pageNumber).includes(normalizedQuery)
    ))
  }, [pages, query])

  const selectedChunk = useMemo(() => {
    return chunks.find((c) => c.id === activeChunkId) || null
  }, [chunks, activeChunkId])

  async function handleDeleteDocument() {
    setDeleting(true)
    try {
      await deleteDocument(id)
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
      <Panel className="flex min-h-72 items-center justify-center gap-3 p-6 text-sm font-black text-slate-600">
        <Loader2 className="animate-spin text-primary" size={20} />
        Loading document details...
      </Panel>
    )
  }

  if (error || !doc) {
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
        description={error || 'The document does not exist in the knowledge base.'}
        title="Document not found"
      />
    )
  }

  return (
    <div className="space-y-6 min-h-[calc(100vh-4rem)] pb-12">
      {/* HEADER / NAVIGATION */}
      <div className="flex items-center justify-between">
        <Link
          className="inline-flex items-center gap-2 rounded-full bg-white/72 px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-950"
          to="/library"
        >
          <ArrowLeft size={14} />
          Back to Library
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={doc.status} />
          <StatusBadge status={doc.embeddingStatus} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* LEFT COLUMN: PDF View Panel */}
        <div className="lg:col-span-8 space-y-4 h-full flex flex-col">
          <Panel className="overflow-hidden flex-1 flex flex-col p-0 border border-slate-100/80 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 bg-slate-50/50">
              <div>
                <h2 className="text-sm font-black tracking-tight text-slate-900">Original document view</h2>
                <p className="text-xs font-semibold text-slate-500">
                  PDF preview inside workspace environment
                </p>
              </div>
              <Button onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')} size="sm" type="button" variant="secondary" className="text-xs py-1 px-3">
                <ExternalLink size={12} className="mr-1" />
                Open tab
              </Button>
            </div>
            
            <div className="flex-1 min-h-[500px] lg:min-h-[65vh] flex flex-col bg-slate-100/50">
              {previewState.loading ? (
                <div className="flex-1 grid place-items-center p-6 text-center">
                  <div className="text-center">
                    <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent mx-auto"></div>
                    <p className="text-xs font-semibold text-slate-500">Preparing document preview...</p>
                  </div>
                </div>
              ) : previewState.available ? (
                <iframe
                  className="flex-1 w-full border-0 bg-slate-50 min-h-[500px] lg:min-h-[65vh]"
                  src={previewUrl}
                  title={`Original file preview for ${doc.displayName}`}
                />
              ) : (
                <div className="flex-1 grid place-items-center p-8 text-center bg-white">
                  <div className="max-w-md">
                    <div className="mx-auto grid size-12 place-items-center rounded-xl bg-teal-50 text-primary mb-4 shadow-sm">
                      <FileText size={20} />
                    </div>
                    <h3 className="text-base font-black text-slate-900 leading-snug">{doc.displayName}</h3>
                    <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">
                      {previewState.message}
                    </p>
                    <div className="mt-5">
                      <Button onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')} type="button" size="sm" className="text-xs">
                        <ExternalLink size={12} className="mr-1" />
                        Open original file
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* RIGHT COLUMN: Document Info, Actions, Metadata & Timeline */}
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
                {doc.preview || 'No preview summary available.'}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button onClick={() => window.open(fileUrl, '_blank', 'noopener,noreferrer')} variant="secondary" className="w-full text-xs justify-center py-2">
                  <ExternalLink size={12} className="mr-1.5" />
                  View original
                </Button>
                <Button onClick={() => setShowDeleteModal(true)} variant="danger" className="w-full text-xs justify-center py-2">
                  <Trash2 size={12} className="mr-1.5" />
                  Delete
                </Button>
              </div>
            </div>
          </Panel>

          {/* Stats Bento */}
          <div className="grid grid-cols-3 gap-2">
            <CompactStatTile label="Pages" value={pages.length || doc.pages} />
            <CompactStatTile label="Chunks" value={chunks.length || doc.chunks || 0} />
            <CompactStatTile label="Status" value={doc.status} />
          </div>

          {/* Metadata Panel */}
          <Panel className="p-5 border border-slate-100/80 shadow-sm">
            <h2 className="text-sm font-black tracking-tight text-slate-900">Document metadata</h2>
            <div className="mt-4 grid gap-2">
              <MetaRow icon={FileText} label="File name" value={doc.name} />
              <MetaRow icon={HardDrive} label="File size" value={doc.size || 'Unknown size'} />
              <MetaRow icon={FileText} label="Subject" value={doc.subject} />
              <MetaRow icon={FileText} label="Chapter" value={doc.chapter || 'All Chapters'} />
              <MetaRow icon={CalendarDays} label="Uploaded" value={doc.uploadedAt} />
            </div>
          </Panel>

          {/* Timeline Panel */}
          <Panel className="p-5 border border-slate-100/80 shadow-sm">
            <h2 className="text-sm font-black tracking-tight text-slate-900">Processing timeline</h2>
            <div className="mt-4 space-y-3">
              {['Uploaded', 'Text extracted', 'Pages stored', 'Chunks stored', doc.embeddingStatus].map((step, index) => (
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
      </div>

      {/* CHUNK READER SECTION */}
      <div className="mt-8 border-t border-slate-100 pt-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="grid size-10 place-items-center rounded-xl bg-teal-50 text-primary">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900">Extracted pages</h2>
              <p className="text-xs font-semibold text-slate-500">
                Inspect page-level text returned by the backend extraction API.
              </p>
            </div>
          </div>

          <Panel className="overflow-hidden p-0 border border-slate-100/80 shadow-sm">
            <div className="border-b border-border p-5 bg-slate-50/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Document pages ({docPages.length})</h3>
                  <p className="text-xs font-semibold text-slate-500">Page text is stored separately from chunks.</p>
                </div>
                <div className="w-full sm:w-80">
                  <Field
                    icon={Search}
                    label="Search pages"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search extracted text..."
                    value={query}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-5 md:grid-cols-2 max-h-[420px] overflow-y-auto">
              {docPages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center md:col-span-2">
                  <FileText className="mx-auto text-slate-300" size={30} />
                  <h4 className="mt-3 text-xs font-black text-slate-900">No pages to display</h4>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    The backend returned no extracted pages, or the search did not match any page.
                  </p>
                </div>
              ) : (
                docPages.map((page) => (
                  <article className="rounded-xl border border-slate-100 bg-white/80 p-4 shadow-sm" key={page.id || page.pageNumber}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-black text-teal-700">Page {page.pageNumber}</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">{page.wordCount} words</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600">{page.charCount} chars</span>
                    </div>
                    <p className="line-clamp-6 whitespace-pre-wrap text-xs font-medium leading-relaxed text-slate-600">
                      {page.content || 'No extracted text returned for this page.'}
                    </p>
                  </article>
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="flex items-center gap-3 mb-6">
            <div className="grid size-10 place-items-center rounded-xl bg-teal-50 text-primary">
              <Layers3 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900">Chunk reader & inspect</h2>
              <p className="text-xs font-semibold text-slate-500">
                Inspect vector store chunks extracted for this document.
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12 items-start">
            {/* Left: Chunk list with Search */}
            <div className="lg:col-span-8">
              <Panel className="overflow-hidden p-0 border border-slate-100/80 shadow-sm">
                {doc.status === 'Processing' || doc.status === 'Uploaded' ? (
                  <Notice tone="amber">
                    This file is still processing, so chunk previews may be incomplete.
                  </Notice>
                ) : null}

                {doc.status === 'Failed' ? (
                  <Notice tone="red">
                    Indexing failed. Check the backend document processing error and retry indexing.
                  </Notice>
                ) : null}

                <div className="border-b border-border p-5 bg-slate-50/50">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Document chunks ({docChunks.length})</h3>
                      <p className="text-xs font-semibold text-slate-500">Select a chunk to read its full text.</p>
                    </div>
                    <div className="w-full sm:w-80">
                      <Field
                        icon={Search}
                        label="Search chunks"
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search chunk content..."
                        value={query}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 p-5 sm:grid-cols-2 max-h-[500px] overflow-y-auto">
                  {docChunks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center sm:col-span-2">
                      <Layers3 className="mx-auto text-slate-300" size={30} />
                      <h4 className="mt-3 text-xs font-black text-slate-900">No chunks to display</h4>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        The backend returned no chunks, or the search did not match any chunk.
                      </p>
                    </div>
                  ) : (
                    docChunks.map((chunk, index) => (
                      <motion.button
                        className={`bento-card p-4 text-left transition text-slate-900 border border-slate-100 bg-white shadow-xs ${
                          activeChunkId === chunk.id ? 'ring-2 ring-primary bg-teal-50/10' : ''
                        }`}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.25 }}
                        key={chunk.id}
                        onClick={() => setActiveChunkId(chunk.id)}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.985 }}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-600">{chunk.id}</span>
                          <span className="rounded bg-teal-50 px-2 py-0.5 text-[9px] font-black text-teal-700">Page {chunk.page}</span>
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700">{chunk.tokenLength || 0} tokens</span>
                        </div>
                        <p className="line-clamp-3 text-xs font-medium leading-relaxed text-slate-600">
                          {chunk.content}
                        </p>
                      </motion.button>
                    ))
                  )}
                </div>
              </Panel>
            </div>

            {/* Right: Active chunk detail */}
            <aside className="lg:col-span-4">
              <BentoCard className="border-teal-200 bg-teal-50/50 p-5 text-slate-900 shadow-sm">
                <div className="flex items-start justify-between gap-3 border-b border-teal-100/50 pb-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-primary">Active chunk</p>
                    <p className="text-[10px] font-semibold text-slate-500">Highlighted source preview</p>
                  </div>
                  <Sparkles className="text-primary" size={18} />
                </div>

                {selectedChunk ? (
                  <div className="mt-4">
                    <p className="text-xs font-black text-slate-900 bg-teal-100/50 inline-block px-2.5 py-0.5 rounded">ID: {selectedChunk.id}</p>
                    <p className="mt-3 text-xs font-medium leading-relaxed text-slate-700 bg-white/70 p-3 rounded-lg border border-teal-100/30 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                      {selectedChunk.content}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black">
                      <span className="rounded bg-white px-2 py-1 text-slate-600 shadow-2xs">Page {selectedChunk.page}</span>
                      <span className="rounded bg-white px-2 py-1 text-slate-600 shadow-2xs">{selectedChunk.tokenLength || 0} tokens</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-xs font-semibold text-slate-500">No matching chunk selected.</p>
                )}
              </BentoCard>
            </aside>
          </div>
        </div>

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
