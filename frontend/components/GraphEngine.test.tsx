import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GraphEngine } from "./GraphEngine";
import { useStore } from "@/lib/store";

afterEach(cleanup);
beforeEach(() => useStore.getState().reset());

describe("GraphEngine", () => {
  it("shows the empty-ontology placeholder before ingestion", () => {
    render(<GraphEngine />);
    expect(
      screen.getByText(/Empty ontology — ingest to populate the graph/i)
    ).toBeInTheDocument();
  });

  it("shows the wireframe scanning overlay while PROCESSING, even with no nodes yet", () => {
    useStore.getState().setStatus("PROCESSING");
    render(<GraphEngine />);
    expect(
      screen.getByText(/Constructing knowledge graph/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Empty ontology — ingest to populate the graph/i)
    ).not.toBeInTheDocument();
  });
});
