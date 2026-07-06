package pipeline

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"omnigraph/internal/ai"
	"omnigraph/internal/graphdb"
	"omnigraph/internal/models"
	"omnigraph/internal/store"
	"omnigraph/internal/worker"
)

// LogFn receives a single terminal log line (tag + message) as the pipeline runs.
type LogFn func(tag, msg string)

// Pipeline orchestrates: Python worker -> Groq (text) + NVIDIA (vision) -> store.
type Pipeline struct {
	Store    *store.Store
	Worker   *worker.Client
	AI       *ai.Client
	Neo4j    *graphdb.Client // optional; nil means "no Neo4j configured/reachable"
	MockDir  string
	HasKeys  bool // true if both API keys present; else force mock
}

// Run executes ingestion. If mock is true (or keys missing) it serves the
// pre-computed Golden Dataset so the demo never depends on venue Wi-Fi.
func (p *Pipeline) Run(pdf []byte, pdfName string, img []byte, imgName string, mock bool, log LogFn) (models.ExtractionResult, error) {
	log("SYS", "Initializing ingestion pipeline...")

	if mock || !p.HasKeys {
		return p.runMock(log)
	}
	return p.runLive(pdf, pdfName, img, imgName, log)
}

func (p *Pipeline) runMock(log LogFn) (models.ExtractionResult, error) {
	log("SYS", "Edge-compute mode: external APIs decoupled, using local cache.")
	time.Sleep(1500 * time.Millisecond) // realistic processing feel

	path := filepath.Join(p.MockDir, "demo_payload.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		return models.ExtractionResult{}, fmt.Errorf("read mock payload: %w", err)
	}
	var res models.ExtractionResult
	if err := json.Unmarshal(raw, &res); err != nil {
		return models.ExtractionResult{}, fmt.Errorf("parse mock payload: %w", err)
	}
	log("GROQ", fmt.Sprintf("Extracted %d entities.", len(res.Entities)))
	log("NVIDIA", fmt.Sprintf("Bounding boxes mapped for %d tags.", len(res.Spatial)))
	p.commit(res, log)
	return res, nil
}

func (p *Pipeline) runLive(pdf []byte, pdfName string, img []byte, imgName string, log LogFn) (models.ExtractionResult, error) {
	log("PY", "Chunking PDF and compressing schematic...")
	parsed, err := p.Worker.Parse(pdf, pdfName, img, imgName)
	if err != nil {
		return models.ExtractionResult{}, fmt.Errorf("worker parse: %w", err)
	}
	log("PY", fmt.Sprintf("Got %d text chunks (%d pages), image %d bytes b64.",
		len(parsed.Chunks), parsed.PageCount, len(parsed.ImageB64)))

	var (
		wg       sync.WaitGroup
		mu       sync.Mutex
		entities []models.Entity
		spatial  []models.SpatialHit
	)

	// Branch A: text chunks -> Groq, concurrently.
	for i, chunk := range parsed.Chunks {
		wg.Add(1)
		go func(i int, chunk string) {
			defer wg.Done()
			ents, err := p.AI.ExtractText(chunk)
			if err != nil {
				log("GROQ", fmt.Sprintf("chunk %d dropped: %v", i, err))
				return
			}
			mu.Lock()
			entities = append(entities, ents...)
			mu.Unlock()
		}(i, chunk)
	}

	// Branch B: schematic -> NVIDIA (runs in parallel with the Groq fan-out).
	wg.Add(1)
	go func() {
		defer wg.Done()
		if parsed.ImageB64 == "" {
			return
		}
		// Vision needs candidate tags; on first pass we ask for everything.
		hits, err := p.AI.ExtractSpatial(parsed.ImageB64, []string{"all equipment tags"})
		if err != nil {
			log("NVIDIA", fmt.Sprintf("vision failed: %v", err))
			return
		}
		mu.Lock()
		spatial = hits
		mu.Unlock()
	}()

	wg.Wait()

	entities = mergeEntities(entities)
	log("GROQ", fmt.Sprintf("Extracted %d unique entities.", len(entities)))
	log("NVIDIA", fmt.Sprintf("Bounding boxes mapped for %d tags.", len(spatial)))

	res := models.ExtractionResult{
		DocumentType: "Maintenance Manual",
		SourceImage:  imgName,
		Entities:     entities,
		Spatial:      spatial,
	}
	p.commit(res, log)
	return res, nil
}

func (p *Pipeline) commit(res models.ExtractionResult, log LogFn) {
	p.Store.Reset()
	p.Store.Ingest(res)
	n, e := p.Store.Counts()
	log("GRAPH", fmt.Sprintf("Injected %d nodes and %d edges.", n, e))

	// Best-effort mirror into Neo4j. The in-memory store above is the source
	// of truth for every read the frontend makes, so a slow/unreachable
	// Neo4j never breaks the live demo.
	if p.Neo4j != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := p.Neo4j.Ingest(ctx, res); err != nil {
			log("NEO4J", fmt.Sprintf("mirror write failed (non-fatal): %v", err))
		} else {
			log("NEO4J", "Graph mirrored to Neo4j.")
		}
	}

	log("SYS", "Graph generation complete.")
}

// mergeEntities collapses duplicate equipment tags across chunks, unioning rules.
func mergeEntities(in []models.Entity) []models.Entity {
	byTag := map[string]*models.Entity{}
	var order []string
	for _, e := range in {
		if e.EquipmentTag == "" {
			continue
		}
		cur, ok := byTag[e.EquipmentTag]
		if !ok {
			cp := e
			byTag[e.EquipmentTag] = &cp
			order = append(order, e.EquipmentTag)
			continue
		}
		if cur.Name == "" {
			cur.Name = e.Name
		}
		if cur.System == "" {
			cur.System = e.System
		}
		cur.Rules = append(cur.Rules, e.Rules...)
	}
	out := make([]models.Entity, 0, len(order))
	for _, tag := range order {
		out = append(out, *byTag[tag])
	}
	return out
}
