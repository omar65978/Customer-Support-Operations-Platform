import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';
import { environment } from '../../../environments/environment';

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

@Injectable({ providedIn: 'root' })
export class StatsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/requests`;

  private countQuery(filter: string): Observable<number> {
    return this.http.get<any[]>(`${this.base}?${filter}&select=id`, {
      headers: { 'Prefer': 'count=exact', 'Range': '0-0' },
      observe: 'response'
    }).pipe(
      map(res => {
        const range = res.headers.get('content-range');
        if (range) {
          const parts = range.split('/');
          if (parts[1] && parts[1] !== '*') return parseInt(parts[1], 10);
        }
        return 0;
      })
    );
  }

  getStats(): Observable<WorkspaceStats> {
    return forkJoin({
      open: this.countQuery('status=eq.open'),
      inProgress: this.countQuery('status=eq.in_progress'),
      waitingForCustomer: this.countQuery('status=eq.waiting_for_customer'),
      resolved: this.countQuery('status=eq.resolved'),
      closed: this.countQuery('status=eq.closed'),
      unassigned: this.countQuery('assigned_agent_id=is.null&status=neq.closed&status=neq.resolved'),
      urgent: this.countQuery('priority=eq.urgent&status=neq.closed&status=neq.resolved'),
      total: this.countQuery('id=not.is.null')
    }).pipe(
      map(counts => ({
        ...counts,
        active: counts.open + counts.inProgress + counts.waitingForCustomer
      }))
    );
  }
}
