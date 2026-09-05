import React, { Suspense, lazy, useEffect } from 'react';
import { useApp } from '../context/AppContext';

const CommandPalette = lazy(() => import('./CommandPalette'));

/**
 * Owns the Ctrl/Cmd+K shortcut and loads the search palette only when it is
 * opened, so the search code is not part of the first paint.
 */
export default function PaletteHost() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useApp();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen((open: boolean) => !open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCommandPaletteOpen]);

  if (!commandPaletteOpen) return null;
  return (
    <Suspense fallback={null}>
      <CommandPalette />
    </Suspense>
  );
}
