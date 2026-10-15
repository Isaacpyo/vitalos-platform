/**
 * Streaming guard for the hand-off marker (section 6.2 step 8): the last HOLDBACK characters are
 * held back until the stream ends, so `[[handoff]]` never reaches the visitor even when it arrives
 * split across chunks.
 */
export const HANDOFF_MARKER = "[[handoff]]";
export const HOLDBACK = 16;

export class MarkerGuard {
  private buffer = "";
  private emitted = 0;

  /** Feeds a delta and returns the text that is safe to send now (may be empty). */
  push(delta: string): string {
    this.buffer += delta;
    const safeEnd = Math.max(this.emitted, this.buffer.length - HOLDBACK);
    // Never release a prefix of the marker that could still complete.
    const out = this.buffer.slice(this.emitted, safeEnd);
    const markerAt = out.indexOf("[[");
    const release = markerAt >= 0 ? out.slice(0, markerAt) : out;
    this.emitted += release.length;
    return release;
  }

  /** Ends the stream: returns the remaining visible text and whether the marker was present. */
  finish(): { rest: string; text: string; handoff: boolean } {
    const handoff = this.buffer.includes(HANDOFF_MARKER);
    const text = stripMarkers(this.buffer);
    const rest = text.slice(Math.min(this.emitted, text.length));
    this.emitted = text.length;
    return { rest, text, handoff };
  }

  /** Everything received so far with markers removed (for saving a stopped answer). */
  partial(): string {
    return stripMarkers(this.buffer);
  }
}

export function stripMarkers(text: string): string {
  return text
    .replaceAll(HANDOFF_MARKER, "")
    .replace(/\[\[[a-z]{0,8}\]?\]?\s*$/i, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
