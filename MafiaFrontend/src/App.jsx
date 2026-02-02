import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import QRCode from "react-qr-code";

const SERVER_URL = "https://ffq399v6-5000.euw.devtunnels.ms";
const CLIENT_URL = "https://ffq399v6-5173.euw.devtunnels.ms"; 

function App() {
  const [socket, setSocket] = useState(null);
  const [view, setView] = useState("LOGIN"); // LOGIN, LOBBY, GAME, HOST
  const [name, setName] = useState("");
  const [myRole, setMyRole] = useState("");
  const [players, setPlayers] = useState([]);
  const [phase, setPhase] = useState("DAY"); // DAY, NIGHT, VOTING
  
  const playerId = useRef(localStorage.getItem("mafia_pid") || uuidv4());

  useEffect(() => {
    localStorage.setItem("mafia_pid", playerId.current);

    const newSocket = io(SERVER_URL, {
        transports: ['websocket'],
        reconnection: true,
    });
    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on("connect", () => {
        const savedName = localStorage.getItem("mafia_name");
        if(savedName && view !== "HOST") joinGame(savedName, true);
      });

      socket.on("receiveRole", (role) => {
        setMyRole(role);
        setView("GAME");
      });

      socket.on("recoverState", (state) => {
        setName(state.name);
        setPhase(state.gamePhase);
        if(state.role !== "Noch nicht verteilt") {
            setMyRole(state.role);
            setView("GAME");
        } else {
            setView("LOBBY");
        }
      });

      socket.on("updatePlayerList", (list) => setPlayers(list));
      socket.on("gameStarted", (list) => setPlayers(list));
      
      socket.on("phaseChange", (p) => setPhase(p));

      socket.on("dayResult", (data) => {
          setPlayers(data.players);
          if(data.message) alert(data.message);
      });

      socket.on("detectiveResult", (data) => {
          alert(data.isEvil 
            ? `😈 ${data.name} ist MAFIA!` 
            : `😇 ${data.name} ist ein BÜRGER.`);
      });
    }
  }, [socket]);

  const joinGame = (pName, isAuto = false) => {
    if(!isAuto) {
        setName(pName);
        localStorage.setItem("mafia_name", pName);
    }
    socket.emit("joinGame", { playerId: playerId.current, name: pName });
    if(!isAuto) setView("LOBBY");
  };


  const hostStartGame = () => {
    socket.emit("startGame");
  };

  // --- VIEWS ---

  if (view === "LOGIN") return (
    <div style={styles.container}>
      <h1>Mafia Party 🕵️‍♂️</h1>
      <input placeholder="Dein Name" value={name} onChange={e => setName(e.target.value)} style={styles.input} />
      <button onClick={() => joinGame(name)} style={styles.btn}>Beitreten</button>
      <hr style={{margin:'20px 0'}}/>
      <button onClick={() => {socket.emit("registerHost"); setView("HOST");}} style={styles.btnSmall}>Als Host starten (PC)</button>
    </div>
  );

  if (view === "LOBBY") return (
    <div style={styles.container}>
      <h1>Lobby</h1>
      <p>Warte auf Start...</p>
      <h3>Hallo {name} 👋</h3>
    </div>
  );

  if (view === "GAME") {
      const me = players.find(p => p.playerId === playerId.current);
      if (me && !me.isAlive) return (
        <div style={{...styles.container, background:'black', color:'red'}}>
            <h1>DU BIST TOT 💀</h1>
            <p>Sei bitte still...</p>
        </div>
      );

      const isNight = phase === "NIGHT";
      const isVoting = phase === "VOTING";

      return (
        <div style={{...styles.container, background: isNight ? '#222' : '#f4f4f4', color: isNight ? 'white' : 'black'}}>
          <h2 style={{fontSize: 40}}>{isNight ? 'NACHT 🌙' : (isVoting ? 'ABSTIMMUNG 🗳️' : 'TAG ☀️')}</h2>
          <h3>Deine Rolle: <span style={{color: 'orange'}}>{myRole}</span></h3>
          <p style={{fontStyle:'italic'}}>Halte dein Display geheim!</p>

          <div style={{display:'flex', flexDirection:'column', gap: 10, marginTop: 20}}>
            
            {/* MAFIA ACTION */}
            {isNight && myRole === 'Mafia' && (
                <>
                <p style={{color:'red'}}>Wen willst du eliminieren?</p>
                {players.filter(p => p.isAlive && p.role !== 'Mafia').map(p => (
                    <button key={p.playerId} onClick={() => {socket.emit('mafiaAction', p.playerId); alert('Ziel gewählt');}} style={styles.btnActionRed}>
                        💀 {p.name}
                    </button>
                ))}
                </>
            )}

            {/* ARZT ACTION */}
            {isNight && myRole === 'Arzt' && (
                <>
                <p style={{color:'green'}}>Wen willst du schützen?</p>
                {players.filter(p => p.isAlive).map(p => (
                    <button key={p.playerId} onClick={() => {socket.emit('doctorAction', p.playerId); alert('Geschützt!');}} style={styles.btnActionGreen}>
                        ❤️ {p.name}
                    </button>
                ))}
                </>
            )}

            {/* DETEKTIV ACTION */}
            {isNight && myRole === 'Detektiv' && (
                <>
                <p style={{color:'cyan'}}>Wen willst du überprüfen?</p>
                {players.filter(p => p.isAlive && p.playerId !== playerId.current).map(p => (
                    <button key={p.playerId} onClick={() => socket.emit('detectiveAction', p.playerId)} style={styles.btnActionBlue}>
                        🔍 {p.name}
                    </button>
                ))}
                </>
            )}

            {/* VOTING (ALLE) */}
            {isVoting && (
                <>
                <p>Wer soll gehängt werden?</p>
                {players.filter(p => p.isAlive && p.playerId !== playerId.current).map(p => (
                    <button key={p.playerId} onClick={() => {socket.emit('submitDayVote', p.playerId); alert('Stimme abgegeben');}} style={styles.btnActionYellow}>
                        👉 {p.name}
                    </button>
                ))}
                </>
            )}

            {/* INFO FÜR ANDERE */}
            {isNight && !['Mafia', 'Arzt', 'Detektiv'].includes(myRole) && <p>Du schläfst... 💤</p>}
            {phase === 'DAY' && <p>Diskutiert! Wer ist die Mafia?</p>}
          </div>
        </div>
      );
  }

  if (view === "HOST") return (
    <div style={{padding: 30, fontFamily: 'sans-serif'}}>
      <h1>Spielleiter Panel 🎮</h1>
      
      {/* --- QR CODE BEREICH --- */}
      <div style={{padding: 20, background: 'white', border: '1px solid #ccc', display: 'inline-block', marginBottom: 20}}>
          <p style={{marginBottom: 10}}>Scannen zum Beitreten:</p>
          
          {/* Das generiert den QR Code automatisch aus deiner URL */}
          <QRCode value={CLIENT_URL} size={200} />
          
          <p style={{marginTop: 10, fontSize: 12, color: 'gray'}}>{CLIENT_URL}</p>
      </div>
      {/* ----------------------- */}

      <div style={{display:'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap'}}>
          <button onClick={hostStartGame} style={styles.btnHost}>🏁 Spiel Starten</button>
          <button onClick={() => socket.emit('startNight')} style={{...styles.btnHost, background:'#333'}}>🌙 Nacht Starten</button>
          <button onClick={() => socket.emit('startDay')} style={{...styles.btnHost, background:'orange'}}>☀️ Tag (Auswertung)</button>
          <button onClick={() => socket.emit('startVoting')} style={{...styles.btnHost, background:'purple'}}>🗳️ Abstimmung Starten</button>
          <button onClick={() => socket.emit('endVoting')} style={{...styles.btnHost, background:'red'}}>⚖️ Abstimmung Beenden (Hängen)</button>
      </div>

      <h3>Spieler ({players.length}):</h3>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 10}}>
        {players.map(p => (
            <div key={p.playerId} style={{
                padding: 10, border: '1px solid #ccc', 
                background: p.isAlive ? (p.isOnline ? '#dfd' : '#eee') : '#fdd',
                textDecoration: p.isAlive ? 'none' : 'line-through'
            }}>
                <b>{p.name}</b> <br/>
                <small>{p.role}</small> 
                {!p.isOnline && " (offline)"}
                {!p.isAlive && " 💀"}
            </div>
        ))}
      </div>
    </div>
  );

  return <div>Lade...</div>;
}

// Einfache Styles für besseres Aussehen
const styles = {
    container: { padding: 20, textAlign: 'center', fontFamily: 'sans-serif', height: '100vh', transition: '0.3s' },
    input: { padding: 15, fontSize: 18, borderRadius: 8, border: '1px solid #ccc', width: '80%', marginBottom: 10 },
    btn: { padding: 15, fontSize: 18, background: '#007bff', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', width: '100%' },
    btnSmall: { padding: 10, marginTop: 20, cursor: 'pointer' },
    btnHost: { padding: 10, color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', background: 'green', fontWeight: 'bold' },
    btnActionRed: { padding: 15, background: '#d32f2f', color: 'white', border: 'none', borderRadius: 8, fontSize: 18, cursor: 'pointer' },
    btnActionGreen: { padding: 15, background: '#2e7d32', color: 'white', border: 'none', borderRadius: 8, fontSize: 18, cursor: 'pointer' },
    btnActionBlue: { padding: 15, background: '#0288d1', color: 'white', border: 'none', borderRadius: 8, fontSize: 18, cursor: 'pointer' },
    btnActionYellow: { padding: 15, background: '#fbc02d', color: 'black', border: 'none', borderRadius: 8, fontSize: 18, cursor: 'pointer' },
};

export default App;