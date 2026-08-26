import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Attachment {
  id: string;
  requestId: string;
  uploadedBy: string;
  uploaderName: string;
  uploaderRole: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface WorkspaceStats {
  open: number;
  inProgress: number;
  waitingForCustomer: number;
  resolved: number;
  closed: number;
  unassigned: number;
  urgent: number;
  total: number;
  active: number;
  recentActivity: {
    id: string;
    requestId: string;
    authorName: string;
    authorRole: string;
    contentPreview: string;
    createdAt: string;
  }[];
}

@Injectable({ providedIn: 'root' })
export class AttachmentsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getForRequest(requestId: string): Observable<Attachment[]> {
    return this.http.get<Attachment[]>(`${this.base}/requests/${requestId}/attachments`);
  }

  upload(requestId: string, file: File): Observable<Attachment> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<Attachment>(`${this.base}/requests/${requestId}/attachments`, form);
  }

  getDownloadUrl(attachmentId: string): string {
    return `${this.base}/attachments/${attachmentId}/download`;
  }

  getStats(): Observable<WorkspaceStats> {
    return this.http.get<WorkspaceStats>(`${this.base}/stats`);
  }
}
