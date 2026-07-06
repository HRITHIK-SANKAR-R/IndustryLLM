"use client";

import { useStore } from "@/lib/store";

export function Navbar() {
  const appStatus = useStore((s) => s.appStatus);
  const workerOnline = useStore((s) => s.workerOnline);
  const mockMode = useStore((s) => s.mockMode);
  const toggleMock = useStore((s) => s.toggleMock);
  const graph = useStore((s) => s.graph);

  const online = appStatus !== "ERROR";
  const dotColor = appStatus === "ERROR" ? "bg-danger" : "bg-success";

  return (
    <header className="h-16 shrink-0 border-b border-border bg-surface flex items-center px-5 gap-6">
      {/* Logo + status */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-lg font-semibold tracking-tight text-accent">
          OMNI<span className="text-text">-GRAPH</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className={`h-2 w-2 rounded-full ${dotColor} pulse-dot`} />
          {online ? "System Online" : "System Error"}
        </span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <SearchBox />
      </div>

      {/* Metrics + mock toggle */}
      <div className="ml-auto flex items-center gap-4 text-xs font-mono text-muted">
        <span>
          Nodes <span className="text-text">{graph.nodes.length}</span>
        </span>
        <span>
          Edges <span className="text-text">{graph.links.length}</span>
        </span>
        <span className="flex items-center gap-1.5">
          Worker{" "}
          <span className={workerOnline ? "text-success" : "text-muted"}>
            {workerOnline ? "up" : "off"}
          </span>
        </span>
        <button
          onClick={toggleMock}
          className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
            mockMode
              ? "border-warning/50 bg-warning/10 text-warning"
              : "border-border text-muted hover:text-text"
          }`}
          title="Toggle Edge-Compute (Mock) Mode"
        >
          Mock {mockMode ? "ON" : "OFF"}
        </button>
      </div>
    </header>
  );
}

function SearchBox() {
  const graph = useStore((s) => s.graph);
  const setActiveNode = useStore((s) => s.setActiveNode);
  return (
    <>
      <input
        list="omni-tags"
        placeholder="Search equipment tag  ·  e.g. V-104"
        className="w-full bg-bg border border-border rounded-md px-3 py-1.5 text-sm font-mono text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        onChange={(e) => {
          const v = e.target.value.trim();
          if (graph.nodes.some((n) => n.id === v)) setActiveNode(v);
        }}
      />
      <datalist id="omni-tags">
        {graph.nodes
          .filter((n) => n.group === "Equipment")
          .map((n) => (
            <option key={n.id} value={n.id} />
          ))}
      </datalist>
    </>
  );
}
