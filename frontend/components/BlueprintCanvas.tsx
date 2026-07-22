"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { ZoomIn, ZoomOut, Maximize, Layers } from "lucide-react";

export default function BlueprintCanvas() {
  const spatial = useStore((s) => s.spatial);
  const schematic = useStore((s) => s.schematic);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const setActiveNode = useStore((s) => s.setActiveNode);
  const [showOverlays, setShowOverlays] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  const objectUrl = useMemo(() => (schematic ? URL.createObjectURL(schematic) : null), [schematic]);
  useEffect(() => {
    if (!objectUrl) return;
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  useEffect(() => {
    if (!objectUrl) return;
    const probe = new window.Image();
    probe.onload = () => setImgSize({ w: probe.naturalWidth, h: probe.naturalHeight });
    probe.src = objectUrl;
  }, [objectUrl]);

  // Virtual canvas: real image dimensions once loaded, else derived from
  // the extent of all bounding boxes (with padding), else a sane default.
  const { w, h } = useMemo(() => {
    if (imgSize) return imgSize;
    let maxX = 900;
    let maxY = 700;
    for (const s of spatial) {
      maxX = Math.max(maxX, s.bounding_box.x_max + 80);
      maxY = Math.max(maxY, s.bounding_box.y_max + 80);
    }
    return { w: maxX, h: maxY };
  }, [imgSize, spatial]);

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
          className={`rounded p-2 transition-colors ${showOverlays ? "bg-[var(--primary)] text-black" : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"}`}
        >
          <Layers className="h-4 w-4" />
        </button>
      </div>

      {/* Canvas Area */}
      <div className="relative flex-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[#1e1e1e] flex items-center justify-center">
        {spatial.length === 0 && !schematic ? (
          <span className="text-[var(--muted)] font-mono opacity-50 text-sm">Awaiting schematic ingestion…</span>
        ) : (
          <svg viewBox={`0 0 ${w} ${h}`} className="max-h-full max-w-full" preserveAspectRatio="xMidYMid meet">
            {objectUrl ? (
              <image href={objectUrl} width={w} height={h} preserveAspectRatio="none" />
            ) : (
              <SyntheticBackground w={w} h={h} />
            )}
            {showOverlays &&
              spatial.map((s) => {
                const b = s.bounding_box;
                const active = activeNodeId === s.equipment_tag;
                const isHover = hover === s.equipment_tag;
                const stroke = active ? "var(--secondary)" : isHover ? "var(--primary)" : "#ffffff";
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
                      fill={active ? "rgba(234,179,8,0.25)" : isHover ? "rgba(6,182,212,0.2)" : "rgba(255,255,255,0.03)"}
                      stroke={stroke}
                      strokeWidth={active || isHover ? 3 : 1.5}
                      strokeDasharray={active || isHover ? "0" : "6 4"}
                      rx={4}
                      className="transition-all duration-200"
                    />
                    <text x={b.x_min} y={b.y_min - 6} fontSize={16} fontFamily="monospace" fill={stroke}>
                      {s.equipment_tag}
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

function SyntheticBackground({ w, h }: { w: number; h: number }) {
  return (
    <>
      <rect x={0} y={0} width={w} height={h} fill="#0d1220" />
      <defs>
        <pattern id="bp-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1f2937" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="url(#bp-grid)" />
      <line x1={0} y1={h * 0.4} x2={w} y2={h * 0.4} stroke="#233044" strokeWidth="4" />
      <line x1={w * 0.55} y1={0} x2={w * 0.55} y2={h} stroke="#233044" strokeWidth="4" />
    </>
  );
}
