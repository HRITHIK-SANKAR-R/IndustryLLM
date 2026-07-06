// Package graphdb mirrors the in-memory store into Neo4j. It is a best-
// effort side-write: the in-memory store (internal/store) stays the source
// of truth for every read the frontend depends on, so a missing/unreachable
// Neo4j never breaks the live demo. It exists to make the "Neo4j knowledge
// graph" claim real and queryable, per backendschema.md.
package graphdb

import (
	"context"
	"fmt"
	"time"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"

	"omnigraph/internal/models"
)

type Client struct {
	driver neo4j.DriverWithContext
}

// New connects and verifies connectivity. Callers should treat a non-nil
// error as "run without Neo4j" rather than fatal.
func New(uri, user, password string) (*Client, error) {
	var auth neo4j.AuthToken
	if user == "" {
		auth = neo4j.NoAuth()
	} else {
		auth = neo4j.BasicAuth(user, password, "")
	}
	driver, err := neo4j.NewDriverWithContext(uri, auth)
	if err != nil {
		return nil, fmt.Errorf("new driver: %w", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := driver.VerifyConnectivity(ctx); err != nil {
		_ = driver.Close(context.Background())
		return nil, fmt.Errorf("verify connectivity: %w", err)
	}
	return &Client{driver: driver}, nil
}

func (c *Client) Close(ctx context.Context) error {
	if c == nil || c.driver == nil {
		return nil
	}
	return c.driver.Close(ctx)
}

// EnsureConstraints creates the unique constraints and indices from
// backendschema.md ??7.1/7.2. Safe to call repeatedly (IF NOT EXISTS).
func (c *Client) EnsureConstraints(ctx context.Context) error {
	stmts := []string{
		"CREATE CONSTRAINT unique_equipment IF NOT EXISTS FOR (e:Equipment) REQUIRE e.tag_id IS UNIQUE",
		"CREATE CONSTRAINT unique_rule IF NOT EXISTS FOR (r:Rule) REQUIRE r.rule_id IS UNIQUE",
		"CREATE CONSTRAINT unique_coord IF NOT EXISTS FOR (c:Coordinate) REQUIRE c.coord_id IS UNIQUE",
		"CREATE INDEX rule_category_idx IF NOT EXISTS FOR (r:Rule) ON (r.category)",
	}
	for _, s := range stmts {
		if _, err := neo4j.ExecuteQuery(ctx, c.driver, s, nil, neo4j.EagerResultTransformer); err != nil {
			return fmt.Errorf("constraint %q: %w", s, err)
		}
	}
	return nil
}

// bulkInsertCypher mirrors backendschema.md ??8.1: UNWIND a batch of
// entities, MERGE Equipment/Rule/Coordinate nodes and their edges in one
// transaction so repeated ingests of the same tag stay idempotent.
const bulkInsertCypher = `
UNWIND $entities AS entity
MERGE (e:Equipment {tag_id: entity.equipment_tag})
ON CREATE SET e.name = entity.name, e.system = entity.system
ON MATCH SET e.name = coalesce(entity.name, e.name), e.system = coalesce(entity.system, e.system)

WITH e, entity
UNWIND entity.rules AS rule
MERGE (r:Rule {description: rule.description})
ON CREATE SET r.category = rule.category, r.rule_id = randomUUID(), r.source = rule.source_paragraph
MERGE (e)-[:HAS_RULE]->(r)

WITH e, entity
UNWIND entity.spatial AS space
MERGE (c:Coordinate {x_min: space.x_min, y_min: space.y_min, x_max: space.x_max, y_max: space.y_max})
ON CREATE SET c.coord_id = randomUUID()
MERGE (e)-[:LOCATED_AT]->(c)
`

// Ingest writes one extraction result into Neo4j. Nil-receiver-safe so
// callers can hold a possibly-nil *Client without a guard at every call site.
func (c *Client) Ingest(ctx context.Context, res models.ExtractionResult) error {
	if c == nil || c.driver == nil {
		return nil
	}
	_, err := neo4j.ExecuteQuery(ctx, c.driver, bulkInsertCypher,
		map[string]any{"entities": toPayload(res)}, neo4j.EagerResultTransformer)
	return err
}

// CountNodes is a small live-verification helper (used by the integration test).
func (c *Client) CountNodes(ctx context.Context) (int64, error) {
	res, err := neo4j.ExecuteQuery(ctx, c.driver, "MATCH (n) RETURN count(n) AS n", nil, neo4j.EagerResultTransformer)
	if err != nil {
		return 0, err
	}
	if len(res.Records) == 0 {
		return 0, nil
	}
	v, _, err := neo4j.GetRecordValue[int64](res.Records[0], "n")
	return v, err
}

func toPayload(res models.ExtractionResult) []map[string]any {
	spatialByTag := map[string][]map[string]any{}
	for _, s := range res.Spatial {
		spatialByTag[s.EquipmentTag] = append(spatialByTag[s.EquipmentTag], map[string]any{
			"x_min": s.Box.XMin, "y_min": s.Box.YMin, "x_max": s.Box.XMax, "y_max": s.Box.YMax,
		})
	}
	out := make([]map[string]any, 0, len(res.Entities))
	for _, e := range res.Entities {
		rules := make([]map[string]any, 0, len(e.Rules))
		for _, r := range e.Rules {
			rules = append(rules, map[string]any{
				"category":         r.Category,
				"description":      r.Description,
				"source_paragraph": r.Source,
			})
		}
		out = append(out, map[string]any{
			"equipment_tag": e.EquipmentTag,
			"name":          e.Name,
			"system":        e.System,
			"rules":         rules,
			"spatial":       spatialByTag[e.EquipmentTag],
		})
	}
	return out
}
