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

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Calendar date, weekday and time of an instant in Europe/London. */
function londonParts(at: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    weekday: WEEKDAYS.indexOf(get("weekday")),
    hh: Number(get("hour") === "24" ? "0" : get("hour")),
    mm: Number(get("minute")),
  };
}

/** The instant of a London wall-clock time (handles GMT and BST). */
function londonInstant(y: number, m: number, d: number, hh: number, mm: number): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const seen = londonParts(new Date(guess));
  const offsetMin = (Date.UTC(seen.y, seen.m - 1, seen.d, seen.hh, seen.mm) - guess) / 60_000;
  return new Date(guess - offsetMin * 60_000);
}

/**
 * The next start of working hours after `now` (Relay Settings, Europe/London), for the visitor's
 * "Back Monday 09:00" (finding D5). Null inside working hours or when no working day is set.
 * Labels: "today 09:00", "tomorrow 09:00", else the weekday ("Monday 09:00").
 */
export function nextOpening(
  settings: RelaySettings,
  now: Date,
): { at: string; label: string } | null {
  const h = settings.businessHours;
  if (h.days.length === 0 || withinBusinessHours(settings, now)) return null;
  const [startH, startM] = h.start.split(":").map(Number) as [number, number];
  const today = londonParts(now);
  for (let offset = 0; offset <= 7; offset++) {
    // Noon UTC on the London date `offset` days ahead: safely the same calendar day in London.
    const noon = new Date(Date.UTC(today.y, today.m - 1, today.d + offset, 12));
    const day = londonParts(noon);
    if (!h.days.includes(day.weekday)) continue;
    const at = londonInstant(day.y, day.m, day.d, startH, startM);
    if (at.getTime() <= now.getTime()) continue;
    const when = offset === 0 ? "today" : offset === 1 ? "tomorrow" : WEEKDAYS[day.weekday];
    return { at: at.toISOString(), label: `${when} ${h.start}` };
  }
  return null;
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
