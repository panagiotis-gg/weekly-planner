import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';

/** English only for now; strings are externalised so more locales can be added (DECISIONS F3). */
const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: getLocales()[0]?.languageCode ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
