"use client";

import { useStore } from "@/lib/store";

// Turns a Wi-Fi failure into a feature: "Air-Gapped Local Network Capability".
export function MockBanner() {
  const mockMode = useStore((s) => s.mockMode);
  if (!mockMode) return null;
  return (
    <div className="shrink-0 h-7 flex items-center justify-center gap-2 text-[11px] font-mono bg-warning/10 text-warning border-b border-warning/30">
      <span className="h-1.5 w-1.5 rounded-full bg-warning pulse-dot" />
      [!] Edge-Compute Mode Active · External APIs decoupled · Operating on local
      cache
    </div>
  );
}
