import {
  BookOpen,
  FileText,
  Filter,
  Grid2X2,
  HardDrive,
  List,
  MoreHorizontal,
  RefreshCcw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/common/Button.jsx'
import { libraryDocuments } from '../data/mockDocuments.js'

const statusStyles = {
  Failed: 'bg-red-100 text-red-700',
  Indexed: 'bg-emerald-100 text-emerald-700',
  Processing: 'bg-amber-100 text-amber-700',
  Uploaded: 'bg-slate-100 text-slate-700',
}

const recentQueries = [
  {
    subtitle: 'Cited 2 documents',
    title: 'RAG vs fine-tuning update cost',
  },
  {
    subtitle: 'Generated 24 min ago',
    title: 'RAGAS metrics for SWP demo',
  },
]

function LibraryPage() {
  const [documents, setDocuments] = useState(libraryDocuments)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    chapter: 'All',
    fileType: 'All',
    status: 'All',
    subject: 'All',
    uploadedAt: 'All',
  })
  const [deleteTarget, setDeleteTarget] = useState(null)
  const fileInputRef = useRef(null)

  const filterOptions = useMemo(
    () => ({
      chapter: ['All', ...new Set(documents.map((doc) => doc.chapter))],
      fileType: ['All', ...new Set(documents.map((doc) => doc.fileType))],
      status: ['All', ...new Set(documents.map((doc) => doc.status))],
      subject: ['All', ...new Set(documents.map((doc) => doc.subject))],
      uploadedAt: ['All', ...new Set(documents.map((doc) => doc.uploadedAt))],
    }),
    [documents],
  )

  const filteredDocuments = documents.filter((document) => {
    const matchesSearch =
      document.name.toLowerCase().includes(search.toLowerCase()) ||
      document.subject.toLowerCase().includes(search.toLowerCase())

    const matchesFilters = Object.entries(filters).every(([key, value]) => {
      if (value === 'All') {
        return true
      }

      return document[key] === value
    })

    return matchesSearch && matchesFilters
  })

  function handleFilterChange(event) {
    const { name, value } = event.target
    setFilters((currentFilters) => ({ ...currentFilters, [name]: value }))
  }

  function handleUploadClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const extension = file.name.split('.').pop()?.toUpperCase() ?? 'FILE'
    const nextDocument = {
      id: `doc-${Date.now()}`,
      chapter: 'Unassigned',
      chunkCount: 0,
      embeddingModel: 'text-embedding-3-small',
      fileSize: `${Math.max(file.size / 1024 / 1024, 0.1).toFixed(1)} MB`,
      fileType: extension,
      indexedAt: '',
      name: file.name,
      pages: 0,
      status: 'Uploaded',
      subject: 'SWP Project',
      uploadedAt: '2026-05-31',
    }

    setDocuments((currentDocuments) => [nextDocument, ...currentDocuments])
    event.target.value = ''
  }

  function handleRename(documentId) {
    const nextName = window.prompt('Enter a new document name:')

    if (!nextName?.trim()) {
      return
    }

    setDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === documentId
          ? { ...document, name: nextName.trim() }
          : document,
      ),
    )
  }

  function handleReindex(documentId) {
    setDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === documentId
          ? { ...document, status: 'Processing' }
          : document,
      ),
    )

    window.setTimeout(() => {
      setDocuments((currentDocuments) =>
        currentDocuments.map((document) =>
          document.id === documentId
            ? {
                ...document,
                chunkCount: Math.max(document.chunkCount, 12),
                indexedAt: '2026-05-31 12:00',
                status: 'Indexed',
              }
            : document,
        ),
      )
    }, 1000)
  }

  function confirmDelete() {
    if (!deleteTarget) {
      return
    }

    setDocuments((currentDocuments) =>
      currentDocuments.filter((document) => document.id !== deleteTarget.id),
    )
    setDeleteTarget(null)
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_18%_12%,rgba(15,118,110,0.12),transparent_32%),radial-gradient(circle_at_86%_18%,rgba(20,184,166,0.12),transparent_30%),linear-gradient(135deg,#f8fbff_0%,#f6f8fb_48%,#eef7f5_100%)] p-8 font-body text-foreground">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-start justify-between">
          <div>
            <Link className="mb-5 inline-flex items-center" to="/app">
              <img
                alt="FStu"
                className="h-10 w-auto object-contain"
                src="/Gemini_Generated_Image_gyb1mfgyb1mfgyb1.png"
              />
            </Link>
            <h1 className="text-5xl font-black tracking-[-0.055em] text-slate-950">
              Knowledge Library
            </h1>
            <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-muted-foreground">
              Manage uploaded course documents, track indexing status, organize
              by subject, and inspect chunks for grounded chat.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button as={Link} className="rounded-full" to="/app" variant="secondary">
              Back to workspace
            </Button>
            <input
              accept=".pdf,.docx,.ppt,.pptx"
              className="hidden"
              onChange={handleFileChange}
              ref={fileInputRef}
              type="file"
            />
            <Button className="rounded-xl" onClick={handleUploadClick} type="button" variant="cta">
              <Upload className="size-4" strokeWidth={2} />
              Upload document
            </Button>
          </div>
        </header>

        <section className="mt-8 grid grid-cols-3 gap-5">
          <StatCard
            accent="teal"
            label="Total Documents"
            meta="+2 this week"
            value={documents.length}
          />
          <StatCard
            accent="emerald"
            label="Chunks Indexed"
            meta={`${documents.filter((doc) => doc.status === 'Processing').length} processing`}
            value={documents
              .reduce((total, document) => total + document.chunkCount, 0)
              .toLocaleString()}
          />
          <StatCard
            accent="cyan"
            label="Top Subject"
            meta="Most active"
            value="Artificial Intelligence"
          />
        </section>

        <section className="mt-5">
          <div className="rounded-[1.25rem] border border-white/80 bg-white/75 p-4 shadow-[0_20px_70px_rgba(15,23,42,0.06)] backdrop-blur">
            <div className="grid grid-cols-[1.5fr_repeat(5,1fr)] gap-3">
              <label className="relative">
                <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="h-12 w-full rounded-2xl border border-border bg-white pl-11 pr-4 text-sm font-medium outline-none transition focus:border-primary focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.10)]"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by file or subject..."
                  value={search}
                />
              </label>

              <LibraryFilter label="Subject" name="subject" onChange={handleFilterChange} options={filterOptions.subject} value={filters.subject} />
              <LibraryFilter label="Chapter" name="chapter" onChange={handleFilterChange} options={filterOptions.chapter} value={filters.chapter} />
              <LibraryFilter label="Type" name="fileType" onChange={handleFilterChange} options={filterOptions.fileType} value={filters.fileType} />
              <LibraryFilter label="Status" name="status" onChange={handleFilterChange} options={filterOptions.status} value={filters.status} />
              <LibraryFilter label="Uploaded" name="uploadedAt" onChange={handleFilterChange} options={filterOptions.uploadedAt} value={filters.uploadedAt} />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20" type="button">
                <Grid2X2 className="size-4" strokeWidth={2} />
              </button>
              <button className="grid size-10 place-items-center rounded-xl bg-secondary text-muted-foreground transition hover:text-primary" type="button">
                <List className="size-4" strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-white/80 bg-white shadow-[0_24px_90px_rgba(15,23,42,0.10)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-4">Document</th>
                  <th className="px-4 py-4">Type</th>
                  <th className="px-4 py-4">Subject</th>
                  <th className="px-4 py-4">Chapter</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Chunks</th>
                  <th className="px-4 py-4">Embedding</th>
                  <th className="px-4 py-4">Uploaded</th>
                  <th className="px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDocuments.map((document) => (
                  <DocumentRow
                    document={document}
                    key={document.id}
                    onDelete={() => setDeleteTarget(document)}
                    onReindex={() => handleReindex(document.id)}
                    onRename={() => handleRename(document.id)}
                  />
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-border bg-white px-5 py-4 text-xs font-semibold text-muted-foreground">
              <span>
                Showing 1-{filteredDocuments.length} of {documents.length}{' '}
                documents
              </span>
              <div className="flex items-center gap-2">
                <button className="rounded-lg px-2 py-1 text-muted-foreground" type="button">
                  ‹
                </button>
                <button className="rounded-lg border border-primary/30 bg-teal-50 px-3 py-1 font-black text-primary" type="button">
                  1
                </button>
                <button className="rounded-lg px-3 py-1 text-muted-foreground" type="button">
                  2
                </button>
                <button className="rounded-lg px-2 py-1 text-muted-foreground" type="button">
                  ›
                </button>
              </div>
            </div>
          </div>

          {!filteredDocuments.length ? (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-border bg-secondary px-6 py-10 text-center">
              <Filter className="mx-auto size-7 text-primary" strokeWidth={2} />
              <h2 className="mt-3 text-lg font-black">No documents found</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Try changing the search keyword or clearing some filters.
              </p>
            </div>
          ) : null}
        </section>

        <section className="mt-5 grid grid-cols-[1.5fr_0.7fr] gap-5">
          <div className="rounded-[1.5rem] border border-white/80 bg-white/85 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-foreground">
                Recently Queried
              </h2>
              <Link className="text-xs font-black text-primary" to="/chat">
                View history
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {recentQueries.map((query) => (
                <article
                  className="flex items-center gap-4 rounded-2xl border border-border bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-teal-50"
                  key={query.title}
                >
                  <span className="grid size-10 place-items-center rounded-2xl bg-white text-primary">
                    <BookOpen className="size-5" strokeWidth={2} />
                  </span>
                  <div>
                    <h3 className="text-sm font-black">{query.title}</h3>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {query.subtitle}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/80 bg-white/85 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.07)]">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-teal-50 text-primary">
                <HardDrive className="size-5" strokeWidth={2} />
              </span>
              <h2 className="text-sm font-black text-foreground">
                Storage Usage
              </h2>
            </div>
            <p className="mt-5 text-3xl font-black tracking-tight">8.4 GB</p>
            <p className="text-xs font-semibold text-muted-foreground">
              of 20 GB
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-[42%] rounded-full bg-primary" />
            </div>
            <div className="mt-4 space-y-2 text-xs font-semibold text-muted-foreground">
              <UsageRow label="PDFs" value="6.2 GB" />
              <UsageRow label="Slides" value="1.8 GB" />
              <UsageRow label="Other" value="0.4 GB" />
            </div>
          </div>
        </section>
      </div>

      {deleteTarget ? (
        <ConfirmModal
          document={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </main>
  )
}

function StatCard({ accent, label, meta, value }) {
  const accentMap = {
    cyan: 'bg-cyan-50 text-cyan-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    teal: 'bg-teal-50 text-primary',
  }

  return (
    <article className="rounded-[1.5rem] border border-white/80 bg-white/85 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_90px_rgba(15,118,110,0.10)]">
      <div className="flex items-start justify-between">
        <span className={`${accentMap[accent]} grid size-10 place-items-center rounded-2xl`}>
          <FileText className="size-5" strokeWidth={2} />
        </span>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-black text-primary">
          {meta}
        </span>
      </div>
      <p className="mt-5 text-sm font-black text-muted-foreground">{label}</p>
      <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
        {value}
      </h2>
    </article>
  )
}

function UsageRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-black text-foreground">{value}</span>
    </div>
  )
}

function LibraryFilter({ label, name, onChange, options, value }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        className="h-12 w-full rounded-2xl border border-border bg-white px-3 text-sm font-bold outline-none transition focus:border-primary focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.10)]"
        name={name}
        onChange={onChange}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === 'All' ? label : option}
          </option>
        ))}
      </select>
    </label>
  )
}

function DocumentRow({ document, onDelete, onReindex, onRename }) {
  return (
    <tr className="transition hover:bg-teal-50/40">
      <td className="max-w-[260px] px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
            <FileText className="size-5" strokeWidth={2} />
          </span>
          <Link className="min-w-0" to={`/library/documents/${document.id}`}>
            <p className="truncate font-black text-foreground">{document.name}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              {document.fileSize} / {document.pages} pages
            </p>
          </Link>
        </div>
      </td>
      <td className="px-4 py-4 font-bold">{document.fileType}</td>
      <td className="px-4 py-4 text-muted-foreground">{document.subject}</td>
      <td className="px-4 py-4 text-muted-foreground">{document.chapter}</td>
      <td className="px-4 py-4">
        <span className={`${statusStyles[document.status]} rounded-full px-3 py-1 text-xs font-black`}>
          {document.status}
        </span>
      </td>
      <td className="px-4 py-4 font-black">{document.chunkCount}</td>
      <td className="px-4 py-4 text-xs font-bold text-muted-foreground">
        {document.embeddingModel}
      </td>
      <td className="px-4 py-4 text-muted-foreground">{document.uploadedAt}</td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-1">
          <Button as={Link} className="h-9 rounded-full px-3 text-xs" to={`/library/documents/${document.id}`} variant="secondary">
            View
          </Button>
          <button className="rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-primary" onClick={onRename} type="button">
            Rename
          </button>
          <button className="rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-primary" onClick={onReindex} type="button">
            <RefreshCcw className="size-4" strokeWidth={2} />
          </button>
          <button className="rounded-full p-2 text-muted-foreground transition hover:bg-red-50 hover:text-red-600" onClick={onDelete} type="button">
            <Trash2 className="size-4" strokeWidth={2} />
          </button>
          <MoreHorizontal className="size-4 text-muted-foreground" />
        </div>
      </td>
    </tr>
  )
}

function ConfirmModal({ document, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/30 p-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_34px_120px_rgba(15,23,42,0.22)]">
        <h2 className="text-2xl font-black tracking-tight">Delete document?</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This will remove <span className="font-black text-foreground">{document.name}</span> from the current workspace.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button className="rounded-full" onClick={onCancel} type="button" variant="secondary">
            Cancel
          </Button>
          <Button className="rounded-full bg-red-600 text-white shadow-red-600/20 hover:bg-red-700" onClick={onConfirm} type="button" variant="cta">
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

export default LibraryPage
