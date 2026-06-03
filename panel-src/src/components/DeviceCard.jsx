import { motion } from 'framer-motion';
import { Monitor, User, Clock, MoreVertical, Trash2, Power, ExternalLink, Globe } from 'lucide-react';
import { useState } from 'react';
import { cn, timeAgo } from '../lib/utils';

function countryToFlag(countryCode) {
  if (!countryCode || countryCode === 'XX' || countryCode === 'LOCAL') return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function DeviceCard({ device, viewMode = 'grid', onConnect, onRemove, onDisconnect }) {
  const [showMenu, setShowMenu] = useState(false);

  if (viewMode === 'list') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        transition={{ duration: 0.15 }}
        className={cn(
          "glass-card rounded-xl px-4 py-3 relative group cursor-pointer transition-all duration-200",
          device.online ? "hover:bg-white/[0.04]" : "opacity-60"
        )}
        onClick={() => device.online && onConnect(device.id)}
      >
        <div className="flex items-center gap-4">
          {/* Status + Flag */}
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0",
              device.online ? "bg-blue-500/10" : "bg-white/5"
            )}>
              {countryToFlag(device.country)}
            </div>
            <span className={cn(
              "w-2 h-2 rounded-full shrink-0",
              device.online ? "bg-green-500" : "bg-white/20"
            )} />
          </div>

          {/* Hostname + ID */}
          <div className="min-w-[180px] flex-shrink-0">
            <h3 className={cn(
              "font-medium text-sm leading-tight",
              device.online ? "text-white" : "text-white/50"
            )}>
              {device.hostname}
            </h3>
            <p className="text-white/30 text-xs font-mono">{device.id}</p>
          </div>

          {/* User */}
          <div className="hidden sm:flex items-center gap-1.5 min-w-[120px] text-white/50">
            <User className="w-3.5 h-3.5 text-white/30" />
            <span className="text-xs truncate">{device.username}</span>
          </div>

          {/* OS */}
          <div className="hidden md:flex items-center gap-1.5 min-w-[150px] text-white/50">
            <Monitor className="w-3.5 h-3.5 text-white/30" />
            <span className="text-xs truncate">{device.os}</span>
          </div>

          {/* IP */}
          <div className="hidden lg:flex items-center gap-1.5 min-w-[120px] text-white/40">
            <Globe className="w-3.5 h-3.5 text-white/30" />
            <span className="text-xs font-mono truncate">{device.ip || '—'}</span>
          </div>

          {/* Last seen */}
          <div className="hidden xl:flex items-center gap-1.5 min-w-[100px] text-white/40">
            <Clock className="w-3.5 h-3.5 text-white/30" />
            <span className="text-xs">{timeAgo(device.lastSeen)}</span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {device.online && (
              <button
                onClick={(e) => { e.stopPropagation(); onConnect(device.id); }}
                className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Conectar
              </button>
            )}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <MoreVertical className="w-4 h-4 text-white/50" />
              </button>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
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
        </div>
      </motion.div>
    );
  }

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

      {/* Device icon with flag */}
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-xl",
        device.online ? "bg-blue-500/10" : "bg-white/5"
      )}>
        {countryToFlag(device.country)}
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
