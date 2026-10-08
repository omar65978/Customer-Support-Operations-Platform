export type UserRole = 'customer' | 'agent' | 'manager';
export type RequestCategory = 'billing' | 'technical' | 'account' | 'general';
export type RequestPriority = 'low' | 'medium' | 'high' | 'urgent';
export type RequestStatus = 'open' | 'in_progress' | 'waiting_for_customer' | 'resolved' | 'closed';

/** Roles that may use the Support Workspace. Customers use the customer portal. */
export const STAFF_ROLES: readonly UserRole[] = ['agent', 'manager'];

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface SupportRequest {
  id: string;
  reference: string;
  customerId: string;
  assignedAgentId: string | null;
  title: string;
  description: string;
  category: RequestCategory;
  priority: RequestPriority;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface Message {
  id: string;
  requestId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

export interface Attachment {
  id: string;
  requestId: string;
  uploadedBy: string;
  uploaderName: string;
  uploaderRole: UserRole;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_for_customer: 'Waiting for Customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const PRIORITY_LABELS: Record<RequestPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const CATEGORY_LABELS: Record<RequestCategory, string> = {
  billing: 'Billing',
  technical: 'Technical',
  account: 'Account',
  general: 'General',
};

/**
 * Allowed status changes. The database enforces the same table, so an invalid change is
 * rejected even if this list is bypassed. Closing is only possible from Resolved.
 */
export const STATUS_TRANSITIONS: Partial<Record<RequestStatus, RequestStatus[]>> = {
  open: ['in_progress'],
  in_progress: ['waiting_for_customer', 'resolved'],
  waiting_for_customer: ['in_progress', 'resolved'],
  resolved: ['in_progress', 'closed'],
  closed: [],
};

/** Requests in these statuses accept replies, internal notes and attachments. */
export const ACTIVE_STATUSES: readonly RequestStatus[] = ['open', 'in_progress', 'waiting_for_customer'];

export function isStaffRole(role: string | undefined | null): role is 'agent' | 'manager' {
  return role === 'agent' || role === 'manager';
}
