import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchContext, fetchLogs, ingest } from "./api";

afterEach(() => vi.restoreAllMocks());

function mockFetch(impl: (url: string, init?: RequestInit) => Response) {
  vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) =>
    Promise.resolve(impl(url, init))
  ));
}

describe("fetchContext", () => {
  it("encodes the tag and parses json", async () => {
    let seen = "";
    mockFetch((url) => {
      seen = url;
      return new Response(JSON.stringify({ equipment_tag: "V-104" }), { status: 200 });
    });
    const ctx = await fetchContext("V-104");
    expect(ctx.equipment_tag).toBe("V-104");
    expect(seen).toContain("/api/v1/node/V-104/context");
  });

  it("throws on non-200", async () => {
    mockFetch(() => new Response("nope", { status: 404 }));
    await expect(fetchContext("X")).rejects.toThrow(/404/);
  });
});

describe("fetchLogs", () => {
  it("returns [] when logs missing", async () => {
    mockFetch(() => new Response(JSON.stringify({}), { status: 200 }));
    expect(await fetchLogs()).toEqual([]);
  });
});

describe("ingest", () => {
  it("sets mock header when mock=true", async () => {
    let headers: HeadersInit | undefined;
    mockFetch((_url, init) => {
      headers = init?.headers;
      return new Response("{}", { status: 202 });
    });
    await ingest(null, null, true);
    expect((headers as Record<string, string>)["X-Mock-Mode"]).toBe("true");
  });

  it("omits mock header when live", async () => {
    let headers: HeadersInit | undefined;
    mockFetch((_url, init) => {
      headers = init?.headers;
      return new Response("{}", { status: 202 });
    });
    await ingest(null, null, false);
    expect(headers).toBeUndefined();
  });
});
