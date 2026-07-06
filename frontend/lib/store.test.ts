import { beforeEach, describe, expect, it } from "vitest";
import { normalizeTag, useStore } from "./store";

describe("normalizeTag", () => {
  it("strips the C- coordinate prefix", () => {
    expect(normalizeTag("C-V-104")).toBe("V-104");
  });
  it("leaves equipment tags untouched", () => {
    expect(normalizeTag("V-104")).toBe("V-104");
  });
  it("passes null through", () => {
    expect(normalizeTag(null)).toBeNull();
  });
});

describe("store", () => {
  beforeEach(() => useStore.getState().reset());

  it("normalizes coordinate ids when selecting a node", () => {
    useStore.getState().setActiveNode("C-P-201A");
    expect(useStore.getState().activeNodeId).toBe("P-201A");
  });

  it("toggles mock mode", () => {
    const before = useStore.getState().mockMode;
    useStore.getState().toggleMock();
    expect(useStore.getState().mockMode).toBe(!before);
  });

  it("reset clears graph and selection", () => {
    useStore.getState().setActiveNode("V-104");
    useStore.getState().setGraph({
      nodes: [{ id: "V-104", group: "Equipment", label: "Valve", val: 1 }],
      links: [],
    });
    useStore.getState().reset();
    expect(useStore.getState().activeNodeId).toBeNull();
    expect(useStore.getState().graph.nodes).toHaveLength(0);
  });
});
