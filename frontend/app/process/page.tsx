"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Terminal, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

const LOGS = [
  "[SYS] Initializing Ingestion Pipeline...",
  "[GROQ] Chunking PDF... Sending Payload...",
  "[GROQ] Received JSON. Extracted 42 Entities.",
  "[NVIDIA] Processing Schematic Vision...",
  "[NVIDIA] Bounding Boxes mapped.",
  "[NEO4J] Injecting 156 nodes and 312 edges...",
  "[SYS] Graph Generation Complete in 1.24s."
];

export default function ProcessPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let currentLog = 0;
    
    const interval = setInterval(() => {
      if (currentLog < LOGS.length) {
        setLogs(prev => [...prev, LOGS[currentLog]]);
        currentLog++;
        
        // Auto-scroll
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      } else {
        clearInterval(interval);
        setIsComplete(true);
        setTimeout(() => {
          router.push("/graph");
        }, 1500); // Wait a bit before redirecting
      }
    }, 400); // 400ms per log line for dramatic effect

    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="flex h-full w-full flex-col md:flex-row">
      {/* Left Pane - Blueprint Scan */}
      <div className="relative h-1/2 w-full border-b border-[var(--border)] bg-[var(--surface)] p-6 md:h-full md:w-1/2 md:border-r md:border-b-0">
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg)] relative">
          
          {/* Fake blueprint image (wireframe) */}
          <div className="absolute inset-0 opacity-20 flex items-center justify-center">
            <div className="w-[80%] h-[80%] border-2 border-[var(--primary)] border-dashed grid grid-cols-4 grid-rows-4 gap-2">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="border border-[var(--primary)]/30 rounded-sm" />
              ))}
            </div>
          </div>

          {/* Scanner Line */}
          <div className="scanline absolute inset-x-0 h-1 bg-[var(--primary)] shadow-[0_0_20px_var(--primary)]" />
        </div>
      </div>

      {/* Right Pane - Terminal */}
      <div className="flex h-1/2 w-full flex-col bg-[#050505] p-6 md:h-full md:w-1/2">
        <div className="mb-4 flex items-center gap-2 border-b border-[#27272A] pb-2 text-sm text-[#A1A1AA]">
          <Terminal className="h-4 w-4" />
          <span>Processing Terminal (tty1)</span>
        </div>
        
        <div 
          ref={containerRef}
          className="thin-scroll flex-1 overflow-y-auto font-mono text-sm leading-relaxed"
        >
          {logs.map((log, index) => (
            <div 
              key={index}
              className={`mb-1 ${log.includes("Complete") ? "text-emerald-400 font-bold" : "text-[#A1A1AA]"}`}
            >
              <span className="mr-2 text-[#06B6D4]">{'>'}</span> 
              {log}
            </div>
          ))}
          {!isComplete && (
            <div className="pulse-dot inline-block h-3 w-2 bg-[#06B6D4]" />
          )}
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: isComplete ? 1 : 0 }}
          className="mt-4 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-400"
        >
          <ShieldCheck className="h-5 w-5" />
          <span className="font-bold">200 OK: Knowledge Graph Synchronized</span>
        </motion.div>
      </div>
    </div>
  );
}
