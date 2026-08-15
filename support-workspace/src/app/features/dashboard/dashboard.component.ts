import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { RequestsService, type RequestFilters } from '../../core/services/requests.service';
import { AuthService } from '../../core/services/auth.service';
import type { SupportRequest, RequestStatus, RequestPriority, RequestCategory } from '../../core/models';
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
} from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatBadgeModule,
  ],
  template: `
    <div class="dashboard-header">
      <div>
        <h1 class="page-title">Support Dashboard</h1>
        <p class="page-subtitle">Manage and track all customer support requests</p>
      </div>
    </div>

    <div class="stats-grid" *ngIf="!isLoading">
      <mat-card class="stat-card stat-total">
        <mat-card-content>
          <div class="stat-icon"><mat-icon>inbox</mat-icon></div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.total }}</span>
            <span class="stat-label">Total</span>
          </div>
        </mat-card-content>
      </mat-card>
      <mat-card class="stat-card stat-open">
        <mat-card-content>
          <div class="stat-icon"><mat-icon>radio_button_unchecked</mat-icon></div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.open }}</span>
            <span class="stat-label">Open</span>
          </div>
        </mat-card-content>
      </mat-card>
      <mat-card class="stat-card stat-progress">
        <mat-card-content>
          <div class="stat-icon"><mat-icon>pending</mat-icon></div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.inProgress }}</span>
            <span class="stat-label">In Progress</span>
          </div>
        </mat-card-content>
      </mat-card>
      <mat-card class="stat-card stat-urgent">
        <mat-card-content>
          <div class="stat-icon"><mat-icon>priority_high</mat-icon></div>
          <div class="stat-info">
            <span class="stat-value">{{ stats.urgent }}</span>
            <span class="stat-label">Urgent</span>
          </div>
        </mat-card-content>
      </mat-card>
    </div>

    <mat-card class="filters-card">
      <mat-card-content>
        <div class="filters-row">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search requests</mat-label>
            <input matInput [formControl]="searchControl" id="search-input" placeholder="Search by title, reference…" />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Status</mat-label>
            <mat-select [formControl]="statusControl" id="filter-status">
              <mat-option value="">All Statuses</mat-option>
              <mat-option *ngFor="let s of statusOptions" [value]="s.value">{{ s.label }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Priority</mat-label>
            <mat-select [formControl]="priorityControl" id="filter-priority">
              <mat-option value="">All Priorities</mat-option>
              <mat-option *ngFor="let p of priorityOptions" [value]="p.value">{{ p.label }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Category</mat-label>
            <mat-select [formControl]="categoryControl" id="filter-category">
              <mat-option value="">All Categories</mat-option>
              <mat-option *ngFor="let c of categoryOptions" [value]="c.value">{{ c.label }}</mat-option>
            </mat-select>
          </mat-form-field>

          <button mat-stroked-button (click)="clearFilters()" id="clear-filters-btn" *ngIf="hasActiveFilters">
            <mat-icon>clear</mat-icon>
            Clear
          </button>
        </div>

        <div class="quick-chips">
          <span class="chips-label">Quick filters:</span>
          <mat-chip-set>
            <mat-chip
              id="chip-unassigned"
              [class.active-chip]="quickFilter === 'unassigned'"
              (click)="setQuickFilter('unassigned')"
            >
              <mat-icon matChipAvatar>person_off</mat-icon>
              Unassigned
            </mat-chip>
            <mat-chip
              id="chip-urgent"
              [class.active-chip]="quickFilter === 'urgent'"
              (click)="setQuickFilter('urgent')"
            >
              <mat-icon matChipAvatar>priority_high</mat-icon>
              Urgent
            </mat-chip>
            <mat-chip
              id="chip-waiting"
              [class.active-chip]="quickFilter === 'waiting'"
              (click)="setQuickFilter('waiting')"
            >
              <mat-icon matChipAvatar>hourglass_empty</mat-icon>
              Waiting for Customer
            </mat-chip>
            <mat-chip
              id="chip-mine"
              [class.active-chip]="quickFilter === 'mine'"
              (click)="setQuickFilter('mine')"
              *ngIf="currentUser"
            >
              <mat-icon matChipAvatar>person</mat-icon>
              My Requests
            </mat-chip>
          </mat-chip-set>
        </div>
      </mat-card-content>
    </mat-card>

    <mat-card class="table-card">
      <div *ngIf="isLoading" class="loading-container">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Loading requests…</p>
      </div>

      <div *ngIf="!isLoading && error" class="error-container">
        <mat-icon class="error-icon">error_outline</mat-icon>
        <p>{{ error }}</p>
        <button mat-flat-button color="primary" (click)="loadRequests()">Retry</button>
      </div>

      <div *ngIf="!isLoading && !error && pagedRequests.length === 0" class="empty-container">
        <mat-icon class="empty-icon">inbox</mat-icon>
        <p class="empty-title">No requests found</p>
        <p class="empty-sub">Try adjusting your filters or search query.</p>
      </div>

      <div *ngIf="!isLoading && !error && pagedRequests.length > 0" class="table-wrapper">
        <table mat-table [dataSource]="pagedRequests" matSort (matSortChange)="onSort($event)" class="requests-table">

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
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Category</th>
            <td mat-cell *matCellDef="let r">{{ categoryLabel(r.category) }}</td>
          </ng-container>

          <ng-container matColumnDef="priority">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Priority</th>
            <td mat-cell *matCellDef="let r">
              <span class="priority-badge priority-{{ r.priority }}">{{ priorityLabel(r.priority) }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
            <td mat-cell *matCellDef="let r">
              <span class="status-badge status-{{ r.status }}">{{ statusLabel(r.status) }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="assignedAgentId">
            <th mat-header-cell *matHeaderCellDef>Assigned To</th>
            <td mat-cell *matCellDef="let r">
              <span class="unassigned-text" *ngIf="!r.assignedAgentId">Unassigned</span>
              <span class="assigned-text" *ngIf="r.assignedAgentId">{{ r.assignedAgentId }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="updatedAt">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Updated</th>
            <td mat-cell *matCellDef="let r" class="date-cell">{{ timeAgo(r.updatedAt) }}</td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let r">
              <a mat-icon-button [routerLink]="['/requests', r.id]" [matTooltip]="'View details'" [id]="'view-request-' + r.id">
                <mat-icon>chevron_right</mat-icon>
              </a>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="table-row"></tr>
        </table>
      </div>

      <mat-paginator
        *ngIf="!isLoading && !error && filteredRequests.length > 0"
        [length]="filteredRequests.length"
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

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 480px) {
      .stats-grid { grid-template-columns: 1fr; }
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
      margin-bottom: 12px;
    }

    .search-field { flex: 2; min-width: 200px; }
    .filter-field { flex: 1; min-width: 140px; }

    .quick-chips {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .chips-label {
      font-size: 0.8rem;
      color: #64748b;
      font-weight: 500;
    }

    .active-chip {
      background: #3b82f6 !important;
      color: white !important;
    }

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
    .assigned-text { color: #334155; font-size: 0.8rem; }
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
  `],
})
export class DashboardComponent implements OnInit {
  private requestsService = inject(RequestsService);
  private authService = inject(AuthService);

  allRequests: SupportRequest[] = [];
  filteredRequests: SupportRequest[] = [];
  pagedRequests: SupportRequest[] = [];
  isLoading = true;
  error = '';
  quickFilter = '';

  searchControl = new FormControl('');
  statusControl = new FormControl<RequestStatus | ''>('');
  priorityControl = new FormControl('');
  categoryControl = new FormControl('');

  pageSize = 10;
  pageIndex = 0;

  displayedColumns = ['reference', 'title', 'category', 'priority', 'status', 'assignedAgentId', 'updatedAt', 'actions'];

  statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
  priorityOptions = Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }));
  categoryOptions = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

  get currentUser() { return this.authService.currentUser; }
  get hasActiveFilters(): boolean {
    return !!(this.searchControl.value || this.statusControl.value || this.priorityControl.value || this.categoryControl.value || this.quickFilter);
  }

  ngOnInit(): void {
    this.loadRequests();
    this.searchControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => this.applyFilters());
    this.statusControl.valueChanges.subscribe(() => this.applyFilters());
    this.priorityControl.valueChanges.subscribe(() => this.applyFilters());
    this.categoryControl.valueChanges.subscribe(() => this.applyFilters());
  }

  loadRequests(): void {
    this.isLoading = true;
    this.error = '';
    this.requestsService.getAll().subscribe({
      next: (data) => {
        this.allRequests = data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Failed to load requests. Please try again.';
        this.isLoading = false;
      },
    });
  }

  get stats() {
    return {
      total: this.allRequests.length,
      open: this.allRequests.filter((r) => r.status === 'open').length,
      inProgress: this.allRequests.filter((r) => r.status === 'in_progress').length,
      urgent: this.allRequests.filter((r) => r.priority === 'urgent').length,
    };
  }

  applyFilters(): void {
    const search = (this.searchControl.value ?? '').toLowerCase();
    const status = this.statusControl.value ?? '';
    const priority = this.priorityControl.value ?? '';
    const category = this.categoryControl.value ?? '';

    this.filteredRequests = this.allRequests.filter((r) => {
      const matchSearch = !search || r.title.toLowerCase().includes(search) || r.reference.toLowerCase().includes(search) || r.description.toLowerCase().includes(search);
      const matchStatus = !status || r.status === status;
      const matchPriority = !priority || r.priority === priority;
      const matchCategory = !category || r.category === category;

      let matchQuick = true;
      if (this.quickFilter === 'unassigned') matchQuick = !r.assignedAgentId;
      if (this.quickFilter === 'urgent') matchQuick = r.priority === 'urgent';
      if (this.quickFilter === 'waiting') matchQuick = r.status === 'waiting_for_customer';
      if (this.quickFilter === 'mine') matchQuick = r.assignedAgentId === this.currentUser?.id;

      return matchSearch && matchStatus && matchPriority && matchCategory && matchQuick;
    });

    this.pageIndex = 0;
    this.updatePaged();
  }

  setQuickFilter(key: string): void {
    this.quickFilter = this.quickFilter === key ? '' : key;
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.statusControl.setValue('');
    this.priorityControl.setValue('');
    this.categoryControl.setValue('');
    this.quickFilter = '';
    this.applyFilters();
  }

  onSort(sort: Sort): void {
    if (!sort.active || sort.direction === '') {
      this.filteredRequests = [...this.allRequests];
    } else {
      this.filteredRequests = [...this.filteredRequests].sort((a, b) => {
        const aVal = ((a as unknown) as Record<string, unknown>)[sort.active] as string ?? '';
        const bVal = ((b as unknown) as Record<string, unknown>)[sort.active] as string ?? '';
        return sort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }
    this.updatePaged();
  }

  onPage(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
    this.updatePaged();
  }

  updatePaged(): void {
    const start = this.pageIndex * this.pageSize;
    this.pagedRequests = this.filteredRequests.slice(start, start + this.pageSize);
  }

  statusLabel(s: RequestStatus): string { return STATUS_LABELS[s] ?? s; }
  priorityLabel(p: RequestPriority): string { return PRIORITY_LABELS[p] ?? p; }
  categoryLabel(c: RequestCategory): string { return CATEGORY_LABELS[c] ?? c; }

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
