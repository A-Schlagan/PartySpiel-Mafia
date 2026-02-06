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

  const playerId = useRef(localStorage.getItem("mafia_pid") || uuidv4());

  const playSound = () => {
    const audio = new Audio('sounds/sound_morning.mp3');
    audio.play().catch(e => console.log("Audio Autoplay blockiert", e));
  };

  const logout = () => {
    localStorage.removeItem("mafia_name");
    window.location.reload();
  };

  // Hilfsfunktion für Host-Aktionen mit SweetAlert
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
        if (type === 'morning') playSound();
      });

      socket.on('gameReset', (updatedPlayerList) => {
        setGamePhase("LOBBY");
        setPlayers(updatedPlayerList);
        setTieCandidates([]);
        setAnnouncement("");

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
  }, [socket, isHostConsole, me]);


  // ------------------------------------------------------------------
  // HOST CONSOLE VIEW (Großbildschirm)
  // ------------------------------------------------------------------
  if (isHostConsole) {
    return (
      <div className="host-container">

        {/* LINKS: Steuerung */}
        <div className="host-panel host-panel-left">
          <h2>Spielleiter Zentrale 🖥️</h2>
          <div className="phase-display">
            <h3 className="phase-title">Phase: {gamePhase}</h3>
            <small style={{ color: '#666' }}>Spiel läuft automatisch...</small>
          </div>

          {announcement && <div className="announcement-banner">📢 {announcement}</div>}

          <hr />

          {gamePhase === 'LOBBY' && (
            <Lobby socket={socket} players={players} isHost={true} />
          )}

          {gamePhase === 'LOBBY' && (
            <div className="qr-container">
              <QRCode value={CLIENT_URL} size={100} />
              <p>{CLIENT_URL}</p>
            </div>
          )}

          {/* Manuelle Eingriffe */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
            {gamePhase.startsWith('DAY_') && gamePhase !== 'DAY_ANNOUNCE' && (
              <div style={{ border: '1px solid #ccc', padding: 10, borderRadius: 5 }}>
                <h4>Notfall Eingriff</h4>
                <button onClick={() => socket.emit('forcePhaseNext')} className="btn-emergency">
                  ⏩ Timer überspringen
                </button>
              </div>
            )}

            <div className="danger-zone">
              <h4>Gefahrenzone</h4>
              
              {/* ERSATZ FÜR CONFIRM - RESET */}
              <button 
                onClick={() => handleHostAction(
                    "Spiel neu starten?", 
                    "Der aktuelle Fortschritt geht verloren und alle Rollen werden zurückgesetzt.", 
                    () => socket.emit('resetGame')
                )}
                className="btn-restart"
              >
                🔄 Runde Neu Starten
              </button>

              {/* ERSATZ FÜR CONFIRM - KICK ALL */}
              <button 
                onClick={() => handleHostAction(
                    "ALLE KICKEN?", 
                    "Alle Spieler werden vom Server getrennt. Das ist unwiderruflich.", 
                    () => socket.emit('kickAll'),
                    '#ff0000' // Extra rot
                )}
                className="btn-kick"
              >
                ⚠️ ALLE KICKEN
              </button>
            </div>
          </div>
        </div>

        {/* RECHTS: Spieler Übersicht */}
        <div className="host-panel host-panel-right">
          <h3>Spieler Übersicht ({players.length})</h3>
          <table className="player-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Rolle</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => (
                <tr key={p.playerId} className={p.isAlive ? 'row-alive' : 'row-dead'}>
                  <td style={{ fontWeight: 'bold' }}>{p.name}</td>
                  <td>
                    <span className={`role-badge ${
                        p.role === 'Mafia' ? 'badge-mafia' : 
                        (p.role === 'Arzt' ? 'badge-arzt' : 
                        (p.role === 'Detektiv' ? 'badge-detektiv' : 'badge-default'))
                      }`}>
                      {p.role}
                    </span>
                  </td>
                  <td>{p.isAlive ? "✅ Lebt" : "💀 Tot"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
      <div className="header-bar">

        <h3>Mafia - Phase: {gamePhase}</h3>
        <h2>{me.role !== 'Spectator' && <p>Du bist: <strong>{me.name}</strong></p>}</h2>

      </div>

      {gamePhase === 'LOBBY' && (
        <div style={{ marginBottom: 30 }}>
          <p>Warte auf Spielstart...</p>
          <Lobby socket={socket} players={players} isHost={false} />
        </div>
      )}

      {gamePhase === 'ROLE_REVEAL' && (
        <div>
          <RoleCard role={me.role} name={me.name} />
          <button onClick={() => socket.emit('playerReady', me.playerId)} className="btn-big-action bg-blue">
            ICH HABE MEINE ROLLE GESEHEN (BEREIT)
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
      {gamePhase.startsWith('DAY') && <DayPhase socket={socket} phase={gamePhase} me={me} players={players} tieCandidates={tieCandidates} />}

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