"use client";

import { useCallback, useEffect } from "react";
import {
  fetchContext,
  fetchGraph,
  fetchHealth,
  fetchLogs,
  fetchSpatial,
  ingest,
} from "./api";
import { useStore } from "./store";

// useOmniGraph wires the store to the backend: health on mount, ingest flow,
// and context fetch whenever the active node changes.
export function useOmniGraph() {
  const {
    activeNodeId,
    mockMode,
    setStatus,
    setGraph,
    setSpatial,
    setLogs,
    setContext,
    setWorkerOnline,
    toggleMock,
    pushToast,
  } = useStore();

  // Health check on mount.
  useEffect(() => {
    let alive = true;
    fetchHealth()
      .then((h) => {
        if (!alive) return;
        setWorkerOnline(h.worker);
        // If backend has no keys it can only mock; force the toggle on.
        if (h.mock_only && !useStore.getState().mockMode) toggleMock();
      })
      .catch(() => alive && setWorkerOnline(false));
    return () => {
      alive = false;
    };
  }, [setWorkerOnline, toggleMock]);

  // Fetch drawer context when selection changes.
  useEffect(() => {
    if (!activeNodeId) {
      setContext(null);
      return;
    }
    let alive = true;
    fetchContext(activeNodeId)
      .then((c) => alive && setContext(c))
      .catch(() => alive && setContext(null));
    return () => {
      alive = false;
    };
  }, [activeNodeId, setContext]);

  // Run ingestion end-to-end.
  const runIngest = useCallback(
    async (manual: File | null, schematic: File | null) => {
      const startedAt = Date.now();
      setStatus("PROCESSING");
      setLogs([]);
      try {
        await ingest(manual, schematic, mockMode);
        const [logs, graph, spatial] = await Promise.all([
          fetchLogs(),
          fetchGraph(),
          fetchSpatial(),
        ]);
        setLogs(logs);
        setGraph(graph);
        setSpatial(spatial);
        setStatus("READY");
        const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
        pushToast("success", `Ontology successfully generated in ${secs}s`);
        return { ok: true as const };
      } catch (e) {
        setStatus("ERROR");
        const message = (e as Error).message;
        pushToast("error", `Ingestion failed: ${message}`);
        return { ok: false as const, error: message };
      }
    },
    [mockMode, setStatus, setLogs, setGraph, setSpatial, pushToast]
  );

  return { runIngest };
}
