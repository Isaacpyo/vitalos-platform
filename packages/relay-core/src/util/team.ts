import type { TeamStatus } from "../contract";
import type { PresenceRecord } from "../db/types";
import type { RelaySettings } from "../schemas/settings";

/** Weekday (0 = Sunday) and HH:MM in Europe/London. */
export function londonClock(now: Date): { day: number; hhmm: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { day: days.indexOf(get("weekday")), hhmm: `${hour}:${get("minute")}` };
}

export function withinBusinessHours(settings: RelaySettings, now: Date): boolean {
  const { day, hhmm } = londonClock(now);
  const h = settings.businessHours;
  return h.days.includes(day) && hhmm >= h.start && hhmm < h.end;
}

export const PRESENCE_WINDOW_MS = 2 * 60 * 1000;

/**
 * TEAM ONLINE when at least one admin is Available, was seen in the last 2 minutes, and it is
 * within business hours (Europe/London).
 */
export function teamStatus(
  presence: readonly PresenceRecord[],
  settings: RelaySettings,
  now: Date,
): TeamStatus {
  if (!withinBusinessHours(settings, now)) return "offline";
  const cutoff = now.getTime() - PRESENCE_WINDOW_MS;
  return presence.some((p) => p.available && Date.parse(p.lastSeenAt) >= cutoff)
    ? "online"
    : "offline";
}

/** "Desktop · Chrome" style label from a user agent (no fingerprinting; coarse only). */
export function deviceLabel(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent;
  const kind = /iPad|Tablet/i.test(ua)
    ? "Tablet"
    : /Mobi|iPhone|Android/i.test(ua)
      ? "Mobile"
      : "Desktop";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  return `${kind} · ${browser}`;
}
