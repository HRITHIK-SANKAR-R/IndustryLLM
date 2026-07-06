"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { COLORS } from "@/lib/colors";

// SchematicViewer renders the P&ID with SVG bounding boxes overlaid. Boxes are
// drawn in the schematic's native pixel space via a viewBox so they stay pinned
// under responsive scaling.
export function SchematicViewer() {
  // Per-field selectors avoid re-rendering on unrelated store writes (logs,
  // toasts, context, ...).
  const spatial = useStore((s) => s.spatial);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const setActiveNode = useStore((s) => s.setActiveNode);
  const [hover, setHover] = useState<string | null>(null);
  const [showBoxes, setShowBoxes] = useState(true);

  // Derive a virtual canvas from the extent of all boxes (+ padding).
  const { w, h } = useMemo(() => {
    let maxX = 800;
    let maxY = 600;
    for (const s of spatial) {
      maxX = Math.max(maxX, s.bounding_box.x_max + 80);
      maxY = Math.max(maxY, s.bounding_box.y_max + 80);
    }
    return { w: maxX, h: maxY };
  }, [spatial]);

  return (
    <section className="relative h-full min-h-0 border-b border-border bg-bg overflow-hidden">
      <PaneHeader title="Spatial Blueprint · P&ID">
        <button
          onClick={() => setShowBoxes((v) => !v)}
          className="text-[11px] px-2 py-1 rounded border border-border text-muted hover:text-text"
        >
          {showBoxes ? "Hide" : "Show"} overlays
        </button>
      </PaneHeader>

      <div className="absolute inset-0 top-9 flex items-center justify-center p-4">
        {spatial.length === 0 ? (
          <p className="text-xs text-muted font-mono">
            Awaiting schematic ingestion…
          </p>
        ) : (
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="max-h-full max-w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <SchematicBackground w={w} h={h} />
            {showBoxes &&
              spatial.map((s) => {
                const b = s.bounding_box;
                const active = activeNodeId === s.equipment_tag;
                const isHover = hover === s.equipment_tag;
                const stroke = active
                  ? COLORS.danger
                  : isHover
                    ? COLORS.accent
                    : "#ffffff";
                return (
                  <g
                    key={s.equipment_tag}
                    onClick={() => setActiveNode(s.equipment_tag)}
                    onMouseEnter={() => setHover(s.equipment_tag)}
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x={b.x_min}
                      y={b.y_min}
                      width={b.x_max - b.x_min}
                      height={b.y_max - b.y_min}
                      fill={
                        active
                          ? "rgba(239,68,68,0.25)"
                          : isHover
                            ? "rgba(59,130,246,0.2)"
                            : "rgba(255,255,255,0.03)"
                      }
                      stroke={stroke}
                      strokeWidth={active || isHover ? 3 : 1.5}
                      strokeDasharray={active || isHover ? "0" : "6 4"}
                      rx={4}
                    />
                    <text
                      x={b.x_min}
                      y={b.y_min - 6}
                      fontSize={16}
                      fontFamily="monospace"
                      fill={stroke}
                    >
                      {s.equipment_tag}
                    </text>
                  </g>
                );
              })}
          </svg>
        )}
      </div>
    </section>
  );
}

// Decorative faux-P&ID grid so mock mode still reads as an engineering drawing.
function SchematicBackground({ w, h }: { w: number; h: number }) {
  return (
    <>
      <rect x={0} y={0} width={w} height={h} fill="#0d1220" />
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="#1f2937"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="url(#grid)" />
      {/* faux pipe runs */}
      <line x1={0} y1={h * 0.4} x2={w} y2={h * 0.4} stroke="#233044" strokeWidth="4" />
      <line x1={w * 0.55} y1={0} x2={w * 0.55} y2={h} stroke="#233044" strokeWidth="4" />
    </>
  );
}

function PaneHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="absolute top-0 inset-x-0 h-9 z-10 flex items-center justify-between px-3 border-b border-border bg-surface/80 backdrop-blur">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted">
        {title}
      </h3>
      {children}
    </div>
  );
}
