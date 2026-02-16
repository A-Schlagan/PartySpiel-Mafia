import React, { useState } from 'react';

export default function Lobby({ socket, players, isHost }) {
    const [mafiaCount, setMafiaCount] = useState(1);
    const [hasDoc, setHasDoc] = useState(false);
    const [hasDet, setHasDet] = useState(false);
    const [hasLady, setHasLady] = useState(false);

    const startGame = () => {
        socket.emit('setupGame', { mafiaCount, hasDoctor: hasDoc, hasDetective: hasDet, hasLady });
    };

    if (isHost) {
        return (
            <div className="lobby-host-grid">
                <div className="lobby-row">
                    <label>Anzahl Mafia:</label>
                    <input 
                        type="number" 
                        value={mafiaCount} 
                        onChange={e => setMafiaCount(Number(e.target.value))} 
                        min="1" 
                        className="lobby-input-num"
                    />
                </div>
                
                <div className="lobby-toggles">
                    <label className={`toggle-btn ${hasDoc ? 'active' : ''}`}>
                        <input type="checkbox" checked={hasDoc} onChange={e => setHasDoc(e.target.checked)} hidden />
                        {hasDoc ? '🟢' : '❌'} Arzt
                    </label>
                    
                    <label className={`toggle-btn ${hasDet ? 'active' : ''}`}>
                        <input type="checkbox" checked={hasDet} onChange={e => setHasDet(e.target.checked)} hidden />
                        {hasDet ? '🟢' : '❌'} Detektiv
                    </label>

                    <label className={`toggle-btn ${hasLady ? 'active' : ''}`}>
                        <input type="checkbox" checked={hasLady} onChange={e => setHasLady(e.target.checked)} hidden />
                        {hasLady ? '🟢' : '❌'} Lady
                    </label>
                </div>

                <button onClick={startGame} className="btn-start-game neon-pulse">
                    ▶ SPIEL STARTEN
                </button>
            </div>
        );
    }

    return (
        <div className="player-list-container">
            <h2>Lobby</h2>
            <p className="player-count">{players.length} Spieler verbunden</p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {players.map(p => (
                    <li key={p.playerId} className="player-list-item">
                        <span className="p-name">{p.name}</span>
                        {p.role !== 'Spectator' && p.role !== 'Noch nicht verteilt' && <span className="p-ready">✅</span>}
                    </li>
                ))}
            </ul>
        </div>
    );
}