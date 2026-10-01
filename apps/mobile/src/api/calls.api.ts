import { apiClient } from "./client";
import { Call } from "@types/api.types";

export type StoryCallInput = {
  toNumber?: string;
  contactName?: string;
  story: string;
  mood?: string;
  customMoodDescription?: string;
  objective?: string;
};

/** The DB enum uses underscores (no_answer, in_progress); the app uses hyphens everywhere. */
const normalize = (c: Call): Call => ({ ...c, status: c.status.replace(/_/g, "-") as Call["status"] });

export const callsApi = {
  list: async (): Promise<Call[]> => {
    const res = await apiClient.get<Call[]>("/calls");
    return res.data.map(normalize);
  },

  get: async (id: string): Promise<Call> => {
    const res = await apiClient.get<Call>(`/calls/${id}`);
    return normalize(res.data);
  },

  initiate: async (data: {
    toNumber: string;
    contactId?: string;
  }): Promise<Call> => {
    const res = await apiClient.post<Call>("/calls", data);
    return res.data;
  },

  startStoryCall: async (data: StoryCallInput): Promise<Call> => {
    const res = await apiClient.post<Call>("/calls/story", data);
    return res.data;
  },
};
