import { apiClient } from "./client";
import { Contact } from "@types/api.types";

export const contactsApi = {
  list: async (search?: string): Promise<Contact[]> => {
    const res = await apiClient.get<Contact[]>("/contacts", {
      params: search ? { q: search } : undefined,
    });
    return res.data;
  },

  get: async (id: string): Promise<Contact> => {
    const res = await apiClient.get<Contact>(`/contacts/${id}`);
    return res.data;
  },

  create: async (data: {
    name: string;
    phone?: string;
    email?: string;
    company?: string;
    notes?: string;
  }): Promise<Contact> => {
    const res = await apiClient.post<Contact>("/contacts", data);
    return res.data;
  },

  update: async (
    id: string,
    data: Partial<{
      name: string;
      phone: string;
      email: string;
      company: string;
      notes: string;
    }>,
  ): Promise<Contact> => {
    const res = await apiClient.patch<Contact>(`/contacts/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/contacts/${id}`);
  },
};
