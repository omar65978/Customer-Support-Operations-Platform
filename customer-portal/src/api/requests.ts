import apiClient from "./axios";
import type { SupportRequest, NewRequestPayload, User } from "../types";

export interface RequestFilters {
  status?: string;
  priority?: string;
  category?: string;
}

export interface RequestPage {
  data: SupportRequest[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchMyRequests(
  filters: RequestFilters = {},
  page = 1,
  pageSize = 5
): Promise<RequestPage> {
  const params = new URLSearchParams();
  params.set("_page", String(page));
  params.set("_limit", String(pageSize));
  params.set("_sort", "updatedAt");
  params.set("_order", "desc");
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.category) params.set("category", filters.category);

  const response = await apiClient.get(`/requests?${params.toString()}`);
  const total = parseInt(response.headers["x-total-count"] || "0", 10);
  const data: SupportRequest[] = Array.isArray(response.data) ? response.data : [];
  return { data, total, page, pageSize };
}

export async function fetchRequest(id: string): Promise<SupportRequest> {
  const response = await apiClient.get<SupportRequest>(`/requests/${id}`);
  return response.data;
}

export async function fetchAgents(): Promise<User[]> {
  const response = await apiClient.get<User[]>(`/users?role=agent`);
  return Array.isArray(response.data) ? response.data : [];
}

export async function createRequest(
  payload: NewRequestPayload,
  customerId: string
): Promise<SupportRequest> {
  const agents = await fetchAgents();
  const assignedAgentId =
    agents.length > 0 ? agents[Math.floor(Math.random() * agents.length)].id : null;

  const now = new Date().toISOString();
  const reference = `REQ-${Math.floor(10000 + Math.random() * 90000)}`;

  const response = await apiClient.post<SupportRequest>("/requests", {
    ...payload,
    customerId,
    assignedAgentId,
    status: "open",
    reference,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  });
  return response.data;
}

export async function updateRequestStatus(
  id: string,
  status: SupportRequest["status"]
): Promise<SupportRequest> {
  const response = await apiClient.patch<SupportRequest>(`/requests/${id}`, {
    status,
    updatedAt: new Date().toISOString(),
    resolvedAt: status === "resolved" ? new Date().toISOString() : null,
  });
  return response.data;
}