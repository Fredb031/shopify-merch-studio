'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type CartItem = {
  productId: string;
  variantKey: string;
  productSlug: string;
  titleFr: string;
  titleEn: string;
  color: string;
  size: string;
  qty: number;
  unitPriceCents: number;
  /** Optional — links the cart line to a saved customizer payload in sessionStorage (`va-customizer-{token}`). */
  customizerToken?: string;
  /** Optional — small data-URL thumbnail for cart display; capped to ~50KB at write time. */
  customizerThumbDataUrl?: string;
};

type CartState = {
  items: CartItem[];
  /** Mini-cart drawer visibility. NOT persisted — always starts closed on load. */
  isDrawerOpen: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantKey: string) => void;
  updateQty: (productId: string, variantKey: string, qty: number) => void;
  clear: () => void;
  subtotalCents: () => number;
  itemCount: () => number;
  openDrawer: () => void;
  closeDrawer: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isDrawerOpen: false,
      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      addItem: (incoming) =>
        set((state) => {
          const existingIdx = state.items.findIndex(
            (i) =>
              i.productId === incoming.productId &&
              i.variantKey === incoming.variantKey,
          );
          if (existingIdx >= 0) {
            const next = state.items.slice();
            const existing = next[existingIdx];
            if (existing) {
              next[existingIdx] = {
                ...existing,
                qty: existing.qty + incoming.qty,
              };
            }
            return { items: next };
          }
          return { items: [...state.items, incoming] };
        }),
      removeItem: (productId, variantKey) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && i.variantKey === variantKey),
          ),
        })),
      updateQty: (productId, variantKey, qty) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId && i.variantKey === variantKey
              ? { ...i, qty: Math.max(0, qty) }
              : i,
          ),
        })),
      clear: () => set({ items: [] }),
      subtotalCents: () =>
        get().items.reduce((sum, i) => sum + i.unitPriceCents * i.qty, 0),
      itemCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),
    }),
    {
      name: 'va-cart-v1',
      storage: createJSONStorage(() => localStorage),
      // Only persist `items`. Drawer visibility is ephemeral UI state — we
      // don't want a refresh to reopen the drawer mid-browsing.
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
