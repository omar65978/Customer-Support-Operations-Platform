/** Accepted extensions and the content type stored for each. Keep in sync with the database rules. */
export const ATTACHMENT_TYPES: Readonly<Record<string, string>> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export const ATTACHMENT_EXTENSIONS = Object.keys(ATTACHMENT_TYPES);
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export function attachmentTypeFor(fileName: string): { extension: string; mimeType: string } | null {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0) return null;
  const extension = fileName.slice(dot).toLowerCase();
  const mimeType = ATTACHMENT_TYPES[extension];
  return mimeType ? { extension, mimeType } : null;
}

/** Returns a message for the user when the file is refused, or null when it is accepted. */
export function validateAttachmentFile(file: { name: string; size: number }): string | null {
  if (!attachmentTypeFor(file.name)) {
    return `This file type is not accepted. Allowed types: ${ATTACHMENT_EXTENSIONS.join(', ')}.`;
  }
  if (file.size <= 0) return 'This file is empty.';
  if (file.size > ATTACHMENT_MAX_BYTES) return 'This file is larger than the 10 MB limit.';
  return null;
}
