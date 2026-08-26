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
  customerId: string,
  filters: RequestFilters = {},
  page = 1,
  pageSize = 5
): Promise<RequestPage> {
  const params = new URLSearchParams();
  params.set("customerId", customerId);
  params.set("_page", String(page));
  params.set("_per_page", String(pageSize));
  params.set("_sort", "updatedAt");
  params.set("_order", "desc");
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.category) params.set("category", filters.category);

  const response = await apiClient.get(`/requests?${params.toString()}`);

  const raw = response.data;
  const allMatchingItems: SupportRequest[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.data)
    ? raw.data
    : [];

  if (Array.isArray(raw)) {
    const start = (page - 1) * pageSize;
    const sliced = raw.slice(start, start + pageSize);
    return { data: sliced, total: raw.length, page, pageSize };
  }

  return {
    data: allMatchingItems,
    total: raw.items ?? raw.total ?? allMatchingItems.length,
    page: raw.page ?? page,
    pageSize: raw.pageSize ?? pageSize,
  };
}

export async function fetchRequest(id: string): Promise<SupportRequest> {
  const response = await apiClient.get<SupportRequest>(`/requests/${id}`);
  return response.data;
}

export async function fetchAgents(): Promise<User[]> {
  const response = await apiClient.get<User[]>(`/users?role=agent`);
  const data = response.data;
  return Array.isArray(data) ? data.filter((u) => u.role === "agent") : [];
}

export async function createRequest(
  payload: NewRequestPayload,
  customerId: string
): Promise<SupportRequest> {
  const agents = await fetchAgents();
  const assignedAgentId =
    agents.length > 0 ? agents[Math.floor(Math.random() * agents.length)].id : null;

  const now = new Date().toISOString();
  const randomRef = `REQ-${Math.floor(10000 + Math.random() * 90000)}`;

  const response = await apiClient.post<SupportRequest>("/requests", {
    ...payload,
    customerId,
    assignedAgentId,
    status: "open",
    reference: randomRef,
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
