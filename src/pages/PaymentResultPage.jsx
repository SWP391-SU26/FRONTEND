import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import StudentShell from '../components/StudentShell.jsx'
import { useLocale } from '../i18n/LocaleContext.jsx'
import { getPaymentOrder } from '../services/paymentService.js'

const terminalStatuses = new Set(['PAID', 'FAILED', 'EXPIRED', 'CANCELLED'])
const statusCopy = {
  vi: {
    PAID: ['Thanh toán thành công', 'Gói trả phí đã được kích hoạt trên tài khoản của bạn.'],
    PENDING: ['Đang xác nhận thanh toán', 'Hệ thống đang kiểm tra callback đã ký từ VNPay. Bạn có thể kiểm tra lại sau vài giây.'],
    FAILED: ['Thanh toán thất bại', 'Giao dịch không thành công và gói PRO chưa được kích hoạt.'],
    EXPIRED: ['Giao dịch đã hết hạn', 'Order đã quá thời gian thanh toán và không thể kích hoạt PRO.'],
    CANCELLED: ['Bạn đã hủy thanh toán', 'Không có khoản thời gian PRO nào được cộng vào tài khoản.'],
    INVALID: ['Không thể xác minh đường dẫn trả về', 'Thông tin trả về không hợp lệ. Trạng thái tài khoản không bị thay đổi.'],
    ERROR: ['Không thể đọc trạng thái', 'Vui lòng thử kiểm tra lại sau ít phút.'],
    checking: 'Đang kiểm tra với hệ thống...', checkAgain: 'Kiểm tra lại', back: 'Về trang gói PRO', workspace: 'Đến Workspace',
    order: 'Mã order', txn: 'Mã giao dịch', amount: 'Số tiền', created: 'Tạo lúc', paid: 'Thanh toán lúc',
    note: 'Trạng thái chỉ thay đổi sau khi backend xác minh chữ ký, merchant, số tiền và mã giao dịch từ VNPay.',
  },
  en: {
    PAID: ['Payment successful', 'Your paid plan has been activated.'],
    PENDING: ['Confirming payment', 'The system is validating a signed callback from VNPay. You can check again in a few seconds.'],
    FAILED: ['Payment failed', 'The transaction was unsuccessful and PRO was not activated.'],
    EXPIRED: ['Transaction expired', 'This order passed its payment window and cannot activate PRO.'],
    CANCELLED: ['Payment cancelled', 'No PRO time was added to your account.'],
    INVALID: ['Return link could not be verified', 'The return data is invalid. Your account status was not changed.'],
    ERROR: ['Status unavailable', 'Please check again in a few minutes.'],
    checking: 'Checking with the system...', checkAgain: 'Check again', back: 'Back to PRO plans', workspace: 'Open Workspace',
    order: 'Order ID', txn: 'Transaction reference', amount: 'Amount', created: 'Created', paid: 'Paid',
    note: 'Status changes only after the backend validates VNPay signature, merchant, amount, and transaction codes.',
  },
}

export default function PaymentResultPage() {
  const { locale } = useLocale()
  const c = statusCopy[locale] || statusCopy.vi
  const [params] = useSearchParams()
  const orderId = params.get('orderId')
  const invalidReturn = params.get('returnStatus') === 'invalid'
  const [order, setOrder] = useState(null)
  const [status, setStatus] = useState(invalidReturn || !orderId ? 'INVALID' : 'PENDING')
  const [checking, setChecking] = useState(Boolean(orderId && !invalidReturn))
  const attempts = useRef(0)

  const refresh = useCallback(async () => {
    if (!orderId || invalidReturn) return 'INVALID'
    setChecking(true)
    try {
      const nextOrder = await getPaymentOrder(orderId)
      setOrder(nextOrder)
      const nextStatus = nextOrder.status || 'PENDING'
      setStatus(nextStatus)
      return nextStatus
    } catch {
      setStatus('ERROR')
      return 'ERROR'
    } finally {
      setChecking(false)
    }
  }, [invalidReturn, orderId])

  useEffect(() => {
    if (!orderId || invalidReturn) return undefined
    let active = true
    let timer
    async function poll() {
      attempts.current += 1
      const nextStatus = await refresh()
      if (!active || terminalStatuses.has(nextStatus) || attempts.current >= 30) return
      timer = window.setTimeout(poll, 2000)
    }
    poll()
    return () => { active = false; window.clearTimeout(timer) }
  }, [invalidReturn, orderId, refresh])

  const displayStatus = terminalStatuses.has(status) || ['INVALID', 'ERROR'].includes(status) ? status : 'PENDING'
  const [title, description] = c[displayStatus]
  const visual = useMemo(() => statusVisual(displayStatus), [displayStatus])
  const Icon = visual.icon

  return (
    <StudentShell mobileTitle={title}>
      <main className="grid min-h-dvh place-items-center bg-[#f7faf9] px-4 py-10">
        <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-950/5">
          <div className={`h-2 ${visual.bar}`} />
          <div className="p-6 sm:p-9">
            <div className={`grid size-14 place-items-center rounded-2xl ${visual.tone}`}><Icon className={displayStatus === 'PENDING' ? 'animate-pulse' : ''} size={27} /></div>
            <h1 className="mt-6 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-xl text-sm font-medium leading-7 text-slate-600 sm:text-base">{description}</p>

            {order ? (
              <dl className="mt-7 grid gap-x-6 gap-y-4 rounded-xl bg-slate-50 p-5 text-sm sm:grid-cols-2">
                <Meta label={c.order} value={order.orderId} />
                <Meta label={c.txn} value={order.txnRef} />
                <Meta label={c.amount} value={formatVnd(order.amountVnd, locale)} />
                <Meta label={c.created} value={formatDate(order.createdAt, locale)} />
                {order.paidAt ? <Meta label={c.paid} value={formatDate(order.paidAt, locale)} /> : null}
              </dl>
            ) : null}

            <p className="mt-5 flex items-start gap-2 text-xs font-semibold leading-5 text-slate-500"><AlertTriangle className="mt-0.5 shrink-0" size={15} />{c.note}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {displayStatus === 'PENDING' || displayStatus === 'ERROR' ? <button className="flex h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-black text-white hover:bg-teal-800 disabled:opacity-60" disabled={checking} onClick={refresh} type="button">{checking ? <><Loader2 className="animate-spin" size={16} />{c.checking}</> : <><RefreshCw size={16} />{c.checkAgain}</>}</button> : null}
              <Link className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-black text-slate-700 hover:bg-slate-50" to="/pro"><ArrowLeft size={16} />{c.back}</Link>
              {displayStatus === 'PAID' ? <Link className="flex h-11 items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-5 text-sm font-black text-teal-800 hover:bg-teal-100" to="/workspace">{c.workspace}</Link> : null}
            </div>
          </div>
        </section>
      </main>
    </StudentShell>
  )
}

function Meta({ label, value }) { return <div className="min-w-0"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="mt-1 truncate font-black text-slate-900" title={String(value)}>{value}</dd></div> }
function statusVisual(status) {
  if (status === 'PAID') return { icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500' }
  if (status === 'PENDING') return { icon: Clock3, tone: 'bg-amber-50 text-amber-700', bar: 'bg-amber-400' }
  return { icon: XCircle, tone: 'bg-red-50 text-red-700', bar: 'bg-red-500' }
}
function formatVnd(value, locale) { return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0)) }
function formatDate(value, locale) { return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
