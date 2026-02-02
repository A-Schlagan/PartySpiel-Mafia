// DayPhase.jsx
import React, { useState, useEffect } from 'react';

export default function DayPhase({ socket, phase, me, players, tieCandidates }) {
    const [votedFor, setVotedFor] = useState(null);

    // NEU: Wenn sich die Phase ändert (z.B. von Vote zu Stichwahl), Reset!
    useEffect(() => {
        setVotedFor(null);
    }, [phase]);

    const vote = (targetId) => {
        setVotedFor(targetId);
        socket.emit('voteDay', { voterId: me.playerId, targetId });
    };

    // Filter: Wen darf man wählen?
    let candidates = players.filter(p => p.isAlive && p.playerId !== me.playerId);
    
    // Bei Stichwahl (Tiebreaker) nur die Gleichstand-Kandidaten
    if(phase === 'DAY_TIEBREAKER') {
        candidates = candidates.filter(p => tieCandidates.includes(p.playerId));
    }

    return (
        <div>
            <h1>{phase === 'DAY_DISCUSS' ? 'DISKUSSION 🗣️' : 'ABSTIMMUNG 🗳️'}</h1>
            
            {phase === 'DAY_ANNOUNCE' && <p>Hört auf die Ansage...</p>}
            
            {(phase === 'DAY_VOTE' || phase === 'DAY_TIEBREAKER') && (
                <div>
                    {phase === 'DAY_TIEBREAKER' && <h3 style={{color:'orange'}}>STICHWAHL!</h3>}
                    <p>Wähle jemanden zum Hängen:</p>
                    {candidates.map(p => (
                        <button key={p.playerId} 
                            onClick={() => vote(p.playerId)}
                            disabled={votedFor !== null} // Nur 1x wählen
                            style={{
                                display:'block', width:'100%', margin:5, padding:15, 
                                background: votedFor === p.playerId ? 'orange' : '#ddd',
                                border: '1px solid black'
                            }}>
                            👉 {p.name}
                        </button>
                    ))}
                    {votedFor && <p>Stimme abgegeben.</p>}
                </div>
            )}
        </div>
    );
}