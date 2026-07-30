import { Languages } from 'lucide-react'
import { useLocale } from '../i18n/LocaleContext.jsx'
import { cn } from '../utils/cn.js'

export function LanguageSwitch({ compact = false, className }) {
  const { locale, toggleLocale, t } = useLocale()
  const nextLabel = locale === 'vi' ? t('common.english') : t('common.vietnamese')

  return (
    <button
      aria-label={`${t('common.language')}: ${nextLabel}`}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 text-xs font-black text-slate-600 shadow-sm transition hover:bg-teal-50 hover:text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600',
        compact && 'size-10 px-0',
        className,
      )}
      onClick={toggleLocale}
      title={`${t('common.language')}: ${nextLabel}`}
      type="button"
    >
      <Languages size={16} />
      {!compact ? <span>{locale === 'vi' ? 'VI' : 'EN'}</span> : null}
    </button>
  )
}
