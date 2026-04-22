import { create } from "zustand";

interface AppState {
  expandedEntities: Record<number, boolean>;
  toggleEntity: (id: number) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  expandedEntities: {},
  toggleEntity: (id) =>
    set((state) => ({
      expandedEntities: {
        ...state.expandedEntities,
        [id]: !state.expandedEntities[id],
      },
    })),
  activeTab: "overview",
  setActiveTab: (tab) => set({ activeTab: tab }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
