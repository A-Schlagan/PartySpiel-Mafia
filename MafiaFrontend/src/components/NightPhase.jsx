// NightPhase.jsx
import React, { useState, useEffect } from 'react';

export default function NightPhase({ socket, phase, me, players }) {
    const [mafiaVotes, setMafiaVotes] = useState({});
    const [hasActed, setHasActed] = useState(false);
    
    const [announcement, setAnnouncement] = useState("");

    // --- 1. DER ZENTRALE EFFECT FÜR SOUNDS & UPDATES ---
    useEffect(() => {
        // A) Funktion: Ansagen & Sound verarbeiten
        const handleAnnouncement = ({ message, sound }) => {
            setAnnouncement(message);

            if (sound) {
                const audio = new Audio(`/sounds/${sound}.mp3`);
                audio.play().catch(err => {
                    console.error("Fehler beim Abspielen:", err);
                });
                setTimeout(() => {
                    audio.pause();       
                    audio.currentTime = 0;
                }, 3000);
            }
            console.log(`[SOUND TRIGGER] Spiele Sound: ${sound}`);
            
            setTimeout(() => setAnnouncement(""), 3500);
        };

        // B) Funktion: Mafia-Votes aktualisieren (rote Markierung)
        const handleMafiaUpdate = (votes) => {
            setMafiaVotes(votes);
        };

        // C) Listener aktivieren
        socket.on('nightAnnouncement', handleAnnouncement);
        socket.on('mafiaVoteUpdate', handleMafiaUpdate);
        
        // D) Reset bei Phasenwechsel 
        setHasActed(false);
        setMafiaVotes({});

        // E) Aufräumen 
        return () => {
            socket.off('nightAnnouncement', handleAnnouncement);
            socket.off('mafiaVoteUpdate', handleMafiaUpdate);
        };
    }, [socket, phase]); 

    // --- 2. ACTION HANDLER (Spieler klickt Button) ---
    const sendAction = (targetId) => {
        if (!me.isAlive) return;

        // Lokales Feedback setzen (damit Buttons verschwinden/deaktiviert werden)
        if (phase !== 'NIGHT_MAFIA') setHasActed(true);

        // Events an Server senden
        if(phase === 'NIGHT_MAFIA') socket.emit('mafiaVote', { voterId: me.playerId, targetId });
        if(phase === 'NIGHT_DOCTOR') socket.emit('doctorAction', targetId);
        if(phase === 'NIGHT_DETECTIVE') socket.emit('detectiveAction', targetId);
    };

    // --- 3. RENDER LOGIC ---

    // A) ÜBERGANGSPHASE (Alle sehen "Schlafen" + Animation)
    if (phase === 'NIGHT_TRANSITION') {
        return (
            <div style={{textAlign: 'center', marginTop: 50, transition: 'all 0.5s'}}>
                <h2 style={{color: '#888'}}>Nachtphase...</h2>
                <div style={{fontSize: 60, animation: 'pulse 2s infinite'}}>🤫</div>
                {announcement && <h3 style={{color: 'yellow', marginTop: 20}}>{announcement}</h3>}
                <p>Bitte warten...</p>
                <style>{`@keyframes pulse { 0% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0.5; transform: scale(1); } }`}</style>
            </div>
        );
    }

    // B) MAFIA ANSICHT
    if (phase === 'NIGHT_MAFIA' && me.role === 'Mafia' && me.isAlive) {
        const otherMafias = players.filter(p => p.role === 'Mafia' && p.playerId !== me.playerId);
        return (
            <div>
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

    // C) ARZT ANSICHT
    if (phase === 'NIGHT_DOCTOR' && me.role === 'Arzt' && me.isAlive) {
        return (
            <div>
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

    // D) DETEKTIV ANSICHT
    if (phase === 'NIGHT_DETECTIVE' && me.role === 'Detektiv' && me.isAlive) {
        return (
            <div>
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

    // E) DEFAULT: SCHLAFEN 
    return (
        <div style={{marginTop: 50, textAlign: 'center'}}>
            <h2>NACHT</h2>
            {announcement && <h3 style={{color: 'orange'}}>{announcement}</h3>}
            <p>Du schläfst...</p>
            <div style={{fontSize: 50}}>🌙</div>
        </div>
    );
}