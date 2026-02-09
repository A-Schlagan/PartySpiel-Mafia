// components/NightPhase.jsx
import React, { useState, useEffect } from 'react';

export default function NightPhase({ socket, phase, me, players, duration}) {
    const [mafiaVotes, setMafiaVotes] = useState({});
    const [hasActed, setHasActed] = useState(false);
    const [announcement, setAnnouncement] = useState("");

    const TimerBar = ({ duration }) => (
    <div className="timer-container">
        <div className="timer-bar" style={{ animationDuration: `${duration}ms` }}></div>
    </div>
    );

    useEffect(() => {
        const handleAnnouncement = ({ message }) => {
            setAnnouncement(message);
        };

        const handleMafiaUpdate = (votes) => {
            setMafiaVotes(votes);
        };

        socket.on('nightAnnouncement', handleAnnouncement);
        socket.on('mafiaVoteUpdate', handleMafiaUpdate);
        
        setHasActed(false);
        setMafiaVotes({});

        return () => {
            socket.off('nightAnnouncement', handleAnnouncement);
            socket.off('mafiaVoteUpdate', handleMafiaUpdate);
        };
    }, [socket, phase]); 

    const sendAction = (targetId) => {
        if (!me.isAlive) return;

        if (phase !== 'NIGHT_MAFIA') setHasActed(true);

        if(phase === 'NIGHT_MAFIA') socket.emit('mafiaVote', { voterId: me.playerId, targetId });
        if(phase === 'NIGHT_DOCTOR') socket.emit('doctorAction', targetId);
        if(phase === 'NIGHT_DETECTIVE') socket.emit('detectiveAction', targetId);
    };

    if (phase === 'NIGHT_TRANSITION') {
        return (
            <div style={{textAlign: 'center', marginTop: 50, transition: 'all 0.5s'}}>
                <h2 style={{color: '#888'}}>Die Nacht bricht ein! DU GEHST SCHLAFEN!</h2>
                <div style={{fontSize: 60, animation: 'pulse 2s infinite'}}>
                    😴 <br />
                    AUGEN ZU
                </div>
                {announcement && <h3 style={{color: 'yellow', marginTop: 20}}>{announcement}</h3>}
                <style>{`@keyframes pulse { 0% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0.5; transform: scale(1); } }`}</style>
            </div>
        );
    }

    if (phase === 'NIGHT_MAFIA' && me.role === 'Mafia' && me.isAlive) {
        const otherMafias = players.filter(p => p.role === 'Mafia' && p.playerId !== me.playerId);
        return (
            <div>
                <TimerBar duration={duration} />
                {announcement && <div className="toast-msg">{announcement}</div>}
                <h2 style={{color:'red'}}>MAFIA TREFFEN</h2>
                
                {/* Team Anzeige */}
                {otherMafias.length > 0 && (
                     <div style={{backgroundColor: '#4a0e0e', padding: '10px', borderRadius: '8px', marginBottom: '15px'}}>
                        <p style={{margin:0, color:'#ffaaaa'}}>Komplizen:</p>
                        {otherMafias.map(p => <span key={p.playerId} style={{marginRight:10}}>😈 {p.name}</span>)}
                    </div>
                )}

                <p>Wählt ein Opfer:</p>
                {players.filter(p => p.isAlive && p.role !== 'Mafia').map(p => {
                    const voters = Object.keys(mafiaVotes).filter(vid => mafiaVotes[vid] === p.playerId);
                    return (
                        <button key={p.playerId} onClick={() => sendAction(p.playerId)} 
                            className={`action-btn btn-mafia ${voters.length > 0 ? 'voted' : ''}`}>
                            💀 {p.name} {voters.length>0 && `(${voters.length})`}
                        </button>
                    )
                })}
            </div>

        );
    }

    if (phase === 'NIGHT_DOCTOR' && me.role === 'Arzt' && me.isAlive) {
        return (
            <div>
                <TimerBar duration={duration} />
                {announcement && <div className="toast-msg">{announcement}</div>}
                <h2 style={{color:'green'}}>ARZT</h2>
                <p>Wen möchtest du schützen?</p>
                {hasActed ? <p>Entscheidung getroffen.</p> : (
                    players.filter(p => p.isAlive).map(p => (
                        <button key={p.playerId} onClick={() => sendAction(p.playerId)} className="action-btn btn-doctor">
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
                <TimerBar duration={duration} />
                {announcement && <div className="toast-msg">{announcement}</div>}
                <h2 style={{color:'blue'}}>DETEKTIV</h2>
                <p>Wen untersuchen?</p>
                {hasActed ? <p>Untersuchung läuft...</p> : (
                    players.filter(p => p.isAlive && p.playerId !== me.playerId).map(p => (
                        <button key={p.playerId} onClick={() => sendAction(p.playerId)} className="action-btn btn-detective">
                            🔍 {p.name}
                        </button>
                    ))
                )}
            </div>
        )
    }

    return (
        <div style={{marginTop: 50, textAlign: 'center'}}>
            <h2>NACHT</h2>
            {announcement && <h3 style={{color: 'orange'}}>{announcement}</h3>}
            <p>Du schläfst...</p>
            <div style={{fontSize: 80}}>🌙</div>
        </div>
    );
}