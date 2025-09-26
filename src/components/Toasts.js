import React from 'react';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

export default function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toast-container fixed bottom-8 right-8 z-50 flex flex-col gap-3">
      {toasts.map(({ id, message, type }) => {
        const Icon = icons[type] || Info;
        return (
          <div key={id} className={`toast glass-card flex items-center gap-3 min-w-[280px] px-5 py-3 border-l-4 ${type === 'success' ? 'border-green-500' : type === 'error' ? 'border-red-500' : 'border-blue-500'} animate-slideIn`}> 
            <Icon className={`w-5 h-5 ${type === 'success' ? 'text-green-400' : type === 'error' ? 'text-red-400' : 'text-blue-400'}`} />
            <span className="flex-1 text-sm">{message}</span>
          </div>
        );
      })}
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slideIn { animation: slideIn 0.3s ease; }
      `}</style>
    </div>
  );
} 