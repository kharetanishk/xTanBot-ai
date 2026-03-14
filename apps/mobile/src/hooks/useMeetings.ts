import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { meetingsApi } from "@api/meetings.api";
import { queryKeys } from "@constants/queryKeys";

export function useMeetings() {
  return useQuery({
    queryKey: queryKeys.meetings.all,
    queryFn: meetingsApi.list,
    staleTime: 1000 * 60 * 2,
  });
}

export function useUpcomingMeetings() {
  return useQuery({
    queryKey: queryKeys.meetings.upcoming,
    queryFn: meetingsApi.upcoming,
    staleTime: 1000 * 60,
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: queryKeys.meetings.detail(id),
    queryFn: () => meetingsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: meetingsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.upcoming });
    },
  });
}

export function useCancelMeeting(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => meetingsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.upcoming });
    },
  });
}
