import apiClient from "./axios";
import type { NewRequestPayload, SupportRequest } from "../types";

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

function mapRequest(request: any): SupportRequest {
  return {
    ...request,
    customerId: request.customer_id ?? request.customerId,
    assignedAgentId: request.assigned_agent_id ?? request.assignedAgentId,
    createdAt: request.created_at ?? request.createdAt,
    updatedAt: request.updated_at ?? request.updatedAt,
    resolvedAt: request.resolved_at ?? request.resolvedAt,
  };
}

function requireReturnedRequest(data: any[]): SupportRequest {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("The request could not be saved. It may have changed or you may not have permission.");
  }
  return mapRequest(data[0]);
}

export async function fetchMyRequests(
  filters: RequestFilters = {},
  page = 1,
  pageSize = 5,
  customerId?: string,
): Promise<RequestPage> {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "updated_at.desc");
  if (customerId) params.set("customer_id", `eq.${customerId}`);
  if (filters.status) params.set("status", `eq.${filters.status}`);
  if (filters.priority) params.set("priority", `eq.${filters.priority}`);
  if (filters.category) params.set("category", `eq.${filters.category}`);

  const safePage = Math.max(1, Math.floor(Number.isFinite(page) ? page : 1));
  const safePageSize = Math.min(50, Math.max(1, Math.floor(Number.isFinite(pageSize) ? pageSize : 5)));
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  const response = await apiClient.get<any[]>(`/requests?${params.toString()}`, {
    headers: {
      Range: `${from}-${to}`,
      Prefer: "count=exact",
    },
  });

  const contentRange = response.headers["content-range"];
  const count = contentRange?.split("/")[1];
  const total = count && count !== "*" ? Number.parseInt(count, 10) : response.data.length;
  const data = Array.isArray(response.data) ? response.data.map(mapRequest) : [];
  return { data, total: Number.isFinite(total) ? total : data.length, page: safePage, pageSize: safePageSize };
}

export async function fetchRequest(id: string): Promise<SupportRequest> {
  const response = await apiClient.get<any[]>("/requests", {
    params: { id: `eq.${id}`, select: "*", limit: 1 },
  });
  if (!Array.isArray(response.data) || response.data.length === 0) {
    throw new Error("Request not found or access denied.");
  }
  return mapRequest(response.data[0]);
}

export async function createRequest(payload: NewRequestPayload): Promise<SupportRequest> {
  const response = await apiClient.post<any[]>(
    "/requests",
    {
      title: payload.title.trim(),
      description: payload.description.trim(),
      category: payload.category,
      priority: payload.priority,
    },
    { headers: { Prefer: "return=representation" } },
  );
  return requireReturnedRequest(response.data);
}

export async function updateRequestStatus(
  id: string,
  status: SupportRequest["status"],
): Promise<SupportRequest> {
  const response = await apiClient.patch<any[]>(
    "/requests",
    { status },
    {
      params: { id: `eq.${id}` },
      headers: { Prefer: "return=representation" },
    },
  );
  return requireReturnedRequest(response.data);
}
