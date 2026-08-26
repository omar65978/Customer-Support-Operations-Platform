import { useState, useEffect, useCallback } from "react";
import { fetchMessages, sendMessage } from "../api/messages";
import type { Message, NewMessagePayload } from "../types";

export function useMessages(requestId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMessages(requestId);
      setMessages(data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch {
      setError("Failed to load conversation. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    if (requestId) load();
  }, [requestId, load]);

  const send = useCallback(
    async (payload: NewMessagePayload) => {
      setIsSending(true);
      try {
        const newMsg = await sendMessage(requestId, payload);
        setMessages((prev) => [...prev, newMsg]);
        return newMsg;
      } finally {
        setIsSending(false);
      }
    },
    [requestId]
  );

  return { messages, isLoading, error, isSending, reload: load, send };
}
