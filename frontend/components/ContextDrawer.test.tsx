import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ContextDrawer } from "./ContextDrawer";
import { useStore } from "@/lib/store";

afterEach(cleanup);

beforeEach(() => useStore.getState().reset());

describe("ContextDrawer", () => {
  it("renders nothing when no node is selected", () => {
    const { container } = render(<ContextDrawer />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a loading skeleton while context is pending", () => {
    useStore.getState().setActiveNode("V-104");
    const { container } = render(<ContextDrawer />);
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
  });

  it("renders rules, audit trail, and linked assets once context arrives", () => {
    useStore.getState().setActiveNode("V-104");
    useStore.getState().setContext({
      equipment_tag: "V-104",
      name: "Gate Valve",
      system: "Cooling Water System",
      spatial_coordinates: { x_min: 240, y_min: 512, x_max: 280, y_max: 540 },
      associated_rules: [
        {
          category: "Safety",
          description: "Must be locked out before downstream pipe removal.",
          audit_trail: "Prior to any pipe maintenance...",
        },
      ],
      linked_assets: ["P-201A"],
    });

    render(<ContextDrawer />);

    expect(screen.getByText("Gate Valve")).toBeInTheDocument();
    expect(screen.getByText("Cooling Water System")).toBeInTheDocument();
    expect(
      screen.getByText("Must be locked out before downstream pipe removal.")
    ).toBeInTheDocument();
    expect(screen.getByText("Prior to any pipe maintenance...")).toBeInTheDocument();
    expect(screen.getByText("P-201A")).toBeInTheDocument();
  });

  it("clicking a linked asset navigates the drawer to it", async () => {
    const user = userEvent.setup();
    useStore.getState().setActiveNode("V-104");
    useStore.getState().setContext({
      equipment_tag: "V-104",
      name: "Gate Valve",
      system: "",
      spatial_coordinates: null,
      associated_rules: [],
      linked_assets: ["P-201A"],
    });

    render(<ContextDrawer />);
    await user.click(screen.getByText("P-201A"));

    expect(useStore.getState().activeNodeId).toBe("P-201A");
  });

  it("closes the drawer via the close button", async () => {
    const user = userEvent.setup();
    useStore.getState().setActiveNode("V-104");
    render(<ContextDrawer />);
    await user.click(screen.getByText("✕"));
    expect(useStore.getState().activeNodeId).toBeNull();
  });
});
