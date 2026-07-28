import { Activity, CheckCircle2, Gauge, Scale, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  buildDashboardKpis, buildGroundingChartData, buildLatencyChartData,
  buildOutcomeChartData, buildQualityChartData, buildScatterChartData,
} from './researchChartData.js'

const COLORS = {
  rag: '#0f766e',
  ragLight: '#99f6e4',
  fine: '#334155',
  tie: '#94a3b8',
  error: '#d97706',
  grid: '#e2e8f0',
  text: '#475569',
}

export function ResearchDashboardCharts({ comparison }) {
  const reduceMotion = useReducedMotion()
  const quality = useMemo(() => buildQualityChartData(comparison), [comparison])
  const grounding = useMemo(() => buildGroundingChartData(comparison), [comparison])
  const outcomes = useMemo(() => buildOutcomeChartData(comparison?.perQuestion), [comparison])
  const scatter = useMemo(() => buildScatterChartData(comparison?.perQuestion), [comparison])
  const latency = useMemo(() => buildLatencyChartData(comparison), [comparison])
  const kpis = useMemo(() => buildDashboardKpis(comparison), [comparison])

  return <section className="research-visual-dashboard" aria-labelledby="visual-dashboard-heading">
    <div className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-xl bg-teal-50 text-primary"><Activity size={19} /></div>
      <div><p className="text-xs font-bold uppercase tracking-[.13em] text-slate-500">01 · Dashboard thực nghiệm</p><h2 className="text-xl font-black text-slate-950" id="visual-dashboard-heading">Kết quả trực quan trên cùng dataset snapshot</h2></div>
    </div>

    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi icon={CheckCircle2} label="Mẫu hợp lệ" value={kpis.validLabel} />
      <Kpi icon={Scale} label="Chất lượng" value={kpis.qualityLabel} />
      <Kpi icon={Gauge} label="Tốc độ" value={kpis.latencyLabel} />
      <Kpi icon={ShieldCheck} label="Khả năng so sánh" value={kpis.compatibilityLabel} />
    </div>

    <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
      <ChartPanel className="xl:col-span-7" title="So sánh chất lượng" subtitle="Ba local proxy, đơn vị phần trăm; trục bắt đầu từ 0.">
        <ChartFrame label="Biểu đồ cột so sánh ba metric chất lượng giữa RAG và Fine-tuned">
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={quality} layout="vertical" margin={{ top: 12, right: 40, bottom: 8, left: 24 }}>
              <CartesianGrid horizontal={false} stroke={COLORS.grid} />
              <XAxis domain={[0, 100]} tickFormatter={percentTick} type="number" />
              <YAxis dataKey="metric" tick={{ fill: COLORS.text, fontSize: 12 }} type="category" width={104} />
              <Tooltip content={<PercentTooltip />} cursor={{ fill: '#f0fdfa' }} />
              <Legend iconType="square" />
              <Bar dataKey="rag" fill={COLORS.rag} isAnimationActive={!reduceMotion} name="RAG" radius={[0, 4, 4, 0]}><LabelList dataKey="rag" formatter={percentLabel} position="right" /></Bar>
              <Bar dataKey="fine" fill={COLORS.fine} isAnimationActive={!reduceMotion} name="Fine-tuned" radius={[0, 4, 4, 0]}><LabelList dataKey="fine" formatter={percentLabel} position="right" /></Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
        <p className="mt-2 text-xs leading-5 text-slate-500">Ba chỉ số hiện cùng dựa trên token overlap; không xem đây là ba bằng chứng độc lập.</p>
        <AccessibleTable rows={quality} columns={[['metric', 'Chỉ số'], ['rag', 'RAG (%)'], ['fine', 'Fine-tuned (%)']]} />
      </ChartPanel>

      <ChartPanel className="xl:col-span-5" title="Độ tin cậy nguồn RAG" subtitle="Chỉ đánh giá pipeline có retrieval context.">
        <ChartFrame label="Biểu đồ cột ngang ba metric grounding của RAG">
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={grounding} layout="vertical" margin={{ top: 12, right: 44, bottom: 8, left: 30 }}>
              <CartesianGrid horizontal={false} stroke={COLORS.grid} />
              <XAxis domain={[0, 100]} tickFormatter={percentTick} type="number" />
              <YAxis dataKey="metric" tick={{ fill: COLORS.text, fontSize: 12 }} type="category" width={112} />
              <Tooltip content={<PercentTooltip single />} cursor={{ fill: '#f0fdfa' }} />
              <Bar dataKey="value" fill={COLORS.rag} isAnimationActive={!reduceMotion} name="RAG" radius={[0, 4, 4, 0]}><LabelList dataKey="value" formatter={percentLabel} position="right" /></Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
        <p className="mt-2 text-xs leading-5 text-slate-500">Fine-tuned không xuất hiện vì không truy xuất tài liệu và không có context để chấm.</p>
        <AccessibleTable rows={grounding} columns={[['metric', 'Chỉ số'], ['value', 'RAG (%)']]} />
      </ChartPanel>

      <ChartPanel className="xl:col-span-12" title={`Kết quả theo ${outcomes.total} câu`} subtitle="Mỗi câu được xếp theo correctness delta; chênh lệch dưới 2 điểm % được xem là gần tương đương.">
        <ChartFrame compact label="Biểu đồ thanh xếp chồng tỷ lệ câu RAG tốt hơn, Fine-tuned tốt hơn, gần tương đương và có lỗi">
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={outcomes.chartData} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <XAxis domain={[0, 100]} hide type="number" />
              <YAxis dataKey="name" hide type="category" />
              <Tooltip content={<OutcomeTooltip counts={outcomes.counts} />} cursor={false} />
              <Bar dataKey="rag" fill={COLORS.rag} isAnimationActive={!reduceMotion} name="RAG tốt hơn" stackId="outcome"><LabelList className="research-outcome-label-light" formatter={(value) => segmentLabel(value, outcomes.counts.rag)} position="center" /></Bar>
              <Bar dataKey="fine" fill={COLORS.fine} isAnimationActive={!reduceMotion} name="Fine-tuned tốt hơn" stackId="outcome"><LabelList className="research-outcome-label-light" formatter={(value) => segmentLabel(value, outcomes.counts.fine)} position="center" /></Bar>
              <Bar dataKey="tie" fill={COLORS.tie} isAnimationActive={!reduceMotion} name="Gần tương đương" stackId="outcome"><LabelList className="research-outcome-label-dark" formatter={(value) => segmentLabel(value, outcomes.counts.tie)} position="center" /></Bar>
              <Bar dataKey="error" fill={COLORS.error} isAnimationActive={!reduceMotion} name="Có lỗi" radius={[0, 6, 6, 0]} stackId="outcome"><LabelList className="research-outcome-label-light" formatter={(value) => segmentLabel(value, outcomes.counts.error)} position="center" /></Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
        <OutcomeLegend outcomes={outcomes} />
      </ChartPanel>

      <ChartPanel className="xl:col-span-8" title="So sánh correctness từng câu" subtitle={`${scatter.points.length} mẫu hợp lệ; ${scatter.omittedCount} mẫu thiếu metric hoặc có lỗi bị loại khỏi scatter.`}>
        {scatter.points.length >= 8 ? <>
          <ChartFrame tall label="Biểu đồ phân tán correctness RAG trên trục ngang và Fine-tuned trên trục dọc">
            <ResponsiveContainer height="100%" width="100%">
              <ScatterChart margin={{ top: 18, right: 24, bottom: 20, left: 6 }}>
                <CartesianGrid stroke={COLORS.grid} />
                <XAxis dataKey="rag" domain={[0, 100]} name="RAG" tickFormatter={percentTick} type="number" unit="%" />
                <YAxis dataKey="fine" domain={[0, 100]} name="Fine-tuned" tickFormatter={percentTick} type="number" unit="%" width={54} />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]} stroke={COLORS.tie} strokeDasharray="5 5" />
                <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={scatter.points} fill={COLORS.rag} isAnimationActive={!reduceMotion} name="Câu hỏi" />
              </ScatterChart>
            </ResponsiveContainer>
          </ChartFrame>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500"><span>Trên đường chéo: Fine-tuned tốt hơn</span><span>Dưới đường chéo: RAG tốt hơn</span></div>
        </> : <ChartInsufficient count={scatter.points.length} />}
      </ChartPanel>

      <ChartPanel className="xl:col-span-4" title="Thời gian phản hồi" subtitle="Latency hiệu dụng trung bình mỗi câu; thấp hơn tốt hơn.">
        <ChartFrame tall label="Biểu đồ cột latency trung bình của RAG và Fine-tuned">
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={latency} margin={{ top: 18, right: 18, bottom: 8, left: 6 }}>
              <CartesianGrid vertical={false} stroke={COLORS.grid} />
              <XAxis dataKey="model" tick={{ fill: COLORS.text, fontSize: 12 }} />
              <YAxis domain={[0, 'auto']} tickFormatter={millisecondTick} width={58} />
              <Tooltip content={<LatencyTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="latency" isAnimationActive={!reduceMotion} name="Latency" radius={[5, 5, 0, 0]}>
                {latency.map((entry) => <Cell fill={entry.model === 'RAG' ? COLORS.rag : COLORS.fine} key={entry.model} />)}
                <LabelList dataKey="latency" formatter={(value) => `${Math.round(value)} ms`} position="top" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
        <AccessibleTable rows={latency} columns={[['model', 'Model'], ['latency', 'Latency (ms)']]} />
      </ChartPanel>
    </div>
  </section>
}

function Kpi({ icon: Icon, label, value }) { return <div className="rounded-xl border border-slate-200 bg-white/80 p-4"><div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Icon className="text-primary" size={15} />{label}</div><p className="mt-2 text-base font-black tabular-nums text-slate-950">{value}</p></div> }
function ChartPanel({ children, className = '', subtitle, title }) { return <figure aria-label={title} className={`research-chart rounded-2xl border border-slate-200 bg-white/80 p-4 sm:p-5 ${className}`}><figcaption><h3 className="font-black text-slate-950">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p></figcaption><div className="mt-3">{children}</div></figure> }
function ChartFrame({ children, compact = false, label, tall = false }) { return <div aria-label={label} className={`research-chart-frame w-full ${compact ? 'h-24' : tall ? 'h-80 sm:h-96' : 'h-72 sm:h-80'}`} role="img">{children}</div> }
function ChartInsufficient({ count }) { return <div className="grid min-h-72 place-items-center rounded-xl bg-slate-50 p-6 text-center"><div><p className="font-bold text-slate-700">Chưa đủ mẫu để vẽ scatter</p><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Hiện có {count} mẫu hợp lệ; cần ít nhất 8 để biểu đồ thể hiện quan hệ đáng tin cậy. Dữ liệu vẫn có trong bảng chi tiết.</p></div></div> }
function AccessibleTable({ columns, rows }) { return <table className="sr-only"><caption>Dữ liệu dùng cho biểu đồ</caption><thead><tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(([key]) => <td key={key}>{row[key] ?? 'Không có dữ liệu'}</td>)}</tr>)}</tbody></table> }
function OutcomeLegend({ outcomes }) { const items = [['rag', 'RAG tốt hơn', COLORS.rag], ['fine', 'Fine-tuned tốt hơn', COLORS.fine], ['tie', 'Gần tương đương', COLORS.tie], ['error', 'Có lỗi', COLORS.error]]; return <ul className="mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">{items.map(([key, label, color]) => <li className="flex items-center gap-2" key={key}><span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} /><span className="text-slate-600">{label}</span><strong className="ml-auto tabular-nums">{outcomes.counts[key]} · {outcomes.percentages[key]}%</strong></li>)}</ul> }

function PercentTooltip({ active, label, payload, single = false }) { if (!active || !payload?.length) return null; return <TooltipBox title={label}>{payload.map((item) => <TooltipLine color={item.color} key={item.dataKey} label={single ? 'RAG' : item.name} value={`${item.value ?? '—'}%`} />)}</TooltipBox> }
function OutcomeTooltip({ active, counts, payload }) { if (!active || !payload?.length) return null; return <TooltipBox title="Phân loại câu hỏi">{payload.map((item) => <TooltipLine color={item.color} key={item.dataKey} label={item.name} value={`${counts[item.dataKey]} câu · ${item.value}%`} />)}</TooltipBox> }
function ScatterTooltip({ active, payload }) { const point = payload?.[0]?.payload; if (!active || !point) return null; return <TooltipBox title={`Câu ${point.index}`}><p className="max-w-64 text-xs leading-5 text-slate-600">{point.question}</p><TooltipLine color={COLORS.rag} label="RAG" value={`${point.rag}%`} /><TooltipLine color={COLORS.fine} label="Fine-tuned" value={`${point.fine}%`} /><TooltipLine color={COLORS.tie} label="Chênh lệch" value={`${point.delta > 0 ? '+' : ''}${point.delta} điểm %`} /></TooltipBox> }
function LatencyTooltip({ active, payload }) { const item = payload?.[0]; if (!active || !item) return null; return <TooltipBox title={item.payload.model}><TooltipLine color={item.payload.model === 'RAG' ? COLORS.rag : COLORS.fine} label="Latency" value={`${Math.round(item.value)} ms`} /></TooltipBox> }
function TooltipBox({ children, title }) { return <div className="chart-tooltip rounded-lg border border-slate-200 bg-white p-3 shadow-xl"><p className="mb-2 text-xs font-black text-slate-900">{title}</p>{children}</div> }
function TooltipLine({ color, label, value }) { return <div className="mt-1 flex min-w-36 items-center gap-2 text-xs"><span className="size-2 rounded-sm" style={{ backgroundColor: color }} /><span className="text-slate-500">{label}</span><strong className="ml-auto tabular-nums text-slate-900">{value}</strong></div> }

function useReducedMotion() { const [reduced, setReduced] = useState(false); useEffect(() => { const query = window.matchMedia?.('(prefers-reduced-motion: reduce)'); if (!query) return undefined; const update = () => setReduced(query.matches); update(); query.addEventListener?.('change', update); return () => query.removeEventListener?.('change', update) }, []); return reduced }
function percentTick(value) { return `${value}%` }
function percentLabel(value) { return value == null ? '—' : `${value}%` }
function millisecondTick(value) { return value >= 1000 ? `${Math.round(value / 100) / 10}s` : `${value}ms` }
function segmentLabel(value, count) { return value >= 8 ? `${count} (${value}%)` : '' }
