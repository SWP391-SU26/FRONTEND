import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  Database,
  FileText,
  FlaskConical,
  Gauge,
  Loader2,
  RefreshCcw,
  Search,
  Trash2,
  Users,
} from 'lucide-react'
import {
  Button,
  ConfirmModal,
  EmptyState,
  Field,
  IconButton,
  Panel,
  SelectField,
  StatusBadge,
} from '../../components/ui.jsx'
import { AdminPageHeader } from '../../layouts/AdminLayout.jsx'
import { deleteUser, getSavedUser, getUsers, updateUserRole } from '../../services/authService.js'
import { getCourses } from '../../services/courseService.js'
import { deleteDocument, getDocuments, reindexDocument, waitForIndexingJob } from '../../services/documentService.js'
import {
  getExperimentResults,
  getExperiments,
} from '../../services/evaluationService.js'
import { getActiveEmbeddingModel } from '../../services/ragService.js'

const allOption = 'All'
const roles = ['ADMIN', 'TEACHER', 'STUDENT', 'RESEARCHER', 'USER']

function unwrapList(result) {
  return Array.isArray(result) ? result : (result?.data ?? [])
}

function statusForBadge(value) {
  if (value === true || value === 'ACTIVE' || value === 'Active' || value === 'COMPLETED') return 'Indexed'
  if (value === 'RUNNING') return 'Processing'
  if (value === 'PENDING') return 'Pending'
  if (value === false || value === 'LOCKED' || value === 'Locked' || value === 'FAILED') return 'Failed'
  return value ?? 'Uploaded'
}

export function AdminDashboardPage() {
  const [state, setState] = useState({ loading: true, error: '', users: [], documents: [], courses: [], experiments: [] })

  useEffect(() => {
    let active = true
    Promise.all([
      getUsers().then(unwrapList),
      getDocuments(),
      getCourses(),
      getExperiments().catch(() => []),
    ])
      .then(([users, documents, courses, experiments]) => {
        if (active) setState({ loading: false, error: '', users, documents, courses, experiments })
      })
      .catch((error) => active && setState((current) => ({ ...current, loading: false, error: error.message })))
    return () => {
      active = false
    }
  }, [])

  const prepared = state.documents.filter((doc) => doc.embeddingStatus === 'Prepared').length

  return (
    <div className="space-y-4">
      <AdminPageHeader
        description="Overview from live backend APIs only."
        icon={Gauge}
        title="Admin Dashboard"
      />
      {state.error ? <Alert message={state.error} /> : null}
      {state.loading ? <Loading label="Loading dashboard data" /> : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Users} label="Users" value={state.users.length} />
            <MetricCard icon={BookOpen} label="Courses" value={state.courses.length} />
            <MetricCard icon={FileText} label="Documents" value={state.documents.length} />
            <MetricCard icon={Database} label="Prepared documents" value={prepared} />
          </div>
          <Panel className="p-5">
            <SectionTitle icon={BarChart3} title="Live data source" subtitle="Dashboard statistics are derived from backend responses." />
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <MiniStat label="Processing" value={state.documents.filter((doc) => doc.status === 'Processing').length} />
              <MiniStat label="Failed" value={state.documents.filter((doc) => doc.status === 'Failed').length} />
              <MiniStat label="Experiments" value={state.experiments.length} />
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}

export function AdminUsersPage() {
  const currentUser = getSavedUser()
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [role, setRole] = useState(allOption)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [roleUpdatingId, setRoleUpdatingId] = useState('')

  useEffect(() => {
    let active = true
    getUsers()
      .then((result) => active && setUsers(unwrapList(result)))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const filtered = users.filter((user) => {
    const userRoles = (user.roles ?? []).map((item) => String(item).toUpperCase())
    const text = `${user.fullName ?? ''} ${user.email ?? ''}`.toLowerCase()
    return (
      (!query.trim() || text.includes(query.trim().toLowerCase())) &&
      (role === allOption || userRoles.includes(role))
    )
  })

  async function changeRole(userId, nextRole) {
    setError('')
    setRoleUpdatingId(userId)
    try {
      const updated = await updateUserRole(userId, nextRole)
      const nextUser = updated?.data ?? updated
      setUsers((current) => current.map((user) => {
        const currentId = user.userId ?? user.id
        if (currentId !== userId) return user
        return nextUser?.userId || nextUser?.id
          ? nextUser
          : { ...user, roles: [nextRole === 'USER' ? 'STUDENT' : nextRole] }
      }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setRoleUpdatingId('')
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteUser(deleteTarget.userId)
      setUsers((current) => current.filter((user) => user.userId !== deleteTarget.userId))
      setDeleteTarget(null)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <CrudPage description="Manage real backend user accounts and roles." icon={Users} title="User Management">
      {error ? <Alert message={error} /> : null}
      <Toolbar>
        <Field icon={Search} label="Search user" onChange={(event) => setQuery(event.target.value)} placeholder="Name or email..." value={query} />
        <SelectField label="Role" onChange={(event) => setRole(event.target.value)} value={role}>
          {[allOption, ...roles.filter((item) => item !== 'USER')].map((item) => <option key={item}>{item}</option>)}
        </SelectField>
      </Toolbar>
      {loading ? <Loading label="Loading users" /> : filtered.length ? (
        <DataTable
          columns={['User', 'Roles', 'Status', 'Actions']}
          rows={filtered.map((user) => {
            const userId = user.userId ?? user.id
            const isCurrentUser = userId === currentUser?.id
            const primaryRole = user.roles?.[0] ?? 'STUDENT'
            return [
              <Identity key="user" subtitle={user.email} title={user.fullName ?? user.name ?? 'FStu User'} />,
              <select
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60"
                disabled={roleUpdatingId === userId}
                key="role"
                onChange={(event) => changeRole(userId, event.target.value)}
                value={primaryRole}
              >
                {roles.map((item) => <option key={item}>{item}</option>)}
              </select>,
              <StatusBadge key="status" status={statusForBadge(user.isActive ?? true)} />,
              <RowActions key="actions">
                <IconButton disabled={isCurrentUser} label={isCurrentUser ? 'Current account' : 'Delete user'} onClick={() => setDeleteTarget(user)}><Trash2 size={15} /></IconButton>
              </RowActions>,
            ]
          })}
        />
      ) : <EmptyState title="No users" description="The backend returned no users for this account." />}
      {deleteTarget ? (
        <ConfirmModal actionLabel="Delete user" onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} title="Delete user?">
          The account "{deleteTarget.fullName}" will be removed from the backend.
        </ConfirmModal>
      ) : null}
    </CrudPage>
  )
}

export function AdminDocumentsPage() {
  const [docs, setDocs] = useState([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(allOption)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletingId, setDeletingId] = useState('')
  const [reindexingId, setReindexingId] = useState('')

  useEffect(() => {
    let active = true
    async function loadDocs() {
      try {
        const items = await getDocuments()
        if (!active) return
        if (active) setDocs(items)
      } catch (requestError) {
        if (active) setError(requestError.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    loadDocs()
    return () => {
      active = false
    }
  }, [])

  const filtered = docs.filter((doc) => {
    const q = query.toLowerCase().trim()
    return (
      (!q || doc.displayName.toLowerCase().includes(q)) &&
      (status === allOption || doc.status === status)
    )
  })

  async function reindexDoc(doc) {
    setReindexingId(doc.id)
    setError('')
    try {
      const model = await getActiveEmbeddingModel()
      if (!model) throw new Error('No active embedding model found.')
      const job = await reindexDocument(doc.id, model.embeddingModelId)
      await waitForIndexingJob(job.id, {
        onProgress: (currentJob) => setDocs((current) => current.map((item) => item.id === doc.id ? {
          ...item,
          status: 'Processing',
          embeddingStatus: `${currentJob.stage} ${currentJob.progress}%`,
        } : item)),
      })
      setDocs((current) => current.map((item) => item.id === doc.id ? {
        ...item,
        status: 'Indexed',
        embeddingStatus: 'Prepared',
        embeddedChunks: item.chunks,
        embeddingModel: model.name,
      } : item))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setReindexingId('')
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deletingId) return
    if (!deleteTarget.canDelete) {
      setError('You do not have permission to delete this document.')
      setDeleteTarget(null)
      return
    }
    setDeletingId(deleteTarget.id)
    setError('')
    try {
      await deleteDocument(deleteTarget.id)
      setDocs((current) => current.filter((doc) => doc.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDeletingId('')
    }
  }

  return (
    <CrudPage description="Manage documents returned by the backend document API." icon={FileText} title="Document Management">
      {error ? <Alert message={error} /> : null}
      <Toolbar>
        <Field icon={Search} label="Search document" onChange={(event) => setQuery(event.target.value)} placeholder="Filename..." value={query} />
        <SelectField label="Status" onChange={(event) => setStatus(event.target.value)} value={status}>
          {[allOption, 'Uploaded', 'Processing', 'Processed', 'Indexed', 'Failed'].map((item) => <option key={item}>{item}</option>)}
        </SelectField>
      </Toolbar>
      {loading ? <Loading label="Loading documents" /> : filtered.length ? (
        <DataTable
          columns={['Document', 'Workspace', 'Status', 'Embeddings', 'Chunks', 'Pages', 'Actions']}
          rows={filtered.map((doc) => [
            <Identity key="doc" subtitle={doc.type || 'File'} title={doc.displayName} />,
            doc.subject,
            <StatusBadge key="status" status={doc.status} />,
            <StatusBadge key="embeddings" status={doc.embeddingStatus} />,
            doc.chunks,
            doc.pages,
            <RowActions key="actions">
              <IconButton disabled={reindexingId === doc.id} label="Prepare embeddings" onClick={() => reindexDoc(doc)}><RefreshCcw className={reindexingId === doc.id ? 'animate-spin' : ''} size={15} /></IconButton>
              {doc.canDelete ? (
                <IconButton disabled={deletingId === doc.id} label="Delete" onClick={() => setDeleteTarget(doc)}><Trash2 size={15} /></IconButton>
              ) : null}
            </RowActions>,
          ])}
        />
      ) : <EmptyState title="No documents" description="The backend returned no documents for the current requester." />}
      {deleteTarget ? (
        <ConfirmModal
          actionLabel="Delete document"
          busy={deletingId === deleteTarget.id}
          busyLabel="Deleting..."
          onCancel={() => {
            if (!deletingId) setDeleteTarget(null)
          }}
          onConfirm={confirmDelete}
          title="Delete document?"
        >
          "{deleteTarget.displayName}" will be removed from the backend.
        </ConfirmModal>
      ) : null}
    </CrudPage>
  )
}

export function AdminResearchDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedExperimentId = searchParams.get('experimentId') || ''
  const [experiments, setExperiments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedExpId, setSelectedExpId] = useState('')
  const [results, setResults] = useState([])
  const [loadingResults, setLoadingResults] = useState(false)
  const capabilities = null
  const dashboard = { configurations: [] }

  useEffect(() => {
    let active = true
    getExperiments()
      .then((list) => {
        if (!active) return
        setExperiments(list)
        if (list.length > 0) {
          const requested = list.find((experiment) => experiment.id === requestedExperimentId)
          const completed = list.find((experiment) => experiment.status === 'COMPLETED')
          setSelectedExpId(requested?.id || completed?.id || list[0].id)
        }
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [requestedExperimentId])

  useEffect(() => {
    if (!selectedExpId) {
      queueMicrotask(() => setResults([]))
      return undefined
    }

    let active = true
    queueMicrotask(() => setLoadingResults(true))
    getExperimentResults(selectedExpId)
      .then((list) => active && setResults(list))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoadingResults(false))
    return () => {
      active = false
    }
  }, [selectedExpId])

  const currentMetrics = useMemo(() => {
    if (results.length === 0) return null
    const count = results.length
    const totals = results.reduce((acc, result) => ({
      faithfulness: acc.faithfulness + (result.faithfulness ?? 0),
      answerRelevance: acc.answerRelevance + (result.answerRelevance ?? 0),
      semanticSimilarity: acc.semanticSimilarity + (result.semanticSimilarity ?? 0),
      contextPrecision: acc.contextPrecision + (result.contextPrecision ?? 0),
      contextRecall: acc.contextRecall + (result.contextRecall ?? 0),
      answerCorrectness: acc.answerCorrectness + (result.answerCorrectness ?? 0),
      latencyMs: acc.latencyMs + (result.latencyMs ?? 0),
      cost: acc.cost + Number(result.cost ?? 0),
      inputTokens: acc.inputTokens + (result.inputTokens ?? 0),
      outputTokens: acc.outputTokens + (result.outputTokens ?? 0),
      totalTokens: acc.totalTokens + (result.totalTokens ?? 0),
    }), {
      faithfulness: 0,
      answerRelevance: 0,
      semanticSimilarity: 0,
      contextPrecision: 0,
      contextRecall: 0,
      answerCorrectness: 0,
      latencyMs: 0,
      cost: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    })

    return {
      faithfulness: Number((totals.faithfulness / count).toFixed(2)),
      answerRelevance: Number((totals.answerRelevance / count).toFixed(2)),
      semanticSimilarity: Number((totals.semanticSimilarity / count).toFixed(2)),
      contextPrecision: Number((totals.contextPrecision / count).toFixed(2)),
      contextRecall: Number((totals.contextRecall / count).toFixed(2)),
      answerCorrectness: Number((totals.answerCorrectness / count).toFixed(2)),
      avgLatencyMs: Math.round(totals.latencyMs / count),
      avgCost: Number((totals.cost / count).toFixed(6)),
      avgInputTokens: Math.round(totals.inputTokens / count),
      avgOutputTokens: Math.round(totals.outputTokens / count),
      avgTotalTokens: Math.round(totals.totalTokens / count),
    }
  }, [results])

  const selectedExperiment = experiments.find((experiment) => experiment.id === selectedExpId)
  const completedExperiments = experiments.filter((experiment) => experiment.status === 'COMPLETED').length
  const runningExperiments = experiments.filter((experiment) => experiment.status === 'RUNNING').length

  function handleExperimentChange(experimentId) {
    setSelectedExpId(experimentId)
    setSearchParams({ experimentId })
  }

  return (
    <CrudPage
      description="Analyze experiment records and result rows returned by backend evaluation APIs."
      icon={BarChart3}
      title="Research Dashboard"
    >
      {error ? <Alert message={error} /> : null}
      {loading ? <Loading label="Loading experiments" /> : (
        <div className="space-y-5">
          <Panel className="overflow-hidden p-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-teal-100/55 via-white/30 to-transparent" />
            <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div>
                <SectionTitle
                  icon={FlaskConical}
                  subtitle={selectedExperiment?.name || 'No experiment selected'}
                  title="Experiment Results"
                />

                {selectedExperiment ? (
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-lg border border-teal-100 bg-teal-50 px-2.5 py-1 font-semibold text-primary">
                      {selectedExperiment.method || selectedExperiment.experimentType || 'Evaluation'}
                    </span>
                    <span className="rounded-lg border border-slate-200 bg-white/72 px-2.5 py-1 font-medium text-slate-600">
                      {selectedExperiment.llmModel || 'No model name'}
                    </span>
                    <span className="rounded-lg border border-slate-200 bg-white/72 px-2.5 py-1 font-medium text-slate-600">
                      Dataset: {selectedExperiment.datasetId || 'Not set'}
                    </span>
                    <span className="rounded-lg border border-slate-200 bg-white/72 px-2.5 py-1 font-medium text-slate-600">
                      Workspace: {selectedExperiment.workspaceId || 'Not set'}
                    </span>
                    <StatusBadge status={statusForBadge(selectedExperiment.status)} />
                  </div>
                ) : null}
              </div>

              {experiments.length > 0 ? (
                <label className="block text-sm font-semibold text-slate-700">
                  Experiment
                  <select
                    className="mt-1 h-11 w-full rounded-xl border border-border bg-white/90 px-3 text-sm font-medium text-slate-900 shadow-[0_10px_24px_rgba(15,118,110,.06)] outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                    onChange={(event) => handleExperimentChange(event.target.value)}
                    value={selectedExpId}
                  >
                    {experiments.map((experiment) => (
                      <option key={experiment.id} value={experiment.id}>
                        {experiment.name} ({experiment.status})
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-white/52 p-4 text-sm font-medium leading-6 text-slate-500">
                  No experiment records were returned by the backend.
                </p>
              )}
            </div>
          </Panel>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={Activity} label="Result rows" value={results.length} />
            <MetricCard icon={Brain} label="Experiments" value={experiments.length} />
            <MetricCard icon={Gauge} label="Completed" value={completedExperiments} />
            <MetricCard icon={Database} label="Running" value={runningExperiments} />
          </div>

          {capabilities ? (
            <Panel className="p-4">
              <SectionTitle
                icon={Gauge}
                title="Evaluation capability"
                subtitle={capabilities.officialRagasEnabled || capabilities.official_ragas_enabled
                  ? `Official RAGAS · ${capabilities.judgeModel ?? capabilities.judge_model ?? 'local judge'}`
                  : 'Official RAGAS is not ready; proxy metrics are not presented as RAGAS.'}
              />
            </Panel>
          ) : null}

          {currentMetrics ? (
            <Panel className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <SectionTitle icon={BarChart3} title="Backend Result Metrics" subtitle="Averages computed only from real experiment result rows." />
                <div className="grid grid-cols-2 gap-2 text-right md:grid-cols-5">
                  <MiniStat label="Avg latency" value={`${currentMetrics.avgLatencyMs} ms`} />
                  <MiniStat label="Avg cost" value={`$${currentMetrics.avgCost}`} />
                  <MiniStat label="Input tokens" value={currentMetrics.avgInputTokens} />
                  <MiniStat label="Output tokens" value={currentMetrics.avgOutputTokens} />
                  <MiniStat label="Total tokens" value={currentMetrics.avgTotalTokens} />
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <ScoreStat label="Faithfulness" value={currentMetrics.faithfulness} />
                <ScoreStat label="Answer relevance" value={currentMetrics.answerRelevance} />
                <ScoreStat label="Context precision" value={currentMetrics.contextPrecision} />
                <ScoreStat label="Context recall" value={currentMetrics.contextRecall} />
                <ScoreStat label="Answer correctness" value={currentMetrics.answerCorrectness} />
                <ScoreStat label="Semantic similarity" value={currentMetrics.semanticSimilarity} />
              </div>
            </Panel>
          ) : null}

          {dashboard.configurations.length ? (
            <Panel className="overflow-hidden p-5">
              <SectionTitle icon={BarChart3} title="Configuration comparison" subtitle={`Recommended: ${dashboard.recommended?.name ?? dashboard.recommended ?? 'pending'}`} />
              <div className="mt-4">
                <DataTable
                  columns={['Configuration', 'Embedding', 'Chunking', 'Mode', 'Faithfulness', 'Relevance', 'Latency']}
                  rows={dashboard.configurations.map((item) => [
                    item.name ?? item.configuration,
                    item.embeddingModelName ?? item.embeddingModel,
                    item.chunkingStrategy,
                    item.generationMode,
                    `${Math.round((item.metrics?.faithfulness ?? item.faithfulness ?? 0) * 100)}%`,
                    `${Math.round((item.metrics?.answerRelevance ?? item.answerRelevance ?? 0) * 100)}%`,
                    `${item.metrics?.averageLatencyMs ?? item.averageLatencyMs ?? 0} ms`,
                  ])}
                />
              </div>
            </Panel>
          ) : null}

          {loadingResults ? <Loading label="Loading experiment results" /> : results.length > 0 ? (
            <DataTable
              columns={['Question', 'Generated Answer', 'Metrics', 'Latency', 'Tokens', 'Status']}
              rows={results.map((result, index) => [
                <ResultQuestion
                  groundTruth={result.groundTruthAnswer}
                  index={index}
                  key="question"
                  question={result.questionText}
                  questionId={result.evaluationQuestionId}
                />,
                <div className="max-w-md space-y-2 leading-6 text-slate-600" key="answer">
                  <p className="line-clamp-3">{result.generatedAnswer || 'No generated answer returned.'}</p>
                  {result.citations?.length ? <p className="text-xs font-semibold text-slate-500">Citations: {result.citations.length}</p> : null}
                </div>,
                <ResultMetrics key="metrics" result={result} />,
                <span className="text-slate-600" key="latency">{result.latencyMs ?? 0} ms</span>,
                <span className="text-slate-600" key="tokens">{result.totalTokens ?? 0} total</span>,
                result.errorMessage
                  ? <span className="font-semibold text-red-600" key="error">{result.errorMessage}</span>
                  : <span className="font-semibold text-emerald-700" key="ok">Success</span>,
              ])}
            />
          ) : (
            <EmptyState
              title="No experiment results"
              description={emptyResultsDescription(selectedExperiment)}
            />
          )}
        </div>
      )}
    </CrudPage>
  )
}

function ResultQuestion({ groundTruth, index, question, questionId }) {
  return (
    <div className="max-w-sm space-y-2">
      <p className="font-semibold text-slate-800">Q{index + 1}: {question || questionId || 'Backend question'}</p>
      {groundTruth ? <p className="line-clamp-3 text-xs font-medium leading-5 text-slate-500">Ground truth: {groundTruth}</p> : null}
    </div>
  )
}

function ResultMetrics({ result }) {
  const items = [
    ['Faithfulness', result.faithfulness],
    ['Relevance', result.answerRelevance],
    ['Precision', result.contextPrecision],
    ['Recall', result.contextRecall],
    ['Correctness', result.answerCorrectness],
    ['Similarity', result.semanticSimilarity],
  ]

  return (
    <div className="grid min-w-44 gap-1 text-xs font-semibold text-slate-600">
      {items.map(([label, value]) => (
        <span className="flex justify-between gap-3" key={label}>
          <span>{label}</span>
          <span className="text-slate-900">{Math.round((value ?? 0) * 100)}%</span>
        </span>
      ))}
    </div>
  )
}

function emptyResultsDescription(experiment) {
  if (!experiment) return 'Select an experiment to load backend result rows.'
  if (experiment.status === 'PENDING') return 'Run this experiment from Test Set / Ground Truth to generate result rows.'
  if (experiment.status === 'FAILED') return 'The experiment failed. Check the benchmark error, then rerun it from Test Set / Ground Truth.'
  if (experiment.status === 'COMPLETED') return 'The experiment completed, but no result rows were returned.'
  if (experiment.status === 'RUNNING') return 'The experiment is running. Refresh after the backend finishes writing result rows.'
  return 'The selected experiment has no result rows from the backend yet.'
}

function CrudPage({ actions, children, description, icon, title }) {
  return (
    <div>
      <AdminPageHeader actions={actions} description={description} icon={icon} title={title} />
      {children}
    </div>
  )
}

function Toolbar({ children }) {
  return (
    <Panel className="mb-4 p-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </Panel>
  )
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <Panel className="overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-teal-100/45 to-transparent" />
      <div className="relative flex items-center justify-between gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-teal-100 bg-teal-50 text-primary shadow-sm">
          <Icon size={19} />
        </div>
        <p className="truncate text-3xl font-black tracking-tight text-slate-950">{value}</p>
      </div>
      <p className="relative mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
    </Panel>
  )
}

function SectionTitle({ icon: Icon, subtitle, title }) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-teal-100 bg-teal-50 text-primary shadow-sm">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <h2 className="text-lg font-black tracking-tight">{title}</h2>
        <p className="text-sm font-medium leading-6 text-slate-500">{subtitle}</p>
      </div>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/72 px-4 py-3 shadow-[0_12px_28px_rgba(15,118,110,.06)]">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </div>
  )
}

function ScoreStat({ label, value }) {
  const percent = Math.round((value ?? 0) * 100)

  return (
    <div className="rounded-xl border border-white/80 bg-white/72 p-4 shadow-[0_12px_28px_rgba(15,118,110,.06)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-sm font-black text-slate-950">{percent}%</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  )
}

function DataTable({ columns, rows }) {
  return (
    <Panel className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-white/62 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            <tr>
              {columns.map((column) => <th className="border-b border-slate-200 px-4 py-3.5" key={column}>{column}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr className="bg-white/58 transition-colors duration-200 hover:bg-teal-50/65" key={index}>
                {row.map((cell, cellIndex) => <td className="px-4 py-4 align-top leading-6 text-slate-700" key={cellIndex}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function RowActions({ children }) {
  return <div className="flex flex-wrap items-center gap-1">{children}</div>
}

function Identity({ subtitle, title }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold text-slate-950">{title}</p>
      <p className="text-xs font-medium text-slate-500">{subtitle}</p>
    </div>
  )
}

function Loading({ label }) {
  return <Panel className="flex min-h-40 items-center justify-center gap-3 p-5 text-sm font-semibold text-slate-600"><Loader2 className="animate-spin text-primary" size={20} />{label}</Panel>
}

function Alert({ message }) {
  return <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"><AlertTriangle className="mt-0.5 shrink-0" size={17} />{message}</div>
}
