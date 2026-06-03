import { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ViewerWindow } from './components/ViewerWindow';

function App() {
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if this is a viewer window
  const isViewerWindow = window.location.pathname === '/viewer';

  useEffect(() => {
    const storedToken = localStorage.getItem('rd_token');
    const storedUser = localStorage.getItem('rd_user');

    if (storedToken) {
      fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: storedToken })
      })
        .then(res => res.json())
        .then(data => {
          if (data.valid) {
            setToken(storedToken);
            setUsername(data.username || storedUser);
          } else {
            localStorage.removeItem('rd_token');
            localStorage.removeItem('rd_user');
          }
        })
        .catch(() => {
          localStorage.removeItem('rd_token');
          localStorage.removeItem('rd_user');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (newToken, newUsername) => {
    setToken(newToken);
    setUsername(newUsername);
  };

  const handleLogout = () => {
    setToken(null);
    setUsername(null);
  };

  // Viewer window - render directly
  if (isViewerWindow) {
    return <ViewerWindow />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-white/50 text-sm">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return <Dashboard token={token} username={username} onLogout={handleLogout} />;
}

export default App;
