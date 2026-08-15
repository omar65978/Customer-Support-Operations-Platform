import { Link } from "react-router-dom";
import type { SupportRequest } from "../../types";
import { StatusBadge, PriorityBadge } from "../ui/Badge";
import { CATEGORY_LABELS } from "../../utils/statusLabels";

interface RequestCardProps {
  request: SupportRequest;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RequestCard({ request }: RequestCardProps) {
  return (
    <Link
      to={`/requests/${request.id}`}
      id={`request-card-${request.id}`}
      className="card block p-5 transition-all hover:shadow-md hover:border-brand-200 hover:-translate-y-0.5 animate-slide-up group"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono font-semibold text-slate-400 tracking-wide">
              {request.reference}
            </span>
            <span className="text-slate-200">•</span>
            <span className="text-xs text-slate-400">{CATEGORY_LABELS[request.category]}</span>
          </div>
          <h3 className="font-semibold text-slate-900 group-hover:text-brand-700 transition-colors truncate">
            {request.title}
          </h3>
          <p className="mt-1 text-sm text-slate-500 line-clamp-2">
            {request.description}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusBadge status={request.status} />
          <PriorityBadge priority={request.priority} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-slate-400">
          Updated {timeAgo(request.updatedAt)}
        </span>
        <svg
          className="h-4 w-4 text-slate-300 group-hover:text-brand-400 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
