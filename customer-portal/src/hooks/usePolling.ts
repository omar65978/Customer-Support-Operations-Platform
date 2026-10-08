import { useEffect, useRef } from "react";

/**
 * Calls `callback` every `intervalMs` while the tab is visible. The newest callback is
 * always the one that runs, so it can read current state without restarting the timer.
 */
export function usePolling(callback: () => void, intervalMs: number, enabled = true) {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") latest.current();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);
}
