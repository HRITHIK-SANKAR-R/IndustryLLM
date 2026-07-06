package models

// ---- AI extraction payloads (what Groq/NVIDIA return, normalized) ----

// Rule is a single extracted protocol/compliance/maintenance rule.
type Rule struct {
	Category    string `json:"category"`
	Description string `json:"description"`
	Source      string `json:"source_paragraph"`
}

// Entity is one equipment tag plus its rules (Groq semantic output).
type Entity struct {
	EquipmentTag string `json:"equipment_tag"`
	Name         string `json:"name"`
	System       string `json:"system"`
	Rules        []Rule `json:"rules"`
}

// BoundingBox is the pixel-space location of a tag on the schematic.
type BoundingBox struct {
	XMin int `json:"x_min"`
	YMin int `json:"y_min"`
	XMax int `json:"x_max"`
	YMax int `json:"y_max"`
}

// SpatialHit is one tag located on the P&ID by NVIDIA NIM.
type SpatialHit struct {
	EquipmentTag string      `json:"equipment_tag"`
	Confidence   float64     `json:"confidence"`
	Box          BoundingBox `json:"bounding_box"`
}

// ExtractionResult aggregates both AI branches for a single ingest job.
type ExtractionResult struct {
	DocumentType string       `json:"document_type"`
	SourceImage  string       `json:"source_image"`
	Entities     []Entity     `json:"entities"`
	Spatial      []SpatialHit `json:"spatial"`
}

// ---- Frontend graph payloads (react-force-graph shape) ----

// GraphNode is one vertex for the 3D visualizer.
type GraphNode struct {
	ID    string `json:"id"`
	Group string `json:"group"` // Equipment | Rule | Coordinate
	Label string `json:"label"`
	Val   int    `json:"val"` // degree centrality → node size
}

// GraphLink is one edge for the 3D visualizer.
type GraphLink struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Label  string `json:"label"`
}

// Graph is the full topology returned by GET /api/v1/graph.
type Graph struct {
	Nodes []GraphNode `json:"nodes"`
	Links []GraphLink `json:"links"`
}

// ---- Context drawer payload (GET /api/v1/node/{tag}/context) ----

type DrawerRule struct {
	Category    string `json:"category"`
	Description string `json:"description"`
	AuditTrail  string `json:"audit_trail"`
}

type NodeContext struct {
	EquipmentTag string       `json:"equipment_tag"`
	Name         string       `json:"name"`
	System       string       `json:"system"`
	Spatial      *BoundingBox `json:"spatial_coordinates"`
	Rules        []DrawerRule `json:"associated_rules"`
	Linked       []string     `json:"linked_assets"`
}

// ---- Ingest API ----

type IngestResponse struct {
	JobID  string `json:"job_id"`
	Status string `json:"status"`
}
