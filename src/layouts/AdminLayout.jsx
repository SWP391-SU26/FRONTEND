import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  Brain,
  ClipboardList,
  CreditCard,
  FileText,
  Gauge,
  Home,
  Layers3,
  LogOut,
  MessageSquareWarning,
  Users,
} from 'lucide-react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { cn } from '../utils/cn.js'
import { getSavedUser, clearSession, logout, isAdminSession, isAuthenticated } from '../services/authService.js'
import { getAdminDashboardHealth } from '../services/adminDashboardService.js'
import { LanguageSwitch } from '../components/LanguageSwitch.jsx'
import { useLocale } from '../i18n/LocaleContext.jsx'

const adminNav = [
  { href: '/admin/dashboard', labelKey: 'admin.dashboard', icon: Gauge },
  { href: '/admin/users', labelKey: 'admin.users', icon: Users },
  { href: '/admin/documents', labelKey: 'admin.documents', icon: FileText },
  { href: '/admin/courses', labelKey: 'admin.courses', icon: BookOpen },
  { href: '/admin/test-set', labelKey: 'admin.testSet', icon: ClipboardList },
  { href: '/admin/research-dashboard', labelKey: 'admin.research', icon: BarChart3 },
  { href: '/admin/feedback', labelKey: 'admin.feedback', icon: MessageSquareWarning },
  { href: '/admin/payments', labelKey: 'admin.payments', icon: CreditCard },
  { href: '/admin/plans', labelKey: 'admin.plans', icon: Layers3 },
]

const AdminOperationalHealthContext = createContext({
  updateOperationalHealth: () => {},
})

// The hook shares the layout-owned health state with the nested dashboard route.
// eslint-disable-next-line react-refresh/only-export-components
export function useAdminOperationalHealth() {
  return useContext(AdminOperationalHealthContext)
}

function AdminLayout() {
  const navigate = useNavigate()
  const { t } = useLocale()
  const user = getSavedUser()
  const initials = getInitials(user?.name)
  const [operationalHealth, setOperationalHealth] = useState({ status: 'loading', value: null })

  const updateOperationalHealth = useCallback((health) => {
    setOperationalHealth({ status: 'ready', value: health })
  }, [])

  useEffect(() => {
    let active = true
    getAdminDashboardHealth()
      .then((health) => {
        if (active) updateOperationalHealth(health)
      })
      .catch(() => {
        if (active) setOperationalHealth({ status: 'unavailable', value: null })
      })

    return () => {
      active = false
    }
  }, [updateOperationalHealth])

  const operationalHealthLabel = operationalHealth.status === 'loading'
    ? t('admin.checkingStatus')
    : operationalHealth.status === 'unavailable'
      ? t('admin.statusUnavailable')
      : operationalHealth.value?.status === 'OK'
        ? t('admin.systemHealthy')
        : t('admin.needsAttention')

  const operationalHealthClassName = operationalHealth.status === 'unavailable'
    ? 'bg-slate-100 text-slate-600'
    : operationalHealth.value?.status === 'OK'
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-amber-50 text-amber-800'

  const contextValue = useMemo(() => ({ updateOperationalHealth }), [updateOperationalHealth])

  function handleLogout() {
    logout().catch(() => {})
    clearSession()
    navigate('/login')
  }

  if (!isAdminSession()) {
    return <Navigate replace to={isAuthenticated() ? '/workspace' : '/login'} />
  }

  return (
    <AdminOperationalHealthContext.Provider value={contextValue}>
      <div className="app-ambient min-h-screen text-slate-950">
        <div className="ambient-lines" />
        <div className="noise-layer" />
        <div className="motion-field" />

        <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col gap-3 p-3 lg:flex-row lg:p-4">
          <aside className="notebook-panel lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-[292px] lg:shrink-0">
          <div className="source-glow" />
          <div className="relative border-b border-border p-4">
            <NavLink className="flex items-center gap-3" to="/workspace">
              <span className="flex h-11 w-28 items-center">
                <img
                  alt="FStu"
                  className="w-full object-contain"
                  src="/Gemini_Generated_Image_gyb1mfgyb1mfgyb1.png"
                />
              </span>
              <span>
                <span className="block text-lg font-black tracking-tight">{t('admin.brand')}</span>
                <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                  {t('admin.subtitle')}
                </span>
              </span>
            </NavLink>
          </div>

          <nav className="relative grid grid-cols-3 gap-1.5 p-2 lg:block lg:space-y-1 lg:p-3">
            {adminNav.map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      'flex min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-2.5 text-[11px] font-black transition sm:text-sm lg:justify-start lg:gap-3 lg:px-3',
                      isActive
                        ? 'bg-primary text-white shadow-[0_12px_24px_rgba(15,118,110,.2)]'
                        : 'text-slate-600 hover:bg-teal-50 hover:text-primary',
                    )
                  }
                  key={item.href}
                  to={item.href}
                >
                  <Icon size={17} />
                  <span className="truncate">{t(item.labelKey)}</span>
                </NavLink>
              )
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="notebook-panel mb-3 flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="min-w-0 flex-1 px-2">
              <p className="text-sm font-black tracking-tight text-slate-900">{t('admin.workspace')}</p>
              <p className="truncate text-xs font-semibold text-slate-500">{t('admin.workspaceDescription')}</p>
            </div>
            <div className="flex items-center gap-2">
              <NavLink
                aria-label={`Operational status: ${operationalHealthLabel}`}
                className={cn('hidden rounded-lg px-3 py-2 text-xs font-black transition hover:opacity-80 sm:flex', operationalHealthClassName)}
                to="/admin/dashboard#operational-alerts"
              >
                {operationalHealthLabel}
              </NavLink>
              <LanguageSwitch compact />
              <NavLink
                className="grid size-10 place-items-center rounded-xl border border-border bg-white/90 text-slate-600 shadow-sm transition hover:bg-teal-50 hover:text-primary"
                title={t('common.backToWorkspace')}
                to="/workspace"
              >
                <Home size={16} />
              </NavLink>
              <button
                className="grid size-10 place-items-center rounded-xl border border-border bg-white/90 text-slate-600 shadow-sm transition hover:bg-red-50 hover:text-red-650"
                onClick={handleLogout}
                title={t('common.logOut')}
                type="button"
              >
                <LogOut size={16} />
              </button>
              <div className="grid size-10 place-items-center rounded-full bg-primary text-xs font-black text-white">
                {initials}
              </div>
            </div>
          </header>

          <main className="pb-8">
            <Outlet />
          </main>
        </div>
      </div>
      </div>
    </AdminOperationalHealthContext.Provider>
  )
}

function getInitials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'A'
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('')
}

export function AdminPageHeader({ actions, description, icon: Icon = Brain, title }) {
  return (
    <section className="notebook-panel mb-4 overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-0 opacity-55">
        <div className="abstract-canvas" />
      </div>
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <div className="mb-3 grid size-11 place-items-center rounded-xl bg-teal-50 text-primary shadow-lg shadow-teal-100">
            <Icon size={20} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            {description}
          </p>
        </div>
        {actions ? <div className="relative flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}

export function MiniTabs({ items, value, onChange }) {
  return (
    <div className="flex overflow-x-auto rounded-lg bg-white/72 p-1 shadow-inner">
      {items.map((item) => (
        <button
          className={cn(
            'min-h-9 min-w-max rounded-lg px-3 text-xs font-black transition',
            value === item ? 'bg-primary text-white' : 'text-slate-500 hover:bg-white',
          )}
          key={item}
          onClick={() => onChange(item)}
          type="button"
        >
          {item}
        </button>
      ))}
    </div>
  )
}

export default AdminLayout
