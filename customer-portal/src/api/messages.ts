import apiClient from "./axios";
import type { Message, NewMessagePayload } from "../types";

export async function fetchMessages(requestId: string): Promise<Message[]> {
  const response = await apiClient.get<Message[]>(`/messages?request_id=eq.${requestId}&order=created_at.asc`);
  const data = Array.isArray(response.data) ? response.data : [];
  return data.filter((m) => !m.isInternal);
}

export async function sendMessage(
  requestId: string,
  payload: NewMessagePayload,
): Promise<Message> {
  const response = await apiClient.post<Message>(`/messages`, {
    request_id: requestId,
    content: payload.content,
    isInternal: false,
  });
  return response.data;
}