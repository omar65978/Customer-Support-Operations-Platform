import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { Message } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MessagesService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getForRequest(requestId: string): Observable<Message[]> {
    return this.http.get<Message[]>(`${this.base}/messages?requestId=${requestId}`);
  }

  sendMessage(
    requestId: string,
    content: string,
    isInternal: boolean
  ): Observable<Message> {
    return this.http.post<Message>(`${this.base}/requests/${requestId}/messages`, {
      content,
      isInternal,
    });
  }
}