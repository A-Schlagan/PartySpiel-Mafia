//App.jsx
import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'react-qr-code';

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

  const playerId = useRef(localStorage.getItem("mafia_pid") || uuidv4());

  // Sound Player (Braucht Datei im public Ordner)
  const playSound = () => {
    const audio = new Audio('/sound_morning.mp3');
    audio.play().catch(e => console.log("Audio Autoplay blockiert vom Browser", e));
  };

  // Funktion zum Ausloggen / Namen ändern
  const logout = () => {
    localStorage.removeItem("mafia_name"); // Namen löschen
    localStorage.removeItem("mafia_pid");  // ID löschen (optional, für ganz neuen Spieler)
    window.location.reload();              // Seite neu laden
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
        setMe(prev => ({ ...prev, role }));
      });

      socket.on('gameStateUpdate', (data) => {
        if (data.gamePhase) setGamePhase(data.gamePhase);
        if (data.players) setPlayers(data.players);
        if (data.tieCandidates) setTieCandidates(data.tieCandidates);
      });

      socket.on('announcement', (msg) => {
        setAnnouncement(msg);
        alert(msg); // Oder schönes Popup
      });

      socket.on('detectiveResult', (data) => {
        alert(data.isEvil ? "BÖSE (Mafia)" : "GUT (Bürger)");
      });

      socket.on('playSound', (type) => {
        if (type === 'morning') playSound();
      });

      // ... andere socket.on Events ...    
      socket.on('gameReset', (updatedPlayerList) => {
          setGamePhase("LOBBY");
          setPlayers(updatedPlayerList);
          setTieCandidates([]);
          setAnnouncement("");
          
          // Falls man Spieler ist: Rolle löschen
          if (me && me.playerId !== 'host') {
              setMe(prev => ({ ...prev, role: "Noch nicht verteilt", isAlive: true }));
          }
          alert("Das Spiel wurde neu gestartet!");
      });
      
    }
  }, [socket]);

  // Login Screen
  if (!me) return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <h1>Mafia Login</h1>

      {/* Spieler Login */}
      <div style={{ marginBottom: 40 }}>
        <input id="nameInput" placeholder="Dein Name" style={{ padding: 10, fontSize: 16 }} />
        <button onClick={() => {
          const n = document.getElementById("nameInput").value;
          if (!n) return;
          localStorage.setItem("mafia_name", n);
          socket.emit('joinGame', { playerId: playerId.current, name: n });
        }} style={{ padding: 10, margin: 10, fontSize: 16, cursor: 'pointer' }}>Spiel Beitreten</button>
      </div>

      <hr />

      {/* Host Login (PC) */}
      <div style={{ marginTop: 20 }}>
        <p>Für den großen Bildschirm (PC):</p>
        <button onClick={() => {
          socket.emit('registerHost'); // Sagt dem Server: "Ich bin der Host"
          setMe({ name: "Spielleiter", role: "Spectator", playerId: "host" }); // Lokaler Dummy-User
          setIsHostConsole(true); // Merken, dass wir Host sind
        }} style={{ padding: 15, background: 'black', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
          🖥️ Als Spielleiter-Panel starten
        </button>
      </div>
    </div>
  );

  // --- HAUPTANSICHT ---
  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif', maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>

      {/* HEADER */}
      <div style={{ marginBottom: 20, borderBottom: '1px solid #ccc', position: 'relative' }}>
        <h2>Mafia - Phase: {gamePhase}</h2>
        
        {me.role !== 'Spectator' && (
            <p>
                Du bist: <strong>{me.name}</strong>
            </p>
        )}

        {/* --- DER NEUE AUSLOGGEN BUTTON --- */}
        <button 
            onClick={logout} 
            style={{
                position: 'absolute', 
                top: 0, 
                right: 0, 
                padding: '5px 10px', 
                fontSize: '10px', 
                background: '#ccc', 
                border: 'none', 
                cursor: 'pointer'
            }}
        >
            ❌ Ausloggen
        </button>
        {/* -------------------------------- */}
      </div>

      {/* HOST QR CODE (Nur in Lobby) */}
      {gamePhase === 'LOBBY' && (
        <div style={{ marginBottom: 30 }}>
          <QRCode value={CLIENT_URL} size={150} />
          <p style={{ fontSize: 10 }}>{CLIENT_URL}</p>
          <Lobby
            socket={socket}
            players={players}
            isHost={isHostConsole || (players[0] && players[0].playerId === me.playerId)}
          />
        </div>
      )}

      {/* ROLLEN ANZEIGEN */}
      {gamePhase === 'ROLE_REVEAL' && (
        <div>
          <RoleCard role={me.role} name={me.name} />
          <button onClick={() => socket.emit('playerReady', me.playerId)}
            style={{ padding: 20, background: 'blue', color: 'white', width: '100%', marginTop: 20 }}>
            ICH HABE MEINE ROLLE GESEHEN &lt;br/&gt; (BEREIT)
          </button>
        </div>
      )}

      {/* WARTE AUF ANDERE (READY CHECK) */}
      {gamePhase === 'READY_CHECK' && (
        <div>
          <h3>Macht euch bereit für die Nacht...</h3>
          <button onClick={() => socket.emit('playerReady', me.playerId)} style={{ padding: 20, background: 'orange' }}>
            BEREIT FÜR DIE NACHT
          </button>
        </div>
      )}

      {/* NACHT PHASEN */}
      {gamePhase.startsWith('NIGHT') && (
        <NightPhase socket={socket} phase={gamePhase} me={me} players={players} />
      )}

      {/* TAG PHASEN */}
      {gamePhase.startsWith('DAY') && (
        <DayPhase socket={socket} phase={gamePhase} me={me} players={players} tieCandidates={tieCandidates} />
      )}

      {/* BUTTONS FÜR DISKUSSION (Vom Host/Jedem steuerbar oder automatisch) */}
      {gamePhase === 'DAY_ANNOUNCE' && (
        <button onClick={() => socket.emit('startVoting')} style={{ marginTop: 20, padding: 15, background: 'purple', color: 'white' }}>
                 DISKUSSION BEENDEN ➡️ ABSTIMMUNG STARTEN
        </button>
      )}
      {gamePhase === 'DAY_VOTE' && (
        <button onClick={() => socket.emit('evaluateDayVote')} style={{ marginTop: 20, padding: 15, background: 'red', color: 'white' }}>
          ABSTIMMUNG AUSWERTEN
        </button>
      )}

      {/* TOT */}
      {!me.isAlive && gamePhase !== 'LOBBY' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', color: 'red', paddingTop: 100, pointerEvents: 'none' }}>
          <h1>DU BIST TOT 💀</h1>
          <p>Du bist jetzt Zuschauer.</p>
        </div>
      )}

      {/* GAME OVER */}
      {gamePhase === 'GAME_OVER' && (
        <div>
          <h1>SPIEL VORBEI!</h1>
          <h2>{announcement}</h2>
          <button onClick={() => socket.emit('resetGame')} style={{ padding: 20, background: 'green', color: 'white' }}>NEUE RUNDE</button>
        </div>
      )}

      {/* HOST STEUERUNG (RESET) */}
      {(isHostConsole || (players.length > 0 && players[0].playerId === me.playerId)) && gamePhase !== 'LOBBY' && (
        <div style={{ marginTop: 50, borderTop: '2px solid black', paddingTop: 20 }}>
            <h3>Spielleiter Zone 🛑</h3>
            <button onClick={() => {
                if(confirm("Bist du sicher? Das Spiel wird komplett neu gestartet!")) {
                    socket.emit('resetGame');
                }
            }} style={{ padding: 15, background: 'darkred', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
                ⚠️ SPIEL ABBRECHEN / RESET
            </button>
        </div>
      )}
      

    </div>
  );
}

export default App;