// components/DayPhase.jsx
import React, { useState, useEffect } from 'react';

export default function DayPhase({ socket, phase, me, players, tieCandidates, currentVotes }) {
    const [votedFor, setVotedFor] = useState(null);

    useEffect(() => {
        setVotedFor(null);
    }, [phase]);

    const vote = (targetId) => {
        setVotedFor(targetId);
        socket.emit('voteDay', { voterId: me.playerId, targetId });
    };

    let candidates = players.filter(p => p.isAlive && p.playerId !== me.playerId);
    
    if(phase === 'DAY_TIEBREAKER') {
        candidates = candidates.filter(p => tieCandidates.includes(p.playerId));
    }

    const getVotersForCandidate = (candidateId) => {
        // currentVotes ist z.B. { "spielerA_ID": "spielerB_ID", "spielerC_ID": "spielerB_ID" }
        // Wir suchen alle Keys (Wähler), deren Value == candidateId ist
        const voters = Object.entries(currentVotes || {})
            .filter(([voterId, targetId]) => targetId === candidateId)
            .map(([voterId]) => {
                const p = players.find(pl => pl.playerId === voterId);
                return p ? p.name : 'Unbekannt';
            });
        
        return voters;
    };

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
                        {candidates.map(p => {
                            const voters = getVotersForCandidate(p.playerId);
                            
                            return (
                                <button key={p.playerId} 
                                    onClick={() => vote(p.playerId)}
                                    disabled={votedFor !== null} 
                                    className={`btn-vote ${votedFor === p.playerId ? 'selected' : ''}`}
 // !!!!!!!!!Styling für bessere Lesbarkeit der Liste anpassen
                                    style={{ display: 'flex', /*flexDirection: 'column',*/ alignItems: 'center', gap: '5px' }}
                                >
                                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>👉 {p.name}</span>
                                    
                                    {voters.length > 0 && (
                                        <div style={{ fontSize: '0.8rem', color: '#154717', marginTop: '2px' }}>
                                            {voters.map(v => ` ${v}`).join(', ')}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    
                    {votedFor && <p className="vote-confirmed">Stimme abgegeben.</p>}
                </div>
            )}
        </div>
    );
}