import {
  AlertTriangle, BarChart3, CheckCircle2, ChevronDown, Download,
  FileDown, FlaskConical, Info, Search,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react'
import { EmptyState, Panel } from '../../components/ui.jsx'
import { AdminPageHeader } from '../../layouts/AdminLayout.jsx'
import * as evaluationService from '../../services/evaluationService.js'

const ResearchDashboardCharts = lazy(() => import('./ResearchDashboardCharts.jsx')
  .then((module) => ({ default: module.ResearchDashboardCharts })))

const METRICS = [
  { key: 'answerCorrectness', label: 'Answer correctness', plain: 'How closely the answer matches the ground truth.', direction: 'Higher is better', formula: 'Token-overlap F1 between the generated answer and ground truth.' },
  { key: 'answerRelevance', label: 'Answer relevance', plain: 'Whether the answer stays on the expected topic.', direction: 'Higher is better', formula: 'This local proxy currently uses the same token-overlap F1 as answer correctness.' },
  { key: 'semanticSimilarity', label: 'Content similarity', plain: 'How closely the wording and key ideas match the ground truth.', direction: 'Higher is better', formula: 'Local token-similarity proxy; not an independent semantic evaluator.' },
  { key: 'faithfulness', label: 'Source faithfulness', plain: 'Whether a RAG answer is supported by its retrieved document context.', direction: 'Higher is better', formula: 'Share of answer-content tokens that appear in the retrieved context.', ragOnly: true },
  { key: 'contextPrecision', label: 'Context precision', plain: 'How much retrieved RAG context is genuinely useful.', direction: 'Higher is better', formula: 'Token overlap between retrieved context and ground truth.', ragOnly: true },
  { key: 'contextRecall', label: 'Context recall', plain: 'Whether RAG retrieved the information needed to answer.', direction: 'Higher is better', formula: 'Share of ground-truth tokens found in retrieved context.', ragOnly: true },
]

export function AdminResearchDashboardPage() {
  const [datasets, setDatasets] = useState([])
  const [experiments, setExperiments] = useState([])
  const [datasetId, setDatasetId] = useState('')
  const [ragExperimentId, setRagExperimentId] = useState('')
  const [fineExperimentId, setFineExperimentId] = useState('')
  const [comparison, setComparison] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [expanded, setExpanded] = useState(new Set())

  useEffect(() => {
    let active = true
    Promise.all([evaluationService.getDatasets(), evaluationService.getExperiments()])
      .then(([datasetItems, experimentItems]) => {
        if (!active) return
        setDatasets(datasetItems)
        setExperiments(experimentItems)
        const firstDatasetId = datasetItems[0]?.id ?? ''
        const firstRuns = terminalRuns(experimentItems, firstDatasetId)
        selectDataset(firstDatasetId, experimentItems, { setDatasetId, setRagExperimentId, setFineExperimentId })
        if (!firstRuns.some((run) => run.experimentType === 'RAG') || !firstRuns.some((run) => run.experimentType === 'FINE_TUNED')) setLoading(false)
      })
      .catch((requestError) => { if (active) { setError(requestError.message); setLoading(false) } })
    return () => { active = false }
  }, [])

  const datasetRuns = useMemo(() => terminalRuns(experiments, datasetId), [datasetId, experiments])
  const ragRuns = datasetRuns.filter((run) => run.experimentType === 'RAG')
  const fineRuns = datasetRuns.filter((run) => run.experimentType === 'FINE_TUNED')

  useEffect(() => {
    if (!datasetId || !ragExperimentId || !fineExperimentId) return undefined
    let active = true
    evaluationService.getComparison({ datasetId, ragExperimentId, fineTunedExperimentId: fineExperimentId })
      .then((value) => active && setComparison(value))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [datasetId, ragExperimentId, fineExperimentId])

  const rows = useMemo(() => filterComparisonRows(comparison?.perQuestion ?? [], query, filter), [comparison, query, filter])
  const conclusions = useMemo(() => buildResearchConclusions(comparison), [comparison])
  const rag = comparison?.ragExperiment
  const fine = comparison?.fineTunedExperiment
  const changeDataset = (nextDatasetId) => {
    const runs = terminalRuns(experiments, nextDatasetId)
    setLoading(runs.some((run) => run.experimentType === 'RAG') && runs.some((run) => run.experimentType === 'FINE_TUNED'))
    setError('')
    selectDataset(nextDatasetId, experiments, { setDatasetId, setRagExperimentId, setFineExperimentId })
    setComparison(null)
    setExpanded(new Set())
  }

  return (
    <div className="research-dashboard">
      <div className="report-screen-only">
        <AdminPageHeader
          description="Compare quality, source grounding, and response speed across RAG and fine-tuned runs."
          icon={BarChart3}
          title="RBL research report"
        />
      </div>

      <Panel className="report-controls relative z-20 mt-4 overflow-visible p-3 sm:p-4">
        <div className="grid gap-2.5 lg:grid-cols-3 lg:gap-3">
          <ResearchSelect label="Dataset" options={datasets} placeholder="Select a dataset" value={datasetId} onChange={changeDataset} optionLabel={(dataset) => dataset.name} optionMeta={(dataset) => formatStatus(dataset.status)} emptyLabel="No datasets available" />
          <ResearchSelect label="RAG run" options={ragRuns} placeholder="Select a RAG run" value={ragExperimentId} onChange={(nextId) => { setComparison(null); setLoading(Boolean(nextId && fineExperimentId)); setError(''); setRagExperimentId(nextId) }} optionLabel={(run) => run.name} optionMeta={(run) => formatStatus(run.status)} emptyLabel="No RAG runs available" />
          <ResearchSelect label="Fine-tuned run" options={fineRuns} placeholder="Select a fine-tuned run" value={fineExperimentId} onChange={(nextId) => { setComparison(null); setLoading(Boolean(nextId && ragExperimentId)); setError(''); setFineExperimentId(nextId) }} optionLabel={(run) => run.name} optionMeta={(run) => formatStatus(run.status)} emptyLabel="No fine-tuned runs available" />
        </div>
      </Panel>

      {error ? <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
      {loading ? <Panel className="mt-4 flex min-h-40 items-center justify-center gap-2 p-5 text-sm font-semibold text-slate-600"><span className="size-4 animate-spin rounded-full border-2 border-primary border-r-transparent" />Preparing report…</Panel> : comparison ? (
        <article className="research-report mt-4 space-y-6" aria-label="RAG and fine-tuned experiment report">
          <ReportTitle comparison={comparison} onCsv={() => downloadComparisonCsv(comparison)} onPrint={() => window.print()} />
          <Suspense fallback={<div className="grid min-h-72 place-items-center rounded-2xl border border-slate-200 bg-white/70 text-sm font-semibold text-slate-500">Preparing charts…</div>}><ResearchDashboardCharts comparison={comparison} /></Suspense>
          <ExecutiveSummary conclusions={conclusions} comparison={comparison} />

          <section aria-labelledby="benchmark-heading">
            <SectionHeading eyebrow="02 · Metrics" icon={FlaskConical} id="benchmark-heading" title="Local proxy benchmark" />
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white/80">
              <table className="benchmark-table w-full min-w-[760px] text-left text-sm">
                <thead><tr><th>Metric</th><th>RAG</th><th>Fine-tuned</th><th>Interpretation</th></tr></thead>
                <tbody>{METRICS.map((metric) => <MetricRow key={metric.key} metric={metric} rag={rag} fine={fine} />)}<LatencyMetricRow rag={rag} fine={fine} /><SuccessMetricRow rag={rag} fine={fine} /></tbody>
              </table>
            </div>
          </section>

          <QuestionAnalysis rows={rows} allRows={comparison.perQuestion ?? []} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} expanded={expanded} setExpanded={setExpanded} />
          <Methodology comparison={comparison} />
        </article>
      ) : <div className="mt-4"><EmptyState title="Select two compatible runs" description="Choose one RAG run and one fine-tuned run that share a dataset checksum and benchmark profile." /></div>}
    </div>
  )
}

function ResearchSelect({ emptyLabel, label, onChange, optionLabel, optionMeta, options, placeholder, value }) {
  const [open, setOpen] = useState(false)
  const controlId = useId()
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const optionRefs = useRef([])
  const selectedOption = options.find((option) => option.id === value) ?? null
  const disabled = options.length === 0

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutsidePress = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const openMenu = () => {
    if (disabled) return
    setOpen(true)
    window.requestAnimationFrame(() => optionRefs.current[0]?.focus())
  }

  const selectOption = (option) => {
    onChange(option.id)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const handleOptionKeyDown = (event, index, option) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      optionRefs.current[(index + 1) % options.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      optionRefs.current[(index - 1 + options.length) % options.length]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      optionRefs.current[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      optionRefs.current[options.length - 1]?.focus()
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectOption(option)
    }
  }

  return (
    <div className={`relative ${open ? 'z-30' : 'z-0'}`} ref={rootRef}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700" id={`${controlId}-label`}>{label}</span>
      <button
        aria-controls={`${controlId}-listbox`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-labelledby={`${controlId}-label ${controlId}-value`}
        className="group flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-left shadow-[0_10px_24px_rgba(15,118,110,.06)] transition duration-200 hover:border-teal-300 hover:bg-white focus-visible:border-teal-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            open ? setOpen(false) : openMenu()
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${selectedOption ? 'font-semibold text-slate-800' : 'font-medium text-slate-400'}`} id={`${controlId}-value`}>
            {selectedOption ? optionLabel(selectedOption) : (disabled ? emptyLabel : placeholder)}
          </span>
          {selectedOption ? <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">{optionMeta(selectedOption)}</span> : null}
        </span>
        <ChevronDown className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-primary' : 'group-hover:text-primary'}`} size={18} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="research-select-menu absolute left-0 right-0 top-[calc(100%+0.5rem)] overflow-hidden rounded-xl border border-teal-100 bg-white/95 p-1.5 shadow-[0_20px_42px_rgba(15,118,110,.18)] backdrop-blur-xl"
            exit={{ opacity: 0, scale: 0.985, y: -7 }}
            id={`${controlId}-listbox`}
            initial={{ opacity: 0, scale: 0.985, y: -7 }}
            role="listbox"
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="max-h-64 overflow-y-auto overscroll-contain pr-0.5">
              {options.map((option, index) => {
                const selected = option.id === value
                return <motion.button
                  animate={{ opacity: 1, x: 0 }}
                  aria-selected={selected}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition ${selected ? 'bg-teal-50 text-primary' : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-400`}
                  initial={{ opacity: 0, x: -7 }}
                  key={option.id}
                  onClick={() => selectOption(option)}
                  onKeyDown={(event) => handleOptionKeyDown(event, index, option)}
                  ref={(node) => { optionRefs.current[index] = node }}
                  role="option"
                  transition={{ duration: 0.18, delay: Math.min(index, 6) * 0.035, ease: [0.22, 1, 0.36, 1] }}
                  type="button"
                >
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold">{optionLabel(option)}</span><span className="mt-0.5 block text-xs font-medium text-slate-500">{optionMeta(option)}</span></span>
                  {selected ? <CheckCircle2 className="shrink-0 text-primary" size={16} /> : null}
                </motion.button>
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function ReportTitle({ comparison, onCsv, onPrint }) {
  const dataset = comparison.dataset ?? {}
  return <header className="os-panel overflow-hidden p-6 sm:p-8">
    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
      <div><p className="text-xs font-black uppercase tracking-[.16em] text-primary">Research output · RBL</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">RAG vs fine-tuned comparison</h1><p className="mt-3 max-w-3xl leading-7 text-slate-600">Evaluated on <strong>{dataset.name ?? 'the selected dataset'}</strong> using the same data snapshot for a fair comparison.</p></div>
      <div className="report-actions flex shrink-0 gap-2"><button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-primary" onClick={onCsv} type="button"><Download size={17} />Export CSV</button><button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:opacity-90" onClick={onPrint} type="button"><FileDown size={17} />Print / save as PDF</button></div>
    </div>
    <dl className="mt-6 grid gap-4 border-t border-slate-200 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4"><Meta label="Questions" value={dataset.questionCount ?? comparison.perQuestion?.length ?? 0} /><Meta label="Documents" value={dataset.documentCount ?? '—'} /><Meta label="Metric standard" value="Local proxy" /><Meta label="Formula version" value={comparison.formulaVersion ?? 'token-overlap-v1'} /></dl>
    <p className="mt-4 break-all font-mono text-[11px] text-slate-500">Checksum: {comparison.datasetChecksum}</p>
  </header>
}

function ExecutiveSummary({ conclusions, comparison }) {
  const hasFailure = (comparison.ragExperiment?.failureCount ?? 0) + (comparison.fineTunedExperiment?.failureCount ?? 0) > 0
  return <section className="rounded-2xl border border-teal-200 bg-teal-50/70 p-6 sm:p-8" aria-labelledby="conclusion-heading">
    <div className="flex items-start gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-white"><CheckCircle2 size={21} /></div><div><p className="text-xs font-black uppercase tracking-[.14em] text-primary">Experimental conclusion</p><h2 className="mt-1 text-2xl font-black text-slate-950" id="conclusion-heading">Key findings without collapsing them into one arbitrary score</h2></div></div>
    <ul className="mt-5 grid gap-3 text-[15px] leading-7 text-slate-700 lg:grid-cols-2">{conclusions.map((item) => <li className="flex gap-3" key={item}><span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />{item}</li>)}</ul>
    {hasFailure ? <div className="mt-5 flex gap-2 rounded-xl border border-amber-200 bg-white/70 p-3 text-sm text-amber-900"><AlertTriangle className="shrink-0" size={18} />This report has partial results. Failed questions remain visible in the performance summary and detail table.</div> : null}
  </section>
}

function SectionHeading({ eyebrow, icon: Icon, id, title }) { return <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-teal-50 text-primary"><Icon size={19} /></div><div><p className="text-xs font-bold uppercase tracking-[.13em] text-slate-500">{eyebrow}</p><h2 className="text-xl font-black text-slate-950" id={id}>{title}</h2></div></div> }

function MetricRow({ metric, rag, fine }) { return <tr><th scope="row"><span className="block font-bold text-slate-900">{metric.label}</span><span className="mt-1 block text-xs font-normal text-slate-500">{metric.direction}</span></th><td className="metric-number">{formatPercent(rag?.[metric.key])}</td><td className="metric-number">{metric.ragOnly ? <NotApplicable /> : formatPercent(fine?.[metric.key])}</td><td><p className="leading-6 text-slate-600">{metric.plain}</p><details className="mt-2"><summary className="cursor-pointer text-xs font-bold text-primary">View calculation</summary><p className="mt-2 text-xs leading-5 text-slate-500">{metric.formula}</p></details></td></tr> }
function LatencyMetricRow({ rag, fine }) { return <tr><th scope="row"><span className="block font-bold">Response time</span><span className="mt-1 block text-xs font-normal text-slate-500">Lower is better</span></th><td className="metric-number">{formatLatency(rag?.latencyMs)}</td><td className="metric-number">{formatLatency(fine?.latencyMs)}</td><td className="leading-6 text-slate-600">Average effective time to process one question.</td></tr> }
function SuccessMetricRow({ rag, fine }) { return <tr><th scope="row"><span className="block font-bold">Successful-run rate</span><span className="mt-1 block text-xs font-normal text-slate-500">Higher is better</span></th><td className="metric-number">{formatPercent(successRate(rag))}</td><td className="metric-number">{formatPercent(successRate(fine))}</td><td className="leading-6 text-slate-600">Share of questions with a valid result; failed model runs remain visible.</td></tr> }
function NotApplicable() { return <span className="inline-block max-w-40 text-sm font-semibold leading-5 text-slate-500">Not applicable<span className="block text-xs font-normal">No retrieval context</span></span> }

function QuestionAnalysis({ rows, allRows, query, setQuery, filter, setFilter, expanded, setExpanded }) {
  const toggle = (id) => setExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  return <section aria-labelledby="questions-heading">
    <SectionHeading eyebrow="03 · Sample analysis" icon={Search} id="questions-heading" title={`Details for ${allRows.length} questions`} />
    <div className="report-question-controls mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 md:flex-row">
      <label className="relative flex-1"><span className="sr-only">Search questions</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary" onChange={(event) => setQuery(event.target.value)} placeholder="Search question content…" value={query} /></label>
      <select aria-label="Filter results" className="min-h-11 rounded-xl border border-border bg-white/90 px-3 text-sm font-semibold text-slate-600 shadow-[0_10px_24px_rgba(15,118,110,.06)] outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 md:max-w-64" onChange={(event) => setFilter(event.target.value)} value={filter}><option value="ALL">All results</option><option value="RAG">RAG performs better</option><option value="FINE">Fine-tuned performs better</option><option value="TIE">Near equivalent</option><option value="ERROR">Has errors</option></select>
    </div>
    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white/80">
      {rows.length ? rows.map((row, index) => { const open = expanded.has(row.questionId); const outcome = classifyRow(row); return <div className="question-row border-b border-slate-200 last:border-0" key={row.questionId}>
        <button aria-expanded={open} className="flex w-full items-start gap-4 p-4 text-left hover:bg-teal-50/40 sm:p-5" onClick={() => toggle(row.questionId)} type="button"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-600">{index + 1}</span><span className="min-w-0 flex-1"><span className="font-bold leading-6 text-slate-900">{row.question}</span><span className="mt-1 flex flex-wrap items-center gap-2 text-xs"><OutcomeBadge outcome={outcome} /><span className="tabular-nums text-slate-500">Δ {formatDelta(row.answerCorrectnessDelta)} percentage points</span>{row.ragError || row.fineTunedError ? <span className="font-semibold text-red-700">Has errors</span> : null}</span></span><ChevronDown className={`mt-1 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} size={18} /></button>
        {open ? <QuestionDetail row={row} /> : null}
      </div> }) : <p className="p-8 text-center text-sm text-slate-500">No questions match this filter.</p>}
    </div>
  </section>
}

function QuestionDetail({ row }) { return <div className="question-detail border-t border-slate-100 bg-slate-50/70 p-5 sm:p-6"><div className="grid gap-5 lg:grid-cols-3"><AnswerBlock label="Ground truth" text={row.groundTruth} /><AnswerBlock label={`RAG · ${formatPercent(row.ragAnswerCorrectness)}`} text={row.ragAnswer} error={row.ragError} /><AnswerBlock label={`Fine-tuned · ${formatPercent(row.fineTunedAnswerCorrectness)}`} text={row.fineTunedAnswer} error={row.fineTunedError} /></div><div className="mt-5 grid gap-4 md:grid-cols-2"><div><p className="text-xs font-black uppercase tracking-[.1em] text-slate-500">RAG sources</p><CitationList citations={row.ragCitations} /></div><div><p className="text-xs font-black uppercase tracking-[.1em] text-slate-500">Timing</p><p className="mt-2 text-sm text-slate-600">RAG: <strong>{formatLatency(row.ragEffectiveLatencyMs ?? row.ragLatencyMs)}</strong> · Fine-tuned: <strong>{formatLatency(row.fineTunedEffectiveLatencyMs ?? row.fineTunedLatencyMs)}</strong></p></div></div></div> }
function AnswerBlock({ error, label, text }) { return <div><p className="text-xs font-black uppercase tracking-[.1em] text-slate-500">{label}</p><p className={`mt-2 text-sm leading-6 ${error ? 'text-red-700' : 'text-slate-700'}`}>{error || text || 'No data available.'}</p></div> }
function CitationList({ citations }) { const list = Array.isArray(citations) ? citations : []; return list.length ? <ul className="mt-2 space-y-1 text-sm text-slate-600">{list.map((citation, index) => <li key={`${index}-${JSON.stringify(citation)}`}>{citationLabel(citation, index)}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No citations recorded.</p> }
function OutcomeBadge({ outcome }) { const labels = { RAG: 'RAG performs better', FINE: 'Fine-tuned performs better', TIE: 'Near equivalent', ERROR: 'Has errors' }; return <span className="rounded-full bg-teal-50 px-2 py-1 font-bold text-primary">{labels[outcome]}</span> }

function Methodology({ comparison }) { const profile = comparison.benchmarkProfile ?? {}; return <section className="report-methodology rounded-2xl border border-slate-200 bg-white/70 p-6 sm:p-8" aria-labelledby="method-heading"><SectionHeading eyebrow="04 · Research transparency" icon={Info} id="method-heading" title="Method and limitations" /><div className="mt-5 grid gap-6 md:grid-cols-2"><div><h3 className="font-black">Benchmark setup</h3><dl className="mt-3 space-y-2 text-sm text-slate-600"><MetaLine label="Profile" value={profile.version ?? profile.profileVersion ?? 'Full benchmark'} /><MetaLine label="Batch size" value={profile.batchSize ?? '—'} /><MetaLine label="Maximum input" value={profile.maxInputTokens ? `${profile.maxInputTokens} tokens` : '—'} /><MetaLine label="Maximum output" value={profile.maxNewTokens ? `${profile.maxNewTokens} tokens` : '—'} /></dl></div><div><h3 className="font-black">Read before drawing conclusions</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600"><li>This dataset contains only {comparison.dataset?.questionCount ?? comparison.perQuestion?.length ?? 0} questions and does not represent every scenario.</li><li>The ground truth is supplied by the dataset author.</li><li>Metrics are local proxies, not official RAGAS or independent expert evaluation.</li><li>Fine-tuned runs do not retrieve context, so they have no citations, context precision/recall, or source faithfulness.</li></ul></div></div></section> }

export function buildResearchConclusions(comparison) {
  if (!comparison) return []
  const rag = comparison.ragExperiment ?? {}; const fine = comparison.fineTunedExperiment ?? {}
  const qualityDelta = (fine.answerCorrectness ?? 0) - (rag.answerCorrectness ?? 0)
  const quality = Math.abs(qualityDelta) < 0.02 ? 'The two models have near-equivalent answer correctness (a difference below 2 percentage points).' : `${qualityDelta > 0 ? 'Fine-tuned' : 'RAG'} matches the ground truth ${Math.round(Math.abs(qualityDelta) * 100)} percentage points more closely.`
  const speed = speedSentence(rag.latencyMs, fine.latencyMs)
  const grounding = `For RAG, context precision is ${formatPercent(rag.contextPrecision)} and context recall is ${formatPercent(rag.contextRecall)}. These figures indicate how accurately the system chose sources and whether it retrieved enough information.`
  const useCase = 'RAG fits work that requires source traceability; fine-tuning fits direct responses. This report does not claim that either model is universally best.'
  return [quality, speed, grounding, useCase]
}

export function filterComparisonRows(rows, query, filter) { const normalized = query.trim().toLocaleLowerCase('en'); return rows.filter((row) => (!normalized || row.question?.toLocaleLowerCase('en').includes(normalized)) && (filter === 'ALL' || classifyRow(row) === filter)) }
export function buildComparisonCsv(comparison) {
  const headers = ['question_id', 'question', 'ground_truth', 'rag_answer', 'fine_tuned_answer', 'rag_answer_correctness', 'fine_tuned_answer_correctness', 'correctness_delta_percentage_points', 'rag_answer_relevance', 'fine_tuned_answer_relevance', 'rag_semantic_similarity', 'fine_tuned_semantic_similarity', 'rag_faithfulness', 'rag_context_precision', 'rag_context_recall', 'rag_latency_ms', 'fine_tuned_latency_ms', 'rag_citations', 'rag_error', 'fine_tuned_error']
  const lines = [headers, ...(comparison?.perQuestion ?? []).map((row) => [row.questionId, row.question, row.groundTruth, row.ragAnswer, row.fineTunedAnswer, row.ragAnswerCorrectness, row.fineTunedAnswerCorrectness, row.answerCorrectnessDelta == null ? '' : row.answerCorrectnessDelta * 100, row.ragAnswerRelevance, row.fineTunedAnswerRelevance, row.ragSemanticSimilarity, row.fineTunedSemanticSimilarity, row.ragFaithfulness, row.ragContextPrecision, row.ragContextRecall, row.ragEffectiveLatencyMs ?? row.ragLatencyMs, row.fineTunedEffectiveLatencyMs ?? row.fineTunedLatencyMs, JSON.stringify(row.ragCitations ?? []), row.ragError, row.fineTunedError])]
  return `\uFEFF${lines.map((line) => line.map(csvCell).join(',')).join('\r\n')}`
}

function downloadComparisonCsv(comparison) { const blob = new Blob([buildComparisonCsv(comparison)], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${safeFilename(comparison.dataset?.name ?? 'flow5')}-rag-vs-finetuned.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url) }
function terminalRuns(experiments, datasetId) { return experiments.filter((run) => run.datasetId === datasetId && ['COMPLETED', 'FAILED'].includes(run.status) && run.datasetChecksum) }
function selectDataset(id, experiments, setters) { const runs = terminalRuns(experiments, id); setters.setDatasetId(id); setters.setRagExperimentId(runs.find((run) => run.experimentType === 'RAG')?.id ?? ''); setters.setFineExperimentId(runs.find((run) => run.experimentType === 'FINE_TUNED')?.id ?? '') }
function classifyRow(row) { if (row.ragError || row.fineTunedError) return 'ERROR'; const delta = row.answerCorrectnessDelta; if (delta == null || Math.abs(delta) < 0.02) return 'TIE'; return delta > 0 ? 'FINE' : 'RAG' }
function speedSentence(rag, fine) { if (!rag || !fine) return 'There is not enough latency data to draw a speed conclusion.'; const faster = rag < fine ? 'RAG' : 'Fine-tuned'; const slower = Math.max(rag, fine); const fasterValue = Math.min(rag, fine); return `${faster} responds about ${Math.round((1 - fasterValue / slower) * 100)}% faster based on average latency.` }
function successRate(run) { const total = totalRunCount(run); return run?.successRate ?? (total ? (run?.successCount ?? 0) / total : null) }
function totalRunCount(run) { return run?.totalCount ?? ((run?.successCount ?? 0) + (run?.failureCount ?? 0)) }
function formatPercent(value) { return value == null ? '—' : `${Math.round(value * 100)}%` }
function formatLatency(value) { return value == null ? '—' : `${Math.round(value)} ms` }
function formatDelta(value) { if (value == null) return '—'; const points = Math.round(value * 100); return `${points > 0 ? '+' : ''}${points}` }
function csvCell(value) { const text = value == null ? '' : String(value); return `"${text.replaceAll('"', '""')}"` }
function safeFilename(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'flow5' }
function citationLabel(citation, index) { if (typeof citation === 'string') return citation; return citation?.title ?? citation?.filename ?? citation?.source ?? `Source ${index + 1}` }
function formatStatus(status) { return String(status ?? 'Unknown').toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function Meta({ label, value }) { return <div><dt className="text-xs font-bold uppercase tracking-[.1em] text-slate-500">{label}</dt><dd className="mt-1 font-bold tabular-nums text-slate-900">{value}</dd></div> }
function MetaLine({ label, value }) { return <div className="flex justify-between gap-4"><dt>{label}</dt><dd className="font-bold tabular-nums text-slate-900">{value}</dd></div> }
