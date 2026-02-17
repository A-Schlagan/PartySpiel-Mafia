import React, { useState } from 'react';

export default function Lobby({ socket, players, isHost }) {
    const [mafiaCount, setMafiaCount] = useState(1);
    const [hasDoc, setHasDoc] = useState(true);
    const [hasDet, setHasDet] = useState(true);
    const [hasLady, setHasLady] = useState(false);

    const startGame = () => {
        socket.emit('setupGame', { mafiaCount, hasDoctor: hasDoc, hasDetective: hasDet, hasLady });
    };

    return (
        <div className="lobby-wrapper">
            {isHost && (
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
                            {hasDoc ? '🟢' : '?'} Arzt
                        </label>
                        
                        <label className={`toggle-btn ${hasDet ? 'active' : ''}`}>
                            <input type="checkbox" checked={hasDet} onChange={e => setHasDet(e.target.checked)} hidden />
                            {hasDet ? '🟢' : '?'} Detektiv
                        </label>

                        <label className={`toggle-btn ${hasLady ? 'active' : ''}`}>
                            <input type="checkbox" checked={hasLady} onChange={e => setHasLady(e.target.checked)} hidden />
                            {hasLady ? '🟢' : '?'} Lady
                        </label>
                    </div>

                    <button onClick={startGame} className="btn-start-game neon-pulse">
                        ▶ SPIEL STARTEN
                    </button>
                    
                    <hr className="menu-divider" style={{margin: '25px 0', borderColor: '#333'}} />
                </div>
            )}

            <div className="player-list-container">
                <h3 style={{marginTop: 0, textAlign: 'center', fontSize: '1rem', color: '#888'}}>
                    WARTEZIMMER
                </h3>
                <p className="player-count">{players.length} Spieler bereit</p>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {players.map(p => (
                        <li key={p.playerId} className="player-list-item">
                            <span className="p-name">{p.name}</span>
                            {p.role !== 'Spectator' && p.role !== 'Noch nicht verteilt' && <span className="p-ready">✅</span>}
                            {(p.playerId === 'host' || p.role === 'Spectator') && <span style={{fontSize: '1.2rem'}}>👑</span>}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}