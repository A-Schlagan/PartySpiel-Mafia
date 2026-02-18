import React, { useState, useEffect, memo } from 'react';

const TimerBar = memo(({ duration }) => (
    <div className="timer-container">
        <div key={duration} className="timer-bar" style={{ animationDuration: `${duration}ms` }}></div>
    </div>
));

export default function NightPhase({ socket, phase, me, players, duration }) {
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

    // --- VIEW: SCHLAFEN / TRANSITION ---
    if (phase === 'NIGHT_TRANSITION') {
        return (
            <div className="eye-close-container">
                <div className="eye-text">Die Nacht bricht ein!</div>
                <div className="eye-icon">😴</div>
                <div className="eye-text" style={{ fontSize: '3rem', color: '#ff0000' }}>AUGEN ZU!</div>
            </div>
        );
    }

    const renderContent = () => {
        
        // --- VIEW: MAFIA ---
        if (phase === 'NIGHT_MAFIA' && me.role === 'Mafia' && me.isAlive) {
            const otherMafias = players.filter(p => p.role === 'Mafia' && p.playerId !== me.playerId);
            return (
                <div>
                    <h2 style={{ color: 'red', textShadow: '0 0 10px black' }}>MAFIA TREFFEN</h2>

                    {/* KOMPLIZEN */}
                    {otherMafias.length > 0 && (
                        <div className="teammate-box">
                            <span className="teammate-label">Deine Komplizen:</span>
                            <div>
                                {otherMafias.map(p => (
                                    <span key={p.playerId} className="teammate-badge">
                                        😈 {p.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <p>Wählt ein Opfer:</p>
                    <div className="grid-container">
                        {players.filter(p => p.isAlive && p.role !== 'Mafia').map(p => {
                            const voters = Object.keys(mafiaVotes).filter(vid => mafiaVotes[vid] === p.playerId);
                            const isMySelection = mafiaVotes[me.playerId] === p.playerId || localSelection === p.playerId;

                            const voterNames = voterIds.map(vid => {
                                const voter = players.find(pl => pl.playerId === vid);
                                return voter ? voter.name : 'Unbekannt';
                            });

                            return (
                                <button key={p.playerId} onClick={() => handleActionClick(p.playerId)}
                                    className={`action-btn btn-mafia ${voterIds.length > 0 ? 'voted' : ''} ${isMySelection ? 'btn-selected-shine' : ''}`}
                                    style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }} 
                                >
                                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>💀 {p.name}</span>
                                    
                                    {voterNames.length > 0 && (
                                        <div style={{ fontSize: '0.8rem', color: '#ff8a80', marginTop: '2px' }}>
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

        // --- VIEW: ARZT ---
        if (phase === 'NIGHT_DOCTOR' && me.role === 'Arzt' && me.isAlive) {
            return (
                <div>
                    <h2 style={{ color: 'green' }}>ARZT</h2>
                    <p>Wen möchtest du schützen?</p>
                    <p style={{ fontSize: '0.6rem', color: '#ccc' }}>(Du kannst eine Person retten!)</p>
                    {hasActed ? <div className="status-msg fade-in">Gute Arbeit Doc!</div> : (
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

        // --- VIEW: DETEKTIV ---
        if (phase === 'NIGHT_DETECTIVE' && me.role === 'Detektiv' && me.isAlive) {
            return (
                <div>
                    <h2 style={{ color: 'blue' }}>DETEKTIV</h2>
                    <p>Eine Person darfst du prüfen!</p>
                    {hasActed ? <div className="status-msg fade-in">🕵️‍♂️ Jetzt weißt du es... Und dieses Wissen könnte dein letztes sein.</div> : (
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

        // --- VIEW: LADY ---
        if (phase === 'NIGHT_LADY' && me.role === 'Lady' && me.isAlive) {
            return (
                <div>
                    <h2 style={{ color: '#9c27b0' }}>💋 LADY</h2>
                    <p>Wen möchtest du besuchen?</p>
                    <p style={{ fontSize: '0.6rem', color: '#ccc' }}>(Derjenige wird HEUTE NACHT geschützt. Wirst DU getötet, sterbt ihr BEIDE)</p>
                    {hasActed ? <div className="status-msg fade-in">💋 Eine heiße Nacht...</div> : (
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

        // --- VIEW: SCHLAFENDE  ---
        return (
            <div className="eye-close-container">
                <h2>NACHT</h2>
                <div className="eye-icon" style={{ animation: 'none', fontSize: '60px' }}>🌙</div>
                <p>🌙 Du schläfst...</p>
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