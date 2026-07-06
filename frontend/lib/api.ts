import type { Graph, Health, LogLine, NodeContext, SpatialHit } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export function fetchHealth(): Promise<Health> {
  return getJSON<Health>("/api/v1/health");
}

export function fetchGraph(): Promise<Graph> {
  return getJSON<Graph>("/api/v1/graph");
}

export async function fetchSpatial(): Promise<SpatialHit[]> {
  const data = await getJSON<{ spatial: SpatialHit[] }>("/api/v1/spatial");
  return data.spatial ?? [];
}

export function fetchContext(tag: string): Promise<NodeContext> {
  return getJSON<NodeContext>(`/api/v1/node/${encodeURIComponent(tag)}/context`);
}

export async function fetchLogs(): Promise<LogLine[]> {
  const data = await getJSON<{ logs: LogLine[] }>("/api/v1/logs");
  return data.logs ?? [];
}

// Posts uploads to the ingest endpoint. mock=true routes to the Golden Dataset.
export async function ingest(
  manual: File | null,
  schematic: File | null,
  mock: boolean
): Promise<void> {
  const form = new FormData();
  if (manual) form.append("manual", manual);
  if (schematic) form.append("schematic", schematic);

  const res = await fetch(`${API_BASE}/api/v1/ingest`, {
    method: "POST",
    headers: mock ? { "X-Mock-Mode": "true" } : undefined,
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ingest failed ${res.status}: ${text}`);
  }
}
