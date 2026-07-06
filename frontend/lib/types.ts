// TypeScript mirrors of the Go backend payloads.

export type NodeGroup = "Equipment" | "Rule" | "Coordinate";

export interface GraphNode {
  id: string;
  group: NodeGroup;
  label: string;
  val: number;
}

export interface GraphLink {
  source: string;
  target: string;
  label: string;
}

export interface Graph {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface BoundingBox {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

export interface DrawerRule {
  category: string;
  description: string;
  audit_trail: string;
}

export interface NodeContext {
  equipment_tag: string;
  name: string;
  system: string;
  spatial_coordinates: BoundingBox | null;
  associated_rules: DrawerRule[];
  linked_assets: string[];
}

export interface SpatialHit {
  equipment_tag: string;
  confidence: number;
  bounding_box: BoundingBox;
}

export interface LogLine {
  tag: string;
  msg: string;
}

export interface Health {
  status: string;
  worker: boolean;
  mock_only: boolean;
}

export type AppStatus = "IDLE" | "PROCESSING" | "READY" | "ERROR";

export interface Toast {
  id: string;
  kind: "success" | "error";
  message: string;
}
