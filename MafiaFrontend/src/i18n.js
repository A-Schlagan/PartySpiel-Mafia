import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import translationDE from './locales/de.json';
import translationRU from './locales/ru.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: translationDE },
      ru: { translation: translationRU }
    },
    lng: localStorage.getItem('mafia_lang') || 'de',
    fallbackLng: 'de',
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;