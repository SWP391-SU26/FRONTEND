import {
  ArrowRight, Check, Clock3, Crown, FileText, HardDrive,
  Loader2, RefreshCw, ShieldCheck, Sparkles, WalletCards, Workflow,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import StudentShell from '../components/StudentShell.jsx'
import { useLocale } from '../i18n/LocaleContext.jsx'
import {
  createVnpayOrder, getPlans, getSubscription, getSubscriptionHistory,
} from '../services/paymentService.js'

const copy = {
  vi: {
    eyebrow: 'Gói tài khoản', title: 'Nhiều không gian hơn cho việc học nghiêm túc.',
    subtitle: 'Giá, thời hạn và hạn mức bên dưới được đọc trực tiếp từ hệ thống. Mỗi tài khoản chỉ được dùng một gói trả phí tại một thời điểm.',
    current: 'Gói hiện tại', expires: 'Hết hạn', noExpiry: 'Không giới hạn thời gian', active: 'Đang hoạt động',
    choose: 'Đăng ký', availableAfter: 'Đăng ký lại sau', redirecting: 'Đang tạo giao dịch...', included: 'Quyền lợi',
    file: 'mỗi tệp', storage: 'tổng dung lượng', workspaces: 'không gian cá nhân',
    accountWide: 'Hạn mức được tính trên toàn tài khoản.', history: 'Lịch sử đăng ký', noHistory: 'Chưa có lần nâng cấp nào.',
    paidAt: 'Thanh toán', validUntil: 'Hiệu lực đến', days: 'ngày', retry: 'Tải lại', loadError: 'Không thể tải thông tin gói.',
    unavailable: 'VNPay chưa được cấu hình. Vui lòng liên hệ quản trị viên.', secure: 'Xác nhận bởi IPN',
    secureText: 'Tài khoản chỉ được nâng cấp sau khi backend xác thực callback hợp lệ từ VNPay.',
    pendingNote: 'Sau khi thanh toán, hệ thống có thể cần vài giây để nhận xác nhận.',
    freeAction: 'Gói mặc định', best: 'Khuyên dùng', oneTime: 'Thanh toán một lần', empty: 'Chưa có gói dịch vụ khả dụng.',
    lockedTitle: 'Gói trả phí đang còn hiệu lực', lockedText: 'Bạn không thể gia hạn hoặc đổi sang gói khác trước ngày hết hạn.',
  },
  en: {
    eyebrow: 'Account plans', title: 'More room for focused learning.',
    subtitle: 'Pricing, duration, and quotas below come directly from the system. Each account can use only one paid plan at a time.',
    current: 'Current plan', expires: 'Expires', noExpiry: 'No expiry', active: 'Active',
    choose: 'Choose', availableAfter: 'Available after', redirecting: 'Creating transaction...', included: 'Included',
    file: 'per file', storage: 'total storage', workspaces: 'personal workspaces',
    accountWide: 'Quotas apply across the whole account.', history: 'Purchase history', noHistory: 'No upgrades yet.',
    paidAt: 'Paid', validUntil: 'Valid until', days: 'days', retry: 'Reload', loadError: 'Could not load plan information.',
    unavailable: 'VNPay has not been configured. Please contact an administrator.', secure: 'Confirmed by IPN',
    secureText: 'Your account is upgraded only after the backend validates a legitimate VNPay callback.',
    pendingNote: 'After payment, confirmation can take a few seconds.',
    freeAction: 'Default plan', best: 'Recommended', oneTime: 'One-time payment', empty: 'No service plans are available.',
    lockedTitle: 'A paid plan is still active', lockedText: 'You cannot renew or switch to another plan before the current plan expires.',
  },
}

export default function ProPlanPage() {
  const { locale } = useLocale()
  const c = copy[locale] || copy.vi
  const [data, setData] = useState({ plans: [], subscription: null, history: [] })
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')
  const [buying, setBuying] = useState(false)

  async function load() {
    setState('loading')
    setError('')
    try {
      const [plans, subscription, history] = await Promise.all([
        getPlans(), getSubscription(), getSubscriptionHistory(),
      ])
      setData({ plans: Array.isArray(plans) ? plans : [], subscription, history: Array.isArray(history) ? history : [] })
      setState('ready')
    } catch (requestError) {
      setError(requestError.message || c.loadError)
      setState('error')
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const subscriptionExpiry = data.subscription?.expiresAt
  const hasActivePaidPlan = data.subscription?.status === 'PRO_ACTIVE' && Boolean(subscriptionExpiry)
  const sortedPlans = useMemo(() => [...data.plans].sort((a, b) => a.priceVnd - b.priceVnd), [data.plans])

  async function startPayment(planCode) {
    if (hasActivePaidPlan) return
    setBuying(true)
    setError('')
    try {
      const order = await createVnpayOrder(planCode)
      window.location.assign(order.paymentUrl)
    } catch (requestError) {
      setError(requestError.status === 503 ? c.unavailable : requestError.message)
      setBuying(false)
    }
  }

  return (
    <StudentShell mobileTitle="FStu PRO">
      <main className="min-h-dvh bg-[#f7faf9] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <div className="mx-auto max-w-6xl">
          <header className="relative overflow-hidden rounded-2xl border border-teal-100 bg-white px-6 py-8 sm:px-9 sm:py-10">
            <div className="absolute -right-12 -top-20 size-64 rounded-full bg-teal-50" aria-hidden="true" />
            <div className="relative max-w-3xl">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-teal-700"><Sparkles size={15} />{c.eyebrow}</p>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">{c.title}</h1>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600 sm:text-base">{c.subtitle}</p>
            </div>
            {data.subscription ? (
              <div className="relative mt-7 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-slate-100 pt-5 text-sm">
                <span><span className="text-slate-500">{c.current}:</span> <strong className="text-teal-800">{data.subscription.effectivePlanCode}</strong></span>
                <span><span className="text-slate-500">{c.expires}:</span> <strong>{data.subscription.expiresAt ? formatDate(data.subscription.expiresAt, locale) : c.noExpiry}</strong></span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-bold text-emerald-700"><Check size={14} />{c.active}</span>
              </div>
            ) : null}
          </header>

          {error ? <ErrorBanner message={error || c.loadError} onRetry={load} retry={c.retry} /> : null}

          {hasActivePaidPlan ? (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950">
              <Clock3 className="mt-0.5 shrink-0 text-amber-700" size={19} />
              <div><p className="font-black">{c.lockedTitle}</p><p className="mt-1 text-sm font-semibold leading-6 text-amber-900/75">{c.lockedText} <strong>{formatDate(subscriptionExpiry, locale)}</strong></p></div>
            </div>
          ) : null}

          {state === 'loading' ? <PlanSkeleton /> : null}
          {state === 'ready' && !sortedPlans.length ? <EmptyState text={c.empty} /> : null}
          {state === 'ready' && sortedPlans.length ? (
            <section className="mt-7 grid gap-5 lg:grid-cols-2" aria-label={c.eyebrow}>
              {sortedPlans.map((plan) => (
                <PlanCard
                  buying={buying}
                  copy={c}
                  current={data.subscription?.effectivePlanCode === plan.planCode}
                  hasActivePaidPlan={hasActivePaidPlan}
                  key={plan.planId}
                  locale={locale}
                  nextPurchaseAt={subscriptionExpiry}
                  onBuy={() => startPayment(plan.planCode)}
                  plan={plan}
                />
              ))}
            </section>
          ) : null}

          <section className="mt-7 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <article className="rounded-2xl border border-teal-100 bg-teal-950 p-6 text-white sm:p-7">
              <span className="grid size-11 place-items-center rounded-xl bg-white/10 text-teal-200"><ShieldCheck size={21} /></span>
              <h2 className="mt-5 text-xl font-black">{c.secure}</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-teal-50/80">{c.secureText}</p>
              <p className="mt-5 flex items-start gap-2 border-t border-white/10 pt-5 text-xs font-semibold leading-5 text-teal-100/70"><Clock3 className="mt-0.5 shrink-0" size={15} />{c.pendingNote}</p>
            </article>
            <HistoryCard copy={c} history={data.history} locale={locale} />
          </section>
        </div>
      </main>
    </StudentShell>
  )
}

function PlanCard({ buying, copy: c, current, hasActivePaidPlan, locale, nextPurchaseAt, onBuy, plan }) {
  const paid = Number(plan.priceVnd) > 0
  const featured = plan.planCode === 'PRO'
  const quota = [
    { icon: FileText, label: `${formatBytes(plan.maxFileBytes)} ${c.file}` },
    { icon: HardDrive, label: `${formatBytes(plan.maxStorageBytes)} ${c.storage}` },
    { icon: Workflow, label: `${plan.maxPersonalWorkspaces} ${c.workspaces}` },
  ]
  return (
    <article className={`relative flex min-h-[520px] flex-col overflow-hidden rounded-2xl border bg-white p-6 transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-teal-950/5 sm:p-8 ${featured ? 'border-teal-400 ring-1 ring-teal-100' : 'border-slate-200'}`}>
      {featured ? <span className="absolute right-5 top-5 rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-800">{c.best}</span> : null}
      <div className={`grid size-12 place-items-center rounded-xl ${paid ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{paid ? <Crown size={23} /> : <WalletCards size={22} />}</div>
      <h2 className="mt-5 text-2xl font-black text-slate-950">{plan.displayName}</h2>
      <div className="mt-3 flex items-baseline gap-2">
        <strong className="text-4xl font-black tracking-tight text-slate-950">{formatVnd(plan.priceVnd, locale)}</strong>
        {plan.durationDays ? <span className="text-sm font-semibold text-slate-500">/ {plan.durationDays} {c.days}</span> : null}
      </div>
      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-400">{paid ? c.oneTime : c.freeAction}</p>
      <div className="my-6 h-px bg-slate-100" />
      <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{c.included}</h3>
      <ul className="mt-4 space-y-3">
        {quota.map(({ icon: Icon, label }) => <li className="flex items-center gap-3 text-sm font-semibold text-slate-700" key={label}><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700"><Icon size={15} /></span>{label}</li>)}
      </ul>
      <p className="mt-5 text-xs font-semibold text-slate-500">{c.accountWide}</p>
      <div className="mt-auto pt-7">
        {paid ? (
          <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-black text-white transition hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 active:translate-y-px disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600" disabled={buying || hasActivePaidPlan} onClick={onBuy} type="button">
            {buying ? <><Loader2 className="animate-spin" size={17} />{c.redirecting}</> : hasActivePaidPlan ? <><Clock3 size={17} />{c.availableAfter} {formatDate(nextPurchaseAt, locale)}</> : <>{c.choose} {plan.displayName}<ArrowRight size={17} /></>}
          </button>
        ) : <div className={`flex h-12 items-center justify-center rounded-xl border text-sm font-black ${current ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-500'}`}>{current ? c.current : c.freeAction}</div>}
      </div>
    </article>
  )
}

function HistoryCard({ copy: c, history, locale }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
      <h2 className="flex items-center gap-2 text-xl font-black text-slate-950"><RefreshCw className="text-teal-700" size={19} />{c.history}</h2>
      {!history.length ? <p className="mt-6 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">{c.noHistory}</p> : (
        <div className="mt-5 divide-y divide-slate-100">
          {history.map((item) => (
            <div className="grid gap-2 py-4 first:pt-0 sm:grid-cols-[1fr_auto] sm:items-center" key={item.historyId}>
              <div><p className="font-black text-slate-900">{item.planCode} · +{item.daysAdded} {c.days}</p><p className="mt-1 text-xs font-semibold text-slate-500">{c.paidAt}: {formatDate(item.paidAt, locale)}</p></div>
              <div className="text-left sm:text-right"><p className="font-black text-teal-800">{formatVnd(item.amountVnd, locale)}</p><p className="mt-1 text-xs font-semibold text-slate-500">{c.validUntil}: {formatDate(item.extensionTo, locale)}</p></div>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

function ErrorBanner({ message, onRetry, retry }) {
  return <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"><span>{message}</span><button className="rounded-lg bg-white px-3 py-2 font-black shadow-sm hover:bg-red-100" onClick={onRetry} type="button">{retry}</button></div>
}

function EmptyState({ text }) { return <div className="mt-7 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-sm font-semibold text-slate-500">{text}</div> }
function PlanSkeleton() { return <div className="mt-7 grid gap-5 lg:grid-cols-2">{[1, 2].map((item) => <div className="h-[520px] animate-pulse rounded-2xl border border-slate-200 bg-white p-7" key={item}><div className="size-12 rounded-xl bg-slate-100" /><div className="mt-5 h-7 w-1/3 rounded bg-slate-100" /><div className="mt-4 h-10 w-1/2 rounded bg-slate-100" /><div className="mt-10 space-y-4">{[1, 2, 3, 4].map((line) => <div className="h-8 rounded bg-slate-50" key={line} />)}</div></div>)}</div> }
function formatBytes(value) { const bytes = Number(value || 0); return bytes >= 1024 ** 2 ? `${Math.round(bytes / 1024 ** 2)} MB` : `${Math.round(bytes / 1024)} KB` }
function formatVnd(value, locale) { return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0)) }
function formatDate(value, locale) { if (!value) return ''; return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
