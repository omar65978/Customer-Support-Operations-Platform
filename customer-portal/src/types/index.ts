export type UserRole = "customer" | "agent" | "manager";

export type RequestCategory = "billing" | "technical" | "account" | "general";

export type RequestPriority = "low" | "medium" | "high" | "urgent";

export type RequestStatus =
  | "open"
  | "in_progress"
  | "waiting_for_customer"
  | "resolved"
  | "closed";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthUser extends User {
  accessToken: string;
}

export interface SupportRequest {
  id: string;
  reference: string;
  customerId: string;
  assignedAgentId: string | null;
  title: string;
  description: string;
  category: RequestCategory;
  priority: RequestPriority;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface Message {
  id: string;
  requestId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

export interface NewRequestPayload {
  title: string;
  description: string;
  category: RequestCategory;
  priority: RequestPriority;
}

export interface NewMessagePayload {
  content: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}
