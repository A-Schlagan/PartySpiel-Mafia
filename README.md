<div align="center"> 

<h1>Mafia - Real-Time Party Game</h1>

<p>
<strong>Die interaktive, webbasierte Version des klassischen Social-Deduction-Partyspiels.</strong>
</p>

<p>
<a href="<https://party-spiel-mafia.vercel.app>" target="_blank">
<img src="[https://img.shields.io/badge/🔴_Live_Demo-Mitspielen-success?style=for-the-badge](https://img.shields.io/badge/%F0%9F%94%B4_Live_Demo-Mitspielen-success?style=for-the-badge)" alt="Live Demo" />


</p>
<p><em>(Hinweis: Dies ist ein privates Spaß-Projekt für Spieleabende. Da das Backend auf einem kostenlosen Render-Tier läuft, dauert der erste Start wenige Sekunden.)</em></p>
</div>

<br />

## Sneak Peek

<div align="center"> 

<h3>💻Host-Dashboard (Desktop)</h3> folgt  </div>

<br>

<div align="center"> 

<h3> Spieler-Ansicht (Mobile)</h3> folgt </div>


---

## Über das Projekt

Dieses Projekt ist eine digitale Umsetzung des bekannten Gesellschaftsspiels "Mafia" (auch bekannt als Werwolf). Es wurde entwickelt, um Spieleabende zu digitalisieren - keine physischen Karten mehr und kein menschlicher Spielleiter nötig.

Einer der Spieler öffnet auf dem Laptop  die **Host-Ansicht** (mit QR-Code zum Beitreten und Live-Statistiken), Spieler nehmen über ihr **Smartphone** am Spiel teil. Der Server übernimmt vollautomatisch die Moderation, das Zeitmanagement und die Logik der Nacht-Aktionen.

### Kern-Features

* **Automatisierter Spielablauf:** Der Node-Server steuert die Phasenübergänge (Rollenvergabe, Nacht-Reihenfolge, Abstimmungen, Gleichstände, Game Over).
* **Zwei Interfaces:** Ein detailliertes "Master Control"-Dashboard für den Host (Desktop) und eine immersive, Dark-Theme optimierte UI für die Spieler (Mobile).
* **Robuste Verbindungen:** Automatischer Reconnect durch Speichern der User-IDs im `localStorage` – das Spiel geht auch bei versehentlichem Schließen des Browsers nahtlos weiter.
* **Hardware-Integration (Mobile-First):** - Nutzung der **Vibration API** für haptisches Feedback (z. B. wenn man stirbt).
  * Nutzung der **Screen Wake Lock API**, um das Handy-Display während der Runden aktiv zu halten.
  * Automatisches Fullscreen-Handling auf mobilen Endgeräten.
* **Komplexe Rollen-Interaktion:** Dynamische Auswertung der Nacht-Events (z.B. Wenn die "Lady" bei der Mafia schläft, der Arzt aber die Lady heilt, wer stirbt?).


---

## Tech-Stack

* **Frontend:** React.js, Vite
* **Backend:** Node.js, Express.js
* **Echtzeit-Kommunikation:** [Socket.io](http://Socket.io)
* **Styling:** Custom CSS (Neon-Glow, Dark-Mode, Animations)
* **Zusätzliche Tools:** `sweetalert2` (Custom Popups), `react-qr-code`.
* **Deployment:** Vercel (Frontend) / Render (Backend)



---

## Technische Highlights

* **Server-Side State Machine:** Das Backend fungiert als "Single Source of Truth". Alle Aktionen, Timeouts und Rollen-Entscheidungen werden serverseitig in einer komplexen State-Machine validiert, sodass Clients nicht betrügen (oder den Ablauf crashen) können.
* **Event-Driven UI-Updates:** Das Frontend reagiert dynamisch auf Server-Events (`gameStateUpdate`). Je nach Rolle (Bürger, Mafia, Detektiv etc.) und aktueller Spielphase (Nacht, Tag, Abstimmung) rendert React komplett unterschiedliche, gekapselte Komponenten (`NightPhase.jsx`, `DayPhase.jsx`).
* **Fehlertoleranz:** Integrierter "Emergency Skip"-Button für den Host und `uncaughtException`-Handler im Backend, um Deadlocks während eines Live-Spieleabends zu vermeiden.


---

## 