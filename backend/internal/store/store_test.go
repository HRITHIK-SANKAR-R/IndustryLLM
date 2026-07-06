package store

import (
	"testing"

	"omnigraph/internal/models"
)

func sample() models.ExtractionResult {
	return models.ExtractionResult{
		Entities: []models.Entity{
			{
				EquipmentTag: "V-104", Name: "Gate Valve", System: "Cooling",
				Rules: []models.Rule{
					{Category: "Safety", Description: "Lock out", Source: "para a"},
					{Category: "Maint", Description: "Torque 45Nm", Source: "para b"},
				},
			},
			{EquipmentTag: "P-201A", Name: "Pump", Rules: []models.Rule{
				{Category: "Maint", Description: "Lube 400h", Source: "para c"},
			}},
		},
		Spatial: []models.SpatialHit{
			{EquipmentTag: "V-104", Box: models.BoundingBox{XMin: 1, YMin: 2, XMax: 3, YMax: 4}},
		},
	}
}

func TestIngestCounts(t *testing.T) {
	s := New()
	s.Ingest(sample())
	nodes, edges := s.Counts()
	// 2 equipment + 3 rules + 1 coord = 6 nodes; 3 HAS_RULE + 1 LOCATED_AT = 4 edges
	if nodes != 6 {
		t.Errorf("nodes = %d, want 6", nodes)
	}
	if edges != 4 {
		t.Errorf("edges = %d, want 4", edges)
	}
}

func TestIngestIdempotent(t *testing.T) {
	s := New()
	s.Ingest(sample())
	s.Ingest(sample()) // re-ingest must not duplicate
	nodes, edges := s.Counts()
	if nodes != 6 || edges != 4 {
		t.Errorf("after double ingest nodes=%d edges=%d, want 6/4", nodes, edges)
	}
}

func TestReset(t *testing.T) {
	s := New()
	s.Ingest(sample())
	s.Reset()
	nodes, edges := s.Counts()
	if nodes != 0 || edges != 0 {
		t.Errorf("after reset nodes=%d edges=%d, want 0/0", nodes, edges)
	}
}

func TestGraphShape(t *testing.T) {
	s := New()
	s.Ingest(sample())
	g := s.Graph()
	if len(g.Nodes) != 6 {
		t.Fatalf("graph nodes = %d, want 6", len(g.Nodes))
	}
	groups := map[string]int{}
	for _, n := range g.Nodes {
		groups[n.Group]++
	}
	if groups["Equipment"] != 2 || groups["Rule"] != 3 || groups["Coordinate"] != 1 {
		t.Errorf("group counts = %v", groups)
	}
	// every link endpoint must reference an existing node id
	ids := map[string]bool{}
	for _, n := range g.Nodes {
		ids[n.ID] = true
	}
	for _, l := range g.Links {
		if !ids[l.Source] || !ids[l.Target] {
			t.Errorf("dangling link %s->%s", l.Source, l.Target)
		}
	}
}

func TestContext(t *testing.T) {
	s := New()
	s.Ingest(sample())
	ctx, ok := s.Context("V-104")
	if !ok {
		t.Fatal("V-104 not found")
	}
	if ctx.Name != "Gate Valve" {
		t.Errorf("name = %q", ctx.Name)
	}
	if len(ctx.Rules) != 2 {
		t.Errorf("rules = %d, want 2", len(ctx.Rules))
	}
	if ctx.Spatial == nil || ctx.Spatial.XMin != 1 {
		t.Errorf("spatial = %+v", ctx.Spatial)
	}
	if len(ctx.Linked) != 1 || ctx.Linked[0] != "P-201A" {
		t.Errorf("linked = %v", ctx.Linked)
	}
	if _, ok := s.Context("NOPE"); ok {
		t.Error("unknown tag should return ok=false")
	}
}
