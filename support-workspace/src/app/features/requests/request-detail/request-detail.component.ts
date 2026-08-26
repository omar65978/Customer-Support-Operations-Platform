import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RequestsService } from '../../../core/services/requests.service';
import { MessagesService } from '../../../core/services/messages.service';
import { AuthService } from '../../../core/services/auth.service';
import type { SupportRequest, Message, User, RequestStatus } from '../../../core/models';
import { STATUS_LABELS, STATUS_TRANSITIONS, CATEGORY_LABELS, PRIORITY_LABELS } from '../../../core/models';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-request-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatDialogModule,
    MatTabsModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="detail-container">
      <div class="back-row">
        <button mat-icon-button routerLink="/dashboard" id="back-btn" matTooltip="Back to dashboard">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <span class="back-label">Dashboard</span>
      </div>

      <div *ngIf="isLoading" class="loading-center">
        <mat-spinner diameter="48"></mat-spinner>
      </div>

      <div *ngIf="error && !isLoading" class="error-state">
        <mat-icon class="error-icon">error_outline</mat-icon>
        <p>{{ error }}</p>
        <button mat-flat-button color="primary" routerLink="/dashboard">Back to Dashboard</button>
      </div>

      <ng-container *ngIf="!isLoading && !error && request">
        <div class="detail-header">
          <div class="header-meta">
            <span class="reference-tag">{{ request.reference }}</span>
            <span class="category-tag">{{ categoryLabel(request.category) }}</span>
          </div>
          <h1 class="detail-title">{{ request.title }}</h1>
          <div class="header-badges">
            <span class="status-badge status-{{ request.status }}">{{ statusLabel(request.status) }}</span>
            <span class="priority-badge priority-{{ request.priority }}">{{ priorityLabel(request.priority) }}</span>
          </div>
        </div>

        <div class="detail-grid">
          <div class="main-col">
            <mat-card class="conversation-card">
              <mat-card-header>
                <mat-card-title>Conversation</mat-card-title>
                <mat-card-subtitle>{{ messages.length }} message{{ messages.length !== 1 ? 's' : '' }}</mat-card-subtitle>
              </mat-card-header>
              <mat-divider></mat-divider>

              <div class="messages-list" #messageList>
                <div *ngIf="messagesLoading" class="loading-center">
                  <mat-spinner diameter="32"></mat-spinner>
                </div>

                <div *ngIf="!messagesLoading && messages.length === 0" class="empty-messages">
                  <mat-icon>chat_bubble_outline</mat-icon>
                  <p>No messages yet</p>
                </div>

                <div *ngFor="let msg of messages" class="message-item" [class.internal-message]="msg.isInternal">
                  <div class="msg-avatar" [class.customer-avatar]="msg.authorRole === 'customer'" [class.agent-avatar]="msg.authorRole !== 'customer'">
                    {{ msg.isInternal ? '🔒' : msg.authorName.charAt(0).toUpperCase() }}
                  </div>
                  <div class="msg-content">
                    <div class="msg-header">
                      <span class="msg-author">{{ msg.authorName }}</span>
                      <span class="msg-role-badge" [class.internal-badge]="msg.isInternal">
                        {{ msg.isInternal ? 'Internal Note' : (msg.authorRole === 'customer' ? 'Customer' : 'Support Team') }}
                      </span>
                      <span class="msg-time">{{ formatDate(msg.createdAt) }}</span>
                    </div>
                    <div class="msg-body">{{ msg.content }}</div>
                  </div>
                </div>
              </div>

              <mat-divider></mat-divider>
              <mat-card-content class="reply-area" *ngIf="request.status !== 'closed'">
                <mat-tab-group id="reply-tabs" (selectedTabChange)="isInternalNote = $event.index === 1">
                  <mat-tab label="Reply to Customer">
                    <div class="reply-tab-content">
                      <mat-form-field appearance="outline" class="full-width">
                        <mat-label>Type your reply…</mat-label>
                        <textarea matInput [formControl]="replyControl" id="reply-input" rows="4" placeholder="Write a message visible to the customer…"></textarea>
                        <mat-error *ngIf="replyControl.hasError('required')">Message cannot be empty</mat-error>
                        <mat-error *ngIf="replyControl.hasError('minlength')">Message must be at least 5 characters</mat-error>
                      </mat-form-field>
                      <div class="reply-actions">
                        <button mat-flat-button color="primary" (click)="sendReply(false)" [disabled]="isSending" id="send-reply-btn">
                          <mat-spinner diameter="18" *ngIf="isSending && !isInternalNote"></mat-spinner>
                          <mat-icon *ngIf="!isSending || isInternalNote">send</mat-icon>
                          Send Reply
                        </button>
                      </div>
                    </div>
                  </mat-tab>
                  <mat-tab label="Internal Note" *ngIf="request.status !== 'resolved'">
                    <div class="reply-tab-content internal-tab">
                      <div class="internal-notice">
                        <mat-icon>lock</mat-icon>
                        This note is only visible to support team members, not the customer.
                      </div>
                      <mat-form-field appearance="outline" class="full-width">
                        <mat-label>Internal note…</mat-label>
                        <textarea matInput [formControl]="replyControl" id="internal-note-input" rows="4" placeholder="Write an internal team note…"></textarea>
                      </mat-form-field>
                      <div class="reply-actions">
                        <button mat-flat-button color="accent" (click)="sendReply(true)" [disabled]="isSending" id="send-note-btn">
                          <mat-spinner diameter="18" *ngIf="isSending && isInternalNote"></mat-spinner>
                          <mat-icon *ngIf="!isSending || !isInternalNote">lock</mat-icon>
                          Add Note
                        </button>
                      </div>
                    </div>
                  </mat-tab>
                </mat-tab-group>
              </mat-card-content>

              <mat-card-content *ngIf="request.status === 'closed'" class="closed-notice">
                <mat-icon>lock</mat-icon>
                This request is closed. No further replies can be added.
              </mat-card-content>
            </mat-card>
          </div>

          <div class="sidebar-col">
            <mat-card class="sidebar-card">
              <mat-card-header><mat-card-title>Request Details</mat-card-title></mat-card-header>
              <mat-divider></mat-divider>
              <mat-card-content class="details-content">
                <div class="detail-row">
                  <span class="detail-label">Status</span>
                  <span class="status-badge status-{{ request.status }}">{{ statusLabel(request.status) }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Priority</span>
                  <span class="priority-badge priority-{{ request.priority }}">{{ priorityLabel(request.priority) }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Category</span>
                  <span class="detail-value">{{ categoryLabel(request.category) }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Submitted</span>
                  <span class="detail-value">{{ formatDate(request.createdAt) }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Updated</span>
                  <span class="detail-value">{{ formatDate(request.updatedAt) }}</span>
                </div>
                <div class="detail-row" *ngIf="request.resolvedAt">
                  <span class="detail-label">Resolved</span>
                  <span class="detail-value resolved-text">{{ formatDate(request.resolvedAt) }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Assigned To</span>
                  <span class="detail-value" *ngIf="request.assignedAgentId">{{ agentName(request.assignedAgentId) }}</span>
                  <span class="unassigned-text" *ngIf="!request.assignedAgentId">Unassigned</span>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="sidebar-card actions-card">
              <mat-card-header><mat-card-title>Actions</mat-card-title></mat-card-header>
              <mat-divider></mat-divider>
              <mat-card-content class="actions-content">

                <div class="action-section">
                  <label class="action-label">Update Status</label>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Change status to…</mat-label>
                    <mat-select [formControl]="statusControl" id="status-select">
                      <mat-option *ngFor="let opt of availableTransitions" [value]="opt.value">
                        {{ opt.label }}
                      </mat-option>
                    </mat-select>
                  </mat-form-field>
                  <button mat-flat-button color="primary" class="full-width" (click)="updateStatus()" [disabled]="!statusControl.value || isUpdating" id="update-status-btn">
                    <mat-spinner diameter="18" *ngIf="isUpdating"></mat-spinner>
                    Update Status
                  </button>
                </div>

                <mat-divider></mat-divider>

                <div class="action-section">
                  <label class="action-label">Assignment</label>
                  <button
                    mat-stroked-button
                    class="full-width"
                    id="claim-btn"
                    (click)="claimRequest()"
                    [disabled]="request.assignedAgentId === currentUser?.id || isClaiming"
                    *ngIf="currentUser?.role === 'agent' || currentUser?.role === 'manager'"
                  >
                    <mat-icon>person_add</mat-icon>
                    {{ request.assignedAgentId === currentUser?.id ? 'You own this' : 'Claim Request' }}
                  </button>

                  <div *ngIf="currentUser?.role === 'manager'" class="reassign-section">
                    <mat-form-field appearance="outline" class="full-width" style="margin-top: 10px;">
                      <mat-label>Reassign to agent</mat-label>
                      <mat-select [formControl]="reassignControl" id="reassign-select">
                        <mat-option *ngFor="let agent of agents" [value]="agent.id">
                          {{ agent.name }}
                        </mat-option>
                      </mat-select>
                    </mat-form-field>
                    <button mat-stroked-button class="full-width" (click)="reassign()" [disabled]="!reassignControl.value || isReassigning" id="reassign-btn">
                      <mat-icon>swap_horiz</mat-icon>
                      Reassign
                    </button>
                  </div>
                </div>

                <mat-divider></mat-divider>

                <div class="action-section" *ngIf="request.status !== 'closed'">
                  <label class="action-label danger-label">Danger Zone</label>
                  <button mat-stroked-button color="warn" class="full-width" (click)="closeRequest()" id="close-request-btn">
                    <mat-icon>close</mat-icon>
                    Close Request
                  </button>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .detail-container { max-width: 1200px; }

    .back-row {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 20px;
    }

    .back-label { color: #64748b; font-size: 0.875rem; }

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

    .detail-header {
      margin-bottom: 24px;
    }

    .header-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .reference-tag {
      font-family: monospace;
      font-size: 0.8rem;
      font-weight: 600;
      color: #64748b;
      background: #f1f5f9;
      padding: 3px 10px;
      border-radius: 6px;
    }

    .category-tag {
      font-size: 0.8rem;
      color: #64748b;
    }

    .detail-title {
      font-size: 1.75rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 12px;
    }

    .header-badges { display: flex; gap: 8px; flex-wrap: wrap; }

    .status-badge, .priority-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
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

    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 20px;
      align-items: start;
    }

    @media (max-width: 900px) {
      .detail-grid { grid-template-columns: 1fr; }
      .sidebar-col { order: -1; }
    }

    .conversation-card { border-radius: 16px !important; }

    .messages-list {
      max-height: 500px;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .message-item {
      display: flex;
      gap: 12px;
    }

    .internal-message {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 12px;
      padding: 12px;
      margin: 0 -8px;
    }

    .msg-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.875rem;
      flex-shrink: 0;
      color: white;
    }

    .customer-avatar { background: linear-gradient(135deg, #8b5cf6, #6d28d9); }
    .agent-avatar { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }

    .msg-content { flex: 1; min-width: 0; }

    .msg-header {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }

    .msg-author { font-weight: 600; font-size: 0.875rem; color: #0f172a; }

    .msg-role-badge {
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: 9999px;
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 500;
    }

    .internal-badge { background: #fffbeb !important; color: #b45309 !important; }

    .msg-time { font-size: 0.75rem; color: #94a3b8; margin-left: auto; }
    .msg-body { font-size: 0.875rem; color: #334155; line-height: 1.6; white-space: pre-wrap; }

    .empty-messages {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: #94a3b8;
      padding: 40px;
      text-align: center;
    }

    .empty-messages mat-icon { font-size: 36px; width: 36px; height: 36px; }

    .reply-area { padding: 0 !important; }

    .reply-tab-content {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .internal-tab { background: #fffbeb; }

    .internal-notice {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fef3c7;
      border: 1px solid #fde68a;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.8rem;
      color: #92400e;
    }

    .reply-actions { display: flex; justify-content: flex-end; }

    .closed-notice {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #94a3b8;
      font-size: 0.875rem;
      padding: 16px !important;
    }

    .sidebar-card {
      border-radius: 16px !important;
      margin-bottom: 16px;
    }

    .details-content {
      padding: 16px !important;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .detail-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .detail-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      flex-shrink: 0;
    }

    .detail-value { font-size: 0.875rem; color: #334155; }
    .resolved-text { color: #15803d; }
    .unassigned-text { font-size: 0.8rem; color: #94a3b8; font-style: italic; }

    .actions-content {
      padding: 0 !important;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .action-section {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .action-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .danger-label { color: #ef4444 !important; }

    .full-width { width: 100%; }

    .reassign-section { display: flex; flex-direction: column; gap: 8px; }
  `],
})
export class RequestDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private requestsService = inject(RequestsService);
  private messagesService = inject(MessagesService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  request: SupportRequest | null = null;
  messages: Message[] = [];
  agents: User[] = [];
  agentMap: Record<string, string> = {};
  availableTransitions: { value: RequestStatus; label: string }[] = [];

  isLoading = true;
  messagesLoading = true;
  error = '';
  isSending = false;
  isUpdating = false;
  isClaiming = false;
  isReassigning = false;
  isInternalNote = false;

  replyControl = new FormControl('', [Validators.required, Validators.minLength(5)]);
  statusControl = new FormControl<RequestStatus | ''>('');
  reassignControl = new FormControl('');

  get currentUser() { return this.authService.currentUser; }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadRequest(id);
    this.loadMessages(id);
    this.authService.getAllAgents().subscribe({
      next: (users) => {
        this.agents = users;
        this.agentMap = {};
        users.forEach((u) => { this.agentMap[u.id] = u.name; });
      },
    });
  }

  private computeTransitions(): void {
    if (!this.request) {
      this.availableTransitions = [];
      return;
    }
    const nexts = STATUS_TRANSITIONS[this.request.status] ?? [];
    this.availableTransitions = nexts.map((s) => ({ value: s, label: STATUS_LABELS[s] }));
  }

  loadRequest(id: string): void {
    this.isLoading = true;
    this.requestsService.getOne(id).subscribe({
      next: (r) => {
        this.request = r;
        this.computeTransitions();
        this.isLoading = false;
      },
      error: () => { this.error = 'Request not found or you do not have access.'; this.isLoading = false; },
    });
  }

  loadMessages(id: string): void {
    this.messagesLoading = true;
    this.messagesService.getForRequest(id).subscribe({
      next: (msgs) => {
        this.messages = msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        this.messagesLoading = false;
      },
      error: () => { this.messagesLoading = false; },
    });
  }

  sendReply(isInternal: boolean): void {
    if (!this.replyControl.value?.trim()) {
      this.replyControl.markAsTouched();
      return;
    }
    this.isSending = true;
    const content = this.replyControl.value.trim();
    const { id, name, role } = this.currentUser!;
    this.messagesService.sendMessage(
      this.request!.id, content, id, name,
      role as 'agent' | 'manager', isInternal
    ).subscribe({
      next: (msg) => {
        this.messages = [...this.messages, msg];
        this.replyControl.reset();
        this.isSending = false;
        if (!isInternal && this.request?.status === 'waiting_for_customer') {
          this.requestsService.updateStatus(this.request.id, 'in_progress').subscribe((r) => { this.request = r; });
        }
        this.snackBar.open(isInternal ? 'Internal note added' : 'Reply sent', 'Dismiss', { duration: 3000 });
      },
      error: () => {
        this.isSending = false;
        this.snackBar.open('Failed to send message', 'Dismiss', { duration: 4000 });
      },
    });
  }

  updateStatus(): void {
    const newStatus = this.statusControl.value as RequestStatus;
    if (!newStatus) return;
    this.isUpdating = true;
    this.requestsService.updateStatus(this.request!.id, newStatus).subscribe({
      next: (r) => {
        this.request = r;
        this.computeTransitions();
        this.statusControl.reset();
        this.isUpdating = false;
        this.snackBar.open(`Status updated to "${STATUS_LABELS[newStatus]}"`, 'Dismiss', { duration: 3000 });
      },
      error: () => {
        this.isUpdating = false;
        this.snackBar.open('Failed to update status', 'Dismiss', { duration: 4000 });
      },
    });
  }

  claimRequest(): void {
    this.isClaiming = true;
    this.requestsService.assign(this.request!.id, this.currentUser!.id).subscribe({
      next: (r) => {
        this.request = r;
        this.isClaiming = false;
        this.snackBar.open('Request assigned to you', 'Dismiss', { duration: 3000 });
      },
      error: () => { this.isClaiming = false; },
    });
  }

  reassign(): void {
    const agentId = this.reassignControl.value;
    if (!agentId) return;
    this.isReassigning = true;
    this.requestsService.assign(this.request!.id, agentId).subscribe({
      next: (r) => {
        this.request = r;
        this.reassignControl.reset();
        this.isReassigning = false;
        this.snackBar.open('Request reassigned', 'Dismiss', { duration: 3000 });
      },
      error: () => { this.isReassigning = false; },
    });
  }

  closeRequest(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Close Request',
        message: 'Are you sure you want to close this request? This action cannot be undone.',
        confirmLabel: 'Close Request',
        confirmColor: 'warn',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.requestsService.close(this.request!.id).subscribe({
        next: (r) => {
          this.request = r;
          this.snackBar.open('Request closed', 'Dismiss', { duration: 3000 });
        },
        error: () => this.snackBar.open('Failed to close request', 'Dismiss', { duration: 4000 }),
      });
    });
  }

  agentName(agentId: string): string {
    return this.agentMap[agentId] ?? agentId;
  }

  statusLabel(s: RequestStatus): string { return STATUS_LABELS[s] ?? s; }
  priorityLabel(p: string): string { return PRIORITY_LABELS[p as keyof typeof PRIORITY_LABELS] ?? p; }
  categoryLabel(c: string): string { return CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c; }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }
}
