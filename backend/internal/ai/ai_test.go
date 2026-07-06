package ai

import "testing"

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
