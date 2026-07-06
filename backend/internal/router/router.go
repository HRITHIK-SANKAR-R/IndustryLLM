package router

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"

	"omnigraph/internal/models"
	"omnigraph/internal/pipeline"
	"omnigraph/internal/store"
	"omnigraph/internal/worker"
)

// Router wires HTTP endpoints to the store and pipeline.
type Router struct {
	Store    *store.Store
	Pipeline *pipeline.Pipeline
	Worker   *worker.Client
	MockOnly bool // true when no API keys → always report mock

	mu   sync.Mutex
	logs []logLine // last job's log lines, replayed to SSE clients
}

type logLine struct {
	Tag string `json:"tag"`
	Msg string `json:"msg"`
}

// Handler returns the configured http.ServeMux (Go 1.22+ pattern routing).
func (rt *Router) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health", rt.health)
	mux.HandleFunc("POST /api/v1/ingest", rt.ingest)
	mux.HandleFunc("GET /api/v1/graph", rt.graph)
	mux.HandleFunc("GET /api/v1/node/{tag}/context", rt.nodeContext)
	mux.HandleFunc("GET /api/v1/logs", rt.logsHandler)
	return cors(mux)
}

func (rt *Router) health(w http.ResponseWriter, r *http.Request) {
	workerOK := rt.Worker != nil && rt.Worker.Health() == nil
	writeJSON(w, http.StatusOK, map[string]any{
		"status":    "ok",
		"worker":    workerOK,
		"mock_only": rt.MockOnly,
	})
}

func (rt *Router) ingest(w http.ResponseWriter, r *http.Request) {
	mock := rt.MockOnly ||
		r.Header.Get("X-Mock-Mode") == "true" ||
		r.URL.Query().Get("mock") == "true"

	// Read optional uploads (ignored in mock mode but parsed anyway for realism).
	var pdf, img []byte
	var pdfName, imgName string
	if err := r.ParseMultipartForm(32 << 20); err == nil {
		pdf, pdfName = readFile(r, "manual")
		if pdf == nil {
			pdf, pdfName = readFile(r, "file1")
		}
		img, imgName = readFile(r, "schematic")
		if img == nil {
			img, imgName = readFile(r, "file2")
		}
	}

	// Reset log buffer for this job.
	rt.mu.Lock()
	rt.logs = nil
	rt.mu.Unlock()

	log := func(tag, msg string) {
		rt.mu.Lock()
		rt.logs = append(rt.logs, logLine{Tag: tag, Msg: msg})
		rt.mu.Unlock()
	}

	// Respond 202 immediately, run pipeline synchronously here (small demo scale).
	// We run inline so /graph is ready by the time the client polls after logs finish.
	_, err := rt.Pipeline.Run(pdf, pdfName, img, imgName, mock, log)
	if err != nil {
		log("ERR", err.Error())
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusAccepted, models.IngestResponse{JobID: "job-1", Status: "complete"})
}

func (rt *Router) graph(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, rt.Store.Graph())
}

func (rt *Router) nodeContext(w http.ResponseWriter, r *http.Request) {
	tag := r.PathValue("tag")
	// Coordinate nodes come in as "C-<tag>"; resolve back to the equipment.
	tag = strings.TrimPrefix(tag, "C-")
	ctx, ok := rt.Store.Context(tag)
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "unknown tag: " + tag})
		return
	}
	writeJSON(w, http.StatusOK, ctx)
}

// logsHandler returns the last job's captured log lines (simple polling model).
func (rt *Router) logsHandler(w http.ResponseWriter, r *http.Request) {
	rt.mu.Lock()
	out := make([]logLine, len(rt.logs))
	copy(out, rt.logs)
	rt.mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"logs": out})
}

// ---- helpers ----

func readFile(r *http.Request, field string) ([]byte, string) {
	f, hdr, err := r.FormFile(field)
	if err != nil {
		return nil, ""
	}
	defer f.Close()
	b, err := io.ReadAll(f)
	if err != nil {
		return nil, ""
	}
	return b, hdr.Filename
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		fmt.Println("writeJSON error:", err)
	}
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Mock-Mode")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
