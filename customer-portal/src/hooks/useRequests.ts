import { useState, useEffect, useCallback } from "react";
import { fetchMyRequests, fetchRequest, createRequest, updateRequestStatus } from "../api/requests";
import type { SupportRequest, NewRequestPayload } from "../types";

export function useRequests(customerId: string) {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMyRequests(customerId);
      setRequests(data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    } catch {
      setError("Failed to load your requests. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (customerId) load();
  }, [customerId, load]);

  const create = useCallback(
    async (payload: NewRequestPayload) => {
      const newReq = await createRequest(payload, customerId);
      setRequests((prev) => [newReq, ...prev]);
      return newReq;
    },
    [customerId]
  );

  return { requests, isLoading, error, reload: load, create };
}

export function useRequest(id: string) {
  const [request, setRequest] = useState<SupportRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchRequest(id);
      setRequest(data);
    } catch {
      setError("Request not found or you do not have access to it.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  const updateStatus = useCallback(
    async (status: SupportRequest["status"]) => {
      const updated = await updateRequestStatus(id, status);
      setRequest(updated);
      return updated;
    },
    [id]
  );

  return { request, isLoading, error, reload: load, updateStatus };
}
