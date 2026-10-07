import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { Attachment } from "../../types";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  downloadAttachment,
  uploadAttachment,
  validateAttachment,
} from "../../api/attachments";
import { Spinner } from "../ui/Spinner";

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
  isLoading: boolean;
  loadError: string;
  onRetry: () => void;
  onUploaded: (attachment: Attachment) => void;
}

export function AttachmentPanel({
  requestId,
  attachments,
  canUpload,
  isLoading,
  loadError,
  onRetry,
  onUploaded,
}: AttachmentPanelProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    const validationError = validateAttachment(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploadError("");
    setIsUploading(true);
    try {
      const attachment = await uploadAttachment(requestId, file);
      onUploaded(attachment);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownload(attachment: Attachment) {
    setDownloadError("");
    setDownloadingId(attachment.id);
    try {
      const blob = await downloadAttachment(attachment.storagePath);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = attachment.originalName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Download failed. Please try again.");
    } finally {
      setDownloadingId("");
    }
  }

  return (
    <section className="mt-4" aria-labelledby="attachments-heading">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 id="attachments-heading" className="text-sm font-semibold text-slate-700">
          Attachments {attachments.length > 0 && <span className="font-normal text-slate-400">({attachments.length})</span>}
        </h3>
        {canUpload && (
          <label
            htmlFor="file-upload"
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 ${isUploading ? "pointer-events-none opacity-60" : ""}`}
          >
            {isUploading ? <Spinner size="sm" /> : <span aria-hidden="true">↑</span>}
            {isUploading ? "Uploading…" : "Attach File"}
            <input
              id="file-upload"
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept={ALLOWED_ATTACHMENT_EXTENSIONS.join(",")}
              onChange={handleFileChange}
              disabled={isUploading}
              aria-label="Upload attachment"
            />
          </label>
        )}
      </div>

      {uploadError && <p className="mb-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">{uploadError}</p>}
      {downloadError && <p className="mb-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">{downloadError}</p>}
      {isLoading && <div className="py-2"><Spinner size="sm" /></div>}
      {loadError && (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
          <span>{loadError}</span>
          <button type="button" onClick={onRetry} className="font-semibold underline">Retry</button>
        </div>
      )}
      {!isLoading && !loadError && attachments.length === 0 && (
        <p className="text-xs text-slate-400">No attachments yet.</p>
      )}
      {!loadError && attachments.length > 0 && (
        <ul className="space-y-1.5" aria-label="Attachments">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <FileIcon mimeType={attachment.mimeType} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-700">{attachment.originalName}</p>
                <p className="text-xs text-slate-400">{formatBytes(attachment.size)} · {attachment.uploaderName}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDownload(attachment)}
                disabled={Boolean(downloadingId)}
                className="shrink-0 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-60"
                aria-label={`Download ${attachment.originalName}`}
              >
                {downloadingId === attachment.id ? "Downloading…" : "Download"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
