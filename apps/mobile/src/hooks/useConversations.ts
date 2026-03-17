import { useQuery } from "@tanstack/react-query";
import { getConversation } from "../api/conversations.api";
import { queryKeys } from "../constants/queryKeys";

export function useConversation(callId: string) {
  return useQuery({
    queryKey: queryKeys.conversation(callId),
    queryFn: () => getConversation(callId),
    enabled: !!callId,
  });
}
