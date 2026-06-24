import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  Database,
  Eye,
  FileText,
  FlaskConical,
  Gauge,
  Loader2,
  Lock,
  RefreshCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Unlock,
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
import { deleteDocument, getDocuments } from '../../services/documentService.js'
import { request } from '../../services/httpClient.js'
import { getActiveEmbeddingModel, prepareEmbeddings } from '../../services/ragService.js'
import { cn } from '../../utils/cn.js'

const allOption = 'All'

function unwrapList(result) {
  return Array.isArray(result) ? result : (result?.data ?? [])
}

function statusForBadge(value) {
  if (value === true || value === 'ACTIVE' || value === 'Active') return 'Indexed'
  if (value === false || value === 'LOCKED' || value === 'Locked') return 'Failed'
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
      request('/evaluation/experiments').then(unwrapList).catch(() => []),
    ])
      .then(([users, documents, courses, experiments]) => {
        if (active) setState({ loading: false, error: '', users, documents, courses, experiments })
      })
      .catch((error) => active && setState((current) => ({ ...current, loading: false, error: error.message })))
    return () => {
      active = false
    }
  }, [])

  const indexed = state.documents.filter((doc) => doc.status === 'Indexed').length

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
            <MetricCard icon={Database} label="Indexed documents" value={indexed} />
          </div>
          <Panel className="p-5">
            <SectionTitle icon={BarChart3} title="Live data source" subtitle="Mock statistics have been removed from the admin dashboard." />
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
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [role, setRole] = useState(allOption)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

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
    const roles = user.roles ?? []
    const text = `${user.fullName ?? ''} ${user.email ?? ''}`.toLowerCase()
    return (
      (!query.trim() || text.includes(query.trim().toLowerCase())) &&
      (role === allOption || roles.includes(role))
    )
  })

  async function changeRole(userId, nextRole) {
    setError('')
    const updated = await updateUserRole(userId, nextRole).catch((requestError) => {
      setError(requestError.message)
      return null
    })
    if (!updated) return
    const nextUser = updated.data ?? updated
    setUsers((current) => current.map((user) => user.userId === userId ? nextUser : user))
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
          {[allOption, 'ADMIN', 'STUDENT'].map((item) => <option key={item}>{item}</option>)}
        </SelectField>
      </Toolbar>
      {loading ? <Loading label="Loading users" /> : filtered.length ? (
        <DataTable
          columns={['User', 'Roles', 'Status', 'Actions']}
          rows={filtered.map((user) => [
            <Identity key="user" subtitle={user.email} title={user.fullName} />,
            <select className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black" key="role" onChange={(event) => changeRole(user.userId, event.target.value)} value={user.roles?.[0] ?? 'STUDENT'}>
              {['STUDENT', 'ADMIN'].map((item) => <option key={item}>{item}</option>)}
            </select>,
            <StatusBadge key="status" status={statusForBadge(user.isActive)} />,
            <RowActions key="actions">
              <IconButton label="Delete user" onClick={() => setDeleteTarget(user)}><Trash2 size={15} /></IconButton>
            </RowActions>,
          ])}
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
  const [reindexingId, setReindexingId] = useState('')

  useEffect(() => {
    let active = true
    getDocuments()
      .then((items) => active && setDocs(items))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
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
      const result = await prepareEmbeddings(doc.id, doc.workspaceId, model.embeddingModelId)
      setDocs((current) => current.map((item) => item.id === doc.id ? {
        ...item,
        status: 'Indexed',
        chunks: result?.totalChunks ?? result?.createdEmbeddings ?? item.chunks,
        embeddingModel: model.modelName,
      } : item))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setReindexingId('')
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteDocument(deleteTarget.id)
      setDocs((current) => current.filter((doc) => doc.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <CrudPage description="Manage documents returned by the backend document API." icon={FileText} title="Document Management">
      {error ? <Alert message={error} /> : null}
      <Toolbar>
        <Field icon={Search} label="Search document" onChange={(event) => setQuery(event.target.value)} placeholder="Filename..." value={query} />
        <SelectField label="Status" onChange={(event) => setStatus(event.target.value)} value={status}>
          {[allOption, 'Uploaded', 'Processing', 'Indexed', 'Failed'].map((item) => <option key={item}>{item}</option>)}
        </SelectField>
      </Toolbar>
      {loading ? <Loading label="Loading documents" /> : filtered.length ? (
        <DataTable
          columns={['Document', 'Workspace', 'Status', 'Chunks', 'Pages', 'Actions']}
          rows={filtered.map((doc) => [
            <Identity key="doc" subtitle={doc.type || 'File'} title={doc.displayName} />,
            doc.subject,
            <StatusBadge key="status" status={doc.status} />,
            doc.chunks,
            doc.pages,
            <RowActions key="actions">
              <IconButton disabled={reindexingId === doc.id} label="Re-index" onClick={() => reindexDoc(doc)}><RefreshCcw className={reindexingId === doc.id ? 'animate-spin' : ''} size={15} /></IconButton>
              <IconButton label="Delete" onClick={() => setDeleteTarget(doc)}><Trash2 size={15} /></IconButton>
            </RowActions>,
          ])}
        />
      ) : <EmptyState title="No documents" description="The backend returned no documents for the current requester." />}
      {deleteTarget ? (
        <ConfirmModal actionLabel="Delete document" onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} title="Delete document?">
          "{deleteTarget.displayName}" will be removed from the backend.
        </ConfirmModal>
      ) : null}
    </CrudPage>
  )
}

export function AdminSubjectsPage() {
  return <RedirectNotice title="Subjects moved" description="Use the Courses page. Subject mock data has been removed." icon={BookOpen} />
}

export function AdminIndexingPage() {
  return <RedirectNotice title="Indexing jobs" description="No live indexing-job endpoint is available yet, so mock jobs are not shown." icon={Database} />
}

export function AdminModelSettingsPage() {
  const [model, setModel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getActiveEmbeddingModel()
      .then((result) => active && setModel(result))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  return (
    <CrudPage description="Read active embedding configuration from the backend." icon={Settings} title="Model Settings">
      {error ? <Alert message={error} /> : null}
      {loading ? <Loading label="Loading model settings" /> : model ? (
        <Panel className="p-5">
          <SectionTitle icon={Brain} title={model.modelName ?? 'Embedding model'} subtitle="Active backend model configuration" />
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <MiniStat label="Provider" value={model.provider ?? 'Backend'} />
            <MiniStat label="Dimension" value={model.dimension ?? 'N/A'} />
            <MiniStat label="Status" value={model.isActive ? 'Active' : 'Inactive'} />
          </div>
        </Panel>
      ) : <EmptyState title="No model settings" description="The backend did not return an active embedding model." />}
    </CrudPage>
  )
}

export function AdminTestSetPage() {
  return <EvaluationList endpoint="/evaluation/datasets" icon={FlaskConical} title="Test Sets" />
}

export function AdminExperimentsPage() {
  return <EvaluationList endpoint="/evaluation/experiments" icon={Brain} title="Experiments" />
}

export function AdminResearchDashboardPage() {
  return <RedirectNotice title="Research Dashboard" description="Research mock charts were removed. Connect this page to backend evaluation results when the API is ready." icon={ShieldCheck} />
}

export function AdminLogsPage() {
  return <RedirectNotice title="System Logs" description="No live log endpoint is available yet, so mock logs are not shown." icon={AlertTriangle} />
}

function EvaluationList({ endpoint, icon, title }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    request(endpoint)
      .then((result) => active && setItems(unwrapList(result)))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [endpoint])

  return (
    <CrudPage description="Data loaded from backend evaluation APIs." icon={icon} title={title}>
      {error ? <Alert message={error} /> : null}
      {loading ? <Loading label={`Loading ${title.toLowerCase()}`} /> : items.length ? (
        <DataTable
          columns={['Name', 'Type', 'Status']}
          rows={items.map((item) => [
            item.datasetName ?? item.experimentName ?? item.name ?? item.id,
            item.experimentType ?? item.llmModel ?? item.courseId ?? 'Backend record',
            <StatusBadge key="status" status={statusForBadge(item.status ?? item.isActive ?? 'Uploaded')} />,
          ])}
        />
      ) : <EmptyState title={`No ${title.toLowerCase()}`} description="The backend returned an empty list." />}
    </CrudPage>
  )
}

function RedirectNotice({ description, icon, title }) {
  return (
    <CrudPage description={description} icon={icon} title={title}>
      <EmptyState title={title} description={description} />
    </CrudPage>
  )
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
    <Panel className="p-4">
      <div className="flex items-center justify-between">
        <div className="grid size-11 place-items-center rounded-lg bg-teal-50 text-primary">
          <Icon size={19} />
        </div>
        <p className="text-4xl font-black">{value}</p>
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
    </Panel>
  )
}

function SectionTitle({ icon: Icon, subtitle, title }) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-primary">
        <Icon size={18} />
      </div>
      <div>
        <h2 className="text-lg font-black tracking-tight">{title}</h2>
        <p className="text-sm font-semibold text-slate-500">{subtitle}</p>
      </div>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg bg-white/72 p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  )
}

function DataTable({ columns, rows }) {
  return (
    <Panel className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-white/52 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            <tr>
              {columns.map((column) => <th className="border-b border-slate-200 px-4 py-3" key={column}>{column}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr className="bg-white/58 transition hover:bg-teal-50/70" key={index}>
                {row.map((cell, cellIndex) => <td className="px-4 py-4 align-top text-slate-700" key={cellIndex}>{cell}</td>)}
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
      <p className="font-black text-slate-950">{title}</p>
      <p className="text-xs font-semibold text-slate-500">{subtitle}</p>
    </div>
  )
}

function Loading({ label }) {
  return <Panel className="flex min-h-40 items-center justify-center gap-3 p-5 text-sm font-black text-slate-600"><Loader2 className="animate-spin text-primary" size={20} />{label}</Panel>
}

function Alert({ message }) {
  return <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700"><AlertTriangle className="mt-0.5 shrink-0" size={17} />{message}</div>
}
