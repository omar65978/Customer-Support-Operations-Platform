import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { RequestCategory, RequestPriority, RequestStatus, SupportRequest, User } from '../models';
import { ConflictError, NotFoundError } from '../utils/errors';
import { sanitizeSearch } from '../utils/search';

/** Work-queue views. "attention" = open or in-progress work that is unassigned, urgent or high. */
export type RequestView = 'all' | 'attention' | 'unassigned' | 'urgent' | 'mine';
export type SortField = 'updated_at' | 'created_at' | 'urgency_rank' | 'reference' | 'title';

export interface RequestQuery {
  view: RequestView;
  status: RequestStatus | '';
  priority: RequestPriority | '';
  category: RequestCategory | '';
  search: string;
  sortBy: SortField;
  sortDirection: 'asc' | 'desc';
}

export interface RequestPage {
  data: SupportRequest[];
  total: number;
  page: number;
  pageSize: number;
}

export const DEFAULT_REQUEST_QUERY: RequestQuery = {
  view: 'all',
  status: '',
  priority: '',
  category: '',
  search: '',
  sortBy: 'updated_at',
  sortDirection: 'desc',
};

function orderFor(query: RequestQuery): string {
  const direction = query.sortDirection;
  if (query.sortBy === 'urgency_rank') return `urgency_rank.${direction},updated_at.desc`;
  return `${query.sortBy}.${direction}`;
}

/**
 * Builds the server-side query for staff. Agents only see their own requests and unclaimed
 * ones; managers see everything. Row Level Security enforces the same rule. The conditions
 * are sent together in one `and` group, so every filter is applied on the server.
 */
export function buildStaffRequestParams(query: RequestQuery, staff: Pick<User, 'id' | 'role'>): HttpParams {
  const conditions: string[] = [];

  switch (query.view) {
    case 'attention':
      conditions.push('or(status.eq.open,status.eq.in_progress)');
      conditions.push('or(assigned_agent_id.is.null,priority.eq.urgent,priority.eq.high)');
      break;
    case 'unassigned':
      conditions.push('assigned_agent_id.is.null');
      break;
    case 'urgent':
      conditions.push('priority.eq.urgent');
      break;
    case 'mine':
      conditions.push(`assigned_agent_id.eq.${staff.id}`);
      break;
    default:
      if (staff.role === 'agent') {
        conditions.push(`or(assigned_agent_id.is.null,assigned_agent_id.eq.${staff.id})`);
      }
  }

  if (query.status) conditions.push(`status.eq.${query.status}`);
  if (query.priority) conditions.push(`priority.eq.${query.priority}`);
  if (query.category) conditions.push(`category.eq.${query.category}`);

  const term = sanitizeSearch(query.search);
  if (term) conditions.push(`or(title.ilike.*${term}*,reference.ilike.*${term}*)`);

  let params = new HttpParams().set('order', orderFor(query));
  if (conditions.length > 0) params = params.set('and', `(${conditions.join(',')})`);
  return params;
}

function totalFrom(response: HttpResponse<unknown>, fallback: number): number {
  const range = response.headers.get('content-range') ?? '';
  const match = /\/(\d+)$/.exec(range);
  return match ? Number(match[1]) : fallback;
}

export function mapRequest(r: any): SupportRequest {
  return {
    id: r.id,
    reference: r.reference,
    title: r.title,
    description: r.description,
    category: r.category,
    priority: r.priority,
    status: r.status,
    customerId: r.customer_id ?? r.customerId,
    assignedAgentId: r.assigned_agent_id ?? r.assignedAgentId ?? null,
    createdAt: r.created_at ?? r.createdAt,
    updatedAt: r.updated_at ?? r.updatedAt,
    resolvedAt: r.resolved_at ?? r.resolvedAt ?? null,
  };
}

const RETURN_REPRESENTATION = new HttpHeaders({ Prefer: 'return=representation' });

@Injectable({ providedIn: 'root' })
export class RequestsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/requests`;

  list(query: RequestQuery, staff: Pick<User, 'id' | 'role'>, page: number, pageSize: number): Observable<RequestPage> {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    return this.http
      .get<any[]>(this.base, {
        params: buildStaffRequestParams(query, staff),
        headers: { Range: `${from}-${to}`, Prefer: 'count=exact' },
        observe: 'response',
      })
      .pipe(
        map((response) => {
          const rows = Array.isArray(response.body) ? response.body : [];
          return {
            data: rows.map(mapRequest),
            total: totalFrom(response, rows.length),
            page,
            pageSize,
          };
        })
      );
  }

  /** Number of requests in a view. Reads only the count, not the rows. */
  count(query: RequestQuery, staff: Pick<User, 'id' | 'role'>): Observable<number> {
    return this.http
      .get<any[]>(this.base, {
        params: buildStaffRequestParams(query, staff),
        headers: { Range: '0-0', Prefer: 'count=exact' },
        observe: 'response',
      })
      .pipe(map((response) => totalFrom(response, 0)));
  }

  getOne(id: string): Observable<SupportRequest> {
    return this.http.get<any[]>(this.base, { params: { id: `eq.${id}`, select: '*' } }).pipe(
      map((rows) => {
        const row = Array.isArray(rows) ? rows[0] : undefined;
        if (!row) throw new NotFoundError();
        return mapRequest(row);
      })
    );
  }

  /** Takes an unassigned request. Fails with a conflict if someone else has claimed it first. */
  claim(id: string, staffId: string): Observable<SupportRequest> {
    return this.http
      .patch<any[]>(this.base, { assigned_agent_id: staffId }, {
        params: { id: `eq.${id}`, assigned_agent_id: 'is.null' },
        headers: RETURN_REPRESENTATION,
      })
      .pipe(map((rows) => this.updatedOrConflict(rows, 'Someone else has already claimed this request. Refresh to see the current owner.')));
  }

  /** Assigns or reassigns a request. Only managers can do this (enforced by the database). */
  assign(id: string, currentAgentId: string | null, nextAgentId: string): Observable<SupportRequest> {
    return this.http
      .patch<any[]>(this.base, { assigned_agent_id: nextAgentId }, {
        params: { id: `eq.${id}`, assigned_agent_id: currentAgentId ? `eq.${currentAgentId}` : 'is.null' },
        headers: RETURN_REPRESENTATION,
      })
      .pipe(map((rows) => this.updatedOrConflict(rows, 'This request was reassigned or changed while you were working on it. Refresh and try again.')));
  }

  /** Changes status only if it still has the value the screen shows. */
  updateStatus(id: string, from: RequestStatus, to: RequestStatus): Observable<SupportRequest> {
    return this.http
      .patch<any[]>(this.base, { status: to }, {
        params: { id: `eq.${id}`, status: `eq.${from}` },
        headers: RETURN_REPRESENTATION,
      })
      .pipe(map((rows) => this.updatedOrConflict(rows, 'The status changed while you were working on it. Refresh to see the latest status.')));
  }

  private updatedOrConflict(rows: any[], conflictMessage: string): SupportRequest {
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) throw new ConflictError(conflictMessage);
    return mapRequest(row);
  }
}
