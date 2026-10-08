import React, { useState, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';

const TimerBar = memo(({ duration }) => (
    <div className="timer-container">
        <div key={duration} className="timer-bar" style={{ animationDuration: `${duration}ms` }}></div>
    </div>
));

export default function NightPhase({ socket, phase, me, players, duration }) {
    const { t } = useTranslation();
    const [mafiaVotes, setMafiaVotes] = useState({});
    const [hasActed, setHasActed] = useState(false);
    const [localSelection, setLocalSelection] = useState(null); 

    useEffect(() => {
        if (me.isAlive) {
            if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 150, 50, 200]);
        }
    }, []);

    useEffect(() => {
        setMafiaVotes({});
        setLocalSelection(null); 

        if (me.lastAction) {
            setHasActed(true);
        } else {
            setHasActed(false);
        }
    }, [phase, me.lastAction]);

    useEffect(() => {
        const handleMafiaUpdate = (votes) => {
            setMafiaVotes(votes);
        };
        socket.on('mafiaVoteUpdate', handleMafiaUpdate);
        return () => { socket.off('mafiaVoteUpdate', handleMafiaUpdate); };
    }, [socket]);

    const handleActionClick = (targetId) => {
        if (!me.isAlive) return;
        
        setLocalSelection(targetId);

        if (phase === 'NIGHT_MAFIA') {
            socket.emit('mafiaVote', { voterId: me.playerId, targetId });
        } else {
            setTimeout(() => {
                setHasActed(true); 
                if (phase === 'NIGHT_DOCTOR') socket.emit('doctorAction', targetId);
                if (phase === 'NIGHT_DETECTIVE') socket.emit('detectiveAction', targetId);
                if (phase === 'NIGHT_LADY') socket.emit('ladyAction', targetId);
            }, 2000); 
        }
    };

    const isActive = 
        (phase === 'NIGHT_MAFIA' && me.role === 'Mafia' && me.isAlive) ||
        (phase === 'NIGHT_DOCTOR' && me.role === 'Arzt' && me.isAlive) ||
        (phase === 'NIGHT_DETECTIVE' && me.role === 'Detektiv' && me.isAlive) ||
        (phase === 'NIGHT_LADY' && me.role === 'Lady' && me.isAlive);

    if (phase === 'NIGHT_TRANSITION') {
        return (
            <div className="eye-close-container">
                <div className="eye-text">{t('night.transition_desc')}</div>
                <div className="eye-icon">😴</div>
                <div className="eye-text" style={{ fontSize: '3rem', color: '#ff0000' }}>{t('night.eyes_closed')}</div>
            </div>
        );
    }

    const renderContent = () => {
        
        if (phase === 'NIGHT_MAFIA' && me.role === 'Mafia' && me.isAlive) {
            const otherMafias = players.filter(p => p.role === 'Mafia' && p.playerId !== me.playerId);
            return (
                <div>
                    <h2 style={{ color: 'red', textShadow: '0 0 10px black' }}>{t('night.mafia_title')}</h2>

                    {otherMafias.length > 0 && (
                        <div className="teammate-box">
                            <span className="teammate-label">{t('night.mafia_partners')}:</span>
                            <div>
                                {otherMafias.map(p => (
                                    <span key={p.playerId} className="teammate-badge">
                                        😈 {p.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <p>{t('night.mafia_choose')}:</p>
                    <div className="grid-container">
                        {players.filter(p => p.isAlive && p.role !== 'Mafia').map(p => {
                            const voterIds = Object.keys(mafiaVotes).filter(vid => mafiaVotes[vid] === p.playerId);                    
                            const isMySelection = mafiaVotes[me.playerId] === p.playerId || localSelection === p.playerId;
                            const voterNames = voterIds.map(vid => {
                                const voter = players.find(pl => pl.playerId === vid);
                                return voter ? voter.name : t('night.unknown');
                            });
                            
                            return (
                                <button key={p.playerId} onClick={() => handleActionClick(p.playerId)}
                                    className={`action-btn btn-mafia ${voterIds.length > 0 ? 'voted' : ''} ${isMySelection ? 'btn-selected-shine' : ''}`}
                                    style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }} 
                                >
                                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>💀 {p.name}</span>
                                    {voterNames.length > 0 && (
                                        <div style={{ fontSize: '0.9rem', color: '#ff8a80', textAlign: 'right' }}>
                                            <span style={{color: '#aaa', fontSize: '0.8rem', marginRight: '5px'}}>👈</span>
                                            {voterNames.join(', ')}
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>
            );
        }

        if (phase === 'NIGHT_DOCTOR' && me.role === 'Arzt' && me.isAlive) {
            return (
                <div>
                    <h2 style={{ color: 'green' }}>{t('night.doctor_title')}</h2>
                    <p>{t('night.doctor_choose')}</p>
                    <p style={{ fontSize: '0.6rem', color: '#ccc' }}>({t('night.doctor_desc')})</p>
                    {hasActed ? <div className="status-msg fade-in">{t('night.doctor_done')}</div> : (
                        players.filter(p => p.isAlive).map(p => (
                            <button key={p.playerId} onClick={() => handleActionClick(p.playerId)} 
                                className={`action-btn btn-doctor ${localSelection === p.playerId ? 'btn-selected-shine' : ''}`}>
                                ❤️ {p.name}
                            </button>
                        ))
                    )}
                </div>
            )
        }

        if (phase === 'NIGHT_DETECTIVE' && me.role === 'Detektiv' && me.isAlive) {
            return (
                <div>
                    <h2 style={{ color: 'blue' }}>{t('night.detective_title')}</h2>
                    <p>{t('night.detective_choose')}</p>
                    {hasActed ? <div className="status-msg fade-in">{t('night.detective_done')}</div> : (
                        players.filter(p => p.isAlive && p.playerId !== me.playerId).map(p => (
                            <button key={p.playerId} onClick={() => handleActionClick(p.playerId)} 
                                className={`action-btn btn-detective ${localSelection === p.playerId ? 'btn-selected-shine' : ''}`}>
                                🔍 {p.name}
                            </button>
                        ))
                    )}
                </div>
            )
        }

        if (phase === 'NIGHT_LADY' && me.role === 'Lady' && me.isAlive) {
            return (
                <div>
                    <h2 style={{ color: '#9c27b0' }}>{t('night.lady_title')}</h2>
                    <p>{t('night.lady_choose')}</p>
                    <p style={{ fontSize: '0.6rem', color: '#ccc' }}>({t('night.lady_desc')})</p>
                    {hasActed ? <div className="status-msg fade-in">{t('night.lady_done')}</div> : (
                        players.filter(p => p.isAlive && p.playerId !== me.playerId).map(p => (
                            <button key={p.playerId} onClick={() => handleActionClick(p.playerId)} 
                                className={`action-btn btn-lady ${localSelection === p.playerId ? 'btn-selected-shine' : ''}`}>
                                💋 {p.name}
                            </button>
                        ))
                    )}
                </div>
            )
        }

        return (
            <div className="eye-close-container">
                <h2>{t('night.sleep_title')}</h2>
                <div className="eye-icon" style={{ animation: 'none', fontSize: '60px' }}>🌙</div>
                <p>🌙 {t('night.sleeping')}</p>
            </div>
        );
    };

    return (
        <div>
            {isActive && <TimerBar key={phase} duration={duration} />}
            {renderContent()}
        </div>
    );
}