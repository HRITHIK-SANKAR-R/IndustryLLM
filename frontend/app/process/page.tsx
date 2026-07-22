"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Terminal, ShieldCheck, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { useOmniGraph } from "@/lib/useOmniGraph";

export default function ProcessPage() {
  const router = useRouter();
  const { runIngest } = useOmniGraph();
  const manual = useStore((s) => s.manual);
  const schematic = useStore((s) => s.schematic);
  const mockMode = useStore((s) => s.mockMode);
  const appStatus = useStore((s) => s.appStatus);
  const logs = useStore((s) => s.logs);

  const [shown, setShown] = useState(0);
  const startedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Kick off the real ingest exactly once. If nothing to ingest and mock
  // mode is off, there's nothing this page can do — bounce back to /ingest.
  useEffect(() => {
    if (startedRef.current) return;
    if (!manual && !schematic && !mockMode) {
      router.replace("/ingest");
      return;
    }
    startedRef.current = true;
    runIngest(manual, schematic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reveal real log lines one at a time for the "typing" effect.
  useEffect(() => {
    if (shown >= logs.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), 400);
    return () => clearTimeout(t);
  }, [shown, logs.length]);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [shown]);

  const revealed = shown >= logs.length;
  const isComplete = appStatus === "READY" && revealed && logs.length > 0;
  const isError = appStatus === "ERROR";

  useEffect(() => {
    if (!isComplete) return;
    const t = setTimeout(() => router.push("/graph"), 1200);
    return () => clearTimeout(t);
  }, [isComplete, router]);

  return (
    <div className="flex h-full w-full flex-col md:flex-row">
      {/* Left Pane - Blueprint Scan */}
      <div className="relative h-1/2 w-full border-b border-[var(--border)] bg-[var(--surface)] p-6 md:h-full md:w-1/2 md:border-r md:border-b-0">
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg)] relative">
          <div className="absolute inset-0 opacity-20 flex items-center justify-center">
            <div className="w-[80%] h-[80%] border-2 border-[var(--primary)] border-dashed grid grid-cols-4 grid-rows-4 gap-2">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="border border-[var(--primary)]/30 rounded-sm" />
              ))}
            </div>
          </div>
          {!isError && (
            <div className="scanline absolute inset-x-0 h-1 bg-[var(--primary)] shadow-[0_0_20px_var(--primary)]" />
          )}
        </div>
      </div>

      {/* Right Pane - Terminal */}
      <div className="flex h-1/2 w-full flex-col bg-[#050505] p-6 md:h-full md:w-1/2">
        <div className="mb-4 flex items-center gap-2 border-b border-[#27272A] pb-2 text-sm text-[#A1A1AA]">
          <Terminal className="h-4 w-4" />
          <span>Processing Terminal (tty1)</span>
        </div>

        <div ref={containerRef} className="thin-scroll flex-1 overflow-y-auto font-mono text-sm leading-relaxed">
          {logs.length === 0 && (
            <div className="text-[#A1A1AA]">
              <span className="mr-2 text-[#06B6D4]">{">"}</span>
              {mockMode ? "[SYS] Replaying Golden Dataset..." : "[SYS] Initializing ingestion pipeline..."}
            </div>
          )}
          {logs.slice(0, shown).map((l, index) => (
            <div key={index} className={`mb-1 ${/error/i.test(l.tag) ? "text-red-400 font-bold" : "text-[#A1A1AA]"}`}>
              <span className="mr-2 text-[#06B6D4]">{">"}</span>
              [{l.tag}] {l.msg}
            </div>
          ))}
          {!revealed && logs.length > 0 && <div className="pulse-dot inline-block h-3 w-2 bg-[#06B6D4]" />}
        </div>

        {isComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-400"
          >
            <ShieldCheck className="h-5 w-5" />
            <span className="font-bold">200 OK: Knowledge Graph Synchronized</span>
          </motion.div>
        )}

        {isError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 flex flex-col gap-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-red-400"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-bold">Ingestion failed — see toast for details</span>
            </div>
            <button
              onClick={() => router.push("/ingest")}
              className="self-start rounded-md border border-red-400/50 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/10"
            >
              Back to Ingest
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
