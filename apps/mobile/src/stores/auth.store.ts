import { create } from "zustand";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { User } from "../types/api.types";
import { API_BASE_URL, TOKEN_STORAGE_KEY } from "../constants/config";

async function saveToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
}

async function removeToken(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
}

async function readTokenFromStorage(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }
  return await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
}

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
    await saveToken(token);
    set({ token, user, isAuthenticated: true });
  },

  clearAuth: async () => {
    await removeToken();
    set({ token: null, user: null, isAuthenticated: false });
  },

  loadToken: async () => {
    try {
      const token = await readTokenFromStorage();
      if (!token) {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        });
        return;
      }
      set({ token, isAuthenticated: true });
      try {
        const res = await fetch(`${API_BASE_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const user = (await res.json()) as User;
          set({ user });
        } else if (res.status === 401) {
          await removeToken();
          set({
            token: null,
            user: null,
            isAuthenticated: false,
          });
        }
      } catch {
        // Network error — keep token; user may stay null until useMe succeeds
      }
    } catch {
      set({ token: null, user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
