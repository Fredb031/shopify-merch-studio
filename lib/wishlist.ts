'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type WishlistState = {
  productIds: string[];
  add: (id: string) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  has: (id: string) => boolean;
  clear: () => void;
  count: () => number;
};

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      productIds: [],
      add: (id) =>
        set((state) =>
          state.productIds.includes(id)
            ? state
            : { productIds: [...state.productIds, id] },
        ),
      remove: (id) =>
        set((state) => ({
          productIds: state.productIds.filter((existing) => existing !== id),
        })),
      toggle: (id) =>
        set((state) =>
          state.productIds.includes(id)
            ? { productIds: state.productIds.filter((e) => e !== id) }
            : { productIds: [...state.productIds, id] },
        ),
      has: (id) => get().productIds.includes(id),
      clear: () => set({ productIds: [] }),
      count: () => get().productIds.length,
    }),
    {
      name: 'va-wishlist-v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
