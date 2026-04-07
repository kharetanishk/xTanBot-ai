import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { callsApi, type StoryCallInput } from "../api/calls.api";
import { queryKeys } from "../constants/queryKeys";

export function useCalls(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: queryKeys.calls.all,
    queryFn: () => callsApi.list(),
    staleTime: 1000 * 60,
    refetchInterval: options?.refetchInterval,
  });
}

export function useCall(id: string, options?: { enabled?: boolean; refetchInterval?: number }) {
  return useQuery({
    queryKey: queryKeys.calls.detail(id),
    queryFn: () => callsApi.get(id),
    enabled: options?.enabled !== undefined ? options.enabled && !!id : !!id,
    refetchInterval: options?.refetchInterval,
  });
}

export function useInitiateCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { toNumber: string; contactId?: string }) =>
      callsApi.initiate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.all });
    },
  });
}

export function useStartStoryCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StoryCallInput) => callsApi.startStoryCall(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.all });
    },
  });
}
