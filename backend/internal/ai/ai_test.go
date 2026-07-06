package ai

import (
	"testing"

	"omnigraph/internal/models"
)

func TestSanitizeLLMJSON(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"plain", `{"a":1}`, `{"a":1}`},
		{"fenced", "```json\n{\"a\":1}\n```", `{"a":1}`},
		{"prose_wrapped", `Sure! Here is the JSON: {"a":1} Hope that helps.`, `{"a":1}`},
		{"nested", `prefix {"a":{"b":2}} suffix`, `{"a":{"b":2}}`},
		{"none", `no json here`, `{}`},
		{"only_open", `{ oops`, `{}`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := sanitizeLLMJSON(c.in); got != c.want {
				t.Errorf("sanitizeLLMJSON(%q) = %q, want %q", c.in, got, c.want)
			}
		})
	}
}

func TestDenormalizeSpatial(t *testing.T) {
	box := func(x1, y1, x2, y2 float64) rawSpatialHit {
		var r rawSpatialHit
		r.EquipmentTag = "V-104"
		r.Box.XMin, r.Box.YMin, r.Box.XMax, r.Box.YMax = x1, y1, x2, y2
		return r
	}

	t.Run("normalized_scaled_to_pixels", func(t *testing.T) {
		hits := denormalizeSpatial([]rawSpatialHit{box(0.1, 0.2, 0.5, 0.75)}, 900, 700)
		b := hits[0].Box
		if b.XMin != 90 || b.YMin != 140 || b.XMax != 450 || b.YMax != 525 {
			t.Errorf("got %+v, want {90 140 450 525}", b)
		}
	})

	t.Run("pixel_coords_passthrough", func(t *testing.T) {
		hits := denormalizeSpatial([]rawSpatialHit{box(345, 120, 400, 180)}, 900, 700)
		b := hits[0].Box
		if b.XMin != 345 || b.YMin != 120 || b.XMax != 400 || b.YMax != 180 {
			t.Errorf("got %+v, want {345 120 400 180}", b)
		}
	})

	t.Run("mixed_batch_treated_as_pixels", func(t *testing.T) {
		hits := denormalizeSpatial([]rawSpatialHit{box(0.5, 0.5, 0.9, 0.9), box(345, 120, 400, 180)}, 900, 700)
		if hits[0].Box.XMax != 1 { // 0.9 rounds to 1, not scaled
			t.Errorf("mixed batch must not scale: got %+v", hits[0].Box)
		}
	})

	t.Run("zero_dims_no_scaling", func(t *testing.T) {
		hits := denormalizeSpatial([]rawSpatialHit{box(0.1, 0.2, 0.5, 0.75)}, 0, 0)
		if hits[0].Box.XMax != 1 {
			t.Errorf("zero dims must not scale: got %+v", hits[0].Box)
		}
	})

	t.Run("empty", func(t *testing.T) {
		if got := denormalizeSpatial(nil, 900, 700); len(got) != 0 {
			t.Errorf("want empty, got %v", got)
		}
	})
}

func TestRegionBox(t *testing.T) {
	cases := []struct {
		region string
		want   models.BoundingBox
		ok     bool
	}{
		{"bottom-left", models.BoundingBox{XMin: 75, YMin: 525, XMax: 225, YMax: 641}, true},
		{"center", models.BoundingBox{XMin: 375, YMin: 291, XMax: 525, YMax: 408}, true},
		{"top-right", models.BoundingBox{XMin: 675, YMin: 58, XMax: 825, YMax: 175}, true},
		{"nonsense", models.BoundingBox{}, false},
	}
	for _, c := range cases {
		got, ok := regionBox(c.region, 900, 700)
		if ok != c.ok || got != c.want {
			t.Errorf("regionBox(%q) = %+v,%v want %+v,%v", c.region, got, ok, c.want, c.ok)
		}
	}
}

func TestDegenerateSpatial(t *testing.T) {
	zero := models.SpatialHit{EquipmentTag: "V-104"}
	real := models.SpatialHit{EquipmentTag: "V-104", Box: models.BoundingBox{XMin: 1, YMin: 1, XMax: 5, YMax: 5}}
	if !degenerateSpatial([]models.SpatialHit{zero, zero}) {
		t.Error("all-zero boxes must be degenerate")
	}
	if degenerateSpatial([]models.SpatialHit{zero, real}) {
		t.Error("one real box means not degenerate")
	}
	if !degenerateSpatial(nil) {
		t.Error("empty is degenerate")
	}
}

func TestUnmarshalLLMJSON(t *testing.T) {
	type resp struct {
		Labels []struct {
			Tag string `json:"tag"`
		} `json:"labels"`
	}
	t.Run("clean", func(t *testing.T) {
		var v resp
		if err := unmarshalLLMJSON(`{"labels":[{"tag":"V-104"}]}`, &v); err != nil || v.Labels[0].Tag != "V-104" {
			t.Errorf("err=%v v=%+v", err, v)
		}
	})
	t.Run("prose_with_multiple_fragments", func(t *testing.T) {
		content := `The grid {A1} has labels. * bullet ** Answer: {"labels":[{"tag":"V-104"}]}`
		var v resp
		if err := unmarshalLLMJSON(content, &v); err != nil || len(v.Labels) != 1 || v.Labels[0].Tag != "V-104" {
			t.Errorf("err=%v v=%+v", err, v)
		}
	})
	t.Run("no_json_yields_empty", func(t *testing.T) {
		// sanitizeLLMJSON degrades to "{}" so this parses as an empty result.
		var v resp
		if err := unmarshalLLMJSON(`nothing here`, &v); err != nil || len(v.Labels) != 0 {
			t.Errorf("err=%v v=%+v", err, v)
		}
	})
}
