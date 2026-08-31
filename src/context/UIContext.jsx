import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { pageFromPath, pathForPage } from '../navigation';
import logger from '../utils/logger';

const UIContext = createContext(null);

export function UIProvider({ children, jobId }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const showToast = useCallback((message, type = 'info') => {
    logger.info(`toast ${type}: ${message}`);
  }, []);

  const value = useMemo(
    () => ({
      currentPage,
      setCurrentPage,
      commandPaletteOpen,
      setCommandPaletteOpen,
      mobileMenuOpen,
      setMobileMenuOpen,
      showToast,
    }),
    [currentPage, setCurrentPage, commandPaletteOpen, mobileMenuOpen, showToast],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within UIProvider');
  }
  return context;
}
