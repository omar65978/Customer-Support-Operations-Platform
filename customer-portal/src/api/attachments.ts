import apiClient from "./axios";
import type { Attachment } from "../types";

const SUPABASE_URL = "https://iaukydzbcdmglqajllei.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhdWt5ZHpiY2RtZ2xxYWpsbGVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNjQzMzIsImV4cCI6MjEwMjg0MDMzMn0.GxvoOvmGBpVUOeRC2G3nN3POzX02KGD33hmh7joN_dc";

export async function fetchAttachments(requestId: string): Promise<Attachment[]> {
  const response = await apiClient.get<any[]>(
    `/attachments?request_id=eq.${requestId}&order=created_at.desc`
  );
  const data = Array.isArray(response.data) ? response.data : [];
  return data.map((a) => ({
    ...a,
    requestId: a.request_id ?? a.requestId,
    uploadedBy: a.uploaded_by ?? a.uploadedBy,
    uploaderName: a.uploader_name ?? a.uploaderName,
    uploaderRole: a.uploader_role ?? a.uploaderRole,
    originalName: a.original_name ?? a.originalName,
    storedName: a.stored_name ?? a.storedName,
    mimeType: a.mime_type ?? a.mimeType,
    createdAt: a.created_at ?? a.createdAt,
  }));
}

export async function uploadAttachment(requestId: string, file: File): Promise<Attachment> {
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;
  const storedName = `${crypto.randomUUID()}-${file.name}`;
  const token = localStorage.getItem("token");

  const storageRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/attachments/${storedName}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: file,
    }
  );

  if (!storageRes.ok) {
    throw new Error("File upload failed");
  }

  const metadata = {
    request_id: requestId,
    uploaded_by: user?.id || "",
    uploader_name: user?.name || "Customer",
    uploader_role: user?.role || "customer",
    original_name: file.name,
    stored_name: storedName,
    mime_type: file.type || "application/octet-stream",
    size: file.size,
  };

  const response = await apiClient.post<any[]>("/attachments", metadata, {
    headers: { Prefer: "return=representation" },
  });

  const a = response.data[0];
  return {
    ...a,
    requestId: a.request_id ?? a.requestId,
    uploadedBy: a.uploaded_by ?? a.uploadedBy,
    uploaderName: a.uploader_name ?? a.uploaderName,
    uploaderRole: a.uploader_role ?? a.uploaderRole,
    originalName: a.original_name ?? a.originalName,
    storedName: a.stored_name ?? a.storedName,
    mimeType: a.mime_type ?? a.mimeType,
    createdAt: a.created_at ?? a.createdAt,
  };
}

export function getDownloadUrl(storedName: string): string {
  return `${SUPABASE_URL}/storage/v1/object/authenticated/attachments/${storedName}`;
}