import { motion } from 'framer-motion'
import {
  Bell,
  Library,
  MessageSquareText,
  ShieldCheck,
  Settings2,
  LogOut,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { cn } from '../utils/cn.js'
import { getSavedUser, clearSession, logout, isAdminSession } from '../services/authService.js'

const navItems = [
  { href: '/workspace', label: 'AI Chat', icon: MessageSquareText, end: true },
  { href: '/library', label: 'Library', icon: Library },
]

function MainLayout() {
  const navigate = useNavigate()
  const user = getSavedUser()
  const initials = getInitials(user?.name)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const updateHeaderState = () => {
      setIsScrolled(window.scrollY > 36)
    }

    updateHeaderState()
    window.addEventListener('scroll', updateHeaderState, { passive: true })
    return () => window.removeEventListener('scroll', updateHeaderState)
  }, [])

  function handleLogout() {
    logout().catch(() => {})
    clearSession()
    navigate('/login')
  }

  return (
    <div className="app-ambient min-h-screen text-slate-950">
      <div className="ambient-lines" />
      <div className="noise-layer" />
      <div className="motion-field" />

      <header
        className={cn(
          'app-header sticky top-0 z-40 px-3 py-3 transition-all duration-300 ease-out sm:px-5',
          isScrolled && 'app-header-scrolled py-2',
        )}
      >
        <div
          className={cn(
            'app-header-shell mx-auto grid max-w-[1560px] grid-cols-[1fr_auto_1fr] items-center gap-3 transition-all duration-300 ease-out',
            isScrolled && 'px-3 py-2 sm:px-4',
          )}
        >
          <NavLink className="group flex min-w-0 items-center gap-3" to="/workspace">
            <motion.span
              className={cn(
                'flex h-11 w-28 shrink-0 items-center px-0 transition-all duration-300 ease-out',
                isScrolled && 'h-9 w-20',
              )}
              whileHover={{ y: -2, scale: 1.04 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 430, damping: 28 }}
            >
              <img
                alt="FStu"
                className="w-full object-contain"
                src="/Gemini_Generated_Image_gyb1mfgyb1mfgyb1.png"
              />
            </motion.span>
            <span
              className={cn(
                'hidden min-w-0 transition-all duration-300 ease-out sm:block',
                isScrolled && 'max-w-0 overflow-hidden opacity-0',
              )}
            >
              <span className="block text-lg font-black leading-none tracking-tight text-slate-950">
                FStu
              </span>
              <span className="block truncate text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                Learning workspace
              </span>
            </span>
          </NavLink>

          <nav
            className={cn(
              'nav-pill flex max-w-[92vw] items-center gap-1 p-1 transition-all duration-300 ease-out',
              isScrolled && 'shadow-none',
            )}
          >
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      'relative inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-black transition',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-[0_12px_24px_rgba(15,118,110,.2)]'
                        : 'text-slate-500 hover:bg-teal-50 hover:text-primary',
                    )
                  }
                  end={item.end}
                  key={item.href}
                  to={item.href}
                >
                  <Icon size={16} />
                  <span className="hidden md:inline">{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          <div className="flex min-w-0 items-center justify-end gap-2">
            {isAdminSession() ? (
              <NavLink
                className={cn(
                  'nav-pill hidden min-h-10 items-center gap-2 px-3 text-sm font-black text-slate-600 transition hover:text-primary sm:flex',
                  isScrolled && 'px-2',
                )}
                to="/admin"
              >
                <ShieldCheck size={15} />
                <span className={cn('transition-all duration-300', isScrolled && 'sr-only')}>
                  Admin
                </span>
              </NavLink>
            ) : null}
            <NavLink
              aria-label="Settings"
              className="nav-pill relative grid size-10 place-items-center text-slate-600 transition hover:text-primary"
              title="Settings"
              to="/settings"
            >
              <Settings2 size={16} />
            </NavLink>
            <QuickIcon label="Notifications">
              <Bell size={16} />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-amber-400" />
            </QuickIcon>
            <motion.button
              aria-label="User account"
              className="grid size-10 place-items-center rounded-full border border-teal-100 bg-primary text-xs font-black text-white shadow-lg shadow-teal-900/10"
              whileHover={{ y: -2, scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              {initials}
            </motion.button>
            <motion.button
              aria-label="Log out"
              className="nav-pill relative grid size-10 place-items-center text-slate-600 transition hover:text-red-650"
              onClick={handleLogout}
              title="Log out"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <LogOut size={16} />
            </motion.button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1560px] overflow-hidden px-3 pt-2 sm:px-5 lg:px-7">
        <Outlet />
      </main>
    </div>
  )
}

function QuickIcon({ children, label }) {
  return (
    <motion.button
      aria-label={label}
      className="nav-pill relative grid size-10 place-items-center text-slate-600 hover:text-primary"
      title={label}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.95 }}
    >
      {children}
    </motion.button>
  )
}

function getInitials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'U'
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('')
}

export default MainLayout
