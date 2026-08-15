import apiClient from "./axios";
import type { SupportRequest, NewRequestPayload } from "../types";

export async function fetchMyRequests(customerId: string): Promise<SupportRequest[]> {
  const response = await apiClient.get<SupportRequest[]>(`/requests?customerId=${customerId}`);
  return response.data;
}

export async function fetchRequest(id: string): Promise<SupportRequest> {
  const response = await apiClient.get<SupportRequest>(`/requests/${id}`);
  return response.data;
}

export async function createRequest(
  payload: NewRequestPayload,
  customerId: string
): Promise<SupportRequest> {
  const now = new Date().toISOString();
  const count = (await fetchMyRequests(customerId)).length;
  const reference = `REQ-${String(count + 100).padStart(3, "0")}`;

  const response = await apiClient.post<SupportRequest>("/requests", {
    ...payload,
    customerId,
    assignedAgentId: null,
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
