import { supabase } from "../supabaseClient";
import { useState, type FormEvent, type ChangeEvent, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AppLayout } from "../components/layout/AppLayout";
import { StatusBadge, PriorityBadge } from "../components/ui/Badge";
import { MessageThread } from "../components/requests/MessageThread";
import { PageSpinner } from "../components/ui/Spinner";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { Spinner } from "../components/ui/Spinner";
import {
  STATUS_DESCRIPTIONS,
  CATEGORY_LABELS,
} from "../utils/statusLabels";

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
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Request State
  const [request, setRequest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Messages State
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messagesError, setMessagesError] = useState("");

  // UI Actions State
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(!!(location.state as { success?: boolean })?.success);
  const [isReopening, setIsReopening] = useState(false);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => setShowSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  // Fetch Data from Supabase
  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setMessagesLoading(true);
    
    try {
      // 1. Fetch Request Details
      const { data: reqData, error: reqError } = await supabase
        .from("requests")
        .select("*")
        .eq("id", id)
        .single();

      if (reqError) throw reqError;

      // Map to camelCase for UI compatibility
      setRequest({
        ...reqData,
        customerId: reqData.customer_id,
        assignedAgentId: reqData.assigned_agent_id,
        createdAt: reqData.created_at,
        updatedAt: reqData.updated_at,
        resolvedAt: reqData.resolved_at,
      });

      // 2. Fetch Messages
      const { data: msgData, error: msgError } = await supabase
        .from("messages")
        .select("*")
        .eq("request_id", id)
        .order("created_at", { ascending: true });

      if (msgError) throw msgError;

      // Map to camelCase for MessageThread component
      setMessages(
        msgData.map((m) => ({
          ...m,
          requestId: m.request_id,
          authorId: m.author_id,
          authorName: m.author_name,
          authorRole: m.author_role,
          isInternal: m.is_internal,
          createdAt: m.created_at,
        }))
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load request details.");
      setMessagesError("Failed to load messages.");
    } finally {
      setIsLoading(false);
      setMessagesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const canReply = request && !["resolved", "closed"].includes(request.status);

  // Handle Sending a New Message
  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!reply.trim()) {
      setReplyError("Please enter a message before sending.");
      return;
    }
    if (reply.trim().length < 5) {
      setReplyError("Message must be at least 5 characters.");
      return;
    }
    
    setReplyError("");
    setIsSending(true);
    
    try {
      // Insert new message
      const { error: insertError } = await supabase.from("messages").insert([
        {
          request_id: id,
          author_id: user?.id,
          author_name: user?.name,
          author_role: user?.role,
          content: reply.trim(),
          is_internal: false, // Customers always send public messages
          created_at: new Date().toISOString(),
        },
      ]);

      if (insertError) throw insertError;
      setReply("");

      // Update status if currently 'waiting_for_customer'
      if (request?.status === "waiting_for_customer") {
        await supabase
          .from("requests")
          .update({
            status: "in_progress",
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);
      }

      // Reload data to show the new message
      await loadData();
    } catch (err) {
      console.error(err);
      setReplyError("Failed to send your message. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  // Handle Reopening the Request
  async function handleReopen() {
    setIsReopening(true);
    try {
      const { error: updateError } = await supabase
        .from("requests")
        .update({
          status: "in_progress",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) throw updateError;
      
      await loadData();
    } catch (err) {
      console.error(err);
      setReplyError("Failed to reopen the request. Please try again.");
    } finally {
      setIsReopening(false);
    }
  }

  if (isLoading) return <AppLayout><PageSpinner /></AppLayout>;
  
  if (error || !request) {
    return (
      <AppLayout>
        <ErrorAlert message={error || "Request not found."} />
        <div className="mt-4">
          <Link to="/dashboard" className="btn-secondary">Back to Dashboard</Link>
        </div>
      </AppLayout>
    );
  }

  // Ownership Protection
  if (request.customerId !== user?.id) {
    navigate("/dashboard");
    return null;
  }

  return (
    <AppLayout>
      {showSuccess && (
        <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 animate-fade-in flex items-center gap-2">
          <span>✅</span>
          Your support request has been submitted successfully. We will get back to you soon.
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate("/dashboard")}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-semibold text-slate-400">{request.reference}</span>
            <span className="text-slate-200">·</span>
            <span className="text-sm text-slate-400">{CATEGORY_LABELS[request.category as keyof typeof CATEGORY_LABELS]}</span>
          </div>
          <h1 className="page-title truncate">{request.title}</h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
              <h2 className="section-title">Conversation</h2>
            </div>
            <div className="px-6 max-h-[500px] overflow-y-auto">
              {messagesLoading && (
                <div className="flex justify-center py-8"><Spinner /></div>
              )}
              {messagesError && <ErrorAlert message={messagesError} onRetry={loadData} />}
              {!messagesLoading && !messagesError && (
                <MessageThread messages={messages} currentUserId={user!.id} />
              )}
            </div>

            {canReply && (
              <div className="border-t border-slate-100 px-6 py-4">
                {request.status === "waiting_for_customer" && (
                  <div className="mb-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    💬 Our support team is waiting for additional information from you.
                  </div>
                )}
                <form onSubmit={handleSend} id="reply-form">
                  <textarea
                    id="reply-input"
                    rows={3}
                    value={reply}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReply(e.target.value)}
                    placeholder="Type your reply…"
                    className="input-field resize-none"
                  />
                  {replyError && <p className="error-text">{replyError}</p>}
                  <div className="mt-2 flex justify-end">
                    <button
                      type="submit"
                      id="send-reply-btn"
                      disabled={isSending}
                      className="btn-primary"
                    >
                      {isSending ? <><Spinner size="sm" /> Sending…</> : "Send Reply"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {request.status === "resolved" && (
              <div className="border-t border-slate-100 px-6 py-5">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-sm font-medium text-emerald-800">✅ This request has been resolved</p>
                  <p className="mt-1 text-sm text-emerald-700">
                    If your issue persists or you need further help, you can reopen this request.
                  </p>
                  <button
                    id="reopen-btn"
                    onClick={handleReopen}
                    disabled={isReopening}
                    className="mt-3 btn-secondary text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  >
                    {isReopening ? <><Spinner size="sm" /> Reopening…</> : "Reopen Request"}
                  </button>
                </div>
              </div>
            )}

            {request.status === "closed" && (
              <div className="border-t border-slate-100 px-6 py-5">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">🏁 This request is closed</p>
                  <p className="mt-1 text-sm text-slate-500">
                    If you need further assistance, please submit a new request.
                  </p>
                  <Link to="/new-request" className="mt-3 btn-secondary inline-flex">
                    Submit New Request
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="section-title mb-4">Request Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Status</p>
                <StatusBadge status={request.status} />
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  {STATUS_DESCRIPTIONS[request.status as keyof typeof STATUS_DESCRIPTIONS]}
                </p>
              </div>
              <div className="h-px bg-slate-100" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Priority</p>
                <PriorityBadge priority={request.priority} />
              </div>
              <div className="h-px bg-slate-100" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Submitted</p>
                <p className="text-sm text-slate-700">{formatDate(request.createdAt)}</p>
              </div>
              <div className="h-px bg-slate-100" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Last Updated</p>
                <p className="text-sm text-slate-700">{formatDate(request.updatedAt)}</p>
              </div>
              {request.resolvedAt && (
                <>
                  <div className="h-px bg-slate-100" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Resolved On</p>
                    <p className="text-sm text-emerald-700">{formatDate(request.resolvedAt)}</p>
                  </div>
                </>
              )}
              <div className="h-px bg-slate-100" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Assigned To</p>
                <p className="text-sm text-slate-700">
                  {request.assignedAgentId ? "A support agent" : "Pending assignment"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}