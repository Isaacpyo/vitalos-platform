/**
 * Owner-supplied podcast listing URLs. Only https URLs on the two platforms' own hosts are
 * accepted; anything else is dropped, never repaired or guessed.
 */
import type { PodcastLinksView } from "./types";

const hosts = {
  spotifyUrl: "open.spotify.com",
  appleUrl: "podcasts.apple.com",
} as const;

export function isPodcastUrl(kind: keyof typeof hosts, value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.hostname === hosts[kind] && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

/** Keeps the valid URLs; returns undefined when none is valid. */
export function validatePodcast(
  podcast: PodcastLinksView | undefined,
): PodcastLinksView | undefined {
  if (!podcast) return undefined;
  const valid: PodcastLinksView = {
    ...(isPodcastUrl("spotifyUrl", podcast.spotifyUrl) ? { spotifyUrl: podcast.spotifyUrl } : {}),
    ...(isPodcastUrl("appleUrl", podcast.appleUrl) ? { appleUrl: podcast.appleUrl } : {}),
  };
  return valid.spotifyUrl || valid.appleUrl ? valid : undefined;
}
