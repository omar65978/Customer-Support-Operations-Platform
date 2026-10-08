import apiClient from "./axios";
import { STORAGE_URL } from "../config/supabase";
import { ValidationError } from "./errors";
import type { Attachment } from "../types";

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Accepted extensions and the content type stored for each. Keep in sync with the database rules. */
const ATTACHMENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const ATTACHMENT_EXTENSIONS = Object.keys(ATTACHMENT_TYPES);
export const ATTACHMENT_ACCEPT = ATTACHMENT_EXTENSIONS.join(",");

export function attachmentTypeFor(fileName: string): { extension: string; mimeType: string } | null {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return null;
  const extension = fileName.slice(dot).toLowerCase();
  const mimeType = ATTACHMENT_TYPES[extension];
  return mimeType ? { extension, mimeType } : null;
}

/** Returns a message for the user when the file is not acceptable, or null when it is. */
export function validateAttachmentFile(file: { name: string; size: number }): string | null {
  if (!attachmentTypeFor(file.name)) {
    return `This file type is not accepted. Allowed types: ${ATTACHMENT_EXTENSIONS.join(", ")}.`;
  }
  if (file.size <= 0) return "This file is empty.";
  if (file.size > ATTACHMENT_MAX_BYTES) return "This file is larger than the 10 MB limit.";
  return null;
}

function mapAttachment(a: any): Attachment {
  return {
    id: a.id,
    requestId: a.request_id ?? a.requestId,
    uploadedBy: a.uploaded_by ?? a.uploadedBy,
    uploaderName: a.uploader_name ?? a.uploaderName ?? "Support team",
    uploaderRole: a.uploader_role ?? a.uploaderRole,
    originalName: a.original_name ?? a.originalName,
    storedName: a.stored_name ?? a.storedName,
    mimeType: a.mime_type ?? a.mimeType,
    size: Number(a.size),
    createdAt: a.created_at ?? a.createdAt,
  };
}

export async function fetchAttachments(requestId: string): Promise<Attachment[]> {
  const response = await apiClient.get<any[]>("/attachments", {
    params: { select: "*", request_id: `eq.${requestId}`, order: "created_at.asc" },
  });
  return Array.isArray(response.data) ? response.data.map(mapAttachment) : [];
}

function newObjectId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Uploads a file to the private bucket, then records its metadata. The storage path starts
 * with the request id, which the database checks. If the metadata step fails, the file is
 * not listed on the request, and the error is shown to the user.
 */
export async function uploadAttachment(requestId: string, file: File): Promise<Attachment> {
  const problem = validateAttachmentFile(file);
  if (problem) throw new ValidationError(problem);
  const type = attachmentTypeFor(file.name)!;
  const storedName = `${requestId}/${newObjectId()}${type.extension}`;

  await apiClient.post(`${STORAGE_URL}/object/attachments/${storedName}`, file, {
    headers: { "Content-Type": type.mimeType, "x-upsert": "false" },
  });

  const response = await apiClient.post<any[]>(
    "/attachments",
    {
      request_id: requestId,
      original_name: file.name.slice(0, 200),
      stored_name: storedName,
      mime_type: type.mimeType,
      size: file.size,
    },
    { headers: { Prefer: "return=representation" } }
  );
  return mapAttachment(response.data[0]);
}

/**
 * Downloads through the authenticated Storage endpoint, so the access token stays in the
 * request header and never appears in a URL.
 */
export async function downloadAttachment(attachment: Attachment): Promise<void> {
  const response = await apiClient.get<Blob>(
    `${STORAGE_URL}/object/authenticated/attachments/${attachment.storedName}`,
    { responseType: "blob" }
  );
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = attachment.originalName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
