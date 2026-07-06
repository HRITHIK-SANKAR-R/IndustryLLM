"use client";

import { useStore } from "@/lib/store";
import { categoryColor, COLORS } from "@/lib/colors";

// ContextDrawer slides in from the right when a node is selected in any pane.
export function ContextDrawer() {
  const activeNodeId = useStore((s) => s.activeNodeId);
  const context = useStore((s) => s.context);
  const setActiveNode = useStore((s) => s.setActiveNode);
  const open = activeNodeId != null;

  if (!open) return null;

  return (
    <aside className="slide-in absolute top-0 right-0 h-full w-[400px] max-w-full z-30 border-l border-border bg-surface shadow-2xl flex flex-col">
      {/* header */}
      <div className="shrink-0 border-b border-border p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-muted">{activeNodeId}</p>
            <h3 className="text-lg font-semibold text-text">
              {context?.name ?? "Loading…"}
            </h3>
            {context?.system && (
              <p className="text-xs text-muted mt-0.5">{context.system}</p>
            )}
          </div>
          <button
            onClick={() => setActiveNode(null)}
            className="text-muted hover:text-text text-sm px-2 py-1 rounded border border-border"
          >
            ✕
          </button>
        </div>
        {context && (
          <span className="inline-flex items-center gap-1.5 mt-2 text-[11px] px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/30">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Compliance Verified
          </span>
        )}
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto thin-scroll p-4 space-y-5">
        {!context ? (
          <DrawerSkeleton />
        ) : (
          <>
            {context.spatial_coordinates && (
              <Section title="Spatial Location">
                <p className="font-mono text-xs text-muted">
                  [{context.spatial_coordinates.x_min},{" "}
                  {context.spatial_coordinates.y_min}] → [
                  {context.spatial_coordinates.x_max},{" "}
                  {context.spatial_coordinates.y_max}]
                </p>
              </Section>
            )}

            <Section title="Associated Rules">
              {context.associated_rules.length === 0 && (
                <p className="text-xs text-muted">No rules linked.</p>
              )}
              <div className="space-y-3">
                {context.associated_rules.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-md border p-3"
                    style={{
                      borderColor: categoryColor(r.category) + "55",
                      background: categoryColor(r.category) + "0d",
                    }}
                  >
                    <span
                      className="text-[10px] font-medium uppercase tracking-wider"
                      style={{ color: categoryColor(r.category) }}
                    >
                      {r.category}
                    </span>
                    <p className="text-sm text-text mt-1">{r.description}</p>
                    {r.audit_trail && (
                      <details className="mt-2">
                        <summary className="text-[11px] text-muted cursor-pointer hover:text-text">
                          Audit trail · source paragraph
                        </summary>
                        <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted border-l-2 pl-2"
                           style={{ borderColor: COLORS.accent }}>
                          {r.audit_trail}
                        </p>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            {context.linked_assets.length > 0 && (
              <Section title="Linked Assets">
                <div className="flex flex-wrap gap-2">
                  {context.linked_assets.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setActiveNode(tag)}
                      className="font-mono text-xs px-2 py-1 rounded border border-border text-accent hover:bg-accent/10"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted mb-2">
        {title}
      </h4>
      {children}
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-16 rounded-md" />
      ))}
    </div>
  );
}
