import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Plus, Trash2, Edit2, Eye, X, Save, Code } from 'lucide-react';
import { cn } from '../lib/utils';

export function LockScreenManager({ onClose }) {
  const [lockScreens, setLockScreens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editHtml, setEditHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchLockScreens();
  }, []);

  const fetchLockScreens = () => {
    fetch('/api/lockscreens')
      .then(res => res.json())
      .then(data => {
        setLockScreens(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setEditName('');
    setEditHtml(DEFAULT_TEMPLATE);
  };

  const handleEdit = (ls) => {
    setIsCreating(false);
    setEditingId(ls.id);
    setEditName(ls.name);
    setEditHtml(ls.html);
  };

  const handleSave = () => {
    if (!editName.trim() || !editHtml.trim()) return;

    if (isCreating) {
      fetch('/api/lockscreens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, html: editHtml })
      })
        .then(res => res.json())
        .then(() => {
          fetchLockScreens();
          setIsCreating(false);
          setEditName('');
          setEditHtml('');
        });
    } else {
      fetch(`/api/lockscreens/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, html: editHtml })
      })
        .then(res => res.json())
        .then(() => {
          fetchLockScreens();
          setEditingId(null);
          setEditName('');
          setEditHtml('');
        });
    }
  };

  const handleDelete = (id) => {
    if (!confirm('Tem certeza que deseja excluir esta tela de bloqueio?')) return;
    fetch(`/api/lockscreens/${id}`, { method: 'DELETE' })
      .then(() => fetchLockScreens());
  };

  const handlePreview = (html) => {
    setPreviewHtml(html);
    setShowPreview(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsCreating(false);
    setEditName('');
    setEditHtml('');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-4xl max-h-[90vh] bg-zinc-900 rounded-2xl border border-white/10 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <Lock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Telas de Bloqueio</h2>
              <p className="text-sm text-white/50">Gerencie templates HTML para bloquear a tela</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {(editingId || isCreating) ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-white/70 mb-2 block">Nome do Template</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-blue-500/50 outline-none"
                  placeholder="Ex: Suporte Tecnico"
                />
              </div>
              <div>
                <label className="text-sm text-white/70 mb-2 block flex items-center gap-2">
                  <Code className="w-4 h-4" /> Codigo HTML
                </label>
                <textarea
                  value={editHtml}
                  onChange={(e) => setEditHtml(e.target.value)}
                  className="w-full h-64 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-blue-500/50 outline-none font-mono text-sm resize-none"
                  placeholder="<html>...</html>"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePreview(editHtml)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg flex items-center gap-2 text-sm"
                >
                  <Eye className="w-4 h-4" /> Preview
                </button>
                <div className="flex-1" />
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 hover:bg-white/10 text-white/50 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 text-sm"
                >
                  <Save className="w-4 h-4" /> Salvar
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={handleCreate}
                className="w-full p-4 border-2 border-dashed border-white/10 hover:border-blue-500/50 rounded-xl text-white/50 hover:text-blue-400 flex items-center justify-center gap-2 mb-4 transition-colors"
              >
                <Plus className="w-5 h-5" /> Criar Nova Tela de Bloqueio
              </button>

              {loading ? (
                <div className="text-center py-8 text-white/40">Carregando...</div>
              ) : (
                <div className="grid gap-3">
                  <AnimatePresence>
                    {lockScreens.map(ls => (
                      <motion.div
                        key={ls.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-white/5 rounded-xl p-4 flex items-center gap-4 group"
                      >
                        <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center shrink-0">
                          <Lock className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-medium truncate">{ls.name}</h3>
                          <p className="text-white/40 text-xs font-mono truncate">{ls.id}</p>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handlePreview(ls.html)}
                            className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(ls)}
                            className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(ls.id)}
                            className="p-2 hover:bg-red-500/20 rounded-lg text-white/50 hover:text-red-400"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center"
            onClick={() => setShowPreview(false)}
          >
            <div className="relative w-[80vw] h-[80vh] border border-white/20 rounded-lg overflow-hidden">
              <iframe
                srcDoc={previewHtml}
                className="w-full h-full bg-black"
                title="Lock Screen Preview"
              />
              <button
                onClick={() => setShowPreview(false)}
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 rounded-lg text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%);
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Segoe UI', Arial, sans-serif;
  color: white;
  overflow: hidden;
}
.container { text-align: center; }
h1 { font-size: 48px; font-weight: 300; margin-bottom: 20px; }
p { font-size: 18px; color: rgba(255,255,255,0.6); }
.spinner {
  width: 50px; height: 50px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: #3b82f6;
  border-radius: 50%;
  margin: 30px auto;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="container">
  <h1>Titulo Aqui</h1>
  <div class="spinner"></div>
  <p>Mensagem de descricao aqui.</p>
</div>
</body>
</html>`;
