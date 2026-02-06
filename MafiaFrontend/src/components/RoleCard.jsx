// components/RoleCard.jsx
import React, { useState } from 'react';

export default function RoleCard({ role, name }) {
    const [isRevealed, setIsRevealed] = useState(false);

    // Events für Maus und Touch (Handy)
    const startReveal = () => setIsRevealed(true);
    const endReveal = () => setIsRevealed(false);

    return (
        <div 
            onMouseDown={startReveal} onMouseUp={endReveal} onMouseLeave={endReveal}
            onTouchStart={startReveal} onTouchEnd={endReveal}
            className={`role-card ${isRevealed ? 'revealed' : ''}`}>
            
            <h2>DEINE ROLLE</h2>
            <p style={{fontSize: 14}}></p>
            
            <div style={{fontSize: 15, fontWeight: 'bold', marginTop: 20}}>
                {isRevealed ? role : "hier gedrückt halten!"}
            </div>
            
        </div>
    );
}