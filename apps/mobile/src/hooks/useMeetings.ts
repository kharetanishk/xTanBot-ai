import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { meetingsApi } from "../api/meetings.api";
import { queryKeys } from "../constants/queryKeys";

export type MeetingSummaryResponse = {
  hasSummary: boolean;
  summary: string | null;
  transcript: Array<{
    role: string;
    content: string;
    createdAt: string;
  }>;
  callDuration?: number | null;
  callStatus?: string;
  callId?: string;
};

export function useMeetings() {
  return useQuery({
    queryKey: queryKeys.meetings.all,
    queryFn: () => meetingsApi.list(),
    staleTime: 1000 * 60,
  });
}

export function useUpcomingMeetings() {
  return useQuery({
    queryKey: queryKeys.meetings.upcoming,
    queryFn: () => meetingsApi.upcoming(),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.detail(id) });
    },
  });
}

export function useMeetingSummary(meetingId: string) {
  return useQuery({
    queryKey: ["meetings", meetingId, "summary"] as const,
    queryFn: async () => {
      const res = await apiClient.get<MeetingSummaryResponse>(
        `/meetings/${meetingId}/summary`,
      );
      return res.data;
    },
    enabled: !!meetingId,
    staleTime: 1000 * 60,
  });
}
