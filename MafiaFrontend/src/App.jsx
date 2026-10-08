import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'react-qr-code';
import Swal from 'sweetalert2';
import './App.css';
import { useTranslation } from 'react-i18next';

import Lobby from './components/Lobby';
import RoleCard from './components/RoleCard';
import NightPhase from './components/NightPhase';
import DayPhase from './components/DayPhase';
import AdminMenu from './components/AdminMenu';
import LanguageSelector from './components/LanguageSelector';

const SERVER_URL = "https://partyspiel-mafia.onrender.com";
const CLIENT_URL = "https://party-spiel-mafia.vercel.app";

function App() {
  const { t } = useTranslation();
  const [socket, setSocket] = useState(null);
  const [me, setMe] = useState(null);
  const [players, setPlayers] = useState([]);
  const [gamePhase, setGamePhase] = useState("LOBBY");
  const [settings, setSettings] = useState({});
  const [announcement, setAnnouncement] = useState("");
  const [tieCandidates, setTieCandidates] = useState([]);
  const [discussionOpener, setDiscussionOpener] = useState(null);
  const [isHostConsole, setIsHostConsole] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [currentVotes, setCurrentVotes] = useState({});
  const [roleConfirmed, setRoleConfirmed] = useState(false);
  const [gameLog, setGameLog] = useState([]);
  const [hostNightData, setHostNightData] = useState({ mafiaVotes: {}, docTarget: null, detTarget: null, ladyTarget: null });
  const [nightReady, setNightReady] = useState(false);
  const [phaseDuration, setPhaseDuration] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [winner, setWinner] = useState(null);
  const [showGameOverOverlay, setShowGameOverOverlay] = useState(false);
  const [wantsAdmin, setWantsAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const playerId = useRef(localStorage.getItem("mafia_pid") || uuidv4());
  const wasAlive = useRef(true);
  const wakeLockRef = useRef(null);

  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const requestWakeLock = async () => {
    if (!isMobile()) return;
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.error(`${err.name}, ${err.message}`);
      }
    }
  };

  const enterFullScreen = () => {
    if (!isMobile()) return;
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(err => console.log(err));
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
  };

  const triggerVibration = (pattern) => {
    if (navigator.vibrate) navigator.vibrate(pattern);
  };

  const playSound = (soundKey) => {
    const soundMap = {
      'morning': 'morning_rooster.wav',
      'gunshoot': 'gunshoot.mp3',
      'night_start_sound': 'night_start.mp3',
      'mafia_wake': 'mafia_wake.mp3',
      'mafia_sleep_sound': 'mafia_sleep.mp3',
      'doctor_wake': 'doctor_wake.mp3',
      'doctor_sleep_sound': 'doc_sleep.mp3',
      'detective_wake': 'detective_wake.mp3',
      'detective_sleep_sound': 'det_sleep.mp3',
      'lady_wake_sound': 'lady_wake.mp3',
      'lady_sleep_sound': 'lady_sleep.mp3',
      'game_over': 'game_over.mp3'
    };

    const fileName = soundMap[soundKey] || `${soundKey}.mp3`;
    const audio = new Audio(`/sounds/${fileName}`);
    audio.play().catch(e => console.log("Audio Autoplay blockiert:", e));
  };

  const logout = () => {
    if (socket) {
      socket.emit('disconnectPlayer', playerId.current);
      socket.disconnect();
    }
    localStorage.removeItem("mafia_name");
    localStorage.removeItem("mafia_pid");
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
      confirmButtonText: t('host_console.swal_yes'),
      cancelButtonText: t('admin.cancel')
    }).then((result) => {
      if (result.isConfirmed) {
        actionCallback();
      }
    });
  };

  const handleLogin = () => {
    const n = document.getElementById("nameInput").value;
    if (!n) return;

    setIsAdmin(wantsAdmin);
    enterFullScreen();
    requestWakeLock();
    localStorage.setItem("mafia_name", n);
    socket.emit('joinGame', { playerId: playerId.current, name: n, isAdmin: wantsAdmin });
  };

  useEffect(() => {
    localStorage.setItem("mafia_pid", playerId.current);
    const newSocket = io(SERVER_URL, { transports: ['websocket'] });
    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (me) {
      if (wasAlive.current === true && me.isAlive === false) {
        setTimeout(() => {
          if (navigator.vibrate) {
            navigator.vibrate([500, 200, 1000]);
          }
        }, 500);
      }
      wasAlive.current = me.isAlive;
    }
  }, [me]);

  useEffect(() => {
    if (gamePhase === 'GAME_OVER') {
      triggerVibration([2000]);
    }
  }, [gamePhase]);

  useEffect(() => {
    if (gamePhase !== 'READY_CHECK') {
      setNightReady(false);
    }
  }, [gamePhase]);

  useEffect(() => {
    if (phaseDuration > 0) {
      setTotalTime(phaseDuration / 1000);
      setTimeLeft(phaseDuration / 1000);

      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 0.1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setTimeLeft(0);
      setTotalTime(0);
    }
  }, [phaseDuration, gamePhase]);

  useEffect(() => {
    if (!socket) return;

    // Alle Event-Listener einmalig beim Verbindungsaufbau registrieren
    socket.on('connect', () => {
      const name = localStorage.getItem("mafia_name");
      if (name) socket.emit('joinGame', { playerId: playerId.current, name });
      if (isHostConsole) {
        socket.emit('registerHost');
      }
    });

    socket.on('recoverState', (data) => {
      let recoveredMe = data.me;
      if (data.myActionTarget) {
        recoveredMe = { ...recoveredMe, lastAction: data.myActionTarget };
      }
      setMe(recoveredMe);
      setPlayers(data.allPlayers);
      setGamePhase(data.gamePhase);
      setSettings(data.settings);
      if (data.tieCandidates) setTieCandidates(data.tieCandidates);
      if (data.dayVotes) setCurrentVotes(data.dayVotes);
      if (data.hostNightData) {
        setHostNightData(prev => ({
          ...prev,
          mafiaVotes: data.hostNightData.mafiaVotes || {},
          docTarget: data.hostNightData.doctorTarget,
          detTarget: data.hostNightData.detectiveTarget,
          ladyTarget: data.hostNightData.ladyTarget
        }));
      }
      if (data.phaseEndTime) {
        const now = Date.now();
        const remaining = data.phaseEndTime - now;
        setPhaseDuration(remaining > 0 ? remaining : 0);
      }
    });

    socket.on('voteUpdate', (votes) => setCurrentVotes(votes));
    socket.on('updatePlayerList', (list) => setPlayers(list));
    socket.on('receiveRole', (role) => setMe(prev => ({ ...prev, role, isAlive: true })));

    socket.on('gameStateUpdate', (data) => {
      if (data.gamePhase) setGamePhase(data.gamePhase);
      if (data.gamePhase === 'NIGHT_MAFIA') {
        setHostNightData({ mafiaVotes: {}, docTarget: null, detTarget: null, ladyTarget: null });
      }
      if (data.gamePhase === 'GAME_OVER' && data.winner) {
        setWinner(data.winner);
        setShowGameOverOverlay(true);
        setTimeout(() => setShowGameOverOverlay(false), 10000);
      }
      if (data.discussionOpener) setDiscussionOpener(data.discussionOpener);
      if (data.gamePhase === 'NIGHT_TRANSITION' || data.gamePhase === 'LOBBY') setDiscussionOpener(null);
      if (data.players) {
        setPlayers(data.players);
      }
      if (data.tieCandidates) setTieCandidates(data.tieCandidates);

      if (data.phaseEndTime) {
        const now = Date.now();
        const remaining = data.phaseEndTime - now;
        setPhaseDuration(remaining > 0 ? remaining : 0);
      } else if (data.duration) {
        setPhaseDuration(data.duration);
      } else {
        setPhaseDuration(0);
      }
    });

    socket.on('announcement', (msg) => {
      if (msg.includes(':')) {
        const [key, val1, val2] = msg.split(':');
        setAnnouncement(t(`announcements.${key}`, { val1, val2 }));
      } else {
        setAnnouncement(t(`announcements.${msg}`));
      }
    });

    socket.on('nightAnnouncement', ({ sound }) => { if (sound) playSound(sound); });

    socket.on('dayAnnouncement', ({ title, text }) => {
      const iAmHost = playerId.current === 'host' || isHostConsole;
      const tTitle = t(`announcements.${title}`);
      const tText = t(`announcements.${text}`);
      
      if (!iAmHost) {
        Swal.fire({ title: tTitle, text: tText, timer: 5000, showConfirmButton: false });
      }
      setAnnouncement(tText);
    });

    socket.on('detectiveResult', (data) => {
      if (!isHostConsole) {
        const messageHtml = data.isEvil
          ? '<div class="pulse-text">MAFIA! 😈</div>'
          : '<div class="pulse-text" style="color: #28a745">Bürger. 😇</div>';
        Swal.fire({
          html: messageHtml,
          timer: 5000,
          background: '#121212',
          color: '#ffffff',
          confirmButtonText: t('host_console.understood'),
          confirmButtonColor: '#3085d6'
        });
      }
    });

    socket.on('playSound', (type) => playSound(type));

    socket.on('gameReset', (updatedPlayerList) => {
      setGamePhase("LOBBY");
      setPlayers(updatedPlayerList);
      setTieCandidates([]);
      setAnnouncement("");
      setCurrentVotes({});
      setRoleConfirmed(false);
      setGameLog([]);
      setHostNightData({ mafiaVotes: {}, docTarget: null, detTarget: null, ladyTarget: null });

      if (playerId.current !== 'host') {
        setMe(prev => prev ? ({ ...prev, role: t('roles.not_assigned'), isAlive: true, lastAction: null }) : null);
      }

      if (!isHostConsole) {
        Swal.fire({ icon: 'info', title: t('admin.btn_reset'), text: t('host_console.game_restarted_msg'), timer: 5000, showConfirmButton: false });
      }
    });

    socket.on('serverLog', ({ msg, type }) => {
      const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setGameLog(prev => [{ time, msg, type }, ...prev]);
    });

    socket.on('hostActionUpdate', (update) => {
      const addLog = (msg, type = 'info') => {
        const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setGameLog(prev => [{ time, msg, type }, ...prev]);
      };

      if (update.type === 'MAFIA_VOTE') {
        setHostNightData(prev => ({ ...prev, mafiaVotes: update.data }));
        addLog(t('host_console.log_mafia_voted'), 'action');
      }
      if (update.type === 'DOC_ACTION') {
        setHostNightData(prev => ({ ...prev, docTarget: update.target }));
        addLog(t('host_console.log_doc_acted'), 'success');
      }
      if (update.type === 'DET_ACTION') {
        setHostNightData(prev => ({ ...prev, detTarget: update.target }));
        addLog(t('host_console.log_det_acted'), 'info');
      }
      if (update.type === 'LADY_ACTION') {
        setHostNightData(prev => ({ ...prev, ladyTarget: update.target }));
        addLog(t('host_console.log_lady_acted'), 'warning');
      }
    });

    // 🔴 WICHTIG: Hier fangen wir das "Alle kicken"-Signal ab und leeren den Speicher absolut zuverlässig
    socket.on('forceReload', () => {
      // 1. Event-Listener sofort killen, damit das Swal-Popup von 'gameReset' nicht mehr getriggert wird
      socket.off('gameReset');
      
      // 2. Verbindung kappen, um sauberen Cut zu machen
      socket.disconnect();

      // 3. Kompletten Speicher löschen (Name, ID, Sprache)
      localStorage.clear();

      // 4. Seite neuladen - jetzt ohne Blockade
      window.location.reload();
    });

  const getTranslatedRole = (role) => {
    switch (role?.toLowerCase()) {
      case 'mafia': return t('roles.mafia');
      case 'arzt':
      case 'doctor': return t('roles.doctor');
      case 'detektiv':
      case 'detective': return t('roles.detective');
      case 'lady': return t('roles.lady');
      case 'spectator': return t('roles.spectator');
      default: return t('roles.not_assigned');
    }
  };

  // --- HOST CONSOLE VIEW (Laptop Only) ---
  if (isHostConsole) {
    const getName = (id) => {
      if (!id) return t('host_console.unknown');
      return players.find(p => p.playerId === id)?.name || t('host_console.unknown');
    };
    const progressPercent = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;

    return (
      <div className="host-container">
        <div className="host-header" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h1 style={{ fontSize: '1.2rem', margin: 0 }}>🕵️ {t('host_console.master_control')}</h1>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <div className="current-phase-badge" style={{ marginBottom: '5px', width: '100%', textAlign: 'center' }}>
              {gamePhase}
            </div>
            {totalTime > 0 ? (
              <div style={{ width: '100%', background: '#333', borderRadius: '4px', position: 'relative', height: '30px', overflow: 'hidden' }}>
                <div className="host-timer-fill" style={{ width: `${progressPercent}%` }}></div>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', textShadow: '0 0 2px black', color: 'white' }}>
                  ⏱️ {Math.ceil(timeLeft)}s
                </div>
              </div>
            ) : (
              <div style={{ color: '#666', fontStyle: 'italic', fontSize: '0.9rem' }}>-- {t('host_console.no_time_limit')} --</div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            {gamePhase !== 'LOBBY' && (
              <button onClick={() => socket.emit('forcePhaseNext')} className="btn-emergency">
                ⏩ {t('host_console.skip')}
              </button>
            )}
          </div>
        </div>

        <div className="host-grid">
          <div className="host-panel host-controls">
            <h3>🕹️ {t('host_console.options')}</h3>
            {gamePhase === 'LOBBY' && (
              <>
                <Lobby socket={socket} players={players} isHost={true} />
                <div className="qr-card">
                  <QRCode value={CLIENT_URL} size={150} />
                  <div className="qr-link">{CLIENT_URL}</div>
                </div>
              </>
            )}

            {gamePhase === 'GAME_OVER' && (
              <div style={{ textAlign: 'center', padding: '20px', background: '#444', borderRadius: '8px', marginBottom: '20px' }}>
                <h2 style={{ color: '#fff', margin: '0 0 10px 0' }}>{t('host_console.game_over_title')}</h2>
                <p style={{ color: '#ccc' }}>{t('host_console.game_over_desc')}</p>
                <button onClick={() => handleHostAction(t('host_console.new_game_q'), t('host_console.new_game_text'), () => socket.emit('resetGame'))} className="btn-big-action neon-pulse" style={{ width: '100%', background: '#28a745', fontSize: '1.2rem', padding: '15px' }}>
                  🔄 {t('host_console.start_new_game')}
                </button>
              </div>
            )}

            {gamePhase !== 'LOBBY' && gamePhase !== 'GAME_OVER' && (
              <div style={{ padding: '10px', textAlign: 'center', color: '#888' }}>
                {t('host_console.game_running')} <br />
                <small>{t('host_console.game_running_sub')}</small>
              </div>
            )}

            <div className="danger-zone">
              <p>{t('host_console.session_mgmt')}:</p>
              <div className="danger-buttons">
                <button onClick={() => handleHostAction(t('admin.reset_title'), t('admin.reset_text'), () => socket.emit('resetGame'))} className="btn-restart">
                  🔄 {t('admin.btn_reset')}
                </button>
                <button onClick={() => handleHostAction(t('admin.kick_title'), t('admin.kick_text'), () => socket.emit('kickAll'), '#ff0000')} className="btn-kick">
                  ⚠️ {t('admin.btn_kick')}
                </button>
              </div>
            </div>
          </div>

          <div className="host-panel host-live-info">
            <h3>📊 {t('host_console.live_status')}</h3>
            {gamePhase.startsWith('NIGHT') && (
              <div className="info-box night-box">
                <h4>🌙 {t('host_console.night_actions')}</h4>
                <div>
                  <strong>{t('host_console.mafia_votes')}:</strong>
                  <ul className="mini-list">
                    {Object.entries(hostNightData.mafiaVotes).map(([voterId, targetId]) => (
                      <li key={voterId}>
                        {getName(voterId)} 🔪 {t('host_console.wants_to_kill')}: <span style={{ color: 'red' }}>{getName(targetId)}</span>
                      </li>
                    ))}
                    {Object.keys(hostNightData.mafiaVotes).length === 0 && <li>{t('host_console.no_votes_yet')}</li>}
                  </ul>
                </div>
                <div style={{ marginTop: 10 }}><br />
                  <strong>{t('roles.doctor')}:</strong><br /> - {hostNightData.docTarget ? `${t('host_console.protects')} ${getName(hostNightData.docTarget)}` : t('host_console.sleeping_thinking')}
                </div>
                <div><br />
                  <strong>{t('roles.detective')}:</strong><br />- {hostNightData.detTarget ? `${t('host_console.checks')} ${getName(hostNightData.detTarget)}` : t('host_console.sleeping_thinking')}
                </div>
                <div><br />
                  <strong>{t('roles.lady')}:</strong><br />- {hostNightData.ladyTarget ? `${t('host_console.visits')} ${getName(hostNightData.ladyTarget)}` : t('host_console.sleeping_thinking')}
                </div>
              </div>
            )}

            {(gamePhase.startsWith('DAY') || gamePhase === 'DAY_VOTE') && (
              <div className="info-box day-box">
                <h4>☀️ {t('host_console.day_actions')}</h4>
                <p>{t('host_console.votes_cast')}: {Object.keys(currentVotes).length} / {players.filter(p => p.isAlive && p.playerId !== 'host').length}</p>
                <div className="vote-tally">
                  {(() => {
                    const counts = {};
                    Object.values(currentVotes).forEach(item => counts[item] = (counts[item] || 0) + 1);
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

          <div className="host-panel host-log">
            <h3>📜 {t('host_console.chronicle')}</h3>
            <div className="log-container">
              {gameLog.length === 0 && <p style={{ color: '#999' }}>{t('host_console.log_empty')}</p>}
              {gameLog.map((entry, i) => (
                <div key={i} className={`log-entry type-${entry.type}`}>
                  <span className="log-time">[{entry.time}]</span>
                  <span className="log-msg" style={{ whiteSpace: 'pre-wrap' }}>{entry.msg}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="host-panel host-players">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #555', marginBottom: '10px', paddingBottom: '5px' }}>
              <h3 style={{ margin: 0, border: 'none', padding: 0 }}>👥 {t('host_console.players_count', { count: players.length })}</h3>
              <button onClick={() => setShowRoles(!showRoles)} style={{ background: 'transparent', border: '1px solid #666', color: showRoles ? '#ff4444' : '#888', padding: '2px 8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                {showRoles ? t('host_console.hide') : t('host_console.show')}
              </button>
            </div>

            <div className="player-list-scroll">
              <table className="player-table">
                <thead><tr><th>{t('host_console.col_name')}</th><th>{t('host_console.col_role')}</th><th>{t('host_console.col_status')}</th></tr></thead>
                <tbody>
                  {players.map(p => {
                    const hasVoted = gamePhase.startsWith('DAY') && currentVotes[p.playerId];
                    const isMafiaVoter = gamePhase === 'NIGHT_MAFIA' && hostNightData.mafiaVotes[p.playerId];
                    let roleDisplay = showRoles ? <span className={`role-badge badge-${p.role.toLowerCase()}`}>{getTranslatedRole(p.role)}</span> : <span className="role-badge badge-spoiler">???</span>;
                    return (
                      <tr key={p.playerId} className={p.isAlive ? 'row-alive' : 'row-dead'}>
                        <td style={{ fontWeight: 'bold' }}>{p.name}</td>
                        <td>{roleDisplay}</td>
                        <td>{p.isAlive ? ((hasVoted || isMafiaVoter) ? t('host_console.status_ready') : t('host_console.status_thinking')) : t('host_console.status_dead')}</td>
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

  // --- LOGIN SCREEN ---
  if (!me) return (
    <div className="login-container">
      
      <h1 className="mafia-title">{t('login.title')}</h1>

      <div className="input-group">
        <input
          id="nameInput"
          placeholder={t('login.name_placeholder')}
          className="login-input"
        />
        <LanguageSelector />

        <button
          className="btn-login"
          onClick={handleLogin}
          style={wantsAdmin ? { background: '#ffd700', color: 'black', boxShadow: '0 0 20px #ffd700' } : {}}
        >
          {wantsAdmin ? t('login.open_lobby') : t('login.join')}
        </button>
      </div>

      <div className="host-footer" style={{ width: '100%', maxWidth: '350px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <label className="admin-toggle-container" style={{ margin: 0 }}>
          <span>{t('login.as_host')}</span>
          <div className="toggle-switch">
            <input
              type="checkbox"
              checked={wantsAdmin}
              onChange={(e) => setWantsAdmin(e.target.checked)}
            />
            <span className="slider round"></span>
          </div>
        </label>

        <button
          className="btn-host-login"
          onClick={() => {
            socket.emit('registerHost');
            playerId.current = 'host';
            setMe({ name: t('roles.spielleiter'), role: "Spectator", playerId: "host", isAlive: true });
            setIsHostConsole(true);
          }}
        >
          {t('login.laptop_host')}
        </button>

        <p className="host-warning" style={{ margin: 0 }}>{t('login.host_warning')}</p>
      </div>
    </div>
  );

  const isNight = gamePhase.startsWith('NIGHT');
  return (
    <div className={`player-app-container ${isNight ? 'night-mode' : ''}`}>
      <AdminMenu socket={socket} isAdmin={isAdmin} onLogout={logout} />

      {gamePhase === 'LOBBY' && (
        <div style={{ marginBottom: 30 }}>
          <h1 className="mafia-title" style={{ fontSize: '3rem', marginBottom: '10px' }}>{t('login.title')}</h1>
          <Lobby socket={socket} players={players} isHost={isAdmin} />
          {isAdmin && (
            <div className="qr-card">
              <div style={{ background: 'white', padding: '10px', borderRadius: '10px' }}>
                <QRCode
                  value={CLIENT_URL}
                  size={150}
                  style={{ display: 'block' }}
                  viewBox={`0 0 256 256`}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {gamePhase === 'ROLE_REVEAL' && (
        <div>
          <RoleCard role={getTranslatedRole(me.role)} name={me.name} />
          <button
            disabled={roleConfirmed}
            onClick={() => {
              enterFullScreen();
              requestWakeLock();
              socket.emit('playerReady', me.playerId);
              setRoleConfirmed(true);
            }}
            className="btn-big-action bg-blue"
            style={{
              backgroundColor: roleConfirmed ? '' : '#69756c',
              cursor: roleConfirmed ? 'default' : 'pointer',
              transform: roleConfirmed ? 'none' : '',
              color: '#57233a'
            }}
          >
            {roleConfirmed ? t('app.sun_down') : t('app.ready_first_night')}
          </button>
        </div>
      )}

      {gamePhase === 'READY_CHECK' && (
        <div>
          <h3>{t('app.sun_down')}</h3>
          <button
            onClick={() => {
              socket.emit('playerReady', me.playerId);
              setNightReady(true);
            }}
            disabled={nightReady}
            className={`btn-big-action ${nightReady ? 'bg-blue' : 'bg-orange'}`}
            style={nightReady ? { opacity: 0.6, cursor: 'default' } : {}}
          >
            {nightReady ? t('app.waiting_others') : t('app.ready_night')}
          </button>
        </div>
      )}

      {showGameOverOverlay && (
        <div className={`game-over-overlay winner-${winner?.toLowerCase()}`}>
          <h1 className="go-title">{t('app.game_over')}</h1>
          <div className="go-winner-box">
            {winner === 'MAFIA' ? (
              <>
                <span style={{ fontSize: '4rem' }}>😈</span>
                <h2>{t('app.mafia_wins')}</h2>
              </>
            ) : (
              <>
                <span style={{ fontSize: '4rem' }}>🥳</span>
                <h2>{t('app.citizens_wins')}</h2>
              </>
            )}
          </div>
        </div>
      )}

      {gamePhase.startsWith('NIGHT') && <NightPhase socket={socket} phase={gamePhase} me={me} players={players} duration={phaseDuration} />}
      {gamePhase.startsWith('DAY') && <DayPhase socket={socket} phase={gamePhase} me={me} players={players} tieCandidates={tieCandidates} currentVotes={currentVotes} opener={discussionOpener} />}

      {/* DEAD OVERLAY */}
      {!me.isAlive && me.role !== 'Spectator' && gamePhase !== 'LOBBY' && gamePhase !== 'GAME_OVER' && (
        <div className="dead-overlay">
          <h1>{t('app.you_are_dead')} <br />💀</h1>
          <p>{t('app.wait_for_end')}</p>
        </div>
      )}

      {gamePhase === 'GAME_OVER' && (
        <div>
          <h1>{t('app.game_over')}!</h1>
          <h2>{announcement}</h2>
        </div>
      )}
    </div>
  );
}

export default App;