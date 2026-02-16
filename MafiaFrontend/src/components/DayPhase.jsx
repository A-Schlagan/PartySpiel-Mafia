// components/DayPhase.jsx
import React, { useState, useEffect } from 'react';

export default function DayPhase({ socket, phase, me, players, tieCandidates, currentVotes, opener }) {
    const [votedFor, setVotedFor] = useState(null);

    useEffect(() => {
        setVotedFor(null);
    }, [phase]);

    const vote = (targetId) => {
        setVotedFor(targetId);
        socket.emit('voteDay', { voterId: me.playerId, targetId });
    };

    let candidates = players.filter(p => p.isAlive && p.playerId !== me.playerId);

    if (phase === 'DAY_TIEBREAKER') {
        candidates = candidates.filter(p => tieCandidates.includes(p.playerId));
    }

    const votesAgainstMe = Object.entries(currentVotes || {})
        .filter(([_, targetId]) => targetId === me.playerId)
        .map(([voterId]) => {
            const p = players.find(pl => pl.playerId === voterId);
            return p ? p.name : 'Unbekannt';
        });

    const getVotersForCandidate = (candidateId) => {
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

            {phase === 'DAY_DISCUSS' && opener && (
                <div className="opener-box">
                    <span className="opener-label">Das erste Wort geht heute an:</span>
                    <span className="opener-name">🎤 {opener}</span>
                </div>
            )}

            {(phase === 'DAY_VOTE' || phase === 'DAY_TIEBREAKER') && (
                <div className="vote-section">

                    {phase === 'DAY_TIEBREAKER' ? (
                        <div className="tiebreaker-info">
                            <h3 className="tie-title">STICHWAHL!</h3>
                            <p>
                                Gleichstand! Ihr müsst euch zwischen diesen Spielern entscheiden.
                                <br />
                                <small>Bei erneutem Gleichstand stirbt niemand!</small>
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
                                    style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
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

                    {/* --- Stimmen gegen MICH --- */}
                    <div style={{
                        marginTop: '10px',
                        padding: '10px',
                        backgroundColor: '#ffebee75',
                        border: '1px solid #ef9a9a',
                        borderRadius: '8px',
                        color: '#ae4951'
                    }}>
                        <p style={{ margin: 0, fontWeight: 'bold', color: '#161B1F' }}>Gegen DICH haben gestimmt:</p>
                        <div style={{ marginTop: '5px', fontSize: '1.1rem' }}>
                            {votesAgainstMe.length > 0
                                ? `😒 ${votesAgainstMe.join(', ')}`
                                : <span style={{ color: '#161B1F', fontStyle: 'italic' }}>😎 Noch niemand...</span>
                            }
                        </div>
                    </div>

                    {votedFor && <p className="vote-confirmed">Stimme abgegeben.</p>}
                </div>
            )}
        </div>
    );
}