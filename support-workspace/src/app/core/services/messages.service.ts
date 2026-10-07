import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import type { Message } from '../models';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

function mapMessage(m: any): Message {
  if (!m) return m;
  return {
    id: m.id,
    requestId: m.request_id ?? m.requestId,
    authorId: m.author_id ?? m.authorId,
    authorName: m.author_name ?? m.authorName,
    authorRole: m.author_role ?? m.authorRole,
    content: m.content,
    isInternal: m.is_internal ?? m.isInternal ?? false,
    createdAt: m.created_at ?? m.createdAt,
  };
}

@Injectable({ providedIn: 'root' })
export class MessagesService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private base = `${environment.apiUrl}/messages`;

  getForRequest(requestId: string): Observable<Message[]> {
    return this.http.get<any[]>(`${this.base}?request_id=eq.${requestId}&order=created_at.asc`).pipe(
      map(msgs => (Array.isArray(msgs) ? msgs.map(mapMessage) : []))
    );
  }

  sendMessage(
    requestId: string,
    content: string,
    isInternal: boolean
  ): Observable<Message> {
    const user = this.authService.currentUser;

    const payload = {
      request_id: requestId,
      content,
      is_internal: isInternal,
      author_id: user?.id ?? null,
      author_name: user?.name ?? 'Support User',
      author_role: user?.role ?? 'agent'
    };

    return this.http.post<any[] | any>(this.base, payload, {
      headers: { 'Prefer': 'return=representation' }
    }).pipe(
      map(res => mapMessage(Array.isArray(res) ? res[0] : res))
    );
  }
}