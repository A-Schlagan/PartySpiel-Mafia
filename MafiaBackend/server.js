// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const DISCUSSION_TIME_MS = 10000; 

let players = {}; 
let settings = { mafiaCount: 1, hasDoctor: true, hasDetective: true };
let gamePhase = "LOBBY"; 
let nightActions = { mafiaVotes: {}, doctorTarget: null, detectiveTarget: null };
let dayVotes = {};
let readyPlayers = []; 
let tieCandidates = []; 
let gameTimer = null; 

io.on('connection', (socket) => {
    
    socket.on('joinGame', ({ playerId, name }) => {
        if (players[playerId]) {
            players[playerId].socketId = socket.id;
            players[playerId].isOnline = true;
            socket.emit('recoverState', { me: players[playerId], allPlayers: Object.values(players), gamePhase, settings, tieCandidates });
        } else {
            players[playerId] = {
                playerId, socketId: socket.id, name, 
                role: "Spectator", isAlive: true, isOnline: true
            };
        }
        io.emit('updatePlayerList', Object.values(players));
    });

    socket.on('registerHost', () => {
        socket.emit('recoverState', { me: { role: 'Spectator', name: 'Host' }, allPlayers: Object.values(players), gamePhase, settings, tieCandidates });
    });

    socket.on('setupGame', (newSettings) => {
        settings = newSettings;
        const pIds = Object.keys(players).filter(pid => players[pid].playerId !== 'host');
        
        let roles = Array(parseInt(settings.mafiaCount)).fill("Mafia");
        if(settings.hasDoctor) roles.push("Arzt");
        if(settings.hasDetective) roles.push("Detektiv");
        while(roles.length < pIds.length) roles.push("Bürger");
        roles.sort(() => Math.random() - 0.5);

        pIds.forEach((pid, i) => {
            players[pid].role = roles[i];
            players[pid].isAlive = true; 
            io.to(players[pid].socketId).emit('receiveRole', players[pid].role);
        });

        gamePhase = "ROLE_REVEAL";
        readyPlayers = [];
        io.emit('gameStateUpdate', { gamePhase, players: Object.values(players) });
    });

    socket.on('playerReady', (pid) => {
        if(!readyPlayers.includes(pid)) readyPlayers.push(pid);
        const livingPlayers = Object.values(players).filter(p => p.isAlive && p.playerId !== 'host').length;
        if(readyPlayers.length >= livingPlayers && livingPlayers > 0) {
            startNight();
        } else {
            io.emit('readyUpdate', readyPlayers.length);
        }
    });

    socket.on('mafiaVote', ({ voterId, targetId }) => {
        if(gamePhase !== 'NIGHT_MAFIA') return;
        nightActions.mafiaVotes[voterId] = targetId;
        
        const mafiaPlayers = Object.values(players).filter(p => p.role === 'Mafia' && p.isAlive);
        mafiaPlayers.forEach(p => { io.to(p.socketId).emit('mafiaVoteUpdate', nightActions.mafiaVotes); });
        
        const votes = Object.values(nightActions.mafiaVotes);
        // Wenn alle Mafiosi abgestimmt haben und es einstimmig ist
        if(votes.length === mafiaPlayers.length && votes.every(v => v === votes[0])) {
            // Kleiner Delay für Dramatik, dann nächste Phase
            if(gameTimer) clearTimeout(gameTimer);
            gameTimer = setTimeout(() => nextNightPhase(), 2000);
        }
    });

    socket.on('doctorAction', (targetId) => {
        if(gamePhase !== 'NIGHT_DOCTOR') return;
        
        // Sicherheitscheck: Nur lebender Arzt darf Aktion senden
        const actor = players[Object.keys(players).find(id => players[id].socketId === socket.id)];
        if(!actor || !actor.isAlive || actor.role !== 'Arzt') return;

        nightActions.doctorTarget = targetId;
        
        // SOFORT weiter, da Arzt gewählt hat
        if(gameTimer) clearTimeout(gameTimer);
        nextNightPhase(); 
    });

    socket.on('detectiveAction', (targetId) => {
        if (gamePhase !== 'NIGHT_DETECTIVE') return;
        if (nightActions.detectiveCheckDone) return; 

        const actor = players[Object.keys(players).find(id => players[id].socketId === socket.id)];
        if(!actor || !actor.isAlive || actor.role !== 'Detektiv') return;
        
        nightActions.detectiveCheckDone = true;

        const target = players[targetId];
        const isEvil = target ? target.role === 'Mafia' : false;
        
        socket.emit('detectiveResult', { name: target ? target.name : "?", isEvil });
        
        // Zeit geben das Ergebnis zu lesen (z.B. 4 Sekunden), dann weiter
        if(gameTimer) clearTimeout(gameTimer);
        gameTimer = setTimeout(() => nextNightPhase(), 4000);
    });

    socket.on('voteDay', ({ voterId, targetId }) => {
        dayVotes[voterId] = targetId;
        io.emit('voteUpdate', dayVotes);
        const livingVoters = Object.values(players).filter(p => p.isAlive && p.playerId !== 'host').length;
        if (Object.keys(dayVotes).length >= livingVoters) {
            evaluateVoting();
        }
    });

    socket.on('forcePhaseNext', () => {
        if(gameTimer) clearTimeout(gameTimer);
        
        if (gamePhase === 'DAY_ANNOUNCE' || gamePhase === 'DAY_DISCUSS') {
            startVotingPhase();
        } else if (gamePhase.startsWith('NIGHT')) {
            nextNightPhase();
        }
    });

    socket.on('resetGame', () => {
        if(gameTimer) clearTimeout(gameTimer);
        gamePhase = "LOBBY";
        nightActions = { mafiaVotes: {}, doctorTarget: null, detectiveTarget: null };
        dayVotes = {};
        readyPlayers = [];
        tieCandidates = [];
        
        Object.keys(players).forEach(pid => {
            players[pid].role = "Noch nicht verteilt";
            players[pid].isAlive = true; 
        });
        
        io.emit('gameReset', Object.values(players));
    });

    socket.on('kickAll', () => {
        if(gameTimer) clearTimeout(gameTimer);
        players = {}; 
        gamePhase = "LOBBY";
        io.emit('forceReload');
    });
});


function transitionToPhase(nextPhase, message, soundKey, delayMs) {
    gamePhase = "NIGHT_TRANSITION";
    
    io.emit('gameStateUpdate', { gamePhase });
    io.emit('nightAnnouncement', { 
        message: message, 
        sound: soundKey 
    });

    console.log(`Warte ${delayMs}ms vor Phase: ${nextPhase}`);

    // 3. Nach Wartezeit die echte Phase starten
    if(gameTimer) clearTimeout(gameTimer);
    gameTimer = setTimeout(() => {
        gamePhase = nextPhase;
        

        if (nextPhase === "DAY_ANNOUNCE") {
            startDay();
        } else {
            processPhaseStart(nextPhase);
        }
    }, delayMs);
}

function startNight() {
    if(gameTimer) clearTimeout(gameTimer);
    
    // Reset der Aktionen VOR der ersten Pause
    nightActions = { mafiaVotes: {}, doctorTarget: null, detectiveTarget: null, detectiveCheckDone: false };

    // 6 Sekunden warten, bevor Mafia aufwacht
    transitionToPhase(
        "NIGHT_MAFIA", 
        "Die Nacht bricht herein... Alle schlafen ein.", 
        "night_start_sound", 
        6000
    );
}

function nextNightPhase() {
    if(gameTimer) clearTimeout(gameTimer);

    // Hier entscheiden wir, wer als nächstes dran ist, schalten aber eine Pause dazwischen
    
    if(gamePhase === "NIGHT_MAFIA") {
        if(settings.hasDoctor) {
            // Pause zwischen Mafia und Arzt (z.B. 4 Sekunden)
            transitionToPhase("NIGHT_DOCTOR", "Die Mafia schläft ein...", "mafia_sleep_sound", 4000);
        }
        else if(settings.hasDetective) {
            transitionToPhase("NIGHT_DETECTIVE", "Die Mafia schläft ein...", "mafia_sleep_sound", 4000);
        }
        else { 
            // Direkt zum Tag (kurze Pause für Spannung)
            transitionToPhase("DAY_ANNOUNCE", "Die Sonne geht bald auf...", "morning_rooster", 4000);
        }
    } 
    else if (gamePhase === "NIGHT_DOCTOR") {
        if(settings.hasDetective) {
            transitionToPhase("NIGHT_DETECTIVE", "Der Arzt legt sich schlafen...", "doctor_sleep_sound", 4000);
        }
        else { 
            transitionToPhase("DAY_ANNOUNCE", "Der Arzt legt sich schlafen...", "doctor_sleep_sound", 4000);
        }
    } 
    else if (gamePhase === "NIGHT_DETECTIVE") {
        transitionToPhase("DAY_ANNOUNCE", "Der Detektiv ermittelt nicht mehr...", "detective_sleep_sound", 4000);
    }
}

function processPhaseStart(phase) {
    io.emit('gameStateUpdate', { gamePhase: phase });

    let wakeUpMsg = "";
    let wakeUpSound = "";

    if (phase === 'NIGHT_MAFIA') { wakeUpMsg = "Mafia erwache!"; wakeUpSound = "mafia_sleep"; }
    if (phase === 'NIGHT_DOCTOR') { wakeUpMsg = "Arzt erwache!"; wakeUpSound = "doctor_wake"; }
    if (phase === 'NIGHT_DETECTIVE') { wakeUpMsg = "Detektiv erwache!"; wakeUpSound = "detective_wake"; }

    io.emit('nightAnnouncement', { message: wakeUpMsg, sound: wakeUpSound });

    let activeRole = null;
    if(phase === 'NIGHT_MAFIA') activeRole = 'Mafia';
    if(phase === 'NIGHT_DOCTOR') activeRole = 'Arzt';
    if(phase === 'NIGHT_DETECTIVE') activeRole = 'Detektiv';

    if(!activeRole) return;

    const rolePlayers = Object.values(players).filter(p => p.role === activeRole);
    const anyAlive = rolePlayers.some(p => p.isAlive);

    if (anyAlive) {
        // Rolle lebt: Timeout 60s
        gameTimer = setTimeout(() => {
            nextNightPhase(); 
        }, 60000);
    } else {
        // Rolle tot: Zufällige Wartezeit simulieren (damit man nicht merkt, dass Rolle fehlt)
        const waitTime = Math.floor(Math.random() * 4000) + 6000; // 6-10 Sekunden
        console.log(`${phase}: Alle ${activeRole} tot. Simuliere Denkzeit ${waitTime}ms.`);
        
        gameTimer = setTimeout(() => {
            nextNightPhase();
        }, waitTime);
    }
}

function startDay() {
    gamePhase = "DAY_ANNOUNCE";
    
    let victimId = Object.values(nightActions.mafiaVotes)[0]; 
    
    let message = "Es war eine ruhige Nacht. Niemand ist gestorben.";

    // Auswertung Mafia Vote 
    const counts = {};
    Object.values(nightActions.mafiaVotes).forEach(v => counts[v] = (counts[v] || 0) + 1);
    let maxVotes = 0;
    let finalVictim = null;
    Object.keys(counts).forEach(id => {
        if(counts[id] > maxVotes) {
            maxVotes = counts[id];
            finalVictim = id;
        }
    });

    if (finalVictim) {
        if (finalVictim === nightActions.doctorTarget) {
            message = `Die Mafia hat angegriffen! Aber der Arzt war zur Stelle. Niemand stirbt.`;
        } else if (players[finalVictim]) {
            players[finalVictim].isAlive = false;
            message = `Guten Morgen... aber nicht für ${players[finalVictim].name}. Wurde in der Nacht ermordet!`;
        }
    }

    io.emit('gameStateUpdate', { gamePhase, players: Object.values(players) });
    io.emit('playSound', 'morning');
    io.emit('dayAnnouncement', {
        title: "🌅 Neuer Tag",
        text: message
    });
    
    checkWinCondition();

    if(gamePhase === "GAME_OVER") return;

    setTimeout(() => {
        gamePhase = "DAY_DISCUSS";
        io.emit('gameStateUpdate', { gamePhase });
        io.emit('announcement', `Diskussion startet!`);
        
        if(gameTimer) clearTimeout(gameTimer);
        gameTimer = setTimeout(() => {
            startVotingPhase();
        }, DISCUSSION_TIME_MS);
    }, 5000);
}

function startVotingPhase() {
    gamePhase = "DAY_VOTE";
    dayVotes = {}; 
    tieCandidates = []; 
    io.emit('gameStateUpdate', { gamePhase, tieCandidates }); 
    io.emit('voteUpdate', {});
    io.emit('announcement', "Die Diskussion ist vorbei! Stimmt ab, wen ihr hängen wollt.");
}

function evaluateVoting() {
    const counts = {};
    Object.values(dayVotes).forEach(t => counts[t] = (counts[t] || 0) + 1);
    
    let max = 0;
    Object.values(counts).forEach(c => { if(c > max) max = c; });
    
    const candidates = Object.keys(counts).filter(id => counts[id] === max);

    if (gamePhase === "DAY_VOTE") {
        if (candidates.length === 1) {
            executeHanging(candidates[0], max);
        } else if (candidates.length > 1) {
            tieCandidates = candidates;
            gamePhase = "DAY_TIEBREAKER";
            dayVotes = {}; 
            io.emit('gameStateUpdate', { gamePhase, tieCandidates });
            io.emit('voteUpdate', {});
            io.emit('announcement', `Gleichstand! Stichwahl zwischen ${candidates.length} Spielern.`);          
        } else {
            handleNoDeath("Niemand hat gewählt. Niemand stirbt.");
        }
    } 
    else if (gamePhase === "DAY_TIEBREAKER") {
        if (candidates.length === 1) {
            executeHanging(candidates[0], max);
        } else {
            handleNoDeath("Erneuter Gleichstand! Niemand stirbt heute.");
        }
    }
}

function executeHanging(victimId, votesCount) {
    if(!players[victimId]) return;
    players[victimId].isAlive = false;
    io.emit('announcement', `${players[victimId].name} wurde mit ${votesCount} Stimmen gehängt!`);
    io.emit('gameStateUpdate', { gamePhase: "DAY_ANNOUNCE", players: Object.values(players) });
    checkWinCondition();
    if(gamePhase !== "GAME_OVER") {
        setTimeout(() => prepareNextRound(), 5000);
    }
}

function handleNoDeath(message) {
    io.emit('announcement', message);
    setTimeout(() => prepareNextRound(), 4000);
}

function prepareNextRound() {
    readyPlayers = [];
    gamePhase = "READY_CHECK";
    io.emit('gameStateUpdate', { gamePhase });
}

function checkWinCondition() {
    const alive = Object.values(players).filter(p => p.isAlive && p.role !== 'Spectator');
    const mafia = alive.filter(p => p.role === "Mafia").length;
    const citizens = alive.length - mafia;

    if (mafia === 0 && alive.length > 0) { 
        gamePhase = "GAME_OVER";
        io.emit('announcement', "DORF GEWINNT! Alle Mafiosi sind tot.");
    } else if (mafia >= citizens && alive.length > 0) {
        gamePhase = "GAME_OVER";
        io.emit('announcement', "MAFIA GEWINNT! Überzahl erreicht.");
    }
    if(gamePhase === "GAME_OVER") {
        if(gameTimer) clearTimeout(gameTimer);
        io.emit('gameStateUpdate', { gamePhase });
    }
}

server.listen(5000, '0.0.0.0', () => console.log("Server läuft auf Port 5000"));