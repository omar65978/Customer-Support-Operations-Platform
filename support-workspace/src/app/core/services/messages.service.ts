import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import type { Message, UserRole } from '../models';
import { environment } from '../../../environments/environment';

export function mapMessage(m: any): Message {
  return {
    id: m.id,
    requestId: m.request_id ?? m.requestId,
    authorId: m.author_id ?? m.authorId,
    authorName: m.author_name ?? m.authorName ?? 'Support team',
    authorRole: (m.author_role ?? m.authorRole) as UserRole,
    content: m.content,
    isInternal: Boolean(m.is_internal ?? m.isInternal ?? false),
    createdAt: m.created_at ?? m.createdAt,
  };
}

@Injectable({ providedIn: 'root' })
export class MessagesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/messages`;

  /** Staff see internal notes too. Row Level Security hides them from customers. */
  getForRequest(requestId: string): Observable<Message[]> {
    return this.http
      .get<any[]>(this.base, { params: { select: '*', request_id: `eq.${requestId}`, order: 'created_at.asc' } })
      .pipe(map((rows) => (Array.isArray(rows) ? rows.map(mapMessage) : [])));
  }

  /** The author and their role are set by the database, so the browser does not send them. */
  sendMessage(requestId: string, content: string, isInternal: boolean): Observable<Message> {
    return this.http
      .post<any[] | any>(
        this.base,
        { request_id: requestId, content, is_internal: isInternal },
        { headers: new HttpHeaders({ Prefer: 'return=representation' }) }
      )
      .pipe(map((res) => mapMessage(Array.isArray(res) ? res[0] : res)));
  }
}
