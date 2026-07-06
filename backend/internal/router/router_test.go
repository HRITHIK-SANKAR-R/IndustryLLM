package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"omnigraph/internal/models"
	"omnigraph/internal/pipeline"
	"omnigraph/internal/store"
)

func newTestRouter() *Router {
	st := store.New()
	pl := &pipeline.Pipeline{Store: st, MockDir: "../../mock_data", HasKeys: false}
	return &Router{Store: st, Pipeline: pl, MockOnly: true}
}

func TestHealth(t *testing.T) {
	rt := newTestRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	w := httptest.NewRecorder()
	rt.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["mock_only"] != true {
		t.Errorf("mock_only = %v, want true", body["mock_only"])
	}
	if body["worker"] != false {
		t.Errorf("worker = %v, want false (nil client)", body["worker"])
	}
}

func TestIngestMockThenGraphAndSpatial(t *testing.T) {
	rt := newTestRouter()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest", nil)
	req.Header.Set("X-Mock-Mode", "true")
	w := httptest.NewRecorder()
	rt.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusAccepted {
		t.Fatalf("ingest status = %d, want 202, body=%s", w.Code, w.Body.String())
	}
	var ir models.IngestResponse
	if err := json.Unmarshal(w.Body.Bytes(), &ir); err != nil {
		t.Fatalf("decode ingest response: %v", err)
	}
	if ir.Status != "complete" {
		t.Errorf("status = %q, want complete", ir.Status)
	}

	// /graph should now reflect the Golden Dataset.
	gw := httptest.NewRecorder()
	rt.Handler().ServeHTTP(gw, httptest.NewRequest(http.MethodGet, "/api/v1/graph", nil))
	var graph models.Graph
	if err := json.Unmarshal(gw.Body.Bytes(), &graph); err != nil {
		t.Fatalf("decode graph: %v", err)
	}
	if len(graph.Nodes) == 0 {
		t.Error("expected nodes after mock ingest, got 0")
	}

	// /spatial should have at least one bounding box.
	sw := httptest.NewRecorder()
	rt.Handler().ServeHTTP(sw, httptest.NewRequest(http.MethodGet, "/api/v1/spatial", nil))
	var spatialResp struct {
		Spatial []models.SpatialHit `json:"spatial"`
	}
	if err := json.Unmarshal(sw.Body.Bytes(), &spatialResp); err != nil {
		t.Fatalf("decode spatial: %v", err)
	}
	if len(spatialResp.Spatial) == 0 {
		t.Error("expected spatial hits after mock ingest, got 0")
	}

	// /logs should have captured the pipeline's log lines for this job.
	lw := httptest.NewRecorder()
	rt.Handler().ServeHTTP(lw, httptest.NewRequest(http.MethodGet, "/api/v1/logs", nil))
	var logsResp struct {
		Logs []logLine `json:"logs"`
	}
	if err := json.Unmarshal(lw.Body.Bytes(), &logsResp); err != nil {
		t.Fatalf("decode logs: %v", err)
	}
	if len(logsResp.Logs) == 0 {
		t.Error("expected log lines after mock ingest, got 0")
	}
}

func TestNodeContextKnownAndUnknownTag(t *testing.T) {
	rt := newTestRouter()

	// Seed the store via a mock ingest first.
	ireq := httptest.NewRequest(http.MethodPost, "/api/v1/ingest?mock=true", nil)
	rt.Handler().ServeHTTP(httptest.NewRecorder(), ireq)

	gw := httptest.NewRecorder()
	rt.Handler().ServeHTTP(gw, httptest.NewRequest(http.MethodGet, "/api/v1/graph", nil))
	var graph models.Graph
	_ = json.Unmarshal(gw.Body.Bytes(), &graph)

	var equipTag string
	for _, n := range graph.Nodes {
		if n.Group == "Equipment" {
			equipTag = n.ID
			break
		}
	}
	if equipTag == "" {
		t.Fatal("no Equipment node found in mock graph")
	}

	cw := httptest.NewRecorder()
	rt.Handler().ServeHTTP(cw, httptest.NewRequest(http.MethodGet, "/api/v1/node/"+equipTag+"/context", nil))
	if cw.Code != http.StatusOK {
		t.Fatalf("context status = %d, want 200, body=%s", cw.Code, cw.Body.String())
	}

	nw := httptest.NewRecorder()
	rt.Handler().ServeHTTP(nw, httptest.NewRequest(http.MethodGet, "/api/v1/node/NOT-A-REAL-TAG/context", nil))
	if nw.Code != http.StatusNotFound {
		t.Errorf("unknown tag status = %d, want 404", nw.Code)
	}
}

func TestNodeContextStripsCoordinatePrefix(t *testing.T) {
	rt := newTestRouter()
	rt.Handler().ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/api/v1/ingest?mock=true", nil))

	gw := httptest.NewRecorder()
	rt.Handler().ServeHTTP(gw, httptest.NewRequest(http.MethodGet, "/api/v1/graph", nil))
	var graph models.Graph
	_ = json.Unmarshal(gw.Body.Bytes(), &graph)

	var equipTag string
	for _, n := range graph.Nodes {
		if n.Group == "Equipment" {
			equipTag = n.ID
			break
		}
	}
	if equipTag == "" {
		t.Fatal("no Equipment node found in mock graph")
	}

	cw := httptest.NewRecorder()
	rt.Handler().ServeHTTP(cw, httptest.NewRequest(http.MethodGet, "/api/v1/node/C-"+equipTag+"/context", nil))
	if cw.Code != http.StatusOK {
		t.Fatalf("context status with C- prefix = %d, want 200, body=%s", cw.Code, cw.Body.String())
	}
}

func TestCORSPreflight(t *testing.T) {
	rt := newTestRouter()
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/graph", nil)
	w := httptest.NewRecorder()
	rt.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("OPTIONS status = %d, want 204", w.Code)
	}
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("Access-Control-Allow-Origin = %q, want *", got)
	}
}

func TestIngestReadsMultipartFieldsWithoutError(t *testing.T) {
	rt := newTestRouter()

	var buf strings.Builder
	buf.WriteString("--X\r\n")
	buf.WriteString(`Content-Disposition: form-data; name="manual"; filename="m.pdf"` + "\r\n")
	buf.WriteString("Content-Type: application/pdf\r\n\r\n")
	buf.WriteString("dummy-pdf-bytes")
	buf.WriteString("\r\n--X--\r\n")

	req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest", strings.NewReader(buf.String()))
	req.Header.Set("Content-Type", "multipart/form-data; boundary=X")
	req.Header.Set("X-Mock-Mode", "true")
	w := httptest.NewRecorder()
	rt.Handler().ServeHTTP(w, req)

	if w.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202, body=%s", w.Code, w.Body.String())
	}
}
