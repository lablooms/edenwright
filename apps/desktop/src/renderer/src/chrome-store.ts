import { create } from "zustand";

/** Chrome-level UI state (title bar, right panel). */
interface ChromeState {
  isMaximized: boolean;
  isPanelOpen: boolean;
  panelWidth: number;
  setMaximized: (isMaximized: boolean) => void;
  togglePanel: () => void;
  setPanelWidth: (width: number) => void;
}

export const useChromeStore = create<ChromeState>((set) => ({
  isMaximized: false,
  isPanelOpen: true,
  panelWidth: 280,
  setMaximized: (isMaximized) => set({ isMaximized }),
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  setPanelWidth: (panelWidth) => set({ panelWidth }),
}));
