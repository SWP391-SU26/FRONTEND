import { Loader2, X } from 'lucide-react'
import { useState } from 'react'

import { Button, IconButton } from './ui.jsx'
import { useLocale } from '../i18n/LocaleContext.jsx'

const copy = {
  vi: { title: 'Chuyển không gian', close: 'Đóng', empty: 'Bạn chưa có không gian cá nhân nào khác. Hãy tạo thêm một không gian để chuyển tài liệu này.', cancel: 'Hủy', move: 'Chuyển' },
  en: { title: 'Move to workspace', close: 'Close', empty: 'You do not have another personal workspace yet. Create one before moving this document.', cancel: 'Cancel', move: 'Move' },
}

/** REQ-02 WS-US-03: pick another personal workspace to move a document into. */
export function MoveDocumentModal({ document, workspaces, onCancel, onConfirm }) {
  const { locale } = useLocale()
  const c = copy[locale] ?? copy.vi
  const targets = workspaces.filter((workspace) => workspace.id !== document.workspaceId)
  const [workspaceId, setWorkspaceId] = useState(targets[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    if (!workspaceId) return
    setBusy(true)
    setError('')
    try {
      await onConfirm(workspaceId)
    } catch (requestError) {
      setError(requestError.message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/38 p-4" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-black text-slate-950">{c.title}</h2>
          <IconButton label={c.close} onClick={onCancel}><X size={16} /></IconButton>
        </div>
        <p className="mt-2 truncate text-sm font-semibold text-slate-600">{document.displayName}</p>

        {targets.length === 0 ? (
          <p className="mt-4 text-sm font-semibold text-slate-500">
            {c.empty}
          </p>
        ) : (
          <fieldset className="mt-4 space-y-1.5">
            {targets.map((workspace) => (
              <label
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                key={workspace.id}
              >
                <input
                  checked={workspaceId === workspace.id}
                  className="size-4 accent-teal-700"
                  name="move-target-workspace"
                  onChange={() => setWorkspaceId(workspace.id)}
                  type="radio"
                  value={workspace.id}
                />
                {workspace.title}
              </label>
            ))}
          </fieldset>
        )}

        {error ? <p className="mt-3 text-sm font-semibold text-red-600" role="alert">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>{c.cancel}</Button>
          <Button disabled={!workspaceId || busy} onClick={confirm}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : null}{c.move}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default MoveDocumentModal
