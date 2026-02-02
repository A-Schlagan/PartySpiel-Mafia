//Lobby.jsx
import React, { useState } from 'react';

export default function Lobby({ socket, players, isHost }) {
    const [mafiaCount, setMafiaCount] = useState(1);
    const [hasDoc, setHasDoc] = useState(true);
    const [hasDet, setHasDet] = useState(true);

    const startGame = () => {
        socket.emit('setupGame', { mafiaCount, hasDoctor: hasDoc, hasDetective: hasDet });
    };

    return (
        <div>
            <h1>Lobby</h1>
            <p>{players.length} Spieler verbunden</p>
            <ul>
                {players.map(p => <li key={p.playerId}>{p.name}</li>)}
            </ul>

            {/* Nur Host sieht Einstellungen */}
            {isHost && (
                <div style={{border: '1px solid #ccc', padding: 15, marginTop: 20}}>
                    <h3>Spieleinstellungen</h3>
                    <label>Anzahl Mafia: 
                        <input type="number" value={mafiaCount} onChange={e => setMafiaCount(Number(e.target.value))} style={{width: 50, marginLeft: 10}} />
                    </label> <br/><br/>
                    
                    <label>
                        <input type="checkbox" checked={hasDoc} onChange={e => setHasDoc(e.target.checked)} /> Arzt dabei?
                    </label> <br/>
                    
                    <label>
                        <input type="checkbox" checked={hasDet} onChange={e => setHasDet(e.target.checked)} /> Detektiv dabei?
                    </label> <br/><br/>

                    <button onClick={startGame} style={{padding: 15, background: 'green', color: 'white', fontSize: 18}}>SPIEL STARTEN</button>
                </div>
            )}
            {!isHost && <p>Warte auf Host für Spielstart...</p>}
        </div>
    );
}