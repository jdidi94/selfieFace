'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type StorefrontPanel = 'bag' | 'favorites' | null;

type StorefrontPanelsValue = {
  panel: StorefrontPanel;
  openBag: () => void;
  openFavorites: () => void;
  closePanel: () => void;
};

const StorefrontPanelsContext = createContext<StorefrontPanelsValue | null>(null);

export function StorefrontPanelsProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<StorefrontPanel>(null);

  const openBag = useCallback(() => setPanel('bag'), []);
  const openFavorites = useCallback(() => setPanel('favorites'), []);
  const closePanel = useCallback(() => setPanel(null), []);

  const value = useMemo(
    () => ({ panel, openBag, openFavorites, closePanel }),
    [panel, openBag, openFavorites, closePanel],
  );

  return (
    <StorefrontPanelsContext.Provider value={value}>{children}</StorefrontPanelsContext.Provider>
  );
}

export function useStorefrontPanels() {
  const ctx = useContext(StorefrontPanelsContext);
  if (!ctx) throw new Error('useStorefrontPanels must be used within StorefrontPanelsProvider');
  return ctx;
}
