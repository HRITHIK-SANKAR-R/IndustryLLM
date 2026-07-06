"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useOmniGraph } from "@/lib/useOmniGraph";

export function IngestPanel() {
  const appStatus = useStore((s) => s.appStatus);
  const mockMode = useStore((s) => s.mockMode);
  const { runIngest } = useOmniGraph();
  const [manual, setManual] = useState<File | null>(null);
  const [schematic, setSchematic] = useState<File | null>(null);

  const processing = appStatus === "PROCESSING";
  const canRun = mockMode || manual || schematic;

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Ingestion Hub
        </h2>
      </div>

      <Dropzone
        label="Text Manual (PDF)"
        accept=".pdf"
        file={manual}
        onFile={setManual}
      />
      <Dropzone
        label="Spatial Schematic (PNG/JPG)"
        accept="image/*"
        file={schematic}
        onFile={setSchematic}
      />

      <button
        disabled={processing || !canRun}
        onClick={() => runIngest(manual, schematic)}
        className={`w-full py-2.5 rounded-md text-sm font-medium transition-colors ${
          processing
            ? "bg-accent/30 text-muted cursor-wait"
            : canRun
              ? "bg-accent text-white hover:bg-accent/90"
              : "bg-border text-muted cursor-not-allowed"
        }`}
      >
        {processing
          ? "Building Ontology…"
          : mockMode
            ? "Run Demo (Golden Dataset)"
            : "Ingest & Build Graph"}
      </button>

      <Terminal />
      <Metrics />
    </div>
  );
}

function Dropzone({
  label,
  accept,
  file,
  onFile,
}: {
  label: string;
  accept: string;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`cursor-pointer rounded-lg border-2 border-dashed px-3 py-3 text-center transition-colors ${
        over
          ? "border-accent bg-accent/10"
          : file
            ? "border-success/50 bg-success/5"
            : "border-border hover:border-accent/60"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xs font-mono truncate text-text">
        {file ? file.name : "Drag & drop or click"}
      </p>
    </div>
  );
}

// Terminal wrapper: remount on each new log batch (via key) so the reveal
// animation restarts cleanly without syncing state inside an effect.
function Terminal() {
  const logs = useStore((s) => s.logs);
  const appStatus = useStore((s) => s.appStatus);
  const batchKey = logs.length + ":" + (logs[0]?.msg ?? "");
  return <TerminalReveal key={batchKey} logs={logs} appStatus={appStatus} />;
}

function TerminalReveal({
  logs,
  appStatus,
}: {
  logs: { tag: string; msg: string }[];
  appStatus: string;
}) {
  const [shown, setShown] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shown >= logs.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), 320);
    return () => clearTimeout(t);
  }, [shown, logs.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [shown]);

  return (
    <div className="flex-1 min-h-[160px] rounded-lg border border-border bg-black/40 p-3 overflow-y-auto thin-scroll font-mono text-xs">
      {logs.length === 0 && appStatus !== "PROCESSING" && (
        <p className="text-muted">[SYS] Awaiting ingestion…</p>
      )}
      {appStatus === "PROCESSING" && logs.length === 0 && (
        <p className="text-accent">[SYS] Initializing pipeline…</p>
      )}
      {logs.slice(0, shown).map((l, i) => (
        <div key={i} className="leading-relaxed">
          <span className={tagColor(l.tag)}>[{l.tag}]</span>{" "}
          <span className="text-text/90">{l.msg}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function tagColor(tag: string): string {
  switch (tag) {
    case "GROQ":
      return "text-warning";
    case "NVIDIA":
      return "text-success";
    case "GRAPH":
    case "NEO4J":
      return "text-accent";
    case "ERR":
      return "text-danger";
    default:
      return "text-muted";
  }
}

function Metrics() {
  const graph = useStore((s) => s.graph);
  const appStatus = useStore((s) => s.appStatus);
  const equip = graph.nodes.filter((n) => n.group === "Equipment").length;
  const rules = graph.nodes.filter((n) => n.group === "Rule").length;
  return (
    <div className="grid grid-cols-3 gap-2">
      <Badge label="Equipment" value={equip} />
      <Badge label="Rules" value={rules} />
      <Badge label="Status" value={appStatus} mono />
    </div>
  );
}

function Badge({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-2 py-1.5 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-sm text-text ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </p>
    </div>
  );
}
