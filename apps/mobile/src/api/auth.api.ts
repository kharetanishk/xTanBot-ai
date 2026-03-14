import { apiClient } from "./client";
import { AuthResponse, User } from "@types/api.types";

export const authApi = {
  register: async (data: {
    email: string;
    password: string;
    name: string;
  }): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>("/users", data);
    return res.data;
  },

  login: async (data: {
    email: string;
    password: string;
  }): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>("/users/login", data);
    return res.data;
  },

  me: async (): Promise<User> => {
    const res = await apiClient.get<User>("/users/me");
    return res.data;
  },
};
