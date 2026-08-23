import React, { useRef, useEffect } from 'react';
import { PlusCircle, Scan, Download, Settings, Briefcase } from 'lucide-react';
import { useApp } from '../context/AppContext';

const commands = [
  { label: 'Jobs', icon: Briefcase, action: ctx => { ctx.setCurrentPage('jobs'); } },
  { label: 'Add new expense', icon: PlusCircle, action: ctx => { ctx.setCurrentPage('add-expense'); ctx.showToast('Quick add expense opened', 'info'); } },
  { label: 'Scan invoice', icon: Scan, action: ctx => ctx.showToast('Use the Scan Invoice button in the Add Expense page!', 'info') },
  { label: 'Export to Excel', icon: Download, action: ctx => ctx.showToast('Exporting data...', 'info') },
  { label: 'Profile', icon: Settings, action: ctx => { ctx.setCurrentPage('profile'); } },
];

export default function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, ...ctx } = useApp();
  const inputRef = useRef();

  useEffect(() => {
    if (commandPaletteOpen && inputRef.current) inputRef.current.focus();
    const handler = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(v => !v);
      }
      if (e.key === 'Escape' && commandPaletteOpen) setCommandPaletteOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  if (!commandPaletteOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-steel-900/40">
      <div className="w-full max-w-xl mx-auto rounded-ot border border-hairline bg-surface shadow-whisper">
        <input ref={inputRef} type="text" className="w-full px-6 py-4 bg-transparent border-b border-hairline text-ink text-lg outline-none placeholder-slate-400" placeholder="Type a command or search..." />
        <div className="max-h-80 overflow-y-auto">
          {commands.map((cmd, i) => (
            <button key={i} className="flex items-center gap-3 w-full px-6 py-3 text-left hover:bg-canvas transition-colors text-ink active:scale-[0.99]" onClick={() => { cmd.action(ctx); setCommandPaletteOpen(false); }}>
              <cmd.icon className="w-5 h-5 text-accent" />
              <span className="flex-1">{cmd.label}</span>
            </button>
          ))}
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fadeIn { animation: fadeIn 0.2s; }`}</style>
    </div>
  );
} 