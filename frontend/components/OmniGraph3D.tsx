"use client";

import { useStore } from "@/lib/store";
import { nodeColor } from "@/lib/colors";
import type { GraphNode, GraphLink } from "@/lib/types";
import { useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";

// The lib's deep generics fight our GraphNode type; a positioned node just
// needs id + optional x/y/z for camera framing (matches GraphEngine.tsx).
type PositionedNode = GraphNode & { x?: number; y?: number; z?: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ForceGraphHandle = any;

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

export default function OmniGraph3D() {
  const graph = useStore((s) => s.graph);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const setActiveNode = useStore((s) => s.setActiveNode);
  const fgRef = useRef<ForceGraphHandle>(undefined);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const getNodeColor = useCallback(
    (n: object) => {
      const node = n as GraphNode;
      if (
        activeNodeId &&
        activeNodeId !== node.id &&
        !graph.links.some((l: GraphLink) => {
          const s = typeof l.source === "object" ? (l.source as GraphNode).id : l.source;
          const t = typeof l.target === "object" ? (l.target as GraphNode).id : l.target;
          return (s === activeNodeId && t === node.id) || (t === activeNodeId && s === node.id);
        })
      ) {
        return "rgba(255, 255, 255, 0.1)";
      }
      if (hoveredNodeId === node.id) return "var(--text)";
      return nodeColor(node.group);
    },
    [activeNodeId, hoveredNodeId, graph.links]
  );

  if (graph.nodes.length === 0) {
    return (
      <div className="h-full w-full bg-[var(--bg)] flex items-center justify-center text-[var(--muted)] font-mono text-sm">
        Awaiting graph data…
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-[var(--bg)]">
      <ForceGraph3D
        ref={fgRef}
        graphData={graph}
        nodeColor={getNodeColor}
        nodeLabel={(n: object) => (n as GraphNode).label}
        nodeVal={(n: object) => (n as GraphNode).val}
        nodeRelSize={6}
        linkColor={() => "rgba(255,255,255,0.2)"}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleSpeed={0.01}
        warmupTicks={100}
        cooldownTicks={0}
        onNodeClick={(n: object) => {
          const node = n as PositionedNode;
          setActiveNode(node.id);
          if (fgRef.current && node.x != null && node.y != null && node.z != null) {
            const distance = 40;
            const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
            fgRef.current.cameraPosition(
              { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
              node,
              3000
            );
          }
        }}
        onNodeHover={(n: object | null) => setHoveredNodeId(n ? (n as GraphNode).id : null)}
        backgroundColor="transparent"
      />
    </div>
  );
}
