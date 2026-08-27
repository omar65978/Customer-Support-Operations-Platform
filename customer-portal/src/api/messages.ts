import apiClient from "./axios";
import type { Message, NewMessagePayload } from "../types";

export async function fetchMessages(requestId: string): Promise<Message[]> {
  const response = await apiClient.get<any[]>(
    `/messages?request_id=eq.${requestId}&order=created_at.asc`
  );
  const data = Array.isArray(response.data) ? response.data : [];
  
  return data
    .map((m) => ({
      ...m,
      isInternal: m.is_internal ?? m.isInternal ?? false,
      requestId: m.request_id ?? m.requestId,
      authorId: m.author_id ?? m.authorId,
      authorName: m.author_name ?? m.authorName,
      authorRole: m.author_role ?? m.authorRole,
      createdAt: m.created_at ?? m.createdAt,
    }))
    .filter((m) => !m.isInternal);
}

export async function sendMessage(
  requestId: string,
  payload: NewMessagePayload
): Promise<Message> {
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  const response = await apiClient.post<any[]>(
    "/messages",
    {
      request_id: requestId,
      content: payload.content,
      is_internal: false,
      author_id: user?.id || null,
      author_name: user?.name || "Customer",
      author_role: user?.role || "customer",
      created_at: new Date().toISOString(),
    },
    {
      headers: {
        Prefer: "return=representation",
      },
    }
  );

  const m = response.data[0];
  return {
    ...m,
    isInternal: m.is_internal ?? m.isInternal ?? false,
    requestId: m.request_id ?? m.requestId,
    authorId: m.author_id ?? m.authorId,
    authorName: m.author_name ?? m.authorName,
    authorRole: m.author_role ?? m.authorRole,
    createdAt: m.created_at ?? m.createdAt,
  };
}