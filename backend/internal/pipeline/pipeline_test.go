package pipeline

import (
	"testing"

	"omnigraph/internal/models"
	"omnigraph/internal/store"
)

func TestMergeEntities(t *testing.T) {
	in := []models.Entity{
		{EquipmentTag: "V-104", Name: "Valve", Rules: []models.Rule{{Description: "a"}}},
		{EquipmentTag: "V-104", System: "Cooling", Rules: []models.Rule{{Description: "b"}}},
		{EquipmentTag: "", Rules: []models.Rule{{Description: "orphan"}}}, // dropped
		{EquipmentTag: "P-201A", Name: "Pump"},
	}
	out := mergeEntities(in)
	if len(out) != 2 {
		t.Fatalf("merged len = %d, want 2", len(out))
	}
	if out[0].EquipmentTag != "V-104" {
		t.Errorf("order not preserved: %s", out[0].EquipmentTag)
	}
	if out[0].Name != "Valve" || out[0].System != "Cooling" {
		t.Errorf("fields not unioned: %+v", out[0])
	}
	if len(out[0].Rules) != 2 {
		t.Errorf("rules not merged: %d", len(out[0].Rules))
	}
}

func TestRunMock(t *testing.T) {
	st := store.New()
	p := &Pipeline{Store: st, MockDir: "../../mock_data", HasKeys: false}

	var logs []string
	res, err := p.Run(nil, "", nil, "", true, func(tag, msg string) {
		logs = append(logs, tag+": "+msg)
	})
	if err != nil {
		t.Fatalf("mock run: %v", err)
	}
	if len(res.Entities) != 2 {
		t.Errorf("entities = %d, want 2 (V-104, P-201A)", len(res.Entities))
	}
	if len(res.Spatial) != 2 {
		t.Errorf("spatial = %d, want 2", len(res.Spatial))
	}
	nodes, _ := st.Counts()
	if nodes == 0 {
		t.Error("store not populated after mock run")
	}
	if len(logs) == 0 {
		t.Error("no logs emitted")
	}
}
