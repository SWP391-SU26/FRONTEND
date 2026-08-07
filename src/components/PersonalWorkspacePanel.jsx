import { AlertTriangle, Check, ChevronRight, FileText, Folder, FolderPlus, HardDrive, Loader2, Pencil, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import {
  createPersonalWorkspace, deletePersonalWorkspace, getPersonalWorkspaces, getStorageUsage,
  renamePersonalWorkspace,
} from '../services/workspaceService.js'
import { Button, ConfirmModal, IconButton } from './ui.jsx'
import { cn } from '../utils/cn.js'
import { useLocale } from '../i18n/LocaleContext.jsx'

const copy = {
  vi: {
    required: 'Tên workspace không được để trống.', loading: 'Đang tải dung lượng...', documents: 'tài liệu', maxFile: 'Mỗi tệp tối đa', storageFull: 'Bạn đã dùng hết dung lượng. Xóa bớt tài liệu hoặc nâng cấp gói để tải lên tiếp.', storageNear: (remaining) => `Sắp hết dung lượng (còn ${remaining}). Cân nhắc xóa bớt hoặc nâng cấp gói.`, rename: 'Đổi tên', remove: 'Xóa', newWorkspace: 'Tạo workspace', workspaceHeading: 'Workspace cá nhân', workspaceHint: 'Tạo workspace theo môn học hoặc chủ đề để sắp xếp tài liệu.', workspaceUsage: (used, limit) => `${used} / ${limit} workspace`, planLimit: (count) => `Bạn đã dùng đủ ${count} workspace của gói hiện tại.`, renameTitle: 'Đổi tên workspace', close: 'Đóng', name: 'Tên workspace', description: 'Mô tả chủ đề (không bắt buộc)', cancel: 'Hủy', save: 'Lưu', deleteTitle: 'Xóa workspace?', deleteBody: (title) => `“${title}” sẽ bị xóa. Workspace còn tài liệu hoặc là workspace cuối cùng sẽ không xóa được.`,
  },
  en: {
    required: 'Workspace name is required.', loading: 'Loading storage usage...', documents: 'documents', maxFile: 'Maximum per file', storageFull: 'You have used all available storage. Delete documents or upgrade your plan to upload more.', storageNear: (remaining) => `Storage is nearly full (${remaining} remaining). Consider deleting documents or upgrading your plan.`, rename: 'Rename', remove: 'Delete', newWorkspace: 'Create workspace', workspaceHeading: 'Personal workspaces', workspaceHint: 'Create a workspace for each course or topic to keep documents organized.', workspaceUsage: (used, limit) => `${used} / ${limit} workspaces`, planLimit: (count) => `You have used all ${count} workspaces included in your current plan.`, renameTitle: 'Rename workspace', close: 'Close', name: 'Workspace name', description: 'Topic description (optional)', cancel: 'Cancel', save: 'Save', deleteTitle: 'Delete workspace?', deleteBody: (title) => `“${title}” will be deleted. A workspace containing documents, or your last workspace, cannot be deleted.`,
  },
}

function ChipAction({ danger, label, onClick, children }) {
  return (
    <button
      aria-label={label}
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-200',
        danger && 'hover:bg-red-100 hover:text-red-600',
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  )
}

// One decimal place, matching the document card's formatBytes in LibraryPage.jsx -
// rounding to a whole MB made a 2.89 MB file read as "3 MB", which looked like the
// upload had silently grown the file.
function formatBytes(bytes) {
  if (!bytes) return '0 MB'
  const mb = bytes / (1024 * 1024)
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`
}

/**
 * REQ-02 quota + workspace panel shown above "Tài liệu của tôi". Storage is
 * account-wide (not per-workspace), so the usage bar reflects every personal
 * workspace combined, matching what DocumentService enforces on upload.
 *
 * `refreshSignal` lets the parent force a re-fetch after an action elsewhere on
 * the page changes quota (upload, delete, move) - otherwise this panel's numbers
 * go stale until the user navigates away and back.
 */
export function PersonalWorkspacePanel({
  activeWorkspaceId,
  documentCounts = {},
  onOpenWorkspace,
  onWorkspaceDeleted,
  onWorkspacesChange,
  refreshSignal,
}) {
  const { locale } = useLocale()
  const c = copy[locale] ?? copy.vi
  const [usage, setUsage] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [usageResult, workspacesResult] = await Promise.all([
        getStorageUsage(), getPersonalWorkspaces(),
      ])
      setUsage(usageResult)
      setWorkspaces(workspacesResult)
      onWorkspacesChange?.(workspacesResult)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  // onWorkspacesChange is expected to be stable (a setState function in practice);
  // depending on it would re-run this on every parent render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load, refreshSignal])

  async function saveEditor() {
    if (!editor.title.trim()) {
      setEditor((current) => ({ ...current, error: c.required }))
      return
    }
    setBusy(true)
    try {
      if (editor.mode === 'create') {
        await createPersonalWorkspace({ workspaceTitle: editor.title, description: editor.description })
      } else {
        await renamePersonalWorkspace(editor.id, { workspaceTitle: editor.title, description: editor.description })
      }
      setEditor(null)
      await load()
    } catch (requestError) {
      setEditor((current) => ({ ...current, error: requestError.message }))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      const deletedId = deleteTarget.id
      await deletePersonalWorkspace(deletedId)
      setDeleteTarget(null)
      await load()
      onWorkspaceDeleted?.(deletedId)
    } catch (requestError) {
      setError(requestError.message)
      setDeleteTarget(null)
    } finally {
      setBusy(false)
    }
  }

  // Only the very first load shows a placeholder; a refresh after upload/delete/move
  // updates the numbers quietly instead of flashing the whole panel to a spinner.
  if (loading && !usage) {
    return (
      <div className="mb-5 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
        <Loader2 className="animate-spin" size={16} />{c.loading}
      </div>
    )
  }

  if (error && !usage) {
    return (
      <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        {error}
      </div>
    )
  }

  const usedPercent = usage.maxStorageBytes
    ? Math.min(100, Math.round((usage.usedBytes / usage.maxStorageBytes) * 100))
    : 0
  const nearLimit = usedPercent >= 85
  const atStorageLimit = usedPercent >= 100
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId)

  return (
    <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <HardDrive size={16} className={nearLimit ? 'text-amber-600' : 'text-slate-500'} />
          {formatBytes(usage.usedBytes)} / {formatBytes(usage.maxStorageBytes)}
          <span className="font-semibold text-slate-500">
            · {usage.documentCount} {c.documents}
          </span>
        </div>
        <span className="text-xs font-semibold text-slate-500">
          {c.maxFile} {formatBytes(usage.maxFileBytes)}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <span
          className={cn('block h-full rounded-full transition-all', nearLimit ? 'bg-amber-500' : 'bg-teal-600')}
          style={{ width: `${usedPercent}%` }}
        />
      </div>
      {nearLimit ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-amber-700">
          <AlertTriangle className="mt-0.5 shrink-0" size={13} />
          {atStorageLimit
            ? c.storageFull
            : c.storageNear(formatBytes(usage.maxStorageBytes - usage.usedBytes))}
        </p>
      ) : null}

      <div className="mt-4 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-900">{c.workspaceHeading}</h2>
            <p className="mt-1 text-xs font-medium leading-5 text-slate-600">{c.workspaceHint}</p>
          </div>
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-700">
            {c.workspaceUsage(usage.workspaceCount, usage.maxPersonalWorkspaces)}
          </span>
        </div>

        {activeWorkspace ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-teal-100 text-teal-800"><Folder size={19} /></span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">{activeWorkspace.title}</p>
                <p className="truncate text-xs font-medium text-slate-600">
                  {activeWorkspace.description || `${documentCounts[activeWorkspace.id] ?? 0} ${c.documents}`}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <ChipAction label={`${c.rename} ${activeWorkspace.title}`} onClick={() => setEditor({
                mode: 'rename', id: activeWorkspace.id, title: activeWorkspace.title, description: activeWorkspace.description, error: '',
              })}><Pencil size={13} /></ChipAction>
              <ChipAction danger label={`${c.remove} ${activeWorkspace.title}`} onClick={() => setDeleteTarget(activeWorkspace)}><Trash2 size={13} /></ChipAction>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {workspaces.map((workspace) => (
              <article className="group relative min-h-44 pt-6" key={workspace.id}>
                <span className="absolute left-0 top-0 h-8 w-28 rounded-t-lg border border-b-0 border-teal-200 bg-teal-100 transition group-hover:-translate-y-0.5" />
                <div className="relative flex min-h-40 flex-col rounded-b-lg rounded-tr-lg border border-teal-200 bg-teal-50 p-4 shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md">
                  <button
                    aria-label={`${locale === 'vi' ? 'Mở workspace' : 'Open workspace'} ${workspace.title}`}
                    className="absolute inset-0 rounded-b-lg rounded-tr-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
                    onClick={() => onOpenWorkspace?.(workspace)}
                    type="button"
                  />
                  <div className="pointer-events-none flex items-start justify-between gap-3">
                    <span className="grid size-11 place-items-center rounded-md bg-teal-100 text-teal-800"><Folder size={22} /></span>
                    <ChevronRight className="text-slate-500 transition group-hover:translate-x-1 group-hover:text-teal-800" size={18} />
                  </div>
                  <p className="pointer-events-none mt-3 line-clamp-1 text-base font-black text-slate-950">{workspace.title}</p>
                  <p className="pointer-events-none mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-600">
                    {workspace.description || (locale === 'vi' ? 'Thư mục tài liệu cá nhân' : 'Personal document folder')}
                  </p>
                  <div className="relative z-10 mt-auto flex items-center justify-between border-t border-teal-900/10 pt-3">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                      <FileText size={13} />{documentCounts[workspace.id] ?? 0} {c.documents}
                    </span>
                    <span className="flex items-center gap-1">
                      <ChipAction label={`${c.rename} ${workspace.title}`} onClick={() => setEditor({
                        mode: 'rename', id: workspace.id, title: workspace.title, description: workspace.description, error: '',
                      })}><Pencil size={13} /></ChipAction>
                      <ChipAction danger label={`${c.remove} ${workspace.title}`} onClick={() => setDeleteTarget(workspace)}><Trash2 size={13} /></ChipAction>
                    </span>
                  </div>
                </div>
              </article>
            ))}
            <button
              className="mt-6 flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-teal-300 bg-white px-5 text-center text-teal-800 transition hover:border-teal-500 hover:bg-teal-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
              disabled={usage.workspaceCount >= usage.maxPersonalWorkspaces}
              onClick={() => setEditor({ mode: 'create', id: null, title: '', description: '', error: '' })}
              type="button"
            >
              <span className="grid size-11 place-items-center rounded-full bg-teal-100"><FolderPlus size={21} /></span>
              <span className="mt-3 text-sm font-black">{c.newWorkspace}</span>
              <span className="mt-1 text-xs font-medium text-slate-500">{c.workspaceUsage(usage.workspaceCount, usage.maxPersonalWorkspaces)}</span>
            </button>
          </div>
        )}
        {usage.workspaceCount >= usage.maxPersonalWorkspaces ? (
          <p className="mt-2 text-xs font-semibold text-slate-600">
            {c.planLimit(usage.maxPersonalWorkspaces)}
          </p>
        ) : null}
      </div>

      {editor ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/38 p-4" onMouseDown={(event) => event.target === event.currentTarget && setEditor(null)}>
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg" role="dialog" aria-modal="true">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-black text-slate-950">
                {editor.mode === 'create' ? c.newWorkspace : c.renameTitle}
              </h2>
              <IconButton label={c.close} onClick={() => setEditor(null)}><X size={16} /></IconButton>
            </div>
            <label className="mt-4 block text-sm font-bold text-slate-700" htmlFor="workspace-title">{c.name}</label>
            <input
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
              id="workspace-title"
              value={editor.title}
              onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))}
            />
            <label className="mt-3 block text-sm font-bold text-slate-700" htmlFor="workspace-desc">{c.description}</label>
            <input
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
              id="workspace-desc"
              value={editor.description}
              onChange={(event) => setEditor((current) => ({ ...current, description: event.target.value }))}
            />
            {editor.error ? <p className="mt-2 text-sm font-semibold text-red-600" role="alert">{editor.error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditor(null)}>{c.cancel}</Button>
              <Button disabled={busy} onClick={saveEditor}>
                {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}{c.save}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <ConfirmModal
          title={c.deleteTitle}
          actionLabel={c.remove}
          busy={busy}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        >
          {c.deleteBody(deleteTarget.title)}
        </ConfirmModal>
      ) : null}
    </div>
  )
}

export default PersonalWorkspacePanel
