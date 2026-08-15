import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { SupportRequest, RequestStatus } from '../models';
import { environment } from '../../../environments/environment';

export interface RequestFilters {
  status?: RequestStatus | '';
  priority?: string;
  category?: string;
  assignedAgentId?: string;
  q?: string;
}

@Injectable({ providedIn: 'root' })
export class RequestsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/requests`;

  getAll(filters: RequestFilters = {}): Observable<SupportRequest[]> {
    let params = new HttpParams();
    if (filters.status) params = params.set('status', filters.status);
    if (filters.priority) params = params.set('priority', filters.priority);
    if (filters.category) params = params.set('category', filters.category);
    if (filters.assignedAgentId) params = params.set('assignedAgentId', filters.assignedAgentId);
    if (filters.q) params = params.set('q', filters.q);
    return this.http.get<SupportRequest[]>(this.base, { params });
  }

  getOne(id: string): Observable<SupportRequest> {
    return this.http.get<SupportRequest>(`${this.base}/${id}`);
  }

  updateStatus(id: string, status: RequestStatus): Observable<SupportRequest> {
    const patch: Partial<SupportRequest> = {
      status,
      updatedAt: new Date().toISOString(),
      resolvedAt: status === 'resolved' ? new Date().toISOString() : undefined,
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
}
