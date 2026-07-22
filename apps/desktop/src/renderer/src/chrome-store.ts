import { create } from "zustand";

/** Chrome-level UI state (title bar, right panel, About dialog). */
interface ChromeState {
  isMaximized: boolean;
  isPanelOpen: boolean;
  panelWidth: number;
  aboutOpen: boolean;
  setMaximized: (isMaximized: boolean) => void;
  togglePanel: () => void;
  setPanelWidth: (width: number) => void;
  setAboutOpen: (open: boolean) => void;
}

export const useChromeStore = create<ChromeState>((set) => ({
  isMaximized: false,
  isPanelOpen: true,
  panelWidth: 280,
  aboutOpen: false,
  setMaximized: (isMaximized) => set({ isMaximized }),
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  setPanelWidth: (panelWidth) => set({ panelWidth }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
}));
