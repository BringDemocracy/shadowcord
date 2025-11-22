// ... imports (unchanged)
import { webcrypto } from 'crypto'

// Use standard Node.js WebCrypto API
const crypto = webcrypto as unknown as Crypto;

// Constants for encryption
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // AES-GCM recommended IV length
const KEY_ITERATIONS = 100000; // PBKDF2 iterations
const KEY_ALGO = 'AES-GCM';
const HASH_ALGO = 'SHA-256';

// ... Friend interface (unchanged)
export interface Friend {
    username: string;
    peerId: string;
    encryptionPublicKey: string; // Stored so we can contact them later
    signingPublicKey: string;
    status: 'pending_sent' | 'pending_received' | 'accepted';
    addedAt: number;
}

// ... EncryptedIdentity interface (unchanged)
export interface EncryptedIdentity {
  // ... existing fields
  encryptedSigningKey: string; 
  encryptedEncryptionKey: string;
  signingPublicKey: string;
  encryptionPublicKey: string;
  salt: string;
  iv: string;
  peerId: string;
  username: string;
  friends: Friend[];
}

// ... UnlockedIdentity (unchanged)
export interface UnlockedIdentity {
  signingKey: CryptoKeyPair;
  encryptionKey: CryptoKeyPair;
  username: string;
  peerId: string;
}

export class IdentityManager {
  // ... createIdentity (unchanged)
  static async createIdentity(username: string, password: string): Promise<EncryptedIdentity> {
    // ... (same implementation as before)
    // A. Generate Signing Key Pair (Ed25519)
    const signKeyPair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]) as CryptoKeyPair;
    // B. Generate Encryption Key Pair (ECDH P-384)
    const encKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-384" }, true, ["deriveKey", "deriveBits"]) as CryptoKeyPair;

    // Export Public Keys
    const signPubBytes = await crypto.subtle.exportKey("spki", signKeyPair.publicKey);
    const encPubBytes = await crypto.subtle.exportKey("spki", encKeyPair.publicKey);

    // Generate PeerID
    const peerIdHash = await crypto.subtle.digest("SHA-256", signPubBytes);
    const peerId = this.arrayBufferToBase64(peerIdHash).substring(0, 40);

    // C. Encrypt Private Keys
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const passwordKey = await this.deriveKeyFromPassword(password, salt);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    const signPrivBytes = await crypto.subtle.exportKey("pkcs8", signKeyPair.privateKey);
    const encPrivBytes = await crypto.subtle.exportKey("pkcs8", encKeyPair.privateKey);

    const encryptedSignPriv = await crypto.subtle.encrypt({ name: KEY_ALGO, iv }, passwordKey, signPrivBytes);
    const encryptedEncPriv = await crypto.subtle.encrypt({ name: KEY_ALGO, iv }, passwordKey, encPrivBytes);

    // D. Prepare Output
    return {
      encryptedSigningKey: this.arrayBufferToBase64(encryptedSignPriv),
      encryptedEncryptionKey: this.arrayBufferToBase64(encryptedEncPriv),
      signingPublicKey: this.arrayBufferToBase64(signPubBytes),
      encryptionPublicKey: this.arrayBufferToBase64(encPubBytes),
      salt: this.arrayBufferToBase64(salt),
      iv: this.arrayBufferToBase64(iv),
      peerId,
      username,
      friends: []
    };
  }

  // ... unlockIdentity (unchanged)
  static async unlockIdentity(encryptedIdentity: EncryptedIdentity, password: string): Promise<UnlockedIdentity> {
    // ... (same implementation as before)
    const salt = this.base64ToArrayBuffer(encryptedIdentity.salt);
    const iv = this.base64ToArrayBuffer(encryptedIdentity.iv);
    
    try {
      const passwordKey = await this.deriveKeyFromPassword(password, new Uint8Array(salt));
      
      const signPrivBytes = await crypto.subtle.decrypt({ name: KEY_ALGO, iv: new Uint8Array(iv) }, passwordKey, this.base64ToArrayBuffer(encryptedIdentity.encryptedSigningKey));
      const encPrivBytes = await crypto.subtle.decrypt({ name: KEY_ALGO, iv: new Uint8Array(iv) }, passwordKey, this.base64ToArrayBuffer(encryptedIdentity.encryptedEncryptionKey));

      const signingKey = await this.importKeyPair(signPrivBytes, this.base64ToArrayBuffer(encryptedIdentity.signingPublicKey), "Ed25519");
      const encryptionKey = await this.importKeyPair(encPrivBytes, this.base64ToArrayBuffer(encryptedIdentity.encryptionPublicKey), "ECDH");

      return {
        signingKey,
        encryptionKey,
        username: encryptedIdentity.username,
        peerId: encryptedIdentity.peerId
      };
    } catch (e) {
      console.error("Decryption failed:", e);
      throw new Error("Invalid password or corrupted data");
    }
  }

  // ... deriveSharedKey (unchanged)
  static async deriveSharedKey(localPrivateKey: CryptoKey, remotePublicKeyBase64: string): Promise<CryptoKey> {
    const remotePublicKey = await crypto.subtle.importKey(
      "spki",
      this.base64ToArrayBuffer(remotePublicKeyBase64),
      { name: "ECDH", namedCurve: "P-384" },
      false,
      []
    );

    return await crypto.subtle.deriveKey(
      { name: "ECDH", public: remotePublicKey },
      localPrivateKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  // ... encryptMessage (unchanged)
  static async encryptMessage(sharedKey: CryptoKey, message: string): Promise<{ ciphertext: string, iv: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(message);

    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedKey, encoded);

    return {
      ciphertext: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv)
    };
  }

  // ... decryptMessage (unchanged)
  static async decryptMessage(sharedKey: CryptoKey, ciphertext: string, iv: string): Promise<string> {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(this.base64ToArrayBuffer(iv)) },
      sharedKey,
      this.base64ToArrayBuffer(ciphertext)
    );

    return new TextDecoder().decode(decrypted);
  }

  // NEW: Friend Management Helpers
  // These methods modify the identity object (which must then be saved to disk by the caller)
  
  static addFriend(identity: EncryptedIdentity, friendData: { username: string, peerId: string, encryptionPublicKey: string, signingPublicKey: string }, isIncomingRequest: boolean = false): EncryptedIdentity {
      // Check if already exists
      const exists = identity.friends.find(f => f.username === friendData.username);
      if (exists) return identity; // Or throw error

      const newFriend: Friend = {
          username: friendData.username,
          peerId: friendData.peerId,
          encryptionPublicKey: friendData.encryptionPublicKey,
          signingPublicKey: friendData.signingPublicKey,
          status: isIncomingRequest ? 'pending_received' : 'pending_sent',
          addedAt: Date.now()
      };
      
      identity.friends.push(newFriend);
      return identity;
  }

  static acceptFriend(identity: EncryptedIdentity, friendUsername: string): EncryptedIdentity {
      const friendIndex = identity.friends.findIndex(f => f.username === friendUsername);
      if (friendIndex !== -1) {
          identity.friends[friendIndex].status = 'accepted';
      }
      return identity;
  }
  
  static removeFriend(identity: EncryptedIdentity, friendUsername: string): EncryptedIdentity {
      identity.friends = identity.friends.filter(f => f.username !== friendUsername);
      return identity;
  }


  // ... existing crypto helpers (deriveKeyFromPassword, importKeyPair, base64 conversions)
  private static async deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: KEY_ITERATIONS, hash: HASH_ALGO },
      keyMaterial,
      { name: KEY_ALGO, length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  private static async importKeyPair(privBytes: ArrayBuffer, pubBytes: ArrayBuffer, type: "Ed25519" | "ECDH"): Promise<CryptoKeyPair> {
    const algo = type === "Ed25519" ? "Ed25519" : { name: "ECDH", namedCurve: "P-384" };
    const privateKey = await crypto.subtle.importKey("pkcs8", privBytes, algo, true, type === "Ed25519" ? ["sign"] : ["deriveKey", "deriveBits"]);
    const publicKey = await crypto.subtle.importKey("spki", pubBytes, algo, true, type === "Ed25519" ? ["verify"] : []);
    return { privateKey, publicKey };
  }

  static arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) { binary += String.fromCharCode(bytes[i]); }
    return btoa(binary);
  }

  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary_string = atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) { bytes[i] = binary_string.charCodeAt(i); }
    return bytes.buffer;
  }
}
