import { describe, expect, it, vi } from "vitest";
import {
  createDisableDraftModeHandler,
  createEnableDraftModeHandler,
  safeReturnPath,
} from "./draft-mode";
import type { DraftModeConfig, EnableDraftModeDeps } from "./draft-mode";

const configured: DraftModeConfig = {
  projectId: "abc123xy",
  dataset: "development",
  apiVersion: "2025-02-19",
  readToken: "test-only-read-token-not-real",
};

/**
 * A Sanity client double. `next-sanity` validates the preview secret by querying the dataset for
 * a secret document (`client.fetch`); `secretDocument` is what the dataset holds.
 */
function fakeClient(secretDocument: { secret: string } | null) {
  const client = {
    config: () => ({ token: configured.readToken }),
    withConfig: () => client,
    fetch: vi.fn().mockResolvedValue({
      private: secretDocument
        ? {
            _id: "secret",
            _updatedAt: "2026-01-01T00:00:00Z",
            studioUrl: "https://studio.invalid",
            ...secretDocument,
          }
        : null,
      public: null,
    }),
  };
  return client;
}

const deps = (
  config: DraftModeConfig,
  secretDocument: { secret: string } | null,
): EnableDraftModeDeps => ({
  getConfig: () => config,
  createClient: () => fakeClient(secretDocument) as never,
});

const request = (query: string) =>
  new Request(`https://example.invalid/api/draft-mode/enable${query}`);

describe("enable draft mode", () => {
  it("rejects a wrong secret with 401 and no cookie", async () => {
    const handler = createEnableDraftModeHandler(deps(configured, { secret: "the-real-secret" }));
    const response = await handler(request("?sanity-preview-secret=guessed-secret"));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.text()).toBe("Invalid secret");
  });

  it("rejects a missing secret with 401", async () => {
    const handler = createEnableDraftModeHandler(deps(configured, { secret: "the-real-secret" }));
    expect((await handler(request(""))).status).toBe(401);
  });

  it("rejects a secret when the dataset holds none", async () => {
    const handler = createEnableDraftModeHandler(deps(configured, null));
    expect((await handler(request("?sanity-preview-secret=anything"))).status).toBe(401);
  });

  it("does not enable anything when Sanity or the read token is not configured", async () => {
    for (const missing of [{ projectId: undefined }, { readToken: undefined }]) {
      const createClient = vi.fn();
      const handler = createEnableDraftModeHandler({
        getConfig: () => ({ ...configured, ...missing }),
        createClient,
      });
      const response = await handler(request("?sanity-preview-secret=whatever"));
      expect(response.status).toBe(503);
      expect(createClient).not.toHaveBeenCalled();
    }
  });

  it("passes the validated client to next-sanity and returns its response with no-store", async () => {
    const define = vi.fn(() => ({ GET: () => Promise.resolve(new Response("ok")) }));
    const createClient = vi.fn(() => fakeClient(null) as never);
    const handler = createEnableDraftModeHandler({
      getConfig: () => configured,
      createClient,
      define,
    });
    const response = await handler(request("?sanity-preview-secret=x"));
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(createClient).toHaveBeenCalledWith(configured);
    expect(define).toHaveBeenCalledOnce();
  });
});

describe("disable draft mode", () => {
  const call = async (method: "POST" | "GET", query = "") => {
    const disable = vi.fn().mockResolvedValue(undefined);
    const handler = createDisableDraftModeHandler({ disable });
    const response = await handler[method](
      new Request(`https://example.invalid/api/draft-mode/disable${query}`, { method }),
    );
    return { response, disable };
  };

  it("answers a POST with 303 so the browser follows with GET, after disabling", async () => {
    const { response, disable } = await call("POST");
    expect(disable).toHaveBeenCalledOnce();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
  });

  it("answers a GET with 307", async () => {
    const { response, disable } = await call("GET", "?redirect=/what-we-do");
    expect(disable).toHaveBeenCalledOnce();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/what-we-do");
  });

  it("never redirects off-site", async () => {
    for (const target of ["https://evil.invalid", "//evil.invalid", "/\\evil.invalid"]) {
      const { response } = await call("POST", `?redirect=${encodeURIComponent(target)}`);
      expect(response.headers.get("location")).toBe("/");
    }
  });
});

describe("safeReturnPath", () => {
  it("keeps same-site paths", () => {
    expect(safeReturnPath("/what-we-do")).toBe("/what-we-do");
    expect(safeReturnPath("/contact?intent=ai")).toBe("/contact?intent=ai");
  });

  it("sends anything else home", () => {
    for (const value of [
      null,
      "",
      "https://evil.invalid",
      "//evil.invalid",
      "/\\evil.invalid",
      "javascript:alert(1)",
      "/\t/evil.invalid",
    ]) {
      expect(safeReturnPath(value)).toBe("/");
    }
  });
});
