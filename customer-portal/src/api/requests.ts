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

  params.set("order", "updated_at.desc");

  if (filters.status) params.set("status", `eq.${filters.status}`);
  if (filters.priority) params.set("priority", `eq.${filters.priority}`);
  if (filters.category) params.set("category", `eq.${filters.category}`);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const response = await apiClient.get<SupportRequest[]>(`/requests?${params.toString()}`, {
    headers: {
      Prefer: "count=exact",
      Range: `${from}-${to}`,
    },
  });

  const contentRange = response.headers["content-range"];
  let total = 0;
  if (contentRange) {
    const parts = contentRange.split("/");
    if (parts[1]) total = parseInt(parts[1], 10);
  } else {
    total = Array.isArray(response.data) ? response.data.length : 0;
  }

  const data: SupportRequest[] = Array.isArray(response.data) ? response.data : [];
  return { data, total, page, pageSize };
}

export async function fetchRequest(id: string): Promise<SupportRequest> {
  const response = await apiClient.get<SupportRequest[]>(`/requests?id=eq.${id}`);
  return response.data[0];
}

export async function fetchAgents(): Promise<User[]> {
  const response = await apiClient.get<User[]>(`/users?role=eq.agent`);
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

  const response = await apiClient.post<SupportRequest[]>(
    "/requests",
    {
      ...payload,
      customer_id: customerId,
      assigned_agent_id: assignedAgentId,
      status: "open",
      reference,
      created_at: now,
      updated_at: now,
      resolved_at: null,
    },
    {
      headers: {
        Prefer: "return=representation",
      },
    }
  );
  return response.data[0];
}

export async function updateRequestStatus(
  id: string,
  status: SupportRequest["status"]
): Promise<SupportRequest> {
  const response = await apiClient.patch<SupportRequest[]>(
    `/requests?id=eq.${id}`,
    {
      status,
      updated_at: new Date().toISOString(),
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
    },
    {
      headers: {
        Prefer: "return=representation",
      },
    }
  );
  return response.data[0];
}