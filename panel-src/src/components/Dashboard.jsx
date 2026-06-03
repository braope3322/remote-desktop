import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor, Search, LogOut, Wifi, WifiOff,
  Grid, List, RefreshCw, Settings, Users, Lock
} from 'lucide-react';
import { DeviceCard } from './DeviceCard';
import { LockScreenManager } from './LockScreenManager';
import { useWebSocket } from '../hooks/useWebSocket';
import { cn } from '../lib/utils';

export function Dashboard({ token, username, onLogout }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [showLockManager, setShowLockManager] = useState(false);

  const {
    connected,
    devices,
    disconnectClient,
    removeDevice,
  } = useWebSocket(token);

  const filteredDevices = devices.filter(device =>
    device.hostname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onlineCount = devices.filter(d => d.online).length;
  const offlineCount = devices.filter(d => !d.online).length;

  const handleConnect = (deviceId) => {
    const device = devices.find(d => d.id === deviceId);
    if (device) {
      // Open in new window
      const width = 1200;
      const height = 800;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;
      window.open(
        `/viewer?id=${device.id}&name=${encodeURIComponent(device.hostname)}`,
        `viewer_${device.id}`,
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
      );
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('rd_token');
    localStorage.removeItem('rd_user');
    onLogout();
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Navbar */}
      <nav className="h-16 glass border-b border-white/10 sticky top-0 z-40">
        <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-xl">
              <Monitor className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold text-white">Remote Desktop</span>

            {/* Connection status */}
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
              connected ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
            )}>
              {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {connected ? 'Conectado' : 'Desconectado'}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLockManager(true)}
              className="p-2 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-colors"
              title="Telas de Bloqueio"
            >
              <Lock className="w-5 h-5" />
            </button>
            <span className="text-white/50 text-sm">{username}</span>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-white/10 rounded-xl text-white/50 hover:text-white transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/50 text-sm">Total de Dispositivos</p>
                <p className="text-3xl font-semibold text-white mt-1">{devices.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-2xl p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/50 text-sm">Online</p>
                <p className="text-3xl font-semibold text-green-400 mt-1">{onlineCount}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center">
                <Wifi className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-2xl p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/50 text-sm">Offline</p>
                <p className="text-3xl font-semibold text-white/50 mt-1">{offlineCount}</p>
              </div>
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
                <WifiOff className="w-6 h-6 text-white/30" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Search and filters */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Buscar dispositivo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-11 max-w-md"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                viewMode === 'grid' ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
              )}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-lg transition-colors",
                viewMode === 'list' ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Devices grid */}
        {filteredDevices.length > 0 ? (
          <div className={cn(
            "grid gap-4",
            viewMode === 'grid'
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              : "grid-cols-1"
          )}>
            <AnimatePresence mode="popLayout">
              {filteredDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  viewMode={viewMode}
                  onConnect={handleConnect}
                  onRemove={removeDevice}
                  onDisconnect={disconnectClient}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-white/40"
          >
            <Monitor className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">Nenhum dispositivo encontrado</p>
            <p className="text-sm mt-1">Os dispositivos aparecerao aqui quando conectarem</p>
          </motion.div>
        )}
      </main>

      {/* Lock Screen Manager Modal */}
      <AnimatePresence>
        {showLockManager && (
          <LockScreenManager onClose={() => setShowLockManager(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
