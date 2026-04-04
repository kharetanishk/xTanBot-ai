export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  calls: {
    all: ["calls"] as const,
    detail: (id: string) => ["calls", id] as const,
  },
  meetings: {
    all: ["meetings"] as const,
    upcoming: ["meetings", "upcoming"] as const,
    detail: (id: string) => ["meetings", id] as const,
  },
  contacts: {
    all: ["contacts"] as const,
    search: (q: string) => ["contacts", "search", q] as const,
    detail: (id: string) => ["contacts", id] as const,
  },
  conversations: ["conversations"] as const,
  conversation: (callId: string) => ["conversations", callId] as const,
  alarms: {
    all: ["alarms"] as const,
  },
} as const;
