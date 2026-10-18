import { create } from 'zustand';
import { sessionStore } from '@/services/storage';

const SAMPLE_PROMPT_KEY = 'samplePromptDismissed';

interface UiState {
  sidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  /** "Start fresh" on the dashboard's sample-data card; remembered for this browser tab. */
  samplePromptDismissed: boolean;
  dismissSamplePrompt: () => void;
}

/** UI-only state: the mobile sidebar drawer and dismissed hints. */
export const useUiStore = create<UiState>()((set) => ({
  sidebarOpen: false,
  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // sessionStore is SSR-safe (returns the fallback on the server).
  samplePromptDismissed: sessionStore.get(SAMPLE_PROMPT_KEY, false),
  dismissSamplePrompt: () => {
    sessionStore.set(SAMPLE_PROMPT_KEY, true);
    set({ samplePromptDismissed: true });
  },
}));
