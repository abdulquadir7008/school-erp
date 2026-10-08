"use client";

import { create } from "zustand";

interface GlobalSearchState {
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

export const useGlobalSearch = create<GlobalSearchState>((set) => ({
  open: false,
  openSearch: () => set({ open: true }),
  closeSearch: () => set({ open: false }),
}));