import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  Database,
  FileText,
  FlaskConical,
  Gauge,
  HardDrive,
  Loader2,
  LineChart,
  Plus,
  RefreshCcw,
  Search,
  ServerCog,
  ShieldCheck,
  Trash2,
  Upload,
  Check,
  ChevronDown,
  Eye,
  X,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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
import { AdminPageHeader, useAdminOperationalHealth } from '../../layouts/AdminLayout.jsx'
import {
  ADMIN_ROLE,
  STUDENT_ROLE,
  deleteUser,
  getSavedUser,
  getUsers,
  normalizeRoles,
  updateUserRole,
} from '../../services/authService.js'
import { getChapters, getCourses, getSemesterWorkspaces } from '../../services/courseService.js'
import {
  getDocumentPreviewUrl, getDocuments, reindexDocument, waitForIndexingJob,
} from '../../services/documentService.js'
import { deleteFile, uploadFiles } from '../../services/uploadService.js'
import {
  getExperimentResults,
  getExperiments,
} from '../../services/evaluationService.js'
import { getActiveEmbeddingModel } from '../../services/ragService.js'
import {
  getAdminDashboardHealth,
  getAdminDashboardSummary,
  getAdminDashboardTimeseries,
} from '../../services/adminDashboardService.js'

const allOption = 'All'
const roles = [ADMIN_ROLE, STUDENT_ROLE]
const dashboardPeriods = [7, 14, 30, 90]
const activityMetrics = {
  retrievals: { key: 'retrievals', label: 'Retrievals', color: '#0f766e' },
  uploads: { key: 'uploads', label: 'Uploads', color: '#0f766e' },
  experiments: { key: 'experiments', label: 'Experiments', color: '#0f766e' },
}

function unwrapList(result) {
  return Array.isArray(result) ? result : (result?.data ?? [])
}

function statusForBadge(value) {
  if (value === true || value === 'ACTIVE' || value === 'Active' || value === 'COMPLETED' || value === 'PROCESSED') return 'Indexed'
  if (value === 'RUNNING') return 'Processing'
  if (value === 'PENDING' || value === 'QUEUED') return 'Pending'
  if (value === 'NO_TEXT') return 'No text'
  if (value === false || value === 'LOCKED' || value === 'Locked' || value === 'FAILED' || value === 'CANCELLED') return 'Failed'
  return value ?? 'Uploaded'
}

export function AdminDashboardPage() {
  const { updateOperationalHealth } = useAdminOperationalHealth()
  const [period, setPeriod] = useState(14)
  const [activityMetric, setActivityMetric] = useState('retrievals')
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState({
    loading: true,
    errors: {},
    summary: null,
    timeseries: null,
    timeseriesPeriod: null,
    health: null,
    updatedAt: null,
  })

  useEffect(() => {
    let active = true
    async function loadDashboard() {
      setState((current) => ({ ...current, loading: true, errors: {} }))
      const [summaryResult, timeseriesResult, healthResult] = await Promise.allSettled([
        getAdminDashboardSummary(),
        getAdminDashboardTimeseries(period),
        getAdminDashboardHealth(),
      ])

      if (!active) return

      const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : null
      const timeseries = timeseriesResult.status === 'fulfilled' ? timeseriesResult.value : null
      const health = healthResult.status === 'fulfilled' ? healthResult.value : null
      const errors = {
        summary: summaryResult.status === 'rejected' ? summaryResult.reason?.message || 'Could not load summary data.' : '',
        timeseries: timeseriesResult.status === 'rejected' ? timeseriesResult.reason?.message || 'Could not load activity data.' : '',
        health: healthResult.status === 'rejected' ? healthResult.reason?.message || 'Could not load operational alerts.' : '',
      }

      if (health) updateOperationalHealth(health)
      setState((current) => ({
        loading: false,
        errors,
        summary: summary ?? current.summary,
        timeseries: timeseries ?? current.timeseries,
        timeseriesPeriod: timeseries ? period : current.timeseriesPeriod,
        health: health ?? current.health,
        updatedAt: summary || timeseries || health ? new Date().toISOString() : current.updatedAt,
      }))
    }

    loadDashboard()
    return () => {
      active = false
    }
  }, [period, reloadKey, updateOperationalHealth])

  const summary = state.summary
  const totals = summary?.totals ?? {}
  const documents = summary?.documents ?? {}
  const experiments = summary?.experiments ?? {}
  const activity = summary?.activity ?? {}
  const chartData = useMemo(() => (state.timeseries?.points ?? []).map((point) => ({
    dateKey: point.date,
    date: formatShortDate(point.date),
    fullDate: formatFullDate(point.date),
    uploads: Number(point.documentUploads ?? 0),
    retrievals: Number(point.retrievalQueries ?? 0),
    experiments: Number(point.experimentsCreated ?? 0),
  })), [state.timeseries])
  const activityTotals = useMemo(() => chartData.reduce((accumulator, point) => ({
    uploads: accumulator.uploads + point.uploads,
    retrievals: accumulator.retrievals + point.retrievals,
    experiments: accumulator.experiments + point.experiments,
  }), { uploads: 0, retrievals: 0, experiments: 0 }), [chartData])
  const selectedActivityMetric = activityMetrics[activityMetric]
  const chartPeriod = state.timeseriesPeriod ?? period
  const chartTickValues = useMemo(() => {
    if (!chartData.length) return []
    if (chartPeriod < 30) return chartData.map((point) => point.date)

    if (chartPeriod === 30) {
      const tickValues = chartData
        .filter((_, index) => index % 3 === 0)
        .map((point) => point.date)
      const lastDate = chartData[chartData.length - 1]?.date

      if (lastDate && tickValues[tickValues.length - 1] !== lastDate) {
        tickValues.push(lastDate)
      }

      return tickValues
    }

    if (chartData.length <= 3) return chartData.map((point) => point.date)
    return [chartData[0].date, chartData[Math.floor((chartData.length - 1) / 2)].date, chartData[chartData.length - 1].date]
  }, [chartData, chartPeriod])
  const showingStaleTimeseries = Boolean(state.timeseries && chartPeriod !== period)
  const healthItems = state.health?.items ?? []
  const errorMessages = Object.values(state.errors).filter(Boolean)
  const hasData = Boolean(summary || state.timeseries || state.health)
  const initialLoading = state.loading && !hasData

  const retryDashboard = () => setReloadKey((current) => current + 1)

  return (
    <div className="space-y-4">
      <AdminPageHeader
        actions={<div className="flex flex-wrap items-center justify-end gap-2"><span className="text-xs font-semibold text-slate-500">{state.updatedAt ? `Updated ${formatActivityTime(state.updatedAt)}` : 'Not updated yet'}</span><Button disabled={state.loading} onClick={retryDashboard} type="button" variant="secondary"><RefreshCcw className={state.loading ? 'animate-spin' : ''} size={15} />Refresh</Button></div>}
        description="Monitor content intake, platform activity, and research operations from one place."
        icon={Gauge}
        title="Admin Dashboard"
      />
      {errorMessages.length ? <Alert action={<Button onClick={retryDashboard} size="sm" type="button" variant="secondary">Try again</Button>} message={hasData ? 'Some sections could not refresh. The dashboard is showing the last available data where possible.' : 'The dashboard data is unavailable right now.'} /> : null}
      {initialLoading ? <DashboardSkeleton /> : (
        <>
          {summary ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard detail={`${formatNumber(totals.activeUsers)} active`} icon={Users} label="Users" linkTo="/admin/users" value={formatNumber(totals.users)} />
            <MetricCard detail={`${formatNumber(totals.activeCourses)} active`} icon={BookOpen} label="Courses" linkTo="/admin/courses" value={formatNumber(totals.courses)} />
            <MetricCard detail={`${formatNumber(documents.processed)} indexed`} icon={FileText} label="Documents" linkTo="/admin/documents" value={formatNumber(totals.documents)} />
            <MetricCard detail={`${formatNumber(totals.experiments)} total experiments`} icon={Database} label="Test datasets" linkTo="/admin/test-set" value={formatNumber(totals.datasets)} />
          </div> : <DataUnavailable description={state.errors.summary || 'Summary data is not available yet.'} title="Summary unavailable" />}

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]">
            <Panel className="overflow-hidden p-5">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-24 bg-gradient-to-r from-teal-100/55 via-white/20 to-transparent" />
              <div className="relative z-10">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <SectionTitle icon={LineChart} title="Platform activity" subtitle={`Daily ${selectedActivityMetric.label.toLowerCase()} across the last ${chartPeriod} days.${showingStaleTimeseries ? ' Updating the selected range.' : ''}`} />
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <DashboardTabs label="Activity metric" onChange={setActivityMetric} options={Object.values(activityMetrics)} value={activityMetric} />
                    <DashboardTabs label="Activity period" onChange={setPeriod} options={dashboardPeriods.map((value) => ({ key: value, label: `${value}d` }))} value={period} />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="grid grid-cols-3 gap-2 text-right">
                    <MiniStat label="Retrievals" value={formatNumber(activityTotals.retrievals)} />
                    <MiniStat label="Uploads" value={formatNumber(activityTotals.uploads)} />
                    <MiniStat label="Experiments" value={formatNumber(activityTotals.experiments)} />
                  </div>
                  {summary ? <p className="text-xs font-semibold text-slate-500">Total storage: {formatBytes(documents.totalStorageBytes)}</p> : null}
                </div>
                <div className="mt-5 h-72">
                  {state.timeseries ? chartData.length ? (
                    <div aria-describedby="activity-chart-summary" aria-label={`Daily ${selectedActivityMetric.label.toLowerCase()} for the last ${chartPeriod} days`} className="h-full" role="img">
                      <p className="sr-only" id="activity-chart-summary">The selected activity metric totals {formatNumber(activityTotals[selectedActivityMetric.key])} over the last {chartPeriod} days.</p>
                      <ResponsiveContainer height="100%" width="100%">
                        <AreaChart data={chartData} margin={{ bottom: 0, left: -18, right: 10, top: 10 }}>
                        <defs>
                          <linearGradient id="dashboardActivity" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor={selectedActivityMetric.color} stopOpacity={0.32} />
                            <stop offset="95%" stopColor={selectedActivityMetric.color} stopOpacity={0.03} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#dbe7e5" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" interval={0} padding={{ left: 8, right: 8 }} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} tickLine={false} tickMargin={8} ticks={chartTickValues} />
                        <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} tickLine={false} />
                        <Tooltip content={<DashboardTooltip />} />
                        <Area dataKey={selectedActivityMetric.key} fill="url(#dashboardActivity)" name={selectedActivityMetric.label} stroke={selectedActivityMetric.color} strokeWidth={2.5} type="monotone" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyInline title="No activity data" description="The backend returned no timeseries points yet." />
                  ) : <DataUnavailable description={state.errors.timeseries || 'Activity data is not available yet.'} title="Activity unavailable" compact />}
                </div>
              </div>
            </Panel>

            <section id="operational-alerts">
              <Panel className="p-5">
                <SectionTitle icon={ServerCog} title="Operational alerts" subtitle={state.health?.status === 'OK' ? 'All monitored checks are clear.' : 'Items needing review are listed below.'} />
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {state.health ? healthItems.length ? healthItems.map((item) => <HealthRow item={item} key={item.key} />) : <EmptyInline title="No operational checks" description="The backend returned no operational alert records." /> : <DataUnavailable description={state.errors.health || 'Operational alerts are not available yet.'} title="Alerts unavailable" compact />}
                </div>
              </Panel>
            </section>
          </div>

          {summary ? <div className="grid gap-4 lg:grid-cols-3">
            <Panel className="p-5">
              <SectionTitle icon={FileText} title="Document operations" subtitle="Processing and review status." />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <MiniStat label="Processed" value={formatNumber(documents.processed)} />
                <MiniStat label="Processing" value={formatNumber(documents.processing)} />
                <MiniStat label="Failed" value={formatNumber(documents.failed)} />
                <MiniStat label="No text" value={formatNumber(documents.noText)} />
                <MiniStat label="Pending review" value={formatNumber(documents.pendingReview)} />
              </div>
              <DashboardLink label="Open documents" to="/admin/documents" />
            </Panel>
            <Panel className="p-5">
              <SectionTitle icon={FlaskConical} title="Research operations" subtitle="Benchmark and fine-tuning runs." />
              <div className="mt-5 grid grid-cols-2 gap-3">
                <MiniStat label="Pending" value={formatNumber(experiments.pending)} />
                <MiniStat label="Queued" value={formatNumber(experiments.queued)} />
                <MiniStat label="Running" value={formatNumber(experiments.running)} />
                <MiniStat label="Completed" value={formatNumber(experiments.completed)} />
                <MiniStat label="Failed" value={formatNumber(experiments.failed)} />
                <MiniStat label="Cancelled" value={formatNumber(experiments.cancelled)} />
              </div>
              <DashboardLink label="Open research benchmark" to="/admin/research-dashboard" />
            </Panel>
            <Panel className="p-5">
              <SectionTitle icon={ShieldCheck} title="Workspace readiness" subtitle="Resources available to administrators." />
              <div className="mt-5 grid gap-3">
                <ReadinessLine label="Active users" value={`${formatNumber(totals.activeUsers)} / ${formatNumber(totals.users)}`} />
                <ReadinessLine label="Active courses" value={`${formatNumber(totals.activeCourses)} / ${formatNumber(totals.courses)}`} />
                <ReadinessLine label="Active workspaces" value={`${formatNumber(totals.activeWorkspaces)} / ${formatNumber(totals.workspaces)}`} />
                <ReadinessLine label="Active embedding models" value={`${formatNumber(totals.activeEmbeddingModels)} / ${formatNumber(totals.embeddingModels)}`} />
                <ReadinessLine label="Missing previews" value={formatNumber(documents.missingPreview)} />
              </div>
            </Panel>
          </div> : null}

          {summary ? <div className="grid gap-4 xl:grid-cols-3">
            <ActivityPanel
              actionLabel="Open documents"
              empty="No recent documents."
              href="/admin/documents"
              icon={FileText}
              items={activity.recentDocuments ?? []}
              renderItem={(item) => (
                <ActivityItem
                  meta={`${item.fileType || 'FILE'} · ${formatBytes(item.fileSizeBytes)} · ${formatActivityTime(item.uploadedAt)}`}
                  status={statusForBadge(item.processingStatus)}
                  title={item.documentTitle || item.originalFilename || 'Untitled document'}
                  to="/admin/documents"
                />
              )}
              title="Recent documents"
            />
            <ActivityPanel
              actionLabel="Open research"
              empty="No recent experiments."
              href="/admin/research-dashboard"
              icon={FlaskConical}
              items={activity.recentExperiments ?? []}
              renderItem={(item) => (
                <ActivityItem
                  meta={`${item.experimentType || 'Evaluation'} · ${item.llmModel || 'No model'} · ${formatActivityTime(item.updatedAt || item.createdAt)}`}
                  status={experimentStatusForBadge(item.status)}
                  title={item.experimentName || 'Untitled experiment'}
                  to="/admin/research-dashboard"
                />
              )}
              title="Recent experiments"
            />
            <ActivityPanel
              empty="No recent retrieval queries."
              icon={HardDrive}
              items={activity.recentRetrievalQueries ?? []}
              renderItem={(item) => (
                <ActivityItem
                  meta={`${item.scopeType || 'Workspace'} · ${item.latencyMs ?? 0} ms · ${formatActivityTime(item.createdAt)}`}
                  status={item.isAnswerable === false ? 'Not answerable' : 'Retrieved'}
                  title={item.queryText || 'Empty query'}
                />
              )}
              title="Recent retrievals"
            />
          </div> : null}
        </>
      )}
    </div>
  )
}

function DashboardTabs({ label, onChange, options, value }) {
  return (
    <div aria-label={label} className="flex rounded-lg bg-white/72 p-1 shadow-inner" role="group">
      {options.map((option) => (
        <button
          aria-pressed={value === option.key}
          className={`min-h-8 rounded-md px-2 text-[11px] font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 ${value === option.key ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-white hover:text-primary'}`}
          key={option.key}
          onClick={() => onChange(option.key)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="animate-pulse space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div className="h-32 rounded-[20px] bg-white/70 shadow-[0_18px_42px_rgba(15,118,110,.06)]" key={item} />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]">
        <div className="h-[25rem] rounded-[20px] bg-white/70 shadow-[0_18px_42px_rgba(15,118,110,.06)]" />
        <div className="h-[25rem] rounded-[20px] bg-white/70 shadow-[0_18px_42px_rgba(15,118,110,.06)]" />
      </div>
    </div>
  )
}

function DataUnavailable({ compact = false, description, title }) {
  return (
    <div className={`grid place-items-center rounded-xl border border-dashed border-slate-300 bg-white/52 p-4 text-center ${compact ? 'min-h-full' : 'min-h-32'}`} role="status">
      <div>
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <p className="mt-1 max-w-md text-xs font-medium leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  )
}

function DashboardLink({ label, to }) {
  return (
    <Link className="mt-5 inline-flex items-center gap-1.5 text-sm font-black text-primary transition hover:text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500" to={to}>
      {label}<ArrowRight size={15} />
    </Link>
  )
}

function DashboardTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const exactDate = payload[0]?.payload?.fullDate ?? label

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-[0_16px_36px_rgba(15,23,42,.12)] backdrop-blur-xl">
      <p className="mb-2 font-semibold text-slate-900">{exactDate}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <p className="flex items-center justify-between gap-5 font-medium text-slate-600" key={entry.dataKey}>
            <span>{entry.name}</span>
            <span className="font-black text-slate-950">{formatNumber(entry.value)}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

function HealthRow({ item }) {
  const isHealthy = item.status === 'OK'
  const action = isHealthy ? null : healthActionFor(item.key)

  return (
    <div className={`rounded-xl border p-3 shadow-[0_10px_24px_rgba(15,118,110,.05)] ${isHealthy ? 'border-emerald-300/90 bg-emerald-50/35' : 'border-red-300/90 bg-red-50/35'}`}>
      <div className="min-w-0">
        <p className="break-words text-xs font-bold leading-4 text-slate-900 sm:text-sm">{item.label}</p>
        <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-4 text-slate-500 sm:text-xs">{item.message}</p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xl font-black tracking-tight tabular-nums text-slate-950">{formatNumber(item.count)}</p>
        {action ? <Link className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-red-200 bg-white/85 px-2.5 text-[11px] font-black text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500" to={action.to}>{action.compactLabel}<ArrowRight size={12} /></Link> : null}
      </div>
    </div>
  )
}

function ReadinessLine({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/72 px-3 py-2.5 shadow-[0_10px_24px_rgba(15,118,110,.05)]">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <span className="text-sm font-black text-slate-950">{value}</span>
    </div>
  )
}

function ActivityPanel({ actionLabel, empty, href, icon, items, renderItem, title }) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <SectionTitle icon={icon} title={title} subtitle={`${items.length} latest records.`} />
        {href && actionLabel ? <Link aria-label={actionLabel} className="grid size-9 shrink-0 place-items-center rounded-lg text-primary transition hover:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500" title={actionLabel} to={href}><ArrowRight size={16} /></Link> : null}
      </div>
      <div className="mt-5 space-y-3">
        {items.length ? items.map((item) => (
          <div key={item.documentId ?? item.experimentId ?? item.retrievalQueryId}>
            {renderItem(item)}
          </div>
        )) : <EmptyInline title={empty} description="New records will appear here after backend activity." />}
      </div>
    </Panel>
  )
}

function ActivityItem({ meta, status, title, to }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900">{title}</p>
          <p className="mt-1 truncate text-xs font-medium text-slate-500">{meta}</p>
        </div>
        <StatusBadge status={status} />
      </div>
    </>
  )

  const className = 'block rounded-xl border border-slate-200 bg-white/72 p-3 shadow-[0_10px_24px_rgba(15,118,110,.05)] transition hover:border-teal-200 hover:bg-teal-50/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500'
  return to ? <Link className={className} to={to}>{content}</Link> : <div className={className}>{content}</div>
}

function EmptyInline({ description, title }) {
  return (
    <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-slate-200 bg-white/52 p-4 text-center">
      <div>
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  )
}

function formatNumber(value) {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? new Intl.NumberFormat('en-US').format(number) : '0'
}

function formatBytes(value) {
  const bytes = Number(value ?? 0)
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function formatShortDate(value) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatFullDate(value) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatActivityTime(value) {
  if (!value) return 'Unknown time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const elapsed = Date.now() - date.getTime()
  if (elapsed >= 0 && elapsed < 60 * 60 * 1000) return `${Math.max(1, Math.round(elapsed / 60000))}m ago`
  if (elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000) return `${Math.round(elapsed / 3600000)}h ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function experimentStatusForBadge(value) {
  if (value === 'COMPLETED') return 'Completed'
  if (value === 'RUNNING') return 'Processing'
  if (value === 'QUEUED') return 'Queued'
  if (value === 'PENDING') return 'Pending'
  if (value === 'CANCELLED') return 'Cancelled'
  if (value === 'FAILED') return 'Failed'
  return 'Unavailable'
}

function healthActionFor(key) {
  if (['failedDocuments', 'pendingReviews', 'missingPreview'].includes(key)) return { compactLabel: 'Review', to: '/admin/documents' }
  if (key === 'failedExperiments') return { compactLabel: 'Review', to: '/admin/research-dashboard' }
  if (key === 'activeEmbeddingModels') return { compactLabel: 'Review', to: '/admin/research-dashboard' }
  return null
}

export function AdminUsersPage() {
  const currentUser = getSavedUser()
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [role, setRole] = useState(allOption)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [roleChangeTarget, setRoleChangeTarget] = useState(null)
  const [normalizationRequested, setNormalizationRequested] = useState(false)
  const [roleUpdatingId, setRoleUpdatingId] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [normalizing, setNormalizing] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true
    getUsers()
      .then((result) => active && setUsers(unwrapList(result)))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [reloadKey])

  const filtered = useMemo(() => users.filter((user) => {
    const text = `${user.fullName ?? user.name ?? ''} ${user.email ?? ''}`.toLowerCase()
    return (
      (!query.trim() || text.includes(query.trim().toLowerCase())) &&
      (role === allOption || getUserRole(user) === role)
    )
  }), [query, role, users])
  const legacyUsers = useMemo(() => users.filter(hasLegacyRole), [users])
  const adminCount = useMemo(() => users.filter((user) => getUserRole(user) === ADMIN_ROLE).length, [users])
  const filtersActive = Boolean(query.trim() || role !== allOption)
  const initialLoading = loading && users.length === 0

  function reloadUsers() {
    setLoading(true)
    setError('')
    setSuccessMessage('')
    setReloadKey((value) => value + 1)
  }

  async function changeRole(userId, nextRole) {
    if (!userId || !roles.includes(nextRole)) return false
    setError('')
    setSuccessMessage('')
    setRoleUpdatingId(userId)
    try {
      const updated = await updateUserRole(userId, nextRole)
      const nextUser = updated?.data ?? updated
      setUsers((current) => current.map((user) => {
        const currentId = getUserId(user)
        if (currentId !== userId) return user
        if (getUserId(nextUser)) {
          const normalizedRole = getUserRole(nextUser)
          return {
            ...user,
            ...nextUser,
            role: normalizedRole.toLowerCase(),
            roles: [normalizedRole],
          }
        }
        return { ...user, role: nextRole.toLowerCase(), roles: [nextRole] }
      }))
      setSuccessMessage(`${getUserName(users.find((user) => getUserId(user) === userId))} is now ${formatRole(nextRole)}.`)
      return true
    } catch (requestError) {
      setError(requestError.message)
      return false
    } finally {
      setRoleUpdatingId('')
    }
  }

  function requestRoleChange(user, nextRole) {
    const userId = getUserId(user)
    const currentRole = getUserRole(user)
    const isCurrentUser = userId === currentUser?.id
    const isOnlyAdmin = currentRole === ADMIN_ROLE && adminCount <= 1

    if (nextRole === currentRole) return
    if (isCurrentUser && nextRole !== ADMIN_ROLE) {
      setError('You cannot remove administrator access from your own account.')
      return
    }
    if (isOnlyAdmin && nextRole !== ADMIN_ROLE) {
      setError('At least one administrator must remain in the workspace.')
      return
    }
    if (nextRole === ADMIN_ROLE) {
      setRoleChangeTarget({ user, nextRole })
      return
    }
    changeRole(userId, nextRole)
  }

  async function confirmRoleChange() {
    if (!roleChangeTarget) return
    const didUpdate = await changeRole(getUserId(roleChangeTarget.user), roleChangeTarget.nextRole)
    if (didUpdate) setRoleChangeTarget(null)
  }

  async function normalizeLegacyRoles() {
    const targets = legacyUsers.map((user) => ({ id: getUserId(user), role: getUserRole(user) })).filter((target) => target.id)
    if (!targets.length) {
      setNormalizationRequested(false)
      return
    }

    setNormalizing(true)
    setError('')
    setSuccessMessage('')
    const results = await Promise.allSettled(targets.map((target) => updateUserRole(target.id, target.role)))
    const succeededIds = new Set(targets.filter((_, index) => results[index].status === 'fulfilled').map((target) => target.id))
    const failedCount = targets.length - succeededIds.size

    setUsers((current) => current.map((user) => {
      const userId = getUserId(user)
      if (!succeededIds.has(userId)) return user
      const nextRole = getUserRole(user)
      return { ...user, role: nextRole.toLowerCase(), roles: [nextRole] }
    }))
    if (succeededIds.size) setSuccessMessage(`Normalized ${succeededIds.size} legacy ${succeededIds.size === 1 ? 'role' : 'roles'} to Admin or Student.`)
    if (failedCount) setError(`${failedCount} ${failedCount === 1 ? 'account could' : 'accounts could'} not be normalized. Please try again.`)
    setNormalizing(false)
    setNormalizationRequested(false)
  }

  function requestDelete(user) {
    const userId = getUserId(user)
    const isCurrentUser = userId === currentUser?.id
    const isOnlyAdmin = getUserRole(user) === ADMIN_ROLE && adminCount <= 1
    if (isCurrentUser) {
      setError('You cannot delete the account currently signed in.')
      return
    }
    if (isOnlyAdmin) {
      setError('At least one administrator must remain in the workspace.')
      return
    }
    setDeleteTarget(user)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const userId = getUserId(deleteTarget)
    if (!userId) {
      setError('This account has no user ID, so it cannot be deleted.')
      return
    }
    setDeletingId(userId)
    setError('')
    setSuccessMessage('')
    try {
      await deleteUser(userId)
      setUsers((current) => current.filter((user) => getUserId(user) !== userId))
      setDeleteTarget(null)
      setSuccessMessage(`${getUserName(deleteTarget)} was deleted.`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDeletingId('')
    }
  }

  return (
    <CrudPage description="Manage student and administrator accounts from the live backend." icon={Users} title="User Management">
      {error ? <Alert message={error} /> : null}
      {successMessage ? <SuccessNotice message={successMessage} /> : null}
      <Toolbar>
        <Field icon={Search} label="Search user" onChange={(event) => setQuery(event.target.value)} placeholder="Name or email..." value={query} />
        <RoleMenu allowAll currentRole={role} onChange={setRole} stretch />
        <div className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border bg-white/90 px-3 text-sm shadow-[0_10px_24px_rgba(15,118,110,.06)] backdrop-blur-xl">
          <p className="font-semibold text-slate-600"><span className="font-black text-slate-950">{filtered.length}</span> of {users.length} accounts</p>
          <button className="text-xs font-black text-primary transition hover:text-teal-800 disabled:cursor-not-allowed disabled:text-slate-400" disabled={!filtersActive} onClick={() => { setQuery(''); setRole(allOption) }} type="button">Clear</button>
        </div>
        <div className="flex min-h-11 items-center justify-end gap-2">
          {legacyUsers.length ? <Button disabled={loading || normalizing} onClick={() => setNormalizationRequested(true)} size="sm" type="button" variant="accent">Normalize {legacyUsers.length}</Button> : null}
          <Button disabled={loading} onClick={reloadUsers} size="sm" type="button" variant="secondary"><RefreshCcw className={loading ? 'animate-spin' : ''} size={14} />Refresh</Button>
        </div>
      </Toolbar>
      {initialLoading ? <Loading label="Loading users" /> : filtered.length ? <>
        <div className="hidden md:block">
          <DataTable
            columns={['User', 'Role', 'Account status', 'Actions']}
            rows={filtered.map((user) => {
              const userId = getUserId(user)
              const currentRole = getUserRole(user)
              const isCurrentUser = userId === currentUser?.id
              const isOnlyAdmin = currentRole === ADMIN_ROLE && adminCount <= 1
              const actionDisabled = !userId || isCurrentUser || isOnlyAdmin || Boolean(deletingId) || normalizing
              const actionLabel = isCurrentUser ? 'Current account cannot be deleted' : isOnlyAdmin ? 'At least one administrator must remain' : !userId ? 'User ID unavailable' : 'Delete user'
              return [
                <Identity key="user" subtitle={user.email} title={getUserName(user)} />,
                <UserRoleSelect currentRole={currentRole} disabled={!userId || roleUpdatingId === userId || normalizing} key="role" onChange={(nextRole) => requestRoleChange(user, nextRole)} userName={getUserName(user)} />,
                <StatusBadge key="status" status={accountStatus(user)} />,
                <RowActions key="actions">
                  <IconButton disabled={actionDisabled} label={actionLabel} onClick={() => requestDelete(user)}><Trash2 size={15} /></IconButton>
                </RowActions>,
              ]
            })}
          />
        </div>
        <UserRoster
          adminCount={adminCount}
          currentUserId={currentUser?.id}
          deletingId={deletingId}
          normalizing={normalizing}
          onDelete={requestDelete}
          onRoleChange={requestRoleChange}
          roleUpdatingId={roleUpdatingId}
          users={filtered}
        />
      </> : <EmptyState action={filtersActive ? <Button onClick={() => { setQuery(''); setRole(allOption) }} type="button" variant="secondary">Clear filters</Button> : null} title={filtersActive ? 'No matching users' : 'No users'} description={filtersActive ? 'Try a different name, email, or role filter.' : 'The backend returned no user accounts for this workspace.'} />}
      {deleteTarget ? (
        <ConfirmModal actionLabel="Delete user" busy={deletingId === getUserId(deleteTarget)} busyLabel="Deleting user" onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} title="Delete user?">
          The account "{getUserName(deleteTarget)}" will be removed from the backend.
        </ConfirmModal>
      ) : null}
      {roleChangeTarget ? (
        <ConfirmModal actionLabel="Make administrator" busy={roleUpdatingId === getUserId(roleChangeTarget.user)} busyLabel="Updating role" onCancel={() => setRoleChangeTarget(null)} onConfirm={confirmRoleChange} title="Grant administrator access?">
          {getUserName(roleChangeTarget.user)} will be able to manage users, course materials, and research operations.
        </ConfirmModal>
      ) : null}
      {normalizationRequested ? (
        <ConfirmModal actionLabel="Normalize roles" busy={normalizing} busyLabel="Normalizing roles" onCancel={() => setNormalizationRequested(false)} onConfirm={normalizeLegacyRoles} title="Normalize legacy roles?">
          This will update {legacyUsers.length} {legacyUsers.length === 1 ? 'account' : 'accounts'} through the existing role API. Only Admin and Student roles will remain.
        </ConfirmModal>
      ) : null}
    </CrudPage>
  )
}

function UserRoster({ adminCount, currentUserId, deletingId, normalizing, onDelete, onRoleChange, roleUpdatingId, users }) {
  return (
    <div className="grid gap-3 md:hidden">
      {users.map((user) => {
        const userId = getUserId(user)
        const currentRole = getUserRole(user)
        const isCurrentUser = userId === currentUserId
        const isOnlyAdmin = currentRole === ADMIN_ROLE && adminCount <= 1
        const deleteDisabled = !userId || isCurrentUser || isOnlyAdmin || Boolean(deletingId) || normalizing
        const deleteLabel = isCurrentUser ? 'Current account cannot be deleted' : isOnlyAdmin ? 'At least one administrator must remain' : !userId ? 'User ID unavailable' : 'Delete user'

        return (
          <Panel className="p-4" key={userId || `${user.email}-${getUserName(user)}`}>
            <div className="flex items-start justify-between gap-3">
              <Identity subtitle={user.email} title={getUserName(user)} />
              <StatusBadge status={accountStatus(user)} />
            </div>
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-t border-slate-100 pt-3">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Role</p>
                <UserRoleSelect currentRole={currentRole} disabled={!userId || roleUpdatingId === userId || normalizing} onChange={(nextRole) => onRoleChange(user, nextRole)} userName={getUserName(user)} />
              </div>
              <IconButton disabled={deleteDisabled} label={deleteLabel} onClick={() => onDelete(user)}><Trash2 size={15} /></IconButton>
            </div>
          </Panel>
        )
      })}
    </div>
  )
}

function UserRoleSelect({ currentRole, disabled, onChange, userName }) {
  return <RoleMenu currentRole={currentRole} disabled={disabled} label={`Role for ${userName}`} onChange={onChange} />
}

function RoleMenu({ allowAll = false, className = '', currentRole, disabled = false, label, onChange, stretch = false }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const menuItemRefs = useRef([])
  const [menuPosition, setMenuPosition] = useState(null)
  const options = useMemo(() => (allowAll ? [allOption, ...roles] : roles), [allowAll])
  const selectedRole = options.includes(currentRole) ? currentRole : (allowAll ? allOption : STUDENT_ROLE)
  const selectedLabel = selectedRole === allOption ? 'All' : formatRole(selectedRole)

  const getMenuPosition = useCallback((rect) => {
    const width = Math.max(rect.width, 124)
    const estimatedHeight = options.length * 36 + 8
    const spaceBelow = window.innerHeight - rect.bottom
    const openAbove = spaceBelow < estimatedHeight && rect.top > estimatedHeight
    return {
      left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8)),
      top: openAbove ? rect.top - estimatedHeight - 6 : rect.bottom + 6,
      width,
    }
  }, [options.length])

  useEffect(() => {
    if (!open) return undefined

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setOpen(false)
    }

    function handleEscape(event) {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }

    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (!rect) return
      setMenuPosition(getMenuPosition(rect))
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [getMenuPosition, open])

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) setMenuPosition(getMenuPosition(rect))
    setOpen(true)
  }

  function selectRole(nextRole) {
    setOpen(false)
    if (nextRole !== selectedRole) onChange(nextRole)
  }

  function handleButtonKeyDown(event) {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openMenu()
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu()
    }
  }

  function handleMenuItemKeyDown(event, index, option) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectRole(option)
      buttonRef.current?.focus()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      menuItemRefs.current[(index + 1) % options.length]?.focus()
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      menuItemRefs.current[(index - 1 + options.length) % options.length]?.focus()
    }
    if (event.key === 'Home') {
      event.preventDefault()
      menuItemRefs.current[0]?.focus()
    }
    if (event.key === 'End') {
      event.preventDefault()
      menuItemRefs.current[options.length - 1]?.focus()
    }
  }

  useEffect(() => {
    if (open) menuItemRefs.current[options.indexOf(selectedRole)]?.focus()
  }, [open, options, selectedRole])

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label ?? 'Role filter'}
        className={`flex min-h-9 ${stretch ? 'w-full' : 'w-fit'} min-w-[108px] items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left text-xs font-black text-slate-700 shadow-sm transition duration-200 hover:border-teal-300 hover:bg-teal-50/40 active:translate-y-px focus-visible:border-teal-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-60`}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleButtonKeyDown}
        ref={buttonRef}
        type="button"
      >
        <span>{selectedLabel}</span>
        <ChevronDown className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-primary' : ''}`} size={15} />
      </button>
      {open && menuPosition ? createPortal(
        <div
          aria-label={label ?? 'Role options'}
          className="fixed z-[80] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-[0_18px_40px_rgba(15,23,42,.14)]"
          ref={menuRef}
          role="menu"
          style={{ left: menuPosition.left, minWidth: menuPosition.width, top: menuPosition.top }}
        >
          {options.map((option, index) => {
            const active = option === selectedRole
            return (
              <div
                aria-checked={active}
                className={`flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-xs font-black transition-colors focus-visible:bg-teal-50 focus-visible:outline-none ${active ? 'bg-teal-50 text-primary' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}
                key={option}
                onClick={() => selectRole(option)}
                onKeyDown={(event) => handleMenuItemKeyDown(event, index, option)}
                ref={(element) => { menuItemRefs.current[index] = element }}
                role="menuitemradio"
                tabIndex={0}
              >
                {option === allOption ? 'All' : formatRole(option)}
                {active ? <Check aria-hidden size={14} /> : null}
              </div>
            )
          })}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}

function SuccessNotice({ message }) {
  return <div className="mb-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700"><Check className="mt-0.5 shrink-0" size={17} /><p>{message}</p></div>
}

function getUserId(user) {
  return user?.userId ?? user?.id ?? ''
}

function getUserName(user) {
  return user?.fullName ?? user?.name ?? 'FStu User'
}

function getUserRole(user) {
  return normalizeRoles(user?.roles ?? (user?.role ? [user.role] : []))[0]
}

function hasLegacyRole(user) {
  const rawRoles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : [])
  const normalizedRawRoles = rawRoles.map((role) => String(role).toUpperCase())
  return normalizedRawRoles.length !== 1 || normalizedRawRoles[0] !== getUserRole(user)
}

function accountStatus(user) {
  return user?.isActive === false ? 'Inactive' : 'Active'
}

function formatRole(role) {
  return role === ADMIN_ROLE ? 'Admin' : 'Student'
}

export function AdminDocumentsPage() {
  const [docs, setDocs] = useState([])
  const [courses, setCourses] = useState([])
  const [chapters, setChapters] = useState([])
  const [semesters, setSemesters] = useState([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(allOption)
  const [semesterId, setSemesterId] = useState(allOption)
  const [courseId, setCourseId] = useState(allOption)
  const [loading, setLoading] = useState(true)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletingId, setDeletingId] = useState('')
  const [reindexingId, setReindexingId] = useState('')
  const [activeEmbeddingModel, setActiveEmbeddingModel] = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadFilesToSend, setUploadFilesToSend] = useState([])
  const [uploadCourseId, setUploadCourseId] = useState('')
  const [uploadChapterId, setUploadChapterId] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    let active = true
    async function loadDocs() {
      setLoading(true)
      setError('')
      try {
        const [items, courseItems, semesterItems, model] = await Promise.all([
          getDocuments(), getCourses(), getSemesterWorkspaces(), getActiveEmbeddingModel().catch(() => null),
        ])
        const chapterGroups = await Promise.all(courseItems.map((course) => getChapters(course.id).catch(() => [])))
        if (!active) return
        setDocs(items)
        setCourses(courseItems)
        setChapters(chapterGroups.flat())
        setSemesters(semesterItems)
        setActiveEmbeddingModel(model)
        setLastUpdatedAt(new Date().toISOString())
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
  }, [reloadKey])

  useEffect(() => {
    function handleDocumentUploaded() {
      setReloadKey((current) => current + 1)
    }

    window.addEventListener('fstu:document-uploaded', handleDocumentUploaded)
    return () => window.removeEventListener('fstu:document-uploaded', handleDocumentUploaded)
  }, [])

  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses])
  const chapterById = useMemo(() => new Map(chapters.map((chapter) => [chapter.id, chapter])), [chapters])
  const semesterById = useMemo(() => new Map(semesters.map((semester) => [semester.id, semester])), [semesters])
  const visibleCourses = semesterId === allOption
    ? courses
    : courses.filter((course) => course.semesterWorkspaceId === semesterId)
  const uploadChapters = useMemo(
    () => chapters.filter((chapter) => chapter.courseId === uploadCourseId),
    [chapters, uploadCourseId],
  )

  const filtered = useMemo(() => docs.filter((doc) => {
    const q = query.toLowerCase().trim()
    const course = courseById.get(doc.courseId)
    const chapter = chapterById.get(doc.chapterId)
    return (
      (!q || [doc.displayName, doc.name, course?.name, course?.code, chapter?.title, doc.uploaderName].some((value) => value?.toLowerCase().includes(q))) &&
      (status === allOption || doc.status === status) &&
      (semesterId === allOption || course?.semesterWorkspaceId === semesterId) &&
      (courseId === allOption || doc.courseId === courseId)
    )
  }), [chapterById, courseById, courseId, docs, query, semesterId, status])
  const documentStats = useMemo(() => getDocumentStats(docs), [docs])
  const filtersActive = Boolean(query || status !== allOption || semesterId !== allOption || courseId !== allOption)

  async function reindexDoc(doc) {
    setReindexingId(doc.id)
    setError('')
    try {
      const model = await getActiveEmbeddingModel()
      if (!model) throw new Error('No active embedding model found.')
      setActiveEmbeddingModel(model)
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
      await deleteFile(deleteTarget)
      setDocs((current) => current.filter((doc) => doc.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDeletingId('')
    }
  }

  function clearFilters() {
    setQuery('')
    setStatus(allOption)
    setSemesterId(allOption)
    setCourseId(allOption)
  }

  function openUploadDialog() {
    setUploadFilesToSend([])
    setUploadCourseId(courseId === allOption ? '' : courseId)
    setUploadChapterId('')
    setUploadOpen(true)
  }

  function updateUploadCourse(nextCourseId) {
    setUploadCourseId(nextCourseId)
    setUploadChapterId('')
  }

  function selectUploadFiles(files) {
    const selectedFiles = Array.from(files ?? [])
    const unsupportedFiles = selectedFiles.filter((file) => !isSupportedDocumentFile(file))
    if (unsupportedFiles.length) {
      setError('Only PDF, DOCX, PPTX, and TXT materials can be uploaded.')
    }
    setUploadFilesToSend(selectedFiles.filter(isSupportedDocumentFile))
  }

  async function uploadMaterials() {
    if (!uploadFilesToSend.length) {
      setError('Choose at least one material to upload.')
      return
    }
    if (!uploadCourseId) {
      setError('Select a destination course before uploading.')
      return
    }

    setUploading(true)
    setError('')
    try {
      const tasks = uploadFiles(uploadFilesToSend, {
        courseId: uploadCourseId,
        chapterId: uploadChapterId || undefined,
      })
      const results = await Promise.allSettled(tasks.map((task) => task.promise))
      const failedTask = results.find((result) => result.status === 'rejected')
      if (failedTask?.status === 'rejected') throw failedTask.reason
      setUploadOpen(false)
      setUploadFilesToSend([])
      setReloadKey((current) => current + 1)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <CrudPage
      actions={<div className="flex flex-wrap items-center justify-end gap-2"><span className="max-w-56 truncate text-xs font-semibold text-slate-500" title={activeEmbeddingModel?.name ?? ''}>{activeEmbeddingModel ? `Active model: ${activeEmbeddingModel.name}` : 'No active embedding model'}</span><Button onClick={() => setReloadKey((current) => current + 1)} size="sm" type="button" variant="secondary"><RefreshCcw className={loading ? 'animate-spin' : ''} size={15} />Refresh</Button><Button onClick={openUploadDialog} size="sm" type="button"><Upload size={15} />Upload material</Button></div>}
      description="Review, organize, and prepare course materials before students use them in chat."
      icon={FileText}
      title="Document Management"
    >
      {error ? <Alert action={<Button onClick={() => setError('')} size="sm" type="button" variant="secondary">Dismiss</Button>} message={error} /> : null}
      <DocumentOverview lastUpdatedAt={lastUpdatedAt} stats={documentStats} />
      <Panel className="mb-4 p-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field icon={Search} label="Search document" onChange={(event) => setQuery(event.target.value)} placeholder="Search name, course, chapter, or uploader..." value={query} />
        <SelectField label="Status" onChange={(event) => setStatus(event.target.value)} value={status}>
          {[allOption, 'Uploaded', 'Processing', 'Processed', 'Indexed', 'No text', 'Failed'].map((item) => <option key={item}>{item}</option>)}
        </SelectField>
        <SelectField label="Semester" onChange={(event) => { setSemesterId(event.target.value); setCourseId(allOption) }} value={semesterId}>
          <option value={allOption}>All semesters</option>
          {semesters.map((semester) => <option key={semester.id} value={semester.id}>{semester.name}</option>)}
        </SelectField>
        <SelectField label="Course" onChange={(event) => setCourseId(event.target.value)} value={courseId}>
          <option value={allOption}>All courses</option>
          {visibleCourses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}
        </SelectField>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-1 pt-3">
          <p className="text-xs font-semibold text-slate-500">{loading ? 'Refreshing materials…' : `${formatNumber(filtered.length)} of ${formatNumber(docs.length)} materials shown`}</p>
          {filtersActive ? <Button onClick={clearFilters} size="sm" type="button" variant="ghost">Clear filters</Button> : null}
        </div>
      </Panel>
      {loading ? <Loading label="Loading documents" /> : filtered.length ? (
        <DataTable
          columns={['Document', 'Learning context', 'Content processing', 'Content', 'Uploaded', 'Actions']}
          rows={filtered.map((doc) => {
            const course = courseById.get(doc.courseId)
            const semester = semesterById.get(course?.semesterWorkspaceId)
            const chapter = chapterById.get(doc.chapterId)
            return [
            <DocumentIdentity document={doc} key="doc" />,
            <LearningContext chapter={chapter} course={course} key="scope" semester={semester} />,
            <DocumentProcessing key="processing" status={doc.status} />,
            <DocumentContentMeta document={doc} key="content" />,
            <UploadMeta document={doc} key="uploaded" />,
            <RowActions key="actions">
              <PreviewButton document={doc} />
              <IconButton disabled={reindexingId === doc.id || doc.status === 'Processing' || doc.status === 'No text'} label={doc.status === 'No text' ? 'Document has no extractable text' : 'Prepare embeddings'} onClick={() => reindexDoc(doc)}><RefreshCcw className={reindexingId === doc.id ? 'animate-spin' : ''} size={15} /></IconButton>
              {doc.canDelete ? <IconButton disabled={deletingId === doc.id} label="Delete" onClick={() => setDeleteTarget(doc)}><Trash2 size={15} /></IconButton> : null}
            </RowActions>,
          ]})}
        />
      ) : <EmptyState action={filtersActive ? <Button onClick={clearFilters} type="button" variant="secondary">Clear filters</Button> : <Button onClick={openUploadDialog} type="button"><Plus size={16} />Upload first material</Button>} title={filtersActive ? 'No matching materials' : 'No course materials yet'} description={filtersActive ? 'Try a different name, status, semester, or course.' : 'Upload a PDF, DOCX, PPTX, or TXT file and assign it to a course to prepare it for chat.'} />}
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
          "{deleteTarget.displayName}" and its processed chunks will be removed from the course knowledge base.
        </ConfirmModal>
      ) : null}
      {uploadOpen ? <DocumentUploadDialog
        busy={uploading}
        chapterId={uploadChapterId}
        chapters={uploadChapters}
        courseId={uploadCourseId}
        courses={courses}
        files={uploadFilesToSend}
        onChapterChange={setUploadChapterId}
        onClose={() => { if (!uploading) setUploadOpen(false) }}
        onCourseChange={updateUploadCourse}
        onFilesChange={selectUploadFiles}
        onSubmit={uploadMaterials}
      /> : null}
    </CrudPage>
  )
}

function DocumentOverview({ lastUpdatedAt, stats }) {
  const items = [
    { label: 'All materials', value: stats.total, detail: 'Stored course documents' },
    { label: 'Ready for chat', value: stats.ready, detail: 'Embeddings prepared' },
    { label: 'In progress', value: stats.processing, detail: 'Extraction or indexing' },
    { label: 'Needs attention', value: stats.attention, detail: 'Failed or no extractable text' },
  ]

  return (
    <Panel className="mb-4 overflow-hidden p-0">
      <div className="grid divide-x divide-slate-100 md:grid-cols-4">
        {items.map((item) => <div className="p-4" key={item.label}>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{item.label}</p>
          <p className="mt-1 text-2xl font-black tracking-tight tabular-nums text-slate-950">{formatNumber(item.value)}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{item.detail}</p>
        </div>)}
      </div>
      <div className="border-t border-slate-100 bg-white/45 px-4 py-2 text-right text-xs font-semibold text-slate-500">
        {lastUpdatedAt ? `Last refreshed ${formatActivityTime(lastUpdatedAt)}` : 'Waiting for document data'}
      </div>
    </Panel>
  )
}

function DocumentIdentity({ document }) {
  return (
    <div className="min-w-[13rem] max-w-xs">
      <div className="flex items-start gap-2.5">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal-50 text-primary"><FileText size={15} /></div>
        <p className="line-clamp-2 pt-0.5 text-sm font-black leading-5 text-slate-950" title={document.displayName}>{document.displayName || document.name || 'Untitled document'}</p>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-500">{document.type || 'FILE'} · {formatBytes(document.fileSizeBytes)}</p>
    </div>
  )
}

function LearningContext({ chapter, course, semester }) {
  return (
    <div className="min-w-[12rem]">
      <p className="font-semibold text-slate-950">{course ? `${course.code} · ${course.name}` : 'Course not assigned'}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{semester?.name || 'Semester not assigned'}</p>
      <p className="mt-1 text-xs font-medium text-teal-700">{chapter ? `Chapter ${chapter.orderIndex}: ${chapter.title}` : 'No chapter assigned'}</p>
    </div>
  )
}

function DocumentProcessing({ status }) {
  return (
    <div className="min-w-[9rem]">
      <StatusBadge status={status} />
    </div>
  )
}

function DocumentContentMeta({ document }) {
  return (
    <div className="min-w-[8rem] text-xs font-semibold text-slate-600">
      <p className="tabular-nums text-slate-950">{formatDocumentCount(document.chunks, 'chunks')}</p>
      <p className="mt-1 tabular-nums">{formatDocumentCount(document.pages, 'pages')}</p>
    </div>
  )
}

function UploadMeta({ document }) {
  const uploadedAt = document.uploadedAt && document.uploadedAt !== '-' ? document.uploadedAt : '—'

  return (
    <div className="min-w-[8rem] text-xs font-semibold text-slate-600">
      <p>{uploadedAt}</p>
      {document.uploaderName ? <p className="mt-1 truncate text-slate-500" title={document.uploaderName}>{document.uploaderName}</p> : null}
    </div>
  )
}

function PreviewButton({ document }) {
  const url = getDocumentPreviewUrl(document)
  return <IconButton disabled={!url} label={url ? 'Preview material' : 'Preview unavailable'} onClick={() => { if (url) window.open(url, '_blank', 'noopener,noreferrer') }}><Eye size={15} /></IconButton>
}

function DocumentUploadDialog({ busy, chapterId, chapters, courseId, courses, files, onChapterChange, onClose, onCourseChange, onFilesChange, onSubmit }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose() }}>
      <form aria-labelledby="document-upload-title" className="os-panel w-full max-w-lg p-5" onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-teal-700">Course knowledge</p><h2 className="mt-1 text-xl font-black tracking-tight text-slate-950" id="document-upload-title">Upload materials</h2><p className="mt-2 text-sm font-medium leading-6 text-slate-600">Files are processed and indexed with the active embedding workflow.</p></div>
          <button aria-label="Close upload dialog" className="rounded-lg px-2 py-1 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60" disabled={busy} onClick={onClose} type="button">Close</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <SelectField label="Destination course" onChange={(event) => onCourseChange(event.target.value)} value={courseId}>
            <option value="">Select course</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}
          </SelectField>
          <SelectField disabled={!courseId || !chapters.length} label="Chapter" onChange={(event) => onChapterChange(event.target.value)} value={chapterId}>
            <option value="">No chapter assigned</option>
            {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>Chapter {chapter.orderIndex}: {chapter.title}</option>)}
          </SelectField>
        </div>
        <label className="mt-4 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-teal-200 bg-teal-50/45 p-4 text-center transition hover:border-teal-400 hover:bg-teal-50 disabled:cursor-not-allowed">
          <Upload className="text-primary" size={21} />
          <span className="mt-2 text-sm font-black text-slate-900">Choose PDF, DOCX, PPTX, or TXT files</span>
          <span className="mt-1 text-xs font-medium text-slate-500">You can select multiple course materials at once.</span>
          <input accept=".pdf,.docx,.pptx,.txt" className="sr-only" disabled={busy} multiple onChange={(event) => onFilesChange(event.target.files)} type="file" />
        </label>
        {files.length ? <ul className="mt-3 max-h-28 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white/70 px-3">
          {files.map((file) => <li className="flex items-center justify-between gap-3 py-2 text-xs font-semibold text-slate-700" key={`${file.name}-${file.lastModified}`}><span className="min-w-0 truncate">{file.name}</span><span className="shrink-0 text-slate-500">{formatBytes(file.size)}</span></li>)}
        </ul> : null}
        <div className="mt-5 flex justify-end gap-2"><Button disabled={busy} onClick={onClose} type="button" variant="secondary">Cancel</Button><Button disabled={busy || !files.length || !courseId} type="submit">{busy ? 'Uploading…' : `Upload ${files.length || ''}`.trim()}</Button></div>
      </form>
    </div>
  )
}

function getDocumentStats(documents) {
  return documents.reduce((stats, document) => {
    const readiness = getDocumentReadiness(document)
    stats.total += 1
    if (readiness === 'Prepared') stats.ready += 1
    if (document.status === 'Processing' || readiness === 'Processing') stats.processing += 1
    if (document.status === 'Failed' || document.status === 'No text') stats.attention += 1
    return stats
  }, { total: 0, ready: 0, processing: 0, attention: 0 })
}

function getDocumentReadiness(document) {
  if (document.status === 'Failed' || document.status === 'No text') return document.status
  if (document.status === 'Processing') return 'Processing'
  if (document.status === 'Indexed' || document.embeddingStatus === 'Prepared') return 'Prepared'
  if (Number.isFinite(document.embeddedChunks) && Number.isFinite(document.chunks) && document.chunks > 0 && document.embeddedChunks >= document.chunks) return 'Prepared'
  return 'Not prepared'
}

function formatDocumentCount(value, label) {
  return Number.isFinite(value) ? `${formatNumber(value)} ${label}` : `${label[0].toUpperCase()}${label.slice(1)} unavailable`
}

function isSupportedDocumentFile(file) {
  const name = file?.name?.toLowerCase() ?? ''
  return ['.pdf', '.docx', '.pptx', '.txt'].some((extension) => name.endsWith(extension))
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
                <ScoreStat label="Token overlap (proxy)" value={currentMetrics.answerCorrectness} />
                <ScoreStat label="Legacy similarity (proxy)" value={currentMetrics.semanticSimilarity} />
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
    ['Token overlap (proxy)', result.answerCorrectness],
    ['Legacy similarity (proxy)', result.semanticSimilarity],
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

function MetricCard({ detail, icon: Icon, label, linkTo, value }) {
  return (
    <Panel className="overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-teal-100/45 to-transparent" />
      <div className="relative flex items-center justify-between gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-teal-100 bg-teal-50 text-primary shadow-sm">
          <Icon size={19} />
        </div>
        <p className="truncate text-3xl font-black tracking-tight tabular-nums text-slate-950">{value}</p>
      </div>
      <p className="relative mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      {detail ? <p className="relative mt-1 text-xs font-semibold text-slate-600">{detail}</p> : null}
      {linkTo ? <Link className="relative mt-3 inline-flex items-center gap-1 text-xs font-black text-primary transition hover:text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500" to={linkTo}>View details <ArrowRight size={13} /></Link> : null}
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
  const reduceMotion = useReducedMotion()

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
              <motion.tr
                className="bg-white/58 transition-colors duration-200 hover:bg-teal-50/65"
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                key={index}
                transition={reduceMotion ? { duration: 0 } : { delay: Math.min(index * 0.045, 0.32), duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                viewport={{ amount: 0.12, once: true }}
                whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              >
                {row.map((cell, cellIndex) => <td className="px-4 py-4 align-top leading-6 text-slate-700" key={cellIndex}>{cell}</td>)}
              </motion.tr>
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

function Alert({ action, message }) {
  return <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"><div className="flex min-w-0 items-start gap-3"><AlertTriangle className="mt-0.5 shrink-0" size={17} /><p>{message}</p></div>{action}</div>
}
