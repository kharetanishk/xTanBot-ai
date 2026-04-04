import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { alarmsApi } from "../api/alarms.api";
import { queryKeys } from "../constants/queryKeys";

export function useAlarms() {
  return useQuery({
    queryKey: queryKeys.alarms.all,
    queryFn: () => alarmsApi.list(),
    staleTime: 1000 * 30,
  });
}

export function useCreateAlarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: alarmsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alarms.all });
    },
  });
}

export function useDeleteAlarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: alarmsApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alarms.all });
    },
  });
}
