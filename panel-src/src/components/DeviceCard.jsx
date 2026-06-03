import { motion } from 'framer-motion';
import { Monitor, User, Clock, Wifi, WifiOff, MoreVertical, Trash2, Power, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { cn, timeAgo } from '../lib/utils';

export function DeviceCard({ device, onConnect, onRemove, onDisconnect }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "glass-card rounded-2xl p-5 relative group cursor-pointer transition-all duration-200",
        device.online && "hover:shadow-lg hover:shadow-blue-500/5"
      )}
      onClick={() => device.online && onConnect(device.id)}
    >
      {/* Status indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {device.online ? (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            <span className="text-xs text-green-400 font-medium">Online</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white/20"></span>
            </span>
            <span className="text-xs text-white/40">Offline</span>
          </div>
        )}

        {/* Menu */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4 text-white/50" />
          </button>

          {showMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="absolute right-0 top-full mt-1 w-40 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50"
              onClick={(e) => e.stopPropagation()}
            >
              {device.online && (
                <button
                  onClick={() => { onDisconnect(device.id); setShowMenu(false); }}
                  className="w-full px-4 py-2.5 text-left text-sm text-white/70 hover:bg-white/5 flex items-center gap-2"
                >
                  <Power className="w-4 h-4" />
                  Desconectar
                </button>
              )}
              <button
                onClick={() => { onRemove(device.id); setShowMenu(false); }}
                className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Remover
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Device icon */}
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
        device.online ? "bg-blue-500/10" : "bg-white/5"
      )}>
        <Monitor className={cn(
          "w-6 h-6",
          device.online ? "text-blue-400" : "text-white/30"
        )} />
      </div>

      {/* Device info */}
      <div className="space-y-1 mb-4">
        <h3 className={cn(
          "font-medium text-lg",
          device.online ? "text-white" : "text-white/50"
        )}>
          {device.hostname}
        </h3>
        <p className="text-white/40 text-sm font-mono">{device.id}</p>
      </div>

      {/* Details */}
      <div className="space-y-2 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2 text-sm">
          <User className="w-3.5 h-3.5 text-white/30" />
          <span className="text-white/50">{device.username}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Monitor className="w-3.5 h-3.5 text-white/30" />
          <span className="text-white/50 truncate">{device.os}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-3.5 h-3.5 text-white/30" />
          <span className="text-white/50">{timeAgo(device.lastSeen)}</span>
        </div>
      </div>

      {/* Connect button */}
      {device.online && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4"
        >
          <button className="w-full btn-primary flex items-center justify-center gap-2 py-2.5">
            <ExternalLink className="w-4 h-4" />
            Conectar
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
