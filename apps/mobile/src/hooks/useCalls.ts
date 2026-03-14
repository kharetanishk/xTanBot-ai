import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { callsApi } from "@api/calls.api";
import { queryKeys } from "@constants/queryKeys";

export function useCalls() {
  return useQuery({
    queryKey: queryKeys.calls.all,
    queryFn: callsApi.list,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 10,
  });
}

export function useCall(id: string) {
  return useQuery({
    queryKey: queryKeys.calls.detail(id),
    queryFn: () => callsApi.get(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "in-progress" || status === "initiated" ? 3000 : false;
    },
  });
}

export function useInitiateCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: callsApi.initiate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calls.all });
    },
  });
}
