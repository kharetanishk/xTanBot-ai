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
  createdAt: string;
  updatedAt: string;
}

export interface Meeting {
  id: string;
  userId: string;
  title: string;
  description?: string;
  attendees: string[];
  scheduledAt: string;
  duration: number;
  status: "scheduled" | "completed" | "cancelled";
  createdAt: string;
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
