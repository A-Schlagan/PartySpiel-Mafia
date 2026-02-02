//server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const ip = require('ip');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- STATE ---
let players = {}; 
let settings = { mafiaCount: 1, hasDoctor: true, hasDetective: true };
let gamePhase = "LOBBY"; // LOBBY, ROLE_REVEAL, READY_CHECK, NIGHT_MAFIA, NIGHT_DOCTOR, NIGHT_DETECTIVE, DAY_ANNOUNCE, DAY_DISCUSS, DAY_VOTE, DAY_TIEBREAKER, GAME_OVER
let nightActions = { mafiaVotes: {}, doctorTarget: null, detectiveTarget: null };
let dayVotes = {};
let readyPlayers = []; // Wer hat "Bereit" geklickt?
let tieCandidates = []; // Bei Unentschieden

io.on('connection', (socket) => {
    // --- 1. LOGIN ---
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

    // --- 2. SPIEL STARTEN (Einstellungen) ---
    socket.on('setupGame', (newSettings) => {
        settings = newSettings;
        const pIds = Object.keys(players);
        let roles = Array(settings.mafiaCount).fill("Mafia");
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

    // --- 3. BEREIT MELDEN ---
    socket.on('playerReady', (pid) => {
        if(!readyPlayers.includes(pid)) readyPlayers.push(pid);
        
        // Wenn alle bereit sind -> Start Nacht (oder Intro)
        const livingPlayers = Object.values(players).filter(p => p.isAlive).length;
        if(readyPlayers.length >= livingPlayers) {
            startNight();
        } else {
            io.emit('readyUpdate', readyPlayers.length);
        }
    });

    // --- 4. NACHT LOGIK ---
    socket.on('mafiaVote', ({ voterId, targetId }) => {
        if(gamePhase !== 'NIGHT_MAFIA') return;
        
        nightActions.mafiaVotes[voterId] = targetId;
        
        // Update an alle Mafias senden (damit sie sehen, wer was wählt)
        const mafiaPlayers = Object.values(players).filter(p => p.role === 'Mafia' && p.isAlive);
        mafiaPlayers.forEach(p => {
            io.to(p.socketId).emit('mafiaVoteUpdate', nightActions.mafiaVotes);
        });

        // Check Consensus: Haben alle Mafias gewählt UND ist es dieselbe Person?
        const votes = Object.values(nightActions.mafiaVotes);
        if(votes.length === mafiaPlayers.length) {
            const firstVote = votes[0];
            const allAgree = votes.every(v => v === firstVote);
            
            if(allAgree) {
                // Mafia fertig -> Nächste Phase
                setTimeout(() => nextNightPhase(), 1000); // Kleine Pause
            }
        }
    });

    socket.on('doctorAction', (targetId) => {
        nightActions.doctorTarget = targetId;
        nextNightPhase();
    });

    socket.on('detectiveAction', (targetId) => {
        const target = players[targetId];
        const isEvil = target.role === 'Mafia';
        socket.emit('detectiveResult', { name: target.name, isEvil });
        setTimeout(() => nextNightPhase(), 2000); // Zeit zum Lesen lassen
    });

    // --- 5. TAG LOGIK ---
    socket.on('voteDay', ({ voterId, targetId }) => {
        dayVotes[voterId] = targetId;
    });

    // Host (oder Timer) beendet Diskussion -> Voting
    socket.on('startVoting', () => {
        gamePhase = "DAY_VOTE";
        dayVotes = {};
        io.emit('gameStateUpdate', { gamePhase });
    });

    socket.on('evaluateDayVote', () => {
        evaluateVoting();
    });
    
    // --- SPIEL RESET (NEUSTART) ---
    socket.on('resetGame', () => {
        console.log("Spiel wurde resettet!");
        gamePhase = "LOBBY";
        nightActions = { mafiaVotes: {}, doctorTarget: null, detectiveTarget: null };
        dayVotes = {};
        readyPlayers = [];
        tieCandidates = [];

        // Alle Spielerstatus zurücksetzen (aber Verbindung halten)
        Object.keys(players).forEach(pid => {
            players[pid].role = "Noch nicht verteilt";
            players[pid].isAlive = true;
        });

        // Alle Clients informieren
        io.emit('gameReset', Object.values(players));
    });
});

// --- HILFSFUNKTIONEN FÜR PHASENÜBERGÄNGE ---

function startNight() {
    gamePhase = "NIGHT_MAFIA";
    nightActions = { mafiaVotes: {}, doctorTarget: null, detectiveTarget: null };
    io.emit('gameStateUpdate', { gamePhase });
}

function nextNightPhase() {
    if(gamePhase === "NIGHT_MAFIA") {
        if(settings.hasDoctor) {
            gamePhase = "NIGHT_DOCTOR";
        } else if(settings.hasDetective) {
            gamePhase = "NIGHT_DETECTIVE";
        } else {
            startDay();
            return;
        }
    } else if (gamePhase === "NIGHT_DOCTOR") {
        if(settings.hasDetective) {
            gamePhase = "NIGHT_DETECTIVE";
        } else {
            startDay();
            return;
        }
    } else if (gamePhase === "NIGHT_DETECTIVE") {
        startDay();
        return;
    }
    io.emit('gameStateUpdate', { gamePhase });
}

function startDay() {
    gamePhase = "DAY_ANNOUNCE";
    
    // Auswertung
    let victimId = Object.values(nightActions.mafiaVotes)[0]; // Da alle einig waren
    let message = "Stille Nacht. Niemand ist gestorben.";
    let died = false;

    if (victimId) {
        if (victimId === nightActions.doctorTarget) {
            message = `Die Mafia hat zugeschlagen, aber der Arzt war zur Stelle! Niemand stirbt.`;
        } else {
            players[victimId].isAlive = false;
            message = `Der Morgen graut... ${players[victimId].name} wurde ermordet!`;
            died = true;
        }
    }

    io.emit('gameStateUpdate', { gamePhase, players: Object.values(players) });
    io.emit('playSound', 'morning'); // Frontend spielt Sound
    io.emit('announcement', message);

    checkWinCondition();
}

function evaluateVoting() {
    const counts = {};
    Object.values(dayVotes).forEach(t => counts[t] = (counts[t] || 0) + 1);

    // Max Stimmen finden
    let max = 0;
    Object.values(counts).forEach(c => { if(c > max) max = c; });

    const candidates = Object.keys(counts).filter(id => counts[id] === max);

    if (candidates.length === 1) {
        // Einer fliegt
        const victim = candidates[0];
        players[victim].isAlive = false;
        io.emit('announcement', `${players[victim].name} wurde vom Dorf gehängt!`);
        io.emit('gameStateUpdate', { gamePhase: "DAY_ANNOUNCE", players: Object.values(players) });
        
        checkWinCondition();
        if(gamePhase !== "GAME_OVER") {
            setTimeout(() => {
                readyPlayers = []; // Reset für Nacht-Bestätigung
                gamePhase = "READY_CHECK";
                io.emit('gameStateUpdate', { gamePhase });
            }, 5000);
        }
    } else if (candidates.length > 1) {
        // Unentschieden -> Stichwahl
        tieCandidates = candidates;
        gamePhase = "DAY_TIEBREAKER";
        dayVotes = {}; // Reset Votes
        io.emit('gameStateUpdate', { gamePhase, tieCandidates });
    } else {
        // Niemand gewählt? Nichts passiert.
        io.emit('announcement', "Niemand wurde gewählt.");
        setTimeout(() => {
            gamePhase = "READY_CHECK";
            io.emit('gameStateUpdate', { gamePhase });
        }, 3000);
    }
}

function checkWinCondition() {
    const alive = Object.values(players).filter(p => p.isAlive);
    const mafia = alive.filter(p => p.role === "Mafia").length;
    const citizens = alive.length - mafia;

    if (mafia === 0) {
        gamePhase = "GAME_OVER";
        io.emit('announcement', "DORF GEWINNT! Alle Mafiosi sind tot.");
        io.emit('gameStateUpdate', { gamePhase });
    } else if (mafia >= citizens) {
        gamePhase = "GAME_OVER";
        io.emit('announcement', "MAFIA GEWINNT! Sie haben die Überhand.");
        io.emit('gameStateUpdate', { gamePhase });
    }
}

// Server starten
server.listen(5000, '0.0.0.0', () => console.log("Server läuft 5000"));