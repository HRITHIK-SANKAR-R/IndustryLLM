import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement scrollIntoView; IngestPanel's terminal auto-scroll calls it.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom doesn't implement ResizeObserver; GraphEngine sizes its canvas with it.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
