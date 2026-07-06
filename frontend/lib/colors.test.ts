import { describe, expect, it } from "vitest";
import { COLORS, categoryColor, nodeColor } from "./colors";

describe("nodeColor", () => {
  it("maps groups to design tokens", () => {
    expect(nodeColor("Equipment")).toBe(COLORS.accent);
    expect(nodeColor("Rule")).toBe(COLORS.warning);
    expect(nodeColor("Coordinate")).toBe(COLORS.success);
  });
});

describe("categoryColor", () => {
  it("flags safety/compliance as danger", () => {
    expect(categoryColor("Safety")).toBe(COLORS.danger);
    expect(categoryColor("Compliance")).toBe(COLORS.danger);
  });
  it("flags maintenance as warning", () => {
    expect(categoryColor("Maintenance")).toBe(COLORS.warning);
  });
  it("defaults to accent", () => {
    expect(categoryColor("Operational")).toBe(COLORS.accent);
  });
});
