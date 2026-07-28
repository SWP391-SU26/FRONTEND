import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  clearSession, getSavedUser, logout,
} from '../services/authService.js'
import {
  deleteSession, getSessions, pinSession, renameSession,
} from '../services/chatService.js'
import StudentSidebar from './StudentSidebar.jsx'
import { Button, ConfirmModal, IconButton } from './ui.jsx'

export default function StudentShell({ children, mobileTitle = 'FStu Learning Workspace' }) {
  const navigate = useNavigate()
  const user = getSavedUser()
  const [sessions, setSessions] = useState([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('fstu_chat_sidebar_collapsed') === 'true',
  )
  const [menuId, setMenuId] = useState('')
  const [busyId, setBusyId] = useState('')
  const [renaming, setRenaming] = useState(null)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    let active = true
    const timeout = window.setTimeout(() => {
      getSessions({}, search)
        .then((items) => active && setSessions(sortSessions(items)))
        .catch(() => active && setSessions([]))
    }, 200)
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [search])

  function toggleSidebar() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('fstu_chat_sidebar_collapsed', String(next))
  }

  async function updatePin(item) {
    setBusyId(item.id)
    try {
      const updated = await pinSession(item.id, !item.isPinned)
      setSessions((current) => sortSessions(
        current.map((candidate) => candidate.id === item.id ? updated : candidate),
      ))
    } finally {
      setBusyId('')
      setMenuId('')
    }
  }

  async function submitRename(event) {
    event.preventDefault()
    const title = renaming?.title?.trim()
    if (!renaming || !title) return
    setBusyId(renaming.id)
    try {
      const updated = await renameSession(renaming.id, title)
      setSessions((current) => sortSessions(
        current.map((candidate) => candidate.id === renaming.id ? updated : candidate),
      ))
      setRenaming(null)
    } finally {
      setBusyId('')
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusyId(deleting.id)
    try {
      await deleteSession(deleting.id)
      setSessions((current) => current.filter((item) => item.id !== deleting.id))
      setDeleting(null)
    } finally {
      setBusyId('')
    }
  }

  function handleLogout() {
    logout().catch(() => {})
    clearSession()
    navigate('/login')
  }

  return (
    <div className="flex min-h-dvh bg-white text-slate-950">
      <StudentSidebar
        activeSessionId=""
        busySessionId={busyId}
        collapsed={collapsed}
        menuId={menuId}
        onClose={() => setOpen(false)}
        onCollapse={toggleSidebar}
        onDelete={setDeleting}
        onLogout={handleLogout}
        onMenu={setMenuId}
        onNew={() => navigate('/workspace')}
        onPin={updatePin}
        onRename={(item) => { setRenaming({ id: item.id, title: item.title }); setMenuId('') }}
        onSearch={setSearch}
        onSelect={(item) => navigate(`/workspace?session=${encodeURIComponent(item.id)}`)}
        open={open}
        search={search}
        sessions={sessions}
        user={user}
      />
      <section className="min-w-0 flex-1">
        <header className="flex h-14 items-center gap-3 border-b border-slate-200 px-4 lg:hidden">
          <IconButton label="Mở thanh bên" onClick={() => setOpen(true)}><Menu size={19} /></IconButton>
          <span className="truncate font-bold text-slate-900">{mobileTitle}</span>
        </header>
        {children}
      </section>
      {renaming ? (
        <RenameDialog
          busy={busyId === renaming.id}
          onCancel={() => setRenaming(null)}
          onChange={(title) => setRenaming((current) => ({ ...current, title }))}
          onSubmit={submitRename}
          title={renaming.title}
        />
      ) : null}
      {deleting ? (
        <ConfirmModal
          actionLabel="Xóa"
          busy={busyId === deleting.id}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
          title="Xóa cuộc trò chuyện?"
        >
          “{deleting.title}” sẽ bị xóa khỏi lịch sử của bạn.
        </ConfirmModal>
      ) : null}
    </div>
  )
}

function RenameDialog({ busy, onCancel, onChange, onSubmit, title }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <form className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl" onSubmit={onSubmit}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-950">Đổi tên cuộc trò chuyện</h2>
          <IconButton label="Đóng" onClick={onCancel}><X size={17} /></IconButton>
        </div>
        <label className="mt-4 block text-sm font-bold text-slate-700">
          Tiêu đề
          <input
            autoFocus
            className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
            maxLength={200}
            value={title}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Hủy</Button>
          <Button disabled={busy || !title.trim()} type="submit">Lưu</Button>
        </div>
      </form>
    </div>
  )
}

function sortSessions(items) {
  return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
    const pinDifference = Number(Boolean(right.isPinned)) - Number(Boolean(left.isPinned))
    if (pinDifference) return pinDifference
    return Date.parse(right.updatedAt || right.createdAt || 0) - Date.parse(left.updatedAt || left.createdAt || 0)
  })
}
