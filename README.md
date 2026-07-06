# OMNI-GRAPH

**AI Industrial Knowledge Intelligence Brain** — ET AI Hackathon 2026, Problem Statement 8.

Air-gapped, hybrid-edge platform that turns unstructured legacy engineering docs (PDF manuals)
and spatial schematics (P&ID drawings) into a unified, queryable knowledge graph. Click a valve
on a blueprint → get the exact torque spec, safety rule, and compliance code in milliseconds,
instead of searching a 500-page manual.

## Architecture

```
[Next.js UI] (Bun, :3000)
     │  HTTP/JSON
     ▼
[Go Router] (:8080) ───files──▶ [Python Worker] (:8000)
     │                                 │
     │                                 ├─ PyMuPDF text extraction + chunking
     │                                 └─ Pillow image downscale/compress
     │
     ├─▶ [Neo4j] (:7687 Bolt)           (graph store — see note below)
     ├─▶ [Groq API]   llama-3.3-70b-versatile   — text → entities/rules (JSON)
     └─▶ [NVIDIA NIM]  llama-3.2-11b-vision     — schematic → bounding boxes (JSON)
```

**Note on Neo4j:** the current implementation uses an in-memory, thread-safe graph store
(`backend/internal/store`) as the source of truth so the whole system runs with zero external
deps for the demo. The `neo4j` service in `docker-compose.yml` is present per the target
architecture but the Go backend does not yet write to it — see "Known gaps" below.

**Mock Mode:** `MOCK_MODE=true` (default in `docker-compose.yml`) bypasses Groq/NVIDIA entirely
and replays a pre-computed "Golden Dataset" payload from `backend/mock_data/demo_payload.json`
with a simulated processing delay — demo-safe against venue Wi-Fi failure.

## Run it

### One command (Docker Compose)

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend health: http://localhost:8080/api/v1/health
- Worker health: http://localhost:8000/health
- Neo4j browser: http://localhost:7474

To run live (real Groq/NVIDIA calls instead of mock), export keys before compose picks them up:

```bash
export GROQ_API_KEY=...
export NVIDIA_API_KEY=...
# and set MOCK_MODE: "false" in docker-compose.yml, or override at runtime
```

### Manual (no Docker)

```bash
# backend (mock mode)
cd backend && MOCK_MODE=true go run ./cmd/server        # :8080

# worker
cd worker && python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --port 8000                  # :8000

# frontend
cd frontend && bun install && bun run dev                # :3000
```

## Tests

```bash
cd backend  && go test ./...
cd worker   && .venv/bin/python -m pytest -q
cd frontend && bun run test        # vitest — unit (colors, store, api client)
cd frontend && bun run test:e2e    # Playwright — click-through: 2D bbox → drawer → 3D sync
```

## Repo layout

```
backend/    Go router — REST API, in-memory graph store, Groq/NVIDIA clients, mock pipeline
worker/     Python FastAPI — PDF text chunking (PyMuPDF), image compression (Pillow)
frontend/   Next.js 16 + React 19 — 2D P&ID canvas, 3D force-graph, ingestion terminal, drawer
*.md        Spec docs (PRD, TRD, UI/UX, app flow, backend schema, implementation plan)
```

## Known gaps

- Neo4j not yet wired into the Go backend (in-memory store used instead — functionally
  equivalent for the demo, but does not persist across restarts).
- Live Groq/NVIDIA path only exercised in isolation; full pipeline tested end-to-end via Mock Mode.
- Golden Dataset assets (`demo_assets/pump_manual.pdf`, `plant_schematic.png`) not yet added —
  mock payload uses synthetic coordinates.
