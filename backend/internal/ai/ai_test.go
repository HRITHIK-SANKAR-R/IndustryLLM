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
