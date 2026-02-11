// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const DISCUSSION_TIME_MS = 20000; 
const NIGHT_PHASE_TIME_MS = 30000;

app.use(cors());

let players = {};
let hostSocketId = null; 
let settings = { mafiaCount: 1, hasDoctor: true, hasDetective: true, hasLady: false };
let gamePhase = "LOBBY"; 
let nightActions = { mafiaVotes: {}, doctorTarget: null, detectiveTarget: null, ladyTarget: null, detectiveCheckDone: false }; 
let dayVotes = {};
let readyPlayers = []; 
let tieCandidates = []; 
let gameTimer = null;
let nextPhaseTarget = null;

function logToHost(message, type = 'info') {
    if (hostSocketId) {
        io.to(hostSocketId).emit('serverLog', { msg: message, type });
    }
}

io.on('connection', (socket) => {
    
    socket.on('joinGame', ({ playerId, name }) => {
        if (players[playerId]) {
            players[playerId].socketId = socket.id;
            players[playerId].isOnline = true;
            
        } else {
            players[playerId] = {
                playerId, socketId: socket.id, name, 
                role: "Spectator", isAlive: true, isOnline: true
            };
        }
        socket.emit('recoverState', { me: players[playerId], allPlayers: Object.values(players), gamePhase, settings, tieCandidates });
        io.emit('updatePlayerList', Object.values(players));
    });

    socket.on('registerHost', () => {
        hostSocketId = socket.id; 
        
        console.log("Host registriert mit ID:", hostSocketId); 
        socket.emit('recoverState', { 
            me: { role: 'Spectator', name: 'Spielleiter', playerId: 'host', isAlive: true }, 
            allPlayers: Object.values(players), 
            gamePhase, 
            settings, 
            tieCandidates 
        });
    });

    socket.on('setupGame', (newSettings) => {
        settings = newSettings;
        const pIds = Object.keys(players);
        
        let roles = Array(parseInt(settings.mafiaCount)).fill("Mafia");
        if(settings.hasDoctor) roles.push("Arzt");
        if(settings.hasDetective) roles.push("Detektiv");
        if(settings.hasLady) roles.push("Lady");                            
        while(roles.length < pIds.length) roles.push("Bürger");
        for (let i = roles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [roles[i], roles[j]] = [roles[j], roles[i]];
        } 

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

        if(hostSocketId) {
            io.to(hostSocketId).emit('hostActionUpdate', { 
                type: 'MAFIA_VOTE', 
                data: nightActions.mafiaVotes 
            });
        }
        
        const votes = Object.values(nightActions.mafiaVotes);
        if(votes.length === mafiaPlayers.length && votes.every(v => v === votes[0])) {
            if(gameTimer) clearTimeout(gameTimer);
            gameTimer = setTimeout(() => nextNightPhase(), 5000);
        }
    });

    socket.on('doctorAction', (targetId) => {
        if(gamePhase !== 'NIGHT_DOCTOR') return;
        const actor = players[Object.keys(players).find(id => players[id].socketId === socket.id)];
        if(!actor || !actor.isAlive || actor.role !== 'Arzt') return;

        nightActions.doctorTarget = targetId;

        if(hostSocketId) io.to(hostSocketId).emit('hostActionUpdate', { type: 'DOC_ACTION', target: targetId });
        if(gameTimer) clearTimeout(gameTimer);
        nextNightPhase(); 
    });

    socket.on('detectiveAction', (targetId) => {
        if (gamePhase !== 'NIGHT_DETECTIVE') return;
        if (nightActions.detectiveCheckDone) return; 

        const actor = players[Object.keys(players).find(id => players[id].socketId === socket.id)];
        if(!actor || !actor.isAlive || actor.role !== 'Detektiv') return;
        
        nightActions.detectiveCheckDone = true;

        if(hostSocketId) io.to(hostSocketId).emit('hostActionUpdate', { type: 'DET_ACTION', target: targetId });
        const target = players[targetId];
        const isEvil = target ? target.role === 'Mafia' : false;
        
        socket.emit('detectiveResult', { name: target ? target.name : "?", isEvil });

        if(target) {
        logToHost(`🕵️ Detektiv prüfte ${target.name}. Ergebnis: ${isEvil ? 'BÖSE (Mafia)' : 'GUT'}.`, 'info');
        }
        
        if(gameTimer) clearTimeout(gameTimer);
        gameTimer = setTimeout(() => nextNightPhase(), 8000);
    });

    socket.on('ladyAction', (targetId) => {
        if(gamePhase !== 'NIGHT_LADY') return;
        const actor = players[Object.keys(players).find(id => players[id].socketId === socket.id)];
        if(!actor || !actor.isAlive || actor.role !== 'Lady') return;

        nightActions.ladyTarget = targetId;

        if(hostSocketId) io.to(hostSocketId).emit('hostActionUpdate', { type: 'LADY_ACTION', target: targetId });
        
        if(gameTimer) clearTimeout(gameTimer);
        nextNightPhase(); 
    });

    socket.on('voteDay', ({ voterId, targetId }) => {
        dayVotes[voterId] = targetId;
        io.emit('voteUpdate', dayVotes);
        const livingVoters = Object.values(players).filter(p => p.isAlive && p.playerId !== 'host').length;
        if (Object.keys(dayVotes).length >= livingVoters) {
            if (gameTimer) clearTimeout(gameTimer);
            io.emit('announcement', "Alle haben gewählt! Ergebnis in 5 Sekunden...");
            gameTimer = setTimeout(() => {
                evaluateVoting();
            }, 7000);
        }
    });

    socket.on('forcePhaseNext', () => {
        if(gameTimer) clearTimeout(gameTimer);
    
        if (gamePhase === "NIGHT_TRANSITION" && nextPhaseTarget) {
            console.log("Überspringe Transition -> Gehe zu", nextPhaseTarget);
            gamePhase = nextPhaseTarget;
            nextPhaseTarget = null;
            
            if (gamePhase === "DAY_ANNOUNCE") {
                startDay();
            } else {
                processPhaseStart(gamePhase);
            }
        } 
        else if (gamePhase === 'DAY_ANNOUNCE' || gamePhase === 'DAY_DISCUSS') {
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
        io.emit('forceReload');

        players = {}; 
        gamePhase = "LOBBY";
        nightActions = { mafiaVotes: {}, doctorTarget: null, detectiveTarget: null, ladyTarget: null, detectiveCheckDone: false };
        dayVotes = {};
        readyPlayers = [];
        tieCandidates = [];

        io.emit('updatePlayerList', []);
        io.emit('gameReset', []); 

        setTimeout(() => {
            io.disconnectSockets();
        }, 500); 
    });   
});

function transitionToPhase(nextPhase, message, soundKey, delayMs) {
    gamePhase = "NIGHT_TRANSITION";
    nextPhaseTarget = nextPhase; 
    
    io.emit('gameStateUpdate', { gamePhase });
    io.emit('nightAnnouncement', { 
        message: message, 
        sound: soundKey 
    });

    console.log(`Warte ${delayMs}ms vor Phase: ${nextPhase}`);
    if(gameTimer) clearTimeout(gameTimer);
    
    gameTimer = setTimeout(() => {
        gamePhase = nextPhase;
        nextPhaseTarget = null; 
        
        if (nextPhase === "DAY_ANNOUNCE") {
            startDay();
        } else {
            processPhaseStart(nextPhase);
        }
    }, delayMs);
}

function startNight() {
    if(gameTimer) clearTimeout(gameTimer);
    
    nightActions = { mafiaVotes: {}, doctorTarget: null, detectiveTarget: null, ladyTarget: null, detectiveCheckDone: false };

    transitionToPhase(
        "NIGHT_MAFIA", 
        "",
        "night_start_sound", 
        15000
    );
}

function nextNightPhase() {
    if(gameTimer) clearTimeout(gameTimer);    
    if(gamePhase === "NIGHT_MAFIA") {
        if(settings.hasDoctor) {
            transitionToPhase("NIGHT_DOCTOR", "Die Mafia schläft ein...", "mafia_sleep_sound", 10000);
        }
        else if(settings.hasDetective) {
            transitionToPhase("NIGHT_DETECTIVE", "Die Mafia schläft ein...", "mafia_sleep_sound", 10000);
        }
        else if(settings.hasLady) {
            transitionToPhase("NIGHT_LADY", "Die Mafia schläft ein...", "mafia_sleep_sound", 10000);
        }
        else { 
            transitionToPhase("DAY_ANNOUNCE", "Die Mafia schläft ein...", "mafia_sleep_sound", 10000);
        }
    } 
    else if (gamePhase === "NIGHT_DOCTOR") {
        if(settings.hasDetective) {
            transitionToPhase("NIGHT_DETECTIVE", "Der Arzt schläft ein...", "doctor_sleep_sound", 10000);
        }
        else if(settings.hasLady) {
            transitionToPhase("NIGHT_LADY", "Der Arzt schläft ein...", "doctor_sleep_sound", 10000);
        }
        else { 
            transitionToPhase("DAY_ANNOUNCE", "Der Arzt schläft ein...", "doctor_sleep_sound", 10000);
        }
    } 
    else if (gamePhase === "NIGHT_DETECTIVE") {
        if(settings.hasLady) {
            transitionToPhase("NIGHT_LADY", "Der Detektiv schläft ein...", "detective_sleep_sound", 10000);
        } else {
            transitionToPhase("DAY_ANNOUNCE", "Der Detektiv schläft ein...", "detective_sleep_sound", 10000);
        }
    }
    else if (gamePhase === "NIGHT_LADY") {
        transitionToPhase("DAY_ANNOUNCE", "Die Lady geht schlafen...", "lady_sleep_sound", 10000);
    }
}    

function processPhaseStart(phase) {
    io.emit('gameStateUpdate', { gamePhase: phase, duration: NIGHT_PHASE_TIME_MS });

    let wakeUpMsg = "";
    let wakeUpSound = "";

    if (phase === 'NIGHT_MAFIA') { wakeUpMsg = "Mafia erwache!"; wakeUpSound = "mafia_wake"; }
    if (phase === 'NIGHT_DOCTOR') { wakeUpMsg = "Arzt erwache!"; wakeUpSound = "doctor_wake"; }
    if (phase === 'NIGHT_DETECTIVE') { wakeUpMsg = "Detektiv erwache!"; wakeUpSound = "detective_wake"; }
    if (phase === 'NIGHT_LADY') { wakeUpMsg = "Lady erwache!"; wakeUpSound = "lady_wake"; }  

    io.emit('nightAnnouncement', { message: wakeUpMsg, sound: wakeUpSound });

    let activeRole = null;
    if(phase === 'NIGHT_MAFIA') activeRole = 'Mafia';
    if(phase === 'NIGHT_DOCTOR') activeRole = 'Arzt';
    if(phase === 'NIGHT_DETECTIVE') activeRole = 'Detektiv';
    if(phase === 'NIGHT_LADY') activeRole = 'Lady';

    if(!activeRole) return;

    const rolePlayers = Object.values(players).filter(p => p.role === activeRole);
    const anyAlive = rolePlayers.some(p => p.isAlive);

    if (anyAlive) {
        gameTimer = setTimeout(() => {
            nextNightPhase(); 
        }, NIGHT_PHASE_TIME_MS);
    } else {
        // Rolle tot: Zufällige Wartezeit simulieren
        const waitTime = Math.floor(Math.random() * 4000) + 7000;
        console.log(`${phase}: Alle ${activeRole} tot. Simuliere Denkzeit ${waitTime}ms.`);
        
        gameTimer = setTimeout(() => {
            nextNightPhase();
        }, waitTime);
    }
}

function startDay() {
    gamePhase = "DAY_ANNOUNCE";
    
    const counts = {};
    Object.values(nightActions.mafiaVotes).forEach(v => counts[v] = (counts[v] || 0) + 1);
    let maxVotes = 0;
    Object.values(counts).forEach(c => { if(c > maxVotes) maxVotes = c; });

    const candidates = Object.keys(counts).filter(id => counts[id] === maxVotes);

    let mafiaTargetId = null;

    if (candidates.length === 1) {
        mafiaTargetId = candidates[0];
    } else if (candidates.length > 1) {
        logToHost(`🔪 MAFIA PATT: Uneinigkeit zwischen ${candidates.length} Zielen. Niemand wird angegriffen.`, 'warning');
        mafiaTargetId = null; 
    }

    let nightReport = "🌙 Nacht-Bericht:\n";
    if (mafiaTargetId) {
        nightReport += `- Mafia zielte auf: ${players[mafiaTargetId]?.name} (${players[mafiaTargetId]?.role})\n`;
    } else {
        nightReport += `- Mafia: Kein Ziel\n`;
    }

    if (settings.hasDoctor) {
        const docTarget = players[nightActions.doctorTarget];
        nightReport += `- Arzt: ${docTarget ? `Schützte ${docTarget.name}` : 'Untätig'}\n`;
    }

    let deadPlayers = [];
    let message = "Schüsse in der Nacht! Sind alle noch am Leben?";

    if (mafiaTargetId) {
        const mafiaVictim = players[mafiaTargetId];
        const ladyVictimId = nightActions.ladyTarget;
        const ladyPlayer = Object.values(players).find(p => p.role === 'Lady' && p.isAlive);
        const ladyId = ladyPlayer ? ladyPlayer.playerId : null;
        
        let targetSaved = false;

        if (ladyId && mafiaTargetId === ladyId) {
            
            if (nightActions.doctorTarget === ladyId) {
                targetSaved = true; 
                message = "Schüsse in der Nacht! Ist jemand gestorben?";
                nightReport += `🛡️ ERGEBNIS: Lady (${mafiaVictim.name}) wurde vom Arzt GEHEILT!\n`; 
            } 
            else {
                deadPlayers.push(ladyId);
                message = `Schüsse in der Nacht! Ist jemand gestorben?`;
                nightReport += `💀 ERGEBNIS: Lady (${mafiaVictim.name}) wurde ERMORDET.\n`;
                if (ladyVictimId && ladyVictimId !== ladyId && players[ladyVictimId] && players[ladyVictimId].isAlive) {
                    if (nightActions.doctorTarget === ladyVictimId) {
                        message += `Schüsse in der Nacht! Ist jemand gestorben?`;
                        nightReport += `🛡️ ERGEBNIS: Begleiter (${players[ladyVictimId].name}) wurde vom Arzt GEHEILT.\n`; 
                    } else {
                        deadPlayers.push(ladyVictimId);
                        message = `Schüsse in der Nacht! Ist jemand gestorben?`;
                        nightReport += `💀💀 ERGEBNIS: Begleiter (${players[ladyVictimId].name}) starb auch (Rolle: ${players[ladyVictimId].role}).\n`;
                    }
                }
            }
        } 
        else {
            if (nightActions.doctorTarget === mafiaTargetId) {
                targetSaved = true;
                message = "Schüsse in der Nacht! Ist jemand gestorben?";
                nightReport += `🛡️ ERGEBNIS: ${mafiaVictim.name} wurde vom Arzt GEHEILT.\n`; 
            } 
            else if (ladyVictimId === mafiaTargetId) {
                targetSaved = true;
                message = "Schüsse in der Nacht! Ist jemand gestorben?";
                nightReport += `💋 ERGEBNIS: ${mafiaVictim.name} überlebte durch Lady-Besuch.\n`; 
            }

            if (!targetSaved) {
                deadPlayers.push(mafiaTargetId);
                message = `Schüsse in der Nacht! Ist jemand gestorben?`;
                nightReport += `💀 ERGEBNIS: ${mafiaVictim.name} wurde ERMORDET. (Rolle: ${mafiaVictim.role})\n`; 
            }
        }
    }
    logToHost(nightReport, 'phase');

    deadPlayers.forEach(pid => {
        if(players[pid]) players[pid].isAlive = false;
    });

    io.emit('gameStateUpdate', { gamePhase, players: Object.values(players) });
    io.emit('playSound', 'morning');
    io.emit('dayAnnouncement', {
        title: "🔆 Neuer Tag",
        text: message
    });
    if(gameTimer) clearTimeout(gameTimer);
    gameTimer = setTimeout(() => {
        checkWinCondition();

        if(gamePhase === "GAME_OVER") {
            return;
        }
        const living = Object.values(players).filter(p => p.isAlive && p.playerId !== 'host' && p.role !== 'Spectator');
        let openerName = "Niemand";
        if (living.length > 0) {
            const randomIndex = Math.floor(Math.random() * living.length);
            openerName = living[randomIndex].name;
        }

        gamePhase = "DAY_DISCUSS";
        io.emit('gameStateUpdate', { gamePhase, discussionOpener: openerName });
        io.emit('announcement', `Diskussion startet! ${openerName} beginnt!`);
            
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
    io.emit('announcement', "Stimmt ab, wen ihr hängen wollt.");
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
            logToHost(`⚖️ GLEICHSTAND: Stichwahl zwischen ${candidates.length} Spielern (${max} Stimmen).`, 'warning');
            io.emit('gameStateUpdate', { gamePhase, tieCandidates });
            io.emit('voteUpdate', {});
            io.emit('announcement', `Gleichstand! Stichwahl zwischen ${candidates.length} Spielern.`);          
        } else {
            handleNoDeath("Niemand hat gewählt. Niemand stirbt.");
            logToHost("⚖️ KEINE STIMMEN: Niemand stirbt.", 'info');
        }
    } 
    else if (gamePhase === "DAY_TIEBREAKER") {
        if (candidates.length === 1) {
            executeHanging(candidates[0], max);
        } else {
            logToHost(`⚖️ STICHWAHL PATT: Erneut Gleichstand (${max} Stimmen). Niemand stirbt.`, 'info');
            handleNoDeath("Erneuter Gleichstand! Niemand stirbt heute.");
        }
    }
}

function executeHanging(victimId, votesCount) {
    if(!players[victimId]) return;

    const victim = players[victimId];
    logToHost(`⚖️ TAGES-ERGEBNIS: ${victim.name} wurde gehängt. War: ${victim.role.toUpperCase()}!`, 'alert');
    
    players[victimId].isAlive = false;
    io.emit('announcement', `${players[victimId].name} wurde mit ${votesCount} Stimmen gehängt!`);
    io.emit('gameStateUpdate', { gamePhase: "DAY_ANNOUNCE", players: Object.values(players) });

    if(gameTimer) clearTimeout(gameTimer);
    gameTimer = setTimeout(() => {
        checkWinCondition();
    
        if(gamePhase !== "GAME_OVER") {
            prepareNextRound(); 
        }
    }, 5000);
}

function handleNoDeath(message) {
    io.emit('dayAnnouncement', {
        title: "Kein Ergebnis",
        text: message
    });
    if(gameTimer) clearTimeout(gameTimer);
    gameTimer = setTimeout(() => {
        prepareNextRound();
    }, 5000);
}

function prepareNextRound() {
    readyPlayers = [];
    gamePhase = "READY_CHECK";
    io.emit('gameStateUpdate', { gamePhase });
}

function checkWinCondition() {
    const alive = Object.values(players).filter(p => p.isAlive && p.playerId !== 'host' && p.role !== 'Spectator');
    const mafia = alive.filter(p => p.role === "Mafia").length;
    const citizens = alive.length - mafia;

    let winner = null;
    let winMessage = "";

    if (mafia === 0 && alive.length > 0) { 
        gamePhase = "GAME_OVER";
        winner="VILLAGE";
        winMessage = "🏆 SPIEL BEENDET: Das DORF hat gewonnen!";
        io.emit('announcement', "DORF GEWINNT!  🥳  Mafia ist tot.");
    } else if (mafia >= citizens && alive.length > 0) {
        gamePhase = "GAME_OVER";
        winner = "MAFIA";
        winMessage = "🏆 SPIEL BEENDET: Die MAFIA hat gewonnen! 😈 (Überzahl erreicht)";
        io.emit('announcement', "MAFIA GEWINNT!  😈  Überzahl erreicht.");
    }
    if(gamePhase === "GAME_OVER") {
        if(gameTimer) clearTimeout(gameTimer);
        logToHost(winMessage, 'gamewin');
        const survivorNames = alive.map(p => `${p.name} (${p.role})`).join(', ');
        logToHost(`Überlebende: ${survivorNames}`, 'info');
        io.emit('gameStateUpdate', { gamePhase, winner });
        io.emit('playSound', 'game_over');
    }
}

server.listen(5000, '0.0.0.0', () => console.log("Server läuft auf Port 5000"));