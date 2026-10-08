import { useRef, type KeyboardEvent } from "react";
import type { RequestGroup } from "../../api/requests";

interface GroupTab {
  key: RequestGroup;
  label: string;
  hint: string;
}

/** Lifecycle groups. The filter runs on the server, so counts and pages stay correct. */
const REQUEST_GROUP_TABS: GroupTab[] = [
  { key: "all", label: "All", hint: "All of your requests" },
  { key: "active", label: "Active", hint: "Submitted or being handled by our team" },
  { key: "waiting", label: "Awaiting your reply", hint: "Our team needs information from you" },
  { key: "completed", label: "Completed", hint: "Resolved or closed" },
];

interface RequestGroupTabsProps {
  value: RequestGroup;
  onChange: (group: RequestGroup) => void;
}

/** Tab bar with arrow-key navigation (WAI-ARIA tabs pattern). */
export function RequestGroupTabs({ value, onChange }: RequestGroupTabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusTab(index: number) {
    const next = REQUEST_GROUP_TABS[(index + REQUEST_GROUP_TABS.length) % REQUEST_GROUP_TABS.length];
    refs.current[next.key]?.focus();
    onChange(next.key);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight") focusTab(index + 1);
    else if (event.key === "ArrowLeft") focusTab(index - 1);
    else if (event.key === "Home") focusTab(0);
    else if (event.key === "End") focusTab(REQUEST_GROUP_TABS.length - 1);
  }

  const selected = REQUEST_GROUP_TABS.find((t) => t.key === value);

  return (
    <div>
      <div role="tablist" aria-label="Filter requests by status" className="flex flex-wrap gap-2">
        {REQUEST_GROUP_TABS.map((tab, index) => {
          const isSelected = tab.key === value;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                refs.current[tab.key] = el;
              }}
              type="button"
              role="tab"
              id={`group-tab-${tab.key}`}
              aria-selected={isSelected}
              aria-controls="request-list"
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onChange(tab.key)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                isSelected
                  ? "border-brand-500 bg-brand-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {selected && <p className="mt-2 text-xs text-slate-500">{selected.hint}</p>}
    </div>
  );
}
