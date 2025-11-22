import { useState } from 'react'

interface RegisterProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}

export function Register({ onSuccess, onSwitchToLogin }: RegisterProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!window.api) {
       setError("Erreur système: API non chargée. Redémarrez l'application.");
       return;
    }
    
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.")
      return
    }
    
    if (username.length < 3) {
      setError("Le pseudo doit contenir au moins 3 caractères.")
      return
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.")
      return
    }

    try {
      setLoading(true)
      // Call Main Process to create identity
      const result = await window.api.createIdentity({ username, password })
      
      if (result.success) {
        onSuccess()
      } else {
        setError("Erreur: " + result.error)
      }
    } catch (err) {
      console.error(err)
      setError("Une erreur est survenue lors de la création du compte.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700">
      <h2 className="text-3xl font-bold mb-6 text-center text-purple-400">Créer un compte</h2>
      
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Pseudo</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500"
            placeholder="ShadowUser"
            required
          />
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

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Confirmer le mot de passe</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-purple-500"
            placeholder="••••••••"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition duration-200 disabled:opacity-50"
        >
          {loading ? 'Génération des clés...' : 'S\'inscrire'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <p className="text-gray-400 text-sm">
          Déjà un compte ?{' '}
          <button onClick={onSwitchToLogin} className="text-purple-400 hover:text-purple-300 font-medium">
            Se connecter
          </button>
        </p>
      </div>
    </div>
  )
}
