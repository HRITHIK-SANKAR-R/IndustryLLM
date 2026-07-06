"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { nodeColor } from "@/lib/colors";
import type { GraphNode } from "@/lib/types";

// The lib's deep generics fight our GraphNode type; a positioned node just
// needs id + optional x/y/z for camera framing.
type PositionedNode = GraphNode & { x?: number; y?: number; z?: number };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ForceGraphHandle = any;

// react-force-graph-3d pulls three.js/WebGL → client-only, no SSR.
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full grid place-items-center text-xs font-mono text-muted">
      <span className="relative overflow-hidden">
        <span className="scanline absolute inset-x-0 h-4 bg-accent/20" />
        Booting WebGL engine…
      </span>
    </div>
  ),
});

export function GraphEngine() {
  const { graph, activeNodeId, setActiveNode, appStatus } = useStore();
  const fgRef = useRef<ForceGraphHandle>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 300 });

  // Clone graph data — the lib mutates node objects with x/y/z positions.
  const data = useMemo(
    () => ({
      nodes: graph.nodes.map((n) => ({ ...n })),
      links: graph.links.map((l) => ({ ...l })),
    }),
    [graph]
  );

  // Track container size so the canvas fills the pane.
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      setDims({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Fly camera to the active node when selection changes elsewhere.
  useEffect(() => {
    if (!activeNodeId || !fgRef.current) return;
    const node = data.nodes.find((n) => n.id === activeNodeId) as
      | PositionedNode
      | undefined;
    if (!node || node.x == null) return;
    const dist = 120;
    const ratio = 1 + dist / Math.hypot(node.x, node.y || 0, node.z || 0 || 1);
    fgRef.current.cameraPosition(
      { x: node.x * ratio, y: (node.y || 0) * ratio, z: (node.z || 0) * ratio },
      node,
      1000
    );
  }, [activeNodeId, data.nodes]);

  return (
    <section className="relative h-full min-h-0 bg-bg">
      <div className="absolute top-0 inset-x-0 h-9 z-10 flex items-center px-3 border-b border-border bg-surface/80 backdrop-blur">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted">
          Omni-Graph Engine · 3D
        </h3>
        <span className="ml-auto text-[11px] font-mono text-muted">
          drag rotate · scroll zoom
        </span>
      </div>
      <div ref={wrapRef} className="absolute inset-0 top-9">
        {appStatus === "PROCESSING" ? (
          <ScanningOverlay />
        ) : data.nodes.length === 0 ? (
          <div className="h-full grid place-items-center text-xs font-mono text-muted">
            Empty ontology — ingest to populate the graph.
          </div>
        ) : (
          <ForceGraph3D
            ref={fgRef}
            width={dims.w}
            height={dims.h}
            graphData={data}
            backgroundColor="#0B0F19"
            nodeColor={(n) => nodeColor((n as GraphNode).group)}
            nodeLabel={(n) => `${(n as GraphNode).id} · ${(n as GraphNode).label}`}
            nodeVal={(n) => (n as GraphNode).val}
            nodeOpacity={0.95}
            nodeResolution={16}
            linkColor={() => "rgba(255,255,255,0.25)"}
            linkDirectionalParticles={2}
            linkDirectionalParticleSpeed={0.006}
            linkDirectionalParticleWidth={1.6}
            warmupTicks={100}
            cooldownTicks={80}
            onNodeClick={(n) => setActiveNode((n as GraphNode).id)}
          />
        )}
      </div>
    </section>
  );
}

// Wireframe "scanning" placeholder shown over the 3D pane while the pipeline
// is building the ontology (uiux.md §8.2: "wireframe scanning animation").
function ScanningOverlay() {
  return (
    <div className="relative h-full w-full overflow-hidden grid place-items-center">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(#1f2937 1px, transparent 1px), linear-gradient(90deg, #1f2937 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <span className="scanline absolute inset-x-0 h-12 bg-accent/10" />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="pulse-dot h-2 w-2 rounded-full bg-accent"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
        <p className="text-xs font-mono text-muted">
          Constructing knowledge graph…
        </p>
      </div>
    </div>
  );
}
