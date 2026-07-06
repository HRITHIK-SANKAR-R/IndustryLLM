"use client";

import { Navbar } from "@/components/Navbar";
import { MockBanner } from "@/components/MockBanner";
import { IngestPanel } from "@/components/IngestPanel";
import { SchematicViewer } from "@/components/SchematicViewer";
import { GraphEngine } from "@/components/GraphEngine";
import { ContextDrawer } from "@/components/ContextDrawer";
import { useOmniGraph } from "@/lib/useOmniGraph";

export default function Home() {
  // Initializes health check + context/ingest wiring for the whole app.
  useOmniGraph();

  return (
    <div className="h-full flex flex-col">
      <Navbar />
      <MockBanner />

      <div className="flex-1 min-h-0 flex">
        {/* Left sidebar: ingestion command center */}
        <aside className="w-80 shrink-0 border-r border-border bg-surface overflow-y-auto thin-scroll">
          <IngestPanel />
        </aside>

        {/* Main: 2D schematic (top) + 3D graph (bottom), context drawer overlay */}
        <main className="relative flex-1 min-w-0 flex flex-col">
          <div className="h-1/2 min-h-0">
            <SchematicViewer />
          </div>
          <div className="h-1/2 min-h-0">
            <GraphEngine />
          </div>
          <ContextDrawer />
        </main>
      </div>
    </div>
  );
}
