import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchMyRequests,
  fetchRequest,
  createRequest,
  updateRequestStatus,
  type RequestFilters,
} from "../api/requests";
import type { SupportRequest, NewRequestPayload } from "../types";

const PAGE_SIZE = 5;
const REFRESH_INTERVAL_MS = 30_000;

export function useRequests(customerId: string) {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<RequestFilters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadSequence = useRef(0);

  const load = useCallback(
    async (requestedPage: number, requestedFilters: RequestFilters, quiet = false) => {
      if (!customerId) return;
      const sequence = ++loadSequence.current;
      if (!quiet) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const result = await fetchMyRequests(requestedFilters, requestedPage, PAGE_SIZE, customerId);
        if (sequence !== loadSequence.current) return;
        setRequests(result.data);
        setTotal(result.total);
      } catch {
        if (sequence === loadSequence.current && !quiet) {
          setError("Failed to load your requests. Please try again.");
        }
      } finally {
        if (sequence === loadSequence.current && !quiet) setIsLoading(false);
      }
    },
    [customerId],
  );

  useEffect(() => {
    load(page, filters);
  }, [page, filters, load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) void load(page, filters, true);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [page, filters, load]);

  const applyFilters = useCallback((newFilters: RequestFilters) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  const goToPage = useCallback((requestedPage: number) => {
    setPage(Math.max(1, Math.min(requestedPage, Math.max(1, Math.ceil(total / PAGE_SIZE)))));
  }, [total]);

  const create = useCallback(
    async (payload: NewRequestPayload) => {
      const newReq = await createRequest(payload);
      setPage(1);
      await load(1, filters);
      return newReq;
    },
    [filters, load],
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
    [id],
  );

  return { request, isLoading, error, reload: load, updateStatus };
}
