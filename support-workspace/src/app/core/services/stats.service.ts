import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, forkJoin, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { User } from '../models';

export interface WorkspaceStats {
  open: number;
  inProgress: number;
  waitingForCustomer: number;
  resolved: number;
  closed: number;
  unassigned: number;
  urgent: number;
  total: number;
  active: number;
}

export interface AgentWorkload {
  agent: User;
  active: number;
  waiting: number;
  urgent: number;
}

const ACTIVE_STATUSES = 'or(status.eq.open,status.eq.in_progress,status.eq.waiting_for_customer)';

function totalFrom(response: HttpResponse<unknown>): number {
  const range = response.headers.get('content-range') ?? '';
  const match = /\/(\d+)$/.exec(range);
  return match ? Number(match[1]) : 0;
}

/**
 * Counts for the manager overview. Each count reads only the number of matching rows,
 * so the summary does not load the whole request table.
 */
@Injectable({ providedIn: 'root' })
export class StatsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/requests`;

  private countWhere(params: Record<string, string>): Observable<number> {
    return this.http
      .get<unknown[]>(this.base, {
        params: new HttpParams({ fromObject: { ...params, select: 'id' } }),
        headers: { Prefer: 'count=exact', Range: '0-0' },
        observe: 'response',
      })
      .pipe(map((response) => totalFrom(response)));
  }

  getStats(): Observable<WorkspaceStats> {
    return forkJoin({
      open: this.countWhere({ status: 'eq.open' }),
      inProgress: this.countWhere({ status: 'eq.in_progress' }),
      waitingForCustomer: this.countWhere({ status: 'eq.waiting_for_customer' }),
      resolved: this.countWhere({ status: 'eq.resolved' }),
      closed: this.countWhere({ status: 'eq.closed' }),
      unassigned: this.countWhere({ and: `(assigned_agent_id.is.null,${ACTIVE_STATUSES})` }),
      urgent: this.countWhere({ and: `(priority.eq.urgent,${ACTIVE_STATUSES})` }),
      total: this.countWhere({ id: 'not.is.null' }),
    }).pipe(
      map((counts) => ({
        ...counts,
        active: counts.open + counts.inProgress + counts.waitingForCustomer,
      }))
    );
  }

  /** Active, waiting and urgent counts for each agent. Used to see how the work is spread. */
  getWorkload(agents: User[]): Observable<AgentWorkload[]> {
    if (agents.length === 0) return of([]);
    return forkJoin(
      agents.map((agent) =>
        forkJoin({
          active: this.countWhere({ and: `(assigned_agent_id.eq.${agent.id},${ACTIVE_STATUSES})` }),
          waiting: this.countWhere({ and: `(assigned_agent_id.eq.${agent.id},status.eq.waiting_for_customer)` }),
          urgent: this.countWhere({ and: `(assigned_agent_id.eq.${agent.id},priority.eq.urgent,${ACTIVE_STATUSES})` }),
        }).pipe(map((counts) => ({ agent, ...counts })))
      )
    );
  }
}
