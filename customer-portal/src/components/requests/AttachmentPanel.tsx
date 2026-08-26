import { useState, useRef } from "react";
import type { Attachment } from "../../types";
import { uploadAttachment, getDownloadUrl } from "../../api/attachments";
import { Spinner } from "../ui/Spinner";

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".txt", ".csv", ".doc", ".docx", ".xls", ".xlsx"];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <span aria-hidden="true">🖼️</span>;
  if (mimeType === "application/pdf") return <span aria-hidden="true">📄</span>;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <span aria-hidden="true">📊</span>;
  if (mimeType.includes("word") || mimeType.includes("document")) return <span aria-hidden="true">📝</span>;
  return <span aria-hidden="true">📎</span>;
}

interface AttachmentPanelProps {
  requestId: string;
  attachments: Attachment[];
  canUpload: boolean;
  onUploaded: (attachment: Attachment) => void;
  token: string;
}

export function AttachmentPanel({ requestId, attachments, canUpload, onUploaded, token }: AttachmentPanelProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";

    if (!file) return;

    if (file.size > MAX_SIZE_BYTES) {
      setUploadError(`File exceeds the ${MAX_SIZE_MB} MB limit.`);
      return;
    }

    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setUploadError(`File type not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(", ")}`);
      return;
    }

    setUploadError("");
    setIsUploading(true);
    try {
      const attachment = await uploadAttachment(requestId, file);
      onUploaded(attachment);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      setUploadError(msg || "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-700">
          Attachments {attachments.length > 0 && <span className="text-slate-400 font-normal">({attachments.length})</span>}
        </h3>
        {canUpload && (
          <label
            htmlFor="file-upload"
            className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors ${isUploading ? "opacity-60 pointer-events-none" : ""}`}
          >
            {isUploading ? <Spinner size="sm" /> : (
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            {isUploading ? "Uploading…" : "Attach File"}
            <input
              id="file-upload"
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept={ALLOWED_EXTENSIONS.join(",")}
              onChange={handleFileChange}
              disabled={isUploading}
              aria-label="Upload attachment"
            />
          </label>
        )}
      </div>

      {uploadError && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 border border-red-100" role="alert">
          {uploadError}
        </p>
      )}

      {attachments.length === 0 ? (
        <p className="text-xs text-slate-400">No attachments yet.</p>
      ) : (
        <ul className="space-y-1.5" aria-label="Attachments">
          {attachments.map((att) => (
            <li key={att.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <FileIcon mimeType={att.mimeType} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{att.originalName}</p>
                <p className="text-xs text-slate-400">{formatBytes(att.size)} · {att.uploaderName}</p>
              </div>
              <a
                href={`${getDownloadUrl(att.id)}?token=${token}`}
                download={att.originalName}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium shrink-0"
                aria-label={`Download ${att.originalName}`}
              >
                Download
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
