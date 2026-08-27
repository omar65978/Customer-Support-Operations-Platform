import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import type { Message } from '../models';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class MessagesService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private base = `${environment.apiUrl}/messages`;

  getForRequest(requestId: string): Observable<Message[]> {
    // استخدام صيغة فلتر Supabase الصحيحة واسم العمود بالـ snake_case
    return this.http.get<Message[]>(`${this.base}?request_id=eq.${requestId}`);
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

    return this.http.post<Message[] | Message>(this.base, payload, {
      headers: { 'Prefer': 'return=representation' }
    }).pipe(
      map(res => (Array.isArray(res) ? res[0] : res))
    );
  }
}