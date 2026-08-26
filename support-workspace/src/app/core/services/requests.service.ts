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

    if (!isManager && agentId) {
      params = params.set('assignedAgentId', agentId);
    }

    if (filters.status) params = params.set('status', filters.status);
    if (filters.priority) params = params.set('priority', filters.priority);
    if (filters.category) params = params.set('category', filters.category);
    if (filters.q) params = params.set('_q', filters.q);

    params = params.set('_sort', 'updatedAt');
    params = params.set('_order', 'desc');
    params = params.set('_page', String(page));
    params = params.set('_limit', String(pageSize));

    return this.http.get<SupportRequest[]>(this.base, { params, observe: 'response' }).pipe(
      map((response: HttpResponse<SupportRequest[]>) => {
        const total = parseInt(response.headers.get('x-total-count') || '0', 10);
        const data = response.body ?? [];
        return { data, total, page, pageSize };
      })
    );
  }

  getOne(id: string): Observable<SupportRequest> {
    return this.http.get<SupportRequest>(`${this.base}/${id}`);
  }

  updateStatus(id: string, status: RequestStatus): Observable<SupportRequest> {
    const patch: Partial<SupportRequest> & { resolvedAt?: string | null } = {
      status,
      updatedAt: new Date().toISOString(),
      resolvedAt: status === 'resolved' ? new Date().toISOString() : null,
    };
    return this.http.patch<SupportRequest>(`${this.base}/${id}`, patch);
  }

  assign(id: string, agentId: string | null): Observable<SupportRequest> {
    return this.http.patch<SupportRequest>(`${this.base}/${id}`, {
      assignedAgentId: agentId,
      status: agentId ? 'in_progress' : 'open',
      updatedAt: new Date().toISOString(),
    });
  }

  close(id: string): Observable<SupportRequest> {
    return this.http.patch<SupportRequest>(`${this.base}/${id}`, {
      status: 'closed',
      updatedAt: new Date().toISOString(),
    });
  }

  getAllAgentsForLookup(): Observable<User[]> {
    return this.http.get<User[]>(`${environment.apiUrl}/users?role=agent`).pipe(
      map((users) => (Array.isArray(users) ? users.filter((u) => u.role === 'agent') : []))
    );
  }
}