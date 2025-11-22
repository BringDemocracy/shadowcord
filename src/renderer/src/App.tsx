import { useState } from 'react'
import { Register } from './components/Register'
import { Login } from './components/Login'
import { MainView } from './components/MainView'

type AppState = 'login' | 'register' | 'main';

function App(): JSX.Element {
  const [view, setView] = useState<AppState>('login')
  const [currentUser, setCurrentUser] = useState<string>('')

  const handleLoginSuccess = (username: string) => {
    setCurrentUser(username)
    setView('main')
  }

  const handleRegisterSuccess = () => {
    setView('login') 
  }

  const handleLogout = async () => {
    if (currentUser) {
      // Call Main Process to clear keys from memory
      if (window.api) {
        await window.api.logout(currentUser);
      }
    }
    setCurrentUser('')
    setView('login')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      {view === 'login' && (
        <Login 
          onSuccess={handleLoginSuccess} 
          onSwitchToRegister={() => setView('register')} 
        />
      )}
      
      {view === 'register' && (
        <Register 
          onSuccess={handleRegisterSuccess} 
          onSwitchToLogin={() => setView('login')} 
        />
      )}

      {view === 'main' && (
        <div className="w-full h-full">
           <MainView username={currentUser} onLogout={handleLogout} />
        </div>
      )}
    </div>
  )
}

export default App
