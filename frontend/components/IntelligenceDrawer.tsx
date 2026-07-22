"use client";

import { useStore } from "@/lib/store";
import { categoryColor } from "@/lib/colors";
import { X, AlertTriangle, BookOpen, Link as LinkIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function IntelligenceDrawer() {
  const activeNodeId = useStore((s) => s.activeNodeId);
  const context = useStore((s) => s.context);
  const setActiveNode = useStore((s) => s.setActiveNode);
  const open = activeNodeId != null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setActiveNode(null)}
          />

          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 flex h-[80vh] flex-col border-t border-[var(--border)] bg-[var(--surface)] shadow-2xl md:bottom-auto md:left-auto md:top-16 md:h-[calc(100vh-64px)] md:w-[400px] md:border-l md:border-t-0"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
              <div>
                <p className="font-mono text-xs text-[var(--muted)]">{activeNodeId}</p>
                <h2 className="text-lg font-bold text-[var(--text)]">
                  {context?.name ?? "Loading…"}
                </h2>
                {context?.system && (
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{context.system}</p>
                )}
              </div>
              <button
                onClick={() => setActiveNode(null)}
                className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--text)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="thin-scroll flex-1 overflow-y-auto p-4">
              {!context ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="skeleton h-16 rounded-md" />
                  ))}
                </div>
              ) : (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }}
                  className="space-y-6"
                >
                  {context.spatial_coordinates && (
                    <Section title="Spatial Location">
                      <p className="font-mono text-xs text-[var(--muted)]">
                        [{context.spatial_coordinates.x_min}, {context.spatial_coordinates.y_min}] → [
                        {context.spatial_coordinates.x_max}, {context.spatial_coordinates.y_max}]
                      </p>
                    </Section>
                  )}

                  <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--secondary)]">
                      <AlertTriangle className="h-4 w-4" /> Associated Rules
                    </div>
                    {context.associated_rules.length === 0 ? (
                      <p className="text-xs text-[var(--muted)]">No rules linked.</p>
                    ) : (
                      <div className="space-y-3">
                        {context.associated_rules.map((r, i) => (
                          <div
                            key={i}
                            className="rounded-md border p-3"
                            style={{ borderColor: categoryColor(r.category) + "55", background: categoryColor(r.category) + "0d" }}
                          >
                            <span
                              className="text-[10px] font-medium uppercase tracking-wider"
                              style={{ color: categoryColor(r.category) }}
                            >
                              {r.category}
                            </span>
                            <p className="mt-1 text-sm text-[var(--text)]">{r.description}</p>
                            {r.audit_trail && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-[11px] text-[var(--muted)] hover:text-[var(--text)]">
                                  Audit trail · source paragraph
                                </summary>
                                <p className="mt-1 border-l-2 border-[var(--primary)] pl-2 font-mono text-[11px] leading-relaxed text-[var(--muted)]">
                                  {r.audit_trail}
                                </p>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>

                  {context.linked_assets.length > 0 && (
                    <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--primary)]">
                        <LinkIcon className="h-4 w-4" /> Linked Assets
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {context.linked_assets.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => setActiveNode(tag)}
                            className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-xs text-[var(--text)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--tertiary)]">
        <BookOpen className="h-4 w-4" /> {title}
      </div>
      <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">{children}</div>
    </motion.div>
  );
}
