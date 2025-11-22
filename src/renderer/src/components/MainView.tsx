import { useEffect, useState } from 'react'
import { P2PManager, P2PMessage, FriendRequest } from '../services/P2PManager'

interface MainViewProps {
  username: string;
  onLogout: () => void;
}

interface Friend {
    username: string;
    peerId: string;
    status: 'pending_sent' | 'pending_received' | 'accepted';
}

export function MainView({ username, onLogout }: MainViewProps) {
  const [p2pManager, setP2pManager] = useState<P2PManager | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null)
  const [messages, setMessages] = useState<P2PMessage[]>([])
  const [connectionState, setConnectionState] = useState<string>('disconnected')
  const [inputText, setInputText] = useState('')
  
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [friendCodeInput, setFriendCodeInput] = useState('')
  const [myDetails, setMyDetails] = useState<any>(null)

  useEffect(() => {
    // 1. Load my identity details (to share friend code)
    const loadMyDetails = async () => {
        try {
            const res = await window.api.getMyDetails(username);
            if (res.success) {
                setMyDetails(res);
            }
        } catch (e) { console.error(e); }
    };
    loadMyDetails();

    // 2. Load Friends List from disk
    const loadFriends = async () => {
        try {
            const res = await window.api.getFriends(username);
            if (res.success) {
                setFriends(res.friends || []);
            }
        } catch (e) { console.error(e); }
    };
    loadFriends();
    
    // 3. Initialize P2P Manager
    const manager = new P2PManager(username);
    
    // Handle incoming friend request real-time notification
    manager.onFriendRequest = async (req: FriendRequest) => {
        // Auto-save to disk as pending
        await window.api.receiveFriendRequest({ 
            myUsername: username, 
            friendData: {
                username: req.from,
                peerId: req.payload.peerId,
                encryptionPublicKey: req.payload.encryptionPublicKey,
                signingPublicKey: req.payload.signingPublicKey
            }
        });
        // Reload list
        loadFriends();
    };

    manager.onFriendAccept = async (from: string) => {
        await window.api.acceptFriend({ myUsername: username, friendUsername: from });
        loadFriends();
    };

    manager.onConnectionStateChange = (state) => {
      setConnectionState(state);
    };

    manager.onMessageReceived = (msg) => {
      setMessages(prev => [...prev, msg]);
    };

    setP2pManager(manager);

    return () => {
      manager.disconnect();
    };
  }, [username]);


  const handleSendFriendRequest = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!friendCodeInput.trim() || !p2pManager || !myDetails) return;
      
      // Convention: Friend Code = "USERNAME" (Simple for now, strictly exact match required by server)
      const targetUsername = friendCodeInput.trim();
      
      if (targetUsername === username) {
          alert("Vous ne pouvez pas vous ajouter vous-même.");
          return;
      }

      // 1. Add to local pending list
      const friendData = {
          username: targetUsername,
          peerId: "unknown_yet", 
          encryptionPublicKey: "", 
          signingPublicKey: ""
      };
      
      await window.api.addFriend({ myUsername: username, friendData });
      
      // 2. Send Request via Signaling
      p2pManager.sendFriendRequest(targetUsername, {
          peerId: myDetails.peerId,
          encryptionPublicKey: myDetails.encryptionPublicKey,
          signingPublicKey: myDetails.signingPublicKey
      });
      
      setFriendCodeInput("");
      setShowAddFriend(false);
      
      // Reload friends
      const res = await window.api.getFriends(username);
      if (res.success) setFriends(res.friends || []);
  };

  const handleAcceptFriend = async (friend: Friend) => {
      if (!p2pManager || !myDetails) return;

      // 1. Update local status
      await window.api.acceptFriend({ myUsername: username, friendUsername: friend.username });
      
      // 2. Notify them via signaling
      p2pManager.acceptFriendRequest(friend.username);
      
      // Reload
      const res = await window.api.getFriends(username);
      if (res.success) setFriends(res.friends || []);
  };

  const handleSelectPeer = async (friend: Friend) => {
      if (!p2pManager) return;
      if (friend.status !== 'accepted') {
          alert("Attendez que cet ami accepte votre demande.");
          return;
      }
      
      if (friend.username === selectedPeer) return;

      setSelectedPeer(friend.username);
      setMessages([]); 
      setConnectionState('connecting');

      try {
          // Connect using the stored encryption key from the friend list
          await p2pManager.connectToPeer(friend.username, friend.encryptionPublicKey);
      } catch (e) {
          console.error(e);
          setConnectionState('failed');
      }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !p2pManager || connectionState !== 'connected') return;

    try {
        await p2pManager.sendMessage(inputText);
        
        const myMsg: P2PMessage = {
            id: Date.now().toString(),
            sender: username,
            text: inputText,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, myMsg]);
        setInputText('');
    } catch (err) {
        console.error("Send failed", err);
        alert("Erreur d'envoi: " + (err as Error).message);
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="w-72 bg-gray-800 p-4 flex flex-col border-r border-gray-700">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-purple-400 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            Shadowcord
          </h1>
          <div className="mt-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
              <p className="text-xs text-gray-400 mb-1">Votre Code Ami (Pseudo)</p>
              <div className="flex items-center justify-between">
                  <code className="font-mono text-sm text-purple-300">{username}</code>
                  <button className="text-xs text-gray-500 hover:text-white">Copier</button>
              </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
              <p className="text-gray-500 text-xs uppercase font-semibold tracking-wider">Amis ({friends.filter(f => f.status === 'accepted').length})</p>
              <button onClick={() => setShowAddFriend(!showAddFriend)} className="text-purple-400 hover:text-purple-300 text-xs font-bold">+ Ajouter</button>
          </div>

          {showAddFriend && (
              <form onSubmit={handleSendFriendRequest} className="mb-4">
                  <input
                    type="text"
                    value={friendCodeInput}
                    onChange={(e) => setFriendCodeInput(e.target.value)}
                    placeholder="Pseudo exact..."
                    className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white mb-2 focus:border-purple-500 focus:outline-none"
                  />
                  <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs py-1 rounded">Envoyer demande</button>
              </form>
          )}

          <div className="space-y-1">
            {friends.length === 0 && !showAddFriend && (
                <p className="text-gray-600 text-sm italic text-center py-4">Aucun ami pour l'instant.</p>
            )}
            
            {/* Pending Requests First */}
            {friends.filter(f => f.status === 'pending_received').map(f => (
                <div key={f.username} className="p-3 bg-gray-700/30 border border-purple-500/30 rounded mb-2">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm">{f.username}</span>
                        <span className="text-[10px] bg-purple-500 text-white px-1 rounded">Reçu</span>
                    </div>
                    <button onClick={() => handleAcceptFriend(f)} className="w-full bg-green-600 hover:bg-green-700 text-white text-xs py-1 rounded">Accepter</button>
                </div>
            ))}

            {friends.filter(f => f.status === 'pending_sent').map(f => (
                <div key={f.username} className="p-3 rounded flex items-center justify-between text-gray-400 bg-gray-700/20">
                    <span>{f.username}</span>
                    <span className="text-[10px] italic">En attente...</span>
                </div>
            ))}

            {/* Accepted Friends */}
            {friends.filter(f => f.status === 'accepted').map(friend => (
                <div 
                    key={friend.username}
                    onClick={() => handleSelectPeer(friend)}
                    className={`p-3 rounded cursor-pointer transition-colors flex items-center gap-3 ${selectedPeer === friend.username ? 'bg-purple-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}
                >
                    <div className={`w-2 h-2 rounded-full ${selectedPeer === friend.username && connectionState === 'connected' ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                    {friend.username}
                </div>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{username}</p>
              <p className="text-xs text-gray-500">En ligne</p>
            </div>
            <button 
              onClick={onLogout}
              className="text-gray-400 hover:text-red-400 transition-colors p-2 hover:bg-gray-700 rounded-full"
              title="Déconnexion"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-900">
        {selectedPeer ? (
            <>
                {/* Header */}
                <div className="h-16 border-b border-gray-800 flex items-center px-6 shadow-sm bg-gray-800/50 backdrop-blur">
                  <div className="flex flex-col">
                    <h2 className="font-bold text-gray-100 text-lg">@ {selectedPeer}</h2>
                    <div className="flex items-center gap-2 text-xs">
                        <span className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-green-500' : connectionState === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
                        <span className="text-gray-400 capitalize">{connectionState === 'connected' ? 'Connexion sécurisée E2EE' : connectionState}</span>
                    </div>
                  </div>
                </div>
                
                {/* Messages */}
                <div className="flex-1 p-6 overflow-y-auto space-y-4 flex flex-col">
                  {messages.length === 0 && (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-50">
                          <p>Début de la conversation chiffrée.</p>
                          <p className="text-sm">Seuls vous et {selectedPeer} pouvez lire ces messages.</p>
                      </div>
                  )}
                  
                  {messages.map(msg => {
                      const isMe = msg.sender === username;
                      return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isMe ? 'bg-purple-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-100 rounded-bl-none'}`}>
                                  <p>{msg.text}</p>
                                  <p className={`text-[10px] mt-1 ${isMe ? 'text-purple-200' : 'text-gray-400'} text-right`}>
                                      {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </p>
                              </div>
                          </div>
                      )
                  })}
                </div>

                {/* Input */}
                <div className="p-4 bg-gray-800/50 border-t border-gray-800">
                  <form onSubmit={handleSendMessage} className="relative flex gap-2">
                    <input 
                      type="text" 
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={`Envoyer un message chiffré à @${selectedPeer}...`}
                      className="flex-1 bg-gray-700/50 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-transparent focus:border-transparent transition-all placeholder-gray-500"
                      disabled={connectionState !== 'connected'}
                    />
                    <button 
                        type="submit"
                        disabled={connectionState !== 'connected' || !inputText.trim()}
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl px-6 font-medium transition-colors"
                    >
                        Envoyer
                    </button>
                  </form>
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 text-purple-500">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                    </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-300 mb-2">Aucun ami sélectionné</h3>
                <p className="max-w-xs text-center text-sm">Ajoutez un ami avec son pseudo exact, attendez qu'il accepte, puis cliquez sur son nom pour lancer un chat chiffré.</p>
            </div>
        )}
      </div>
    </div>
  )
}
