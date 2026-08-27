import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import type { SupportRequest, RequestStatus, User } from '../models';
import { environment } from '../../../environments/environment';

export interface RequestFilters {
  status?: RequestStatus | '';
  priority?: string;
  category?: string;
  q?: string;
}

export interface RequestPage {
  data: SupportRequest[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class RequestsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/requests`;

  getAll(filters: RequestFilters = {}, agentId?: string, isManager = false, page = 1, pageSize = 10): Observable<RequestPage> {
    let params = new HttpParams();

    params = params.set('order', 'updated_at.desc');

    if (!isManager && agentId) {
      params = params.set('assigned_agent_id', `eq.${agentId}`);
    }

    if (filters.status) params = params.set('status', `eq.${filters.status}`);
    if (filters.priority) params = params.set('priority', `eq.${filters.priority}`);
    if (filters.category) params = params.set('category', `eq.${filters.category}`);
    if (filters.q) params = params.set('reference', `ilike.*${filters.q}*`);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    return this.http.get<SupportRequest[]>(this.base, {
      params,
      observe: 'response',
      headers: {
        'Prefer': 'count=exact',
        'Range': `${from}-${to}`
      }
    }).pipe(
      map((response: HttpResponse<SupportRequest[]>) => {
        const contentRange = response.headers.get('content-range');
        let total = 0;
        if (contentRange) {
          const parts = contentRange.split('/');
          if (parts[1]) total = parseInt(parts[1], 10);
        }
        const data = response.body ?? [];
        return { data, total, page, pageSize };
      })
    );
  }

  getOne(id: string): Observable<SupportRequest> {
    return this.http.get<SupportRequest[]>(`${this.base}?id=eq.${id}`).pipe(
      map((requests) => requests[0])
    );
  }

  updateStatus(id: string, status: RequestStatus): Observable<SupportRequest> {
    const patch = {
      status,
      updated_at: new Date().toISOString(),
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
    };
    return this.http.patch<SupportRequest[]>(`${this.base}?id=eq.${id}`, patch, {
      headers: { 'Prefer': 'return=representation' }
    }).pipe(map((res) => res[0]));
  }

  assign(id: string, agentId: string | null): Observable<SupportRequest> {
    return this.http.patch<SupportRequest[]>(`${this.base}?id=eq.${id}`, {
      assigned_agent_id: agentId,
      status: agentId ? 'in_progress' : 'open',
      updated_at: new Date().toISOString(),
    }, {
      headers: { 'Prefer': 'return=representation' }
    }).pipe(map((res) => res[0]));
  }

  close(id: string): Observable<SupportRequest> {
    return this.http.patch<SupportRequest[]>(`${this.base}?id=eq.${id}`, {
      status: 'closed',
      updated_at: new Date().toISOString(),
    }, {
      headers: { 'Prefer': 'return=representation' }
    }).pipe(map((res) => res[0]));
  }

  getAllAgentsForLookup(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/users?role=eq.agent`).pipe(
      map((users) => (Array.isArray(users) ? users : []))
    );
  }
}