import { create } from "zustand";
import type {
  AppStatus,
  Graph,
  LogLine,
  NodeContext,
  SpatialHit,
  Toast,
} from "./types";

// Single global store. The 2D canvas, 3D graph, and drawer all subscribe to
// activeNodeId so clicking any pane updates every pane simultaneously.
interface AppState {
  appStatus: AppStatus;
  activeNodeId: string | null;
  graph: Graph;
  spatial: SpatialHit[];
  logs: LogLine[];
  context: NodeContext | null;
  mockMode: boolean;
  workerOnline: boolean;
  toasts: Toast[];

  setStatus: (s: AppStatus) => void;
  // Coordinate nodes arrive as "C-<tag>"; normalize to the equipment tag.
  setActiveNode: (id: string | null) => void;
  setGraph: (g: Graph) => void;
  setSpatial: (s: SpatialHit[]) => void;
  setLogs: (l: LogLine[]) => void;
  setContext: (c: NodeContext | null) => void;
  toggleMock: () => void;
  setWorkerOnline: (b: boolean) => void;
  pushToast: (kind: Toast["kind"], message: string) => void;
  dismissToast: (id: string) => void;
  reset: () => void;
}

export function normalizeTag(id: string | null): string | null {
  if (!id) return null;
  return id.startsWith("C-") ? id.slice(2) : id;
}

export const useStore = create<AppState>((set) => ({
  appStatus: "IDLE",
  activeNodeId: null,
  graph: { nodes: [], links: [] },
  spatial: [],
  logs: [],
  context: null,
  mockMode: true, // demo-safe default
  workerOnline: false,
  toasts: [],

  setStatus: (s) => set({ appStatus: s }),
  setActiveNode: (id) => set({ activeNodeId: normalizeTag(id) }),
  setGraph: (g) => set({ graph: g }),
  setSpatial: (s) => set({ spatial: s }),
  setLogs: (l) => set({ logs: l }),
  setContext: (c) => set({ context: c }),
  toggleMock: () => set((st) => ({ mockMode: !st.mockMode })),
  setWorkerOnline: (b) => set({ workerOnline: b }),
  pushToast: (kind, message) =>
    set((st) => ({
      toasts: [
        ...st.toasts,
        { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, kind, message },
      ],
    })),
  dismissToast: (id) =>
    set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
  reset: () =>
    set({
      appStatus: "IDLE",
      activeNodeId: null,
      graph: { nodes: [], links: [] },
      spatial: [],
      logs: [],
      context: null,
      toasts: [],
    }),
}));
