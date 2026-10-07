import { Component, inject, OnDestroy, OnInit } from '@angular/core';
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
import { Subscription, interval } from 'rxjs';
import { RequestsService } from '../../../core/services/requests.service';
import { AttachmentsService } from '../../../core/services/attachments.service';
import { MessagesService } from '../../../core/services/messages.service';
import { AuthService } from '../../../core/services/auth.service';
import type { SupportRequest, Message, Attachment, User, RequestStatus } from '../../../core/models';
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
                <div *ngIf="messagesError" class="attachment-error" role="alert">
                  <span>{{ messagesError }}</span>
                  <button mat-button type="button" (click)="loadMessages(currentRequestId)">Retry</button>
                </div>

                <div *ngIf="!messagesLoading && !messagesError && messages.length === 0" class="empty-messages">
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
              <mat-card-content class="reply-area" *ngIf="canWorkOnRequest && request.status !== 'closed' && request.status !== 'resolved'">
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
                  <mat-tab label="Internal Note">
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
              <mat-card-content *ngIf="request.status === 'resolved'" class="closed-notice">
                <mat-icon>check_circle</mat-icon>
                This request is resolved. Reactivate it before sending another message.
              </mat-card-content>
              <mat-card-content *ngIf="!canWorkOnRequest && request.status !== 'closed' && request.status !== 'resolved'" class="closed-notice">
                <mat-icon>person_add</mat-icon>
                Claim this available request before replying or adding an internal note.
              </mat-card-content>
            </mat-card>

            <mat-card class="sidebar-card attachments-card">
              <mat-card-header>
                <mat-card-title>Attachments</mat-card-title>
                <mat-card-subtitle>Private files for this request</mat-card-subtitle>
              </mat-card-header>
              <mat-divider></mat-divider>
              <mat-card-content>
                <div *ngIf="attachmentsLoading" class="loading-center">
                  <mat-spinner diameter="28"></mat-spinner>
                </div>
                <div *ngIf="attachmentsError" class="attachment-error" role="alert">
                  <span>{{ attachmentsError }}</span>
                  <button mat-button type="button" (click)="loadAttachments(currentRequestId)">Retry</button>
                </div>
                <p *ngIf="!attachmentsLoading && !attachmentsError && attachments.length === 0" class="empty-attachments">
                  No attachments yet.
                </p>
                <ul *ngIf="attachments.length > 0" class="attachment-list" aria-label="Request attachments">
                  <li *ngFor="let attachment of attachments" class="attachment-item">
                    <div class="attachment-description">
                      <span class="attachment-name">{{ attachment.originalName }}</span>
                      <span class="attachment-meta">{{ formatBytes(attachment.size) }} · {{ attachment.uploaderName }}</span>
                    </div>
                    <button mat-button type="button" (click)="downloadAttachment(attachment)" [disabled]="isDownloadingAttachment">
                      {{ downloadingAttachmentId === attachment.id ? 'Downloading…' : 'Download' }}
                    </button>
                  </li>
                </ul>
                <div *ngIf="canUploadAttachment" class="attachment-upload">
                  <label for="request-attachment-upload" class="attachment-upload-label">
                    <mat-icon>attach_file</mat-icon>
                    {{ isUploadingAttachment ? 'Uploading…' : 'Attach file' }}
                  </label>
                  <input
                    id="request-attachment-upload"
                    class="attachment-upload-input"
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx"
                    [disabled]="isUploadingAttachment"
                    (change)="uploadAttachment($event)"
                    aria-label="Upload a request attachment"
                  />
                  <p class="attachment-meta">Up to 10 MB: images, PDF, text, CSV, Word, or Excel.</p>
                </div>
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

                <div class="action-section" *ngIf="canWorkOnRequest">
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
                    [disabled]="isClaiming"
                    *ngIf="currentUser?.role === 'agent' && !request.assignedAgentId && request.status !== 'resolved' && request.status !== 'closed'"
                  >
                    <mat-icon>person_add</mat-icon>
                    {{ isClaiming ? 'Claiming…' : 'Claim Available Request' }}
                  </button>

                  <div *ngIf="currentUser?.role === 'manager' && request.status !== 'closed'" class="reassign-section">
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

                <div class="action-section" *ngIf="canWorkOnRequest && request.status !== 'closed'">
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
    .attachments-card { margin-top: 16px; }
    .attachment-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #b91c1c; font-size: 0.85rem; }
    .empty-attachments { color: #64748b; font-size: 0.875rem; }
    .attachment-list { list-style: none; margin: 0; padding: 0; }
    .attachment-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
    .attachment-description { display: flex; min-width: 0; flex-direction: column; }
    .attachment-name { overflow: hidden; color: #334155; font-size: 0.85rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .attachment-meta { color: #64748b; font-size: 0.75rem; }
    .attachment-upload { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; margin-top: 16px; }
    .attachment-upload-label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; border: 1px solid #cbd5e1; border-radius: 10px; padding: 8px 12px; color: #334155; font-size: 0.85rem; font-weight: 600; }
    .attachment-upload-input { max-width: 100%; font-size: 0.8rem; }
  `],
})
export class RequestDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private requestsService = inject(RequestsService);
  private messagesService = inject(MessagesService);
  private attachmentsService = inject(AttachmentsService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  request: SupportRequest | null = null;
  messages: Message[] = [];
  attachments: Attachment[] = [];
  agents: User[] = [];
  currentRequestId = '';
  attachmentsLoading = true;
  attachmentsError = '';
  messagesError = '';
  isUploadingAttachment = false;
  isDownloadingAttachment = false;
  downloadingAttachmentId = '';
  private requestLoadSequence = 0;
  private messageLoadSequence = 0;
  private attachmentLoadSequence = 0;
  private subscriptions: Subscription[] = [];
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

  get currentUserId(): string {
    return this.currentUser?.id ?? '';
  }

  get canWorkOnRequest(): boolean {
    return this.currentUser?.role === 'manager' || this.request?.assignedAgentId === this.currentUserId;
  }

  get canUploadAttachment(): boolean {
    return Boolean(this.request
      && !['resolved', 'closed'].includes(this.request.status)
      && this.canWorkOnRequest);
  }

  ngOnInit(): void {
    this.subscriptions.push(this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id || id === this.currentRequestId) return;
      this.currentRequestId = id;
      this.request = null;
      this.messages = [];
      this.attachments = [];
      this.error = '';
      this.loadRequest(id);
      this.loadMessages(id);
      this.loadAttachments(id);
    }));
    this.subscriptions.push(interval(30_000).subscribe(() => {
      if (!this.currentRequestId || document.hidden) return;
      this.loadRequest(this.currentRequestId, true);
      this.loadMessages(this.currentRequestId, true);
      this.loadAttachments(this.currentRequestId, true);
    }));
    this.authService.getAllAgents().subscribe({
      next: (users) => {
        this.agents = users;
        this.agentMap = {};
        users.forEach((user) => { this.agentMap[user.id] = user.name; });
      },
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.requestLoadSequence += 1;
    this.messageLoadSequence += 1;
    this.attachmentLoadSequence += 1;
  }

  private computeTransitions(): void {
    if (!this.request) {
      this.availableTransitions = [];
      return;
    }
    const nexts = STATUS_TRANSITIONS[this.request.status] ?? [];
    this.availableTransitions = nexts.map((s) => ({ value: s, label: STATUS_LABELS[s] }));
  }

  loadRequest(id: string, quiet = false): void {
    const sequence = ++this.requestLoadSequence;
    if (!quiet) {
      this.isLoading = true;
      this.error = '';
    }
    this.requestsService.getOne(id).subscribe({
      next: (request) => {
        if (sequence !== this.requestLoadSequence || id !== this.currentRequestId) return;
        this.request = request;
        this.computeTransitions();
        this.isLoading = false;
      },
      error: (error: unknown) => {
        if (sequence !== this.requestLoadSequence || id !== this.currentRequestId) return;
        const accessDenied = error instanceof Error && error.message.includes('not found or access denied')
          || typeof error === 'object' && error !== null && 'status' in error && (error as { status?: number }).status === 403;
        if (!quiet || accessDenied || !this.request) {
          this.error = accessDenied ? 'This request is unavailable or you no longer have access.' : 'Request not found or you do not have access.';
        }
        if (accessDenied) {
          this.request = null;
          this.messages = [];
          this.attachments = [];
          this.messageLoadSequence += 1;
          this.attachmentLoadSequence += 1;
        }
        this.isLoading = false;
      },
    });
  }

  loadMessages(id: string, quiet = false): void {
    const sequence = ++this.messageLoadSequence;
    if (!quiet) {
      this.messagesLoading = true;
      this.messagesError = '';
    }
    this.messagesService.getForRequest(id).subscribe({
      next: (messages) => {
        if (sequence !== this.messageLoadSequence || id !== this.currentRequestId) return;
        const records = quiet ? [...this.messages, ...messages] : messages;
        this.messages = [...new Map(records.map((message) => [message.id, message])).values()]
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        this.messagesError = '';
        this.messagesLoading = false;
      },
      error: () => {
        if (sequence !== this.messageLoadSequence || id !== this.currentRequestId) return;
        if (!quiet) this.messagesError = 'Failed to load messages. Please retry.';
        this.messagesLoading = false;
      },
    });
  }

  loadAttachments(id: string, quiet = false): void {
    const sequence = ++this.attachmentLoadSequence;
    if (!quiet) {
      this.attachmentsLoading = true;
      this.attachmentsError = '';
    }
    this.attachmentsService.getForRequest(id).subscribe({
      next: (attachments) => {
        if (sequence !== this.attachmentLoadSequence || id !== this.currentRequestId) return;
        const records = quiet ? [...this.attachments, ...attachments] : attachments;
        this.attachments = [...new Map(records.map((attachment) => [attachment.id, attachment])).values()]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.attachmentsError = '';
        this.attachmentsLoading = false;
      },
      error: () => {
        if (sequence !== this.attachmentLoadSequence || id !== this.currentRequestId) return;
        if (!quiet) this.attachmentsError = 'Failed to load attachments. Please retry.';
        this.attachmentsLoading = false;
      },
    });
  }

  sendReply(isInternal: boolean): void {
    const content = this.replyControl.value?.trim() ?? '';
    if (content.length < 5) {
      this.replyControl.markAsTouched();
      this.snackBar.open('Message must contain at least five non-space characters.', 'Dismiss', { duration: 4000 });
      return;
    }
    this.isSending = true;
    this.messagesService.sendMessage(
      this.request!.id, content, isInternal
    ).subscribe({
      next: (msg) => {
        if (!this.messages.some((existing) => existing.id === msg.id)) this.messages = [...this.messages, msg];
        this.replyControl.reset();
        this.isSending = false;
        if (!isInternal && this.request) {
          this.request = { ...this.request, status: 'waiting_for_customer', updatedAt: msg.createdAt, resolvedAt: null };
          this.computeTransitions();
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
    if (!this.request || this.currentUser?.role !== 'agent' || this.request.assignedAgentId
      || ['resolved', 'closed'].includes(this.request.status)) return;
    this.isClaiming = true;
    this.requestsService.assign(this.request.id, this.currentUser.id, false, this.request.status).subscribe({
      next: (request) => {
        this.request = request;
        this.isClaiming = false;
        this.computeTransitions();
        this.snackBar.open('Request assigned to you', 'Dismiss', { duration: 3000 });
      },
      error: () => {
        this.isClaiming = false;
        this.snackBar.open('This request was already claimed or could not be claimed. Refresh the request and try again.', 'Dismiss', { duration: 5000 });
        this.loadRequest(this.currentRequestId, true);
      },
    });
  }

  reassign(): void {
    const agentId = this.reassignControl.value;
    if (!agentId || !this.request || this.currentUser?.role !== 'manager') return;
    this.isReassigning = true;
    this.requestsService.assign(this.request.id, agentId, true).subscribe({
      next: (request) => {
        this.request = request;
        this.reassignControl.reset();
        this.isReassigning = false;
        this.snackBar.open('Request reassigned', 'Dismiss', { duration: 3000 });
      },
      error: () => {
        this.isReassigning = false;
        this.snackBar.open('Failed to reassign this request. Refresh and try again.', 'Dismiss', { duration: 5000 });
      },
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
          this.computeTransitions();
          this.snackBar.open('Request closed', 'Dismiss', { duration: 3000 });
        },
        error: () => this.snackBar.open('Failed to close request', 'Dismiss', { duration: 4000 }),
      });
    });
  }

  uploadAttachment(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.currentRequestId || !this.canUploadAttachment || this.isUploadingAttachment) return;
    const requestId = this.currentRequestId;
    this.isUploadingAttachment = true;
    this.attachmentsService.upload(requestId, file).subscribe({
      next: (attachment) => {
        if (this.currentRequestId === requestId && !this.attachments.some((existing) => existing.id === attachment.id)) {
          this.attachments = [attachment, ...this.attachments];
        }
        this.attachmentsError = '';
        this.isUploadingAttachment = false;
        this.snackBar.open('Attachment uploaded', 'Dismiss', { duration: 3000 });
      },
      error: (error: Error) => {
        this.isUploadingAttachment = false;
        this.snackBar.open(error.message || 'Attachment upload failed. Please try again.', 'Dismiss', { duration: 5000 });
      },
    });
  }

  downloadAttachment(attachment: Attachment): void {
    if (this.isDownloadingAttachment) return;
    this.isDownloadingAttachment = true;
    this.downloadingAttachmentId = attachment.id;
    this.attachmentsService.download(attachment.storagePath).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = attachment.originalName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      },
      error: (error: Error) => {
        this.snackBar.open(error.message || 'Download failed. Please try again.', 'Dismiss', { duration: 5000 });
        this.isDownloadingAttachment = false;
        this.downloadingAttachmentId = '';
      },
      complete: () => {
        this.isDownloadingAttachment = false;
        this.downloadingAttachmentId = '';
      },
    });
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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