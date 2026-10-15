import { describe, expect, it } from "vitest";
import { validatePodcast } from "./podcast";

describe("validatePodcast", () => {
  it("keeps https URLs on the platforms' own hosts", () => {
    const podcast = {
      spotifyUrl: "https://open.spotify.com/show/example-fixture",
      appleUrl: "https://podcasts.apple.com/gb/podcast/example-fixture",
    };
    expect(validatePodcast(podcast)).toEqual(podcast);
  });

  it("drops anything else and returns undefined when nothing is valid", () => {
    expect(validatePodcast(undefined)).toBeUndefined();
    expect(validatePodcast({})).toBeUndefined();
    expect(
      validatePodcast({
        spotifyUrl: "http://open.spotify.com/show/x",
        appleUrl: "https://evil.example/podcasts.apple.com",
      }),
    ).toBeUndefined();
    expect(
      validatePodcast({ spotifyUrl: "https://open.spotify.com.evil.example/x" }),
    ).toBeUndefined();
    expect(validatePodcast({ spotifyUrl: "javascript:alert(1)" })).toBeUndefined();
    expect(validatePodcast({ spotifyUrl: "https://user@open.spotify.com/show/x" })).toBeUndefined();
    expect(
      validatePodcast({
        spotifyUrl: "https://open.spotify.com/show/example-fixture",
        appleUrl: "not a url",
      }),
    ).toEqual({ spotifyUrl: "https://open.spotify.com/show/example-fixture" });
  });
});
