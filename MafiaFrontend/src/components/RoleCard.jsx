//RoleCard.jsx
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
            style={{
                userSelect: 'none',
                padding: 30,
                border: '3px dashed #555',
                borderRadius: 15,
                background: isRevealed ? '#0d1141' : '#0d1141',
                color: isRevealed ? '#6b94ec' : '#6b94ec',
                cursor: 'pointer',
                margin: '20px auto',
                width: '80%'
            }}>
            <h2>Hallo {name}</h2>
            <p style={{fontSize: 14}}></p>
            
            <div style={{fontSize: 20, fontWeight: 'bold', marginTop: 20}}>
                {isRevealed ? role : "hier gedrückt halten!"}
            </div>
            
        </div>
    );
}