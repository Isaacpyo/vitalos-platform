import { describe, expect, it, vi } from "vitest";
import { indexNowBodies, submitIndexNow } from "./indexnow";

const siteUrl = "https://www.example.invalid";

describe("indexNowBodies", () => {
  it("sends only canonical-host URLs, deduplicated, with the key location on the site", () => {
    const [body, ...rest] = indexNowBodies({
      siteUrl,
      key: "example-key-123",
      urls: [
        "https://www.example.invalid/a",
        "https://www.example.invalid/a",
        "https://vitalos-platform.vercel.app/a",
        "not a url",
      ],
    });
    expect(rest).toEqual([]);
    expect(body).toEqual({
      host: "www.example.invalid",
      key: "example-key-123",
      keyLocation: "https://www.example.invalid/indexnow-key.txt",
      urlList: ["https://www.example.invalid/a"],
    });
  });

  it("splits more than 10,000 URLs and sends nothing for none", () => {
    const urls = Array.from({ length: 10_001 }, (_, i) => `${siteUrl}/p/${i}`);
    expect(indexNowBodies({ siteUrl, key: "k".repeat(8), urls })).toHaveLength(2);
    expect(indexNowBodies({ siteUrl, key: "k".repeat(8), urls: [] })).toEqual([]);
  });
});

describe("submitIndexNow", () => {
  it("posts JSON and reports statuses without throwing", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockRejectedValueOnce(new Error("network"));
    const ok = await submitIndexNow(
      { siteUrl, key: "example-key-123", urls: [`${siteUrl}/a`] },
      fetchImpl as unknown as typeof fetch,
    );
    expect(ok).toEqual([202]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.indexnow.org/indexnow",
      expect.objectContaining({ method: "POST" }),
    );
    const failed = await submitIndexNow(
      { siteUrl, key: "example-key-123", urls: [`${siteUrl}/b`] },
      fetchImpl as unknown as typeof fetch,
    );
    expect(failed).toEqual([0]);
  });
});
