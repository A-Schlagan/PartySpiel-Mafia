import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function RoleCard({ role, name }) {
    const { t } = useTranslation();
    const [isRevealed, setIsRevealed] = useState(false);
    const startReveal = () => setIsRevealed(true);
    const endReveal = () => setIsRevealed(false);

    return (
        <div 
            onMouseDown={startReveal} onMouseUp={endReveal} onMouseLeave={endReveal}
            onTouchStart={startReveal} onTouchEnd={endReveal}
            className={`role-card ${isRevealed ? 'revealed' : ''}`}>
            
            <h2>{t('role_card.title')}</h2>
            
            <div style={{fontSize: 15, fontWeight: 'bold', marginTop: 20}}>
                {isRevealed ? role : t('role_card.hold_prompt')}
            </div>
            
        </div>
    );
}