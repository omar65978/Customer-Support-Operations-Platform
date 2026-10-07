import { useState, useEffect, useCallback } from "react";
import {
  fetchMyRequests,
  fetchRequest,
  createRequest,
  updateRequestStatus,
  type RequestFilters,
} from "../api/requests";
import type { SupportRequest, NewRequestPayload } from "../types";

export function useRequests(customerId: string) {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<RequestFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const PAGE_SIZE = 5;

  const load = useCallback(
    async (p: number, f: RequestFilters) => {
      if (!customerId) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchMyRequests(f, p, PAGE_SIZE);
        setRequests(result.data);
        setTotal(result.total);
      } catch {
        setError("Failed to load your requests. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [customerId]
  );

  useEffect(() => {
    load(page, filters);
  }, [page, filters, load]);

  const applyFilters = useCallback(
    (newFilters: RequestFilters) => {
      setFilters(newFilters);
      setPage(1);
    },
    []
  );

  const goToPage = useCallback((p: number) => setPage(p), []);

  const create = useCallback(
    async (payload: NewRequestPayload) => {
      const newReq = await createRequest(payload, customerId);
      load(1, filters);
      setPage(1);
      return newReq;
    },
    [customerId, filters, load]
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return {
    requests,
    total,
    page,
    totalPages,
    pageSize: PAGE_SIZE,
    filters,
    isLoading,
    error,
    reload: () => load(page, filters),
    create,
    applyFilters,
    goToPage,
  };
}

export function useRequest(id: string) {
  const [request, setRequest] = useState<SupportRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
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
    load();
  }, [load]);

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
