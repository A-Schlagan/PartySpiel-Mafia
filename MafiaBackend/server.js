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
        if(votes.length === mafiaPlayers.length && votes.every(v => v === votes[0])) setTimeout(() => nextNightPhase(), 10000);
    });

    socket.on('doctorAction', (targetId) => {
        nightActions.doctorTarget = targetId;
        setTimeout(() => nextNightPhase(), 10000);                                                           //SOUND UND TIME ANPASSEN
    });

    socket.on('detectiveAction', (targetId) => {
        if (nightActions.detectiveCheckDone) return; 
        
        nightActions.detectiveCheckDone = true;

        const target = players[targetId];
        const isEvil = target ? target.role === 'Mafia' : false;
        
        socket.emit('detectiveResult', { name: target ? target.name : "?", isEvil });
        setTimeout(() => nextNightPhase(), 10000);                                                  //SOUND UND TIME ANPASSEN
    });

    socket.on('voteDay', ({ voterId, targetId }) => {
        dayVotes[voterId] = targetId;
        const livingVoters = Object.values(players).filter(p => p.isAlive && p.playerId !== 'host').length;
        if (Object.keys(dayVotes).length >= livingVoters) {
            evaluateVoting();                                                       //VOTING ANPASSEN BEI GLEICHER ANZAHL STIMMEN
        }
    });

    socket.on('forcePhaseNext', () => {
        if (gamePhase === 'DAY_ANNOUNCE' || gamePhase === 'DAY_DISCUSS') {
            startVotingPhase();
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
            players[pid].isAlive = true; // WICHTIG: Alle wiederbeleben
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

function startNight() {
    if(gameTimer) clearTimeout(gameTimer);
    gamePhase = "NIGHT_MAFIA";
    nightActions = { mafiaVotes: {}, doctorTarget: null, detectiveTarget: null, detectiveCheckDone: false };
    io.emit('gameStateUpdate', { gamePhase });
}

function nextNightPhase() {
    if(gamePhase === "NIGHT_MAFIA") {
        if(settings.hasDoctor) gamePhase = "NIGHT_DOCTOR";
        else if(settings.hasDetective) gamePhase = "NIGHT_DETECTIVE";
        else { startDay(); return; }
    } else if (gamePhase === "NIGHT_DOCTOR") {
        if(settings.hasDetective) gamePhase = "NIGHT_DETECTIVE";
        else { startDay(); return; }
    } else if (gamePhase === "NIGHT_DETECTIVE") {
        startDay();
        return;
    }
    io.emit('gameStateUpdate', { gamePhase });
}

function startDay() {
    gamePhase = "DAY_ANNOUNCE";
    let victimId = Object.values(nightActions.mafiaVotes)[0];
    let message = "es war eine gute Nacht. Niemand ist gestorben.";

    if (victimId) {
        if (victimId === nightActions.doctorTarget) {
            message = `Die Mafia hat es versucht! Aber niemand stirbt.`;
        } else if (players[victimId]) {
            players[victimId].isAlive = false;
            message = `Guten Morgen... aber nicht für ${players[victimId].name}, ${players[victimId].name} wurde in der Nacht ermordet!`;
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
    io.emit('gameStateUpdate', { gamePhase });
    io.emit('announcement', "Die Diskussion ist vorbei! Stimmt ab, wen ihr hängen wollt.");
}

function evaluateVoting() {
    const counts = {};
    Object.values(dayVotes).forEach(t => counts[t] = (counts[t] || 0) + 1);
    let max = 0;
    Object.values(counts).forEach(c => { if(c > max) max = c; });
    const candidates = Object.keys(counts).filter(id => counts[id] === max);

    if (candidates.length === 1) {
        const victim = candidates[0];
        players[victim].isAlive = false;
        io.emit('announcement', `${players[victim].name} wurde mit ${max} Stimmen gehängt!`);
        io.emit('gameStateUpdate', { gamePhase: "DAY_ANNOUNCE", players: Object.values(players) });
        
        checkWinCondition();
        if(gamePhase !== "GAME_OVER") {
            setTimeout(() => {
                readyPlayers = [];
                gamePhase = "READY_CHECK";
                io.emit('gameStateUpdate', { gamePhase });
            }, 5000);
        }
    } else if (candidates.length > 1) {
        tieCandidates = candidates;
        gamePhase = "DAY_TIEBREAKER";
        dayVotes = {};
        io.emit('gameStateUpdate', { gamePhase, tieCandidates });
        io.emit('announcement', "Gleichstand! Stichwahl zwischen den Kandidaten.");
    } else {
        io.emit('announcement', "Niemand wurde gewählt. Die Nacht bricht herein.");
        setTimeout(() => {
            gamePhase = "READY_CHECK";
            io.emit('gameStateUpdate', { gamePhase });
        }, 4000);                                                                           // HIER MUSS GEPRÜFT WERDEN!!!!!
    }
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
        io.emit('announcement', "MAFIA GEWINNT!");
    }
    if(gamePhase === "GAME_OVER") {
        if(gameTimer) clearTimeout(gameTimer);
        io.emit('gameStateUpdate', { gamePhase });
    }
}

server.listen(5000, '0.0.0.0', () => console.log("Server läuft auf Port 5000"));