const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const ip = require('ip');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- SPIEL ZUSTAND ---
let players = {}; 
let hostSocketId = null;
let gamePhase = "LOBBY"; // LOBBY, NIGHT, DAY, VOTING

// Speicher für Aktionen
let nightActions = {
    mafiaVote: null, // Wen will die Mafia töten?
    doctorTarget: null, // Wen schützt der Arzt?
};
let dayVotes = {}; // Wer stimmt gegen wen am Tag?

io.on('connection', (socket) => {
    console.log('Verbindung:', socket.id);

    // 1. LOGIN & RECONNECT
    socket.on('joinGame', ({ playerId, name }) => {
        if (players[playerId]) {
            // Reconnect
            players[playerId].socketId = socket.id;
            players[playerId].isOnline = true;
            socket.emit('recoverState', { ...players[playerId], gamePhase });
        } else {
            // Neuer Spieler
            players[playerId] = {
                playerId,
                socketId: socket.id,
                name,
                role: "Noch nicht verteilt",
                isAlive: true,
                isOnline: true
            };
        }
        updateHost();
    });

    socket.on('registerHost', () => {
        hostSocketId = socket.id;
        updateHost();
    });

    // 2. SPIEL STARTEN & ROLLEN VERTEILEN
    socket.on('startGame', () => {
        const playerIds = Object.keys(players);
        const count = playerIds.length;
        let roles = [];

        // Logik: Immer 1 Mafia (bei vielen Spielern 2), 1 Arzt, 1 Detektiv ab 5 Spielern
        const mafiaCount = count >= 7 ? 2 : 1;
        for(let i=0; i<mafiaCount; i++) roles.push("Mafia");
        
        if(count >= 3) roles.push("Arzt");
        if(count >= 5) roles.push("Detektiv");
        
        // Rest Bürger
        while(roles.length < count) roles.push("Bürger");

        // Mischen
        roles.sort(() => Math.random() - 0.5);

        playerIds.forEach((pid, index) => {
            players[pid].role = roles[index];
            players[pid].isAlive = true; // Reset für neues Spiel
            io.to(players[pid].socketId).emit('receiveRole', players[pid].role);
        });

        gamePhase = "DAY"; // Startet am Tag zum Kennenlernen
        updateHost();
        io.emit('gameStarted', Object.values(players));
    });

    // --- NACHT PHASE ---
    socket.on('startNight', () => {
        gamePhase = "NIGHT";
        nightActions = { mafiaVote: null, doctorTarget: null }; // Reset
        io.emit('phaseChange', "NIGHT");
    });

    socket.on('mafiaAction', (targetId) => {
        // Nur Mafia darf das
        const p = getPlayerBySocket(socket.id);
        if(p && p.role === 'Mafia') {
            nightActions.mafiaVote = targetId;
        }
    });

    socket.on('doctorAction', (targetId) => {
        const p = getPlayerBySocket(socket.id);
        if(p && p.role === 'Arzt') {
            nightActions.doctorTarget = targetId;
        }
    });

    socket.on('detectiveAction', (targetId) => {
        const p = getPlayerBySocket(socket.id);
        if(p && p.role === 'Detektiv') {
            const target = players[targetId];
            const isEvil = target.role === 'Mafia';
            socket.emit('detectiveResult', { name: target.name, isEvil });
        }
    });

    // --- MORGEN (AUSWERTUNG) ---
    socket.on('startDay', () => {
        gamePhase = "DAY";
        let message = "Niemand ist gestorben.";
        let victimId = nightActions.mafiaVote;

        // Wurde das Opfer geheilt?
        if (victimId && victimId === nightActions.doctorTarget) {
            message = `Die Mafia hat ${players[victimId].name} angegriffen, aber der Arzt hat ihn gerettet!`;
            victimId = null; 
        } else if (victimId) {
            if(players[victimId]) {
                players[victimId].isAlive = false;
                message = `In der Nacht wurde ${players[victimId].name} ermordet! 💀`;
            }
        }

        io.emit('phaseChange', "DAY");
        io.emit('dayResult', { players: Object.values(players), message });
        updateHost();
    });

    // --- VOTING (HÄNGEN) ---
    socket.on('startVoting', () => {
        gamePhase = "VOTING";
        dayVotes = {};
        io.emit('phaseChange', "VOTING");
    });

    socket.on('submitDayVote', (targetId) => {
        const p = getPlayerBySocket(socket.id);
        if(p && p.isAlive) {
            dayVotes[p.playerId] = targetId; // Ein Vote pro Spieler
        }
    });

    socket.on('endVoting', () => {
        // Stimmen auszählen
        let counts = {};
        Object.values(dayVotes).forEach(target => {
            counts[target] = (counts[target] || 0) + 1;
        });

        // Den mit den meisten Stimmen finden
        let maxVotes = 0;
        let candidate = null;
        
        for (const [pid, count] of Object.entries(counts)) {
            if (count > maxVotes) {
                maxVotes = count;
                candidate = pid;
            } else if (count === maxVotes) {
                candidate = null; // Unentschieden = Niemand stirbt (einfache Regel)
            }
        }

        let message = "Die Abstimmung war unentschieden. Niemand wird gehängt.";
        if (candidate && players[candidate]) {
            players[candidate].isAlive = false;
            message = `Das Dorf hat entschieden: ${players[candidate].name} wird gehängt! 💀`;
        }

        gamePhase = "DAY"; // Zurück zum Tag (oder direkt Nacht, Host entscheidet)
        io.emit('phaseChange', "DAY");
        io.emit('dayResult', { players: Object.values(players), message });
        updateHost();
    });

    socket.on('disconnect', () => {
        const p = getPlayerBySocket(socket.id);
        if(p) {
            p.isOnline = false;
            updateHost();
        }
    });
});

function getPlayerBySocket(socketId) {
    return Object.values(players).find(p => p.socketId === socketId);
}

function updateHost() {
    if (hostSocketId) io.to(hostSocketId).emit('updatePlayerList', Object.values(players));
}

const PORT = 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`SERVER LÄUFT AUF PORT ${PORT}`);
    console.log(`Lokale IP: http://${ip.address()}:${PORT}`);
});