import { useState, useEffect, useCallback, useRef } from "react";
import {
  DEFAULT_REQUEST_FILTERS,
  fetchMyRequests,
  fetchRequest,
  createRequest,
  reopenRequest,
  type RequestFilters,
} from "../api/requests";
import { describeApiError } from "../api/errors";
import { usePolling } from "./usePolling";
import type { SupportRequest, NewRequestPayload } from "../types";

export const PAGE_SIZE = 5;

export function useRequests(customerId: string) {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<RequestFilters>(DEFAULT_REQUEST_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only the most recent request is allowed to update the screen.
  const latestRequest = useRef(0);

  const load = useCallback(
    async (targetPage: number, targetFilters: RequestFilters, silent = false) => {
      if (!customerId) return;
      const requestId = ++latestRequest.current;
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const result = await fetchMyRequests(targetFilters, customerId, targetPage, PAGE_SIZE);
        if (requestId !== latestRequest.current) return;
        setRequests(result.data);
        setTotal(result.total);
        setError(null);
      } catch (err) {
        if (requestId === latestRequest.current && !silent) {
          setError(describeApiError(err, "Failed to load your requests. Please try again."));
        }
      } finally {
        if (requestId === latestRequest.current && !silent) setIsLoading(false);
      }
    },
    [customerId]
  );

  useEffect(() => {
    void load(page, filters);
  }, [page, filters, load]);

  usePolling(() => void load(page, filters, true), 30_000);

  const updateFilters = useCallback((patch: Partial<RequestFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_REQUEST_FILTERS);
    setPage(1);
  }, []);

  const create = useCallback(
    async (payload: NewRequestPayload) => {
      const created = await createRequest(payload, customerId);
      setFilters(DEFAULT_REQUEST_FILTERS);
      setPage(1);
      return created;
    },
    [customerId]
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
    updateFilters,
    clearFilters,
    goToPage: setPage,
  };
}

export function useRequest(id: string, customerId: string) {
  const [request, setRequest] = useState<SupportRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Loads the request. Background polls keep the current view and ignore failures. */
  const load = useCallback(
    async (silent = false) => {
      if (!id || !customerId) return;
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const data = await fetchRequest(id, customerId);
        setRequest(data);
        setError(null);
      } catch (err) {
        if (!silent) {
          setRequest(null);
          setError(describeApiError(err, "Failed to load this request. Please try again."));
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [id, customerId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  usePolling(() => void load(true), 15_000);

  /** Like load(), but rejects on failure so the caller can tell the user. */
  const refresh = useCallback(async () => {
    const data = await fetchRequest(id, customerId);
    setRequest(data);
    return data;
  }, [id, customerId]);

  const reopen = useCallback(async () => {
    const updated = await reopenRequest(id);
    setRequest(updated);
    return updated;
  }, [id]);

  return { request, isLoading, error, reload: () => load(), refresh, reopen };
}
