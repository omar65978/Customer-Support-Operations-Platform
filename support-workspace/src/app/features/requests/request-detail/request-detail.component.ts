import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription, interval } from 'rxjs';
import { RequestsService } from '../../../core/services/requests.service';
import { MessagesService } from '../../../core/services/messages.service';
import { AttachmentsService } from '../../../core/services/attachments.service';
import { AuthService } from '../../../core/services/auth.service';
import type { Attachment, Message, SupportRequest, User, RequestStatus } from '../../../core/models';
import {
  ACTIVE_STATUSES,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  STATUS_TRANSITIONS,
} from '../../../core/models';
import { ATTACHMENT_EXTENSIONS, validateAttachmentFile } from '../../../core/utils/attachments';
import { describeError } from '../../../core/utils/errors';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/** Adds or replaces items by id and keeps them in order, so a refresh never duplicates an item. */
function mergeById<T extends { id: string }>(current: T[], incoming: T[], time: (item: T) => number): T[] {
  const byId = new Map<string, T>();
  for (const item of current) byId.set(item.id, item);
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => time(a) - time(b));
}

const messageTime = (m: Message) => new Date(m.createdAt).getTime();
const attachmentTime = (a: Attachment) => new Date(a.createdAt).getTime();

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
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTabsModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="detail-container">
      <div class="back-row">
        <button mat-icon-button routerLink="/dashboard" id="back-btn" matTooltip="Back to work queue" aria-label="Back to work queue">
          <mat-icon aria-hidden="true">arrow_back</mat-icon>
        </button>
        <span class="back-label">Work queue</span>
      </div>

      <div *ngIf="isLoading" class="loading-center" role="status">
        <mat-spinner diameter="48"></mat-spinner>
        <span class="sr-only">Loading request</span>
      </div>

      <div *ngIf="error && !isLoading" class="error-state" role="alert">
        <mat-icon class="error-icon" aria-hidden="true">error_outline</mat-icon>
        <p>{{ error }}</p>
        <a mat-stroked-button routerLink="/dashboard">Back to work queue</a>
      </div>

      <div *ngIf="request && !isLoading" class="detail-grid">
        <div class="main-column">
          <mat-card class="header-card">
            <mat-card-content>
              <div class="header-top">
                <span class="reference-badge">{{ request.reference }}</span>
                <span class="status-badge status-{{ request.status }}">{{ statusLabel(request.status) }}</span>
                <span class="priority-badge priority-{{ request.priority }}">Urgency: {{ priorityLabel(request.priority) }}</span>
              </div>
              <h1 class="request-title">{{ request.title }}</h1>
              <p class="request-meta">
                {{ categoryLabel(request.category) }} · Customer: {{ customer?.name ?? 'Unknown customer' }}
                <span *ngIf="customer?.email"> · {{ customer?.email }}</span>
              </p>
              <p class="request-description">{{ request.description }}</p>
            </mat-card-content>
          </mat-card>

          <mat-card class="conversation-card">
            <mat-card-header>
              <mat-card-title>Conversation</mat-card-title>
              <mat-card-subtitle>{{ messages.length }} message{{ messages.length !== 1 ? 's' : '' }}</mat-card-subtitle>
            </mat-card-header>

            <mat-card-content>
              <div *ngIf="messageError" class="error-line" role="alert">{{ messageError }}</div>
              <div class="message-list" role="log" aria-live="polite" aria-label="Conversation" id="message-list">
                <article
                  *ngFor="let m of messages"
                  class="message"
                  [class.message--internal]="m.isInternal"
                  [class.message--staff]="m.authorRole !== 'customer'"
                  [attr.data-message-id]="m.id"
                >
                  <header class="message-meta">
                    <strong>{{ m.authorName }}</strong>
                    <span class="role-tag">{{ m.authorRole }}</span>
                    <span *ngIf="m.isInternal" class="internal-tag">Internal note · staff only</span>
                    <time [attr.datetime]="m.createdAt">{{ formatDate(m.createdAt) }}</time>
                  </header>
                  <p class="message-body">{{ m.content }}</p>
                </article>
                <p *ngIf="messages.length === 0 && !messagesLoading" class="hint">No messages yet.</p>
              </div>
            </mat-card-content>

            <mat-card-content class="composer" *ngIf="isActive">
              <mat-tab-group id="reply-tabs" animationDuration="0ms">
                <mat-tab label="Reply to customer">
                  <div class="composer-body">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Message to the customer</mat-label>
                      <textarea matInput rows="3" id="reply-input" [formControl]="replyControl" [readonly]="!canPost" maxlength="5000"></textarea>
                      <mat-error *ngIf="replyControl.touched && replyControl.hasError('minlength')">Replies need at least 5 characters.</mat-error>
                    </mat-form-field>
                    <div class="composer-actions">
                      <button mat-flat-button color="primary" type="button" id="send-reply-btn" (click)="sendReply()" [disabled]="!canPost || isSending">
                        {{ isSending ? 'Sending…' : 'Send reply' }}
                      </button>
                    </div>
                  </div>
                </mat-tab>
                <mat-tab label="Internal note">
                  <div class="composer-body">
                    <p class="hint">Internal notes are visible to support staff only. Customers never see them.</p>
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Internal note</mat-label>
                      <textarea matInput rows="3" id="note-input" [formControl]="noteControl" [readonly]="!canPost" maxlength="5000"></textarea>
                    </mat-form-field>
                    <div class="composer-actions">
                      <button mat-flat-button color="accent" type="button" id="send-note-btn" (click)="sendNote()" [disabled]="!canPost || isSending">
                        Add internal note
                      </button>
                    </div>
                  </div>
                </mat-tab>
              </mat-tab-group>
              <p *ngIf="postingHint" class="hint" role="note">{{ postingHint }}</p>
            </mat-card-content>

            <mat-card-content *ngIf="!isActive" class="closed-notice">
              <p>{{ inactiveNotice }}</p>
            </mat-card-content>
          </mat-card>

          <mat-card class="attachments-card">
            <mat-card-header>
              <mat-card-title>Attachments</mat-card-title>
              <mat-card-subtitle>{{ attachments.length }} file{{ attachments.length !== 1 ? 's' : '' }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div class="attachment-toolbar" *ngIf="canPost">
                <button mat-stroked-button type="button" id="attach-btn" (click)="fileInput.click()" [disabled]="isUploading">
                  {{ isUploading ? 'Uploading…' : 'Attach file' }}
                </button>
                <input #fileInput type="file" class="visually-hidden" tabindex="-1" aria-hidden="true" [accept]="acceptList" (change)="onFileSelected($event)" />
                <span class="hint">{{ acceptHint }}</span>
              </div>
              <div *ngIf="attachmentError" class="error-line" role="alert">{{ attachmentError }}</div>
              <p *ngIf="attachments.length === 0" class="hint">No attachments yet.</p>
              <ul *ngIf="attachments.length > 0" class="attachment-list" aria-label="Attachments">
                <li *ngFor="let a of attachments" class="attachment-item">
                  <div class="attachment-info">
                    <span class="attachment-name" [title]="a.originalName">{{ a.originalName }}</span>
                    <span class="hint">{{ formatBytes(a.size) }} · {{ a.uploaderName }} · {{ formatDate(a.createdAt) }}</span>
                  </div>
                  <button mat-button type="button" (click)="download(a)" [attr.aria-label]="'Download ' + a.originalName">Download</button>
                </li>
              </ul>
            </mat-card-content>
          </mat-card>
        </div>

        <aside class="side-column">
          <mat-card class="sidebar-card actions-card">
            <mat-card-header><mat-card-title>Actions</mat-card-title></mat-card-header>
            <mat-card-content class="actions-content">
              <div *ngIf="canClaim" class="action-block">
                <p class="hint">Nobody owns this request yet.</p>
                <button mat-flat-button color="primary" type="button" class="full-width" id="claim-btn" (click)="claimRequest()" [disabled]="isClaiming">
                  {{ isClaiming ? 'Taking…' : 'Take this request' }}
                </button>
              </div>

              <div *ngIf="canChangeStatus" class="action-block">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Change status</mat-label>
                  <mat-select [formControl]="statusControl" id="status-select" aria-label="New status">
                    <mat-option *ngFor="let t of availableTransitions" [value]="t.value">{{ t.label }}</mat-option>
                  </mat-select>
                </mat-form-field>
                <button mat-flat-button color="primary" type="button" class="full-width" id="update-status-btn" (click)="updateStatus()" [disabled]="!statusControl.value || isUpdating">
                  {{ isUpdating ? 'Updating…' : 'Update status' }}
                </button>
              </div>

              <div *ngIf="canReassign" class="action-block">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>{{ request.assignedAgentId ? 'Reassign to' : 'Assign to' }}</mat-label>
                  <mat-select [formControl]="reassignControl" id="reassign-select">
                    <mat-option *ngFor="let s of staffOptions" [value]="s.id">{{ s.name }} ({{ s.role }})</mat-option>
                  </mat-select>
                </mat-form-field>
                <button mat-stroked-button type="button" class="full-width" id="reassign-btn" (click)="reassign()" [disabled]="!reassignControl.value || isReassigning">
                  {{ request.assignedAgentId ? 'Reassign' : 'Assign' }}
                </button>
              </div>

              <div *ngIf="canClose" class="action-block">
                <button mat-stroked-button color="warn" type="button" class="full-width" id="close-request-btn" (click)="closeRequest()">
                  Close request
                </button>
              </div>

              <p *ngIf="actionError" class="error-line" role="alert">{{ actionError }}</p>
              <p *ngIf="!canClaim && !canChangeStatus && !canReassign && !canClose" class="hint">
                No actions are available for this request in its current state.
              </p>
            </mat-card-content>
          </mat-card>

          <mat-card class="sidebar-card">
            <mat-card-header><mat-card-title>Request details</mat-card-title></mat-card-header>
            <mat-card-content class="details-content">
              <dl>
                <dt>Owner</dt>
                <dd>{{ ownerLabel }}</dd>
                <dt>Submitted</dt>
                <dd>{{ formatDate(request.createdAt) }}</dd>
                <dt>Last updated</dt>
                <dd>{{ formatDate(request.updatedAt) }}</dd>
                <ng-container *ngIf="request.resolvedAt">
                  <dt>Resolved</dt>
                  <dd>{{ formatDate(request.resolvedAt) }}</dd>
                </ng-container>
              </dl>
            </mat-card-content>
          </mat-card>
        </aside>
      </div>
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

    .header-card, .conversation-card, .attachments-card { border-radius: 16px !important; }
    .header-top { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px; }
    .request-title { font-size: 1.4rem; font-weight: 700; color: #0f172a; margin: 0 0 6px; }
    .request-meta { color: #64748b; font-size: 0.85rem; margin: 0 0 12px; }
    .request-description { white-space: pre-wrap; color: #334155; margin: 0; line-height: 1.55; }
    .message-list { display: flex; flex-direction: column; gap: 14px; max-height: 480px; overflow-y: auto; padding: 4px 2px 12px; }
    .message { border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 14px; background: #ffffff; }
    .message--staff { background: #f8fbff; }
    .message--internal { background: #fff7ed; border-color: #fed7aa; }
    .message-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; font-size: 0.8rem; color: #475569; margin-bottom: 4px; }
    .message-body { white-space: pre-wrap; margin: 0; color: #0f172a; line-height: 1.5; }
    .role-tag { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
    .internal-tag { font-size: 0.7rem; font-weight: 600; color: #9a3412; }
    .composer { border-top: 1px solid #e2e8f0; padding-top: 8px !important; }
    .composer-body { padding-top: 12px; }
    .composer-actions { display: flex; justify-content: flex-end; }
    .hint { color: #64748b; font-size: 0.8rem; margin: 6px 0; }
    .error-line { color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 10px; font-size: 0.85rem; margin: 8px 0; }
    .closed-notice p { color: #475569; margin: 8px 0; }
    .attachment-toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 8px; }
    .attachment-list { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 8px; }
    .attachment-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 12px; }
    .attachment-info { display: flex; flex-direction: column; min-width: 0; }
    .attachment-name { font-weight: 500; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .action-block { margin-bottom: 16px; }
    .details-content dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 0; font-size: 0.875rem; }
    .details-content dt { color: #64748b; }
    .details-content dd { margin: 0; color: #0f172a; }
    .visually-hidden, .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    :focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
    @media (max-width: 600px) {
      .attachment-item { flex-direction: column; align-items: flex-start; }
    }
`],
})
export class RequestDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private requestsService = inject(RequestsService);
  private messagesService = inject(MessagesService);
  private attachmentsService = inject(AttachmentsService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  request: SupportRequest | null = null;
  customer: User | null = null;
  messages: Message[] = [];
  attachments: Attachment[] = [];
  staff: User[] = [];
  availableTransitions: { value: RequestStatus; label: string }[] = [];

  isLoading = true;
  messagesLoading = true;
  error = '';
  messageError = '';
  attachmentError = '';
  actionError = '';
  isSending = false;
  isUpdating = false;
  isClaiming = false;
  isReassigning = false;
  isUploading = false;

  /** Public replies and internal notes have separate controls, so one can never be sent as the other. */
  replyControl = new FormControl('', { nonNullable: true, validators: [Validators.minLength(5)] });
  noteControl = new FormControl('', { nonNullable: true });
  statusControl = new FormControl<RequestStatus | ''>('', { nonNullable: true });
  reassignControl = new FormControl('', { nonNullable: true });

  readonly acceptList = ATTACHMENT_EXTENSIONS.join(',');
  readonly acceptHint = `${ATTACHMENT_EXTENSIONS.join(', ')} · up to 10 MB`;

  private subs: Subscription[] = [];
  private requestId = '';

  get currentUser(): User | null {
    return this.authService.currentUser;
  }

  get isManager(): boolean {
    return this.currentUser?.role === 'manager';
  }

  get isOwner(): boolean {
    return !!this.request && !!this.currentUser && this.request.assignedAgentId === this.currentUser.id;
  }

  get isActive(): boolean {
    return !!this.request && ACTIVE_STATUSES.includes(this.request.status);
  }

  /** Replies, notes and uploads: an active request, and the assigned agent or a manager. */
  get canPost(): boolean {
    return this.isActive && (this.isManager || this.isOwner);
  }

  get canClaim(): boolean {
    return !!this.request && !this.request.assignedAgentId && this.isActive;
  }

  get canChangeStatus(): boolean {
    return (
      !!this.request &&
      !!this.request.assignedAgentId &&
      (this.isManager || this.isOwner) &&
      this.availableTransitions.length > 0
    );
  }

  get canReassign(): boolean {
    return !!this.request && this.isManager && this.request.status !== 'closed';
  }

  get canClose(): boolean {
    return !!this.request && this.request.status === 'resolved' && (this.isManager || this.isOwner);
  }

  get staffOptions(): User[] {
    return this.staff.filter((s) => s.id !== this.request?.assignedAgentId);
  }

  get ownerLabel(): string {
    if (!this.request?.assignedAgentId) return 'Unassigned';
    return this.staffName(this.request.assignedAgentId);
  }

  get postingHint(): string {
    if (!this.isActive || this.canPost) return '';
    if (!this.request?.assignedAgentId) return 'Take this request to reply to the customer or add internal notes.';
    return 'Only the assigned agent or a manager can reply to this request.';
  }

  get inactiveNotice(): string {
    if (this.request?.status === 'resolved') {
      return 'This request is resolved. Change its status to In Progress to reopen the conversation.';
    }
    if (this.request?.status === 'closed') {
      return 'This request is closed. Replies, notes and attachments are no longer accepted.';
    }
    return '';
  }

  ngOnInit(): void {
    this.requestId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadStaff();
    this.loadRequest(false);
    this.loadMessages(false);
    this.loadAttachments();
    // Refresh the conversation and status while the page is open. Merged by id, so nothing repeats.
    this.track(
      interval(15_000).subscribe(() => {
        if (document.visibilityState !== 'visible') return;
        this.loadRequest(true);
        this.loadMessages(true);
        this.loadAttachments(true);
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  /** Keeps a subscription until it finishes or the page closes, and drops finished ones. */
  private track(subscription: Subscription): void {
    this.subs = this.subs.filter((s) => !s.closed);
    this.subs.push(subscription);
  }

  sendReply(): void {
    this.send(this.replyControl.value.trim(), false, this.replyControl);
  }

  sendNote(): void {
    this.send(this.noteControl.value.trim(), true, this.noteControl);
  }

  updateStatus(): void {
    const next = this.statusControl.value;
    if (!next) return;
    this.applyStatus(next);
  }

  claimRequest(): void {
    const staffId = this.currentUser?.id;
    if (!this.request || !staffId) return;
    this.isClaiming = true;
    this.actionError = '';
    this.track(
      this.requestsService.claim(this.request.id, staffId).subscribe({
        next: (updated) => {
          this.request = updated;
          this.computeTransitions();
          this.isClaiming = false;
          this.snackBar.open('You are now handling this request.', 'Dismiss', { duration: 3000 });
        },
        error: (err: unknown) => {
          this.isClaiming = false;
          this.actionError = describeError(err, 'The request could not be claimed. Please try again.');
          this.loadRequest(true);
        },
      })
    );
  }

  reassign(): void {
    const nextId = this.reassignControl.value;
    if (!this.request || !nextId) return;
    this.isReassigning = true;
    this.actionError = '';
    this.track(
      this.requestsService.assign(this.request.id, this.request.assignedAgentId, nextId).subscribe({
        next: (updated) => {
          this.request = updated;
          this.computeTransitions();
          this.reassignControl.setValue('');
          this.isReassigning = false;
          this.snackBar.open(`Request assigned to ${this.staffName(nextId)}.`, 'Dismiss', { duration: 3000 });
        },
        error: (err: unknown) => {
          this.isReassigning = false;
          this.actionError = describeError(err, 'The request could not be reassigned. Please try again.');
          this.loadRequest(true);
        },
      })
    );
  }

  closeRequest(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Close request',
        message: 'Close this request? Customers will no longer be able to reply, and a closed request cannot be reopened.',
        confirmLabel: 'Close request',
        confirmColor: 'warn',
      },
    });
    this.track(ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) this.applyStatus('closed');
    }));
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.request) return;

    const problem = validateAttachmentFile(file);
    if (problem) {
      this.attachmentError = problem;
      return;
    }
    this.isUploading = true;
    this.attachmentError = '';
    this.track(
      this.attachmentsService.upload(this.request.id, file).subscribe({
        next: (attachment) => {
          this.attachments = mergeById(this.attachments, [attachment], attachmentTime);
          this.isUploading = false;
          this.snackBar.open(`${file.name} was attached.`, 'Dismiss', { duration: 3000 });
        },
        error: (err: unknown) => {
          this.isUploading = false;
          this.attachmentError = describeError(err, 'The file could not be uploaded. It was not attached.');
        },
      })
    );
  }

  download(attachment: Attachment): void {
    this.attachmentError = '';
    this.track(
      this.attachmentsService.download(attachment).subscribe({
        error: (err: unknown) => {
          this.attachmentError = describeError(err, `${attachment.originalName} could not be downloaded. Please try again.`);
        },
      })
    );
  }

  statusLabel(s: RequestStatus): string {
    return STATUS_LABELS[s] ?? s;
  }

  priorityLabel(p: string): string {
    return PRIORITY_LABELS[p as keyof typeof PRIORITY_LABELS] ?? p;
  }

  categoryLabel(c: string): string {
    return CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c;
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  private staffName(id: string): string {
    return this.staff.find((s) => s.id === id)?.name ?? 'a support agent';
  }

  private computeTransitions(): void {
    const next = this.request ? STATUS_TRANSITIONS[this.request.status] ?? [] : [];
    // Closing has its own confirmed action, so it is not in the status list.
    this.availableTransitions = next
      .filter((s) => s !== 'closed')
      .map((s) => ({ value: s, label: STATUS_LABELS[s] }));
  }

  private loadStaff(): void {
    this.track(
      this.authService.getStaff().subscribe({
        next: (users) => {
          this.staff = users;
        },
        error: () => undefined,
      })
    );
  }

  private loadRequest(silent: boolean): void {
    this.track(
      this.requestsService.getOne(this.requestId).subscribe({
        next: (req) => {
          this.request = req;
          this.error = '';
          this.computeTransitions();
          this.isLoading = false;
          if (!this.customer || this.customer.id !== req.customerId) this.loadCustomer(req.customerId);
        },
        error: (err: unknown) => {
          this.isLoading = false;
          if (!silent) {
            this.request = null;
            this.error = describeError(err, 'This request was not found, or you do not have access to it.');
          }
        },
      })
    );
  }

  private loadCustomer(customerId: string): void {
    this.track(
      this.authService.getUser(customerId).subscribe({
        next: (user) => {
          this.customer = user;
        },
        error: () => undefined,
      })
    );
  }

  private loadMessages(silent: boolean): void {
    this.track(
      this.messagesService.getForRequest(this.requestId).subscribe({
        next: (list) => {
          this.messages = mergeById(this.messages, list, messageTime);
          this.messagesLoading = false;
          this.messageError = '';
        },
        error: (err: unknown) => {
          this.messagesLoading = false;
          if (!silent) this.messageError = describeError(err, 'The conversation could not be loaded.');
        },
      })
    );
  }

  private loadAttachments(silent = false): void {
    this.track(
      this.attachmentsService.list(this.requestId).subscribe({
        next: (list) => {
          this.attachments = mergeById(this.attachments, list, attachmentTime);
        },
        error: (err: unknown) => {
          if (!silent) this.attachmentError = describeError(err, 'Attachments could not be loaded.');
        },
      })
    );
  }

  private send(content: string, isInternal: boolean, control: FormControl<string>): void {
    const minimum = isInternal ? 1 : 5;
    if (!this.request || !this.canPost) return;
    if (content.length < minimum) {
      control.markAsTouched();
      this.snackBar.open(isInternal ? 'Write a note before adding it.' : 'Replies need at least 5 characters.', 'Dismiss', { duration: 3000 });
      return;
    }
    this.isSending = true;
    this.track(
      this.messagesService.sendMessage(this.request.id, content, isInternal).subscribe({
        next: (message) => {
          this.messages = mergeById(this.messages, [message], messageTime);
          control.setValue('');
          this.isSending = false;
          this.snackBar.open(isInternal ? 'Internal note added.' : 'Reply sent.', 'Dismiss', { duration: 3000 });
          // The database can change the status when a message is saved, so reload it.
          this.loadRequest(true);
        },
        error: (err: unknown) => {
          // The text stays in the box so nothing is lost.
          this.isSending = false;
          this.snackBar.open(describeError(err, 'Your message was not sent. Your text is still in the box.'), 'Dismiss', { duration: 5000 });
        },
      })
    );
  }

  private applyStatus(next: RequestStatus): void {
    if (!this.request) return;
    const current = this.request;
    this.isUpdating = true;
    this.actionError = '';
    this.track(
      this.requestsService.updateStatus(current.id, current.status, next).subscribe({
        next: (updated) => {
          this.request = updated;
          this.computeTransitions();
          this.statusControl.setValue('');
          this.isUpdating = false;
          this.snackBar.open(`Status updated to "${STATUS_LABELS[next]}".`, 'Dismiss', { duration: 3000 });
        },
        error: (err: unknown) => {
          this.isUpdating = false;
          this.actionError = describeError(err, 'The status could not be updated. Please try again.');
          this.loadRequest(true);
        },
      })
    );
  }
}
