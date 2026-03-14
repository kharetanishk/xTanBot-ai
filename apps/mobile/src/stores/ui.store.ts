import { create } from "zustand";

interface UIState {
  activeCallId: string | null;
  activeCallStatus: string | null;
  setActiveCall: (id: string, status: string) => void;
  clearActiveCall: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeCallId: null,
  activeCallStatus: null,
  setActiveCall: (id, status) =>
    set({ activeCallId: id, activeCallStatus: status }),
  clearActiveCall: () => set({ activeCallId: null, activeCallStatus: null }),
}));
