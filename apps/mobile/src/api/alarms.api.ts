import { apiClient } from "./client";
import type { Alarm } from "../types/api.types";

export const alarmsApi = {
  list: async (): Promise<Alarm[]> => {
    const res = await apiClient.get<Alarm[]>("/alarms");
    return res.data;
  },

  create: async (data: {
    scheduledAt: string;
    label?: string;
  }): Promise<Alarm> => {
    const res = await apiClient.post<Alarm>("/alarms", data);
    return res.data;
  },

  cancel: async (id: string): Promise<void> => {
    await apiClient.delete(`/alarms/${id}`);
  },
};
