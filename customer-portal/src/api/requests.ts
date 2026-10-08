import apiClient from "./axios";
import { ConflictError, NotFoundError } from "./errors";
import type {
  NewRequestPayload,
  RequestCategory,
  RequestPriority,
  RequestStatus,
  SupportRequest,
} from "../types";

/** Customer-facing groups that match the request lifecycle. */
export type RequestGroup = "all" | "active" | "waiting" | "completed";
export type RequestSort = "updated" | "created" | "urgency";

export interface RequestFilters {
  group: RequestGroup;
  priority: RequestPriority | "";
  category: RequestCategory | "";
  search: string;
  sort: RequestSort;
}

export const DEFAULT_REQUEST_FILTERS: RequestFilters = {
  group: "all",
  priority: "",
  category: "",
  search: "",
  sort: "updated",
};

export interface RequestPage {
  data: SupportRequest[];
  total: number;
  page: number;
  pageSize: number;
}

const GROUP_STATUSES: Record<Exclude<RequestGroup, "all">, RequestStatus[]> = {
  active: ["open", "in_progress"],
  waiting: ["waiting_for_customer"],
  completed: ["resolved", "closed"],
};

const SORT_ORDER: Record<RequestSort, string> = {
  updated: "updated_at.desc",
  created: "created_at.desc",
  urgency: "urgency_rank.desc,updated_at.desc",
};

/**
 * Removes characters that have a meaning in PostgREST filter syntax (commas, brackets,
 * quotes, wildcards) so that user text can only ever match text.
 */
export function sanitizeSearch(text: string): string {
  return text
    .replace(/[(),"'*%\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

/**
 * Builds the query for a customer's list. The customer_id filter is part of the query
 * for defence in depth. Row Level Security enforces the same rule on the server.
 */
export function buildCustomerRequestParams(filters: RequestFilters, customerId: string): URLSearchParams {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("customer_id", `eq.${customerId}`);
  if (filters.group !== "all") {
    params.set("status", `in.(${GROUP_STATUSES[filters.group].join(",")})`);
  }
  if (filters.priority) params.set("priority", `eq.${filters.priority}`);
  if (filters.category) params.set("category", `eq.${filters.category}`);
  const term = sanitizeSearch(filters.search);
  if (term) params.set("or", `(title.ilike.*${term}*,reference.ilike.*${term}*)`);
  params.set("order", SORT_ORDER[filters.sort]);
  return params;
}

function mapRequest(r: any): SupportRequest {
  return {
    id: r.id,
    reference: r.reference,
    title: r.title,
    description: r.description,
    category: r.category,
    priority: r.priority,
    status: r.status,
    customerId: r.customer_id ?? r.customerId,
    assignedAgentId: r.assigned_agent_id ?? r.assignedAgentId ?? null,
    createdAt: r.created_at ?? r.createdAt,
    updatedAt: r.updated_at ?? r.updatedAt,
    resolvedAt: r.resolved_at ?? r.resolvedAt ?? null,
  };
}

export async function fetchMyRequests(
  filters: RequestFilters,
  customerId: string,
  page = 1,
  pageSize = 5
): Promise<RequestPage> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const response = await apiClient.get<any[]>("/requests", {
    params: buildCustomerRequestParams(filters, customerId),
    headers: {
      Range: `${from}-${to}`,
      Prefer: "count=exact",
    },
  });

  const contentRange = String(response.headers["content-range"] ?? "");
  const match = /\/(\d+)$/.exec(contentRange);
  const data = Array.isArray(response.data) ? response.data.map(mapRequest) : [];
  const total = match ? Number(match[1]) : data.length;

  return { data, total, page, pageSize };
}

export async function fetchRequest(id: string, customerId: string): Promise<SupportRequest> {
  const response = await apiClient.get<any[]>("/requests", {
    params: { id: `eq.${id}`, customer_id: `eq.${customerId}`, select: "*" },
  });
  const row = Array.isArray(response.data) ? response.data[0] : undefined;
  if (!row) throw new NotFoundError();
  return mapRequest(row);
}

/**
 * Creates a request. The database sets the reference, the open status and an unassigned
 * owner. Support staff claim requests from the workspace.
 */
export async function createRequest(payload: NewRequestPayload, customerId: string): Promise<SupportRequest> {
  const response = await apiClient.post<any[]>(
    "/requests",
    {
      title: payload.title,
      description: payload.description,
      category: payload.category,
      priority: payload.priority,
      customer_id: customerId,
    },
    { headers: { Prefer: "return=representation" } }
  );
  return mapRequest(response.data[0]);
}

/**
 * Reopens a resolved request. The update applies only while the request is still resolved,
 * so a stale screen cannot overwrite a newer state.
 */
export async function reopenRequest(id: string): Promise<SupportRequest> {
  const response = await apiClient.patch<any[]>(
    "/requests",
    { status: "in_progress" },
    {
      params: { id: `eq.${id}`, status: "eq.resolved" },
      headers: { Prefer: "return=representation" },
    }
  );
  const row = Array.isArray(response.data) ? response.data[0] : undefined;
  if (!row) {
    throw new ConflictError("This request is no longer resolved. Refresh the page to see its latest status.");
  }
  return mapRequest(row);
}
