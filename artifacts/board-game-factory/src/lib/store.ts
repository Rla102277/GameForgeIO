import { create } from "zustand";

interface AppState {
  expandedEntities: Record<number, boolean>;
  toggleEntity: (id: number) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
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
  activeTab: "ontology",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
