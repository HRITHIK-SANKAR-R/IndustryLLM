================================================================================
TECHNICAL REQUIREMENTS DOCUMENT (TRD)
PROJECT: OMNI-GRAPH (AI Industrial Knowledge Intelligence Brain)
TARGET: ET AI Hackathon 2026 - Problem Statement 8
VERSION: 1.0.0
STATUS: APPROVED FOR HACKATHON SPRINT EXECUTION
================================================================================

TABLE OF CONTENTS
1. System Architecture & Component Interactions
2. Infrastructure & Local Edge Setup
3. AI Inference & Orchestration Pipeline
4. Database Schema & Neo4j Indexing
5. API Interface Definitions & Contracts
6. Concurrency, Rate Limiting & Error Handling
7. Frontend Rendering Engine (WebGL/Next.js)
8. Deployment & Execution Runbook

================================================================================
1. SYSTEM ARCHITECTURE & COMPONENT INTERACTIONS
================================================================================
The Omni-Graph system utilizes a decoupled Hybrid-Edge architecture. 

[User UI] (Next.js/Bun) 
   │
   ▼ HTTP/JSON (REST)
[Primary Go Router] (Port 8080) ───[File System/Tmp]───> [Python Worker] (Port 8000)
   │                                                             │
   ├──> [Neo4j DB] (Port 7687 - Bolt)                            ├──> `PyMuPDF` Text Extraction
   │                                                             └──> OpenCV Image Pre-processing
   │
   ├──> [Groq API] (via Go HTTP Client) -> Semantic Logic (llama-3.3-70b-versatile)
   └──> [NVIDIA NIM API] (via Go HTTP Client) -> Vision Inference (Llama-3.2-11B-Vision)

Data Flow Sequence:
1. Client uploads multi-part form data (PDF manual, PNG schematic).
2. Go Router saves to `/tmp` and signals Python Worker via internal RPC/HTTP.
3. Python extracts text chunks and normalizes the image.
4. Go Router spins up Goroutines to fetch AI inference concurrently from Groq and NVIDIA.
5. Go Router aggregates JSON responses, parses into Cypher queries, and executes DB writes.
6. Frontend polls/subscribes to Go Router for Graph updates.

================================================================================
2. INFRASTRUCTURE & LOCAL EDGE SETUP
================================================================================
Target Hardware: 16GB RAM, 4GB VRAM (NVIDIA RTX 3050 or similar).
Operating System: Windows (WSL2) or Linux (Ubuntu/Arch).

2.1 Services
- Neo4j: `docker run -d --name omnigraph-neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=none neo4j:latest`
- Go Backend: `go run cmd/server/main.go`
- Python Worker: `uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2`
- Next.js UI: `bun run dev`

================================================================================
3. AI INFERENCE & ORCHESTRATION PIPELINE
================================================================================
3.1 Text Logic Pipeline (Groq)
- Model: `llama-3.3-70b-versatile`
- Endpoint: `https://api.groq.com/openai/v1/chat/completions`
- Parameters: `temperature: 0.0` (Strictly deterministic), `response_format: { "type": "json_object" }`
- Chunking Strategy: The Python worker must split the PDF text using a sliding window (e.g., 2000 tokens per chunk, 200 token overlap) to guarantee we never exceed the 6,000 TPM limit. 

3.2 Vision Logic Pipeline (NVIDIA NIM)
- Model: `meta/llama-3.2-11b-vision-instruct`
- Endpoint: `https://integrate.api.nvidia.com/v1/chat/completions`
- Parameters: `temperature: 0.1`, `max_tokens: 1024`
- Payload Optimization: Before sending the P&ID schematic, the Python worker compresses the image to a max dimension of 2048x2048 (JPEG, 85% quality) to reduce payload size and prevent NIM timeout errors.

================================================================================
4. DATABASE SCHEMA & NEO4J INDEXING
================================================================================
4.1 Node Definitions
- (E:Equipment {tag_id: STRING, class: STRING})
- (M:Manual {doc_id: STRING, section: STRING, text_content: STRING})
- (R:Rule {rule_id: STRING, category: STRING, description: STRING})
- (C:Coordinate {x_min: INT, y_min: INT, x_max: INT, y_max: INT})

4.2 Edge (Relationship) Definitions
- (E)-[:DOCUMENTED_IN]->(M)
- (E)-[:MUST_COMPLY_WITH]->(R)
- (E)-[:MAPPED_TO_SPATIAL]->(C)

4.3 Indexing Strategy (CRITICAL for sub-50ms queries)
Neo4j must be pre-configured with B-Tree indices on standard lookup properties to ensure instantaneous graph traversal during the UI demo.
```cypher
CREATE INDEX equipment_tag_idx FOR (e:Equipment) ON (e.tag_id);
CREATE INDEX rule_cat_idx FOR (r:Rule) ON (r.category);
================================================================================
5. API INTERFACE DEFINITIONS & CONTRACTS
5.1 Go Router External API (Consumed by Next.js)

POST /api/v1/ingest
Content-Type: multipart/form-data

file1: manual.pdf

file2: schematic.png
Response (202 Accepted):
{
"job_id": "uuid-1234",
"status": "processing"
}

GET /api/v1/graph
Response (200 OK):
{
"nodes": [
{"id": "V-104", "group": "Equipment", "label": "Valve"},
{"id": "R-10", "group": "Rule", "label": "Torque 45Nm"}
],
"links": [
{"source": "V-104", "target": "R-10", "label": "MUST_COMPLY_WITH"}
]
}

5.2 AI Payload Contracts

Groq Expected JSON Output (Enforced via Prompting):
{
"extracted_data": [
{
"equipment_tag": "PUMP-2A",
"rule_description": "Ensure bearing lubrication every 400 hours.",
"rule_category": "Maintenance"
}
]
}

NVIDIA NIM Expected JSON Output:
{
"spatial_data": [
{
"equipment_tag": "PUMP-2A",
"bounding_box": [345, 120, 400, 180]
}
]
}

================================================================================
6. CONCURRENCY, RATE LIMITING & ERROR HANDLING
6.1 Go Channels & WaitGroups
When processing multiple text chunks, the Go router spawns a Goroutine per chunk.

A sync.WaitGroup ensures all chunks are processed before executing the Neo4j bulk insert.

A buffered channel (size = 5) acts as a Semaphore to throttle outgoing HTTP requests to Groq, ensuring we do not exceed 30 RPM.

6.2 Resilience: The Regex Stripper
LLMs hallucinate JSON formatting. The Go backend implements a clean-up utility before unmarshaling:

Go
func sanitizeLLMJSON(raw string) string {
    start := strings.Index(raw, "{")
    end := strings.LastIndex(raw, "}")
    if start == -1 || end == -1 { return "{}" }
    return raw[start : end+1]
}
6.3 The "Mock Mode" Circuit Breaker
If env MOCK_MODE=true, the Go HTTP client bypasses Groq and NVIDIA NIM network calls entirely, returning hardcoded []byte JSON payloads read from /internal/mock/.

================================================================================
7. FRONTEND RENDERING ENGINE
7.1 Canvas Strategy
react-force-graph-3d runs on WebGL. Rendering 500+ nodes instantly will block the main thread.

Optimization: Enable warmupTicks={100} and cooldownTicks={0}. The physics engine runs calculations in the background before rendering the first frame, preventing the "exploding spiderweb" visual glitch.

7.2 Bounding Box Overlay (The P&ID Viewer)

The P&ID image is rendered in an HTML5 <canvas>.

Coordinates returned from NVIDIA (x_min, y_min, x_max, y_max) are mapped relative to the canvas dimensions.

Example scaling logic: canvasX = (x_min / original_image_width) * canvas.clientWidth.

7.3 State Management

Zustand or React Context is used to sync the selected node.

onNodeClick in the 3D Graph -> Updates Zustand Store -> Triggers <canvas> to draw a red rectangle over the corresponding coordinate.

================================================================================
8. DEPLOYMENT & EXECUTION RUNBOOK (48H SPRINT)
[T-MINUS 48:00] INITIALIZATION

Run docker-compose up -d neo4j

Initialize Git repo. Scaffold Go (go mod init), Python (pip install uvicorn fastapi pymupdf), and Next.js (bun create next-app).

[T-MINUS 36:00] PIPELINE WIRING

Write Go wrapper for Groq API. Test rate limit channels.

Write Python text chunking. Test PDF extraction speed.

Execute end-to-end string extraction -> Groq JSON validation.

[T-MINUS 24:00] DATABASE & VISION

Write Cypher insertion module in Go.

Connect NVIDIA NIM API for Vision bounding boxes.

Validate Graph topology (Check if V-104 text node links to V-104 spatial node).

[T-MINUS 12:00] VISUALIZATION

Mount Next.js dashboard.

Hook up react-force-graph.

Implement 2-way binding (Click Graph -> Highlight Image / Click Image -> Highlight Graph).

[T-MINUS 04:00] DEMO HARDENING

Set MOCK_MODE=true and record the static response payloads.

Rehearse the Visakhapatnam narrative pitch.

Record high-res screencast showing sub-second graph generation.

[T-MINUS 01:00] SUBMISSION

Ensure architecture diagram (Figma/Excalidraw) matches this TRD.

Push to GitHub (public). Submit video link.
================================================================================
