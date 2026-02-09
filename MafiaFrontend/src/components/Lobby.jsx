// components/Lobby.jsx
import React, { useState } from 'react';

export default function Lobby({ socket, players, isHost }) {
    const [mafiaCount, setMafiaCount] = useState(1);
    const [hasDoc, setHasDoc] = useState(true);
    const [hasDet, setHasDet] = useState(true);
    const [hasLady, setHasLady] = useState(false);

    const startGame = () => {
        socket.emit('setupGame', { mafiaCount, hasDoctor: hasDoc, hasDetective: hasDet, hasLady });
    };

    if (isHost) {
        return (
            <div className="lobby-host-box">
                <h3>⚙️ Einstellungen</h3>
                <div className="lobby-controls">
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

                    <label>
                        <input type="checkbox" checked={hasLady} onChange={e => setHasLady(e.target.checked)} /> Lady dabei?
                    </label>

                    <button onClick={startGame} className="btn-start-game">
                        ▶️ SPIEL STARTEN
                    </button>
                </div>
            </div>
        );
    }

    // Ansicht für Spieler (nur Liste)
    return (
        <div>
            <h3>Lobby</h3>
            <p>{players.length} Spieler verbunden</p>
            <ul style={{listStyle: 'none', padding: 0}}>
                {players.map(p => (
                    <li key={p.playerId} className="player-list-item">
                        {p.name} {p.role !== 'Spectator' && p.role !== 'Noch nicht verteilt' ? '✅' : ''}
                    </li>
                ))}
            </ul>
        </div>
    );
}