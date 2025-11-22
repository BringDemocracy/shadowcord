interface Window {
  electron: {
    ipcRenderer: {
      send(channel: string, ...args: any[]): void
      on(channel: string, func: (...args: any[]) => void): void
      once(channel: string, func: (...args: any[]) => void): void
      invoke(channel: string, ...args: any[]): Promise<any>
    }
  }
  api: {
    createIdentity: (data: {username: string, password: string}) => Promise<{ success: boolean, error?: string }>
    unlockIdentity: (data: {username: string, password: string}) => Promise<{ success: boolean, username?: string, peerId?: string, error?: string }>
    listIdentities: () => Promise<{ success: boolean, identities?: string[], error?: string }>
    logout: (username: string) => Promise<{ success: boolean }>
    
    // Friend System
    addFriend: (data: { myUsername: string, friendData: any }) => Promise<{ success: boolean, friends?: any[], error?: string }>
    receiveFriendRequest: (data: { myUsername: string, friendData: any }) => Promise<{ success: boolean, friends?: any[], error?: string }>
    acceptFriend: (data: { myUsername: string, friendUsername: string }) => Promise<{ success: boolean, friends?: any[], error?: string }>
    getFriends: (username: string) => Promise<{ success: boolean, friends?: any[], error?: string }>
    getMyDetails: (username: string) => Promise<{ success: boolean, username?: string, peerId?: string, encryptionPublicKey?: string, signingPublicKey?: string, error?: string }>

    // E2EE
    encryptMessage: (data: {senderUsername: string, recipientPublicKey: string, message: string}) => Promise<{ success: boolean, ciphertext?: string, iv?: string, error?: string }>
    decryptMessage: (data: {recipientUsername: string, senderPublicKey: string, ciphertext: string, iv: string}) => Promise<{ success: boolean, message?: string, error?: string }>
  }
}
