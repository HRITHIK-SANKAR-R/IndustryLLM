package store

import (
	"fmt"
	"sort"
	"sync"

	"omnigraph/internal/models"
)

// Store is an in-memory knowledge graph. It is the source of truth for the
// frontend so the system runs with zero external dependencies (Neo4j optional).
// Thread-safe: ingestion writes, HTTP handlers read concurrently.
type Store struct {
	mu sync.RWMutex

	equipment map[string]models.Entity      // tag_id -> entity
	spatial   map[string]models.SpatialHit  // tag_id -> bounding box
	// ruleKey -> rule id, so identical rules dedupe into one node
	ruleIDs map[string]string
	rules   map[string]models.Rule // rule id -> rule
	// edges from equipment tag -> rule id
	hasRule map[string][]string
}

func New() *Store {
	return &Store{
		equipment: map[string]models.Entity{},
		spatial:   map[string]models.SpatialHit{},
		ruleIDs:   map[string]string{},
		rules:     map[string]models.Rule{},
		hasRule:   map[string][]string{},
	}
}

// Reset clears the graph (used before each ingest so the demo starts clean).
func (s *Store) Reset() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.equipment = map[string]models.Entity{}
	s.spatial = map[string]models.SpatialHit{}
	s.ruleIDs = map[string]string{}
	s.rules = map[string]models.Rule{}
	s.hasRule = map[string][]string{}
}

// Ingest merges an extraction result into the graph (MERGE semantics: idempotent).
func (s *Store) Ingest(res models.ExtractionResult) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, e := range res.Entities {
		if e.EquipmentTag == "" {
			continue
		}
		s.equipment[e.EquipmentTag] = e
		for _, r := range e.Rules {
			key := e.EquipmentTag + "|" + r.Description
			id, ok := s.ruleIDs[key]
			if !ok {
				id = fmt.Sprintf("R-%d", len(s.rules)+1)
				s.ruleIDs[key] = id
				s.rules[id] = r
				s.hasRule[e.EquipmentTag] = append(s.hasRule[e.EquipmentTag], id)
			}
		}
	}
	for _, sp := range res.Spatial {
		if sp.EquipmentTag == "" {
			continue
		}
		s.spatial[sp.EquipmentTag] = sp
	}
}

// Counts returns node/edge totals for the UI metrics badges.
func (s *Store) Counts() (nodes, edges int) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	nodes = len(s.equipment) + len(s.rules) + len(s.spatial)
	for _, ids := range s.hasRule {
		edges += len(ids)
	}
	edges += len(s.spatial) // one LOCATED_AT edge per spatial hit
	return
}

// Graph builds the react-force-graph payload.
func (s *Store) Graph() models.Graph {
	s.mu.RLock()
	defer s.mu.RUnlock()

	degree := map[string]int{}
	var links []models.GraphLink

	// Equipment -> Rule edges
	for tag, ruleIDs := range s.hasRule {
		for _, rid := range ruleIDs {
			links = append(links, models.GraphLink{Source: tag, Target: rid, Label: "HAS_RULE"})
			degree[tag]++
			degree[rid]++
		}
	}
	// Equipment -> Coordinate edges
	for tag, sp := range s.spatial {
		cid := "C-" + tag
		links = append(links, models.GraphLink{Source: tag, Target: cid, Label: "LOCATED_AT"})
		degree[tag]++
		degree[cid]++
		_ = sp
	}

	var nodes []models.GraphNode
	for tag, e := range s.equipment {
		label := e.Name
		if label == "" {
			label = tag
		}
		nodes = append(nodes, models.GraphNode{ID: tag, Group: "Equipment", Label: label, Val: degree[tag] + 1})
	}
	for rid, r := range s.rules {
		nodes = append(nodes, models.GraphNode{ID: rid, Group: "Rule", Label: truncate(r.Description, 40), Val: degree[rid] + 1})
	}
	for tag, sp := range s.spatial {
		cid := "C-" + tag
		label := fmt.Sprintf("%d,%d", sp.Box.XMin, sp.Box.YMin)
		nodes = append(nodes, models.GraphNode{ID: cid, Group: "Coordinate", Label: label, Val: degree[cid] + 1})
	}

	// Stable ordering so the graph doesn't reshuffle between requests.
	sort.Slice(nodes, func(i, j int) bool { return nodes[i].ID < nodes[j].ID })
	sort.Slice(links, func(i, j int) bool {
		if links[i].Source != links[j].Source {
			return links[i].Source < links[j].Source
		}
		return links[i].Target < links[j].Target
	})
	return models.Graph{Nodes: nodes, Links: links}
}

// Context builds the drawer payload for a single equipment tag.
func (s *Store) Context(tag string) (models.NodeContext, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	e, ok := s.equipment[tag]
	if !ok {
		return models.NodeContext{}, false
	}
	ctx := models.NodeContext{
		EquipmentTag: e.EquipmentTag,
		Name:         e.Name,
		System:       e.System,
	}
	if sp, ok := s.spatial[tag]; ok {
		b := sp.Box
		ctx.Spatial = &b
	}
	for _, rid := range s.hasRule[tag] {
		r := s.rules[rid]
		ctx.Rules = append(ctx.Rules, models.DrawerRule{
			Category:    r.Category,
			Description: r.Description,
			AuditTrail:  r.Source,
		})
	}
	// Linked assets = every other equipment tag (small graph; good enough for demo).
	for otherTag := range s.equipment {
		if otherTag != tag {
			ctx.Linked = append(ctx.Linked, otherTag)
		}
	}
	sort.Strings(ctx.Linked)
	return ctx, true
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}
