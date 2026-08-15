import type { RequestStatus, RequestPriority, RequestCategory } from "../types";

export const STATUS_LABELS: Record<RequestStatus, string> = {
  open: "Submitted",
  in_progress: "Being Handled",
  waiting_for_customer: "Awaiting Your Reply",
  resolved: "Resolved",
  closed: "Closed",
};

export const STATUS_DESCRIPTIONS: Record<RequestStatus, string> = {
  open: "Your request has been received and is waiting to be picked up by our support team.",
  in_progress: "A support agent is actively working on your request.",
  waiting_for_customer: "Our team has responded and is waiting for additional information from you.",
  resolved: "Your issue has been resolved. Please review the solution and let us know if you need further assistance.",
  closed: "This request has been closed. Please submit a new request if you need further help.",
};

export const PRIORITY_LABELS: Record<RequestPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const CATEGORY_LABELS: Record<RequestCategory, string> = {
  billing: "Billing",
  technical: "Technical",
  account: "Account",
  general: "General",
};

export const STATUS_COLORS: Record<RequestStatus, string> = {
  open: "bg-slate-100 text-slate-700 border-slate-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  waiting_for_customer: "bg-amber-50 text-amber-700 border-amber-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-gray-50 text-gray-500 border-gray-200",
};

export const PRIORITY_COLORS: Record<RequestPriority, string> = {
  low: "bg-gray-50 text-gray-600 border-gray-200",
  medium: "bg-sky-50 text-sky-700 border-sky-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  urgent: "bg-red-50 text-red-700 border-red-200",
};
