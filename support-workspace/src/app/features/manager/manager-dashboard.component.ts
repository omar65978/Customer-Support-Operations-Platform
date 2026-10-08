import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { EMPTY, Subscription, catchError, interval, map, of, switchMap } from 'rxjs';
import { StatsService, type AgentWorkload, type WorkspaceStats } from '../../core/services/stats.service';
import { AuthService } from '../../core/services/auth.service';
import type { User } from '../../core/models';

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
  template: `
    <div class="mgr-header">
      <div>
        <h1 class="page-title">Manager Overview</h1>
        <p class="page-subtitle">Team workload and request summary. Refreshes every 30 seconds.</p>
      </div>
      <button mat-stroked-button routerLink="/dashboard" class="go-dashboard-btn">
        <mat-icon>list</mat-icon>
        Work queue
      </button>
    </div>

    <div *ngIf="isLoading && !stats" class="loading-center">
      <mat-spinner diameter="48"></mat-spinner>
    </div>

    <div *ngIf="error && !stats" class="error-state">
      <mat-icon class="error-icon">error_outline</mat-icon>
      <p>{{ error }}</p>
      <button mat-flat-button color="primary" (click)="loadStats()">Retry</button>
    </div>

    <ng-container *ngIf="stats">
      <div class="kpi-grid">
        <mat-card class="kpi-card kpi-active">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>trending_up</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-value">{{ stats.active }}</span>
              <span class="kpi-label">Active</span>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card kpi-open">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>radio_button_unchecked</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-value">{{ stats.open }}</span>
              <span class="kpi-label">Open</span>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card kpi-unassigned">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>person_off</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-value">{{ stats.unassigned }}</span>
              <span class="kpi-label">Unassigned</span>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card kpi-urgent">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>priority_high</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-value">{{ stats.urgent }}</span>
              <span class="kpi-label">Urgent</span>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card kpi-waiting">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>schedule</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-value">{{ stats.waitingForCustomer }}</span>
              <span class="kpi-label">Waiting</span>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="kpi-card kpi-resolved">
          <mat-card-content>
            <div class="kpi-icon"><mat-icon>check_circle</mat-icon></div>
            <div class="kpi-info">
              <span class="kpi-value">{{ stats.resolved }}</span>
              <span class="kpi-label">Resolved</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>




      <div class="status-breakdown-row">
        <mat-card class="breakdown-card">
          <mat-card-header><mat-card-title>Status Breakdown</mat-card-title></mat-card-header>
          <mat-divider></mat-divider>
          <mat-card-content class="breakdown-content">
            <div class="breakdown-item">
              <span class="breakdown-label">Open</span>
              <div class="breakdown-bar-wrap">
                <div class="breakdown-bar" [style.width.%]="pct(stats.open)" style="background:#818cf8"></div>
              </div>
              <span class="breakdown-count">{{ stats.open }}</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">In Progress</span>
              <div class="breakdown-bar-wrap">
                <div class="breakdown-bar" [style.width.%]="pct(stats.inProgress)" style="background:#3b82f6"></div>
              </div>
              <span class="breakdown-count">{{ stats.inProgress }}</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">Waiting</span>
              <div class="breakdown-bar-wrap">
                <div class="breakdown-bar" [style.width.%]="pct(stats.waitingForCustomer)" style="background:#f59e0b"></div>
              </div>
              <span class="breakdown-count">{{ stats.waitingForCustomer }}</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">Resolved</span>
              <div class="breakdown-bar-wrap">
                <div class="breakdown-bar" [style.width.%]="pct(stats.resolved)" style="background:#10b981"></div>
              </div>
              <span class="breakdown-count">{{ stats.resolved }}</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-label">Closed</span>
              <div class="breakdown-bar-wrap">
                <div class="breakdown-bar" [style.width.%]="pct(stats.closed)" style="background:#94a3b8"></div>
              </div>
              <span class="breakdown-count">{{ stats.closed }}</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="workload-row">
        <mat-card class="breakdown-card workload-card">
          <mat-card-header>
            <mat-card-title>Team workload</mat-card-title>
            <mat-card-subtitle>Active requests per agent. Open a request to reassign it.</mat-card-subtitle>
          </mat-card-header>
          <mat-divider></mat-divider>
          <mat-card-content>
            <p class="workload-empty" *ngIf="workload.length === 0">No agents to show yet.</p>
            <div class="table-scroll" *ngIf="workload.length > 0">
              <table class="workload-table">
                <caption class="sr-only">Active, waiting and urgent requests for each agent</caption>
                <thead>
                  <tr>
                    <th scope="col">Agent</th>
                    <th scope="col">Active</th>
                    <th scope="col">Waiting for customer</th>
                    <th scope="col">Urgent</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let w of workload">
                    <th scope="row">{{ w.agent.name }}</th>
                    <td>{{ w.active }}</td>
                    <td>{{ w.waiting }}</td>
                    <td>{{ w.urgent }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="workload-footer">
              Unassigned requests: <strong>{{ stats.unassigned }}</strong>
              · <a routerLink="/dashboard" class="workload-link">Open the work queue</a>
            </p>
          </mat-card-content>
        </mat-card>
      </div>
    </ng-container>
  `,
  styles: [`
    .workload-row { margin-top: 16px; }
    .workload-card .mat-mdc-card-content { padding-top: 12px; }
    .table-scroll { overflow-x: auto; }
    .workload-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    .workload-table th, .workload-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
    .workload-table td { font-variant-numeric: tabular-nums; }
    .workload-empty, .workload-footer { color: #64748b; font-size: 0.85rem; }
    .workload-footer { margin: 12px 0 0; }
    .workload-link { color: #1e40af; font-weight: 500; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

    .mgr-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .page-title { font-size: 1.75rem; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
    .page-subtitle { color: #64748b; margin: 0; font-size: 0.9rem; }

    .go-dashboard-btn { display: flex; align-items: center; gap: 4px; }

    .loading-center, .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 20px;
      gap: 16px;
      text-align: center;
    }

    .error-icon { font-size: 48px; width: 48px; height: 48px; color: #ef4444; }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 14px;
      margin-bottom: 24px;
    }

    @media (max-width: 1200px) { .kpi-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 600px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }

    .kpi-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px !important;
    }

    .kpi-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .kpi-icon mat-icon { color: white; font-size: 22px; }

    .kpi-info { display: flex; flex-direction: column; }
    .kpi-value { font-size: 1.8rem; font-weight: 700; line-height: 1; color: #0f172a; }
    .kpi-label { font-size: 0.75rem; color: #64748b; margin-top: 4px; }

    .kpi-active .kpi-icon { background: linear-gradient(135deg,#3b82f6,#1d4ed8); }
    .kpi-open .kpi-icon { background: linear-gradient(135deg,#8b5cf6,#6d28d9); }
    .kpi-unassigned .kpi-icon { background: linear-gradient(135deg,#f97316,#ea580c); }
    .kpi-urgent .kpi-icon { background: linear-gradient(135deg,#ef4444,#dc2626); }
    .kpi-waiting .kpi-icon { background: linear-gradient(135deg,#f59e0b,#d97706); }
    .kpi-resolved .kpi-icon { background: linear-gradient(135deg,#10b981,#059669); }

    .activity-card { border-radius: 16px !important; margin-bottom: 20px; }

    .activity-content { padding: 0 !important; }

    .empty-activity {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #94a3b8;
      padding: 32px 20px;
    }

    .activity-item {
      display: flex;
      gap: 12px;
      padding: 14px 20px;
      border-bottom: 1px solid #f1f5f9;
    }

    .activity-item:last-child { border-bottom: none; }

    .activity-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
    }

    .customer-av { background: linear-gradient(135deg,#8b5cf6,#6d28d9); }
    .agent-av { background: linear-gradient(135deg,#3b82f6,#1d4ed8); }

    .activity-body { flex: 1; min-width: 0; }

    .activity-header {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 4px;
    }

    .activity-author { font-weight: 600; font-size: 0.85rem; color: #0f172a; }

    .activity-role-badge {
      font-size: 0.7rem;
      padding: 1px 7px;
      border-radius: 9999px;
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 500;
    }

    .customer-badge { background: #f5f3ff !important; color: #6d28d9 !important; }

    .ref-link { font-size: 0.75rem; color: #1e40af; text-decoration: none; }
    .ref-link:hover { text-decoration: underline; }

    .activity-time { font-size: 0.75rem; color: #94a3b8; margin-left: auto; }

    .activity-preview { font-size: 0.8rem; color: #64748b; margin: 0; line-height: 1.5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .status-breakdown-row { display: grid; grid-template-columns: 1fr; }

    .breakdown-card { border-radius: 16px !important; }

    .breakdown-content { padding: 16px 20px !important; display: flex; flex-direction: column; gap: 12px; }

    .breakdown-item { display: flex; align-items: center; gap: 12px; }

    .breakdown-label { font-size: 0.8rem; font-weight: 500; color: #475569; min-width: 80px; }

    .breakdown-bar-wrap { flex: 1; height: 8px; background: #f1f5f9; border-radius: 9999px; overflow: hidden; }

    .breakdown-bar { height: 100%; border-radius: 9999px; transition: width 0.4s ease; min-width: 4px; }

    .breakdown-count { font-size: 0.85rem; font-weight: 600; color: #334155; min-width: 24px; text-align: right; }
  `],
})
export class ManagerDashboardComponent implements OnInit, OnDestroy {
  private statsService = inject(StatsService);
  private authService = inject(AuthService);

  stats: WorkspaceStats | null = null;
  workload: AgentWorkload[] = [];
  isLoading = true;
  error = '';

  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.loadStats();
    // A failed refresh keeps the last values and polling continues.
    this.subs.push(
      interval(30000)
        .pipe(switchMap(() => this.fetchOverview().pipe(catchError(() => EMPTY))))
        .subscribe(({ stats, workload }) => {
          this.stats = stats;
          this.workload = workload;
        })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  loadStats(): void {
    this.isLoading = true;
    this.error = '';
    this.subs.push(
      this.fetchOverview().subscribe({
        next: ({ stats, workload }) => {
          this.stats = stats;
          this.workload = workload;
          this.isLoading = false;
        },
        error: () => {
          this.error = 'Failed to load the overview. Please retry.';
          this.isLoading = false;
        },
      })
    );
  }

  /** Summary counts plus the active work per agent. Counts only, so no full request list is loaded. */
  private fetchOverview() {
    return this.statsService.getStats().pipe(
      switchMap((stats) =>
        this.authService.getStaff().pipe(
          map((staff: User[]) => staff.filter((u) => u.role === 'agent')),
          switchMap((agents) => this.statsService.getWorkload(agents)),
          catchError(() => of([] as AgentWorkload[])),
          map((workload) => ({ stats, workload }))
        )
      )
    );
  }

  pct(count: number): number {
    if (!this.stats || this.stats.total === 0) return 0;
    return Math.round((count / this.stats.total) * 100);
  }

  timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }
}
