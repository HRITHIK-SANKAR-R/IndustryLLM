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
	if err := json.Unmarshal([]byte(sanitizeLLMJSON(content)), &out); err != nil {
		return nil, fmt.Errorf("groq bad json: %w", err)
	}
	return out.Entities, nil
}

// ExtractSpatial sends the base64 schematic to NVIDIA NIM and returns bounding boxes.
func (c *Client) ExtractSpatial(imageB64 string, tags []string) ([]models.SpatialHit, error) {
	prompt := fmt.Sprintf(`You are a spatial bounding box extractor for engineering diagrams.
Locate these equipment tags in the image: %s.
Return ONLY valid JSON matching:
{"spatial":[{"equipment_tag":"","confidence":0.0,"bounding_box":{"x_min":0,"y_min":0,"x_max":0,"y_max":0}}]}`,
		strings.Join(tags, ", "))

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
		Spatial []models.SpatialHit `json:"spatial"`
	}
	if err := json.Unmarshal([]byte(sanitizeLLMJSON(content)), &out); err != nil {
		return nil, fmt.Errorf("nvidia bad json: %w", err)
	}
	return out.Spatial, nil
}
