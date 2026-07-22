"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import BlueprintCanvas from "@/components/BlueprintCanvas";
import OmniGraph3D from "@/components/OmniGraph3D";
import IntelligenceDrawer from "@/components/IntelligenceDrawer";

export default function GraphPage() {
  const router = useRouter();
  const appStatus = useStore((s) => s.appStatus);
  const nodeCount = useStore((s) => s.graph.nodes.length);

  useEffect(() => {
    if (nodeCount === 0 && appStatus !== "PROCESSING") {
      router.replace("/ingest");
    }
  }, [nodeCount, appStatus, router]);

  return (
    <div className="relative flex h-full w-full flex-col md:flex-row">
      <div className="h-1/2 w-full md:h-full md:w-1/2 border-b md:border-b-0 md:border-r border-[var(--border)]">
        <BlueprintCanvas />
      </div>

      <div className="h-1/2 w-full md:h-full md:w-1/2">
        <OmniGraph3D />
      </div>

      <IntelligenceDrawer />
    </div>
  );
}
