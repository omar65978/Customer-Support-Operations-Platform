import { useState } from "react";
import type { SupportRequest, RequestStatus } from "../../types";
import { RequestCard } from "./RequestCard";
import { EmptyState } from "../ui/EmptyState";
import { Link } from "react-router-dom";

type TabKey = "all" | "active" | "waiting" | "resolved";

interface Tab {
  key: TabKey;
  label: string;
  icon: string;
  filter: (r: SupportRequest) => boolean;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: string;
}

const TABS: Tab[] = [
  {
    key: "all",
    label: "All Requests",
    icon: "📋",
    filter: () => true,
    emptyTitle: "No requests yet",
    emptyDescription: "Submit your first support request and we will get back to you quickly.",
    emptyIcon: "📭",
  },
  {
    key: "active",
    label: "Active",
    icon: "🔵",
    filter: (r) => ["open", "in_progress"].includes(r.status),
    emptyTitle: "No active requests",
    emptyDescription: "You have no requests currently being handled.",
    emptyIcon: "✅",
  },
  {
    key: "waiting",
    label: "Awaiting Your Reply",
    icon: "🟡",
    filter: (r) => r.status === "waiting_for_customer",
    emptyTitle: "No pending replies needed",
    emptyDescription: "Our team is not waiting for information from you right now.",
    emptyIcon: "💬",
  },
  {
    key: "resolved",
    label: "Resolved",
    icon: "✅",
    filter: (r) => ["resolved", "closed"].includes(r.status as RequestStatus),
    emptyTitle: "No resolved requests",
    emptyDescription: "Resolved and closed requests will appear here.",
    emptyIcon: "🏁",
  },
];

interface RequestListProps {
  requests: SupportRequest[];
}

export function RequestList({ requests }: RequestListProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const currentTab = TABS.find((t) => t.key === activeTab)!;
  const filtered = requests.filter(currentTab.filter);
  const waitingCount = requests.filter((r) => r.status === "waiting_for_customer").length;

  return (
    <div>
      <div className="mb-6 flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-100 bg-white p-1.5 shadow-sm">
        {TABS.map((tab) => {
          const count = tab.key === "waiting" ? waitingCount : undefined;
          return (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
              {count !== undefined && count > 0 && (
                <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-xs font-bold ${activeTab === tab.key ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={currentTab.emptyIcon}
          title={currentTab.emptyTitle}
          description={currentTab.emptyDescription}
          action={
            activeTab === "all" ? (
              <Link to="/new-request" className="btn-primary">
                Submit a Request
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((req) => (
            <RequestCard key={req.id} request={req} />
          ))}
        </div>
      )}
    </div>
  );
}
