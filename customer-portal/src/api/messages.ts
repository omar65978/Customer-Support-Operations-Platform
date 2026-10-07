import apiClient from "./axios";
import type { Message, NewMessagePayload, UserRole } from "../types";

function mapMessage(message: any): Message {
  return {
    id: message.id,
    requestId: message.request_id ?? message.requestId,
    authorId: message.author_id ?? message.authorId,
    authorName: message.author_name ?? message.authorName,
    authorRole: (message.author_role ?? message.authorRole) as UserRole,
    content: message.content,
    isInternal: message.is_internal ?? message.isInternal ?? false,
    createdAt: message.created_at ?? message.createdAt,
  };
}

export async function fetchMessages(requestId: string): Promise<Message[]> {
  const response = await apiClient.get<any[]>("/messages", {
    params: {
      request_id: `eq.${requestId}`,
      is_internal: "eq.false",
      order: "created_at.asc",
      select: "id,request_id,author_id,author_name,author_role,content,is_internal,created_at",
    },
  });
  const data = Array.isArray(response.data) ? response.data : [];
  return data.map(mapMessage).filter((message) => !message.isInternal);
}

export async function sendMessage(
  requestId: string,
  payload: NewMessagePayload,
): Promise<Message> {
  const response = await apiClient.post<any[]>(
    "/messages",
    {
      request_id: requestId,
      content: payload.content.trim(),
      is_internal: false,
    },
    { headers: { Prefer: "return=representation" } },
  );
  if (!Array.isArray(response.data) || response.data.length === 0) {
    throw new Error("Your reply was not saved. Please try again.");
  }
  return mapMessage(response.data[0]);
}
