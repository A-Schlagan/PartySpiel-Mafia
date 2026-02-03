// App.jsx
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'react-qr-code';
import Swal from 'sweetalert2';

import Lobby from './components/Lobby';
import RoleCard from './components/RoleCard';
import NightPhase from './components/NightPhase';
import DayPhase from './components/DayPhase';

const SERVER_URL = "https://ffq399v6-5000.euw.devtunnels.ms";
const CLIENT_URL = "https://ffq399v6-5173.euw.devtunnels.ms";

function App() {
  const [socket, setSocket] = useState(null);
  const [me, setMe] = useState(null);
  const [players, setPlayers] = useState([]);
  const [gamePhase, setGamePhase] = useState("LOBBY");
  const [settings, setSettings] = useState({});
  const [announcement, setAnnouncement] = useState("");
  const [tieCandidates, setTieCandidates] = useState([]);
  const [isHostConsole, setIsHostConsole] = useState(false);

  // ID persistieren
  const playerId = useRef(localStorage.getItem("mafia_pid") || uuidv4());

  const playSound = () => {
    const audio = new Audio('/sound_morning.mp3');
    audio.play().catch(e => console.log("Audio Autoplay blockiert", e));
  };

  const logout = () => {
    localStorage.removeItem("mafia_name");
    window.location.reload();
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
        // Sicherstellen, dass man beim Empfang der Rolle als lebendig gilt
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
            timer: 3000,
            showConfirmButton: false
            //confirmButtonText: 'OK'                     alternativ
          });
        }
        setAnnouncement(text);
      });


      socket.on('detectiveResult', (data) => {
        if (!isHostConsole) {
          Swal.fire({
            text: data.isEvil ? "MAFIA" : "BÜRGER",
            confirmButtonText: 'OK'
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

        // Sofort resetten, damit kein Overlay angezeigt wird
        if (me && me.playerId !== 'host') {
          setMe(prev => ({ ...prev, role: "Noch nicht verteilt", isAlive: true }));
        }

        if (!isHostConsole) alert("Das Spiel wurde neu gestartet!");
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
      <div style={{ padding: 20, fontFamily: 'sans-serif', background: '#f0f0f0', minHeight: '100vh', display: 'flex', gap: '20px' }}>

        {/* LINKS: Steuerung */}
        <div style={{ flex: 1, background: 'white', padding: 20, borderRadius: 10, boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}>
          <h2>Spielleiter Zentrale 🖥️</h2>
          <div style={{ padding: 10, background: '#eee', borderRadius: 5, marginBottom: 10 }}>
            <h3 style={{ margin: 0, color: 'blue' }}>Phase: {gamePhase}</h3>
            <small style={{ color: '#666' }}>Spiel läuft automatisch...</small>
          </div>

          {announcement && <div style={{ padding: 10, background: '#ffeeba', border: '1px solid orange', marginBottom: 10 }}>📢 {announcement}</div>}

          <hr />

          {gamePhase === 'LOBBY' && (
            <Lobby socket={socket} players={players} isHost={true} />
          )}

          {gamePhase === 'LOBBY' && (
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <QRCode value={CLIENT_URL} size={100} />
              <p>{CLIENT_URL}</p>
            </div>
          )}

          {/* Manuelle Eingriffe */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
            {gamePhase.startsWith('DAY_') && gamePhase !== 'DAY_ANNOUNCE' && (
              <div style={{ border: '1px solid #ccc', padding: 10, borderRadius: 5 }}>
                <h4>Notfall Eingriff</h4>
                <button onClick={() => socket.emit('forcePhaseNext')} style={{ padding: 10, background: '#666', color: 'white', width: '100%', cursor: 'pointer' }}>
                  ⏩ Timer überspringen
                </button>
              </div>
            )}

            <div style={{ marginTop: 30, borderTop: '2px solid #333', paddingTop: 20 }}>
              <h4>Gefahrenzone</h4>
              <button onClick={() => { if (confirm("Spiel wirklich neu starten?")) socket.emit('resetGame'); }}
                style={{ padding: 10, background: 'orange', border: 'none', cursor: 'pointer', marginRight: 10 }}>
                🔄 Runde Neu Starten
              </button>

              <button onClick={() => { if (confirm("ALLE Spieler vom Server kicken?")) socket.emit('kickAll'); }}
                style={{ padding: 10, background: 'darkred', color: 'white', border: 'none', cursor: 'pointer' }}>
                ⚠️ ALLE KICKEN
              </button>
            </div>
          </div>
        </div>

        {/* RECHTS: Spieler Übersicht */}
        <div style={{ flex: 2, background: 'white', padding: 20, borderRadius: 10, boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}>
          <h3>Spieler Übersicht ({players.length})</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#333', color: 'white', textAlign: 'left' }}>
                <th style={{ padding: 10 }}>Name</th>
                <th style={{ padding: 10 }}>Rolle</th>
                <th style={{ padding: 10 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => (
                <tr key={p.playerId} style={{ borderBottom: '1px solid #ddd', background: p.isAlive ? 'white' : '#ffebeb' }}>
                  <td style={{ padding: 10, fontWeight: 'bold' }}>{p.name}</td>
                  <td style={{ padding: 10 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, color: 'white',
                      background: p.role === 'Mafia' ? 'red' : (p.role === 'Arzt' ? 'green' : (p.role === 'Detektiv' ? 'blue' : 'gray'))
                    }}>{p.role}</span>
                  </td>
                  <td style={{ padding: 10 }}>{p.isAlive ? "✅ Lebt" : "💀 Tot"}</td>
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
    <div style={{ padding: 20, textAlign: 'center' }}>
      <h1>Mafia Login</h1>
      <div style={{ marginBottom: 40 }}>
        <input id="nameInput" placeholder="Dein Name" style={{ padding: 10, fontSize: 16 }} />
        <button onClick={() => {
          const n = document.getElementById("nameInput").value;
          if (!n) return;
          localStorage.setItem("mafia_name", n);
          socket.emit('joinGame', { playerId: playerId.current, name: n });
        }} style={{ padding: 10, margin: 10, background: '#ce8989', fontSize: 16, cursor: 'pointer' }}>Spiel Beitreten</button>
      </div>
      <hr />
      <div style={{ marginTop: 200 }}>
        <p>Nur für SPIELLEITER (NOTEBOOK)!!!</p>
        <button onClick={() => {
          socket.emit('registerHost');

          playerId.current = 'host';
          setMe({ name: "Spielleiter", role: "Spectator", playerId: "host", isAlive: true });
          setIsHostConsole(true);
        }} style={{ padding: 15, background: '#ce8989', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
          🖥️ Lobby erröffnen
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
      <button onClick={logout} style={{ position: 'absolute', top: 20, right: 10, padding: '5px 10px', fontSize: '30px', background: '#cccccc', border: 'none' }}>❌</button>
      <div style={{ marginBottom: 100, borderBottom: '2px solid #af5151', position: 'relative' }}>

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
          <button onClick={() => socket.emit('playerReady', me.playerId)} style={{ padding: 20, background: 'blue', color: 'white', width: '100%', marginTop: 20 }}>
            ICH HABE MEINE ROLLE GESEHEN (BEREIT)
          </button>
        </div>
      )}

      {gamePhase === 'READY_CHECK' && (
        <div>
          <h3>Macht euch bereit für die Nacht...</h3>
          <button onClick={() => socket.emit('playerReady', me.playerId)} style={{ padding: 20, background: 'orange' }}>BEREIT FÜR DIE NACHT</button>
        </div>
      )}

      {gamePhase.startsWith('NIGHT') && <NightPhase socket={socket} phase={gamePhase} me={me} players={players} />}
      {gamePhase.startsWith('DAY') && <DayPhase socket={socket} phase={gamePhase} me={me} players={players} tieCandidates={tieCandidates} />}

      {/* OVERLAY LOGIK: Nur anzeigen wenn nicht Host, nicht Lobby und wirklich tot */}
      {!me.isAlive && me.role !== 'Spectator' && gamePhase !== 'LOBBY' && gamePhase !== 'GAME_OVER' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', color: 'red', paddingTop: 100, pointerEvents: 'none' }}>
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