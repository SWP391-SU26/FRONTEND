import {
  AlertTriangle, BarChart3, CheckCircle2, ChevronDown, Download,
  FileDown, FlaskConical, Info, Search,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { EmptyState, Panel, SelectField } from '../../components/ui.jsx'
import { AdminPageHeader } from '../../layouts/AdminLayout.jsx'
import * as evaluationService from '../../services/evaluationService.js'

const ResearchDashboardCharts = lazy(() => import('./ResearchDashboardCharts.jsx')
  .then((module) => ({ default: module.ResearchDashboardCharts })))

const METRICS = [
  { key: 'answerCorrectness', label: 'Độ chính xác câu trả lời', plain: 'Câu trả lời khớp với đáp án chuẩn đến mức nào.', direction: 'Cao hơn tốt hơn', formula: 'Token-overlap F1 giữa câu trả lời sinh ra và ground truth.' },
  { key: 'answerRelevance', label: 'Mức liên quan của câu trả lời', plain: 'Câu trả lời có đi đúng trọng tâm đáp án mong đợi hay không.', direction: 'Cao hơn tốt hơn', formula: 'Local proxy hiện dùng cùng token-overlap F1 với Answer correctness.' },
  { key: 'semanticSimilarity', label: 'Độ tương đồng nội dung', plain: 'Từ ngữ và ý chính có gần với đáp án chuẩn hay không.', direction: 'Cao hơn tốt hơn', formula: 'Local token similarity proxy; chưa phải semantic evaluator độc lập.' },
  { key: 'faithfulness', label: 'Bám sát nguồn', plain: 'Câu trả lời RAG có được hỗ trợ bởi phần tài liệu đã truy xuất hay không.', direction: 'Cao hơn tốt hơn', formula: 'Tỷ lệ token nội dung của câu trả lời xuất hiện trong context được truy xuất.', ragOnly: true },
  { key: 'contextPrecision', label: 'Độ chính xác nguồn tìm được', plain: 'Trong các nội dung RAG lấy về, bao nhiêu phần thực sự hữu ích.', direction: 'Cao hơn tốt hơn', formula: 'Token overlap giữa context truy xuất và ground truth.', ragOnly: true },
  { key: 'contextRecall', label: 'Độ bao phủ nguồn', plain: 'RAG đã lấy đủ thông tin cần thiết để trả lời hay chưa.', direction: 'Cao hơn tốt hơn', formula: 'Tỷ lệ token ground truth được tìm thấy trong context.', ragOnly: true },
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
          description="Báo cáo thực nghiệm so sánh chất lượng, độ tin cậy nguồn và tốc độ của RAG với Fine-tuned."
          icon={BarChart3}
          title="Báo cáo nghiên cứu RBL"
        />
      </div>

      <Panel className="report-controls mt-4 p-5">
        <div className="grid gap-3 lg:grid-cols-3">
          <Labeled label="Dataset"><SelectField aria-label="Dataset" onChange={(event) => changeDataset(event.target.value)} value={datasetId}><option value="">Chọn dataset</option>{datasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.name} · {dataset.status}</option>)}</SelectField></Labeled>
          <Labeled label="RAG run"><SelectField aria-label="RAG run" onChange={(event) => { setComparison(null); setLoading(Boolean(event.target.value && fineExperimentId)); setError(''); setRagExperimentId(event.target.value) }} value={ragExperimentId}><option value="">Chọn RAG run</option>{ragRuns.map((run) => <option key={run.id} value={run.id}>{run.name} · {run.status}</option>)}</SelectField></Labeled>
          <Labeled label="Fine-tuned run"><SelectField aria-label="Fine-tuned run" onChange={(event) => { setComparison(null); setLoading(Boolean(event.target.value && ragExperimentId)); setError(''); setFineExperimentId(event.target.value) }} value={fineExperimentId}><option value="">Chọn Fine-tuned run</option>{fineRuns.map((run) => <option key={run.id} value={run.id}>{run.name} · {run.status}</option>)}</SelectField></Labeled>
        </div>
      </Panel>

      {error ? <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
      {loading ? <Panel className="mt-4 flex min-h-40 items-center justify-center gap-2 p-5 text-sm font-semibold text-slate-600"><span className="size-4 animate-spin rounded-full border-2 border-primary border-r-transparent" />Đang tạo báo cáo…</Panel> : comparison ? (
        <article className="research-report mt-4 space-y-6" aria-label="Báo cáo thực nghiệm RAG và Fine-tuned">
          <ReportTitle comparison={comparison} onCsv={() => downloadComparisonCsv(comparison)} onPrint={() => window.print()} />
          <Suspense fallback={<div className="grid min-h-72 place-items-center rounded-2xl border border-slate-200 bg-white/70 text-sm font-semibold text-slate-500">Đang dựng biểu đồ…</div>}><ResearchDashboardCharts comparison={comparison} /></Suspense>
          <ExecutiveSummary conclusions={conclusions} comparison={comparison} />

          <section aria-labelledby="benchmark-heading">
            <SectionHeading eyebrow="02 · Bảng số liệu" icon={FlaskConical} id="benchmark-heading" title="RAGAS-style benchmark" />
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white/80">
              <table className="benchmark-table w-full min-w-[760px] text-left text-sm">
                <thead><tr><th>Chỉ số</th><th>RAG</th><th>Fine-tuned</th><th>Giải thích</th></tr></thead>
                <tbody>{METRICS.map((metric) => <MetricRow key={metric.key} metric={metric} rag={rag} fine={fine} />)}<LatencyMetricRow rag={rag} fine={fine} /><SuccessMetricRow rag={rag} fine={fine} /></tbody>
              </table>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900"><Info className="mt-0.5 shrink-0" size={17} /><p><strong>Lưu ý phương pháp:</strong> đây là local proxy, không phải official RAGAS. Độ chính xác, mức liên quan và độ tương đồng hiện cùng dựa trên token overlap nên không được xem là ba bằng chứng độc lập.</p></div>
          </section>

          <QuestionAnalysis rows={rows} allRows={comparison.perQuestion ?? []} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} expanded={expanded} setExpanded={setExpanded} />
          <Methodology comparison={comparison} />
        </article>
      ) : <div className="mt-4"><EmptyState title="Chọn hai lần chạy tương thích" description="Cần một RAG run và một Fine-tuned run dùng cùng dataset checksum và benchmark profile." /></div>}
    </div>
  )
}

function ReportTitle({ comparison, onCsv, onPrint }) {
  const dataset = comparison.dataset ?? {}
  return <header className="os-panel overflow-hidden p-6 sm:p-8">
    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
      <div><p className="text-xs font-black uppercase tracking-[.16em] text-primary">Sản phẩm nghiên cứu · RBL</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Báo cáo so sánh RAG và Fine-tuned</h1><p className="mt-3 max-w-3xl leading-7 text-slate-600">Đánh giá trên <strong>{dataset.name ?? 'dataset đã chọn'}</strong> với cùng một snapshot dữ liệu để bảo đảm so sánh công bằng.</p></div>
      <div className="report-actions flex shrink-0 gap-2"><button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-primary" onClick={onCsv} type="button"><Download size={17} />Xuất CSV</button><button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:opacity-90" onClick={onPrint} type="button"><FileDown size={17} />Xuất PDF</button></div>
    </div>
    <dl className="mt-6 grid gap-4 border-t border-slate-200 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4"><Meta label="Số câu hỏi" value={dataset.questionCount ?? comparison.perQuestion?.length ?? 0} /><Meta label="Số tài liệu" value={dataset.documentCount ?? '—'} /><Meta label="Chuẩn metric" value="Local proxy" /><Meta label="Formula version" value={comparison.formulaVersion ?? 'token-overlap-v1'} /></dl>
    <p className="mt-4 break-all font-mono text-[11px] text-slate-500">Checksum: {comparison.datasetChecksum}</p>
  </header>
}

function ExecutiveSummary({ conclusions, comparison }) {
  const hasFailure = (comparison.ragExperiment?.failureCount ?? 0) + (comparison.fineTunedExperiment?.failureCount ?? 0) > 0
  return <section className="rounded-2xl border border-teal-200 bg-teal-50/70 p-6 sm:p-8" aria-labelledby="conclusion-heading">
    <div className="flex items-start gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-white"><CheckCircle2 size={21} /></div><div><p className="text-xs font-black uppercase tracking-[.14em] text-primary">Kết luận thực nghiệm</p><h2 className="mt-1 text-2xl font-black text-slate-950" id="conclusion-heading">Kết quả chính, không gộp thành một điểm tùy ý</h2></div></div>
    <ul className="mt-5 grid gap-3 text-[15px] leading-7 text-slate-700 lg:grid-cols-2">{conclusions.map((item) => <li className="flex gap-3" key={item}><span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />{item}</li>)}</ul>
    {hasFailure ? <div className="mt-5 flex gap-2 rounded-xl border border-amber-200 bg-white/70 p-3 text-sm text-amber-900"><AlertTriangle className="shrink-0" size={18} />Báo cáo có kết quả một phần. Số câu lỗi vẫn được công khai trong phần hiệu năng và bảng chi tiết.</div> : null}
  </section>
}

function SectionHeading({ eyebrow, icon: Icon, id, title }) { return <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-teal-50 text-primary"><Icon size={19} /></div><div><p className="text-xs font-bold uppercase tracking-[.13em] text-slate-500">{eyebrow}</p><h2 className="text-xl font-black text-slate-950" id={id}>{title}</h2></div></div> }

function MetricRow({ metric, rag, fine }) { return <tr><th scope="row"><span className="block font-bold text-slate-900">{metric.label}</span><span className="mt-1 block text-xs font-normal text-slate-500">{metric.direction}</span></th><td className="metric-number">{formatPercent(rag?.[metric.key])}</td><td className="metric-number">{metric.ragOnly ? <NotApplicable /> : formatPercent(fine?.[metric.key])}</td><td><p className="leading-6 text-slate-600">{metric.plain}</p><details className="mt-2"><summary className="cursor-pointer text-xs font-bold text-primary">Xem cách tính</summary><p className="mt-2 text-xs leading-5 text-slate-500">{metric.formula}</p></details></td></tr> }
function LatencyMetricRow({ rag, fine }) { return <tr><th scope="row"><span className="block font-bold">Thời gian phản hồi</span><span className="mt-1 block text-xs font-normal text-slate-500">Thấp hơn tốt hơn</span></th><td className="metric-number">{formatLatency(rag?.latencyMs)}</td><td className="metric-number">{formatLatency(fine?.latencyMs)}</td><td className="leading-6 text-slate-600">Thời gian hiệu dụng trung bình để xử lý một câu hỏi.</td></tr> }
function SuccessMetricRow({ rag, fine }) { return <tr><th scope="row"><span className="block font-bold">Tỷ lệ chạy thành công</span><span className="mt-1 block text-xs font-normal text-slate-500">Cao hơn tốt hơn</span></th><td className="metric-number">{formatPercent(successRate(rag))}</td><td className="metric-number">{formatPercent(successRate(fine))}</td><td className="leading-6 text-slate-600">Tỷ lệ câu hỏi có kết quả hợp lệ, không che giấu lỗi chạy model.</td></tr> }
function NotApplicable() { return <span className="inline-block max-w-40 text-sm font-semibold leading-5 text-slate-500">Không áp dụng<span className="block text-xs font-normal">Không có retrieval context</span></span> }

function QuestionAnalysis({ rows, allRows, query, setQuery, filter, setFilter, expanded, setExpanded }) {
  const toggle = (id) => setExpanded((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  return <section aria-labelledby="questions-heading">
    <SectionHeading eyebrow="03 · Phân tích mẫu" icon={Search} id="questions-heading" title={`Chi tiết ${allRows.length} câu hỏi`} />
    <div className="report-question-controls mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 md:flex-row">
      <label className="relative flex-1"><span className="sr-only">Tìm câu hỏi</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary" onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo nội dung câu hỏi…" value={query} /></label>
      <SelectField aria-label="Lọc kết quả" className="md:max-w-64" onChange={(event) => setFilter(event.target.value)} value={filter}><option value="ALL">Tất cả kết quả</option><option value="RAG">RAG tốt hơn</option><option value="FINE">Fine-tuned tốt hơn</option><option value="TIE">Gần tương đương</option><option value="ERROR">Có lỗi</option></SelectField>
    </div>
    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white/80">
      {rows.length ? rows.map((row, index) => { const open = expanded.has(row.questionId); const outcome = classifyRow(row); return <div className="question-row border-b border-slate-200 last:border-0" key={row.questionId}>
        <button aria-expanded={open} className="flex w-full items-start gap-4 p-4 text-left hover:bg-teal-50/40 sm:p-5" onClick={() => toggle(row.questionId)} type="button"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-600">{index + 1}</span><span className="min-w-0 flex-1"><span className="font-bold leading-6 text-slate-900">{row.question}</span><span className="mt-1 flex flex-wrap items-center gap-2 text-xs"><OutcomeBadge outcome={outcome} /><span className="tabular-nums text-slate-500">Δ {formatDelta(row.answerCorrectnessDelta)} điểm %</span>{row.ragError || row.fineTunedError ? <span className="font-semibold text-red-700">Có lỗi</span> : null}</span></span><ChevronDown className={`mt-1 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} size={18} /></button>
        {open ? <QuestionDetail row={row} /> : null}
      </div> }) : <p className="p-8 text-center text-sm text-slate-500">Không có câu hỏi phù hợp bộ lọc.</p>}
    </div>
  </section>
}

function QuestionDetail({ row }) { return <div className="question-detail border-t border-slate-100 bg-slate-50/70 p-5 sm:p-6"><div className="grid gap-5 lg:grid-cols-3"><AnswerBlock label="Đáp án chuẩn" text={row.groundTruth} /><AnswerBlock label={`RAG · ${formatPercent(row.ragAnswerCorrectness)}`} text={row.ragAnswer} error={row.ragError} /><AnswerBlock label={`Fine-tuned · ${formatPercent(row.fineTunedAnswerCorrectness)}`} text={row.fineTunedAnswer} error={row.fineTunedError} /></div><div className="mt-5 grid gap-4 md:grid-cols-2"><div><p className="text-xs font-black uppercase tracking-[.1em] text-slate-500">Nguồn RAG</p><CitationList citations={row.ragCitations} /></div><div><p className="text-xs font-black uppercase tracking-[.1em] text-slate-500">Thời gian</p><p className="mt-2 text-sm text-slate-600">RAG: <strong>{formatLatency(row.ragEffectiveLatencyMs ?? row.ragLatencyMs)}</strong> · Fine-tuned: <strong>{formatLatency(row.fineTunedEffectiveLatencyMs ?? row.fineTunedLatencyMs)}</strong></p></div></div></div> }
function AnswerBlock({ error, label, text }) { return <div><p className="text-xs font-black uppercase tracking-[.1em] text-slate-500">{label}</p><p className={`mt-2 text-sm leading-6 ${error ? 'text-red-700' : 'text-slate-700'}`}>{error || text || 'Không có dữ liệu.'}</p></div> }
function CitationList({ citations }) { const list = Array.isArray(citations) ? citations : []; return list.length ? <ul className="mt-2 space-y-1 text-sm text-slate-600">{list.map((citation, index) => <li key={`${index}-${JSON.stringify(citation)}`}>{citationLabel(citation, index)}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">Không ghi nhận citation.</p> }
function OutcomeBadge({ outcome }) { const labels = { RAG: 'RAG tốt hơn', FINE: 'Fine-tuned tốt hơn', TIE: 'Gần tương đương', ERROR: 'Có lỗi' }; return <span className="rounded-full bg-teal-50 px-2 py-1 font-bold text-primary">{labels[outcome]}</span> }

function Methodology({ comparison }) { const profile = comparison.benchmarkProfile ?? {}; return <section className="report-methodology rounded-2xl border border-slate-200 bg-white/70 p-6 sm:p-8" aria-labelledby="method-heading"><SectionHeading eyebrow="04 · Minh bạch nghiên cứu" icon={Info} id="method-heading" title="Phương pháp và giới hạn" /><div className="mt-5 grid gap-6 md:grid-cols-2"><div><h3 className="font-black">Thiết lập benchmark</h3><dl className="mt-3 space-y-2 text-sm text-slate-600"><MetaLine label="Profile" value={profile.version ?? profile.profileVersion ?? 'Full benchmark'} /><MetaLine label="Batch size" value={profile.batchSize ?? '—'} /><MetaLine label="Input tối đa" value={profile.maxInputTokens ? `${profile.maxInputTokens} tokens` : '—'} /><MetaLine label="Output tối đa" value={profile.maxNewTokens ? `${profile.maxNewTokens} tokens` : '—'} /></dl></div><div><h3 className="font-black">Giới hạn cần đọc trước khi kết luận</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600"><li>Dataset chỉ gồm {comparison.dataset?.questionCount ?? comparison.perQuestion?.length ?? 0} câu và không đại diện cho mọi tình huống.</li><li>Ground truth do người xây dựng dataset cung cấp.</li><li>Metric là local proxy, không phải official RAGAS hay đánh giá bởi chuyên gia độc lập.</li><li>Fine-tuned không truy xuất context nên không có citation, context precision/recall và faithfulness theo nguồn.</li></ul></div></div></section> }

export function buildResearchConclusions(comparison) {
  if (!comparison) return []
  const rag = comparison.ragExperiment ?? {}; const fine = comparison.fineTunedExperiment ?? {}
  const qualityDelta = (fine.answerCorrectness ?? 0) - (rag.answerCorrectness ?? 0)
  const quality = Math.abs(qualityDelta) < 0.02 ? 'Hai model có độ chính xác gần tương đương (chênh lệch dưới 2 điểm phần trăm).' : `${qualityDelta > 0 ? 'Fine-tuned' : 'RAG'} khớp ground truth cao hơn ${Math.round(Math.abs(qualityDelta) * 100)} điểm phần trăm.`
  const speed = speedSentence(rag.latencyMs, fine.latencyMs)
  const grounding = `Với RAG, độ chính xác nguồn đạt ${formatPercent(rag.contextPrecision)} và độ bao phủ nguồn đạt ${formatPercent(rag.contextRecall)}; hai số này cho biết hệ thống chọn nguồn đúng đến đâu và đã lấy đủ ý hay chưa.`
  const useCase = 'RAG phù hợp khi cần truy vết nguồn; Fine-tuned phù hợp khi ưu tiên phản hồi trực tiếp. Không có model nào được tuyên bố tốt nhất toàn diện từ báo cáo này.'
  return [quality, speed, grounding, useCase]
}

export function filterComparisonRows(rows, query, filter) { const normalized = query.trim().toLocaleLowerCase('vi'); return rows.filter((row) => (!normalized || row.question?.toLocaleLowerCase('vi').includes(normalized)) && (filter === 'ALL' || classifyRow(row) === filter)) }
export function buildComparisonCsv(comparison) {
  const headers = ['question_id', 'question', 'ground_truth', 'rag_answer', 'fine_tuned_answer', 'rag_answer_correctness', 'fine_tuned_answer_correctness', 'correctness_delta_percentage_points', 'rag_answer_relevance', 'fine_tuned_answer_relevance', 'rag_semantic_similarity', 'fine_tuned_semantic_similarity', 'rag_faithfulness', 'rag_context_precision', 'rag_context_recall', 'rag_latency_ms', 'fine_tuned_latency_ms', 'rag_citations', 'rag_error', 'fine_tuned_error']
  const lines = [headers, ...(comparison?.perQuestion ?? []).map((row) => [row.questionId, row.question, row.groundTruth, row.ragAnswer, row.fineTunedAnswer, row.ragAnswerCorrectness, row.fineTunedAnswerCorrectness, row.answerCorrectnessDelta == null ? '' : row.answerCorrectnessDelta * 100, row.ragAnswerRelevance, row.fineTunedAnswerRelevance, row.ragSemanticSimilarity, row.fineTunedSemanticSimilarity, row.ragFaithfulness, row.ragContextPrecision, row.ragContextRecall, row.ragEffectiveLatencyMs ?? row.ragLatencyMs, row.fineTunedEffectiveLatencyMs ?? row.fineTunedLatencyMs, JSON.stringify(row.ragCitations ?? []), row.ragError, row.fineTunedError])]
  return `\uFEFF${lines.map((line) => line.map(csvCell).join(',')).join('\r\n')}`
}

function downloadComparisonCsv(comparison) { const blob = new Blob([buildComparisonCsv(comparison)], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${safeFilename(comparison.dataset?.name ?? 'flow5')}-rag-vs-finetuned.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url) }
function terminalRuns(experiments, datasetId) { return experiments.filter((run) => run.datasetId === datasetId && ['COMPLETED', 'FAILED'].includes(run.status) && run.datasetChecksum) }
function selectDataset(id, experiments, setters) { const runs = terminalRuns(experiments, id); setters.setDatasetId(id); setters.setRagExperimentId(runs.find((run) => run.experimentType === 'RAG')?.id ?? ''); setters.setFineExperimentId(runs.find((run) => run.experimentType === 'FINE_TUNED')?.id ?? '') }
function classifyRow(row) { if (row.ragError || row.fineTunedError) return 'ERROR'; const delta = row.answerCorrectnessDelta; if (delta == null || Math.abs(delta) < 0.02) return 'TIE'; return delta > 0 ? 'FINE' : 'RAG' }
function speedSentence(rag, fine) { if (!rag || !fine) return 'Chưa đủ dữ liệu latency để kết luận về tốc độ.'; const faster = rag < fine ? 'RAG' : 'Fine-tuned'; const slower = Math.max(rag, fine); const fasterValue = Math.min(rag, fine); return `${faster} trả lời nhanh hơn khoảng ${Math.round((1 - fasterValue / slower) * 100)}% theo latency trung bình.` }
function successRate(run) { const total = totalRunCount(run); return run?.successRate ?? (total ? (run?.successCount ?? 0) / total : null) }
function totalRunCount(run) { return run?.totalCount ?? ((run?.successCount ?? 0) + (run?.failureCount ?? 0)) }
function formatPercent(value) { return value == null ? '—' : `${Math.round(value * 100)}%` }
function formatLatency(value) { return value == null ? '—' : `${Math.round(value)} ms` }
function formatDelta(value) { if (value == null) return '—'; const points = Math.round(value * 100); return `${points > 0 ? '+' : ''}${points}` }
function csvCell(value) { const text = value == null ? '' : String(value); return `"${text.replaceAll('"', '""')}"` }
function safeFilename(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'flow5' }
function citationLabel(citation, index) { if (typeof citation === 'string') return citation; return citation?.title ?? citation?.filename ?? citation?.source ?? `Nguồn ${index + 1}` }
function Labeled({ children, label }) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label> }
function Meta({ label, value }) { return <div><dt className="text-xs font-bold uppercase tracking-[.1em] text-slate-500">{label}</dt><dd className="mt-1 font-bold tabular-nums text-slate-900">{value}</dd></div> }
function MetaLine({ label, value }) { return <div className="flex justify-between gap-4"><dt>{label}</dt><dd className="font-bold tabular-nums text-slate-900">{value}</dd></div> }
