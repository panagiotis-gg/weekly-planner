import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';
import el from './el.json';
import en from './en.json';

/** UI languages (DECISIONS F3): English and Greek. The device language is used when supported. */
export const SUPPORTED_LANGUAGES = ['en', 'el'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const deviceLanguage = getLocales()[0]?.languageCode ?? 'en';
export const language: Language = (SUPPORTED_LANGUAGES as readonly string[]).includes(deviceLanguage)
  ? (deviceLanguage as Language)
  : 'en';

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, el: { translation: el } },
  lng: language,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  // Resources are bundled, so initialise synchronously: date formatters read the language at import.
  initAsync: false,
});

// Lets browsers and screen readers on web pick the right language rules.
if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = language;

export default i18n;
