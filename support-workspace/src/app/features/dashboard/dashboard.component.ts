import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, debounceTime, distinctUntilChanged, forkJoin, interval, map, of, Subject, Subscription, switchMap } from 'rxjs';
import {
  DEFAULT_REQUEST_QUERY,
  RequestsService,
  type RequestQuery,
  type RequestView,
  type SortField,
} from '../../core/services/requests.service';
import { AuthService } from '../../core/services/auth.service';
import type { SupportRequest, RequestStatus, RequestPriority, RequestCategory, User } from '../../core/models';
import { STATUS_LABELS, PRIORITY_LABELS, CATEGORY_LABELS } from '../../core/models';
import { describeError } from '../../core/utils/errors';

interface LoadResult {
  ok: boolean;
  silent: boolean;
  data: SupportRequest[];
  total: number;
  error: unknown;
}

const VIEW_LABELS: Record<RequestView, string> = {
  all: 'All requests',
  attention: 'Needs attention',
  unassigned: 'Unassigned',
  urgent: 'Urgent',
  mine: 'Assigned to me',
};

const SORT_FIELDS: Record<string, SortField> = {
  reference: 'reference',
  title: 'title',
  priority: 'urgency_rank',
  updatedAt: 'updated_at',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  template: `
    <div class="dashboard-header">
      <div>
        <h1 class="page-title">{{ currentUser?.role === 'manager' ? 'Support Overview' : 'Work Queue' }}</h1>
        <p class="page-subtitle">
          {{ currentUser?.role === 'manager'
            ? 'All requests across the team. Assign and reassign work from each request.'
            : 'Your assigned requests and unclaimed requests you can take on.' }}
        </p>
      </div>
    </div>

    <mat-card class="filters-card">
      <mat-card-content>
        <div class="view-row">
          <mat-button-toggle-group
            id="view-toggle"
            aria-label="Work queue view"
            [value]="query.view"
            (change)="apply({ view: $event.value })"
          >
            <mat-button-toggle *ngFor="let v of views" [value]="v" [id]="'view-' + v">
              {{ viewLabel(v) }}
              <span class="view-count" *ngIf="v !== 'all' && counts[v] !== null">({{ counts[v] }})</span>
            </mat-button-toggle>
          </mat-button-toggle-group>
        </div>

        <div class="filters-row">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search</mat-label>
            <input matInput type="search" [formControl]="searchControl" id="search-input" placeholder="Title or reference" />
            <mat-icon matSuffix aria-hidden="true">search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Status</mat-label>
            <mat-select [formControl]="statusControl" id="filter-status" aria-label="Filter by status">
              <mat-option value="">All statuses</mat-option>
              <mat-option *ngFor="let s of statusOptions" [value]="s.value">{{ s.label }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Urgency</mat-label>
            <mat-select [formControl]="priorityControl" id="filter-priority" aria-label="Filter by urgency">
              <mat-option value="">All urgencies</mat-option>
              <mat-option *ngFor="let p of priorityOptions" [value]="p.value">{{ p.label }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Category</mat-label>
            <mat-select [formControl]="categoryControl" id="filter-category" aria-label="Filter by category">
              <mat-option value="">All categories</mat-option>
              <mat-option *ngFor="let c of categoryOptions" [value]="c.value">{{ c.label }}</mat-option>
            </mat-select>
          </mat-form-field>

          <button mat-stroked-button type="button" (click)="clearFilters()" id="clear-filters-btn" *ngIf="hasActiveFilters">
            <mat-icon aria-hidden="true">clear</mat-icon>
            Clear
          </button>
        </div>
        <p class="result-count" aria-live="polite">
          <ng-container *ngIf="!isLoading && !error">
            {{ total === 0 ? 'No requests match' : total + (total === 1 ? ' request' : ' requests') }}
          </ng-container>
        </p>
      </mat-card-content>
    </mat-card>

    <mat-card class="table-card">
      <div *ngIf="isLoading && requests.length === 0" class="loading-container" role="status">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Loading requests…</p>
      </div>

      <div *ngIf="error" class="error-container" role="alert">
        <mat-icon class="error-icon" aria-hidden="true">error_outline</mat-icon>
        <p>{{ error }}</p>
        <button mat-flat-button color="primary" type="button" (click)="reload()">Try again</button>
      </div>

      <div *ngIf="!isLoading && !error && requests.length === 0" class="empty-container">
        <mat-icon class="empty-icon" aria-hidden="true">inbox</mat-icon>
        <p class="empty-title">{{ hasActiveFilters ? 'No requests match these filters' : 'Nothing in this view' }}</p>
        <p class="empty-sub">
          {{ hasActiveFilters ? 'Try a different search or clear the filters.' : 'New requests appear here when customers submit them.' }}
        </p>
      </div>

      <div *ngIf="!error && requests.length > 0" class="table-wrapper">
        <table mat-table [dataSource]="requests" class="requests-table" matSort matSortActive="updatedAt" matSortDirection="desc" (matSortChange)="onSort($event)">

          <ng-container matColumnDef="reference">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Reference</th>
            <td mat-cell *matCellDef="let r">
              <span class="reference-badge">{{ r.reference }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="title">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Title</th>
            <td mat-cell *matCellDef="let r">
              <a [routerLink]="['/requests', r.id]" class="request-link">{{ r.title }}</a>
            </td>
          </ng-container>

          <ng-container matColumnDef="category">
            <th mat-header-cell *matHeaderCellDef class="col-optional">Category</th>
            <td mat-cell *matCellDef="let r" class="col-optional">{{ categoryLabel(r.category) }}</td>
          </ng-container>

          <ng-container matColumnDef="priority">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Urgency</th>
            <td mat-cell *matCellDef="let r">
              <span class="priority-badge priority-{{ r.priority }}">{{ priorityLabel(r.priority) }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let r">
              <span class="status-badge status-{{ r.status }}">{{ statusLabel(r.status) }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="assignedAgentId">
            <th mat-header-cell *matHeaderCellDef class="col-optional">Assigned to</th>
            <td mat-cell *matCellDef="let r" class="col-optional">
              <span class="unassigned-text" *ngIf="!r.assignedAgentId">Unassigned</span>
              <span class="assigned-text" *ngIf="r.assignedAgentId">{{ agentName(r.assignedAgentId) }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="updatedAt">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Last updated</th>
            <td mat-cell *matCellDef="let r" class="date-cell">{{ timeAgo(r.updatedAt) }}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef><span class="sr-only">Open</span></th>
            <td mat-cell *matCellDef="let r">
              <a mat-icon-button [routerLink]="['/requests', r.id]" [matTooltip]="'Open ' + r.reference" [attr.aria-label]="'Open ' + r.reference" [id]="'view-request-' + r.id">
                <mat-icon aria-hidden="true">chevron_right</mat-icon>
              </a>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="table-row"></tr>
        </table>
      </div>

      <mat-paginator
        *ngIf="!error && total > 0"
        [length]="total"
        [pageIndex]="pageIndex"
        [pageSize]="pageSize"
        [pageSizeOptions]="[10, 25, 50]"
        (page)="onPage($event)"
        id="requests-paginator"
        aria-label="Select page"
      ></mat-paginator>
    </mat-card>
  `,
  styles: [`
    .dashboard-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    .page-title {
      font-size: 1.75rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px;
    }

    .page-subtitle {
      color: #64748b;
      margin: 0;
      font-size: 0.9rem;
    }

    @media (max-width: 768px) {
    }

    @media (max-width: 480px) {
    }

    .stat-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px !important;
    }

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .stat-icon mat-icon { font-size: 24px; color: white; }

    .stat-info {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      line-height: 1;
      color: #0f172a;
    }

    .stat-label {
      font-size: 0.8rem;
      color: #64748b;
      margin-top: 4px;
    }

    .stat-total .stat-icon { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
    .stat-open .stat-icon { background: linear-gradient(135deg, #8b5cf6, #6d28d9); }
    .stat-progress .stat-icon { background: linear-gradient(135deg, #f59e0b, #d97706); }
    .stat-urgent .stat-icon { background: linear-gradient(135deg, #ef4444, #dc2626); }

    .filters-card {
      margin-bottom: 16px;
      border-radius: 16px !important;
    }

    .filters-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
    }

    .search-field { flex: 2; min-width: 200px; }
    .filter-field { flex: 1; min-width: 140px; }

    .table-card {
      border-radius: 16px !important;
      overflow: hidden;
    }

    .table-wrapper { overflow-x: auto; }

    .requests-table {
      width: 100%;
    }

    .table-row:hover { background: #f1f5f9; }

    .reference-badge {
      font-family: monospace;
      font-size: 0.8rem;
      font-weight: 600;
      color: #64748b;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 6px;
    }

    .request-link {
      color: #1e40af;
      text-decoration: none;
      font-weight: 500;
      font-size: 0.875rem;
    }

    .request-link:hover { text-decoration: underline; }

    .status-badge, .priority-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 500;
      border: 1px solid;
    }

    .status-open { background: #f8fafc; color: #475569; border-color: #e2e8f0; }
    .status-in_progress { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
    .status-waiting_for_customer { background: #fffbeb; color: #b45309; border-color: #fde68a; }
    .status-resolved { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
    .status-closed { background: #f8fafc; color: #94a3b8; border-color: #e2e8f0; }

    .priority-low { background: #f8fafc; color: #475569; border-color: #e2e8f0; }
    .priority-medium { background: #f0f9ff; color: #0369a1; border-color: #bae6fd; }
    .priority-high { background: #fff7ed; color: #c2410c; border-color: #fed7aa; }
    .priority-urgent { background: #fef2f2; color: #dc2626; border-color: #fecaca; }

    .unassigned-text { color: #94a3b8; font-size: 0.8rem; font-style: italic; }
    .assigned-text { color: #334155; font-size: 0.875rem; font-weight: 500; }
    .date-cell { color: #64748b; font-size: 0.8rem; }

    .loading-container, .error-container, .empty-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
      gap: 12px;
    }

    .error-icon, .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #94a3b8;
    }

    .error-icon { color: #ef4444; }
    .empty-title { font-size: 1.1rem; font-weight: 600; color: #334155; margin: 0; }
    .empty-sub { color: #64748b; margin: 0; }

    .view-row { margin-bottom: 12px; overflow-x: auto; }
    .view-count { color: #64748b; font-weight: 500; margin-left: 4px; }
    .result-count { color: #64748b; font-size: 0.8rem; margin: 4px 0 0; min-height: 1em; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    .requests-table th.mat-mdc-header-cell { font-weight: 600; }
    .requests-table .mat-column-title { min-width: 220px; }
    .view-row mat-button-toggle-group { flex-wrap: wrap; height: auto; border-radius: 12px; }
    .status-badge, .priority-badge { white-space: nowrap; }
    .assigned-text { white-space: nowrap; }
    @media (max-width: 720px) {
      .col-optional { display: none; }
    }
    .request-link:focus-visible, .view-row button:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
    @media (max-width: 768px) {
      .search-field, .filter-field { flex: 1 1 100%; min-width: 0; }
      .dashboard-header { flex-direction: column; gap: 8px; }
    }
`],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private requestsService = inject(RequestsService);
  private authService = inject(AuthService);

  readonly views: RequestView[] = ['all', 'attention', 'unassigned', 'urgent', 'mine'];
  requests: SupportRequest[] = [];
  total = 0;
  pageIndex = 0;
  pageSize = 10;
  isLoading = true;
  error = '';
  query: RequestQuery = { ...DEFAULT_REQUEST_QUERY };
  counts: Record<Exclude<RequestView, 'all'>, number | null> = { attention: null, unassigned: null, urgent: null, mine: null };
  agentMap: Record<string, string> = {};

  searchControl = new FormControl('', { nonNullable: true });
  statusControl = new FormControl<RequestStatus | ''>('', { nonNullable: true });
  priorityControl = new FormControl<RequestPriority | ''>('', { nonNullable: true });
  categoryControl = new FormControl<RequestCategory | ''>('', { nonNullable: true });

  displayedColumns = ['reference', 'title', 'category', 'priority', 'status', 'assignedAgentId', 'updatedAt', 'actions'];
  statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
  priorityOptions = Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }));
  categoryOptions = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

  /** Each load request cancels the one before it, so an old response never replaces newer data. */
  private load$ = new Subject<boolean>();
  private subs: Subscription[] = [];

  get currentUser(): User | null {
    return this.authService.currentUser;
  }

  get hasActiveFilters(): boolean {
    return (
      this.query.view !== 'all' ||
      !!this.query.search ||
      !!this.query.status ||
      !!this.query.priority ||
      !!this.query.category
    );
  }

  ngOnInit(): void {
    this.subs.push(
      this.load$
        .pipe(
          switchMap((silent) => {
            const staff = this.currentUser;
            if (!staff) return of<LoadResult>({ ok: false, silent, data: [], total: 0, error: null });
            if (!silent) {
              this.isLoading = true;
              this.error = '';
            }
            return this.requestsService.list(this.query, staff, this.pageIndex + 1, this.pageSize).pipe(
              map((page): LoadResult => ({ ok: true, silent, data: page.data, total: page.total, error: null })),
              catchError((error: unknown) => of<LoadResult>({ ok: false, silent, data: [], total: 0, error }))
            );
          })
        )
        .subscribe((result) => {
          this.isLoading = false;
          if (result.ok) {
            this.requests = result.data;
            this.total = result.total;
            this.error = '';
          } else if (!result.silent) {
            this.error = describeError(result.error, 'Failed to load requests. Please try again.');
          }
        }),
      this.searchControl.valueChanges.pipe(debounceTime(350), distinctUntilChanged()).subscribe((search) => this.apply({ search })),
      this.statusControl.valueChanges.subscribe((status) => this.apply({ status })),
      this.priorityControl.valueChanges.subscribe((priority) => this.apply({ priority })),
      this.categoryControl.valueChanges.subscribe((category) => this.apply({ category })),
      // Keep the queue current without a manual reload.
      interval(30_000).subscribe(() => {
        if (document.visibilityState === 'visible') this.reload(true);
      })
    );
    this.loadAgentNames();
    this.reload();
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.load$.complete();
  }

  reload(silent = false): void {
    this.load$.next(silent);
    if (!silent) this.refreshCounts();
  }

  apply(patch: Partial<RequestQuery>): void {
    this.query = { ...this.query, ...patch };
    this.pageIndex = 0;
    this.reload();
  }

  clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.statusControl.setValue('', { emitEvent: false });
    this.priorityControl.setValue('', { emitEvent: false });
    this.categoryControl.setValue('', { emitEvent: false });
    this.query = { ...DEFAULT_REQUEST_QUERY, sortBy: this.query.sortBy, sortDirection: this.query.sortDirection };
    this.pageIndex = 0;
    this.reload();
  }

  onPage(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
    this.reload();
  }

  onSort(sort: Sort): void {
    const field = SORT_FIELDS[sort.active];
    if (!field) return;
    this.query = { ...this.query, sortBy: field, sortDirection: sort.direction === 'asc' ? 'asc' : 'desc' };
    this.pageIndex = 0;
    this.reload();
  }

  private refreshCounts(): void {
    const staff = this.currentUser;
    if (!staff) return;
    const views: Exclude<RequestView, 'all'>[] = ['attention', 'unassigned', 'urgent', 'mine'];
    forkJoin(
      views.map((view) =>
        this.requestsService
          .count({ ...DEFAULT_REQUEST_QUERY, view }, staff)
          .pipe(catchError(() => of(null)))
      )
    ).subscribe((values) => {
      this.counts = {
        attention: values[0],
        unassigned: values[1],
        urgent: values[2],
        mine: values[3],
      };
    });
  }

  private loadAgentNames(): void {
    this.subs.push(
      this.authService.getStaff().pipe(catchError(() => of([] as User[]))).subscribe((staff) => {
        this.agentMap = {};
        staff.forEach((u) => { this.agentMap[u.id] = u.name; });
      })
    );
  }

  viewLabel(view: RequestView): string {
    return VIEW_LABELS[view];
  }

  agentName(agentId: string): string {
    return this.agentMap[agentId] ?? 'Assigned';
  }

  statusLabel(s: RequestStatus): string {
    return STATUS_LABELS[s] ?? s;
  }

  priorityLabel(p: RequestPriority): string {
    return PRIORITY_LABELS[p] ?? p;
  }

  categoryLabel(c: RequestCategory): string {
    return CATEGORY_LABELS[c] ?? c;
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
