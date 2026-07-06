package graphdb

import (
	"context"
	"os"
	"testing"
	"time"

	"omnigraph/internal/models"
)

func TestToPayloadNestsSpatialUnderMatchingEntity(t *testing.T) {
	res := models.ExtractionResult{
		Entities: []models.Entity{
			{
				EquipmentTag: "V-104",
				Name:         "Gate Valve",
				System:       "Cooling Water System",
				Rules: []models.Rule{
					{Category: "Safety", Description: "Lock out before removal.", Source: "..."},
				},
			},
			{EquipmentTag: "P-201A", Name: "Centrifugal Pump"},
		},
		Spatial: []models.SpatialHit{
			{EquipmentTag: "V-104", Box: models.BoundingBox{XMin: 240, YMin: 512, XMax: 280, YMax: 540}},
		},
	}

	payload := toPayload(res)
	if len(payload) != 2 {
		t.Fatalf("len(payload) = %d, want 2", len(payload))
	}

	v104 := payload[0]
	if v104["equipment_tag"] != "V-104" {
		t.Fatalf("payload[0].equipment_tag = %v, want V-104", v104["equipment_tag"])
	}
	spatial, ok := v104["spatial"].([]map[string]any)
	if !ok || len(spatial) != 1 {
		t.Fatalf("V-104 spatial = %v, want 1 entry", v104["spatial"])
	}
	if spatial[0]["x_min"] != 240 {
		t.Errorf("x_min = %v, want 240", spatial[0]["x_min"])
	}

	rules, ok := v104["rules"].([]map[string]any)
	if !ok || len(rules) != 1 || rules[0]["category"] != "Safety" {
		t.Fatalf("V-104 rules = %v, want 1 Safety rule", v104["rules"])
	}

	pump := payload[1]
	if pumpSpatial, _ := pump["spatial"].([]map[string]any); len(pumpSpatial) != 0 {
		t.Errorf("P-201A has no spatial hit, want empty, got %v", pumpSpatial)
	}
	if pumpRules, _ := pump["rules"].([]map[string]any); len(pumpRules) != 0 {
		t.Errorf("P-201A rules = %v, want empty", pumpRules)
	}
}

// TestLiveNeo4jIngestAndCount exercises the real driver against a running
// Neo4j instance (e.g. `docker-compose up -d neo4j` or the TRD's `docker run
// neo4j:latest -e NEO4J_AUTH=none`). It skips instead of failing when no
// instance is reachable, so `go test ./...` stays green without Docker.
func TestLiveNeo4jIngestAndCount(t *testing.T) {
	uri := os.Getenv("NEO4J_URI")
	if uri == "" {
		uri = "bolt://localhost:7687"
	}

	client, err := New(uri, os.Getenv("NEO4J_USER"), os.Getenv("NEO4J_PASSWORD"))
	if err != nil {
		t.Skipf("neo4j not reachable at %s, skipping live integration test: %v", uri, err)
	}
	defer client.Close(context.Background())

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := client.EnsureConstraints(ctx); err != nil {
		t.Fatalf("EnsureConstraints: %v", err)
	}

	before, err := client.CountNodes(ctx)
	if err != nil {
		t.Fatalf("CountNodes (before): %v", err)
	}

	res := models.ExtractionResult{
		Entities: []models.Entity{{
			EquipmentTag: "TEST-V-104",
			Name:         "Test Gate Valve",
			System:       "Test System",
			Rules: []models.Rule{
				{Category: "Safety", Description: "go-test lockout rule.", Source: "unit test"},
			},
		}},
		Spatial: []models.SpatialHit{
			{EquipmentTag: "TEST-V-104", Box: models.BoundingBox{XMin: 1, YMin: 2, XMax: 3, YMax: 4}},
		},
	}
	if err := client.Ingest(ctx, res); err != nil {
		t.Fatalf("Ingest: %v", err)
	}

	after, err := client.CountNodes(ctx)
	if err != nil {
		t.Fatalf("CountNodes (after): %v", err)
	}
	// Equipment + Rule + Coordinate = 3 new nodes on first run; MERGE makes
	// reruns idempotent so we only assert it grew, not by exactly how much.
	if after <= before {
		t.Errorf("node count did not grow: before=%d after=%d", before, after)
	}
}
