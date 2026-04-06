export interface ApiError {
  message: string;
  statusCode: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  timezone: string;
  createdAt: string;
}

export interface Call {
  id: string;
  userId: string;
  contactId?: string;
  toNumber: string;
  fromNumber: string;
  status: "initiated" | "in-progress" | "completed" | "failed" | "no-answer";
  duration?: number;
  callSid: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Alarm {
  id: string;
  userId: string;
  label: string;
  scheduledAt: string;
  status: "scheduled" | "ringing" | "acknowledged" | "cancelled" | "failed";
  repeatCount: number;
  callSid?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ActionButton = {
  id: string;
  label: string;
  style: "primary" | "danger" | "secondary";
  autoMessage: string;
};

export type SearchResultCard = {
  title: string;
  snippet: string;
  phone?: string;
  address?: string;
  rating?: string;
  url?: string;
};

export type StructuredPayload = {
  type: "search_results" | "confirmation" | "whatsapp_sent" | "location" | "none";
  results?: SearchResultCard[];
  actions?: ActionButton[];
  confirmationData?: {
    toPhone: string;
    contactName: string;
    messagePreview: string;
    confirmMessage: string;
    cancelMessage: string;
  };
  locationData?: {
    city: string;
    state: string;
    googleMapsUrl: string;
    formatted: string;
  };
};

export interface Meeting {
  id: string;
  userId: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  status: "scheduled" | "confirmed" | "cancelled" | "completed" | "rescheduled";
  createdAt: string;
  updatedAt?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolsUsed?: string[];
  createdAt: string;
  structuredPayload?: StructuredPayload | null;
}

export interface Conversation {
  id: string;
  userId: string;
  callId?: string;
  messages: Message[];
  summary?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Contact {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
