// components/DayPhase.jsx
import React, { useState, useEffect } from 'react';

export default function DayPhase({ socket, phase, me, players, tieCandidates }) {
    const [votedFor, setVotedFor] = useState(null);

    // Reset Vote, wenn die Phase von VOTE auf TIEBREAKER wechselt
    useEffect(() => {
        setVotedFor(null);
    }, [phase]);

    const vote = (targetId) => {
        setVotedFor(targetId);
        socket.emit('voteDay', { voterId: me.playerId, targetId });
    };

    // Filter: Wen darf man wählen?
    let candidates = players.filter(p => p.isAlive && p.playerId !== me.playerId);
    
    // Bei Stichwahl (Tiebreaker) nur die Gleichstand-Kandidaten anzeigen
    if(phase === 'DAY_TIEBREAKER') {
        candidates = candidates.filter(p => tieCandidates.includes(p.playerId));
    }

    return (
        <div className="day-phase-container">
            <h1>{phase === 'DAY_DISCUSS' ? 'DISKUSSION 🗣️' : 'ABSTIMMUNG 🗳️'}</h1>
            
            {phase === 'DAY_ANNOUNCE' && <p>Bereitet euch für die Abstimmung...</p>}
            
            {(phase === 'DAY_VOTE' || phase === 'DAY_TIEBREAKER') && (
                <div className="vote-section">
                    
                    {phase === 'DAY_TIEBREAKER' ? (
                        <div className="tiebreaker-info">
                            <h3 className="tie-title">STICHWAHL!</h3>
                            <p>
                                Es gab einen Gleichstand. Ihr müsst euch zwischen den markierten Spielern entscheiden. 
                                <br/>
                                <small>Bei erneutem Gleichstand stirbt niemand.</small>
                            </p>
                        </div>
                    ) : (
                        <p>Wähle jemanden zum Hängen:</p>
                    )}

                    <div className="candidates-grid">
                        {candidates.map(p => (
                            <button key={p.playerId} 
                                onClick={() => vote(p.playerId)}
                                disabled={votedFor !== null} // Nur 1x wählen
                                className={`btn-vote ${votedFor === p.playerId ? 'selected' : ''}`}>
                                👉 {p.name}
                            </button>
                        ))}
                    </div>

                    {votedFor && <p className="vote-confirmed">Stimme abgegeben.</p>}
                </div>
            )}
        </div>
    );
}