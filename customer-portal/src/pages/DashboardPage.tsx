import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useRequests } from "../hooks/useRequests";
import { AppLayout } from "../components/layout/AppLayout";
import { RequestList } from "../components/requests/RequestList";
import { PageSpinner } from "../components/ui/Spinner";
import { ErrorAlert } from "../components/ui/ErrorAlert";

export function DashboardPage() {
  const { user } = useAuth();
  const { requests, isLoading, error, reload } = useRequests(user?.id ?? "");

  const openCount = requests.filter((r) => r.status === "open").length;
  const activeCount = requests.filter((r) => r.status === "in_progress").length;
  const waitingCount = requests.filter((r) => r.status === "waiting_for_customer").length;
  const resolvedCount = requests.filter((r) => ["resolved", "closed"].includes(r.status)).length;

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

      {!isLoading && !error && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Submitted", value: openCount, color: "text-slate-700", bg: "bg-slate-50", icon: "📥" },
            { label: "In Progress", value: activeCount, color: "text-blue-700", bg: "bg-blue-50", icon: "⚙️" },
            { label: "Needs Reply", value: waitingCount, color: "text-amber-700", bg: "bg-amber-50", icon: "💬" },
            { label: "Resolved", value: resolvedCount, color: "text-emerald-700", bg: "bg-emerald-50", icon: "✅" },
          ].map((stat) => (
            <div key={stat.label} className={`card ${stat.bg} p-4 flex items-center gap-3`}>
              <span className="text-2xl">{stat.icon}</span>
              <div>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading && <PageSpinner />}
      {error && <ErrorAlert message={error} onRetry={reload} />}
      {!isLoading && !error && <RequestList requests={requests} />}
    </AppLayout>
  );
}
