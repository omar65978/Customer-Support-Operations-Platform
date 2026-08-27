import apiClient from "./axios";
import type { Message, NewMessagePayload } from "../types";

export async function fetchMessages(requestId: string): Promise<Message[]> {
  const response = await apiClient.get<Message[]>(`/messages?requestId=${requestId}`);
  const data = Array.isArray(response.data) ? response.data : [];
  return data.filter((m) => !m.isInternal);
}

export async function sendMessage(
  requestId: string,
  payload: NewMessagePayload
): Promise<Message> {
  const response = await apiClient.post<Message>(`/requests/${requestId}/messages`, {
    content: payload.content,
    isInternal: false,
  });
  return response.data;
}