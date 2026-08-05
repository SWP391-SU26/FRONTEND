import { AnimatePresence, motion } from 'framer-motion'
import {
  Library, Loader2, LogOut, MessageSquareText, MoreHorizontal,
  PanelLeftClose, PanelLeftOpen, Pencil, Pin, Plus, Search,
  Crown, ReceiptText, Settings, ShieldCheck, Trash2,
} from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { isAdminSession } from '../services/authService.js'
import { cn } from '../utils/cn.js'
import { LanguageSwitch } from './LanguageSwitch.jsx'
import { useLocale } from '../i18n/LocaleContext.jsx'

export default function StudentSidebar({
  activeSessionId, busySessionId, collapsed, menuId, onClose, onCollapse, onDelete,
  onLogout, onMenu, onNew, onPin, onRename, onSearch, onSelect, open, search, sessions, user,
}) {
  const { t } = useLocale()
  const groups = groupSessions(sessions)
  const sidebar = (
    <aside className={cn(
      'flex h-full shrink-0 flex-col border-r border-slate-200 bg-slate-50 transition-[width] duration-200',
      collapsed ? 'w-[72px]' : 'w-[280px]',
    )}>
      <div className="flex h-16 items-center gap-2 px-3">
        <Link className="flex min-w-0 flex-1 items-center gap-2" to="/workspace">
          <img alt="FStu" className="h-9 w-12 object-contain" src="/Gemini_Generated_Image_gyb1mfgyb1mfgyb1.png" />
        </Link>
        {!collapsed ? <SidebarAction label={t('sidebar.close')} onClick={onCollapse}><PanelLeftClose size={18} /></SidebarAction> : null}
      </div>

      <div className="px-3">
        <button
          className={cn(
            'flex h-11 w-full items-center rounded-lg bg-teal-700 text-sm font-bold text-white transition hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 active:translate-y-px',
            collapsed ? 'justify-center px-0' : 'gap-3 px-3',
          )}
          onClick={onNew}
          type="button"
        >
          <Plus size={18} />{!collapsed ? t('sidebar.newChat') : null}
        </button>
      </div>

      {!collapsed ? (
        <label className="mx-3 mt-3 flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-500 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-100">
          <Search size={15} />
          <input
            aria-label={t('sidebar.searchLabel')}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500"
            onChange={(event) => onSearch(event.target.value)}
            placeholder={t('sidebar.searchPlaceholder')}
            value={search}
          />
        </label>
      ) : null}

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <SidebarAction label={t('sidebar.open')} onClick={onCollapse}><PanelLeftOpen size={19} /></SidebarAction>
            {sessions.slice(0, 8).map((item) => (
              <button
                aria-label={item.title || t('sidebar.newConversation')}
                className={cn(
                  'grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-white hover:text-teal-700',
                  activeSessionId === item.id && 'bg-white text-teal-700 shadow-sm',
                )}
                key={item.id}
                onClick={() => onSelect(item)}
                title={item.title || t('sidebar.newConversation')}
                type="button"
              >
                <MessageSquareText size={17} />
              </button>
            ))}
          </div>
        ) : sessions.length ? (
          groups.map((group) => (
            <section className="mb-4" key={group.labelKey}>
              <h2 className="px-2 pb-1.5 text-xs font-semibold text-slate-500">{t(group.labelKey)}</h2>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <div
                    className={cn(
                      'group relative flex items-center rounded-lg',
                      activeSessionId === item.id ? 'bg-white shadow-sm' : 'hover:bg-slate-100',
                    )}
                    key={item.id}
                  >
                    <button className="min-w-0 flex-1 px-2.5 py-2 text-left" onClick={() => onSelect(item)} type="button">
                      <span className="flex items-center gap-1.5">
                        {item.isPinned ? <Pin className="shrink-0 text-teal-700" size={12} /> : null}
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {item.title || t('sidebar.newConversation')}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                        {item.scopeLabel || t('sidebar.learningMaterials')}
                      </span>
                    </button>
                    <SidebarAction
                      className="mr-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                      label={t('sidebar.options')}
                      onClick={() => onMenu(menuId === item.id ? '' : item.id)}
                    >
                      {busySessionId === item.id
                        ? <Loader2 className="animate-spin" size={15} />
                        : <MoreHorizontal size={16} />}
                    </SidebarAction>
                    {menuId === item.id ? (
                      <SessionMenu
                        item={item}
                        onDelete={() => { onDelete(item); onMenu('') }}
                        onPin={() => onPin(item)}
                        onRename={() => onRename(item)}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))
        ) : (
          <p className="px-3 py-8 text-center text-sm text-slate-500">
            {search ? t('sidebar.noSearch') : t('sidebar.noSessions')}
          </p>
        )}
      </div>

      <nav className="border-t border-slate-200 p-2" aria-label={t('common.workspace')}>
        <SidebarLink collapsed={collapsed} icon={MessageSquareText} label={t('common.aiChat')} to="/workspace" />
        <SidebarLink collapsed={collapsed} icon={Library} label={t('common.library')} to="/library" />
        <SidebarLink collapsed={collapsed} icon={Crown} label={t('common.pro')} to="/pro" />
        <SidebarLink collapsed={collapsed} icon={ReceiptText} label={t('common.payments')} to="/payments" />
        <SidebarLink collapsed={collapsed} icon={Settings} label={t('common.settings')} to="/settings" />
        {isAdminSession() ? <SidebarLink collapsed={collapsed} icon={ShieldCheck} label={t('common.admin')} to="/admin" /> : null}
        <div className={cn('my-1', collapsed ? 'flex justify-center' : '')}>
          <LanguageSwitch compact={collapsed} className={collapsed ? '' : 'w-full justify-start'} />
        </div>
        <button
          className={cn(
            'mt-1 flex h-11 w-full items-center rounded-lg text-sm text-slate-600 hover:bg-white',
            collapsed ? 'justify-center' : 'gap-3 px-3',
          )}
          onClick={onLogout}
          type="button"
        >
          <span className="grid size-7 place-items-center rounded-full bg-teal-700 text-[10px] font-bold text-white">
            {getInitials(user?.name)}
          </span>
          {!collapsed ? <><span className="min-w-0 flex-1 truncate text-left">{user?.name || t('common.account')}</span><LogOut size={15} /></> : null}
        </button>
      </nav>
    </aside>
  )

  return (
    <>
      <div className="sticky top-0 hidden h-dvh shrink-0 self-start lg:block">{sidebar}</div>
      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-slate-950/35 lg:hidden"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onMouseDown={(event) => event.target === event.currentTarget && onClose()}
          >
            <motion.div
              animate={{ x: 0 }}
              className="h-full w-[min(86vw,300px)]"
              exit={{ x: -320 }}
              initial={{ x: -320 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {sidebar}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}

function SessionMenu({ item, onDelete, onPin, onRename }) {
  const { t } = useLocale()
  return (
    <div className="absolute right-1 top-10 z-20 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
      <MenuButton icon={Pencil} label={t('sidebar.rename')} onClick={onRename} />
      <MenuButton icon={Pin} label={item.isPinned ? t('sidebar.unpin') : t('sidebar.pin')} onClick={onPin} />
      <MenuButton danger icon={Trash2} label={t('common.delete')} onClick={onDelete} />
    </div>
  )
}

function MenuButton({ danger, icon: Icon, label, onClick }) {
  return (
    <button
      className={cn('flex h-9 w-full items-center gap-2 rounded-md px-2 text-sm hover:bg-slate-100', danger ? 'text-red-600' : 'text-slate-700')}
      onClick={onClick}
      type="button"
    >
      <Icon size={15} />{label}
    </button>
  )
}

function SidebarAction({ children, className, label, ...props }) {
  return (
    <button
      aria-label={label}
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600',
        className,
      )}
      title={label}
      type="button"
      {...props}
    >
      {children}
    </button>
  )
}

function SidebarLink({ collapsed, icon: Icon, label, to }) {
  return (
    <NavLink
      className={({ isActive }) => cn(
        'flex h-10 items-center rounded-lg text-sm transition',
        collapsed ? 'justify-center' : 'gap-3 px-3',
        isActive ? 'bg-white font-semibold text-teal-800 shadow-sm' : 'text-slate-600 hover:bg-white',
      )}
      title={label}
      to={to}
    >
      <Icon size={17} />{!collapsed ? label : null}
    </NavLink>
  )
}

function groupSessions(sessions) {
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const weekAgo = startToday - 6 * 24 * 60 * 60 * 1000
  const pinned = sessions.filter((item) => item.isPinned)
  const remaining = sessions.filter((item) => !item.isPinned)
  return [
    { labelKey: 'sidebar.pinned', items: pinned },
    { labelKey: 'sidebar.today', items: remaining.filter((item) => dateValue(item.updatedAt) >= startToday) },
    { labelKey: 'sidebar.last7Days', items: remaining.filter((item) => dateValue(item.updatedAt) >= weekAgo && dateValue(item.updatedAt) < startToday) },
    { labelKey: 'sidebar.older', items: remaining.filter((item) => dateValue(item.updatedAt) < weekAgo) },
  ].filter((group) => group.items.length)
}

function dateValue(value) {
  const result = new Date(value || 0).getTime()
  return Number.isNaN(result) ? 0 : result
}

function getInitials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words.length ? words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('') : 'U'
}
