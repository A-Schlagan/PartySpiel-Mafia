import React, { useState, useEffect } from 'react';

export default function NightPhase({ socket, phase, me, players }) {
    const [mafiaVotes, setMafiaVotes] = useState({});
    const [hasActed, setHasActed] = useState(false); 

    useEffect(() => {
        setHasActed(false);
        socket.on('mafiaVoteUpdate', (votes) => setMafiaVotes(votes));
        return () => socket.off('mafiaVoteUpdate');
    }, [socket, phase]);

    const sendAction = (targetId) => {
        if (phase !== 'NIGHT_MAFIA') {
            setHasActed(true); 
        }

        if(phase === 'NIGHT_MAFIA') socket.emit('mafiaVote', { voterId: me.playerId, targetId });
        if(phase === 'NIGHT_DOCTOR') socket.emit('doctorAction', targetId);
        if(phase === 'NIGHT_DETECTIVE') socket.emit('detectiveAction', targetId);
    };

    // --- 1. MAFIA BLOCK  ---
    if (phase === 'NIGHT_MAFIA' && me.role === 'Mafia') {
        return (
            <div>
                <h2 style={{color:'red'}}>MAFIA TREFFEN</h2>
                <p>Einigt euch auf ein Ziel!</p>
                {players.filter(p => p.isAlive && p.role !== 'Mafia').map(p => {
                    // Wer hat diesen Spieler gewählt?
                    const voters = Object.keys(mafiaVotes).filter(vid => mafiaVotes[vid] === p.playerId);
                    // Namen der Voter finden
                    const voterNames = voters.map(vid => players.find(x => x.playerId === vid)?.name).join(", ");
                    
                    return (
                        <button key={p.playerId} onClick={() => sendAction(p.playerId)} 
                            style={{
                                display:'block', width:'100%', margin:5, padding:15, 
                                background: voters.length > 0 ? '#800000' : '#333', // Dunkelrot wenn gewählt
                                color:'white',
                                border: '1px solid red'
                            }}>
                            💀 {p.name} {voters.length > 0 && <small>({voterNames})</small>}
                        </button>
                    )
                })}
            </div>
        );
    }

    // --- 2. ARZT BLOCK ---
    if (phase === 'NIGHT_DOCTOR' && me.role === 'Arzt') {
        return (
            <div>
                <h2 style={{color:'green'}}>ARZT</h2>
                <p>Wen möchtest du retten?</p>
                {hasActed ? <p>Du hast deine Wahl getroffen.</p> : (
                    players.filter(p => p.isAlive).map(p => (
                        <button key={p.playerId} onClick={() => sendAction(p.playerId)} 
                            style={{display:'block', width:'100%', margin:5, padding:15, background: 'green', color:'white'}}>
                            ❤️ {p.name}
                        </button>
                    ))
                )}
            </div>
        )
    }

    // --- 3. DETEKTIV BLOCK ---
    if (phase === 'NIGHT_DETECTIVE' && me.role === 'Detektiv') {
        return (
            <div>
                <h2 style={{color:'blue'}}>DETEKTIV</h2>
                <p>Wen möchtest du prüfen?</p>
                {hasActed ? <p>Prüfung läuft...</p> : (
                    players.filter(p => p.isAlive && p.playerId !== me.playerId).map(p => (
                        <button key={p.playerId} onClick={() => sendAction(p.playerId)} 
                            style={{display:'block', width:'100%', margin:5, padding:15, background: 'blue', color:'white'}}>
                            🔍 {p.name}
                        </button>
                    ))
                )}
            </div>
        )
    }

    // --- 4. ALLE ANDEREN (SCHLAFEN) ---
    return (
        <div style={{marginTop: 50}}>
            <h2>Nachtphase</h2>
            <p>Du schläfst... zzz...</p>
            <div style={{fontSize: 50}}>🌙</div>
        </div>
    );
}