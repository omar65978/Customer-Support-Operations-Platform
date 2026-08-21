import { supabase } from "../supabaseClient";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AppLayout } from "../components/layout/AppLayout";
import { RequestList } from "../components/requests/RequestList";
import { PageSpinner } from "../components/ui/Spinner";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import type { SupportRequest } from "../types";

export function DashboardPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchRequests() {
    try {
      setIsLoading(true);
      setError(null);
      const { data, error: supabaseError } = await supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (supabaseError) {
        throw supabaseError;
      }

      const formattedRequests: SupportRequest[] = (data || []).map((req: any) => ({
        id: req.id,
        reference: req.reference,
        customerId: req.customer_id,
        assignedAgentId: req.assigned_agent_id,
        title: req.title,
        description: req.description,
        category: req.category,
        priority: req.priority,
        status: req.status,
        createdAt: req.created_at,
        updatedAt: req.updated_at,
        resolvedAt: req.resolved_at,
      }));

      setRequests(formattedRequests);
    } catch (err) {
      console.error(err);
      setError("Failed to load requests from Supabase. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, []);

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
      {error && <ErrorAlert message={error} onRetry={fetchRequests} />}
      {!isLoading && !error && <RequestList requests={requests} />}
    </AppLayout>
  );
}