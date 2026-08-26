import apiClient from "./axios";
import type { Message, NewMessagePayload } from "../types";

export async function fetchMessages(requestId: string): Promise<Message[]> {
  const response = await apiClient.get<Message[]>(`/messages?requestId=${requestId}`);
  const data = Array.isArray(response.data) ? response.data : [];
  return data.filter((m) => !m.isInternal);
}

export async function sendMessage(
  requestId: string,
  payload: NewMessagePayload,
  authorId: string,
  authorName: string
): Promise<Message> {
  const response = await apiClient.post<Message>("/messages", {
    requestId,
    authorId,
    authorName,
    authorRole: "customer",
    content: payload.content,
    isInternal: false,
    createdAt: new Date().toISOString(),
  });
  return response.data;
}
