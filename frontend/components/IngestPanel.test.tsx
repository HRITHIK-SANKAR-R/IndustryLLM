import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IngestPanel } from "./IngestPanel";
import { useStore } from "@/lib/store";

vi.mock("@/lib/api", () => ({
  fetchHealth: vi.fn().mockResolvedValue({
    status: "ok",
    worker: false,
    mock_only: true,
  }),
  ingest: vi.fn().mockResolvedValue(undefined),
  fetchLogs: vi.fn().mockResolvedValue([{ tag: "SYS", msg: "Graph built." }]),
  fetchGraph: vi.fn().mockResolvedValue({
    nodes: [
      { id: "V-104", group: "Equipment", label: "Valve", val: 1 },
      { id: "R-1", group: "Rule", label: "Torque 45Nm", val: 1 },
    ],
    links: [],
  }),
  fetchSpatial: vi.fn().mockResolvedValue([]),
  fetchContext: vi.fn().mockResolvedValue(null),
}));

afterEach(cleanup);
beforeEach(() => useStore.getState().reset());

describe("IngestPanel", () => {
  it("running the golden-dataset demo drives status to READY and updates metrics", async () => {
    const user = userEvent.setup();
    render(<IngestPanel />);

    await user.click(
      screen.getByRole("button", { name: /Run Demo \(Golden Dataset\)/i })
    );

    await waitFor(() =>
      expect(useStore.getState().appStatus).toBe("READY")
    );

    expect(useStore.getState().graph.nodes).toHaveLength(2);
    await waitFor(() => {
      // Equipment=1 and Rules=1 badges both read "1".
      expect(screen.getAllByText("1")).toHaveLength(2);
    });
  });

  it("disables the button while processing", () => {
    render(<IngestPanel />);
    const btn = screen.getByRole("button", { name: /Run Demo/i });
    // fireEvent is synchronous: the handler flips to PROCESSING and suspends
    // at `await ingest(...)` before this call returns, regardless of how
    // fast the mocked promise resolves.
    fireEvent.click(btn);
    expect(useStore.getState().appStatus).toBe("PROCESSING");
  });
});
