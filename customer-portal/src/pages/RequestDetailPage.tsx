import { useState, useEffect, type FormEvent, type ChangeEvent } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AppLayout } from "../components/layout/AppLayout";
import { StatusBadge, PriorityBadge } from "../components/ui/Badge";
import { MessageThread } from "../components/requests/MessageThread";
import { AttachmentPanel } from "../components/requests/AttachmentPanel";
import { PageSpinner, Spinner } from "../components/ui/Spinner";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { STATUS_DESCRIPTIONS, CATEGORY_LABELS } from "../utils/statusLabels";
import { useRequest } from "../hooks/useRequests";
import { useMessages } from "../hooks/useMessages";
import { useAttachments } from "../hooks/useAttachments";
import { describeApiError } from "../api/errors";
import type { RequestStatus } from "../types";

const ACTIVE_STATUSES: RequestStatus[] = ["open", "in_progress", "waiting_for_customer"];
const MAX_MESSAGE_LENGTH = 5000;

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RequestDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const customerId = user?.id ?? "";

  const { request, isLoading, error, reload: reloadRequest, refresh, reopen } = useRequest(id, customerId);
  const {
    messages,
    isLoading: messagesLoading,
    error: messagesError,
    isSending,
    reload: reloadMessages,
    send,
  } = useMessages(id);
  const {
    attachments,
    isLoading: attachmentsLoading,
    error: attachmentsError,
    reload: reloadAttachments,
    addAttachment,
  } = useAttachments(id);

  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState("");
  const [replyNotice, setReplyNotice] = useState("");
  const [reopenError, setReopenError] = useState("");
  const [isReopening, setIsReopening] = useState(false);
  const [showSuccess, setShowSuccess] = useState(!!(location.state as { success?: boolean } | null)?.success);

  useEffect(() => {
    if (!showSuccess) return;
    const timer = window.setTimeout(() => setShowSuccess(false), 5000);
    return () => window.clearTimeout(timer);
  }, [showSuccess]);

  const isActive = request ? ACTIVE_STATUSES.includes(request.status) : false;

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const content = reply.trim();
    if (!content) {
      setReplyError("Please enter a message before sending.");
      return;
    }
    if (content.length < 5) {
      setReplyError("Message must be at least 5 characters.");
      return;
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      setReplyError(`Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
      return;
    }
    setReplyError("");
    setReplyNotice("");
    try {
      await send(content);
    } catch (err) {
      // Keep the draft so nothing the customer wrote is lost.
      setReplyError(describeApiError(err, "Your message was not sent. Your text is still here, so you can try again."));
      return;
    }
    setReply("");
    // The database may have changed the status when the reply arrived, so refresh it.
    try {
      await refresh();
    } catch {
      setReplyNotice("Your message was sent. The status could not be refreshed; reload the page to see the latest status.");
    }
  }

  async function handleReopen() {
    setReopenError("");
    setIsReopening(true);
    try {
      await reopen();
    } catch (err) {
      setReopenError(describeApiError(err, "The request could not be reopened. Please try again."));
      // Show the current status, since the request may have changed.
      await refresh().catch(() => undefined);
    } finally {
      setIsReopening(false);
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <PageSpinner />
      </AppLayout>
    );
  }

  if (error || !request) {
    return (
      <AppLayout>
        <ErrorAlert message={error || "This request was not found."} onRetry={reloadRequest} />
        <div className="mt-4">
          <Link to="/dashboard" className="btn-secondary">Back to Dashboard</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {showSuccess && (
        <div role="status" className="mb-4 flex animate-fade-in items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <span aria-hidden="true">✅</span>
          Your support request has been submitted successfully. We will get back to you soon.
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          aria-label="Back to my requests"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-slate-400">{request.reference}</span>
            <span className="text-slate-200" aria-hidden="true">·</span>
            <span className="text-sm text-slate-400">{CATEGORY_LABELS[request.category]}</span>
          </div>
          <h1 className="page-title break-words">{request.title}</h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
              <h2 className="section-title">Conversation</h2>
            </div>
            <div className="max-h-[500px] overflow-y-auto px-6">
              {messagesLoading && (
                <div className="flex justify-center py-8"><Spinner /></div>
              )}
              {messagesError && <ErrorAlert message={messagesError} onRetry={reloadMessages} />}
              {!messagesLoading && !messagesError && (
                <MessageThread messages={messages} currentUserId={user?.id ?? ""} />
              )}
            </div>

            {isActive && (
              <div className="border-t border-slate-100 px-6 py-4">
                {request.status === "waiting_for_customer" && (
                  <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    💬 Our support team is waiting for additional information from you.
                  </div>
                )}
                <form onSubmit={handleSend} id="reply-form" noValidate>
                  <label htmlFor="reply-input" className="label mb-1">Your reply</label>
                  <textarea
                    id="reply-input"
                    rows={3}
                    value={reply}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReply(e.target.value)}
                    placeholder="Type your reply…"
                    className="input-field resize-none"
                    aria-invalid={replyError ? true : undefined}
                    aria-describedby={replyError ? "reply-error" : undefined}
                  />
                  {replyError && <p id="reply-error" className="error-text" role="alert">{replyError}</p>}
                  {replyNotice && <p className="mt-2 text-xs text-amber-700" role="status">{replyNotice}</p>}
                  <div className="mt-2 flex justify-end">
                    <button type="submit" id="send-reply-btn" disabled={isSending} className="btn-primary">
                      {isSending ? <><Spinner size="sm" /> Sending…</> : "Send Reply"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {(request.status === "resolved" || request.status === "closed") && (
              <div className="border-t border-slate-100 px-6 py-5">
                <div
                  className={`rounded-xl border p-4 ${
                    request.status === "resolved"
                      ? "border-emerald-100 bg-emerald-50"
                      : "border-slate-100 bg-slate-50"
                  }`}
                >
                  <p className={`text-sm font-medium ${request.status === "resolved" ? "text-emerald-800" : "text-slate-700"}`}>
                    {request.status === "resolved" ? "✅ This request has been resolved" : "🏁 This request is closed"}
                  </p>
                  <p className={`mt-1 text-sm ${request.status === "resolved" ? "text-emerald-700" : "text-slate-500"}`}>
                    If your issue is not fixed or you need further help, you can reopen this request and continue the conversation.
                  </p>
                  {reopenError && <p className="mt-2 text-sm font-medium text-red-700" role="alert">{reopenError}</p>}
                  <button
                    type="button"
                    id="reopen-btn"
                    onClick={handleReopen}
                    disabled={isReopening}
                    className="btn-secondary mt-3 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                  >
                    {isReopening ? <><Spinner size="sm" /> Reopening…</> : "Reopen Request"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card p-6">
            {attachmentsLoading && <div className="flex justify-center py-4"><Spinner /></div>}
            {attachmentsError && <ErrorAlert message={attachmentsError} onRetry={reloadAttachments} />}
            {!attachmentsLoading && !attachmentsError && (
              <AttachmentPanel
                requestId={request.id}
                attachments={attachments}
                canUpload={isActive}
                onUploaded={addAttachment}
              />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="section-title mb-4">Request Details</h2>
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Status</p>
                <StatusBadge status={request.status} />
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  {STATUS_DESCRIPTIONS[request.status]}
                </p>
              </div>
              <div className="h-px bg-slate-100" />
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Urgency</p>
                <PriorityBadge priority={request.priority} />
              </div>
              <div className="h-px bg-slate-100" />
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Submitted</p>
                <p className="text-sm text-slate-700">{formatDate(request.createdAt)}</p>
              </div>
              <div className="h-px bg-slate-100" />
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Last updated</p>
                <p className="text-sm text-slate-700">{formatDate(request.updatedAt)}</p>
              </div>
              {request.resolvedAt && (
                <>
                  <div className="h-px bg-slate-100" />
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Resolved on</p>
                    <p className="text-sm text-emerald-700">{formatDate(request.resolvedAt)}</p>
                  </div>
                </>
              )}
              <div className="h-px bg-slate-100" />
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Assigned to</p>
                <p className="text-sm text-slate-700">
                  {request.assignedAgentId ? "A support agent" : "Waiting for an available agent"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
