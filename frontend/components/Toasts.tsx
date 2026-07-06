"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import type { Toast } from "@/lib/types";

const DISMISS_MS = 4000;

// Bottom-center success/error toasts (uiux.md §8.4).
export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismissToast = useStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, DISMISS_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  const isSuccess = toast.kind === "success";
  return (
    <div
      role="status"
      className="toast-rise pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-2xl backdrop-blur"
      style={{
        borderColor: isSuccess ? "#10B98155" : "#EF444455",
        background: isSuccess ? "#10B9811a" : "#EF44441a",
        color: isSuccess ? "#10B981" : "#EF4444",
      }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "currentColor" }} />
      {toast.message}
    </div>
  );
}
