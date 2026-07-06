package worker

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"time"
)

// Client talks to the Python FastAPI worker for PDF text extraction and image
// compression. Kept behind a small interface so the pipeline can run without it.
type Client struct {
	baseURL string
	http    *http.Client
}

func New(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		http:    &http.Client{Timeout: 60 * time.Second},
	}
}

// ParseResult is what the Python worker returns after parsing the uploads.
type ParseResult struct {
	Chunks      []string `json:"chunks"`    // semantic text chunks from the PDF
	ImageB64    string   `json:"image_b64"` // compressed schematic, base64
	ImageName   string   `json:"image_name"`
	ImageWidth  int      `json:"image_width"` // pixel space the vision model sees
	ImageHeight int      `json:"image_height"`
	PageCount   int      `json:"page_count"`
}

// Parse posts the raw PDF + image bytes to the worker and returns chunks + b64 image.
func (c *Client) Parse(pdf []byte, pdfName string, img []byte, imgName string) (*ParseResult, error) {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	if len(pdf) > 0 {
		fw, err := w.CreateFormFile("manual", pdfName)
		if err != nil {
			return nil, err
		}
		if _, err := fw.Write(pdf); err != nil {
			return nil, err
		}
	}
	if len(img) > 0 {
		fw, err := w.CreateFormFile("schematic", imgName)
		if err != nil {
			return nil, err
		}
		if _, err := fw.Write(img); err != nil {
			return nil, err
		}
	}
	if err := w.Close(); err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, c.baseURL+"/parse", &buf)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", w.FormDataContentType())

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("worker unreachable: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("worker error %d: %s", resp.StatusCode, string(body))
	}

	var out ParseResult
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("worker bad json: %w", err)
	}
	return &out, nil
}

// Health pings the worker; returns nil if reachable.
func (c *Client) Health() error {
	resp, err := c.http.Get(c.baseURL + "/health")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("worker health %d", resp.StatusCode)
	}
	return nil
}

// BaseURLFromEnv resolves the worker URL from env or a sane default.
func BaseURLFromEnv() string {
	if v := os.Getenv("WORKER_URL"); v != "" {
		return v
	}
	return "http://127.0.0.1:8000"
}
