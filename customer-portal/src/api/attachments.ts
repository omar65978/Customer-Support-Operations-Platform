import apiClient from "./axios";
import { refreshAuthSession, saveAuthSession } from "./auth";
import type { Attachment, UserRole } from "../types";
import { assertSupabaseConfigured, supabaseConfig } from "../config/supabase";

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const ALLOWED_ATTACHMENT_EXTENSIONS = Object.keys(MIME_BY_EXTENSION).map((extension) => `.${extension}`);
export const ALLOWED_ATTACHMENT_MIME_TYPES = Object.values(MIME_BY_EXTENSION);

function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function attachmentMimeType(file: File): string {
  return file.type || MIME_BY_EXTENSION[extensionOf(file.name)] || "";
}

export function validateAttachment(file: File): string | null {
  if (file.size < 1) return "Choose a non-empty file.";
  if (file.size > MAX_ATTACHMENT_SIZE) return "File exceeds the 10 MB limit.";
  if (!MIME_BY_EXTENSION[extensionOf(file.name)]) return "This file type is not allowed.";
  if (file.type && !ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type)) return "This file type is not allowed.";
  return null;
}

function mapAttachment(attachment: any): Attachment {
  return {
    id: attachment.id,
    requestId: attachment.request_id ?? attachment.requestId,
    uploadedBy: attachment.uploaded_by ?? attachment.uploadedBy,
    uploaderName: attachment.uploader_name ?? attachment.uploaderName,
    uploaderRole: (attachment.uploader_role ?? attachment.uploaderRole) as UserRole,
    originalName: attachment.original_name ?? attachment.originalName,
    storagePath: attachment.storage_path ?? attachment.storagePath,
    mimeType: attachment.mime_type ?? attachment.mimeType,
    size: attachment.size_bytes ?? attachment.size,
    createdAt: attachment.created_at ?? attachment.createdAt,
  };
}

function encodeStoragePath(storagePath: string): string {
  return storagePath.split("/").map(encodeURIComponent).join("/");
}

async function authenticatedStorageFetch(url: string, init: RequestInit): Promise<Response> {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Sign in again to access this file.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("apikey", supabaseConfig.anonKey);
  let response = await fetch(url, { ...init, headers });
  const refreshToken = localStorage.getItem("refresh_token");
  if (response.status === 401 && refreshToken) {
    const session = await refreshAuthSession(refreshToken);
    saveAuthSession(session);
    headers.set("Authorization", `Bearer ${session.accessToken}`);
    response = await fetch(url, { ...init, headers });
  }
  return response;
}

async function responseError(response: Response): Promise<Error> {
  try {
    const body = await response.json() as { message?: string; error?: string; error_description?: string };
    return new Error(body.message ?? body.error_description ?? body.error ?? "File operation failed.");
  } catch {
    return new Error("File operation failed.");
  }
}

export async function fetchAttachments(requestId: string): Promise<Attachment[]> {
  const response = await apiClient.get<any[]>("/attachments", {
    params: {
      request_id: `eq.${requestId}`,
      order: "created_at.desc",
      select: "id,request_id,uploaded_by,uploader_name,uploader_role,original_name,storage_path,mime_type,size_bytes,created_at",
    },
  });
  return Array.isArray(response.data) ? response.data.map(mapAttachment) : [];
}

export async function uploadAttachment(requestId: string, file: File): Promise<Attachment> {
  assertSupabaseConfigured();
  const validationError = validateAttachment(file);
  if (validationError) throw new Error(validationError);

  const safeName = file.name.replace(/[\\/\p{Cc}]/gu, "_").slice(0, 180);
  const storagePath = `${requestId}/${crypto.randomUUID()}-${safeName}`;
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Sign in again before uploading a file.");

  const storageUrl = `${supabaseConfig.storageUrl}/object/attachments/${encodeStoragePath(storagePath)}`;
  const storageResponse = await authenticatedStorageFetch(storageUrl, {
    method: "POST",
    headers: {
      "Content-Type": attachmentMimeType(file),
      "x-upsert": "false",
    },
    body: file,
  });
  if (!storageResponse.ok) throw await responseError(storageResponse);

  try {
    const response = await apiClient.post<any[]>("/attachments", {
      request_id: requestId,
      storage_path: storagePath,
      original_name: safeName,
      mime_type: attachmentMimeType(file),
      size_bytes: file.size,
    }, { headers: { Prefer: "return=representation" } });
    if (!Array.isArray(response.data) || response.data.length === 0) {
      throw new Error("File details were not saved.");
    }
    return mapAttachment(response.data[0]);
  } catch (error) {
    await authenticatedStorageFetch(storageUrl, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
}

export async function downloadAttachment(storagePath: string): Promise<Blob> {
  assertSupabaseConfigured();
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Sign in again before downloading this file.");
  const response = await authenticatedStorageFetch(
    `${supabaseConfig.storageUrl}/object/authenticated/attachments/${encodeStoragePath(storagePath)}`,
    {},
  );
  if (!response.ok) throw await responseError(response);
  return response.blob();
}
