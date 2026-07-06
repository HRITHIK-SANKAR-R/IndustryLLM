================================================================================
APPLICATION FLOW & USER JOURNEY SPECIFICATION
PROJECT: OMNI-GRAPH (AI Industrial Knowledge Intelligence Brain)
TARGET: ET AI Hackathon 2026 - Problem Statement 8
VERSION: 1.0.0
FORMAT: Plain Text / Markdown (Suitable for .txt export)
ESTIMATED LENGTH: ~8 Pages of Detailed Specifications
================================================================================

TABLE OF CONTENTS
[PAGE 1] System State Definitions & Global Variables
[PAGE 2] Core User Journey: The Initialization Flow (Boot to Idle)
[PAGE 3] Core User Journey: The Ingestion Flow (File Upload to Knowledge Graph)
[PAGE 4] Backend Orchestration Flow: The AI Pipeline (Go -> Groq -> NVIDIA)
[PAGE 5] Core User Journey: The Query Flow (Spatial Discovery)
[PAGE 6] Core User Journey: The Contextual Deep-Dive (Graph Traversal)
[PAGE 7] Fallback & Error Handling Flows (The Safety Nets)
[PAGE 8] "Mock Mode" Offline Demo Flow (Pitch Protection)

================================================================================
[PAGE 1] SYSTEM STATE DEFINITIONS & GLOBAL VARIABLES
================================================================================
1.1 Global State (Zustand - Frontend)
The frontend relies on a minimal, centralized state to maintain perfect synchronicity between the 2D canvas, the 3D graph, and the intelligence drawer.
- `appStatus`: ENUM ['IDLE', 'PROCESSING', 'READY', 'ERROR']
- `activeNodeId`: STRING (Nullable) - The currently selected Equipment Tag (e.g., "V-104").
- `graphData`: OBJECT - Contains `nodes[]` and `links[]` fetched from Neo4j.
- `spatialData`: ARRAY - Contains bounding boxes `[x_min, y_min, x_max, y_max]` mapped to `tag_id`s.
- `mockModeEnabled`: BOOLEAN - Toggles the offline fallback circuit.

1.2 Backend State (Go Router)
- `ProcessingQueue`: Channel managing concurrent file parsing.
- `RateLimitTokenBucket`: Throttle mechanism to respect NVIDIA (40 RPM) and Groq (30 RPM) limits.

================================================================================
[PAGE 2] CORE USER JOURNEY: THE INITIALIZATION FLOW (BOOT TO IDLE)
================================================================================
2.1 Trigger: User opens `localhost:3000` or the Vercel deployed URL.
2.2 Flow:
1. [Frontend] Client requests the initial bundle.
2. [Frontend] Next.js mounts the application shell (Navbar, Left Sidebar, Main Canvas Split).
3. [Frontend] Zustand initializes state: `appStatus` = 'IDLE', `activeNodeId` = null.
4. [Frontend] Sends a lightweight health-check ping to Go Backend `/api/v1/health`.
5. [Backend] Go Router verifies Neo4j connection (`neo4j://localhost:7687`).
6. [Backend] Responds `200 OK`.
7. [Frontend] Navbar status indicator turns Emerald Green. The UI renders the blank "Dropzone" in the left sidebar and an empty starry void in the 3D canvas.

================================================================================
[PAGE 3] CORE USER JOURNEY: THE INGESTION FLOW (UPLOAD TO KNOWLEDGE GRAPH)
================================================================================
3.1 Trigger: User drags and drops `pump_manual.pdf` and `schematic.png` into the Left Sidebar.
3.2 Flow:
1. [Frontend] Validates file types and sizes locally.
2. [Frontend] Updates `appStatus` -> 'PROCESSING'.
3. [Frontend] 3D canvas triggers a "scanning" wireframe animation.
4. [Frontend] Posts multipart form data to Backend `/api/v1/ingest`.
5. [Backend] Receives payload, assigns `job_id`, saves files to temporary memory `/tmp/`.
6. [Backend] Responds `202 Accepted` to Frontend.
7. [Frontend] Terminal UI component begins streaming simulated or real-time logs via Server-Sent Events (SSE) or WebSockets from the Backend.
8. [Backend] Hands files off to the AI Pipeline (See Page 4).

================================================================================
[PAGE 4] BACKEND ORCHESTRATION FLOW: THE AI PIPELINE (GO -> GROQ -> NVIDIA)
================================================================================
4.1 Trigger: Files saved to `/tmp/`. Go Router initiates processing.
4.2 Flow:
1. [Go -> Python] Go makes a fast RPC/HTTP call to the local Python worker containing the file paths.
2. [Python] Uses `PyMuPDF` to rip raw text from the PDF. Applies semantic chunking.
3. [Python] Uses `OpenCV` or standard libraries to resize/compress the PNG schematic (if > 2048px) to satisfy API payload constraints.
4. [Python -> Go] Returns raw text chunks and base64 encoded image.
5. [Go - Parallel Execution] Go router spawns goroutines to execute API calls concurrently:
   - Branch A (Semantic Logic): Go sends text chunks to Groq API.
   - Branch B (Spatial Logic): Go sends base64 image to NVIDIA NIM API.
6. [Go - Synchronization] A `sync.WaitGroup` waits for both branches to complete.
7. [Go - JSON Validation] Receives payloads. Executes Regex stripper to remove LLM markdown formatting. Unmarshals JSON.
8. [Go -> Neo4j] Executes bulk Cypher transaction:
   - MERGE Equipment nodes.
   - MERGE Manual/Rule nodes.
   - MERGE Coordinate nodes.
   - CREATE Relationships.
9. [Go -> Frontend] Pushes event: `job_id_complete`.

================================================================================
[PAGE 5] CORE USER JOURNEY: THE QUERY FLOW (SPATIAL DISCOVERY)
================================================================================
5.1 Trigger: The graph is ready. `appStatus` = 'READY'. The user wants to find information about a specific valve they see on the drawing.
5.2 Flow:
1. [Frontend] The user pans/zooms the 2D Schematic Viewer (Top Pane).
2. [Frontend] The user hovers over the drawing. The mouse enters an SVG bounding box generated by NVIDIA NIM.
3. [Frontend] The bounding box border turns solid Electric Blue.
4. [Frontend] The user clicks the bounding box.
5. [Frontend] The `onClick` handler fires, extracting the attached `tag_id` (e.g., "V-104").
6. [Frontend] Updates Zustand: `set({ activeNodeId: "V-104" })`.
7. [Frontend] This single state change simultaneously triggers two UI reactions:
   - The 3D Graph (Bottom Pane) camera interpolates and flies directly to the "V-104" node in 3D space, dimming all non-connected nodes.
   - The Intelligence Drawer (Right Sidebar) slides open.

================================================================================
[PAGE 6] CORE USER JOURNEY: THE CONTEXTUAL DEEP-DIVE (GRAPH TRAVERSAL)
================================================================================
6.1 Trigger: The Intelligence Drawer slides open, requiring contextual data.
6.2 Flow:
1. [Frontend] The Drawer component observes the new `activeNodeId` ("V-104").
2. [Frontend] The Drawer makes a highly specific GET request to Backend: `/api/v1/node/V-104/context`.
3. [Backend] Executes a Cypher query on Neo4j to fetch 1st and 2nd-degree connections:
   ```cypher
   MATCH (e:Equipment {tag_id: "V-104"})-[r]-(connected)
   RETURN e, r, connected
[Backend] Formats the returned graph data into a structured JSON response (categorizing Rules, Manual texts, and neighboring assets) and returns it.

[Frontend] Renders the data in the Drawer:

Displays the extracted maintenance rule from Groq (e.g., "Torque bolts to 45Nm").

Displays the regulatory compliance tag.

Renders a horizontal scroll of connected assets (e.g., connected pipes or pumps).

================================================================================
[PAGE 7] FALLBACK & ERROR HANDLING FLOWS (THE SAFETY NETS)
7.1 Scenario A: Groq API Rate Limit Hit (HTTP 429)

[Backend] Go HTTP client receives a 429 status code.

[Backend] Triggers an Exponential Backoff retry function (wait 2s, retry, wait 4s, retry).

[Backend] Pushes a message to the Frontend Terminal UI: [WARN] Rate limit hit. Queueing request...

[Backend] If retry fails 3 times, aborts job, returns 500 Error, and logs failure.

7.2 Scenario B: LLM Hallucinates Invalid JSON

[Backend] Go attempts to json.Unmarshal the response from NVIDIA or Groq.

[Backend] Unmarshal fails due to malformed data.

[Backend] Executes the sanitizeLLMJSON() regex function.

[Backend] Attempts Unmarshal again. If it still fails, it drops that specific chunk (to prevent a total pipeline crash) and logs the error to the terminal.

7.3 Scenario C: WebGL Context Lost (Frontend Crash)

[Frontend] react-force-graph crashes due to memory limits (e.g., too many nodes).

[Frontend] React Error Boundary catches the crash.

[Frontend] Renders a fallback UI: "Graph rendering error. Reloading canvas..."

[Frontend] Re-initializes the graph with a lower node-render limit.

================================================================================
[PAGE 8] "MOCK MODE" OFFLINE DEMO FLOW (PITCH PROTECTION)
8.1 Context: The venue Wi-Fi is dead. The judging panel is watching.
8.2 Trigger: User clicks the hidden "Mock Mode" toggle in the Navbar.
8.3 Flow:

[Frontend] Updates Zustand: set({ mockModeEnabled: true }).

[Frontend] Renders a subtle warning banner: "[!] Edge-Compute Mode Active. External APIs decoupled."

[Frontend] User uploads files exactly as in the standard flow.

[Backend] Go Router receives the /ingest request. It checks the header for mock-mode: true.

[Backend] Go Router BYPASSES the Python worker, Groq API, and NVIDIA NIM entirely.

[Backend] Go Router reads static, pre-computed JSON files from local disk (/internal/mock/static_groq_response.json and /internal/mock/static_nvidia_response.json).

[Backend] Go Router simulates a realistic 1.5-second processing delay using time.Sleep().

[Backend] Go Router injects the static JSON into Neo4j and returns success.

[Result] The demo executes flawlessly, the UI animations fire perfectly, and the graph renders exactly as expected, completely independent of external network stability.

================================================================================
END OF APPLICATION FLOW & USER JOURNEY SPECIFICATION
