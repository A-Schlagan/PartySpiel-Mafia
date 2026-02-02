# Server starten:

PS D:\\PartySpiel-Mafia\\MafiaFrontend> npm run dev -- --host

PS D:\\PartySpiel-Mafia\\MafiaBackend> node server.js



# **BEI PROBLEMEN:** 


## Tunnel-Adresse prüfen:



1. Öffne VS Code.
2. Gehe unten auf den Reiter **"Ports"**.
3. Schau dir die Adressen bei Port **5000** und **5173** an.
4. **Vergleiche sie mit deiner** `src/App.jsx`.

* **Sind sie gleich?** -> Perfekt. Du musst **nichts** am Code ändern. Starte einfach Server und Frontend.
* **Haben sie sich geändert?** -> Du musst die neuen Adressen in `App.jsx` bei `SERVER_URL` und `CLIENT_URL` reinkopieren und speichern.

## "Öffentlich" prüfen

Manchmal setzt VS Code beim Netzwerkwechsel die Ports wieder auf "Privat".


1. Rechtsklick auf die Ports im Reiter "Ports".
2. Stelle sicher, dass **Port Visibility** (Port-Sichtbarkeit) bei beiden auf **Public** (Öffentlich) steht.


