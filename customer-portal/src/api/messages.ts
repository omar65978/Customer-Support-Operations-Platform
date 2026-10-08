import apiClient from "./axios";
import type { Message } from "../types";

function mapMessage(m: any): Message {
  return {
    id: m.id,
    requestId: m.request_id ?? m.requestId,
    authorId: m.author_id ?? m.authorId,
    authorName: m.author_name ?? m.authorName ?? "Support team",
    authorRole: m.author_role ?? m.authorRole,
    content: m.content,
    isInternal: Boolean(m.is_internal ?? m.isInternal ?? false),
    createdAt: m.created_at ?? m.createdAt,
  };
}

/**
 * Customer-visible conversation. The query asks for public messages only, and the client
 * filters again as a second safeguard. Row Level Security is the enforcing layer.
 */
export async function fetchMessages(requestId: string): Promise<Message[]> {
  const response = await apiClient.get<any[]>("/messages", {
    params: {
      select: "*",
      request_id: `eq.${requestId}`,
      is_internal: "eq.false",
      order: "created_at.asc",
    },
  });
  const rows = Array.isArray(response.data) ? response.data.map(mapMessage) : [];
  return rows.filter((m) => !m.isInternal);
}

/** The author is set by the database from the signed-in account, so the client does not send it. */
export async function sendMessage(requestId: string, content: string): Promise<Message> {
  const response = await apiClient.post<any[]>(
    "/messages",
    { request_id: requestId, content, is_internal: false },
    { headers: { Prefer: "return=representation" } }
  );
  return mapMessage(response.data[0]);
}
