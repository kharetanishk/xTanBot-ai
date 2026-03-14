import { apiClient } from "./client";
import { Call } from "@types/api.types";

export const callsApi = {
  list: async (): Promise<Call[]> => {
    const res = await apiClient.get<Call[]>("/calls");
    return res.data;
  },

  get: async (id: string): Promise<Call> => {
    const res = await apiClient.get<Call>(`/calls/${id}`);
    return res.data;
  },

  initiate: async (data: {
    toNumber: string;
    contactId?: string;
  }): Promise<Call> => {
    const res = await apiClient.post<Call>("/calls", data);
    return res.data;
  },
};
