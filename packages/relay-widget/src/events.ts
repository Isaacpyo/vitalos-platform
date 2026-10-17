/**
 * Relay analytics hook (ADR-048). The widget never imports the website, so it announces what
 * happened as a DOM event and the site decides what to record:
 *
 *   window.addEventListener("vitalos:relay", (e) => track(e.detail.type));
 *
 * Types: `relay_opened` (the panel opens), `relay_question` (a visitor message is sent),
 * `relay_handoff` (a hand-off request succeeds). `detail` carries the type only: never message
 * text, names, emails or ids.
 */
export const RELAY_EVENT = "vitalos:relay";

export type RelayEventType = "relay_opened" | "relay_question" | "relay_handoff";

export interface RelayEventDetail {
  type: RelayEventType;
}

export function emitRelayEvent(type: RelayEventType): void {
  try {
    window.dispatchEvent(
      new CustomEvent<RelayEventDetail>(RELAY_EVENT, { detail: { type } }),
    );
  } catch {
    // Old browsers without CustomEvent: analytics are optional.
  }
}
