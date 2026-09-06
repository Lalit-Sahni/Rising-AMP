import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { pageFromPath, pathForPage } from '../navigation';
import Toaster from '../components/ui/Toaster';

const UIContext = createContext(null);

const TOAST_MS = { success: 3200, info: 3600, warning: 5000, error: 6000 };
const MAX_TOASTS = 3;

export function UIProvider({ children, jobId }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const nextToastId = useRef(1);
  const timers = useRef(new Map());

  const currentPage = pageFromPath(location.pathname);

  // Always pass the job you mean. The provider's jobId is whatever is
  // already open, so using it to open a *different* job would send you
  // back to the previous one.
  const setCurrentPage = useCallback(
    (page, forJobId) => {
      navigate(pathForPage(page, forJobId !== undefined ? forJobId : jobId));
    },
    [navigate, jobId],
  );

  const dismissToast = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    const text = String(message || '').trim();
    if (!text) return;
    const kind = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
    const id = nextToastId.current++;
    setToasts((current) => {
      // Same message twice in a row is one toast, not a stack of them.
      const withoutDuplicate = current.filter((toast) => toast.message !== text);
      return [...withoutDuplicate, { id, message: text, kind }].slice(-MAX_TOASTS);
    });
    const timer = setTimeout(() => dismissToast(id), TOAST_MS[kind]);
    timers.current.set(id, timer);
  }, [dismissToast]);

  const value = useMemo(
    () => ({
      currentPage,
      setCurrentPage,
      commandPaletteOpen,
      setCommandPaletteOpen,
      mobileMenuOpen,
      setMobileMenuOpen,
      showToast,
      dismissToast,
    }),
    [currentPage, setCurrentPage, commandPaletteOpen, mobileMenuOpen, showToast, dismissToast],
  );

  return (
    <UIContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismissToast} />
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within UIProvider');
  }
  return context;
}
