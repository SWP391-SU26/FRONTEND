import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ChevronDown, FileText, Loader2, RotateCcw, Trash2, UploadCloud, X, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { clearFinishedUploads, removeUpload, retryUpload, subscribe } from '../services/uploadService.js'
import { useLocale } from '../i18n/LocaleContext.jsx'
import { localizeApiError } from '../i18n/apiErrorCopy.js'
import { cn } from '../utils/cn.js'

export function UploadProgressPopup() {
  const { locale, t } = useLocale()
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
                {activeCount > 0
                  ? t('uploadProgress.tasksInProgress', { count: activeCount })
                  : t('uploadProgress.activityFinished')}
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                {t('uploadProgress.completed', { count: completedCount })}
                {failedCount ? `, ${t('uploadProgress.failed', { count: failedCount })}` : ''}
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
                {t('uploadProgress.clear')}
              </button>
            ) : null}
            <button
              aria-label={collapsed ? t('uploadProgress.expand') : t('uploadProgress.collapse')}
              className="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              onClick={() => setCollapsed((value) => !value)}
              type="button"
            >
              <motion.span animate={{ rotate: collapsed ? 180 : 0 }}>
                <ChevronDown size={17} />
              </motion.span>
            </button>
            <button
              aria-label={t('uploadProgress.close')}
              className="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              onClick={() => setDismissedBefore(Date.now())}
              title={t('uploadProgress.hide')}
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
                  <UploadProgressItem key={upload.id} locale={locale} t={t} upload={upload} />
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.aside>
    </AnimatePresence>
  )
}

function UploadProgressItem({ locale, t, upload }) {
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
          {failed ? <XCircle size={17} /> : completed ? <CheckCircle2 size={17} /> : upload.action === 'DELETE' ? <Trash2 size={17} /> : <FileText size={17} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-900">{upload.name}</p>
              <p className={cn('mt-0.5 line-clamp-2 text-xs font-semibold', failed ? 'text-red-600' : 'text-slate-500')}>
                {failed
                  ? localizeApiError(upload.errorMessage, locale)
                  : upload.previewKey
                    ? t(upload.previewKey, upload.previewParams)
                    : upload.preview}
              </p>
            </div>
            {!active ? (
              <div className="flex shrink-0 items-center gap-1">
                {failed && upload.documentId && upload.action !== 'DELETE' ? (
                  <button
                    aria-label={t('uploadProgress.retry')}
                    className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-teal-600"
                    onClick={() => retryUpload(upload)}
                    title={t('uploadProgress.retry')}
                    type="button"
                  >
                    <RotateCcw size={14} />
                  </button>
                ) : null}
                <button
                  aria-label={t('uploadProgress.dismiss', { name: upload.name })}
                  className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
                  onClick={() => removeUpload(upload.id)}
                  type="button"
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white shadow-inner">
              <motion.div
                animate={{ width: `${failed ? 100 : progress}%` }}
                className={cn('h-full rounded-full', failed ? 'bg-red-400' : completed ? 'bg-emerald-400' : 'bg-teal-500')}
                transition={{ duration: 0.25 }}
              />
            </div>
            <span className={cn('w-10 text-right text-[11px] font-black', failed ? 'text-red-600' : 'text-slate-500')}>
              {failed ? t('uploadProgress.fail') : `${Math.round(progress)}%`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
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
