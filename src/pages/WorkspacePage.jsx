import {
  Copy,
  FileText,
  Library,
  MessageSquarePlus,
  MoreHorizontal,
  RefreshCcw,
  Search,
  Settings,
  Send,
  ThumbsDown,
  ThumbsUp,
  Upload,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/common/Button.jsx'

const initialDocuments = [
  {
    id: 'doc-1',
    name: 'SWP391_RAG_Overview.pdf',
    chapter: 'Chapter 2',
    pages: 18,
    progress: 100,
    status: 'Indexed',
    type: 'PDF',
  },
  {
    id: 'doc-2',
    name: 'RAGAS_Evaluation_Slides.pptx',
    chapter: 'Research',
    pages: 32,
    progress: 72,
    status: 'Embedding',
    type: 'PPTX',
  },
  {
    id: 'doc-3',
    name: 'Fine_Tuning_Notes.docx',
    chapter: 'Benchmark',
    pages: 9,
    progress: 100,
    status: 'Indexed',
    type: 'DOCX',
  },
]

const initialSessions = [
  {
    id: 's-1',
    title: 'RAG vs fine-tuning',
    preview: 'Compare update cost and citation support.',
    time: '10:42',
  },
  {
    id: 's-2',
    title: 'RAGAS metrics',
    preview: 'Faithfulness and context precision.',
    time: 'Yesterday',
  },
  {
    id: 's-3',
    title: 'Embedding benchmark',
    preview: 'Which model retrieves better chunks?',
    time: 'May 30',
  },
]

const citations = [
  {
    id: 'c-1',
    chapter: 'Chapter 2',
    file: 'SWP391_RAG_Overview.pdf',
    page: 12,
    relevance: '92%',
    text: 'RAG retrieves relevant document chunks at query time before generating the final answer.',
  },
  {
    id: 'c-2',
    chapter: 'Research',
    file: 'RAGAS_Evaluation_Slides.pptx',
    page: 18,
    relevance: '87%',
    text: 'Faithfulness checks whether the generated answer is supported by the retrieved context.',
  },
]

const starterQuestions = [
  'How does RAG answer with citations?',
  'When is fine-tuning better than RAG?',
  'Which RAGAS metrics should we report?',
]

const uploadSteps = [
  'Uploaded',
  'Extracting text',
  'Chunking',
  'Embedding',
  'Indexed',
]

function WorkspacePage() {
  const [documents, setDocuments] = useState(initialDocuments)
  const [sessions, setSessions] = useState(initialSessions)
  const [activeSessionId, setActiveSessionId] = useState('s-1')
  const [question, setQuestion] = useState('')
  const [isAnswering, setIsAnswering] = useState(false)
  const [chatError, setChatError] = useState('')
  const [messages, setMessages] = useState([
    {
      id: 'm-1',
      role: 'assistant',
      content:
        'Welcome to FStu. Upload course documents, then ask a question. I will answer using indexed sources and show citations on the right.',
      citations: [],
    },
    {
      id: 'm-2',
      role: 'user',
      content: 'How is RAG different from fine-tuning for this project?',
    },
    {
      id: 'm-3',
      role: 'assistant',
      content:
        'RAG is better when students upload new course materials because the system can retrieve relevant chunks and cite sources immediately. Fine-tuning is better for learning response patterns, but it does not automatically provide source citations unless combined with retrieval.',
      citations,
    },
  ])
  const fileInputRef = useRef(null)

  const indexedCount = documents.filter((doc) => doc.status === 'Indexed').length
  const hasDocuments = documents.length > 0
  const canChat = indexedCount > 0

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [activeSessionId, sessions],
  )

  function handleUploadClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const extension = file.name.split('.').pop()?.toUpperCase() ?? 'FILE'
    const uploadedDocument = {
      id: `doc-${Date.now()}`,
      name: file.name,
      chapter: 'Unassigned',
      pages: 0,
      progress: 8,
      status: 'Uploaded',
      type: extension,
    }

    setDocuments((currentDocuments) => [uploadedDocument, ...currentDocuments])

    const statusTimeline = [
      ['Extracting text', 28],
      ['Chunking', 52],
      ['Embedding', 78],
      ['Indexed', 100],
    ]

    statusTimeline.forEach(([status, progress], index) => {
      window.setTimeout(
        () => {
          setDocuments((currentDocuments) =>
            currentDocuments.map((document) =>
              document.id === uploadedDocument.id
                ? { ...document, progress, status }
                : document,
            ),
          )
        },
        (index + 1) * 850,
      )
    })

    event.target.value = ''
  }

  function handleNewSession() {
    const nextSession = {
      id: `s-${Date.now()}`,
      title: 'New study session',
      preview: 'Ask your first question.',
      time: 'Now',
    }

    setSessions((currentSessions) => [nextSession, ...currentSessions])
    setActiveSessionId(nextSession.id)
    setMessages([
      {
        id: `m-${Date.now()}`,
        role: 'assistant',
        content:
          'New session started. Choose indexed documents and ask a course question.',
        citations: [],
      },
    ])
    setQuestion('')
    setChatError('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    const trimmedQuestion = question.trim()

    if (!trimmedQuestion) {
      setChatError('Ask a question before sending.')
      return
    }

    if (!canChat) {
      setChatError('At least one document must be indexed before chat is ready.')
      return
    }

    setChatError('')
    setQuestion('')
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: `m-${Date.now()}`,
        role: 'user',
        content: trimmedQuestion,
      },
    ])
    setIsAnswering(true)

    window.setTimeout(() => {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `m-${Date.now()}`,
          role: 'assistant',
          content:
            'Based on the indexed documents, RAG retrieves relevant chunks before generation, which makes the answer easier to verify. If no relevant chunks are found, the assistant should say that the source material does not contain enough information.',
          citations,
        },
      ])
      setIsAnswering(false)
    }, 950)
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_45%_0%,hsl(var(--primary)/0.10),transparent_28%),linear-gradient(135deg,#f8fbfc_0%,#eef7f5_100%)] p-5 font-body text-foreground">
      <div className="grid h-[calc(100vh-2.5rem)] grid-cols-[292px_minmax(0,1fr)_350px] gap-4">
        <aside className="flex min-h-0 flex-col rounded-[2rem] border border-white/80 bg-white/85 p-4 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur">
          <WorkspaceSidebarHeader />

          <div className="mt-5 rounded-[1.5rem] border border-teal-100 bg-[radial-gradient(circle_at_85%_0%,rgba(15,118,110,0.16),transparent_36%),#f0fdfa] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-700">
              Current workspace
            </p>
            <h1 className="mt-2 text-xl font-black tracking-tight text-teal-950">
              SWP391 Course QA
            </h1>
            <p className="mt-2 text-xs font-semibold leading-5 text-teal-900/70">
              {indexedCount} indexed sources available for chat.
            </p>
          </div>

          <input
            accept=".pdf,.docx,.ppt,.pptx"
            className="hidden"
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />

          <Button
            className="mt-4 h-12 w-full rounded-full text-sm shadow-lg shadow-primary/20"
            onClick={handleUploadClick}
            type="button"
            variant="cta"
          >
            <Upload className="size-4" strokeWidth={2} />
            Upload document
          </Button>

          <Button
            as={Link}
            className="mt-3 h-12 w-full rounded-full text-sm transition hover:-translate-y-0.5"
            to="/library"
            variant="secondary"
          >
            <Library className="size-4" strokeWidth={2} />
            Open library
          </Button>

          <section className="mt-5 min-h-0">
            <PanelTitle title="Documents" />
            <div className="mt-3 max-h-[260px] space-y-3 overflow-auto pr-1">
              {hasDocuments ? (
                documents.map((document) => (
                  <DocumentItem document={document} key={document.id} />
                ))
              ) : (
                <EmptyState text="Upload PDF, DOCX, or PPTX files to begin." />
              )}
            </div>
          </section>

          <section className="mt-5 min-h-0 flex-1">
            <div className="flex items-center justify-between">
              <PanelTitle title="Recent chats" />
              <button
                className="rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-primary"
                onClick={handleNewSession}
                type="button"
              >
                <MessageSquarePlus className="size-4" strokeWidth={2} />
              </button>
            </div>
            <div className="mt-3 space-y-2 overflow-auto pr-1">
              {sessions.map((session) => (
                <button
                  className={[
                    'group w-full rounded-2xl border px-3 py-3 text-left transition duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5',
                    session.id === activeSessionId
                      ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'border-border bg-white text-foreground hover:border-primary/40 hover:bg-teal-50 hover:shadow-[0_14px_34px_rgba(15,118,110,0.08)]',
                  ].join(' ')}
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-black">
                      {session.title}
                    </p>
                    <MoreHorizontal className="size-4 shrink-0 opacity-45 transition group-hover:opacity-100" />
                  </div>
                  <p
                    className={[
                      'mt-1 line-clamp-1 text-xs font-medium',
                      session.id === activeSessionId
                        ? 'text-white/75'
                        : 'text-muted-foreground',
                    ].join(' ')}
                  >
                    {session.preview}
                  </p>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_28px_110px_rgba(15,23,42,0.10)]">
          <header className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                Chatbox workspace
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">
                {activeSession?.title ?? 'Document chat'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-secondary p-1 text-xs font-black shadow-inner">
                <button className="rounded-full bg-primary px-4 py-2 text-primary-foreground shadow-md shadow-primary/20 transition hover:scale-[0.98]">
                  RAG
                </button>
                <button className="px-4 py-2 text-muted-foreground transition hover:text-foreground">
                  Fine-tuning
                </button>
              </div>
              <Button
                className="rounded-full"
                onClick={handleNewSession}
                type="button"
                variant="secondary"
              >
                New session
              </Button>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-5 overflow-auto bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.10),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fbfc_100%)] px-6 py-6">
            {!hasDocuments ? (
              <EmptyConversation
                title="No documents yet"
                text="Upload course materials before starting document-grounded chat."
              />
            ) : !canChat ? (
              <EmptyConversation
                title="Documents are still indexing"
                text="Chat will be ready after extraction, chunking, and embedding are complete."
              />
            ) : null}

            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {isAnswering ? (
              <div className="animate-message-in max-w-[76%] rounded-[1.5rem] border border-teal-100 bg-white p-4 shadow-[0_14px_40px_rgba(15,118,110,0.08)]">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-primary">
                    FStu is thinking
                  </span>
                </div>
                <div className="mt-4 h-3 w-32 animate-soft-pulse rounded-full bg-teal-100" />
                <div className="mt-3 h-3 w-full animate-soft-pulse rounded-full bg-teal-100 animation-delay-150" />
                <div className="mt-2 h-3 w-2/3 animate-soft-pulse rounded-full bg-teal-100 animation-delay-300" />
              </div>
            ) : null}
          </div>

          <form
            className="border-t border-border bg-white px-6 py-4"
            onSubmit={handleSubmit}
          >
            {chatError ? (
              <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {chatError}
              </div>
            ) : null}
            <div className="flex min-h-[76px] items-center gap-3 rounded-[1.75rem] border border-border bg-secondary px-4 py-3 transition duration-300 focus-within:border-primary focus-within:bg-white focus-within:shadow-[0_0_0_4px_hsl(var(--primary)/0.10),0_18px_50px_rgba(15,118,110,0.10)]">
              <textarea
                className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-base font-medium leading-7 outline-none placeholder:text-muted-foreground/80"
                onChange={(event) => {
                  setQuestion(event.target.value)
                  setChatError('')
                }}
                placeholder="Ask a question about your indexed documents..."
                value={question}
              />
              <Button
                className="h-12 shrink-0 rounded-2xl px-5 text-base shadow-lg shadow-primary/20"
                disabled={isAnswering}
                type="submit"
                variant="cta"
              >
                <Send className="size-4" strokeWidth={2} />
                Send
              </Button>
            </div>
          </form>
        </section>

        <aside className="flex min-h-0 flex-col rounded-[2rem] border border-white/80 bg-white/85 p-4 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur">
          <PanelTitle title="Sources" />
          <div className="mt-3 space-y-3 overflow-auto pr-1">
            {citations.map((citation) => (
              <CitationCard citation={citation} key={citation.id} />
            ))}
          </div>

          <section className="mt-5 rounded-[1.5rem] border border-border bg-secondary p-4">
            <PanelTitle title="Suggested questions" />
            <div className="mt-3 grid gap-2">
              {starterQuestions.map((starterQuestion) => (
                <button
                  className="rounded-2xl bg-white px-3 py-3 text-left text-sm font-semibold leading-5 text-foreground transition duration-300 hover:-translate-y-0.5 hover:text-primary hover:shadow-[0_12px_28px_rgba(15,118,110,0.08)]"
                  key={starterQuestion}
                  onClick={() => setQuestion(starterQuestion)}
                  type="button"
                >
                  {starterQuestion}
                </button>
              ))}
            </div>
          </section>

          <section className="mt-5 rounded-[1.5rem] border border-teal-100 bg-[radial-gradient(circle_at_85%_0%,rgba(15,118,110,0.14),transparent_36%),#f0fdfa] p-4">
            <PanelTitle title="Indexing pipeline" />
            <div className="mt-4 space-y-3">
              {uploadSteps.map((step, index) => (
                <div className="flex items-center gap-3" key={step}>
                  <span className="grid size-7 place-items-center rounded-full bg-white text-xs font-black text-primary">
                    {index + 1}
                  </span>
                  <span className="text-sm font-bold text-teal-950">
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}

function WorkspaceSidebarHeader() {
  return (
    <header className="flex items-center justify-between">
      <Link className="inline-flex items-center" to="/">
        <img
          alt="FStu"
          className="h-10 w-auto object-contain"
          src="/Gemini_Generated_Image_gyb1mfgyb1mfgyb1.png"
        />
      </Link>
          <Link
            className="rounded-full px-3 py-2 text-xs font-black text-muted-foreground transition hover:bg-secondary hover:text-primary"
            to="/settings"
          >
        <Settings className="size-4" strokeWidth={2} />
          </Link>
    </header>
  )
}

function PanelTitle({ title }) {
  return (
    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
      {title}
    </h3>
  )
}

function EmptyState({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white px-4 py-6 text-center text-sm font-semibold leading-6 text-muted-foreground">
      {text}
    </div>
  )
}

function DocumentItem({ document }) {
  const isIndexed = document.status === 'Indexed'
  const isFailed = document.status === 'Failed'

  return (
    <article className="group rounded-2xl border border-border bg-white p-3 transition duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_14px_34px_rgba(15,118,110,0.08)]">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-secondary text-primary transition group-hover:scale-105 group-hover:bg-teal-50">
          <FileText className="size-5 transition group-hover:-rotate-3" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-foreground">
            {document.name}
          </p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {document.type} / {document.chapter}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span
          className={[
            'rounded-full px-2.5 py-1 text-[11px] font-black',
            isIndexed ? 'bg-emerald-100 text-emerald-700' : '',
            isFailed ? 'bg-red-100 text-red-700' : '',
            !isIndexed && !isFailed ? 'bg-amber-100 text-amber-700' : '',
          ].join(' ')}
        >
          {document.status}
        </span>
        <span className="text-[11px] font-bold text-muted-foreground">
          {document.progress}%
        </span>
      </div>
      {!isIndexed ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${document.progress}%` }}
          />
        </div>
      ) : null}
    </article>
  )
}

function EmptyConversation({ text, title }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-border bg-white/80 px-5 py-6 text-center">
      <Search className="mx-auto size-6 text-primary" strokeWidth={2} />
      <h3 className="mt-3 text-base font-black">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {text}
      </p>
    </div>
  )
}

function ChatMessage({ message }) {
  const isUser = message.role === 'user'

  function handleCopy() {
    navigator.clipboard?.writeText(message.content)
  }

  return (
    <div className={`animate-message-in flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <article
        className={[
          'group max-w-[76%] rounded-[1.5rem] px-5 py-4 text-sm leading-7 transition duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5',
          isUser
            ? 'rounded-br-md bg-primary text-primary-foreground shadow-[0_18px_40px_rgba(15,118,110,0.18)]'
            : 'rounded-bl-md border border-border bg-white text-foreground shadow-[0_14px_40px_rgba(15,23,42,0.05)] hover:border-primary/30 hover:shadow-[0_18px_50px_rgba(15,118,110,0.09)]',
        ].join(' ')}
      >
        <p>{message.content}</p>
        {!isUser ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {message.citations?.length ? (
              <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-primary">
                {message.citations.length} citations
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                Not enough sources yet
              </span>
            )}
            <button
              className="rounded-full p-2 text-muted-foreground opacity-80 transition hover:bg-secondary hover:text-primary group-hover:opacity-100"
              onClick={handleCopy}
              type="button"
            >
              <Copy className="size-4" strokeWidth={2} />
            </button>
            <button className="rounded-full p-2 text-muted-foreground opacity-80 transition hover:bg-secondary hover:text-primary group-hover:opacity-100" type="button">
              <RefreshCcw className="size-4" strokeWidth={2} />
            </button>
            <button className="rounded-full p-2 text-muted-foreground opacity-80 transition hover:bg-secondary hover:text-emerald-600 group-hover:opacity-100" type="button">
              <ThumbsUp className="size-4" strokeWidth={2} />
            </button>
            <button className="rounded-full p-2 text-muted-foreground opacity-80 transition hover:bg-secondary hover:text-red-600 group-hover:opacity-100" type="button">
              <ThumbsDown className="size-4" strokeWidth={2} />
            </button>
          </div>
        ) : null}
      </article>
    </div>
  )
}

function CitationCard({ citation }) {
  return (
    <article className="group rounded-[1.5rem] border border-border bg-white p-4 transition duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_18px_50px_rgba(15,118,110,0.10)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-foreground">{citation.file}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            Page {citation.page} / {citation.chapter}
          </p>
        </div>
        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-black text-primary">
          {citation.relevance}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {citation.text}
      </p>
      <button
        className="mt-3 text-sm font-black text-primary transition group-hover:translate-x-1 hover:text-teal-900"
        type="button"
      >
        View source
      </button>
    </article>
  )
}

export default WorkspacePage
