import { useState, useRef, type ChangeEvent } from "react";
import type { Attachment } from "../../types";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_EXTENSIONS,
  ATTACHMENT_MAX_BYTES,
  downloadAttachment,
  uploadAttachment,
  validateAttachmentFile,
} from "../../api/attachments";
import { describeApiError } from "../../api/errors";
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
  onUploaded: (attachment: Attachment) => void;
}

export function AttachmentPanel({ requestId, attachments, canUpload, onUploaded }: AttachmentPanelProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset the input so the same file can be chosen again after an error.
    event.target.value = "";
    if (!file) return;

    const problem = validateAttachmentFile(file);
    if (problem) {
      setStatus("");
      setError(problem);
      return;
    }

    setError("");
    setStatus("");
    setIsUploading(true);
    try {
      const attachment = await uploadAttachment(requestId, file);
      onUploaded(attachment);
      setStatus(`${file.name} was attached.`);
    } catch (err) {
      setError(describeApiError(err, "The file could not be uploaded. It was not attached. Please try again."));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownload(attachment: Attachment) {
    setError("");
    setStatus("");
    setDownloadingId(attachment.id);
    try {
      await downloadAttachment(attachment);
    } catch (err) {
      setError(describeApiError(err, `${attachment.originalName} could not be downloaded. Please try again.`));
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <section aria-labelledby="attachments-heading" className="mt-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 id="attachments-heading" className="text-sm font-semibold text-slate-700">
          Attachments {attachments.length > 0 && <span className="font-normal text-slate-400">({attachments.length})</span>}
        </h3>
        {canUpload && (
          <label
            htmlFor="file-upload"
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-within:ring-2 focus-within:ring-brand-400 ${
              isUploading ? "pointer-events-none opacity-60" : ""
            }`}
          >
            {isUploading ? <Spinner size="sm" /> : (
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            {isUploading ? "Uploading…" : "Attach file"}
            <input
              id="file-upload"
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept={ATTACHMENT_ACCEPT}
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </label>
        )}
      </div>

      <p className="mb-2 text-xs text-slate-400">
        {ATTACHMENT_EXTENSIONS.join(", ")} · up to {formatBytes(ATTACHMENT_MAX_BYTES)} per file
      </p>

      <div aria-live="polite" className="sr-only">{status}</div>
      {error && (
        <p className="mb-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}

      {attachments.length === 0 ? (
        <p className="text-xs text-slate-400">No attachments yet.</p>
      ) : (
        <ul className="space-y-1.5" aria-label="Attachments">
          {attachments.map((att) => (
            <li key={att.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <FileIcon mimeType={att.mimeType} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-700" title={att.originalName}>{att.originalName}</p>
                <p className="text-xs text-slate-400">
                  {formatBytes(att.size)} · {att.uploaderName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleDownload(att)}
                disabled={downloadingId === att.id}
                className="shrink-0 rounded text-xs font-medium text-brand-600 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50"
                aria-label={`Download ${att.originalName}`}
              >
                {downloadingId === att.id ? "Downloading…" : "Download"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
