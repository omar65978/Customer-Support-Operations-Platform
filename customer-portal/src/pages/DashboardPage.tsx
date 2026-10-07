import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AppLayout } from "../components/layout/AppLayout";
import { RequestCard } from "../components/requests/RequestCard";
import { EmptyState } from "../components/ui/EmptyState";
import { PageSpinner } from "../components/ui/Spinner";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { useRequests } from "../hooks/useRequests";
import type { RequestFilters } from "../api/requests";
import type { RequestStatus, RequestPriority, RequestCategory } from "../types";

const STATUS_OPTIONS: { value: RequestStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_for_customer", label: "Waiting for Reply" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS: { value: RequestPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const CATEGORY_OPTIONS: { value: RequestCategory; label: string }[] = [
  { value: "billing", label: "Billing" },
  { value: "technical", label: "Technical" },
  { value: "account", label: "Account" },
  { value: "general", label: "General" },
];

export function DashboardPage() {
  const { user } = useAuth();
  const {
    requests,
    total,
    page,
    totalPages,
    isLoading,
    error,
    reload,
    applyFilters,
    goToPage,
  } = useRequests(user?.id ?? "");

  const [localFilters, setLocalFilters] = useState<RequestFilters>({});

  function handleFilterChange(key: keyof RequestFilters, value: string) {
    const next = { ...localFilters, [key]: value || undefined };
    if (!value) delete next[key];
    setLocalFilters(next);
    applyFilters(next);
  }

  function clearFilters() {
    setLocalFilters({});
    applyFilters({});
  }

  const hasActiveFilters = Object.keys(localFilters).some((k) => localFilters[k as keyof RequestFilters]);

  return (
    <AppLayout>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">My Support Requests</h1>
          <p className="mt-1 text-slate-500">
            Welcome back, <span className="font-medium text-slate-700">{user?.name}</span>. Here are your requests.
          </p>
        </div>
        <Link to="/new-request" id="new-request-btn" className="btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Request
        </Link>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[140px]">
            <label htmlFor="filter-status" className="label mb-1">Status</label>
            <select
              id="filter-status"
              value={localFilters.status ?? ""}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="input-field py-2"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[140px]">
            <label htmlFor="filter-priority" className="label mb-1">Priority</label>
            <select
              id="filter-priority"
              value={localFilters.priority ?? ""}
              onChange={(e) => handleFilterChange("priority", e.target.value)}
              className="input-field py-2"
            >
              <option value="">All Priorities</option>
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[140px]">
            <label htmlFor="filter-category" className="label mb-1">Category</label>
            <select
              id="filter-category"
              value={localFilters.category ?? ""}
              onChange={(e) => handleFilterChange("category", e.target.value)}
              className="input-field py-2"
            >
              <option value="">All Categories</option>
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="btn btn-secondary py-2 mt-5"
                id="clear-filters-btn"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
        {!isLoading && !error && (
          <p className="mt-2 text-xs text-slate-400">
            {total === 0 ? "No requests found" : `${total} request${total !== 1 ? "s" : ""} found`}
          </p>
        )}
      </div>

      {isLoading && <PageSpinner />}
      {error && <ErrorAlert message={error} onRetry={reload} />}

      {!isLoading && !error && requests.length === 0 && (
        <EmptyState
          icon="📭"
          title="No requests found"
          description={hasActiveFilters ? "Try adjusting or clearing your filters." : "Submit your first support request and we will get back to you quickly."}
          action={
            !hasActiveFilters ? (
              <Link to="/new-request" className="btn-primary">Submit a Request</Link>
            ) : (
              <button onClick={clearFilters} className="btn-primary">Clear Filters</button>
            )
          }
        />
      )}

      {!isLoading && !error && requests.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {requests.map((req) => (
              <RequestCard key={req.id} request={req} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="btn btn-secondary px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                id="prev-page-btn"
              >
                ← Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    p === page
                      ? "bg-brand-600 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600"
                  }`}
                  aria-current={p === page ? "page" : undefined}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="btn btn-secondary px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
                id="next-page-btn"
              >
                Next →
              </button>
            </div>
          )}

          <p className="mt-3 text-center text-xs text-slate-400">
            Page {page} of {totalPages} · {total} total request{total !== 1 ? "s" : ""}
          </p>
        </>
      )}
    </AppLayout>
  );
}