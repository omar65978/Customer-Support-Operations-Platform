import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, from, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { Attachment } from '../models';
import { AuthService } from './auth.service';

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

function encodeStoragePath(storagePath: string): string {
  return storagePath.split('/').map(encodeURIComponent).join('/');
}

function mapAttachment(attachment: any): Attachment {
  return {
    id: attachment.id,
    requestId: attachment.request_id ?? attachment.requestId,
    uploadedBy: attachment.uploaded_by ?? attachment.uploadedBy,
    uploaderName: attachment.uploader_name ?? attachment.uploaderName,
    uploaderRole: attachment.uploader_role ?? attachment.uploaderRole,
    originalName: attachment.original_name ?? attachment.originalName,
    storagePath: attachment.storage_path ?? attachment.storagePath,
    mimeType: attachment.mime_type ?? attachment.mimeType,
    size: attachment.size_bytes ?? attachment.size,
    createdAt: attachment.created_at ?? attachment.createdAt,
  };
}

async function responseError(response: Response): Promise<Error> {
  try {
    const body = await response.json() as { message?: string; error?: string; error_description?: string };
    return new Error(body.message ?? body.error_description ?? body.error ?? 'File operation failed.');
  } catch {
    return new Error('File operation failed.');
  }
}

@Injectable({ providedIn: 'root' })
export class AttachmentsService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private async storageRequest(url: string, init: RequestInit): Promise<Response> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Sign in again to access this file.');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('apikey', environment.supabaseAnonKey);
    let response = await fetch(url, { ...init, headers });
    const refreshToken = localStorage.getItem('refresh_token');
    if (response.status === 401 && refreshToken) {
      const session = await firstValueFrom(this.authService.refreshSession());
      headers.set('Authorization', `Bearer ${session.accessToken}`);
      response = await fetch(url, { ...init, headers });
    }
    return response;
  }

  getForRequest(requestId: string): Observable<Attachment[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/attachments`, {
      params: {
        request_id: `eq.${requestId}`,
        order: 'created_at.desc',
        select: 'id,request_id,uploaded_by,uploader_name,uploader_role,original_name,storage_path,mime_type,size_bytes,created_at',
      },
    }).pipe(map((rows) => (Array.isArray(rows) ? rows.map(mapAttachment) : [])));
  }

  upload(requestId: string, file: File): Observable<Attachment> {
    return from(this.uploadFile(requestId, file));
  }

  private async uploadFile(requestId: string, file: File): Promise<Attachment> {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = file.type || MIME_BY_EXTENSION[extension] || '';
    if (file.size < 1 || file.size > MAX_ATTACHMENT_SIZE || !MIME_BY_EXTENSION[extension]
      || (file.type && !Object.values(MIME_BY_EXTENSION).includes(file.type))) {
      throw new Error('Choose a permitted file type smaller than 10 MB.');
    }

    const token = localStorage.getItem('token');
    if (!token) throw new Error('Sign in again before uploading a file.');
    const safeName = file.name.replace(/[\\/\p{Cc}]/gu, '_').slice(0, 180);
    const storagePath = `${requestId}/${crypto.randomUUID()}-${safeName}`;
    const storageUrl = `${environment.supabaseUrl}/storage/v1/object/attachments/${encodeStoragePath(storagePath)}`;
    const storageResponse = await this.storageRequest(storageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': mimeType,
        'x-upsert': 'false',
      },
      body: file,
    });
    if (!storageResponse.ok) throw await responseError(storageResponse);

    try {
      const rows = await firstValueFrom(this.http.post<any[]>(`${environment.apiUrl}/attachments`, {
        request_id: requestId,
        storage_path: storagePath,
        original_name: safeName,
        mime_type: mimeType,
        size_bytes: file.size,
      }, { headers: { Prefer: 'return=representation' } }));
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('File details were not saved.');
      return mapAttachment(rows[0]);
    } catch (error) {
      await this.storageRequest(storageUrl, { method: 'DELETE' }).catch(() => undefined);
      throw error;
    }
  }

  download(storagePath: string): Observable<Blob> {
    return from(this.downloadFile(storagePath));
  }

  private async downloadFile(storagePath: string): Promise<Blob> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Sign in again before downloading this file.');
    const response = await this.storageRequest(
      `${environment.supabaseUrl}/storage/v1/object/authenticated/attachments/${encodeStoragePath(storagePath)}`,
      {},
    );
    if (!response.ok) throw await responseError(response);
    return response.blob();
  }
}
