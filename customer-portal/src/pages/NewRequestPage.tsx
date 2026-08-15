import { useState, type FormEvent, type ChangeEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useRequests } from "../hooks/useRequests";
import { AppLayout } from "../components/layout/AppLayout";
import { Spinner } from "../components/ui/Spinner";
import type { RequestCategory, RequestPriority, NewRequestPayload } from "../types";

const CATEGORIES: { value: RequestCategory; label: string; icon: string }[] = [
  { value: "billing", label: "Billing", icon: "💳" },
  { value: "technical", label: "Technical", icon: "⚙️" },
  { value: "account", label: "Account", icon: "👤" },
  { value: "general", label: "General", icon: "💬" },
];

const PRIORITIES: { value: RequestPriority; label: string; description: string; color: string }[] = [
  { value: "low", label: "Low", description: "Not urgent, no immediate impact", color: "border-gray-200 peer-checked:border-gray-500 peer-checked:bg-gray-50" },
  { value: "medium", label: "Medium", description: "Somewhat affects my workflow", color: "border-sky-200 peer-checked:border-sky-500 peer-checked:bg-sky-50" },
  { value: "high", label: "High", description: "Significant impact on my work", color: "border-orange-200 peer-checked:border-orange-500 peer-checked:bg-orange-50" },
  { value: "urgent", label: "Urgent", description: "Critical — completely blocked", color: "border-red-200 peer-checked:border-red-500 peer-checked:bg-red-50" },
];

interface FormErrors {
  title?: string;
  description?: string;
  category?: string;
  general?: string;
}

export function NewRequestPage() {
  const { user } = useAuth();
  const { create } = useRequests(user?.id ?? "");
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<RequestCategory>("general");
  const [priority, setPriority] = useState<RequestPriority>("medium");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    const errs: FormErrors = {};
    if (!title.trim()) errs.title = "Please provide a title for your request.";
    else if (title.trim().length < 5) errs.title = "Title must be at least 5 characters.";
    else if (title.trim().length > 100) errs.title = "Title must be under 100 characters.";
    if (!description.trim()) errs.description = "Please describe your issue.";
    else if (description.trim().length < 20) errs.description = "Description must be at least 20 characters.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setErrors({});
    try {
      const payload: NewRequestPayload = {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
      };
      const newReq = await create(payload);
      navigate(`/requests/${newReq.id}`, { state: { success: true } });
    } catch {
      setErrors({ general: "Failed to submit your request. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center gap-3">
        <Link to="/dashboard" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Submit a Support Request</h1>
          <p className="text-sm text-slate-500">Describe your issue and we will get back to you promptly.</p>
        </div>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} noValidate id="new-request-form" className="card p-8 space-y-6">
          {errors.general && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in">
              {errors.general}
            </div>
          )}

          <div>
            <label htmlFor="request-title" className="label">
              Request title <span className="text-red-500">*</span>
            </label>
            <input
              id="request-title"
              type="text"
              value={title}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              placeholder="Brief summary of your issue"
              maxLength={100}
              className={`input-field ${errors.title ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
            />
            <div className="flex justify-between">
              {errors.title ? <p className="error-text">{errors.title}</p> : <span />}
              <span className="mt-1 text-xs text-slate-400">{title.length}/100</span>
            </div>
          </div>

          <div>
            <label className="label">Category</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  id={`category-${cat.value}`}
                  onClick={() => setCategory(cat.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-sm font-medium transition-all hover:shadow-sm ${
                    category === cat.value
                      ? "border-brand-400 bg-brand-50 text-brand-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className="text-xl">{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
            {errors.category && <p className="error-text">{errors.category}</p>}
          </div>

          <div>
            <label className="label">Priority</label>
            <div className="space-y-2">
              {PRIORITIES.map((p) => (
                <label
                  key={p.value}
                  htmlFor={`priority-${p.value}`}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all hover:shadow-sm ${
                    priority === p.value
                      ? "border-brand-400 bg-brand-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <input
                    id={`priority-${p.value}`}
                    type="radio"
                    name="priority"
                    value={p.value}
                    checked={priority === p.value}
                    onChange={() => setPriority(p.value)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{p.label}</p>
                    <p className="text-xs text-slate-500">{p.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="request-description" className="label">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="request-description"
              rows={6}
              value={description}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="Describe your issue in detail. Include any relevant context, steps you have tried, and the impact on your work."
              className={`input-field resize-none ${errors.description ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
            />
            <div className="flex justify-between">
              {errors.description ? (
                <p className="error-text">{errors.description}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">Minimum 20 characters</p>
              )}
              <span className="mt-1 text-xs text-slate-400">{description.length} chars</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Link to="/dashboard" className="btn-secondary flex-1 justify-center">
              Cancel
            </Link>
            <button
              type="submit"
              id="submit-request-btn"
              disabled={isSubmitting}
              className="btn-primary flex-1 justify-center"
            >
              {isSubmitting ? <><Spinner size="sm" /> Submitting…</> : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
