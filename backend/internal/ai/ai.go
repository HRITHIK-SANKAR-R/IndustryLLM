package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"omnigraph/internal/models"
)

const (
	groqURL   = "https://api.groq.com/openai/v1/chat/completions"
	groqModel = "llama-3.3-70b-versatile"

	nvidiaURL   = "https://integrate.api.nvidia.com/v1/chat/completions"
	nvidiaModel = "meta/llama-3.2-11b-vision-instruct"
)

// Client wraps the two hosted inference APIs. A buffered channel acts as a
// semaphore so we never exceed provider RPM limits when fanning out chunks.
type Client struct {
	groqKey   string
	nvidiaKey string
	http      *http.Client
	sem       chan struct{}
}

func New(groqKey, nvidiaKey string) *Client {
	return &Client{
		groqKey:   groqKey,
		nvidiaKey: nvidiaKey,
		http:      &http.Client{Timeout: 90 * time.Second},
		sem:       make(chan struct{}, 5), // max 5 concurrent outbound calls
	}
}

// sanitizeLLMJSON strips markdown fences / conversational filler, keeping the
// outermost JSON object. LLMs love to wrap output in ```json ... ```.
func sanitizeLLMJSON(raw string) string {
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start == -1 || end == -1 || end < start {
		return "{}"
	}
	return raw[start : end+1]
}

// unmarshalLLMJSON parses JSON out of an LLM reply. The outermost-braces slice
// from sanitizeLLMJSON breaks when the model wraps several {...} fragments in
// prose, so on failure it retries with the last valid JSON object — models
// that ramble usually finish with the actual answer.
func unmarshalLLMJSON(content string, v interface{}) error {
	firstErr := json.Unmarshal([]byte(sanitizeLLMJSON(content)), v)
	if firstErr == nil {
		return nil
	}
	end := strings.LastIndex(content, "}")
	if end == -1 {
		return firstErr
	}
	for start := strings.LastIndex(content[:end+1], "{"); start != -1; start = strings.LastIndex(content[:start], "{") {
		if cand := content[start : end+1]; json.Valid([]byte(cand)) {
			return json.Unmarshal([]byte(cand), v)
		}
	}
	return firstErr
}

// openAIChat is the shared request/response shape for both providers.
type chatReq struct {
	Model          string      `json:"model"`
	Messages       []chatMsg   `json:"messages"`
	Temperature    float64     `json:"temperature"`
	MaxTokens      int         `json:"max_tokens,omitempty"`
	ResponseFormat *respFormat `json:"response_format,omitempty"`
}

type respFormat struct {
	Type string `json:"type"`
}

type chatMsg struct {
	Role    string      `json:"role"`
	Content interface{} `json:"content"`
}

type chatResp struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (c *Client) post(url, key string, body chatReq) (string, error) {
	c.sem <- struct{}{}
	defer func() { <-c.sem }()

	raw, err := json.Marshal(body)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	// Exponential backoff on 429 (rate limit).
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(1<<attempt) * time.Second)
		}
		req2 := req.Clone(req.Context())
		req2.Body = io.NopCloser(bytes.NewReader(raw))
		resp, err := c.http.Do(req2)
		if err != nil {
			lastErr = err
			continue
		}
		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode == http.StatusTooManyRequests {
			lastErr = fmt.Errorf("rate limited (429)")
			continue
		}
		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("provider %d: %s", resp.StatusCode, string(respBody))
		}
		var cr chatResp
		if err := json.Unmarshal(respBody, &cr); err != nil {
			return "", err
		}
		if cr.Error != nil {
			return "", fmt.Errorf("provider error: %s", cr.Error.Message)
		}
		if len(cr.Choices) == 0 {
			return "", fmt.Errorf("provider returned no choices")
		}
		return cr.Choices[0].Message.Content, nil
	}
	return "", fmt.Errorf("exhausted retries: %w", lastErr)
}

const groqSystem = `You are a deterministic industrial data extraction engine.
Extract equipment tags and their maintenance/safety/compliance rules from the text.
Return ONLY valid JSON, no markdown, no prose, matching exactly:
{"entities":[{"equipment_tag":"","name":"","system":"","rules":[{"category":"","description":"","source_paragraph":""}]}]}`

// ExtractText sends one text chunk to Groq and returns parsed entities.
func (c *Client) ExtractText(chunk string) ([]models.Entity, error) {
	content, err := c.post(groqURL, c.groqKey, chatReq{
		Model:          groqModel,
		Temperature:    0.0,
		ResponseFormat: &respFormat{Type: "json_object"},
		Messages: []chatMsg{
			{Role: "system", Content: groqSystem},
			{Role: "user", Content: chunk},
		},
	})
	if err != nil {
		return nil, err
	}
	var out struct {
		Entities []models.Entity `json:"entities"`
	}
	if err := unmarshalLLMJSON(content, &out); err != nil {
		return nil, fmt.Errorf("groq bad json: %w", err)
	}
	return out.Entities, nil
}

// rawSpatialHit tolerates float coordinates: vision models often return
// normalized 0-1 boxes despite being asked for pixels.
type rawSpatialHit struct {
	EquipmentTag string  `json:"equipment_tag"`
	Confidence   float64 `json:"confidence"`
	Box          struct {
		XMin float64 `json:"x_min"`
		YMin float64 `json:"y_min"`
		XMax float64 `json:"x_max"`
		YMax float64 `json:"y_max"`
	} `json:"bounding_box"`
}

// denormalizeSpatial converts raw hits to pixel-space SpatialHits. If every
// coordinate is within [0,1] the box is treated as normalized and scaled by
// the image dimensions; otherwise values are rounded as-is.
func denormalizeSpatial(raw []rawSpatialHit, imgW, imgH int) []models.SpatialHit {
	normalized := len(raw) > 0 && imgW > 0 && imgH > 0
	for _, r := range raw {
		if r.Box.XMax > 1 || r.Box.YMax > 1 || r.Box.XMin > 1 || r.Box.YMin > 1 {
			normalized = false
			break
		}
	}
	hits := make([]models.SpatialHit, 0, len(raw))
	for _, r := range raw {
		b := r.Box
		if normalized {
			b.XMin *= float64(imgW)
			b.XMax *= float64(imgW)
			b.YMin *= float64(imgH)
			b.YMax *= float64(imgH)
		}
		hits = append(hits, models.SpatialHit{
			EquipmentTag: r.EquipmentTag,
			Confidence:   r.Confidence,
			Box: models.BoundingBox{
				XMin: int(b.XMin + 0.5),
				YMin: int(b.YMin + 0.5),
				XMax: int(b.XMax + 0.5),
				YMax: int(b.YMax + 0.5),
			},
		})
	}
	return hits
}

// degenerateSpatial reports whether every returned box is unusable (zero
// area), which happens when the vision model echoes the JSON template instead
// of grounding real coordinates.
func degenerateSpatial(hits []models.SpatialHit) bool {
	for _, h := range hits {
		if h.Box.XMax > h.Box.XMin && h.Box.YMax > h.Box.YMin {
			return false
		}
	}
	return true
}

// regionBox converts a word-region ("bottom-left", "center", ...) into a box
// covering the middle of that cell in a 3x3 grid over the image.
func regionBox(region string, imgW, imgH int) (models.BoundingBox, bool) {
	col, row := -1, -1
	switch {
	case strings.Contains(region, "left"):
		col = 0
	case strings.Contains(region, "right"):
		col = 2
	case strings.Contains(region, "center") || strings.Contains(region, "middle"):
		col = 1
	}
	switch {
	case strings.Contains(region, "top"):
		row = 0
	case strings.Contains(region, "bottom"):
		row = 2
	case strings.Contains(region, "middle") || region == "center":
		row = 1
	}
	if col == -1 || row == -1 {
		return models.BoundingBox{}, false
	}
	cellW, cellH := float64(imgW)/3, float64(imgH)/3
	// Central 50% of the cell: honest about coarse precision without
	// swallowing a third of the schematic.
	return models.BoundingBox{
		XMin: int(float64(col)*cellW + cellW*0.25),
		YMin: int(float64(row)*cellH + cellH*0.25),
		XMax: int(float64(col)*cellW + cellW*0.75),
		YMax: int(float64(row)*cellH + cellH*0.75),
	}, true
}

// extractSpatialByRegion is the fallback localization strategy: the 11B vision
// model reliably reads tags and names coarse regions, but echoes any numeric
// example given in the prompt. So we ask for word-regions and synthesize boxes.
func (c *Client) extractSpatialByRegion(imageB64 string, imgW, imgH int, tags []string) ([]models.SpatialHit, error) {
	prompt := fmt.Sprintf(`Look at this engineering diagram (P&ID). Find these equipment tag labels: %s.
For each tag, give the region where it appears, choosing from: top-left, top-center, top-right, middle-left, center, middle-right, bottom-left, bottom-center, bottom-right.
Answer ONLY JSON: {"labels":[{"tag":"...","region":"..."}]}`, strings.Join(tags, ", "))

	content, err := c.post(nvidiaURL, c.nvidiaKey, chatReq{
		Model:       nvidiaModel,
		Temperature: 0.1,
		MaxTokens:   1024,
		Messages: []chatMsg{
			{Role: "user", Content: []interface{}{
				map[string]string{"type": "text", "text": prompt},
				map[string]interface{}{
					"type":      "image_url",
					"image_url": map[string]string{"url": "data:image/jpeg;base64," + imageB64},
				},
			}},
		},
	})
	if err != nil {
		return nil, err
	}
	var out struct {
		Labels []struct {
			Tag    string `json:"tag"`
			Region string `json:"region"`
		} `json:"labels"`
	}
	if err := unmarshalLLMJSON(content, &out); err != nil {
		return nil, fmt.Errorf("nvidia bad json (region): %w", err)
	}
	hits := make([]models.SpatialHit, 0, len(out.Labels))
	for _, l := range out.Labels {
		box, ok := regionBox(strings.ToLower(l.Region), imgW, imgH)
		if !ok || l.Tag == "" || l.Tag == "..." {
			continue
		}
		hits = append(hits, models.SpatialHit{
			EquipmentTag: l.Tag,
			Confidence:   0.5, // coarse region estimate
			Box:          box,
		})
	}
	return hits, nil
}

// ExtractSpatial sends the base64 schematic to NVIDIA NIM and returns bounding
// boxes in the pixel space of the (compressed) image, imgW x imgH. If the
// model fails to ground pixel coordinates it retries with the coarser
// word-region strategy.
func (c *Client) ExtractSpatial(imageB64 string, imgW, imgH int, tags []string) ([]models.SpatialHit, error) {
	prompt := fmt.Sprintf(`You are a spatial bounding box extractor for engineering diagrams.
The image is %d pixels wide and %d pixels tall.
Locate these equipment tags in the image: %s.
Return pixel coordinates. Return ONLY valid JSON matching:
{"spatial":[{"equipment_tag":"","confidence":0.0,"bounding_box":{"x_min":0,"y_min":0,"x_max":0,"y_max":0}}]}`,
		imgW, imgH, strings.Join(tags, ", "))

	content, err := c.post(nvidiaURL, c.nvidiaKey, chatReq{
		Model:       nvidiaModel,
		Temperature: 0.1,
		MaxTokens:   1024,
		Messages: []chatMsg{
			{Role: "user", Content: []interface{}{
				map[string]string{"type": "text", "text": prompt},
				map[string]interface{}{
					"type":      "image_url",
					"image_url": map[string]string{"url": "data:image/jpeg;base64," + imageB64},
				},
			}},
		},
	})
	if err != nil {
		return nil, err
	}
	var out struct {
		Spatial []rawSpatialHit `json:"spatial"`
	}
	var hits []models.SpatialHit
	if err := unmarshalLLMJSON(content, &out); err == nil {
		hits = denormalizeSpatial(out.Spatial, imgW, imgH)
	}
	// Unparseable or template-echoed output -> coarse word-region strategy.
	if degenerateSpatial(hits) && imgW > 0 && imgH > 0 {
		return c.extractSpatialByRegion(imageB64, imgW, imgH, tags)
	}
	return hits, nil
}
