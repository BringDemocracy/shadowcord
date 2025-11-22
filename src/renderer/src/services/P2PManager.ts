import { io, Socket } from "socket.io-client";

// Types for our P2P events
export interface P2PMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

export interface FriendRequest {
    from: string;
    payload: {
        peerId: string;
        encryptionPublicKey: string;
        signingPublicKey: string;
    };
}

export class P2PManager {
  private socket: Socket;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private username: string;
  private currentPeer: string | null = null;
  private remotePublicKey: string | null = null; // Needed for encryption

  // Callbacks for UI
  public onMessageReceived: ((msg: P2PMessage) => void) | null = null;
  public onConnectionStateChange: ((state: string) => void) | null = null;
  public onIncomingCall: ((caller: string) => void) | null = null;
  
  // NEW: Friend System Callbacks
  public onFriendRequest: ((req: FriendRequest) => void) | null = null;
  public onFriendAccept: ((from: string) => void) | null = null;

  constructor(username: string, signalingUrl: string = "http://localhost:3000") {
    this.username = username;
    this.socket = io(signalingUrl);

    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    this.socket.on("connect", () => {
      console.log("Connected to signaling server");
      this.socket.emit("join", this.username);
    });

    // REMOVED: "users_list" listener (Privacy First)

    // Handle Incoming Friend Request
    this.socket.on("friend_request", async ({ from, payload }) => {
        console.log(`Friend request from ${from}`);
        if (this.onFriendRequest) {
            this.onFriendRequest({ from, payload });
        }
    });

    // Handle Friend Acceptance
    this.socket.on("friend_accept", async ({ from, payload }) => {
        console.log(`Friend accepted by ${from}`);
        if (this.onFriendAccept) {
            this.onFriendAccept(from);
        }
    });

    // Handle Incoming Offer (WebRTC)
    // Only accepts offers if we recognize the friend (logic handled by MainView usually via P2PManager methods, 
    // but here we just route it. In a stricter version, we would check if 'sender' is in friend list first.)
    this.socket.on("offer", async ({ sender, offer, senderPublicKey }) => {
      console.log(`Incoming connection from ${sender}`);
      this.remotePublicKey = senderPublicKey;
      this.currentPeer = sender;
      
      await this.handleOffer(sender, offer);
    });

    this.socket.on("answer", async ({ sender, answer }) => {
      console.log(`Received answer from ${sender}`);
      if (this.peerConnection) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    this.socket.on("ice-candidate", async ({ sender, candidate }) => {
      if (this.peerConnection) {
        try {
          await this.peerConnection.addIceCandidate(candidate);
        } catch (e) {
          console.error("Error adding received ice candidate", e);
        }
      }
    });
  }

  // --- Friend System Methods ---

  public sendFriendRequest(targetUsername: string, myDetails: any) {
      this.socket.emit("friend_request", {
          to: targetUsername,
          from: this.username,
          payload: myDetails
      });
  }

  public acceptFriendRequest(targetUsername: string) {
      this.socket.emit("friend_accept", {
          to: targetUsername,
          from: this.username,
          payload: {} // Can send ack payload if needed
      });
  }

  // --- Connection Logic ---

  // 1. Start a call
  public async connectToPeer(targetUsername: string, myEncryptionPublicKey: string) {
    this.currentPeer = targetUsername;
    this.createPeerConnection(targetUsername);

    // Create Data Channel (we are the caller)
    this.dataChannel = this.peerConnection!.createDataChannel("secure-chat");
    this.setupDataChannel();

    // Create Offer
    const offer = await this.peerConnection!.createOffer();
    await this.peerConnection!.setLocalDescription(offer);

    // Send Offer via Signaling
    this.socket.emit("offer", {
      target: targetUsername,
      offer,
      senderPublicKey: myEncryptionPublicKey // Exchange keys during handshake
    });
  }

  // 2. Handle Incoming Call
  private async handleOffer(caller: string, offer: RTCSessionDescriptionInit) {
    this.createPeerConnection(caller);
    
    await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));

    // Create Answer
    const answer = await this.peerConnection!.createAnswer();
    await this.peerConnection!.setLocalDescription(answer);

    // Send Answer
    this.socket.emit("answer", {
      target: caller,
      answer
    });
  }

  private createPeerConnection(peerName: string) {
    if (this.peerConnection) this.peerConnection.close();

    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" } // Public STUN server
      ]
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("ice-candidate", {
          target: peerName,
          candidate: event.candidate
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(this.peerConnection?.connectionState || "closed");
      }
    };

    // If we are the receiver, the data channel is created by the caller
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log("Data Channel OPEN");
      if (this.onConnectionStateChange) this.onConnectionStateChange("connected");
    };

    this.dataChannel.onmessage = async (event) => {
      // 1. Receive Encrypted Message
      try {
        const payload = JSON.parse(event.data);
        // payload should be { ciphertext, iv }
        
        if (!this.remotePublicKey || !this.currentPeer) {
          console.error("Cannot decrypt: missing remote public key or peer name");
          return;
        }

        // 2. Decrypt using Main Process (via api)
        const result = await window.api.decryptMessage({
          recipientUsername: this.username, // Me
          senderPublicKey: this.remotePublicKey,
          ciphertext: payload.ciphertext,
          iv: payload.iv
        });

        if (result.success && result.message) {
             const msgObj: P2PMessage = {
                 id: Date.now().toString(),
                 sender: this.currentPeer,
                 text: result.message,
                 timestamp: Date.now()
             };
             if (this.onMessageReceived) this.onMessageReceived(msgObj);
        } else {
            console.error("Decryption error:", result.error);
        }

      } catch (e) {
        console.error("Failed to parse or decrypt message:", e);
      }
    };
  }

  // --- Messaging ---

  public async sendMessage(text: string) {
    if (!this.dataChannel || this.dataChannel.readyState !== "open") {
      throw new Error("Connection not open");
    }
    if (!this.remotePublicKey) {
      throw new Error("Missing remote public key for encryption");
    }

    // 1. Encrypt using Main Process
    const result = await window.api.encryptMessage({
      senderUsername: this.username,
      recipientPublicKey: this.remotePublicKey,
      message: text
    });

    if (!result.success || !result.ciphertext || !result.iv) {
      throw new Error("Encryption failed: " + result.error);
    }

    // 2. Send Ciphertext + IV
    const payload = JSON.stringify({
      ciphertext: result.ciphertext,
      iv: result.iv
    });

    this.dataChannel.send(payload);
  }

  public disconnect() {
    if (this.peerConnection) this.peerConnection.close();
    if (this.socket) this.socket.disconnect();
  }
}
