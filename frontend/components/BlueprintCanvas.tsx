"use client";

import { useAppStore } from "@/store/useAppStore";
import { ZoomIn, ZoomOut, Maximize, Layers } from "lucide-react";
import { useState } from "react";

// Mock Data for the Bounding Boxes
const MOCK_BOUNDING_BOXES = [
  { id: "V-104", x: 20, y: 30, w: 15, h: 10, label: "Valve V-104" },
  { id: "P-201A", x: 60, y: 50, w: 20, h: 15, label: "Pump P-201A" },
  { id: "C-1", x: 30, y: 70, w: 25, h: 20, label: "Chiller C-1" },
];

export default function BlueprintCanvas() {
  const { activeNodeId, setActiveNodeId, hoveredNodeId, setHoveredNodeId } = useAppStore();
  const [showOverlays, setShowOverlays] = useState(true);

  return (
    <div className="relative h-full w-full bg-[var(--surface)] p-4 flex flex-col">
      {/* Toolbar */}
      <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] p-1 shadow-lg">
        <button className="rounded p-2 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]">
          <ZoomIn className="h-4 w-4" />
        </button>
        <button className="rounded p-2 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]">
          <ZoomOut className="h-4 w-4" />
        </button>
        <button className="rounded p-2 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]">
          <Maximize className="h-4 w-4" />
        </button>
        <div className="my-1 border-t border-[var(--border)]" />
        <button 
          onClick={() => setShowOverlays(!showOverlays)}
          className={`rounded p-2 transition-colors ${showOverlays ? 'bg-[var(--primary)] text-black' : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]'}`}
        >
          <Layers className="h-4 w-4" />
        </button>
      </div>

      {/* Canvas Area */}
      <div className="relative flex-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[#1e1e1e] flex items-center justify-center">
        {/* Placeholder for the actual Blueprint Image */}
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
        <span className="text-[var(--muted)] font-mono opacity-50">Schematic View</span>

        {/* SVG Overlay Layer */}
        {showOverlays && (
          <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: 'none' }}>
            {MOCK_BOUNDING_BOXES.map((box) => {
              const isActive = activeNodeId === box.id;
              const isHovered = hoveredNodeId === box.id;
              
              return (
                <g 
                  key={box.id} 
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  onClick={() => setActiveNodeId(box.id)}
                  onMouseEnter={() => setHoveredNodeId(box.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                >
                  <rect
                    x={`${box.x}%`}
                    y={`${box.y}%`}
                    width={`${box.w}%`}
                    height={`${box.h}%`}
                    fill={isActive ? 'var(--primary)' : isHovered ? 'var(--primary)' : 'transparent'}
                    fillOpacity={isActive ? 0.3 : isHovered ? 0.1 : 0}
                    stroke={isActive || isHovered ? 'var(--primary)' : '#ffffff'}
                    strokeWidth="2"
                    strokeDasharray={isActive || isHovered ? "none" : "4 4"}
                    strokeOpacity={isActive || isHovered ? 1 : 0.4}
                    className="transition-all duration-200"
                  />
                  {/* Label tag */}
                  <text
                    x={`${box.x}%`}
                    y={`${box.y - 2}%`}
                    fill="var(--text)"
                    fontSize="12"
                    fontFamily="monospace"
                    className={`transition-opacity duration-200 ${isActive || isHovered ? 'opacity-100' : 'opacity-0'}`}
                  >
                    {box.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
