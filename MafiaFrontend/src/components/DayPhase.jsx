import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function DayPhase({ socket, phase, me, players, tieCandidates, currentVotes, opener }) {
    const { t } = useTranslation();
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
            return p ? p.name : t('day.unknown');
        });

    const getVotersForCandidate = (candidateId) => {
        const voters = Object.entries(currentVotes || {})
            .filter(([voterId, targetId]) => targetId === candidateId)
            .map(([voterId]) => {
                const p = players.find(pl => pl.playerId === voterId);
                return p ? p.name : t('day.unknown');
            });

        return voters;
    };

    const getPhaseTitle = () => {
        if (phase === 'DAY_DISCUSS') return t('day.title_discuss');
        if (phase === 'DAY_VOTE' || phase === 'DAY_TIEBREAKER') return t('day.title_vote');
        return t('day.title_report'); 
    };

    return (
        <div className="day-phase-container">
            <h1>{getPhaseTitle()}</h1>

            {phase === 'DAY_ANNOUNCE' && (
                <p className="pulse-text" style={{fontSize: '1.2rem', color: '#aaa'}}>
                    {t('day.announcement')}
                </p>
            )}

            {phase === 'DAY_DISCUSS' && opener && (
                <div className="opener-box">
                    <span className="opener-label">{t('day.opener_label')}</span>
                    <span className="opener-name">🎤 {opener}</span>
                </div>
            )}

            {(phase === 'DAY_VOTE' || phase === 'DAY_TIEBREAKER') && (
                <div className="vote-section">

                    {phase === 'DAY_TIEBREAKER' ? (
                        <div className="tiebreaker-info">
                            <h3 className="tie-title">{t('day.tie_title')}</h3>
                            <p>
                                {t('day.tie_desc')}
                                <br />
                                <small>{t('day.tie_subdesc')}</small>
                            </p>
                        </div>
                    ) : (
                        <p>{t('day.vote_prompt')}</p>
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

                    <div className="votes-against-me-box">
                        <p className="votes-against-me-title">{t('day.votes_against_me')}</p>
                        <div className="votes-against-me-list">
                            {votesAgainstMe.length > 0
                                ? `😒 ${votesAgainstMe.join(', ')}`
                                : <span style={{ color: '#161B1F', fontStyle: 'italic', fontWeight: 'normal' }}>{t('day.no_votes')}</span>
                            }
                        </div>
                    </div>

                    {votedFor && <p className="vote-confirmed">{t('day.vote_confirmed')}</p>}
                </div>
            )}
        </div>
    );
}