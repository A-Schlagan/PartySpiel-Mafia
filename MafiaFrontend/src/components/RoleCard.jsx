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
                background: isRevealed ? '#fff' : '#333',
                color: isRevealed ? '#000' : '#aaa',
                cursor: 'pointer',
                margin: '20px auto',
                width: '80%'
            }}>
            <h3>Hallo {name}</h3>
            <p style={{fontSize: 14}}>Halte gedrückt, um deine Rolle zu sehen</p>
            
            <div style={{fontSize: 40, fontWeight: 'bold', marginTop: 20}}>
                {isRevealed ? role : "???"}
            </div>
            {isRevealed && <p style={{color: 'red', fontSize: 12}}>Nicht zeigen!</p>}
        </div>
    );
}