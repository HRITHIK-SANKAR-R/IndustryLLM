================================================================================
UI/UX DESIGN SPECIFICATION DOCUMENT
PROJECT: OMNI-GRAPH (AI Industrial Knowledge Intelligence Brain)
TARGET: ET AI Hackathon 2026 - Problem Statement 8
VERSION: 1.0.0
FORMAT: Plain Text / Markdown (Suitable for .txt export)
ESTIMATED LENGTH: ~8 Pages of Detailed Specifications
================================================================================

TABLE OF CONTENTS
[PAGE 1] Design System, Visual Identity & Accessibility
[PAGE 2] User Personas & Core User Journeys
[PAGE 3] Global Layout & Application Shell
[PAGE 4] Screen Interface 1: The Command Center (Ingestion)
[PAGE 5] Screen Interface 2: The Spatial Blueprint Viewer (2D Canvas)
[PAGE 6] Screen Interface 3: The Omni-Graph Engine (3D WebGL)
[PAGE 7] Screen Interface 4: The Contextual Intelligence Drawer
[PAGE 8] Micro-Interactions, State Management & Fallbacks

================================================================================
[PAGE 1] DESIGN SYSTEM, VISUAL IDENTITY & ACCESSIBILITY
================================================================================
1.1 Aesthetic Philosophy
The UI must scream "Enterprise-Grade Industrial Software." It should not look like a consumer social app or a generic SaaS dashboard. It must look like a high-end command center used by engineers to monitor critical infrastructure.

1.2 Color Palette (Dark Mode Default)
- Background Base: #0B0F19 (Deep Slate Navy) - Reduces eye strain in dark control rooms.
- Background Surface (Panels): #111827 (Dark Gray)
- Surface Borders: #1F2937 (Subtle Gray for separation)
- Primary Accent: #3B82F6 (Electric Blue) - Used for primary actions and active states.
- Success/Safety: #10B981 (Emerald Green) - Used for compliant rules and healthy equipment nodes.
- Warning/Alert: #F59E0B (Amber) - Used for required maintenance.
- Critical/Danger: #EF4444 (Crimson) - Used for regulatory violations or critical node selections.

1.3 Typography
- Primary Font (UI & Labels): 'Inter' or 'Roboto' (Clean, highly legible sans-serif).
- Monospace Font (Terminal/Code/Tags): 'Fira Code' or 'JetBrains Mono' (Used for Equipment IDs like "V-104", logs, and JSON previews).
- Hierarchy:
  - H1 (Dashboard Titles): 24px, Semi-Bold, Tracking -0.02em.
  - H2 (Panel Headers): 16px, Medium, All-Caps, Tracking 0.05em.
  - Body (Paragraphs/Rules): 14px, Regular, Line-height 1.5.
  - Caption (Tags/Metadata): 12px, Medium, Monospace.

1.4 Graph Node Color Mapping (Neo4j Schema Sync)
- :Equipment Nodes -> Electric Blue (#3B82F6)
- :Rule / :Regulation Nodes -> Amber (#F59E0B)
- :Procedure Nodes -> Emerald Green (#10B981)
- :Coordinate (Spatial) Nodes -> Hidden from UI (interpreted as bounding boxes on the 2D canvas).

1.5 Accessibility (a11y)
- Contrast Ratio: All text must meet WCAG AA standards (4.5:1) against the dark background.
- Focus States: Keyboard navigation must highlight active panels with a 2px Electric Blue ring.

================================================================================
[PAGE 2] USER PERSONAS & CORE USER JOURNEYS
================================================================================
2.1 Persona A: The Plant Engineer (The "Uploader")
- Goal: Digitize legacy manuals and blueprints into the system.
- Frustration: Uploading files to standard tools results in unsearchable, disconnected PDFs.
- Hackathon Demo Hook: Engineer uploads a PDF and a CAD drawing. Within seconds, they see the system autonomously draw spatial boundaries and build a relational database.

2.2 Persona B: The Field Technician (The "Consumer")
- Goal: Quickly find the exact torque specification for a specific valve shown on a blueprint.
- Frustration: Wasting 45 minutes searching through 500-page physical manuals.
- Hackathon Demo Hook: Technician clicks a valve on the blueprint. The UI instantly traverses the 3D graph and displays the exact paragraph containing the torque spec.

2.3 The "Golden Walkthrough" Journey (For the 3-Minute Demo Video)
1. START: Clean, empty dashboard.
2. ACTION: Drag-and-drop ingestion of `Pump_Manual.pdf` and `Schematic.png`.
3. FEEDBACK: Terminal UI streams logs showing Groq and NVIDIA API interactions.
4. WOW MOMENT: 3D graph explodes into view, mapping text to components.
5. VALIDATION: User clicks a visual component on the blueprint; the corresponding paragraph in the text manual highlights, proving deterministic AI mapping.

================================================================================
[PAGE 3] GLOBAL LAYOUT & APPLICATION SHELL
================================================================================
3.1 Grid Architecture (Next.js & Tailwind CSS)
The layout uses a CSS Grid structure to maximize screen real estate, avoiding annoying scrollbars. The app occupies 100vw and 100vh.

3.2 Layout Zones
- Top Navbar (Height: 64px, Width: 100%): 
  - Left: "OMNI-GRAPH" Logo and System Status Indicator (Green dot: "System Online").
  - Center: Global Search Bar (Search by Equipment Tag, e.g., "Search 'V-104'").
  - Right: Mock Mode Toggle (For demo safety) and User Avatar.

- Left Sidebar (Width: 320px, Height: calc(100vh - 64px)):
  - Contains the Ingestion Hub and real-time processing terminal.

- Main Content Area (Width: calc(100vw - 320px), Height: calc(100vh - 64px)):
  - Split horizontally into two equal panes (50vh each):
    - Top Pane: Spatial Blueprint Viewer (2D).
    - Bottom Pane: Omni-Graph Engine (3D).

3.3 Responsive Design
- For the hackathon demo, the UI is optimized for a 1920x1080 desktop display to look incredible during the presentation. Mobile responsiveness is a secondary concern for this specific B2B infrastructure demo.

================================================================================
[PAGE 4] SCREEN INTERFACE 1: THE COMMAND CENTER (INGESTION)
================================================================================
4.1 Location: Left Sidebar
4.2 Purpose: Handle file uploads and provide transparent AI processing feedback.

4.3 Component: Multi-Modal Dropzone
- Visuals: A dashed 2px border box with a subtle blue gradient background.
- Text: "Drag & Drop Engineering Documents (PDF, PNG, CAD)"
- Interaction: On hover, the border turns solid Electric Blue.
- Validation: Shows two slots—one for "Text Manual" and one for "Spatial Schematic."

4.4 Component: AI Processing Terminal (The "Hacker" View)
- Visuals: A dark, monospace terminal window embedded below the dropzone.
- Why it matters: Hackathon judges want to know your AI is actually doing work, not just faking it.
- Log Output Sequence (Animated typing effect):
  > [SYS] Initializing Ingestion Pipeline...
  > [GROQ] Chunking PDF... Sending Payload...
  > [GROQ] Received JSON. Extracted 42 Entities.
  > [NVIDIA] Processing Schematic Vision...
  > [NVIDIA] Bounding Boxes mapped.
  > [NEO4J] Injecting 156 nodes and 312 edges...
  > [SYS] Graph Generation Complete in 1.24s.

4.5 Component: System Metrics
- Small badges at the bottom showing:
  - "Nodes: 156"
  - "Edges: 312"
  - "Latency: 240ms"

================================================================================
[PAGE 5] SCREEN INTERFACE 2: THE SPATIAL BLUEPRINT VIEWER (2D CANVAS)
================================================================================
5.1 Location: Main Content Area (Top Half)
5.2 Purpose: View the uploaded P&ID (Piping and Instrumentation Diagram) and interact with spatially mapped elements.

5.3 The Canvas Container
- Uses HTML5 `<canvas>` wrapped in a pan/zoom component (e.g., `react-quick-pinch-zoom`).
- The uploaded schematic image is rendered in the center.

5.4 The Bounding Box Overlay Layer (SVG)
- The UI fetches the `x_min`, `y_min`, `x_max`, `y_max` coordinates mapped by NVIDIA NIM.
- Renders SVG rectangles over the equipment tags.
- Default State: Transparent box with a dashed, low-opacity white border.
- Hover State: Border turns solid Electric Blue (#3B82F6), cursor changes to pointer.
- Active/Clicked State: Box fills with a translucent Electric Blue (rgba(59, 130, 246, 0.3)), triggering an event that updates the global Zustand state with the selected `tag_id`.

5.5 Canvas Controls
- Floating action buttons in the bottom right corner of this pane:
  - Zoom In (+)
  - Zoom Out (-)
  - Reset View (Centers image)
  - Toggle Overlays (Hides/Shows the AI bounding boxes).

================================================================================
[PAGE 6] SCREEN INTERFACE 3: THE OMNI-GRAPH ENGINE (3D WEBGL)
================================================================================
6.1 Location: Main Content Area (Bottom Half)
6.2 Purpose: Visualize the relational database built by Neo4j, showing how manuals, rules, and equipment intersect.

6.3 WebGL Engine (`react-force-graph-3d`)
- Background: #0B0F19 (Matches app background to blend seamlessly).
- Camera: Orbit controls enabled (User can drag to rotate the 3D cluster, scroll to zoom).
- Physics: Spring-based force layout. Cooldown is set to 0 initially to prevent the graph from looking like it's "exploding" on load.

6.4 Node Rendering
- Size: Scaled based on degree centrality (nodes with more connections are larger).
- Text Labels: Equipment tags (e.g., "V-104") hover above the 3D spheres.
- Colors: (Mapped from 1.4).

6.5 Edge (Link) Rendering
- Links are rendered as thin, semi-transparent white lines.
- Directional arrows are animated. Tiny glowing particles (using `linkDirectionalParticles`) travel along the edges to visualize data relationships (e.g., from Equipment -> Rule), giving the UI a "living brain" aesthetic.

6.6 Node Interactions
- Hover: Pauses the orbit camera. The hovered node and its immediate neighbors remain fully opaque; all other nodes in the background fade to 20% opacity.
- Click: Centers the camera on the clicked node. Updates the global Zustand state with the selected `tag_id`, simultaneously triggering the 2D Canvas (Pane 2) to highlight the bounding box.

================================================================================
[PAGE 7] SCREEN INTERFACE 4: THE CONTEXTUAL INTELLIGENCE DRAWER
================================================================================
7.1 Location: Slide-out drawer from the Right edge (Width: 400px).
7.2 Purpose: Display the exact text, rules, and manuals when an asset is clicked.

7.3 Trigger Mechanism
- When a user clicks a bounding box in the 2D Viewer OR a node in the 3D Graph, this drawer slides open (ease-in-out transition).

7.4 Drawer Header
- Title: Equipment Tag (e.g., "CENTRIFUGAL PUMP - P-201A")
- Status Badge: "Online" / "Compliance Verified"
- Action Button: "Close (X)"

7.5 Drawer Body (The Knowledge Output)
- Section 1: Associated Regulatory Rules
  - Visual: An Amber warning box.
  - Content: Fetched from Neo4j. Example: "OSHA Standard 1910.119 - Mechanical Integrity."

- Section 2: Maintenance Procedure (The Groq Extraction)
  - Visual: A dark gray card with Monospace text formatting.
  - Content: The exact paragraph extracted from the 500-page PDF. 
  - Highlight feature: The exact sentence detailing a torque spec or safety protocol is highlighted in Electric Blue.

- Section 3: Linked Assets
  - Visual: A horizontal scrolling row of mini-tags showing upstream and downstream equipment connected in the graph (e.g., "Valve V-10", "Chiller C-1"). Clicking these changes the drawer context.

================================================================================
[PAGE 8] MICRO-INTERACTIONS, STATE MANAGEMENT & FALLBACKS
================================================================================
8.1 State Management (Zustand)
- A single global store holds `activeNodeId`.
- The 2D Canvas, 3D Graph, and Intelligence Drawer all subscribe to `activeNodeId`. 
- This guarantees that clicking ANY pane updates ALL panes simultaneously, providing a deeply cohesive user experience.

8.2 Loading States & Skeletons
- Standard spinners are boring. Instead, while Groq and NVIDIA are processing, the 3D graph area shows a wireframe "scanning" animation.
- The Right Drawer uses "Skeleton Loaders" (pulsing gray blocks) while fetching text from Neo4j.

8.3 The "Mock Mode" Fallback UI (Crucial for Demo Day)
- To prevent a live demo crash due to venue Wi-Fi drops, a hidden toggle exists in the Navbar.
- When Mock Mode is active, a subtle, highly professional banner appears at the top:
  `[!] Edge-Compute Mode Active. External APIs decoupled. Operating on local cache.`
- This turns a Wi-Fi failure from an embarrassing crash into a feature demonstrating "Air-Gapped Local Network Capability."

8.4 Success/Error Toasts
- Position: Bottom Center.
- Success: "Ontology Successfully Generated in 1.4s" (Green border).
- Error: "Failed to parse coordinate space. Retrying..." (Red border).

================================================================================
END OF UI/UX DESIGN SPECIFICATION DOCUMENT
================================================================================