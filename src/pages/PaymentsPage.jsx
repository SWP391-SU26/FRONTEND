import {
  CheckCircle2, ChevronLeft, ChevronRight, Clock3, CreditCard, Eye,
  Loader2, ReceiptText, RefreshCw, ShieldAlert, Sparkles, X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import StudentShell from '../components/StudentShell.jsx'
import { useLocale } from '../i18n/LocaleContext.jsx'
import { getMyPayments, getSubscription } from '../services/paymentService.js'

const statuses = ['', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED']

const copy = {
  vi: {
    title: 'Lịch sử thanh toán', subtitle: 'Theo dõi đơn hàng VNPay, trạng thái kích hoạt và thời hạn gói của bạn.',
    current: 'Gói hiện tại', activeUntil: 'Hiệu lực đến', noExpiry: 'Không giới hạn', remaining: 'ngày còn lại',
    upgrade: 'Xem các gói', all: 'Tất cả trạng thái', refresh: 'Tải lại', order: 'Đơn hàng', plan: 'Gói',
    amount: 'Số tiền', status: 'Trạng thái', created: 'Ngày tạo', paid: 'Thanh toán lúc', gateway: 'Mã VNPay',
    empty: 'Bạn chưa có giao dịch nào phù hợp.', loadError: 'Không thể tải lịch sử thanh toán.',
    loading: 'Đang tải giao dịch...', orders: 'giao dịch', page: 'Trang', of: '/', detail: 'Chi tiết giao dịch',
    duration: 'Thời hạn gói', expires: 'Hạn thanh toán', activated: 'Kích hoạt lúc', days: 'ngày', close: 'Đóng',
  },
  en: {
    title: 'Payment history', subtitle: 'Track VNPay orders, activation status, and your plan period.',
    current: 'Current plan', activeUntil: 'Active until', noExpiry: 'No expiry', remaining: 'days remaining',
    upgrade: 'View plans', all: 'All statuses', refresh: 'Refresh', order: 'Order', plan: 'Plan',
    amount: 'Amount', status: 'Status', created: 'Created', paid: 'Paid at', gateway: 'VNPay transaction',
    empty: 'No payment orders match this view.', loadError: 'Could not load payment history.',
    loading: 'Loading payments...', orders: 'orders', page: 'Page', of: 'of', detail: 'Payment detail',
    duration: 'Plan duration', expires: 'Payment expiry', activated: 'Activated at', days: 'days', close: 'Close',
  },
}

export default function PaymentsPage() {
  const { locale } = useLocale()
  const c = copy[locale] || copy.vi
  const [filter, setFilter] = useState({ status: '', page: 0, size: 10 })
  const [result, setResult] = useState({ items: [], page: 0, totalPages: 0, totalElements: 0 })
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [payments, current] = await Promise.all([getMyPayments(filter), getSubscription()])
      setResult(payments)
      setSubscription(current)
    } catch (requestError) {
      setError(requestError.message || c.loadError)
    } finally {
      setLoading(false)
    }
  }, [c.loadError, filter])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const remainingDays = useMemo(() => daysRemaining(subscription?.expiresAt), [subscription?.expiresAt])

  function changeStatus(status) {
    setFilter((current) => ({ ...current, status, page: 0 }))
  }

  return (
    <StudentShell mobileTitle={c.title}>
      <main className="min-h-dvh bg-[#f7faf9] px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.17em] text-teal-700"><ReceiptText size={15} />VNPay</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{c.title}</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">{c.subtitle}</p>
            </div>
            <div className="flex gap-2">
              <Link className="flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-black text-white hover:bg-teal-800" to="/pro"><Sparkles size={16} />{c.upgrade}</Link>
              <button aria-label={c.refresh} className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-teal-50 hover:text-teal-700" onClick={load} type="button"><RefreshCw size={16} /></button>
            </div>
          </header>

          <section className="mt-6 grid gap-4 md:grid-cols-[1.3fr_1fr_1fr]">
            <SummaryCard icon={CreditCard} label={c.current} value={subscription?.effectivePlanCode || 'FREE'} />
            <SummaryCard icon={Clock3} label={c.activeUntil} value={subscription?.expiresAt ? formatDate(subscription.expiresAt, locale) : c.noExpiry} />
            <SummaryCard icon={CheckCircle2} label={c.remaining} value={subscription?.expiresAt ? String(remainingDays) : '∞'} />
          </section>

          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
              <select className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-teal-500" onChange={(event) => changeStatus(event.target.value)} value={filter.status}>
                {statuses.map((status) => <option key={status} value={status}>{status || c.all}</option>)}
              </select>
              <span className="text-sm font-semibold text-slate-500">{result.totalElements || 0} {c.orders}</span>
            </div>

            {error ? <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div> : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-3">{c.order}</th><th className="px-4 py-3">{c.plan}</th><th className="px-4 py-3">{c.amount}</th><th className="px-4 py-3">{c.status}</th><th className="px-4 py-3">{c.created}</th><th className="px-4 py-3">{c.gateway}</th><th className="w-16 px-3 py-3"><span className="sr-only">{c.detail}</span></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? <tr><td className="px-4 py-14 text-center font-bold text-slate-500" colSpan="7"><Loader2 className="mr-2 inline animate-spin" size={17} />{c.loading}</td></tr> : null}
                  {!loading && !result.items?.length ? <tr><td className="px-4 py-14 text-center font-bold text-slate-500" colSpan="7">{c.empty}</td></tr> : null}
                  {!loading && result.items?.map((order) => (
                    <tr className="hover:bg-slate-50" key={order.orderId}>
                      <td className="px-4 py-3"><p className="font-black text-slate-900">{order.txnRef}</p><p className="mt-0.5 max-w-56 truncate text-xs text-slate-400">{order.orderId}</p></td>
                      <td className="px-4 py-3 font-black text-teal-800">{order.planCode}</td>
                      <td className="px-4 py-3 font-black text-slate-900">{formatVnd(order.amountVnd, locale)}</td>
                      <td className="px-4 py-3"><PaymentBadge status={order.status} /></td>
                      <td className="px-4 py-3 font-semibold text-slate-600">{formatDate(order.createdAt, locale)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{order.gatewayTransactionNo || '—'}</td>
                      <td className="px-3 py-3"><button aria-label={`${c.detail}: ${order.txnRef}`} className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-teal-50 hover:text-teal-700" onClick={() => setDetail(order)} type="button"><Eye size={17} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600">
              <button aria-label="Previous page" className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white disabled:opacity-40" disabled={filter.page <= 0 || loading} onClick={() => setFilter((current) => ({ ...current, page: current.page - 1 }))} type="button"><ChevronLeft size={16} /></button>
              <span>{c.page} {(result.page || 0) + 1} {c.of} {Math.max(1, result.totalPages || 0)}</span>
              <button aria-label="Next page" className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white disabled:opacity-40" disabled={loading || filter.page + 1 >= result.totalPages} onClick={() => setFilter((current) => ({ ...current, page: current.page + 1 }))} type="button"><ChevronRight size={16} /></button>
            </div>
          </section>
        </div>
      </main>
      {detail ? <PaymentDetail copy={c} locale={locale} onClose={() => setDetail(null)} order={detail} /> : null}
    </StudentShell>
  )
}

function SummaryCard({ icon: Icon, label, value }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5"><span className="grid size-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon size={19} /></span><p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-slate-950">{value}</p></article>
}

function PaymentDetail({ copy: c, locale, onClose, order }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">{c.detail}</p><h2 className="mt-2 break-all text-xl font-black text-slate-950">{order.txnRef}</h2></div><button aria-label={c.close} className="grid size-10 shrink-0 place-items-center rounded-xl hover:bg-slate-100" onClick={onClose} type="button"><X size={19} /></button></div>
        <dl className="mt-6 grid gap-5 rounded-2xl bg-slate-50 p-5 sm:grid-cols-2">
          <Meta label={c.status} value={<PaymentBadge status={order.status} />} />
          <Meta label={c.amount} value={formatVnd(order.amountVnd, locale)} />
          <Meta label={c.plan} value={order.planCode} />
          <Meta label={c.duration} value={`${order.durationDays} ${c.days}`} />
          <Meta label={c.created} value={formatDate(order.createdAt, locale)} />
          <Meta label={c.expires} value={formatDate(order.expiresAt, locale)} />
          <Meta label={c.paid} value={formatDate(order.paidAt, locale)} />
          <Meta label={c.activated} value={formatDate(order.activatedAt, locale)} />
          <Meta label={c.gateway} value={order.gatewayTransactionNo || '—'} />
          <Meta label="Bank" value={order.bankCode || '—'} />
        </dl>
      </aside>
    </div>
  )
}

function Meta({ label, value }) { return <div><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 break-words font-black text-slate-900">{value || '—'}</dd></div> }
function PaymentBadge({ status }) { const paid = status === 'PAID'; const pending = status === 'PENDING'; const Icon = paid ? CheckCircle2 : pending ? Clock3 : ShieldAlert; const tone = paid ? 'bg-emerald-50 text-emerald-700' : pending ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'; return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${tone}`}><Icon size={13} />{status}</span> }
function daysRemaining(value) { if (!value) return 0; return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)) }
function formatVnd(value, locale) { return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0)) }
function formatDate(value, locale) { return value ? new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—' }
