import { useState, useEffect, useCallback } from "react";
import { fetchAttachments } from "../api/attachments";
import { describeApiError } from "../api/errors";
import { usePolling } from "./usePolling";
import type { Attachment } from "../types";

export function useAttachments(requestId: string) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!requestId) return;
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const data = await fetchAttachments(requestId);
        setAttachments(data);
        setError(null);
      } catch (err) {
        if (!silent) setError(describeApiError(err, "Failed to load attachments."));
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [requestId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  usePolling(() => void load(true), 30_000);

  const addAttachment = useCallback((attachment: Attachment) => {
    setAttachments((current) => {
      if (current.some((a) => a.id === attachment.id)) return current;
      return [...current, attachment];
    });
  }, []);

  return { attachments, isLoading, error, reload: () => load(), addAttachment };
}
