import { useState, useEffect } from 'react'

interface LoginProps {
  onSuccess: (username: string) => void;
  onSwitchToRegister: () => void;
}

export function Login({ onSuccess, onSwitchToRegister }: LoginProps) {
  const [identities, setIdentities] = useState<string[]>([])
  const [selectedUser, setSelectedUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadIdentities()
  }, [])

  const loadIdentities = async () => {
    if (!window.api) {
       console.error("API not available");
       return;
    }
    try {
      const result = await window.api.listIdentities()
      if (result.success && result.identities) {
        setIdentities(result.identities)
        if (result.identities.length > 0) {
          setSelectedUser(result.identities[0])
        }
      }
    } catch (err) {
      console.error("Failed to list identities", err)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!window.api) {
       setError("Erreur système: API non chargée. Redémarrez l'application.");
       return;
    }
    
    if (!selectedUser) {
      setError("Veuillez sélectionner un utilisateur.")
      return
    }

    try {
      setLoading(true)
      
      // Call Main process to unlock identity
      const result = await window.api.unlockIdentity({ username: selectedUser, password })
      
      if (result.success && result.username) {
        console.log("Identity unlocked successfully for", result.username)
        onSuccess(result.username)
      } else {
        setError(result.error || "Erreur inconnue")
      }
    } catch (err) {
      console.error(err)
      setError("Mot de passe incorrect ou erreur système.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700">
      <h2 className="text-3xl font-bold mb-6 text-center text-purple-400">Connexion</h2>
      
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Pseudo</label>
          {identities.length > 0 ? (
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500"
            >
              {identities.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          ) : (
            <div className="text-gray-500 italic p-2 border border-gray-700 rounded bg-gray-900">
              Aucun compte trouvé sur cet appareil.
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500"
            placeholder="••••••••"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading || identities.length === 0}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Déchiffrement...' : 'Se connecter'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <p className="text-gray-400 text-sm">
          Nouveau ici ?{' '}
          <button onClick={onSwitchToRegister} className="text-purple-400 hover:text-purple-300 font-medium">
            Créer un compte
          </button>
        </p>
      </div>
    </div>
  )
}
