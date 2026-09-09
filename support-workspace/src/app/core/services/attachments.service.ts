import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Attachment {
  id: string;
  request_id: string;
  uploaded_by: string;
  uploader_name: string;
  uploader_role: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size: number;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class AttachmentsService {
  private http = inject(HttpClient);

  getForRequest(requestId: string): Observable<Attachment[]> {
    return this.http.get<Attachment[]>(
      `${environment.apiUrl}/attachments?request_id=eq.${requestId}&order=created_at.desc`
    );
  }

  upload(requestId: string, file: File): Observable<Attachment> {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const storedName = `${crypto.randomUUID()}-${file.name}`;

    return new Observable(subscriber => {
      const storageUrl = `${environment.supabaseUrl}/storage/v1/object/attachments/${storedName}`;
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token || environment.supabaseAnonKey}`,
        'apikey': environment.supabaseAnonKey
      };

      fetch(storageUrl, { method: 'POST', headers, body: file })
        .then(res => {
          if (!res.ok) throw new Error('Upload failed');
          return res.json();
        })
        .then(() => {
          const metadata = {
            request_id: requestId,
            uploaded_by: user.id || '',
            uploader_name: user.name || 'Unknown',
            uploader_role: user.role || 'agent',
            original_name: file.name,
            stored_name: storedName,
            mime_type: file.type || 'application/octet-stream',
            size: file.size
          };

          this.http.post<Attachment[]>(
            `${environment.apiUrl}/attachments`,
            metadata,
            { headers: { 'Prefer': 'return=representation' } }
          ).pipe(
            map(res => Array.isArray(res) ? res[0] : res)
          ).subscribe({
            next: att => { subscriber.next(att); subscriber.complete(); },
            error: err => subscriber.error(err)
          });
        })
        .catch(err => subscriber.error(err));
    });
  }

  getDownloadUrl(storedName: string): string {
    return `${environment.supabaseUrl}/storage/v1/object/authenticated/attachments/${storedName}`;
  }
}
