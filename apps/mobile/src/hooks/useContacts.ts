import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { contactsApi } from "@api/contacts.api";
import { queryKeys } from "@constants/queryKeys";

export function useContacts(search?: string) {
  return useQuery({
    queryKey: search
      ? queryKeys.contacts.search(search)
      : queryKeys.contacts.all,
    queryFn: () => contactsApi.list(search),
    staleTime: 1000 * 60 * 2,
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: queryKeys.contacts.detail(id),
    queryFn: () => contactsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: contactsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
    },
  });
}

export function useUpdateContact(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof contactsApi.update>[1]) =>
      contactsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.contacts.detail(id),
      });
    },
  });
}

export function useDeleteContact(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => contactsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
    },
  });
}
