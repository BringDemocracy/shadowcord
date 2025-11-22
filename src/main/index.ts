// ... imports
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IdentityManager, UnlockedIdentity } from './IdentityManager'

// ... Session Store
const sessionStore = new Map<string, UnlockedIdentity>();

// ... createWindow (unchanged)
function createWindow(): void {
  // ...
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (is.dev) {
      mainWindow.webContents.openDevTools()
    }
  })
  // ... rest of window setup
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // ... setup
  electronApp.setAppUserModelId('com.shadowcord')
  
  // ... browser window created event

  const userDataPath = app.getPath('userData');
  const identitiesDir = join(userDataPath, 'identities');

  // ... create-identity, unlock-identity, logout, list-identities (unchanged)
  
  // ---------------------------------------------------------
  // NEW: FRIEND MANAGEMENT IPC HANDLERS (Privacy-First Persistence)
  // ---------------------------------------------------------

  // 1. Add Friend (Send Request)
  // Stores pending friend in local JSON
  ipcMain.handle('add-friend', async (_, { myUsername, friendData }) => {
      try {
          const filePath = join(identitiesDir, `${myUsername}.json`);
          const content = await readFile(filePath, 'utf-8');
          let identity = JSON.parse(content);

          // Fix: Ensure we don't overwrite if already exists with a better status
          identity = IdentityManager.addFriend(identity, friendData, false); // false = outgoing (pending_sent)

          await writeFile(filePath, JSON.stringify(identity), 'utf-8');
          return { success: true, friends: identity.friends };
      } catch (error) {
          console.error("Failed to add friend:", error);
          return { success: false, error: (error as Error).message };
      }
  });

  // 2. Receive Friend Request (Incoming)
  ipcMain.handle('receive-friend-request', async (_, { myUsername, friendData }) => {
      try {
          const filePath = join(identitiesDir, `${myUsername}.json`);
          const content = await readFile(filePath, 'utf-8');
          let identity = JSON.parse(content);

          // Fix: Explicitly force 'pending_received' even if it existed as 'pending_sent' (race condition)
          // Remove existing entry to force clean add with new status
          identity.friends = identity.friends.filter((f: any) => f.username !== friendData.username);
          
          // Add as incoming
          identity = IdentityManager.addFriend(identity, friendData, true); // true = incoming (pending_received)

          await writeFile(filePath, JSON.stringify(identity), 'utf-8');
          return { success: true, friends: identity.friends };
      } catch (error) {
          console.error("Failed to receive friend request:", error);
          return { success: false, error: (error as Error).message };
      }
  });

  // 3. Accept Friend
  ipcMain.handle('accept-friend', async (_, { myUsername, friendUsername }) => {
      try {
          const filePath = join(identitiesDir, `${myUsername}.json`);
          const content = await readFile(filePath, 'utf-8');
          let identity = JSON.parse(content);

          identity = IdentityManager.acceptFriend(identity, friendUsername);

          await writeFile(filePath, JSON.stringify(identity), 'utf-8');
          return { success: true, friends: identity.friends };
      } catch (error) {
          console.error("Failed to accept friend:", error);
          return { success: false, error: (error as Error).message };
      }
  });

  // 4. Get Friend List (decrypted metadata only)
  ipcMain.handle('get-friends', async (_, myUsername) => {
      try {
          const filePath = join(identitiesDir, `${myUsername}.json`);
          const content = await readFile(filePath, 'utf-8');
          const identity = JSON.parse(content);
          return { success: true, friends: identity.friends || [] };
      } catch (error) {
          return { success: false, error: (error as Error).message };
      }
  });
  
  // 5. Get My Public Details (for sharing friend code)
  ipcMain.handle('get-my-details', async (_, username) => {
      try {
          const filePath = join(identitiesDir, `${username}.json`);
          const content = await readFile(filePath, 'utf-8');
          const identity = JSON.parse(content);
          return { 
              success: true, 
              username: identity.username,
              peerId: identity.peerId,
              encryptionPublicKey: identity.encryptionPublicKey,
              signingPublicKey: identity.signingPublicKey
          };
      } catch (error) {
          return { success: false, error: "User not found" };
      }
  });

  // ... create-identity implementation (restored)
  ipcMain.handle('create-identity', async (_, { username, password }) => {
    try {
        const identity = await IdentityManager.createIdentity(username, password);
        await mkdir(identitiesDir, { recursive: true });
        const filePath = join(identitiesDir, `${identity.username}.json`);
        await writeFile(filePath, JSON.stringify(identity), 'utf-8');
        return { success: true, identity: { username: identity.username, peerId: identity.peerId } };
    } catch (error) {
        console.error('Failed to create identity:', error);
        return { success: false, error: (error as Error).message };
    }
  });

  // ... unlock-identity implementation (restored)
  ipcMain.handle('unlock-identity', async (_, { username, password }) => {
    try {
      const filePath = join(identitiesDir, `${username}.json`);
      const content = await readFile(filePath, 'utf-8');
      const identity = JSON.parse(content);
      const unlockedIdentity = await IdentityManager.unlockIdentity(identity, password);
      sessionStore.set(username, unlockedIdentity);
      return { success: true, username: identity.username, peerId: identity.peerId };
    } catch (error) {
      console.error('Failed to unlock identity:', error);
      return { success: false, error: 'Mot de passe incorrect ou données corrompues' };
    }
  });
  
  // ... logout implementation (restored)
  ipcMain.handle('logout', async (_, username) => {
      if (sessionStore.has(username)) {
          sessionStore.delete(username);
          console.log(`[Security] Session cleared for user: ${username}`);
      }
      return { success: true };
  });
  
  // ... list-identities implementation (restored)
  ipcMain.handle('list-identities', async () => {
     try {
      await mkdir(identitiesDir, { recursive: true });
      const files = await import('fs').then(fs => fs.promises.readdir(identitiesDir));
      const identities = files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
      return { success: true, identities };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // ... encrypt-message (restored)
  ipcMain.handle('encrypt-message', async (_, { senderUsername, recipientPublicKey, message }) => {
      const userSession = sessionStore.get(senderUsername);
      if (!userSession) { return { success: false, error: "Session not found" }; }
      try {
          const sharedKey = await IdentityManager.deriveSharedKey(userSession.encryptionKey.privateKey, recipientPublicKey);
          const result = await IdentityManager.encryptMessage(sharedKey, message);
          return { success: true, ...result };
      } catch (error) { return { success: false, error: (error as Error).message }; }
  });

  // ... decrypt-message (restored)
  ipcMain.handle('decrypt-message', async (_, { recipientUsername, senderPublicKey, ciphertext, iv }) => {
    const userSession = sessionStore.get(recipientUsername);
    if (!userSession) { return { success: false, error: "Session not found" }; }
    try {
        const sharedKey = await IdentityManager.deriveSharedKey(userSession.encryptionKey.privateKey, senderPublicKey);
        const plainText = await IdentityManager.decryptMessage(sharedKey, ciphertext, iv);
        return { success: true, message: plainText };
    } catch (error) { return { success: false, error: "Failed to decrypt message." }; }
  });


  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
