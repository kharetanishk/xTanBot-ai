import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { User } from "@types/api.types";
import { TOKEN_STORAGE_KEY } from "@constants/config";

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: async (token, user) => {
    await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
    set({ token, user, isAuthenticated: true });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },

  loadToken: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
      set({ token, isLoading: false, isAuthenticated: !!token });
    } catch {
      set({ isLoading: false, isAuthenticated: false });
    }
  },
}));
