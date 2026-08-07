import {
  AlertTriangle, ArrowRight, Loader2, MessageSquareWarning, RefreshCw, ThumbsUp, X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { AdminPageHeader } from '../../layouts/AdminLayout.jsx'
import { getDatasets } from '../../services/evaluationService.js'
import {
  getFeedbackStats, getNegativeFeedback, promoteFeedback,
} from '../../services/feedbackService.js'

const REASON_LABELS = {
  WRONG_INFORMATION: 'Wrong information',
  MISSING_CITATION: 'Missing citation',
  OFF_TOPIC: 'Off topic',
  TOO_SLOW: 'Too slow',
  OTHER: 'Other',
}

/**
 * Closes the FR-09 loop: shows what users think of the answers, and turns the
 * answers they rejected into evaluation questions so the next benchmark run
 * measures exactly the cases that failed in production.
 */
export default function AdminFeedbackPage() {
  const [stats, setStats] = useState(null)
  const [negative, setNegative] = useState({ items: [], totalNegative: 0 })
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [promoting, setPromoting] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [statsResult, negativeResult] = await Promise.all([
        getFeedbackStats(),
        getNegativeFeedback({ limit: 20 }),
      ])
      setStats(statsResult)
      setNegative(negativeResult ?? { items: [], totalNegative: 0 })
    } catch (requestError) {
      setError(requestError.message || 'Could not load answer feedback.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  // Datasets are only needed once the reviewer decides to promote something, so
  // a failure here must not block the statistics from rendering.
  useEffect(() => {
    let active = true
    getDatasets()
      .then((items) => active && setDatasets(Array.isArray(items) ? items : []))
      .catch(() => active && setDatasets([]))
    return () => { active = false }
  }, [])

  async function confirmPromotion() {
    if (!promoting?.datasetId) {
      setPromoting((current) => ({ ...current, error: 'Pick a dataset first.' }))
      return
    }
    if (!promoting.groundTruthAnswer.trim()) {
      setPromoting((current) => ({ ...current, error: 'Write the answer this question should have had.' }))
      return
    }
    setPromoting((current) => ({ ...current, busy: true, error: '' }))
    try {
      const result = await promoteFeedback(promoting.item.feedbackId, {
        datasetId: promoting.datasetId,
        questionText: promoting.questionText,
        groundTruthAnswer: promoting.groundTruthAnswer,
      })
      setPromoting(null)
      setNotice(`Added as question #${result.questionNo} in the dataset.`)
      await load()
    } catch (requestError) {
      setPromoting((current) => ({
        ...current,
        busy: false,
        error: requestError.message || 'Could not add this question to the dataset.',
      }))
    }
  }

  const helpfulPercent = stats?.helpfulRate == null ? null : Math.round(stats.helpfulRate * 100)

  return (
    <div>
      <AdminPageHeader
        actions={(
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={load}
            type="button"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        )}
        description="What students think of the AI answers, and the rejected answers worth turning into benchmark cases."
        icon={MessageSquareWarning}
        title="Answer feedback"
      />

      {error ? (
        <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p>
      ) : null}
      {notice ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" /> Loading feedback...
        </p>
      ) : (
        <>
          <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total ratings" value={stats?.total ?? 0} />
            <StatCard
              label="Helpful rate"
              tone={helpfulPercent != null && helpfulPercent < 60 ? 'warn' : 'good'}
              value={helpfulPercent == null ? 'No data yet' : `${helpfulPercent}%`}
            />
            <StatCard label="Marked not helpful" tone="warn" value={stats?.notHelpfulCount ?? 0} />
            <StatCard label="Promoted to datasets" value={stats?.promotedCount ?? 0} />
          </section>

          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">Why answers were rejected</h2>
            <ReasonBreakdown byReason={stats?.byReason} total={stats?.notHelpfulCount ?? 0} />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Rejected answers ({negative.totalNegative})
              </h2>
              <span className="text-xs text-slate-500">Newest first, last 30 days</span>
            </div>

            {negative.items.length === 0 ? (
              <p className="flex items-center gap-2 py-6 text-sm text-slate-500">
                <ThumbsUp size={15} /> No rejected answers in this period.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {negative.items.map((item) => (
                  <NegativeRow
                    item={item}
                    key={item.feedbackId}
                    onPromote={() => setPromoting({
                      item,
                      datasetId: datasets[0]?.datasetId ?? '',
                      questionText: item.questionText ?? '',
                      groundTruthAnswer: '',
                      busy: false,
                      error: '',
                    })}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {promoting ? (
        <PromoteDialog
          datasets={datasets}
          onCancel={() => setPromoting(null)}
          onChange={(patch) => setPromoting((current) => ({ ...current, ...patch, error: '' }))}
          onConfirm={confirmPromotion}
          state={promoting}
        />
      ) : null}
    </div>
  )
}

function StatCard({ label, tone = 'neutral', value }) {
  const toneClass = {
    good: 'text-emerald-700',
    warn: 'text-amber-700',
    neutral: 'text-slate-900',
  }[tone]
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

function ReasonBreakdown({ byReason, total }) {
  const entries = Object.entries(byReason ?? {})
  if (entries.length === 0 || total === 0) {
    return <p className="mt-3 text-sm text-slate-500">No negative feedback yet.</p>
  }
  return (
    <ul className="mt-3 space-y-2.5">
      {entries.map(([code, count]) => (
        <li className="flex items-center gap-3" key={code}>
          <span className="w-40 shrink-0 text-sm text-slate-600">{REASON_LABELS[code] ?? code}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <span
              className="block h-full rounded-full bg-teal-600"
              style={{ width: `${total ? Math.round((count / total) * 100) : 0}%` }}
            />
          </span>
          <span className="w-8 shrink-0 text-right text-sm tabular-nums text-slate-700">{count}</span>
        </li>
      ))}
    </ul>
  )
}

function NegativeRow({ item, onPromote }) {
  const promoted = Boolean(item.promotedQuestionId)
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-medium text-amber-700">
            <AlertTriangle size={13} />
            {REASON_LABELS[item.reasonCode] ?? item.reasonCode ?? 'No reason given'}
          </p>
          <p className="mt-1.5 truncate text-sm font-semibold text-slate-900">
            {item.questionText || 'Original question unavailable'}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.answerText}</p>
          {item.comment ? (
            <p className="mt-1.5 border-l-2 border-slate-200 pl-2.5 text-sm italic text-slate-500">
              {item.comment}
            </p>
          ) : null}
        </div>
        {promoted ? (
          <span className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700">
            In dataset
          </span>
        ) : (
          <button
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800"
            disabled={!item.questionText}
            onClick={onPromote}
            type="button"
          >
            Add to dataset <ArrowRight size={13} />
          </button>
        )}
      </div>
    </li>
  )
}

function PromoteDialog({ datasets, onCancel, onChange, onConfirm, state }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 px-4">
      <div
        aria-labelledby="promote-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900" id="promote-title">
              Add to evaluation dataset
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              The next benchmark run will score this question against the expected answer.
            </p>
          </div>
          <button
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
            onClick={onCancel}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="promote-dataset">
          Dataset
        </label>
        <select
          className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          id="promote-dataset"
          onChange={(event) => onChange({ datasetId: event.target.value })}
          value={state.datasetId}
        >
          <option value="">Select a dataset</option>
          {datasets.map((dataset) => (
            <option key={dataset.datasetId} value={dataset.datasetId}>
              {dataset.datasetName}
            </option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="promote-question">
          Question
        </label>
        <textarea
          className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm"
          id="promote-question"
          onChange={(event) => onChange({ questionText: event.target.value })}
          rows={2}
          value={state.questionText}
        />

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="promote-truth">
          Expected answer
        </label>
        <textarea
          className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm"
          id="promote-truth"
          onChange={(event) => onChange({ groundTruthAnswer: event.target.value })}
          placeholder="What the assistant should have answered"
          rows={4}
          value={state.groundTruthAnswer}
        />

        {state.error ? (
          <p className="mt-3 text-sm text-rose-600" role="alert">{state.error}</p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            disabled={state.busy}
            onClick={onConfirm}
            type="button"
          >
            {state.busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Add question
          </button>
        </div>
      </div>
    </div>
  )
}
