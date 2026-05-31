import { ArrowLeft, FileText, RefreshCcw } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import Button from '../components/common/Button.jsx'
import { documentChunks, libraryDocuments } from '../data/mockDocuments.js'

const statusStyles = {
  Failed: 'bg-red-100 text-red-700',
  Indexed: 'bg-emerald-100 text-emerald-700',
  Processing: 'bg-amber-100 text-amber-700',
  Uploaded: 'bg-slate-100 text-slate-700',
}

function DocumentDetailPage() {
  const { id } = useParams()
  const document = libraryDocuments.find((item) => item.id === id)

  if (!document) {
    return <Navigate replace to="/library" />
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_8%,hsl(var(--primary)/0.12),transparent_30%),linear-gradient(135deg,#ffffff_0%,#f6f8fb_56%,#eef7f5_100%)] p-6 font-body text-foreground">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between rounded-[2rem] border border-white/80 bg-white/85 px-6 py-4 shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
          <Button as={Link} className="rounded-full" to="/library" variant="secondary">
            <ArrowLeft className="size-4" strokeWidth={2} />
            Back to library
          </Button>
          <Button className="rounded-full" type="button" variant="cta">
            <RefreshCcw className="size-4" strokeWidth={2} />
            Re-index
          </Button>
        </header>

        <section className="mt-6 grid grid-cols-[0.9fr_1.1fr] gap-5">
          <aside className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_24px_90px_rgba(15,23,42,0.08)]">
            <div className="grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
              <FileText className="size-7" strokeWidth={2} />
            </div>
            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              Document detail
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">
              {document.name}
            </h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Preview metadata, index state, and chunks extracted from this
              file.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Metadata label="File type" value={document.fileType} />
              <Metadata label="File size" value={document.fileSize} />
              <Metadata label="Pages" value={document.pages} />
              <Metadata label="Chunks" value={document.chunkCount} />
              <Metadata label="Subject" value={document.subject} />
              <Metadata label="Chapter" value={document.chapter} />
              <Metadata label="Embedding" value={document.embeddingModel} wide />
              <div className="rounded-2xl border border-border bg-secondary p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                  Index status
                </p>
                <span className={`${statusStyles[document.status]} mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black`}>
                  {document.status}
                </span>
              </div>
            </div>
          </aside>

          <section className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_24px_90px_rgba(15,23,42,0.08)]">
            <div className="flex items-end justify-between border-b border-border pb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                  Chunks
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  Extracted document chunks
                </h2>
              </div>
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-primary">
                {documentChunks.length} preview chunks
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {document.status === 'Failed' ? (
                <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
                  Indexing failed. Re-index this document to regenerate chunks.
                </div>
              ) : null}

              {documentChunks.map((chunk) => (
                <article
                  className="rounded-[1.5rem] border border-border bg-secondary p-5"
                  key={chunk.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-black">{chunk.id}</h3>
                      <p className="mt-1 text-xs font-bold text-muted-foreground">
                        Page {chunk.page} / {chunk.tokenLength} tokens
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-primary">
                      {chunk.metadata}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-foreground">
                    {chunk.content}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  )
}

function Metadata({ label, value, wide }) {
  return (
    <div
      className={`${wide ? 'col-span-2' : ''} rounded-2xl border border-border bg-secondary p-4`}
    >
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-black text-foreground">
        {value || 'Not available'}
      </p>
    </div>
  )
}

export default DocumentDetailPage
