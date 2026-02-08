//App.js
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'react-qr-code';
import Swal from 'sweetalert2';
import './App.css';

import Lobby from './components/Lobby';
import RoleCard from './components/RoleCard';
import NightPhase from './components/NightPhase';
import DayPhase from './components/DayPhase';

const SERVER_URL = import.meta.env.VITE_SERVER_URL;
const CLIENT_URL = import.meta.env.VITE_CLIENT_URL;

function App() {
  const [socket, setSocket] = useState(null);
  const [me, setMe] = useState(null);
  const [players, setPlayers] = useState([]);
  const [gamePhase, setGamePhase] = useState("LOBBY");
  const [settings, setSettings] = useState({});
  const [announcement, setAnnouncement] = useState("");
  const [tieCandidates, setTieCandidates] = useState([]);
  const [isHostConsole, setIsHostConsole] = useState(false);
  const [currentVotes, setCurrentVotes] = useState({});
  const [roleConfirmed, setRoleConfirmed] = useState(false);
  const [gameLog, setGameLog] = useState([]);
  const [hostNightData, setHostNightData] = useState({ mafiaVotes: {}, docTarget: null, detTarget: null });

  const playerId = useRef(localStorage.getItem("mafia_pid") || uuidv4());

  const playSound = (soundKey) => {
    const soundMap = {
        'morning': 'morning_rooster.wav',        
        'morning_rooster': 'morning_rooster.wav', 
        'night_start_sound': 'night_start.mp3',   
        'mafia_wake': 'mafia_wake.mp3',
        'mafia_sleep_sound': 'mafia_sleep.mp3',
        'doctor_wake': 'doctor_wake.mp3',
        'doctor_sleep_sound': 'doc_sleep.mp3',
        'detective_wake': 'detective_wake.mp3',
        'detective_sleep_sound': 'det_sleep.mp3'
    };

    const fileName = soundMap[soundKey] || `${soundKey}.mp3`; // Fallback
    const audio = new Audio(`/sounds/${fileName}`);
    
    audio.play().catch(e => console.log("Audio Autoplay blockiert (Browser Policy):", e));
  };

  const logout = () => {
    localStorage.removeItem("mafia_name");
    window.location.reload();
  };

  const handleHostAction = (title, text, actionCallback, confirmColor = '#d33') => {
    Swal.fire({
      title: title,
      text: text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: confirmColor,
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ja, mach es!',
      cancelButtonText: 'Abbrechen'
    }).then((result) => {
      if (result.isConfirmed) {
        actionCallback();
      }
    });
  };

  useEffect(() => {
    localStorage.setItem("mafia_pid", playerId.current);
    const newSocket = io(SERVER_URL, { transports: ['websocket'] });
    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (socket) {

      socket.on('connect', () => {
        const name = localStorage.getItem("mafia_name");
        if (name) socket.emit('joinGame', { playerId: playerId.current, name });
      });

      socket.on('recoverState', (data) => {
        setMe(data.me);
        setPlayers(data.allPlayers);
        setGamePhase(data.gamePhase);
        setSettings(data.settings);
        if (data.tieCandidates) setTieCandidates(data.tieCandidates);
        if (data.dayVotes) setCurrentVotes(data.dayVotes);
      });

      socket.on('voteUpdate', (votes) => {
        setCurrentVotes(votes);
      });

      socket.on('updatePlayerList', (list) => setPlayers(list));

      socket.on('receiveRole', (role) => {
        setMe(prev => ({ ...prev, role, isAlive: true }));
      });

      socket.on('gameStateUpdate', (data) => {
        if (data.gamePhase) setGamePhase(data.gamePhase);
        if (data.players) {
          setPlayers(data.players);
          const myServerState = data.players.find(p => p.playerId === playerId.current);
          if (myServerState) {
            setMe(prev => ({ ...prev, ...myServerState }));
          }
        }
        if (data.tieCandidates) setTieCandidates(data.tieCandidates);
      });

      socket.on('announcement', (msg) => {
        setAnnouncement(msg);
      });

      socket.on('nightAnnouncement', ({ message, sound }) => {
          setAnnouncement(message);
          if(sound) playSound(sound); 
      });

      socket.on('dayAnnouncement', ({ title, text }) => {
        const iAmHost = playerId.current === 'host' || isHostConsole;
        const isGameOver = title.includes("GEWINNT") || text.includes("GEWINNT") || title.includes("VORBEI");

        if (!iAmHost && !isGameOver) {
          Swal.fire({
            title: title,
            text: text,
            timer: 5000,
            showConfirmButton: false
          });
        }
        setAnnouncement(text);
      });

      socket.on('detectiveResult', (data) => {
        if (!isHostConsole) {
          Swal.fire({
            title: 'Detektiv Ergebnis',
            text: data.isEvil ? "Mafia!" : "Bürger.",
            confirmButtonText: 'Verstanden'
          });
        }
      });

      socket.on('playSound', (type) => {
        playSound(type); 
      });

      socket.on('gameReset', (updatedPlayerList) => {
        setGamePhase("LOBBY");
        setPlayers(updatedPlayerList);
        setTieCandidates([]);
        setAnnouncement("");
        setCurrentVotes({});
        setRoleConfirmed(false);

        if (me && me.playerId !== 'host') {
          setMe(prev => ({ ...prev, role: "Noch nicht verteilt", isAlive: true }));
        }

        if (!isHostConsole) {
          Swal.fire({
            icon: 'info',
            title: 'Neustart',
            text: "Das Spiel wurde vom Host neu gestartet!",
            timer: 5000,
            showConfirmButton: false
          });
        }
      });

      socket.on('forceReload', () => {
        localStorage.clear();
        window.location.reload();
      });
    }

    return () => {
      if (socket) {
        socket.off('connect');
        socket.off('recoverState');
        socket.off('voteUpdate');
        socket.off('updatePlayerList');
        socket.off('receiveRole');
        socket.off('gameStateUpdate');
        socket.off('announcement');
        socket.off('nightAnnouncement');
        socket.off('dayAnnouncement');
        socket.off('detectiveResult');
        socket.off('playSound');
        socket.off('gameReset');
        socket.off('forceReload');
      }
    };

  }, [socket, isHostConsole, me]);



  useEffect(() => {
    if (!socket) return;

    const addLog = (msg, type = 'info') => {
        const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setGameLog(prev => [{ time, msg, type }, ...prev]); 
    };

    socket.on('hostActionUpdate', (update) => {
        if (update.type === 'MAFIA_VOTE') {
            setHostNightData(prev => ({ ...prev, mafiaVotes: update.data }));
        }
        if (update.type === 'DOC_ACTION') {
            setHostNightData(prev => ({ ...prev, docTarget: update.target }));
            addLog("Der Arzt hat ein Ziel gewählt.", 'action');
        }
        if (update.type === 'DET_ACTION') {
            setHostNightData(prev => ({ ...prev, detTarget: update.target }));
            addLog("Der Detektiv hat jemanden untersucht.", 'action');
        }
    });

    socket.on('gameStateUpdate', (data) => {
        if (data.gamePhase) {
            let phaseName = data.gamePhase;
            if(phaseName === 'NIGHT_MAFIA') phaseName = 'Nacht: Mafia Phase';
            if(phaseName === 'DAY_DISCUSS') phaseName = 'Tag: Diskussion';
            if(phaseName === 'DAY_VOTE') phaseName = 'Tag: Abstimmung';
            
            addLog(`Phasenwechsel: ${phaseName}`, 'phase');
            
            if(data.gamePhase === 'NIGHT_TRANSITION') {
                setHostNightData({ mafiaVotes: {}, docTarget: null, detTarget: null });
            }
        }
    });

    socket.on('announcement', (msg) => {
        addLog(msg, 'alert');
    });
    
    socket.on('dayAnnouncement', (data) => {
        addLog(`${data.title}: ${data.text}`, 'alert');
    });

    return () => {
        socket.off('hostActionUpdate');};    
  }, [socket]);


  // ------------------------------------------------------------------
  // HOST CONSOLE VIEW (Großbildschirm)
  // ------------------------------------------------------------------
  if (isHostConsole) {
    const getName = (id) => players.find(p => p.playerId === id)?.name || "Unbekannt";

    return (
      <div className="host-container">
        
        {/* HEADER: Phasen-Fortschrittsanzeige */}
        <div className="host-header">
            <h1>🕵️ SPIELLEITER ZENTRALE</h1>
            <div className="phase-timeline">
                {['LOBBY', 'NIGHT', 'DAY', 'VOTE'].map(step => (
                    <div key={step} className={`timeline-step ${gamePhase.includes(step) ? 'active' : ''}`}>
                        {step}
                    </div>
                ))}
            </div>
            <div className="current-phase-badge">
                AKTUELL: {gamePhase}
            </div>
        </div>

        <div className="host-grid">
            
            {/* SPALTE 1: Steuerung & Lobby */}
            <div className="host-panel host-controls">
                <h3>🕹️ Steuerung</h3>
                {gamePhase === 'LOBBY' ? (
                    <>
                        <Lobby socket={socket} players={players} isHost={true} />
                        <div className="qr-mini">
                            <QRCode value={CLIENT_URL} size={80} />
                            <small>{CLIENT_URL}</small>
                        </div>
                    </>
                ) : (
                    <div className="active-game-controls">
                        <button onClick={() => socket.emit('forcePhaseNext')} className="btn-emergency">
                            ⏩ Phase überspringen
                        </button>
                        <hr />
                        <button 
                            onClick={() => handleHostAction("Neustart?", "Alles wird gelöscht.", () => socket.emit('resetGame'))} 
                            className="btn-restart">
                            🔄 Reset
                        </button>
                        <button 
                            onClick={() => handleHostAction("KICK ALL?", "Alle fliegen raus.", () => socket.emit('kickAll'), '#ff0000')} 
                            className="btn-kick">
                            ⚠️ Kick All
                        </button>
                    </div>
                )}
            </div>

            {/* SPALTE 2: Live Informationen (Nacht & Tag) */}
            <div className="host-panel host-live-info">
                <h3>📊 Live Status</h3>
                
                {/* NACHT STATUS */}
                {gamePhase.startsWith('NIGHT') && (
                    <div className="info-box night-box">
                        <h4>🌙 Nacht Aktionen</h4>
                        <div>
                            <strong>Mafia Votes:</strong>
                            <ul className="mini-list">
                                {Object.entries(hostNightData.mafiaVotes).map(([voterId, targetId]) => (
                                    <li key={voterId}>
                                        {getName(voterId)} 🔪 will töten: <span style={{color:'red'}}>{getName(targetId)}</span>
                                    </li>
                                ))}
                                {Object.keys(hostNightData.mafiaVotes).length === 0 && <li>Noch keine Stimmen...</li>}
                            </ul>
                        </div>
                        <div style={{marginTop: 10}}>
                            <strong>Arzt:</strong> {hostNightData.docTarget ? `Schützt ${getName(hostNightData.docTarget)}` : "Schläft/Überlegt..."}
                        </div>
                        <div>
                            <strong>Detektiv:</strong> {hostNightData.detTarget ? `Prüft ${getName(hostNightData.detTarget)}` : "Schläft/Überlegt..."}
                        </div>
                    </div>
                )}

                {/* TAG STATUS (Voting) */}
                {(gamePhase.startsWith('DAY') || gamePhase === 'DAY_VOTE') && (
                    <div className="info-box day-box">
                        <h4>☀️ Tag Aktionen</h4>
                        <p>Stimmen abgegeben: {Object.keys(currentVotes).length} / {players.filter(p => p.isAlive && p.playerId !== 'host').length}</p>
                        {/* Wer führt gerade? Simple Berechnung für Host View */}
                        <div className="vote-tally">
                            {(() => {
                                const counts = {};
                                Object.values(currentVotes).forEach(t => counts[t] = (counts[t] || 0) + 1);
                                return Object.entries(counts).map(([targetId, count]) => (
                                    <div key={targetId} className="vote-bar">
                                        <span>{getName(targetId)}:</span> 
                                        <strong>{count}</strong>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>
                )}
            </div>

            {/* SPALTE 3: Chronik / Log */}
            <div className="host-panel host-log">
                <h3>📜 Chronik</h3>
                <div className="log-container">
                    {gameLog.length === 0 && <p style={{color:'#999'}}>Spielprotokoll leer...</p>}
                    {gameLog.map((entry, i) => (
                        <div key={i} className={`log-entry type-${entry.type}`}>
                            <span className="log-time">[{entry.time}]</span> 
                            <span className="log-msg">{entry.msg}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* SPALTE 4: Spieler Liste (Kompakt) */}
            <div className="host-panel host-players">
                <h3>👥 Spieler ({players.length})</h3>
                <div className="player-list-scroll">
                    <table className="player-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Rolle</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {players.map(p => {
                                // Zusatzinfo: Hat der Spieler schon abgestimmt?
                                const hasVoted = gamePhase.startsWith('DAY') && currentVotes[p.playerId];
                                const isMafiaVoter = gamePhase === 'NIGHT_MAFIA' && hostNightData.mafiaVotes[p.playerId];
                                
                                return (
                                    <tr key={p.playerId} className={p.isAlive ? 'row-alive' : 'row-dead'}>
                                        <td style={{ fontWeight: 'bold' }}>
                                            {p.name}
                                        </td>
                                        <td>
                                            <span className={`role-badge badge-${p.role.toLowerCase()}`}>{p.role}</span>
                                        </td>
                                        <td>
                                            {p.isAlive ? (
                                                (hasVoted || isMafiaVoter) ? "✅ Fertig" : "⏳ Denkt..."
                                            ) : "💀 Tot"}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // REGULAR PLAYER VIEW (Handy)
  // ------------------------------------------------------------------

  if (!me) return (
    <div className="login-container">

      {/* 1. Überschrift */}
      <h1 className="mafia-title">MAFIA</h1>

      {/* 2. Eingabegruppe (Nebeneinander) */}
      <div className="input-group">
        <input
          id="nameInput"
          placeholder="Dein Name"
          className="login-input"
        />
        <button
          className="btn-login"
          onClick={() => {
            const n = document.getElementById("nameInput").value;
            if (!n) return;
            localStorage.setItem("mafia_name", n);
            socket.emit('joinGame', { playerId: playerId.current, name: n });
          }}
        >
          Beitreten
        </button>
      </div>

      {/* 3. Host Bereich (Ganz unten) */}
      <div className="host-footer">
        <button
          className="btn-host-login"
          onClick={() => {
            socket.emit('registerHost');
            playerId.current = 'host';
            setMe({ name: "Spielleiter", role: "Spectator", playerId: "host", isAlive: true });
            setIsHostConsole(true);
          }}
        >
          🖥️ Lobby eröffnen
        </button>
        <p className="host-warning">Nur für SPIELLEITER (NOTEBOOK)!!!</p>
      </div>

    </div>
  );

  const isNight = gamePhase.startsWith('NIGHT');
  return (
    <div className={`player-app-container ${isNight ? 'night-mode' : ''}`}>
      <button onClick={logout} className="btn-logout">❌</button>
      
      {/* <div className="header-bar">

        <h4>Mafia - Phase: {gamePhase}</h4>
        <h4>{me.role !== 'Spectator' && <p>Du bist: <strong>{me.name}</strong></p>}</h4>

      </div>*/}

      {gamePhase === 'LOBBY' && (
        <div style={{ marginBottom: 30 }}>
          <p className="pulse-text">Warte auf Spielstart...</p>
          <Lobby socket={socket} players={players} isHost={false} />
        </div>
      )}

      {gamePhase === 'ROLE_REVEAL' && (
        <div>
          <RoleCard role={me.role} name={me.name} />

          <button
            disabled={roleConfirmed}
            onClick={() => {
              socket.emit('playerReady', me.playerId);
              setRoleConfirmed(true);
            }}
            className="btn-big-action bg-blue"
            style={{
              backgroundColor: roleConfirmed ? '' : '#69756c',
              cursor: roleConfirmed ? 'default' : 'pointer',
              transform: roleConfirmed ? 'none' : '' ,
              color: '#57233a'
            }}
          >
            {roleConfirmed ? "WARTE AUF ANDERE SPIELER..." : "WEITER"}
          </button>
        </div>
      )}

      {gamePhase === 'READY_CHECK' && (
        <div>
          <h3>Macht euch bereit für die Nacht...</h3>
          <button onClick={() => socket.emit('playerReady', me.playerId)} className="btn-big-action bg-orange">BEREIT FÜR DIE NACHT</button>
        </div>
      )}

      {gamePhase.startsWith('NIGHT') && <NightPhase socket={socket} phase={gamePhase} me={me} players={players} />}
      {gamePhase.startsWith('DAY') && <DayPhase socket={socket} phase={gamePhase} me={me} players={players} tieCandidates={tieCandidates} currentVotes={currentVotes} />}

      {/* OVERLAY LOGIK */}
      {!me.isAlive && me.role !== 'Spectator' && gamePhase !== 'LOBBY' && gamePhase !== 'GAME_OVER' && (
        <div className="dead-overlay">
          <h1>DU BIST TOT 💀</h1>
          <p>Warte auf das Ende des Spiels.</p>
        </div>
      )}

      {gamePhase === 'GAME_OVER' && (
        <div>
          <h1>SPIEL VORBEI!</h1>
          <h2>{announcement}</h2>
        </div>
      )}
    </div>
  );
}

export default App;