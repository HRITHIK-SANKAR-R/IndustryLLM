import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toasts } from "./Toasts";
import { useStore } from "@/lib/store";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => useStore.getState().reset());

describe("Toasts", () => {
  it("renders nothing when there are no toasts", () => {
    const { container } = render(<Toasts />);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("renders success and error toasts with their messages", () => {
    useStore.getState().pushToast("success", "Ontology successfully generated in 1.4s");
    useStore.getState().pushToast("error", "Ingestion failed: network error");

    render(<Toasts />);
    expect(
      screen.getByText("Ontology successfully generated in 1.4s")
    ).toBeInTheDocument();
    expect(screen.getByText("Ingestion failed: network error")).toBeInTheDocument();
  });

  it("auto-dismisses a toast after its timeout", () => {
    vi.useFakeTimers();
    useStore.getState().pushToast("success", "will vanish");
    render(<Toasts />);
    expect(screen.getByText("will vanish")).toBeInTheDocument();

    vi.advanceTimersByTime(4001);
    expect(useStore.getState().toasts).toHaveLength(0);
  });
});
