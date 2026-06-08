import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import es from './locales/es.json'

i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    resources: { en: { translation: en }, es: { translation: es } },
    fallbackLng: 'es',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'qms-language',
    },
    interpolation: { escapeValue: false },
  })

export default i18n
