import {
  CheckCircle2, ChevronLeft, ChevronRight, Clock3, CreditCard, Eye,
  Loader2, RefreshCw, Search, ShieldAlert, X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { AdminPageHeader } from '../../layouts/AdminLayout.jsx'
import { getAdminPayment, getAdminPayments } from '../../services/paymentService.js'

const statuses = ['', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED']

export default function AdminPaymentsPage() {
  const [filters, setFilters] = useState({ status: '', search: '', from: '', to: '', page: 0, size: 20 })
  const [result, setResult] = useState({ items: [], page: 0, totalPages: 0, totalElements: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setResult(await getAdminPayments(filters))
    } catch (requestError) {
      setError(requestError.message || 'Could not load payment orders.')
    } finally {
      setLoading(false)
    }
  }, [filters, reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function openDetail(orderId) {
    setDetailLoading(true)
    setError('')
    try {
      setDetail(await getAdminPayment(orderId))
    } catch (requestError) {
      setError(requestError.message || 'Could not load the payment audit.')
    } finally {
      setDetailLoading(false)
    }
  }

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value, page: name === 'page' ? value : 0 }))
  }

  return (
    <>
      <AdminPageHeader
        actions={<button className="flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-black text-slate-700 hover:bg-teal-50" onClick={() => setReloadKey((value) => value + 1)} type="button"><RefreshCw size={16} />Refresh</button>}
        description="Inspect VNPay orders and sanitized callback history. Secret keys are never included in this view."
        icon={CreditCard}
        title="Payments"
      />

      <section className="notebook-panel overflow-hidden">
        <div className="grid gap-3 border-b border-border p-4 md:grid-cols-[1.4fr_repeat(3,0.7fr)]">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-white px-3 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
            <Search className="text-slate-400" size={16} />
            <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" onChange={(event) => updateFilter('search', event.target.value)} placeholder="Txn ref, transaction no, email, or name" value={filters.search} />
          </label>
          <select className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-bold outline-none focus:border-teal-500" onChange={(event) => updateFilter('status', event.target.value)} value={filters.status}>
            {statuses.map((status) => <option key={status} value={status}>{status || 'All statuses'}</option>)}
          </select>
          <input aria-label="From date" className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-semibold outline-none focus:border-teal-500" onChange={(event) => updateFilter('from', event.target.value)} type="date" value={filters.from} />
          <input aria-label="To date" className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-semibold outline-none focus:border-teal-500" onChange={(event) => updateFilter('to', event.target.value)} type="date" value={filters.to} />
        </div>

        {error ? <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Gateway transaction</th><th className="w-16 px-3 py-3"><span className="sr-only">Detail</span></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? <tr><td className="px-4 py-14 text-center font-bold text-slate-500" colSpan="8"><Loader2 className="mr-2 inline animate-spin" size={17} />Loading orders...</td></tr> : null}
              {!loading && !result.items?.length ? <tr><td className="px-4 py-14 text-center font-bold text-slate-500" colSpan="8">No payment orders match these filters.</td></tr> : null}
              {!loading && result.items?.map((order) => (
                <tr className="hover:bg-slate-50" key={order.orderId}>
                  <td className="px-4 py-3"><p className="font-black text-slate-900">{order.txnRef}</p><p className="mt-0.5 max-w-48 truncate text-xs text-slate-500">{order.orderId}</p></td>
                  <td className="px-4 py-3"><p className="font-bold text-slate-800">{order.userFullName || 'Unknown'}</p><p className="mt-0.5 text-xs text-slate-500">{order.userEmail}</p></td>
                  <td className="px-4 py-3 font-black text-teal-800">{order.planCode}</td>
                  <td className="px-4 py-3 font-black text-slate-900">{formatVnd(order.amountVnd)}</td>
                  <td className="px-4 py-3"><PaymentBadge status={order.status} /></td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{order.gatewayTransactionNo || 'Not assigned'}</td>
                  <td className="px-3 py-3"><button aria-label={`Inspect ${order.txnRef}`} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-teal-50 hover:text-teal-700" onClick={() => openDetail(order.orderId)} type="button"><Eye size={17} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm font-semibold text-slate-600">
          <span>{result.totalElements || 0} orders</span>
          <div className="flex items-center gap-2">
            <button aria-label="Previous page" className="grid size-9 place-items-center rounded-lg border border-border bg-white disabled:opacity-40" disabled={filters.page <= 0 || loading} onClick={() => updateFilter('page', filters.page - 1)} type="button"><ChevronLeft size={16} /></button>
            <span>Page {(result.page || 0) + 1} of {Math.max(1, result.totalPages || 0)}</span>
            <button aria-label="Next page" className="grid size-9 place-items-center rounded-lg border border-border bg-white disabled:opacity-40" disabled={loading || filters.page + 1 >= result.totalPages} onClick={() => updateFilter('page', filters.page + 1)} type="button"><ChevronRight size={16} /></button>
          </div>
        </div>
      </section>

      {detailLoading ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35"><div className="rounded-xl bg-white px-5 py-4 font-bold shadow-xl"><Loader2 className="mr-2 inline animate-spin" size={18} />Loading audit...</div></div> : null}
      {detail ? <PaymentDetail detail={detail} onClose={() => setDetail(null)} /> : null}
    </>
  )
}

function PaymentDetail({ detail, onClose }) {
  const order = detail.order
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">Order audit</p><h2 className="mt-2 text-2xl font-black text-slate-950">{order.txnRef}</h2></div><button aria-label="Close" className="grid size-10 place-items-center rounded-xl hover:bg-slate-100" onClick={onClose} type="button"><X size={19} /></button></div>
        <dl className="mt-6 grid gap-4 rounded-xl bg-slate-50 p-5 sm:grid-cols-2">
          <AuditMeta label="Status" value={<PaymentBadge status={order.status} />} />
          <AuditMeta label="Amount" value={formatVnd(order.amountVnd)} />
          <AuditMeta label="Student" value={`${order.userFullName || ''} ${order.userEmail || ''}`.trim()} />
          <AuditMeta label="Plan duration" value={`${order.planCode} · ${order.durationDays} days`} />
          <AuditMeta label="Transaction no" value={order.gatewayTransactionNo || 'Not assigned'} />
          <AuditMeta label="Paid at" value={formatDate(order.paidAt)} />
        </dl>
        <h3 className="mt-8 text-lg font-black text-slate-950">Callback history</h3>
        {!detail.callbacks?.length ? <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500">No callbacks recorded.</p> : (
          <div className="mt-4 space-y-3">
            {detail.callbacks.map((callback) => <CallbackCard callback={callback} key={callback.callbackId} />)}
          </div>
        )}
      </aside>
    </div>
  )
}

function CallbackCard({ callback }) {
  let payload = callback.payloadJson
  try { payload = JSON.stringify(JSON.parse(callback.payloadJson), null, 2) } catch { /* keep sanitized raw value */ }
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2">{callback.checksumValid ? <CheckCircle2 className="text-emerald-600" size={18} /> : <ShieldAlert className="text-red-600" size={18} />}<strong>{callback.source}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black">RspCode {callback.merchantRspCode || 'N/A'}</span></div><time className="text-xs font-semibold text-slate-500">{formatDate(callback.receivedAt)}</time></div>
        <p className="mt-2 text-sm font-semibold text-slate-600">{callback.validationError || callback.merchantMessage || 'Validated callback'}</p>
      </summary>
      <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
        <AuditMeta label="Checksum" value={yesNo(callback.checksumValid)} />
        <AuditMeta label="Merchant" value={yesNo(callback.merchantValid)} />
        <AuditMeta label="Amount" value={yesNo(callback.amountValid)} />
        <AuditMeta label="Order state" value={yesNo(callback.orderStateValid)} />
        <AuditMeta label="Client IP" value={callback.clientIp || 'Unknown'} />
        <AuditMeta label="Gateway status" value={callback.gatewayTransactionStatus || 'N/A'} />
      </dl>
      <p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-500">Sanitized payload</p>
      <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">{payload || '{}'}</pre>
    </details>
  )
}

function AuditMeta({ label, value }) { return <div><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 break-words font-black text-slate-900">{value || 'N/A'}</dd></div> }
function PaymentBadge({ status }) { const tone = status === 'PAID' ? 'bg-emerald-50 text-emerald-700' : status === 'PENDING' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'; const Icon = status === 'PAID' ? CheckCircle2 : status === 'PENDING' ? Clock3 : ShieldAlert; return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${tone}`}><Icon size={13} />{status}</span> }
function yesNo(value) { return value === null || value === undefined ? 'Not checked' : value ? 'Valid' : 'Invalid' }
function formatVnd(value) { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0)) }
function formatDate(value) { return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) : 'N/A' }
