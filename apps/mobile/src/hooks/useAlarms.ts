import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { alarmsApi } from "../api/alarms.api";
import { queryKeys } from "../constants/queryKeys";
import type { Alarm } from "../types/api.types";

export function useAlarms() {
  return useQuery({
    queryKey: queryKeys.alarms.all,
    queryFn: () => alarmsApi.list(),
    staleTime: 1000 * 60,
    retry: 1,
    refetchOnWindowFocus: true,
  });
}

export function useCreateAlarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: alarmsApi.create,
    onSuccess: (alarm) => {
      queryClient.setQueryData<Alarm[]>(queryKeys.alarms.all, (prev) => {
        const list = prev ?? [];
        return [...list, alarm].sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() -
            new Date(b.scheduledAt).getTime(),
        );
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.alarms.all });
    },
  });
}

export function useDeleteAlarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: alarmsApi.cancel,
    // Remove immediately from the list before the server responds
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.alarms.all });
      const prev = queryClient.getQueryData<Alarm[]>(queryKeys.alarms.all);
      queryClient.setQueryData<Alarm[]>(
        queryKeys.alarms.all,
        (old) => (old ?? []).filter((a) => a.id !== id),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(queryKeys.alarms.all, ctx.prev);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.alarms.all });
    },
  });
}
