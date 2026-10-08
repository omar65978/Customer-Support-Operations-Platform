import { useEffect, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AppLayout } from "../components/layout/AppLayout";
import { RequestCard } from "../components/requests/RequestCard";
import { RequestGroupTabs } from "../components/requests/RequestList";
import { EmptyState } from "../components/ui/EmptyState";
import { PageSpinner } from "../components/ui/Spinner";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { useRequests } from "../hooks/useRequests";
import type { RequestSort } from "../api/requests";
import type { RequestCategory, RequestPriority } from "../types";

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

const SORT_OPTIONS: { value: RequestSort; label: string }[] = [
  { value: "updated", label: "Last updated" },
  { value: "created", label: "Newest first" },
  { value: "urgency", label: "Most urgent first" },
];

export function DashboardPage() {
  const { user } = useAuth();
  const {
    requests,
    total,
    page,
    totalPages,
    filters,
    isLoading,
    error,
    reload,
    updateFilters,
    clearFilters,
    goToPage,
  } = useRequests(user?.id ?? "");

  const [searchDraft, setSearchDraft] = useState(filters.search);

  // Search runs on the server, so wait for a short pause in typing before querying.
  useEffect(() => {
    if (searchDraft === filters.search) return;
    const timer = window.setTimeout(() => updateFilters({ search: searchDraft }), 350);
    return () => window.clearTimeout(timer);
  }, [searchDraft, filters.search, updateFilters]);

  const hasActiveFilters =
    filters.group !== "all" || filters.priority !== "" || filters.category !== "" || filters.search !== "";
  const showEmpty = !isLoading && !error && requests.length === 0;

  function handleClear() {
    setSearchDraft("");
    clearFilters();
  }

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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Request
        </Link>
      </div>

      <div className="mb-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <RequestGroupTabs value={filters.group} onChange={(group) => updateFilters({ group })} />

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-[2]">
            <label htmlFor="search-requests" className="label mb-1">Search</label>
            <input
              id="search-requests"
              type="search"
              value={searchDraft}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchDraft(e.target.value)}
              placeholder="Search by title or reference"
              className="input-field py-2"
            />
          </div>

          <div className="min-w-[140px] flex-1">
            <label htmlFor="filter-priority" className="label mb-1">Urgency</label>
            <select
              id="filter-priority"
              value={filters.priority}
              onChange={(e) => updateFilters({ priority: e.target.value as RequestPriority | "" })}
              className="input-field py-2"
            >
              <option value="">All urgencies</option>
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[140px] flex-1">
            <label htmlFor="filter-category" className="label mb-1">Category</label>
            <select
              id="filter-category"
              value={filters.category}
              onChange={(e) => updateFilters({ category: e.target.value as RequestCategory | "" })}
              className="input-field py-2"
            >
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[160px] flex-1">
            <label htmlFor="sort-requests" className="label mb-1">Sort by</label>
            <select
              id="sort-requests"
              value={filters.sort}
              onChange={(e) => updateFilters({ sort: e.target.value as RequestSort })}
              className="input-field py-2"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <div className="flex">
              <button type="button" onClick={handleClear} className="btn btn-secondary py-2" id="clear-filters-btn">
                Clear filters
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500" aria-live="polite">
          {!isLoading && !error && (total === 0 ? "No requests found" : `${total} request${total !== 1 ? "s" : ""} found`)}
        </p>
      </div>

      {isLoading && requests.length === 0 && <PageSpinner />}
      {error && <ErrorAlert message={error} onRetry={reload} />}

      {showEmpty && (
        <EmptyState
          icon="📭"
          title={hasActiveFilters ? "No requests match these filters" : "No requests yet"}
          description={
            hasActiveFilters
              ? "Try a different search or clear the filters."
              : "Submit your first support request and we will get back to you quickly."
          }
          action={
            hasActiveFilters ? (
              <button type="button" onClick={handleClear} className="btn-primary">Clear filters</button>
            ) : (
              <Link to="/new-request" className="btn-primary">Submit a Request</Link>
            )
          }
        />
      )}

      {!error && requests.length > 0 && (
        <>
          <div id="request-list" role="tabpanel" aria-labelledby={`group-tab-${filters.group}`} className="flex flex-col gap-3">
            {requests.map((req) => (
              <RequestCard key={req.id} request={req} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="btn btn-secondary px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                id="prev-page-btn"
              >
                ← Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => goToPage(p)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    p === page
                      ? "bg-brand-600 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600"
                  }`}
                  aria-current={p === page ? "page" : undefined}
                  aria-label={`Page ${p}`}
                >
                  {p}
                </button>
              ))}

              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="btn btn-secondary px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                id="next-page-btn"
              >
                Next →
              </button>
            </nav>
          )}

          <p className="mt-3 text-center text-xs text-slate-400">
            Page {page} of {totalPages} · {total} total request{total !== 1 ? "s" : ""}
          </p>
        </>
      )}

      {isLoading && requests.length > 0 && <span className="sr-only" role="status">Updating list…</span>}
    </AppLayout>
  );
}
