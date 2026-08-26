import apiClient from "./axios";
import type { Attachment } from "../types";

export async function fetchAttachments(requestId: string): Promise<Attachment[]> {
  const response = await apiClient.get<Attachment[]>(`/requests/${requestId}/attachments`);
  return Array.isArray(response.data) ? response.data : [];
}

export async function uploadAttachment(requestId: string, file: File): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiClient.post<Attachment>(`/requests/${requestId}/attachments`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export function getDownloadUrl(attachmentId: string): string {
  return `${apiClient.defaults.baseURL}/attachments/${attachmentId}/download`;
}
