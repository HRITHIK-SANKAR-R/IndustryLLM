import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SchematicViewer } from "./SchematicViewer";
import { useStore } from "@/lib/store";

afterEach(cleanup);

beforeEach(() => {
  useStore.getState().reset();
  useStore.getState().setSpatial([
    {
      equipment_tag: "V-104",
      confidence: 0.94,
      bounding_box: { x_min: 240, y_min: 512, x_max: 280, y_max: 540 },
    },
  ]);
});

describe("SchematicViewer", () => {
  it("shows a placeholder before ingestion", () => {
    useStore.getState().reset();
    render(<SchematicViewer />);
    expect(screen.getByText(/Awaiting schematic ingestion/i)).toBeInTheDocument();
  });

  it("renders a bounding box per spatial hit", () => {
    render(<SchematicViewer />);
    expect(screen.getByText("V-104")).toBeInTheDocument();
  });

  it("clicking a bounding box sets activeNodeId and turns it active/red", async () => {
    const user = userEvent.setup();
    render(<SchematicViewer />);
    await user.click(screen.getByText("V-104"));

    expect(useStore.getState().activeNodeId).toBe("V-104");
    const rect = document.querySelector("rect[stroke='#EF4444']");
    expect(rect).not.toBeNull();
  });
});
