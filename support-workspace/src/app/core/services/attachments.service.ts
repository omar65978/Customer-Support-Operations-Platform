import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Attachment, UserRole } from '../models';
import { attachmentTypeFor, validateAttachmentFile } from '../utils/attachments';
import { ValidationError } from '../utils/errors';

function mapAttachment(a: any): Attachment {
  return {
    id: a.id,
    requestId: a.request_id ?? a.requestId,
    uploadedBy: a.uploaded_by ?? a.uploadedBy,
    uploaderName: a.uploader_name ?? a.uploaderName ?? 'Support team',
    uploaderRole: (a.uploader_role ?? a.uploaderRole) as UserRole,
    originalName: a.original_name ?? a.originalName,
    storedName: a.stored_name ?? a.storedName,
    mimeType: a.mime_type ?? a.mimeType,
    size: Number(a.size),
    createdAt: a.created_at ?? a.createdAt,
  };
}

function newObjectId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Saves a downloaded file. The object URL is released shortly after the click. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

@Injectable({ providedIn: 'root' })
export class AttachmentsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/attachments`;

  list(requestId: string): Observable<Attachment[]> {
    return this.http
      .get<any[]>(this.base, { params: { select: '*', request_id: `eq.${requestId}`, order: 'created_at.asc' } })
      .pipe(map((rows) => (Array.isArray(rows) ? rows.map(mapAttachment) : [])));
  }

  /**
   * Stores the file in the private bucket, then records its metadata. The storage path starts
   * with the request id, which the database checks. The uploader is set by the database.
   */
  upload(requestId: string, file: File): Observable<Attachment> {
    const problem = validateAttachmentFile(file);
    if (problem) return throwError(() => new ValidationError(problem));
    const type = attachmentTypeFor(file.name)!;
    const storedName = `${requestId}/${newObjectId()}${type.extension}`;

    return this.http
      .post(`${environment.supabaseUrl}/storage/v1/object/attachments/${storedName}`, file, {
        headers: new HttpHeaders({ 'Content-Type': type.mimeType, 'x-upsert': 'false' }),
      })
      .pipe(
        switchMap(() =>
          this.http.post<any[]>(
            this.base,
            {
              request_id: requestId,
              original_name: file.name.slice(0, 200),
              stored_name: storedName,
              mime_type: type.mimeType,
              size: file.size,
            },
            { headers: new HttpHeaders({ Prefer: 'return=representation' }) }
          )
        ),
        map((rows) => mapAttachment(Array.isArray(rows) ? rows[0] : rows))
      );
  }

  /** Downloads through the authenticated endpoint, so the token is sent in a header, not in the URL. */
  download(attachment: Attachment): Observable<void> {
    return this.http
      .get(`${environment.supabaseUrl}/storage/v1/object/authenticated/attachments/${attachment.storedName}`, {
        responseType: 'blob',
      })
      .pipe(map((blob) => saveBlob(blob, attachment.originalName)));
  }
}
