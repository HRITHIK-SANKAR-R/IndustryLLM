"use client";

import { useAppStore } from "@/store/useAppStore";
import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from 'next/dynamic';

// Dynamically import ForceGraph3D to avoid SSR issues with WebGL
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

// Mock Data for the Graph
const MOCK_GRAPH_DATA = {
  nodes: [
    { id: "V-104", name: "Valve V-104", group: "equipment", val: 5 },
    { id: "P-201A", name: "Pump P-201A", group: "equipment", val: 8 },
    { id: "C-1", name: "Chiller C-1", group: "equipment", val: 6 },
    { id: "R-101", name: "OSHA 1910.119", group: "rule", val: 3 },
    { id: "M-402", name: "Torque Specs", group: "procedure", val: 4 },
  ],
  links: [
    { source: "V-104", target: "R-101" },
    { source: "V-104", target: "M-402" },
    { source: "P-201A", target: "V-104" },
    { source: "C-1", target: "P-201A" },
  ]
};

export default function OmniGraph3D() {
  const { activeNodeId, setActiveNodeId, hoveredNodeId, setHoveredNodeId } = useAppStore();
  const fgRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getNodeColor = useCallback((node: any) => {
    // If there's an active node, fade others
    if (activeNodeId && activeNodeId !== node.id && !MOCK_GRAPH_DATA.links.some(l => (l.source === activeNodeId && l.target === node.id) || (l.target === activeNodeId && l.source === node.id))) {
      return 'rgba(255, 255, 255, 0.1)';
    }

    if (hoveredNodeId === node.id) return 'var(--text)';
    
    switch(node.group) {
      case 'equipment': return 'var(--primary)'; // Electric Cyan / Cobalt
      case 'rule': return 'var(--secondary)'; // Amber
      case 'procedure': return 'var(--tertiary)'; // Purple
      default: return 'var(--muted)';
    }
  }, [activeNodeId, hoveredNodeId]);

  if (!mounted) return <div className="h-full w-full bg-[var(--bg)] flex items-center justify-center text-[var(--muted)]">Initializing WebGL Engine...</div>;

  return (
    <div className="relative h-full w-full bg-[var(--bg)]">
      <ForceGraph3D
        ref={fgRef}
        graphData={MOCK_GRAPH_DATA}
        nodeColor={getNodeColor}
        nodeLabel="name"
        nodeRelSize={6}
        linkColor={() => 'rgba(255,255,255,0.2)'}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleSpeed={0.01}
        onNodeClick={(node: any) => {
          setActiveNodeId(node.id);
          // Focus camera on node
          if (fgRef.current) {
            const distance = 40;
            const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
            fgRef.current.cameraPosition(
              { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
              node,
              3000 // ms transition
            );
          }
        }}
        onNodeHover={(node: any) => {
          if (node) {
            setHoveredNodeId(node.id);
          } else {
            setHoveredNodeId(null);
          }
        }}
        backgroundColor="transparent"
      />
    </div>
  );
}
