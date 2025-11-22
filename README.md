# Shadowcord

Shadowcord est une application de messagerie **P2P (Peer-to-Peer)** chiffrée de bout en bout (E2EE), conçue avec une philosophie **"Privacy-First"**.

- **Zéro Serveur** : Vos messages ne sont jamais stockés sur un serveur. Ils transitent directement entre vous et votre ami.
- **Zéro Connaissance** : Vos clés privées ne quittent jamais votre ordinateur.
- **Anonymat** : Pas de découverte publique. Vous n'existez que pour ceux à qui vous donnez votre code.

## 📥 Installation

### 🐧 Pour Debian / Ubuntu (Linux)

1.  Téléchargez le fichier `.deb` ou `.AppImage` depuis les "Releases".
2.  **Option 1 (AppImage - Recommandé)** :
    ```bash
    chmod +x Shadowcord-1.0.0.AppImage
    ./Shadowcord-1.0.0.AppImage
    ```
3.  **Option 2 (.deb)** :
    ```bash
    sudo dpkg -i shadowcord_1.0.0_amd64.deb
    shadowcord
    ```

### 🪟 Pour Windows

1.  Téléchargez le fichier `Shadowcord Setup 1.0.0.exe` depuis les "Releases".
2.  Double-cliquez pour installer.
3.  L'application se lancera automatiquement.

---

## 🛠️ Développement & Build

Si vous souhaitez compiler le projet vous-même :

### Prérequis
- Node.js (v18+)
- NPM

### Cloner & Installer
```bash
git clone https://github.com/BringDemocracy/shadowcord.git
cd shadowcord
npm install
```

### Lancer en mode Dev
```bash
# Terminal 1 : Lancer le serveur de signaling (obligatoire pour la connexion P2P)
node signaling-server.js

# Terminal 2 : Lancer l'application Electron
npm run dev
```

### Créer les exécutables (Build)
Utilisez le script automatique :
```bash
chmod +x build.sh
./build.sh
```
Les fichiers seront générés dans le dossier `dist/`.

---

## 🔒 Architecture de Sécurité

- **Chiffrement des clés** : AES-GCM 256-bit (dérivé par PBKDF2).
- **Signature** : Ed25519.
- **Échange de clés** : ECDH P-384.
- **Transport** : WebRTC (DTLS/SRTP) + Chiffrement AES-GCM supplémentaire sur le payload.

