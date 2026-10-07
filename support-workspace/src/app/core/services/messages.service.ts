import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import type { Message, UserRole } from '../models';
import { environment } from '../../../environments/environment';

function mapMessage(message: any): Message {
  return {
    id: message.id,
    requestId: message.request_id ?? message.requestId,
    authorId: message.author_id ?? message.authorId,
    authorName: message.author_name ?? message.authorName,
    authorRole: (message.author_role ?? message.authorRole) as UserRole,
    content: message.content,
    isInternal: message.is_internal ?? message.isInternal ?? false,
    createdAt: message.created_at ?? message.createdAt,
  };
}

@Injectable({ providedIn: 'root' })
export class MessagesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/messages`;

  getForRequest(requestId: string): Observable<Message[]> {
    return this.http.get<any[]>(this.base, {
      params: {
        request_id: `eq.${requestId}`,
        order: 'created_at.asc',
        select: 'id,request_id,author_id,author_name,author_role,content,is_internal,created_at',
      },
    }).pipe(map((messages) => (Array.isArray(messages) ? messages.map(mapMessage) : [])));
  }

  sendMessage(requestId: string, content: string, isInternal: boolean): Observable<Message> {
    return this.http.post<any[]>(this.base, {
      request_id: requestId,
      content: content.trim(),
      is_internal: isInternal,
    }, {
      headers: { Prefer: 'return=representation' },
    }).pipe(map((rows) => {
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('Message was not saved. Please retry.');
      return mapMessage(rows[0]);
    }));
  }
}
