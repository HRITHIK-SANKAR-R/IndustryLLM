"use client";

import BlueprintCanvas from "@/components/BlueprintCanvas";
import OmniGraph3D from "@/components/OmniGraph3D";
import IntelligenceDrawer from "@/components/IntelligenceDrawer";

export default function GraphPage() {
  return (
    <div className="relative flex h-full w-full flex-col md:flex-row">
      {/* 50/50 Split View */}
      
      {/* Left Pane - Blueprint */}
      <div className="h-1/2 w-full md:h-full md:w-1/2 border-b md:border-b-0 md:border-r border-[var(--border)]">
        <BlueprintCanvas />
      </div>

      {/* Right Pane - 3D Graph */}
      <div className="h-1/2 w-full md:h-full md:w-1/2">
        <OmniGraph3D />
      </div>

      {/* Slide-out Intelligence Drawer */}
      <IntelligenceDrawer />
    </div>
  );
}
