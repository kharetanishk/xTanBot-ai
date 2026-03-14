import { apiClient } from "./client";
import { Meeting } from "@types/api.types";

export const meetingsApi = {
  list: async (): Promise<Meeting[]> => {
    const res = await apiClient.get<Meeting[]>("/meetings");
    return res.data;
  },

  upcoming: async (): Promise<Meeting[]> => {
    const res = await apiClient.get<Meeting[]>("/meetings/upcoming");
    return res.data;
  },

  get: async (id: string): Promise<Meeting> => {
    const res = await apiClient.get<Meeting>(`/meetings/${id}`);
    return res.data;
  },

  create: async (data: {
    title: string;
    description?: string;
    attendees: string[];
    scheduledAt: string;
    duration: number;
  }): Promise<Meeting> => {
    const res = await apiClient.post<Meeting>("/meetings", data);
    return res.data;
  },

  update: async (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      scheduledAt: string;
      duration: number;
    }>,
  ): Promise<Meeting> => {
    const res = await apiClient.patch<Meeting>(`/meetings/${id}`, data);
    return res.data;
  },

  cancel: async (id: string): Promise<void> => {
    await apiClient.delete(`/meetings/${id}`);
  },
};
