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
