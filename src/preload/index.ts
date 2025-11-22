import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

console.log("PRELOAD SCRIPT STARTING...");

// Custom APIs for renderer
const api = {
  createIdentity: (data: any) => ipcRenderer.invoke('create-identity', data),
  unlockIdentity: (data: any) => ipcRenderer.invoke('unlock-identity', data),
  listIdentities: () => ipcRenderer.invoke('list-identities'),
  logout: (username: string) => ipcRenderer.invoke('logout', username),
  
  // Friend System
  addFriend: (data: any) => ipcRenderer.invoke('add-friend', data),
  receiveFriendRequest: (data: any) => ipcRenderer.invoke('receive-friend-request', data),
  acceptFriend: (data: any) => ipcRenderer.invoke('accept-friend', data),
  getFriends: (username: string) => ipcRenderer.invoke('get-friends', username),
  getMyDetails: (username: string) => ipcRenderer.invoke('get-my-details', username),
  
  // E2EE Methods
  encryptMessage: (data: any) => ipcRenderer.invoke('encrypt-message', data),
  decryptMessage: (data: any) => ipcRenderer.invoke('decrypt-message', data),
}

if (process.contextIsolated) {
  try {
    console.log("Exposing API via contextBridge");
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error("Failed to expose API:", error)
  }
} else {
  console.log("Exposing API via window object");
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
