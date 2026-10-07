import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
import type { SupportRequest, RequestStatus, User } from '../models';
import { environment } from '../../../environments/environment';

export interface RequestFilters {
  status?: RequestStatus | '';
  priority?: string;
  category?: string;
  q?: string;
}

export type RequestSortField = 'reference' | 'title' | 'category' | 'priority' | 'status' | 'updated_at' | 'created_at';
export type RequestSortDirection = 'asc' | 'desc';

export interface RequestPage {
  data: SupportRequest[];
  total: number;
  page: number;
  pageSize: number;
}

function mapRequest(request: any): SupportRequest {
  return {
    id: request.id,
    reference: request.reference,
    title: request.title,
    description: request.description,
    category: request.category,
    priority: request.priority,
    status: request.status,
    customerId: request.customer_id ?? request.customerId,
    assignedAgentId: request.assigned_agent_id ?? request.assignedAgentId,
    createdAt: request.created_at ?? request.createdAt,
    updatedAt: request.updated_at ?? request.updatedAt,
    resolvedAt: request.resolved_at ?? request.resolvedAt,
  };
}

function mapProfile(profile: any): User {
  return {
    id: profile.id,
    email: profile.email ?? '',
    name: profile.full_name ?? profile.name ?? 'Support agent',
    role: profile.role,
  };
}

function returnedRequest(rows: any[]): SupportRequest {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('The request was changed by another user or you do not have permission.');
  }
  return mapRequest(rows[0]);
}

function safeSearchTerm(term: string): string {
  return term.trim().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
}

@Injectable({ providedIn: 'root' })
export class RequestsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/requests`;
  private patchHeaders = { Prefer: 'return=representation' };

  getAll(
    filters: RequestFilters = {},
    agentId?: string,
    isManager = false,
    page = 1,
    pageSize = 10,
    sortField: RequestSortField = 'updated_at',
    sortDirection: RequestSortDirection = 'desc',
  ): Observable<RequestPage> {
    let params = new HttpParams().set('select', '*');
    params = params.set('order', `${sortField}.${sortDirection}`);

    const safePage = Math.max(1, Math.floor(Number.isFinite(page) ? page : 1));
    const safePageSize = Math.min(50, Math.max(1, Math.floor(Number.isFinite(pageSize) ? pageSize : 10)));
    const start = (safePage - 1) * safePageSize;
    const end = start + safePageSize - 1;

    const disjunctions: string[] = [];
    if (!isManager && agentId) {
      disjunctions.push(`or(assigned_agent_id.eq.${agentId},and(assigned_agent_id.is.null,status.in.(open,in_progress,waiting_for_customer)))`);
    }
    if (filters.status) params = params.set('status', `eq.${filters.status}`);
    if (filters.priority) params = params.set('priority', `eq.${filters.priority}`);
    if (filters.category) params = params.set('category', `eq.${filters.category}`);
    const query = safeSearchTerm(filters.q ?? '');
    if (query) disjunctions.push(`or(title.ilike.*${query}*,description.ilike.*${query}*,reference.ilike.*${query}*)`);
    if (disjunctions.length === 1) params = params.set('or', disjunctions[0].slice(2));
    if (disjunctions.length > 1) params = params.set('and', `(${disjunctions.join(',')})`);

    const headers = {
      Prefer: 'count=exact',
      Range: `${start}-${end}`,
    };

    return this.http.get<any[]>(this.base, { params, headers, observe: 'response' }).pipe(
      map((response: HttpResponse<any[]>) => {
        const count = response.headers.get('content-range')?.split('/')[1];
        const parsedCount = count && count !== '*' ? Number.parseInt(count, 10) : 0;
        return {
          data: (response.body ?? []).map(mapRequest),
          total: Number.isFinite(parsedCount) ? parsedCount : 0,
          page: safePage,
          pageSize: safePageSize,
        };
      }),
    );
  }

  getOne(id: string): Observable<SupportRequest> {
    return this.http.get<any[]>(this.base, {
      params: { id: `eq.${id}`, select: '*', limit: '1' },
    }).pipe(
      map((rows) => {
        if (!Array.isArray(rows) || rows.length === 0) throw new Error('Request not found or access denied.');
        return mapRequest(rows[0]);
      }),
    );
  }

  updateStatus(id: string, status: RequestStatus): Observable<SupportRequest> {
    return this.http.patch<any[]>(this.base, { status }, {
      params: { id: `eq.${id}` },
      headers: this.patchHeaders,
    }).pipe(map(returnedRequest));
  }

  assign(id: string, agentId: string, isManager = false, availableStatus: RequestStatus = 'open'): Observable<SupportRequest> {
    const params: Record<string, string> = { id: `eq.${id}` };
    const body: Record<string, string> = { assigned_agent_id: agentId };
    if (!isManager) {
      if (!['open', 'in_progress', 'waiting_for_customer'].includes(availableStatus)) {
        return throwError(() => new Error('This request is not available to claim.'));
      }
      params['assigned_agent_id'] = 'is.null';
      params['status'] = `eq.${availableStatus}`;
      body['status'] = availableStatus === 'open' ? 'in_progress' : availableStatus;
    }
    return this.http.patch<any[]>(this.base, body, {
      params,
      headers: this.patchHeaders,
    }).pipe(map(returnedRequest));
  }

  close(id: string): Observable<SupportRequest> {
    return this.updateStatus(id, 'closed');
  }

  reopen(id: string): Observable<SupportRequest> {
    return this.updateStatus(id, 'in_progress');
  }

  getAllAgentsForLookup(): Observable<User[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/profiles`, {
      params: { role: 'eq.agent', select: 'id,full_name,role', order: 'full_name.asc' },
    }).pipe(map((profiles) => (Array.isArray(profiles) ? profiles.map(mapProfile) : [])));
  }
}
