/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, translations } from './translations.js'

const LocaleContext = createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  toggleLocale: () => {},
  t: (key) => key,
})

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY)
    return saved && translations[saved] ? saved : DEFAULT_LOCALE
  })

  const setLocale = useCallback((nextLocale) => {
    const normalized = translations[nextLocale] ? nextLocale : DEFAULT_LOCALE
    localStorage.setItem(LOCALE_STORAGE_KEY, normalized)
    setLocaleState(normalized)
  }, [])

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'vi' ? 'en' : 'vi')
  }, [locale, setLocale])

  const value = useMemo(() => ({
    locale,
    setLocale,
    toggleLocale,
    t: (key, params = {}) => translate(locale, key, params),
  }), [locale, setLocale, toggleLocale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  return useContext(LocaleContext)
}

function translate(locale, key, params) {
  const value = key.split('.').reduce((current, part) => current?.[part], translations[locale])
    ?? key.split('.').reduce((current, part) => current?.[part], translations[DEFAULT_LOCALE])
    ?? key
  if (typeof value !== 'string') return key
  return value.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''))
}
