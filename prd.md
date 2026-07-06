================================================================================
PRODUCT REQUIREMENTS DOCUMENT (PRD)
PROJECT: OMNI-GRAPH (AI Industrial Knowledge Intelligence Brain)
TARGET: ET AI Hackathon 2026 - Problem Statement 8
VERSION: 1.0.0
================================================================================

TABLE OF CONTENTS
1. Executive Summary
2. System Architecture & Tech Stack
3. Core Workflows & Logic
4. Functional Requirements (FR)
5. Non-Functional Requirements (NFR)
6. Data Schema & Knowledge Graph Ontology
7. API & Integration Contracts
8. UI/UX Design Specifications
9. Risk Mitigation & Fallback Protocols
10. Implementation Plan (48-Hour Sprint)

================================================================================
1. EXECUTIVE SUMMARY
================================================================================
1.1 Vision
To build "Omni-Graph," an air-gapped, Hybrid-Edge AI intelligence platform that eradicates the "knowledge cliff" in asset-intensive industries. It autonomously maps unstructured legacy engineering documents (PDFs) and spatial schematics (P&IDs) into a unified, queryable 3D Knowledge Graph.

1.2 Target Audience & Use Case
Primary User: Industrial Maintenance Technicians & Plant Engineers.
Trigger: A critical pump (V-104) flags an anomaly.
Action: The technician clicks the V-104 node on a digital schematic.
Result: Omni-Graph instantly traverses the knowledge graph to return the exact safety protocol, maintenance manual paragraph, and compliance rule governing that specific valve, reducing unplanned downtime search cycles from hours to milliseconds.

1.3 Competitive Moat (The Hackathon Winning Edge)
- Bypasses traditional, hallucination-prone vector RAG.
- Implements a deterministic Neo4j graph ontology.
- Operates a Hybrid-Edge architecture engineered specifically to run complex AI reasoning on constrained hardware (4GB GPU local limits) while offloading compute to ultra-fast, zero-cost inference APIs.

================================================================================
2. SYSTEM ARCHITECTURE & TECH STACK
================================================================================
The architecture decouples the highly sensitive local database from the heavy compute inference, ensuring data privacy for the enterprise while maintaining sub-second latency.

2.1 Local Edge Backend (The Orchestrator)
- Primary Router: Go (Golang) REST API. Chosen for maximum concurrency handling (goroutines) to prevent API throttling when processing multiple document chunks.
- Data Processing: Python FastAPI microservice. Utilizes `PyMuPDF` for local text extraction and structural document parsing before sending payloads to the cloud.
- Memory/Performance: Rust compiled to WebAssembly (WASM) [Optional/Stretch Goal] for handling massive node-physics calculations on the frontend to keep the UI buttery smooth.

2.2 Cloud Inference Engine (Hybrid-Offload)
- Semantic Logic Engine: Groq API (llama-3.3-70b-versatile). Handles complex entity extraction and JSON schema generation at >300 tokens/second.
- Spatial Vision Engine: NVIDIA NIM API (Llama-3.2-11B-Vision-Instruct or Nemotron). Handles bounding-box extraction from dense P&ID engineering blueprints.

2.3 Database Layer
- Graph Store: Neo4j Community Edition (Local Docker Container).
- Query Language: Cypher.

2.4 Frontend Runtime
- Framework: Next.js / React.
- Execution Environment: Bun (chosen for lightweight, high-speed edge execution).
- Visualization: `react-force-graph` (WebGL accelerated 3D node rendering).

================================================================================
3. CORE WORKFLOWS & LOGIC
================================================================================
3.1 The Document Ingestion Pipeline
1. User uploads a Zip file containing an engineering drawing (PNG/PDF) and a maintenance manual (PDF).
2. Go backend receives the payload and routes files to the Python worker.
3. Python worker extracts raw text from the manual using semantic chunking (splitting by headers/paragraphs to respect the 6,000 TPM Groq limit).
4. Go backend concurrently fires HTTP POST requests:
   - Request A (Text -> Groq): Extracts entities and relationships.
   - Request B (Image -> NVIDIA): Extracts bounding boxes for identified equipment tags.

3.2 The Graph Construction Logic
1. Go backend receives strict JSON from both APIs.
2. It executes a Cypher transaction to merge nodes:
   - Creates (Asset:Equipment {tag: "V-104"})
   - Creates (Doc:Manual {section: "3.2", text: "..."})
   - Creates (Space:Coordinate {x: 450, y: 820})
3. It draws edges: [GOVERNED_BY], [LOCATED_AT].

================================================================================
4. FUNCTIONAL REQUIREMENTS (FR)
================================================================================
FR-1: Multi-Modal Upload
The system MUST accept simultaneous uploads of unstructured text PDFs and high-resolution CAD/P&ID raster images.

FR-2: Deterministic Entity Extraction
The system MUST utilize Groq to parse text into a strictly enforced JSON schema (Equipment ID, Maintenance Rule, Safety Code). Hallucinations or conversational filler in the JSON response must be stripped via backend regex before DB insertion.

FR-3: Spatial Bounding Box Mapping
The system MUST query the NVIDIA vision model to locate absolute pixel coordinates (X_min, Y_min, X_max, Y_max) of specified Equipment IDs on the uploaded schematic.

FR-4: Interactive Graph Rendering
The frontend MUST render a WebGL 3D or 2D node network.
- Nodes must be color-coded by category (Asset = Blue, Rule = Red, Location = Green).
- The physics engine must stabilize within 2 seconds of rendering to prevent UI lag.

FR-5: Bidirectional Querying
- If a user clicks a node on the text UI, the exact bounding box must highlight on the image schematic.
- If a user clicks a coordinate on the image schematic, the graph must traverse to show the associated text rules.

================================================================================
5. NON-FUNCTIONAL REQUIREMENTS (NFR)
================================================================================
NFR-1: Zero-Cost Execution
The entire prototype MUST run on 100% free-tier services (Groq, NVIDIA NIM, local Neo4j).

NFR-2: Hardware Constraint Adherence
The local environment MUST operate smoothly on a machine with 4GB VRAM and 16GB RAM. Heavy LLM weights must NEVER be loaded into local VRAM.

NFR-3: Latency & Rate Limits
- The Go ingestion queue MUST rate-limit outgoing NVIDIA NIM requests to <40 requests per minute.
- Groq queries MUST be chunked to respect the Token-Per-Minute limit.
- End-to-end query retrieval from the Neo4j database must execute in <200ms.

================================================================================
6. DATA SCHEMA & KNOWLEDGE GRAPH ONTOLOGY
================================================================================
6.1 Node Labels
- :Equipment (Properties: tag_id, name, status)
- :Procedure (Properties: step_number, description, criticality)
- :Regulation (Properties: code, description, issuing_body)
- :SchematicNode (Properties: x_min, y_min, x_max, y_max, page_num)

6.2 Relationship Edges (Verbs)
- (Equipment)-[:REQUIRES]->(Procedure)
- (Equipment)-[:COMPLIES_WITH]->(Regulation)
- (Equipment)-[:LOCATED_AT]->(SchematicNode)

6.3 Cypher Insertion Example (Reference for Backend implementation)
MERGE (e:Equipment {tag_id: $tag})
MERGE (p:Procedure {description: $proc})
MERGE (e)-[:REQUIRES]->(p)
MERGE (s:SchematicNode {x_min: $x1, y_min: $y1, x_max: $x2, y_max: $y2})
MERGE (e)-[:LOCATED_AT]->(s)

================================================================================
7. API & INTEGRATION CONTRACTS
================================================================================
7.1 Groq System Prompt Contract
ROLE: "You are a deterministic industrial data extraction engine."
TASK: "Extract equipment tags and their maintenance rules from the text."
OUTPUT FORMAT:
{
  "entities": [
    {
      "equipment_tag": "P-201A",
      "rule": "Torque bolts to 45Nm",
      "type": "Maintenance"
    }
  ]
}
CONSTRAINT: "Return ONLY valid JSON. No markdown. No conversational text."

7.2 NVIDIA NIM Vision Prompt Contract
ROLE: "You are a spatial bounding box extractor for engineering diagrams."
TASK: "Locate the equipment tag {tag_id} in the provided image."
OUTPUT FORMAT:
{
  "coordinates": {
    "x_min": 120, "y_min": 340, "x_max": 180, "y_max": 380
  }
}

================================================================================
8. UI/UX DESIGN SPECIFICATIONS
================================================================================
8.1 Global Layout (Next.js Application)
- Theme: Dark Mode (Industrial Dashboard aesthetic, Slate Grays, Neon accents).
- Viewport: Three-pane layout (Avoid side-by-side splits in underlying component requests; rely on standard flex grids).

8.2 Pane 1: The Ingestion Hub (Left)
- Drag-and-drop zone for PDF and Image uploads.
- Real-time terminal-style logging window showing Go backend processing steps ("Extracting text...", "Querying Groq...", "Building Graph...").

8.3 Pane 2: The Digital Schematic (Top Right)
- Renders the uploaded P&ID drawing.
- Implements an interactive canvas overlay. When the backend returns spatial coordinates, an SVG bounding box is drawn over the equipment.

8.4 Pane 3: The Omni-Graph Interactive Canvas (Bottom Right)
- Renders the `react-force-graph`.
- Hover interactions: Tooltip displaying node properties.
- Click interactions: Triggers a Cypher query to fetch and highlight all connected nodes up to 2 degrees of separation.

================================================================================
9. RISK MITIGATION & FALLBACK PROTOCOLS
================================================================================
9.1 The Demo-Day Wi-Fi Failure Protocol (Mock Mode)
Risk: The hackathon venue internet crashes, breaking Groq and NVIDIA APIs.
Mitigation: 
- The Go backend will contain a `MOCK_MODE=true` environment variable.
- Prior to the final pitch, process the demo dataset once and save the exact JSON API responses locally to `/mock_data/`.
- If a network timeout occurs, the Go router will instantly catch the exception and serve the local JSON files, allowing the graph and UI to animate perfectly offline.

9.2 Hallucination Stripper
Risk: LLM outputs ` ```json ` markdown.
Mitigation: Backend implementation of `payload = payload[payload.find('{'):payload.rfind('}')+1]` before running `json.loads()`.

================================================================================
10. IMPLEMENTATION PLAN (48-HOUR SPRINT)
================================================================================
Phase 1: Hour 0-8 (Infrastructure & Data Prep)
- Finalize the static demo PDF and clean Schematic Image.
- Spin up Neo4j Docker container.
- Initialize Next.js (Bun) and Go backend repositories.

Phase 2: Hour 8-20 (The Logic Engine)
- Write Python PDF text chunking script.
- Build Go wrappers for Groq and NVIDIA NIM APIs.
- Enforce JSON contracts and test rate-limit queuing.

Phase 3: Hour 20-32 (The Graph Construction)
- Write Go Cypher driver to inject JSON data into Neo4j.
- Validate ontology: Ensure Equipment, Rules, and Coordinates link properly.

Phase 4: Hour 32-44 (UI & Visualization)
- Integrate `react-force-graph` in Next.js.
- Build the API endpoints in Go for the frontend to query the Neo4j graph.
- Implement the bounding-box drawing logic over the schematic image.

Phase 5: Hour 44-48 (Polish & Pitch)
- Implement "Mock Mode" for offline demo safety.
- Record the pitch video focusing entirely on the "Visakhapatnam prevention" emotional hook and the Neo4j graphical traversal speed.
- Finalize GitHub Readme and Architecture diagram.