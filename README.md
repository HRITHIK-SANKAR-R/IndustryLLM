# OMNI-GRAPH

**AI Industrial Knowledge Intelligence Brain** — ET AI Hackathon 2026, Problem Statement 8.

Industrial plants run on two disconnected artifacts: a 500-page PDF maintenance manual and a
P&ID schematic drawing. When a technician needs the torque spec for valve `V-104`, they search
the PDF by hand. OMNI-GRAPH ingests both documents, uses two hosted LLMs to extract entities,
rules, and spatial coordinates, and builds a queryable knowledge graph — click the valve on the
schematic, get the exact rule paragraph and compliance code back in milliseconds, with the 3D
graph and the drawer updating in lockstep.

```
Upload PDF + PNG  →  Groq extracts entities/rules  →  NVIDIA vision locates them on the drawing
                  →  Knowledge graph (2D bbox + 3D force-graph, both click-synced)
```

---

## Table of contents

- [Architecture](#architecture)
- [How it works](#how-it-works)
- [Quickstart](#quickstart)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Data model](#data-model)
- [Testing](#testing)
- [Repo layout](#repo-layout)
- [Design decisions & tradeoffs](#design-decisions--tradeoffs)
- [Known limitations](#known-limitations)

---

## Architecture

```
┌─────────────────┐     HTTP/JSON      ┌──────────────────┐
│   Next.js UI     │ ─────────────────▶ │    Go Router      │
│   (Bun, :3000)   │ ◀───────────────── │    (:8080)         │
└─────────────────┘                     └─────────┬─────────┘
                                                   │
                        ┌──────────────────────────┼──────────────────────────┐
                        │                          │                          │
                        ▼                          ▼                          ▼
              ┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
              │  Python Worker    │       │     Groq API      │       │   NVIDIA NIM       │
              │  (FastAPI, :8000) │       │ llama-3.3-70b-     │       │ llama-3.2-11b-      │
              │  PyMuPDF + Pillow │       │ versatile           │       │ vision-instruct      │
              │                    │       │ text → entities/    │       │ schematic → bounding │
              │                    │       │ rules (JSON)        │       │ boxes (JSON)         │
              └──────────────────┘       └──────────────────┘       └──────────────────┘
                        │
                        ▼
              ┌──────────────────────────────┐        best-effort mirror       ┌──────────────┐
              │  In-memory graph store        │ ───────────────────────────▶  │    Neo4j       │
              │  (source of truth for reads)  │                                │  (:7687 Bolt)  │
              └──────────────────────────────┘                                └──────────────┘
```

**Four independent services**, each replaceable/restartable on its own:

| Service | Tech | Port | Role |
|---|---|---|---|
| `frontend` | Next.js 16 + React 19 + Bun | 3000 | UI: ingestion terminal, 2D P&ID viewer, 3D force-graph, context drawer |
| `backend` | Go 1.22+ (stdlib `net/http`) | 8080 | REST API, orchestration, in-memory graph store, Groq/NVIDIA clients |
| `worker` | Python 3.11 + FastAPI | 8000 | PDF text extraction/chunking, image downscale/compress |
| `neo4j` | Neo4j Community | 7474 / 7687 | Durable graph mirror, queryable via Cypher (optional, best-effort) |

**Why Go for the router:** goroutines make concurrent fan-out to Groq trivial (one goroutine per
text chunk, rate-limited by a buffered-channel semaphore) without the callback/async-await
ceremony a Node backend would need for the same concurrency.

**Why a separate Python worker:** PyMuPDF (PDF parsing) and Pillow (image processing) have no
mature Go equivalents. Isolating them behind an HTTP boundary keeps the Go router free of cgo/FFI
and lets the worker scale or restart independently.

**Why the in-memory store is the source of truth, not Neo4j:** every read the frontend makes
(`/graph`, `/spatial`, `/node/{tag}/context`) needs sub-50ms latency and zero external
dependencies for the demo to survive a flaky Neo4j container. Neo4j is written to as a
best-effort mirror on every ingest — if it's down, ingestion and every UI interaction still work,
just without a durable Cypher-queryable copy.

---

## How it works

### 1. Ingestion (`POST /api/v1/ingest`)

1. Frontend posts `manual` (PDF) + `schematic` (PNG/JPG) as multipart form data.
2. Go router hands raw bytes to the Python worker (`POST /parse`).
3. Worker extracts text via PyMuPDF, splits it into overlapping chunks (4000 chars, 400-char
   overlap, paragraph-aligned) to stay under Groq's TPM limit, and downscales the schematic to
   fit inside 2048×2048 (JPEG, quality 85) to satisfy the vision model's payload limit. Both
   operations are CPU-bound and run concurrently in a thread pool so they don't block the
   worker's event loop.
4. Go router fans the text chunks out to Groq concurrently (one goroutine per chunk, a
   5-slot semaphore caps in-flight requests, exponential backoff on 429). Groq returns structured
   JSON: equipment tags, names, systems, and their maintenance/safety/compliance rules.
5. Once Groq's entities are back, the Go router sends the compressed schematic *and the real
   extracted tag names* to NVIDIA NIM — grounding the vision model against known tags measurably
   improves localization versus asking it to find "all equipment tags" cold.
6. NVIDIA returns bounding boxes. See [Design decisions](#design-decisions--tradeoffs) for how
   this response is validated and repaired — small vision models are unreliable about pixel
   coordinates.
7. The Go router merges entities (deduping by equipment tag across chunks, unioning rules),
   writes the result into the in-memory store, and best-effort mirrors it into Neo4j via one
   `UNWIND`/`MERGE` Cypher transaction.
8. Every log line emitted during this pipeline (`[SYS]`, `[PY]`, `[GROQ]`, `[NVIDIA]`, `[GRAPH]`,
   `[NEO4J]`) is buffered server-side and returned by `GET /api/v1/logs` — the frontend's
   "hacker terminal" replays them with a typing animation so the AI work is visibly real, not a
   spinner.

### 2. Querying (bidirectional click-sync)

A single Zustand field, `activeNodeId`, is the source of truth for "what's selected." Every pane
subscribes to it:

- Click a bounding box on the 2D schematic → sets `activeNodeId` → the 3D graph camera flies to
  that node and dims unrelated nodes → the drawer opens and fetches
  `GET /api/v1/node/{tag}/context`.
- Click a node in the 3D graph → same `activeNodeId` update → the 2D schematic highlights the
  matching bounding box.
- Coordinate nodes arrive prefixed `C-<tag>` (so they get their own graph node); clicking one
  normalizes back to the equipment tag before the lookup.

This is why the UI feels like "one brain" instead of three components that happen to share a
page — there is exactly one place selection state lives, and every pane is a pure function of it.

### 3. Mock Mode (demo-safety circuit breaker)

`MOCK_MODE=true` (or header `X-Mock-Mode: true`, or `?mock=true`) makes the ingest endpoint skip
the worker, Groq, and NVIDIA entirely and replay a pre-computed payload
(`backend/mock_data/demo_payload.json`) with a realistic ~1.5s simulated delay. If the demo venue
Wi-Fi dies, flipping this toggle turns a live-demo crash into "Air-Gapped Local Network
Capability" — same UI, same animations, zero network dependency. When no API keys are configured
at all, the backend forces this mode automatically (`mock_only: true` in `/health`).

---

## Quickstart

### One command (Docker Compose) — recommended

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend health: http://localhost:8080/api/v1/health
- Worker health: http://localhost:8000/health
- Neo4j browser: http://localhost:7474

Runs in Mock Mode by default (`MOCK_MODE=true` in `docker-compose.yml`) — no API keys required to
see the full pipeline end-to-end.

### Live mode (real Groq + NVIDIA calls)

```bash
cp .env.example .env
# edit .env: GROQ_API_KEY=..., NVIDIA_API_KEY=..., MOCK_MODE=false
docker-compose up --build
```

`.env` at the repo root is picked up automatically by `docker-compose` and is git-ignored — never
commit real keys.

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

For live mode, `export` the keys (or `set -a && source .env && set +a`) before starting the
backend.

---

## Configuration

All configuration is environment variables, read once at process start.

| Variable | Service | Default | Purpose |
|---|---|---|---|
| `GROQ_API_KEY` | backend | *(empty)* | Groq API key. Get one at console.groq.com/keys |
| `NVIDIA_API_KEY` | backend | *(empty)* | NVIDIA NIM API key (`nvapi-...`). Get one at build.nvidia.com |
| `MOCK_MODE` | backend | `true` (compose) | Forces the Golden Dataset mock path, bypassing both APIs |
| `PORT` | backend | `8080` | HTTP listen port |
| `WORKER_URL` | backend | `http://127.0.0.1:8000` | Python worker base URL |
| `NEO4J_URI` | backend | `bolt://localhost:7687` | Neo4j Bolt URI; connection failure is non-fatal |
| `NEO4J_USER` / `NEO4J_PASSWORD` | backend | *(empty = no-auth)* | Neo4j credentials |
| `MOCK_DIR` | backend | `mock_data` | Directory containing `demo_payload.json` |
| `NEXT_PUBLIC_API_BASE` | frontend | `http://localhost:8080` | Backend base URL, baked in at build time |

The backend requires **both** `GROQ_API_KEY` and `NVIDIA_API_KEY` to attempt live calls; if either
is missing, or `MOCK_MODE=true`, every ingest is served from the Golden Dataset regardless of what
the client requests.

---

## API reference

Base URL: `http://localhost:8080`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/health` | `{status, worker, mock_only}` — liveness + whether live inference is available |
| `POST` | `/api/v1/ingest` | Multipart form (`manual`, `schematic`); runs the full pipeline synchronously, returns `{job_id, status}` |
| `GET` | `/api/v1/graph` | Full graph in `react-force-graph` shape: `{nodes: [{id, group, label, val}], links: [{source, target, label}]}` |
| `GET` | `/api/v1/spatial` | `{spatial: [{equipment_tag, confidence, bounding_box}]}` — every mapped bounding box |
| `GET` | `/api/v1/node/{tag}/context` | Drawer payload for one equipment tag: rules, spatial coords, linked assets |
| `GET` | `/api/v1/logs` | Buffered log lines from the most recent ingest job |

All endpoints are CORS-open (`Access-Control-Allow-Origin: *`) — this is a hackathon demo, not a
multi-tenant service; see [Known limitations](#known-limitations).

---

## Data model

**In-memory store** (`backend/internal/store`) — source of truth for all reads:

```
equipment: tag_id -> Entity{name, system, rules}
rules:     rule_id -> Rule{category, description, source_paragraph}
spatial:   tag_id -> SpatialHit{confidence, bounding_box}
hasRule:   tag_id -> [rule_id, ...]           (edges)
```

**Neo4j mirror** (best-effort, written via one `UNWIND`/`MERGE` transaction per ingest):

```cypher
(:Equipment {tag_id})-[:HAS_RULE]->(:Rule {description, category, rule_id, source})
(:Equipment {tag_id})-[:LOCATED_AT]->(:Coordinate {x_min, y_min, x_max, y_max, coord_id})
```

Both `Rule` and `Coordinate` nodes are `MERGE`d on their content, so re-ingesting the same
document is idempotent — it doesn't create duplicate nodes.

---

## Testing

```bash
cd backend  && go test ./...          # 20 tests: store, ai (sanitizer/denormalize/region-fallback),
                                       # pipeline, router (httptest), graphdb
cd worker   && .venv/bin/python -m pytest -q     # 7 tests: chunking, extraction, image compression
cd frontend && bun run test           # 32 tests (vitest + RTL): colors, store, api client,
                                       # SchematicViewer, ContextDrawer, IngestPanel
cd frontend && bun run test:e2e       # Playwright: full click-through — mock ingest → click 2D bbox
                                       # → drawer opens with matching tag → bbox turns red →
                                       # 3D canvas mounted → zero console errors
./scripts/compose-smoke-test.sh       # builds all 3 images, brings up the full compose stack,
                                       # polls all 4 health endpoints, runs the e2e test against
                                       # the *containerized* stack, tears down
```

---

## Repo layout

```
backend/
  cmd/server/        entrypoint: env wiring, service construction
  internal/router/   HTTP handlers, CORS, request parsing
  internal/pipeline/ orchestration: worker -> Groq + NVIDIA -> store -> Neo4j mirror
  internal/ai/       Groq + NVIDIA HTTP clients, LLM JSON sanitization/recovery
  internal/store/    in-memory thread-safe graph store (source of truth)
  internal/graphdb/  Neo4j driver wrapper, Cypher, best-effort mirror
  internal/worker/   HTTP client for the Python worker
  internal/models/   shared payload types
  mock_data/         Golden Dataset payload for Mock Mode

worker/
  main.py            FastAPI app: /health, /parse
  test_worker.py

frontend/
  app/               Next.js app router shell (page.tsx, layout.tsx)
  components/        Navbar, IngestPanel, SchematicViewer, GraphEngine, ContextDrawer, Toasts
  lib/               types, Zustand store, API client, colors, useOmniGraph orchestration hook
  e2e/               Playwright click-through spec

demo_assets/         Golden Dataset source files (pump_manual.pdf, plant_schematic.png)
scripts/             compose-smoke-test.sh
docker-compose.yml   neo4j + worker + backend + frontend
.env.example         required environment variables, documented
```

---

## Design decisions & tradeoffs

**NVIDIA vision localization is a two-tier fallback, not a single prompt.** The 11B vision model
is unreliable at grounding pixel coordinates: asked directly for `x_min/y_min/x_max/y_max`, it
frequently echoes the JSON template's example values verbatim (all zeros) instead of looking at
the image. The backend detects this (`degenerateSpatial`: every returned box has zero area) and
retries with a coarser prompt — "which of these 9 regions (top-left, center, ...) is this tag
in?" — then synthesizes a bounding box from a 3×3 grid over the image. This trades pixel precision
for reliability: verified against the Golden Dataset, the region-fallback correctly identifies the
right grid cell for both demo tags, landing within ~150px of the true center on a 900px-wide
image. A larger vision model would remove the need for this fallback entirely.

**LLM JSON parsing has two layers of recovery**, not just a happy-path `json.Unmarshal`:
`sanitizeLLMJSON` strips markdown fences and takes the outermost `{...}` slice (handles "here's
your JSON: ```json {...} ```"-style wrapping); if that still fails to parse, `unmarshalLLMJSON`
walks backward from the last `}` looking for the last *valid* JSON object, because models that
ramble before answering usually finish with the real answer.

**The ingest endpoint runs the pipeline synchronously** inside the HTTP handler rather than
returning `202` immediately and pushing updates over SSE/WebSocket. For a single-demo-operator
scale (one ingest at a time, sub-2s pipeline), this trades away true async streaming for the
simplicity of "the response body's arrival means the graph is ready" — the frontend doesn't need
a subscription mechanism to know when to poll `/graph`.

**Neo4j is a mirror, never a read path.** This was a deliberate scope cut: wiring Neo4j as the
live read source would mean every UI click pays a Bolt round-trip, and a Neo4j outage would break
the whole app. Writing to it best-effort (log-and-continue on failure) gets the "real, queryable
knowledge graph" property for judges/auditors without that fragility.

---

## Known limitations

- **CORS is wide open** (`Access-Control-Allow-Origin: *`) and there is no authentication on any
  endpoint. This is intentional for a local/demo deployment; do not expose this backend to the
  public internet as-is.
- **Vision bounding boxes are coarse, not pixel-precise** when the region-fallback triggers (see
  above) — expect a few-hundred-pixel margin of error on a schematic in the 1000px range, not
  exact valve-corner accuracy.
- **Neo4j holds no read traffic** — if you query it directly (`http://localhost:7474`), you'll see
  the mirrored graph, but a Neo4j outage never affects the running app (by design).
- **Single active ingest job at a time** — `/api/v1/logs` and the in-memory store hold state for
  the *last* ingest; concurrent ingests from multiple clients would race. Fine for a single-user
  demo, not for multi-tenant use.
- **No persistence for the in-memory store** — restarting the backend clears the graph (Neo4j's
  mirror survives, but nothing reads from it).
