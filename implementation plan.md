================================================================================
IMPLEMENTATION PLAN & 48-HOUR SPRINT RUNBOOK
PROJECT: OMNI-GRAPH (AI Industrial Knowledge Intelligence Brain)
TARGET: ET AI Hackathon 2026 - Problem Statement 8
VERSION: 1.0.0
FORMAT: Plain Text / Markdown (Suitable for .txt export)
ESTIMATED LENGTH: ~8 Pages of Detailed Specifications
================================================================================

TABLE OF CONTENTS
[PAGE 1] Rules of Engagement & Team Allocation
[PAGE 2] Pre-Hackathon Checklist (T-Minus 24 Hours)
[PAGE 3] Phase 1: Infrastructure & Scaffolding (Hours 0-4)
[PAGE 4] Phase 2: Ingestion & AI Pipeline Build (Hours 4-16)
[PAGE 5] Phase 3: Knowledge Graph Construction (Hours 16-26)
[PAGE 6] Phase 4: Frontend Visualization & Canvas (Hours 26-38)
[PAGE 7] Phase 5: Hardening, Fallbacks & Mock Mode (Hours 38-44)
[PAGE 8] Phase 6: The Demo Sequence & Pitch Prep (Hours 44-48)

================================================================================
[PAGE 1] RULES OF ENGAGEMENT & TEAM ALLOCATION
================================================================================
1.1 The Golden Rule of Hackathons
DO NOT BUILD WHAT YOU CANNOT DEMO. The architecture is Hybrid-Edge, but the priority is visual impact and zero-latency execution on stage. If a feature takes 5 hours to build but is invisible to the judges, cut it.

1.2 Team Role Allocation (Assuming 3-4 Members)
- Member 1 (Backend/Systems Lead): Owns the Go Router, concurrent channels, API rate limiting, and the Mock Mode fallback.
- Member 2 (AI/Data Engineer): Owns the Python PyMuPDF chunker, Groq/NVIDIA prompts, and the Neo4j Cypher queries. 
- Member 3 (Frontend/Graphics Lead): Owns Next.js, `react-force-graph`, Zustand state, and the 2D SVG canvas overlay.
- Member 4 (Domain/Pitch Strategist): Owns the slide deck, demo script, manual data curation (ensuring the dummy PDF perfectly matches the dummy schematic), and video recording.

1.3 Git Strategy
- Trunk-based development. No long-lived branches.
- Branches: `feature/go-ingest`, `feature/neo4j-cypher`, `feature/3d-graph`.
- Merge to `main` every 4 hours with a working, demo-able state.

================================================================================
[PAGE 2] PRE-HACKATHON CHECKLIST (T-MINUS 24 HOURS)
================================================================================
This must be done BEFORE the clock starts.

2.1 Environment Setup
- Install Go 1.22+, Python 3.11+, Node 20+ (or Bun 1.1+).
- Install Docker Desktop (Ensure WSL2 is active if on Windows).
- Pull Neo4j Image: `docker pull neo4j:latest`.

2.2 Key Generation
- Groq Cloud: Generate API key. Verify access to `llama-3.3-70b-versatile`.
- NVIDIA Developer: Generate API key (`nvapi-`). Verify access to `meta/llama-3.2-11b-vision-instruct`.

2.3 The "Golden Dataset" Curation
Do not use random PDFs during the hackathon. 
- Create `demo_assets/pump_manual.pdf` (15 pages, clean text, specifically mentioning "Valve V-104" and "Pump P-201A").
- Create `demo_assets/plant_schematic.png` (Clean P&ID drawing containing visual tags for V-104 and P-201A).
- Manually note the approximate X/Y coordinates of these tags so you can prompt-engineer NVIDIA NIM to hit them perfectly.

================================================================================
[PAGE 3] PHASE 1: INFRASTRUCTURE & SCAFFOLDING (HOURS 0-4)
================================================================================
Objective: Repositories created, servers talking to each other, DB running.

3.1 Hour 0-1: Repository & DB Boot
- Initialize Git repo: `omni-graph-hackathon`.
- Boot Neo4j: `docker run -d -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=none neo4j:latest`
- Connect to `http://localhost:7474` and verify the browser is active.

3.2 Hour 1-2: Backend Scaffolding (Go & Python)
- (Go): `go mod init omnigraph`. Setup basic standard library `net/http` server on port 8080.
- (Go): Create endpoints `/api/v1/health` and `/api/v1/ingest`.
- (Python): `pip install fastapi uvicorn pymupdf`. Setup on port 8000.
- (Test): Ping Go from Postman. Have Go ping Python.

3.3 Hour 2-4: Frontend Scaffolding (Next.js)
- (Next): `bun create next-app frontend`.
- Install deps: `bun add zustand react-force-graph-3d tailwindcss`.
- Create global layout: Navbar, Left Sidebar, Right Split Panes.
- (Test): Fetch `/api/v1/health` from Next.js and display "System Online" in Navbar.

================================================================================
[PAGE 4] PHASE 2: INGESTION & AI PIPELINE BUILD (HOURS 4-16)
================================================================================
Objective: PDF text and Image bits leave the local machine, hit the APIs, and return valid JSON.

4.1 Hour 4-8: Python Document Parsing
- Build `extract_text(pdf_path)` using PyMuPDF.
- Implement semantic chunking: Split by paragraphs, keeping chunks under 4000 chars to respect Groq's TPM limits.
- Build `compress_image(img_path)` using OpenCV or PIL to ensure schematic is under 2MB for NVIDIA API.

4.2 Hour 8-12: Go to Groq Integration (Text Logic)
- Build HTTP client in Go targeting Groq.
- Implement the strict system prompt for `llama-3.3-70b-versatile`.
- Write the Regex JSON Stripper in Go to catch hallucinations (e.g., stripping ` ```json `).
- Unmarshal response into the `ExtractedRule` Go struct.

4.3 Hour 12-16: Go to NVIDIA Integration (Spatial Logic)
- Build HTTP client in Go targeting NVIDIA NIM.
- Send base64 image + prompt: "Find bounding box for {tag_id}".
- Unmarshal response into the `SpatialCoordinate` Go struct.
- TEST CHECKPOINT: Upload the "Golden Dataset" via Postman. Verify Go prints perfectly structured JSON to the console for both Text and Spatial data.

================================================================================
[PAGE 5] PHASE 3: KNOWLEDGE GRAPH CONSTRUCTION (HOURS 16-26)
================================================================================
Objective: JSON data is injected into Neo4j using optimized Cypher queries.

5.1 Hour 16-18: Database Constraints
- Run initialization queries in Neo4j browser:
  `CREATE CONSTRAINT FOR (e:Equipment) REQUIRE e.tag_id IS UNIQUE;`
  `CREATE INDEX FOR (r:Rule) ON (r.category);`

5.2 Hour 18-22: The Go Cypher Driver
- Import `github.com/neo4j/neo4j-go-driver/v5/neo4j`.
- Write the `BulkInsertGraph(payload)` function.
- Use Cypher `UNWIND` to batch insert nodes (Equipment, Rule, Coordinate) and edges (HAS_RULE, LOCATED_AT) in a single transaction to save time.

5.3 Hour 22-26: Frontend Read APIs
- Write Go endpoint `GET /api/v1/graph`. Formats Neo4j data into `{ nodes: [], links: [] }` for the 3D visualizer.
- Write Go endpoint `GET /api/v1/node/{tag_id}/context`. Fetches 1st-degree connections for the Right Sidebar drawer.
- TEST CHECKPOINT: Open Neo4j browser. Query `MATCH (n) RETURN n`. Ensure the visual graph looks correct.

================================================================================
[PAGE 6] PHASE 4: FRONTEND VISUALIZATION & CANVAS (HOURS 26-38)
================================================================================
Objective: Bring the data to life. This is what wins the hackathon.

6.1 Hour 26-30: The 3D Omni-Graph Engine
- Mount `ForceGraph3D` in the bottom-right pane.
- Fetch data from `/api/v1/graph`.
- Configure physics: `warmupTicks={100}` (stops exploding nodes).
- Map colors: Equipment (Blue), Rule (Amber).
- Bind `onNodeClick`: Updates Zustand `activeNodeId`.

6.2 Hour 30-34: The 2D Spatial Schematic
- Mount HTML5 `<canvas>` in the top-right pane.
- Render `plant_schematic.png` as the background.
- Fetch spatial coordinates from Neo4j. Translate (x,y) to canvas pixels.
- Draw transparent SVG `rect` elements over the equipment.
- Bind `onClick`: Updates Zustand `activeNodeId`.

6.3 Hour 34-38: Context Drawer & Sync
- Build the sliding Right Drawer component.
- Subscribe to Zustand `activeNodeId`.
- When ID changes, fetch `/api/v1/node/{tag_id}/context`.
- Populate Drawer with Groq's extracted text and OSHA/Compliance rules.
- TEST CHECKPOINT: Click a node in 3D space -> The 2D image highlights the bounding box -> The Drawer opens showing the exact manual text.

================================================================================
[PAGE 7] PHASE 5: HARDENING, FALLBACKS & MOCK MODE (HOURS 38-44)
================================================================================
Objective: Make the system bulletproof against Murphy's Law on demo day.

7.1 Hour 38-40: The "Mock Mode" Circuit Breaker
- In Next.js, add a "Mock Mode" toggle switch to the Navbar.
- Run the "Golden Dataset" through the live API once. Copy the terminal JSON output.
- Save this output to `backend/mock_data/demo_payload.json`.
- Modify Go Router: If `req.Header.Get("X-Mock-Mode") == "true"`, bypass HTTP calls to Groq/NVIDIA. Sleep for 1.5s, then read and return the static JSON file.

7.2 Hour 40-42: Rate Limiting & UI Polish
- Ensure Go Router uses a channel semaphore to limit Groq requests to 5 concurrent routines.
- Add CSS animations to the Frontend: Loading spinners, glowing borders on selected Canvas bounding boxes, typing-effect on the Terminal logs.

7.3 Hour 42-44: Edge Case Sweeps
- Check for `null` pointer exceptions in Go if NVIDIA returns an empty spatial array.
- Check React error boundaries if `react-force-graph` gets bad data.

================================================================================
[PAGE 8] PHASE 6: THE DEMO SEQUENCE & PITCH PREP (HOURS 44-48)
================================================================================
Objective: Package the engineering into an undeniable business value proposition.

8.1 Hour 44-46: Pitch Deck & Impact Model
- Slide 1: The Problem (Visakhapatnam Steel Plant 2025 - Knowledge fragmentation causes fatal errors).
- Slide 2: The Solution (Omni-Graph: Hybrid-Edge AI tying text to spatial realities).
- Slide 3: Technical Moat (Why Neo4j + APIs beats generic RAG. Explain the 0-cost, 4GB RAM local-first architecture).
- Slide 4: Business Impact (Quantify reduction in unplanned downtime and safety violations).

8.2 Hour 46-47: Video Recording (The "One Take")
- Turn ON "Mock Mode" (Do not risk the venue internet during recording).
- Screen record the "Golden Walkthrough".
- Script: "Watch as we upload a 15-page manual and a dense CAD drawing. (Upload). Our Go backend routes text to Groq and vision to NVIDIA. (Graph explodes onto screen). In 1.2 seconds, we've built a unified ontology. When the technician clicks Valve V-104 on the drawing, they instantly get the torque specs and OSHA rule. No hallucinations. Complete traceability."

8.3 Hour 47-48: Submission
- Push final commits to `main`.
- Ensure GitHub `README.md` contains the Architecture Diagram and instructions to run `docker-compose up`.
- Submit video link and pitch deck to hackathon portal.
- Rest. You have just built a winner.

================================================================================
END OF IMPLEMENTATION PLAN
================================================================================