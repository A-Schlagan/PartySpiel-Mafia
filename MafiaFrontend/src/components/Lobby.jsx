// Lobby.jsx
import React, { useState } from 'react';

export default function Lobby({ socket, players, isHost }) {
    const [mafiaCount, setMafiaCount] = useState(1);
    const [hasDoc, setHasDoc] = useState(true);
    const [hasDet, setHasDet] = useState(true);

    const startGame = () => {
        socket.emit('setupGame', { mafiaCount, hasDoctor: hasDoc, hasDetective: hasDet });
    };

    if (isHost) {
        return (
            <div style={{ background: '#eef', padding: 15, borderRadius: 8 }}>
                <h3>⚙️ Einstellungen</h3>
                <div style={{display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start'}}>
                    <label>
                        Anzahl Mafia: 
                        <input type="number" value={mafiaCount} onChange={e => setMafiaCount(Number(e.target.value))} style={{width: 50, marginLeft: 10}} min="1" />
                    </label>
                    
                    <label>
                        <input type="checkbox" checked={hasDoc} onChange={e => setHasDoc(e.target.checked)} /> Arzt dabei?
                    </label>
                    
                    <label>
                        <input type="checkbox" checked={hasDet} onChange={e => setHasDet(e.target.checked)} /> Detektiv dabei?
                    </label>

                    <button onClick={startGame} style={{padding: 15, background: 'green', color: 'white', fontSize: 18, border: 'none', borderRadius: 5, width: '100%', cursor: 'pointer', marginTop: 10}}>
                        ▶️ SPIEL STARTEN
                    </button>
                </div>
            </div>
        );
    }

    // Ansicht für normale Spieler (nur Liste)
    return (
        <div>
            <h3>Lobby</h3>
            <p>{players.length} Spieler verbunden</p>
            <ul style={{listStyle: 'none', padding: 0}}>
                {players.map(p => (
                    <li key={p.playerId} style={{padding: 5, borderBottom: '1px solid #eee'}}>
                        {p.name} {p.role !== 'Spectator' && p.role !== 'Noch nicht verteilt' ? '✅' : ''}
                    </li>
                ))}
            </ul>
        </div>
    );
}