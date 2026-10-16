import { describe, expect, it } from "vitest";
import { imagesConfig } from "./images";

describe("imagesConfig", () => {
  it("allows no remote images when the media host is not configured", () => {
    expect(imagesConfig(undefined)).toBeUndefined();
  });

  it("allows exactly the media host", () => {
    expect(imagesConfig("https://media.example.invalid")).toEqual({
      remotePatterns: [{ protocol: "https", hostname: "media.example.invalid", pathname: "/**" }],
    });
    expect(imagesConfig("http://127.0.0.1:9000")).toEqual({
      remotePatterns: [{ protocol: "http", hostname: "127.0.0.1", port: "9000", pathname: "/**" }],
    });
  });
});
