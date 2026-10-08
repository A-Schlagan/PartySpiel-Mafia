import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSelector() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('mafia_lang', lng);
  };

  return (
    <div className="lang-switcher-container">
      <button 
        type="button"
        onClick={() => changeLanguage('de')} 
        className={`lang-btn ${i18n.language === 'de' ? 'active' : ''}`}
      >
        DE
      </button>
      <button 
        type="button"
        onClick={() => changeLanguage('ru')} 
        className={`lang-btn ${i18n.language === 'ru' ? 'active' : ''}`}
      >
        RU
      </button>
    </div>
  );
}