================================================================================
BACKEND SCHEMA & DATA MODEL SPECIFICATION
PROJECT: OMNI-GRAPH (AI Industrial Knowledge Intelligence Brain)
TARGET: ET AI Hackathon 2026 - Problem Statement 8
VERSION: 1.0.0
FORMAT: Plain Text / Markdown (Suitable for .txt export)
ESTIMATED LENGTH: ~8 Pages of Detailed Specifications
================================================================================

TABLE OF CONTENTS
[PAGE 1] Database Philosophy & Technology Choice
[PAGE 2] Core Graph Ontology (Nodes)
[PAGE 3] Core Graph Ontology (Relationships/Edges)
[PAGE 4] Go Backend Data Structures (Structs)
[PAGE 5] JSON Payload Schemas (External AI APIs)
[PAGE 6] Next.js API Response Schemas
[PAGE 7] Indexing, Constraints & Performance Optimization
[PAGE 8] Cypher Transaction Examples

================================================================================
[PAGE 1] DATABASE PHILOSOPHY & TECHNOLOGY CHOICE
================================================================================
1.1 Why Graph (Neo4j) Over Relational (SQL) or Document (NoSQL)
Industrial knowledge is inherently relational. A single pump (V-104) connects to a specific paragraph in a PDF manual, a specific spatial coordinate on a CAD drawing, and a specific regulatory compliance code.
- Relational SQL would require massive, slow, multi-way JOIN tables.
- NoSQL (MongoDB) would require deeply nested documents, making bidirectional traversal impossible.
- Neo4j (Cypher) allows us to traverse `(Equipment)-[:GOVERNED_BY]->(Rule)` in milliseconds, providing the exact Sub-Graph needed for the frontend visualization without returning the entire database.

1.2 Deployment Environment
- Target: Local Docker container for Hackathon.
- Image: `neo4j:latest` (Community Edition).
- Ports: `7474` (HTTP Browser), `7687` (Bolt Protocol for Go Driver).
- Authentication: Disabled for local sprint speed (`NEO4J_AUTH=none`).

================================================================================
[PAGE 2] CORE GRAPH ONTOLOGY (NODES)
================================================================================
Every entity extracted by Groq or NVIDIA NIM becomes a Node.

2.1 Node Label: `Equipment`
Represents physical assets found in the text or drawing.
- `tag_id` (String, UNIQUE): The core identifier (e.g., "P-201A").
- `name` (String): Human-readable name (e.g., "Centrifugal Pump").
- `system` (String): The sub-system it belongs to (e.g., "Cooling Water System").

2.2 Node Label: `Manual`
Represents the source document.
- `doc_id` (String, UNIQUE): e.g., "DOC-PUMP-001".
- `title` (String): Document title.
- `upload_date` (Timestamp).

2.3 Node Label: `DocumentSection`
Represents a specific chunk of text extracted from a manual.
- `chunk_id` (String, UNIQUE): UUID.
- `page_num` (Integer).
- `raw_text` (String): The actual paragraph text.

2.4 Node Label: `Rule`
Represents a specific extracted protocol or compliance rule.
- `rule_id` (String, UNIQUE): UUID.
- `category` (String): e.g., "Maintenance", "Safety", "Compliance".
- `description` (String): The extracted rule (e.g., "Torque to 45Nm").

2.5 Node Label: `Coordinate`
Represents the spatial bounding box on a P&ID schematic.
- `coord_id` (String, UNIQUE): UUID.
- `x_min` (Integer), `y_min` (Integer), `x_max` (Integer), `y_max` (Integer).
- `source_image` (String): e.g., "schematic_v2.png".

================================================================================
[PAGE 3] CORE GRAPH ONTOLOGY (RELATIONSHIPS/EDGES)
================================================================================
Relationships define how nodes interact and are the backbone of the UI visualization.

3.1 Text Logic Relationships (Generated via Groq)
- `(Equipment)-[:HAS_RULE]->(Rule)`
  * Describes that a piece of equipment must follow a specific rule.
- `(Rule)-[:SOURCED_FROM]->(DocumentSection)`
  * Provides the audit trail. When a user clicks a rule, we can show them the exact paragraph it came from.
- `(DocumentSection)-[:BELONGS_TO]->(Manual)`
  * Links the chunk back to the parent file.

3.2 Spatial Logic Relationships (Generated via NVIDIA NIM)
- `(Equipment)-[:LOCATED_AT]->(Coordinate)`
  * Links the logical equipment node to its spatial representation on the canvas.

3.3 System Topology Relationships (Optional/Advanced)
- `(Equipment)-[:FEEDS_INTO]->(Equipment)`
  * Maps physical upstream/downstream flow (e.g., a pump feeds into a heat exchanger).

================================================================================
[PAGE 4] GO BACKEND DATA STRUCTURES (STRUCTS)
================================================================================
These structs govern how data is held in Go before being pushed to Neo4j.

```go
package models

// 4.1 Internal Representation
type Equipment struct {
    TagID  string `json:"tag_id"`
    Name   string `json:"name"`
    System string `json:"system"`
}

type ExtractedRule struct {
    RuleID      string `json:"rule_id"`
    EquipmentID string `json:"equipment_tag"`
    Category    string `json:"category"`
    Description string `json:"description"`
    SourceText  string `json:"source_text"`
}

type SpatialCoordinate struct {
    EquipmentID string `json:"equipment_tag"`
    XMin        int    `json:"x_min"`
    YMin        int    `json:"y_min"`
    XMax        int    `json:"x_max"`
    YMax        int    `json:"y_max"`
}
================================================================================
[PAGE 5] JSON PAYLOAD SCHEMAS (EXTERNAL AI APIS)
These are the strict structures the Go backend expects back from Groq and NVIDIA.

5.1 Groq Output Schema (Text Logic)

JSON
{
  "document_type": "Maintenance Manual",
  "entities": [
    {
      "equipment_tag": "V-104",
      "name": "Gate Valve",
      "rules": [
        {
          "category": "Safety",
          "description": "Must be locked out before downstream pipe removal.",
          "source_paragraph": "Prior to any pipe maintenance..."
        }
      ]
    }
  ]
}
5.2 NVIDIA NIM Output Schema (Vision Spatial Logic)

JSON
{
  "detected_equipment": [
    {
      "tag_id": "V-104",
      "confidence": 0.94,
      "bounding_box": {
        "x_min": 240,
        "y_min": 512,
        "x_max": 280,
        "y_max": 540
      }
    }
  ]
}
================================================================================
[PAGE 6] NEXT.JS API RESPONSE SCHEMAS (FRONTEND CONSUMPTION)
When the Next.js UI queries the Go backend, the graph data must be flattened into a format that react-force-graph understands (nodes array and links array).

6.1 Full Graph Topology Payload (GET /api/v1/graph)

JSON
{
  "nodes": [
    { "id": "V-104", "group": "Equipment", "label": "Gate Valve" },
    { "id": "R-992", "group": "Rule", "label": "Lockout Procedure" },
    { "id": "C-110", "group": "Coordinate", "label": "240,512" }
  ],
  "links": [
    { "source": "V-104", "target": "R-992", "label": "HAS_RULE" },
    { "source": "V-104", "target": "C-110", "label": "LOCATED_AT" }
  ]
}
6.2 Context Drawer Payload (GET /api/v1/node/{tag_id}/context)

JSON
{
  "equipment_tag": "V-104",
  "name": "Gate Valve",
  "spatial_coordinates": [240, 512, 280, 540],
  "associated_rules": [
    {
      "category": "Safety",
      "description": "Must be locked out before downstream pipe removal.",
      "audit_trail": "Prior to any pipe maintenance..."
    }
  ]
}
================================================================================
[PAGE 7] INDEXING, CONSTRAINTS & PERFORMANCE OPTIMIZATION
To guarantee sub-50ms query times during the live hackathon demo, Neo4j must be properly indexed upon database initialization.

7.1 Unique Constraints
Prevents duplicate nodes if the ingestion pipeline is run multiple times.

Cypher
CREATE CONSTRAINT unique_equipment IF NOT EXISTS FOR (e:Equipment) REQUIRE e.tag_id IS UNIQUE;
CREATE CONSTRAINT unique_rule IF NOT EXISTS FOR (r:Rule) REQUIRE r.rule_id IS UNIQUE;
CREATE CONSTRAINT unique_coord IF NOT EXISTS FOR (c:Coordinate) REQUIRE c.coord_id IS UNIQUE;
7.2 Performance Indices
Speeds up text searching and category filtering.

Cypher
CREATE INDEX rule_category_idx IF NOT EXISTS FOR (r:Rule) ON (r.category);
7.3 Go Backend Write Batching

Do NOT execute a Cypher query for every single node.

Use UNWIND in Cypher to pass a large JSON array of objects from Go and process them in a single database transaction.

================================================================================
[PAGE 8] CYPHER TRANSACTION EXAMPLES
8.1 Bulk Insertion Query (Used by Go Router after AI API responses)
This query accepts a JSON parameter $payload from the Go driver and builds the graph safely using MERGE (which creates nodes only if they don't exist).

Cypher
UNWIND $payload.entities AS entity
MERGE (e:Equipment {tag_id: entity.equipment_tag})
ON CREATE SET e.name = entity.name

WITH e, entity
UNWIND entity.rules AS rule
MERGE (r:Rule {description: rule.description})
ON CREATE SET r.category = rule.category, r.rule_id = randomUUID()
MERGE (e)-[:HAS_RULE]->(r)

WITH e, entity
UNWIND entity.spatial AS space
MERGE (c:Coordinate {x_min: space.x_min, y_min: space.y_min, x_max: space.x_max, y_max: space.y_max})
ON CREATE SET c.coord_id = randomUUID()
MERGE (e)-[:LOCATED_AT]->(c)
8.2 Frontend Traversal Query (Used to populate Context Drawer)
When a user clicks "V-104", this query fetches exactly what is needed for the right-hand UI drawer.

Cypher
MATCH (e:Equipment {tag_id: $tag_id})
OPTIONAL MATCH (e)-[:HAS_RULE]->(r:Rule)
OPTIONAL MATCH (e)-[:LOCATED_AT]->(c:Coordinate)
RETURN e.tag_id AS Tag, e.name AS Name, 
       collect(DISTINCT r) AS Rules, 
       collect(DISTINCT c) AS Coordinates
================================================================================
END OF BACKEND SCHEMA & DATA MODEL SPECIFICATION
