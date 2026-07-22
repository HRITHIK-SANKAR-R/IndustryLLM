"use client";

import { useAppStore } from "@/store/useAppStore";
import { X, AlertTriangle, BookOpen, Link as LinkIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

// Mock Data fetching based on activeNodeId
const fetchNodeDetails = (id: string) => {
  return {
    id,
    title: id === "V-104" ? "CENTRIFUGAL PUMP - P-201A" : `Asset ${id}`,
    status: "Online / Compliance Verified",
    rules: ["OSHA Standard 1910.119 - Mechanical Integrity"],
    procedure: "Ensure the primary isolation valve is secured before proceeding. The exact torque specification for the flange bolts on V-104 is 125 Nm.",
    highlightKeyword: "125 Nm",
    linkedAssets: ["Valve V-10", "Chiller C-1", "Tank T-44"]
  };
};

export default function IntelligenceDrawer() {
  const { activeNodeId, setActiveNodeId } = useAppStore();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (activeNodeId) {
      setData(fetchNodeDetails(activeNodeId));
    }
  }, [activeNodeId]);

  return (
    <AnimatePresence>
      {activeNodeId && data && (
        <>
          {/* Mobile Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setActiveNodeId(null)}
          />

          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 flex h-[80vh] flex-col border-t border-[var(--border)] bg-[var(--surface)] shadow-2xl md:bottom-auto md:left-auto md:top-16 md:h-[calc(100vh-64px)] md:w-[400px] md:border-l md:border-t-0"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--text)]">{data.title}</h2>
                <div className="mt-1 flex items-center gap-2 text-xs text-emerald-500">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {data.status}
                </div>
              </div>
              <button
                onClick={() => setActiveNodeId(null)}
                className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content (Staggered Children) */}
            <div className="thin-scroll flex-1 overflow-y-auto p-4">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: { staggerChildren: 0.1 }
                  }
                }}
                className="space-y-6"
              >
                {/* Rules Section */}
                <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--secondary)]">
                    <AlertTriangle className="h-4 w-4" /> Regulatory Rules
                  </div>
                  <div className="hypr-left-border rounded-r-md border border-l-[var(--secondary)] border-[var(--border)] bg-[var(--bg)] p-3 text-sm text-[var(--text)]">
                    {data.rules.map((rule: string, i: number) => (
                      <p key={i}>{rule}</p>
                    ))}
                  </div>
                </motion.div>

                {/* Procedure Section */}
                <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--tertiary)]">
                    <BookOpen className="h-4 w-4" /> Extracted Procedure
                  </div>
                  <div className="hypr-left-border rounded-r-md border border-l-[var(--tertiary)] border-[var(--border)] bg-[var(--bg)] p-4 font-mono text-sm leading-relaxed text-[var(--muted)]">
                    {data.procedure.split(data.highlightKeyword).map((part: string, i: number, arr: any[]) => (
                      <span key={i}>
                        {part}
                        {i !== arr.length - 1 && (
                          <span className="bg-[var(--tertiary)] px-1 font-bold text-white">
                            {data.highlightKeyword}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </motion.div>

                {/* Linked Assets */}
                <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--primary)]">
                    <LinkIcon className="h-4 w-4" /> Linked Assets
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.linkedAssets.map((asset: string, i: number) => (
                      <button
                        key={i}
                        className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-xs text-[var(--text)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                      >
                        {asset}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
