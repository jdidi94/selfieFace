'use client';

import { BagDrawer } from '@/components/bag-drawer';
import { FavoritesDrawer } from '@/components/favorites-drawer';

/** Mounted at layout root so sheets portal above page chrome. */
export function StorefrontDrawers() {
  return (
    <>
      <BagDrawer />
      <FavoritesDrawer />
    </>
  );
}
