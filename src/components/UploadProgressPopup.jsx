import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ChevronDown, FileText, Loader2, RefreshCw, Trash2, UploadCloud, X, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { clearFinishedUploads, removeUpload, subscribe } from '../services/uploadService.js'
import { cn } from '../utils/cn.js'

export function UploadProgressPopup() {
  const [uploads, setUploads] = useState([])
  const [collapsed, setCollapsed] = useState(false)
  const [dismissedBefore, setDismissedBefore] = useState(0)

  useEffect(() => subscribe(setUploads), [])

  const visibleUploads = useMemo(() => {
    return uploads
      .slice(0, 5)
  }, [uploads])

  const activeCount = visibleUploads.filter(isActiveUpload).length
  const failedCount = visibleUploads.filter((upload) => upload.status === 'Failed').length
  const completedCount = visibleUploads.filter(isCompletedUpload).length
  const hasNewUpload = visibleUploads.some((upload) => upload.createdAt > dismissedBefore)

  if (visibleUploads.length === 0 || !hasNewUpload) return null

  return (
    <AnimatePresence>
      <motion.aside
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="fixed bottom-5 right-5 z-[70] w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-teal-100 bg-white/95 shadow-2xl shadow-slate-900/18 backdrop-blur-xl"
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        initial={{ opacity: 0, y: 22, scale: 0.97 }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-500 text-white shadow-lg shadow-teal-500/20">
              {activeCount > 0 ? <Loader2 className="animate-spin" size={18} /> : <UploadCloud size={18} />}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black text-slate-950">
                {activeCount > 0 ? `${activeCount} tác vụ đang xử lý` : 'Đã xử lý xong'}
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                {completedCount} hoàn tất{failedCount ? `, ${failedCount} thất bại` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {!activeCount ? (
              <button
                className="rounded-lg px-2 py-1 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                onClick={clearFinishedUploads}
                type="button"
              >
                Xóa xong
              </button>
            ) : null}
            <button
              aria-label={collapsed ? 'Mở rộng tiến trình' : 'Thu gọn tiến trình'}
              className="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              onClick={() => setCollapsed((value) => !value)}
              type="button"
            >
              <motion.span animate={{ rotate: collapsed ? 180 : 0 }}>
                <ChevronDown size={17} />
              </motion.span>
            </button>
            <button
              aria-label="Đóng popup tiến trình"
              className="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              onClick={() => setDismissedBefore(Date.now())}
              title="Ẩn tiến trình"
              type="button"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {!collapsed ? (
            <motion.div
              animate={{ height: 'auto', opacity: 1 }}
              className="max-h-80 overflow-y-auto p-3"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
            >
              <div className="space-y-2">
                {visibleUploads.map((upload) => (
                  <UploadProgressItem key={upload.id} upload={upload} />
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.aside>
    </AnimatePresence>
  )
}

function UploadProgressItem({ upload }) {
  const failed = upload.status === 'Failed'
  const completed = isCompletedUpload(upload)
  const active = isActiveUpload(upload)
  const progress = Number.isFinite(upload.progress) ? upload.progress : 0

  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        failed ? 'border-red-100 bg-red-50/80' : completed ? 'border-emerald-100 bg-emerald-50/70' : 'border-slate-100 bg-slate-50/80',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg',
            failed ? 'bg-red-100 text-red-600' : completed ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-teal-600',
          )}
        >
          {failed ? <XCircle size={17} /> : completed ? <CheckCircle2 size={17} /> : operationIcon(upload.action)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-900">{upload.name}</p>
              <p className={cn('mt-0.5 line-clamp-2 text-xs font-semibold', failed ? 'text-red-600' : 'text-slate-500')}>
                {failed ? upload.errorMessage : upload.preview}
              </p>
            </div>
            {!active ? (
              <button
                aria-label={`Ẩn tác vụ ${upload.name}`}
                className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
                onClick={() => removeUpload(upload.id)}
                type="button"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white shadow-inner">
              {upload.indeterminate && active ? (
                <motion.div
                  animate={{ x: ['-100%', '280%'] }}
                  className="h-full w-1/3 rounded-full bg-teal-500"
                  transition={{ duration: 1.1, ease: 'easeInOut', repeat: Infinity }}
                />
              ) : (
                <motion.div
                  animate={{ width: `${failed ? 100 : progress}%` }}
                  className={cn('h-full rounded-full', failed ? 'bg-red-400' : completed ? 'bg-emerald-400' : 'bg-teal-500')}
                  transition={{ duration: 0.25 }}
                />
              )}
            </div>
            <span className={cn('w-10 text-right text-[11px] font-black', failed ? 'text-red-600' : 'text-slate-500')}>
              {failed ? 'Lỗi' : upload.indeterminate && active ? 'Chờ' : `${Math.round(progress)}%`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function operationIcon(action) {
  if (action === 'DELETE') return <Trash2 size={17} />
  if (action === 'UPDATE') return <RefreshCw size={17} />
  return <FileText size={17} />
}

function isCompletedUpload(upload) {
  return upload.status !== 'Failed' && (
    upload.stage === 'Completed' ||
    upload.status === 'Indexed' ||
    upload.progress >= 100 ||
    upload.isUploading === false
  )
}

function isActiveUpload(upload) {
  return upload.status !== 'Failed' && !isCompletedUpload(upload)
}
