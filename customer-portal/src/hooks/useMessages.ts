import { useState, useEffect, useCallback } from "react";
import { fetchMessages, sendMessage } from "../api/messages";
import { describeApiError } from "../api/errors";
import { usePolling } from "./usePolling";
import type { Message } from "../types";

/** Merges messages by id, so a refresh that returns a message already shown never duplicates it. */
export function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map<string, Message>();
  for (const message of current) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function useMessages(requestId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!requestId) return;
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const data = await fetchMessages(requestId);
        setMessages((current) => mergeMessages(current, data));
        setError(null);
      } catch (err) {
        if (!silent) setError(describeApiError(err, "Failed to load the conversation. Please try again."));
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [requestId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  usePolling(() => void load(true), 15_000);

  /** Rejects when the message is not saved, so the caller can keep the draft. */
  const send = useCallback(
    async (content: string) => {
      setIsSending(true);
      try {
        const saved = await sendMessage(requestId, content);
        setMessages((current) => mergeMessages(current, [saved]));
        return saved;
      } finally {
        setIsSending(false);
      }
    },
    [requestId]
  );

  return { messages, isLoading, error, isSending, reload: () => load(), send };
}
