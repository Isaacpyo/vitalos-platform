import { z } from "zod";
import type { Verdict } from "./verdict";

/**
 * The proxy's per-instance memory of lookup verdicts (ADR-040, as ADR-027 does for repo content).
 *
 * - A verdict is kept for 30 s per path; "unavailable" only for 5 s, so recovery is quick.
 * - A cached "missing" older than 3 s is confirmed with a fresh lookup before it becomes a 404,
 *   so something published through another instance is not hidden for the whole window.
 * - Each lookup is bounded (6 s: the lookup itself may wait for one admin read and its retry);
 *   any failure or timeout answers null and the proxy passes the request through. A failure is
 *   remembered for 5 s so a broken lookup cannot slow every request.
 * - Concurrent requests for one path share one lookup; the map is bounded.
 *
 * Framework-free: the fetch of the lookup route is injected.
 */

export const VerdictSchema: z.ZodType<Verdict> = z.discriminatedUnion("verdict", [
  z.strictObject({ verdict: z.literal("ok") }),
  z.strictObject({ verdict: z.literal("missing") }),
  z.strictObject({ verdict: z.literal("unavailable") }),
  z.strictObject({
    verdict: z.literal("redirect"),
    location: z
      .string()
      .max(200)
      .regex(/^\/(insights|careers)(\/[a-z0-9-]{1,80}){0,3}$/),
  }),
]);

export interface ProxyLookupDeps {
  /** Calls the lookup route; throws on any failure. */
  fetchVerdict(path: string, signal: AbortSignal, clientIp: string): Promise<Verdict>;
  now?: () => number;
  ttlMs?: number;
  confirmMs?: number;
  unavailableTtlMs?: number;
  failureTtlMs?: number;
  timeoutMs?: number;
  maxEntries?: number;
}

interface Entry {
  at: number;
  verdict: Verdict;
}

export function createProxyLookup(deps: ProxyLookupDeps) {
  const now = deps.now ?? Date.now;
  const ttlMs = deps.ttlMs ?? 30_000;
  const confirmMs = deps.confirmMs ?? 3_000;
  const unavailableTtlMs = deps.unavailableTtlMs ?? 5_000;
  const failureTtlMs = deps.failureTtlMs ?? 5_000;
  const timeoutMs = deps.timeoutMs ?? 6_000;
  const maxEntries = deps.maxEntries ?? 2_000;
  const cache = new Map<string, Entry>();
  const failedUntil = new Map<string, number>();
  const inFlight = new Map<string, Promise<Verdict | null>>();

  const remember = (path: string, verdict: Verdict) => {
    cache.delete(path);
    cache.set(path, { at: now(), verdict });
    // Map keeps insertion order: drop the oldest entries beyond the bound.
    while (cache.size > maxEntries) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  };

  function refresh(path: string, clientIp: string): Promise<Verdict | null> {
    const pending = inFlight.get(path);
    if (pending) return pending;
    const started = (async (): Promise<Verdict | null> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const verdict = await deps.fetchVerdict(path, controller.signal, clientIp);
        remember(path, verdict);
        failedUntil.delete(path);
        return verdict;
      } catch {
        failedUntil.set(path, now() + failureTtlMs);
        if (failedUntil.size > maxEntries) failedUntil.clear();
        return null;
      } finally {
        clearTimeout(timer);
        inFlight.delete(path);
      }
    })();
    inFlight.set(path, started);
    return started;
  }

  return {
    /** The verdict for a path, or null to pass the request through (failure or timeout). */
    async verdict(path: string, clientIp = ""): Promise<Verdict | null> {
      const cached = cache.get(path);
      const age = cached ? now() - cached.at : Infinity;
      const fresh =
        cached !== undefined &&
        age < (cached.verdict.verdict === "unavailable" ? unavailableTtlMs : ttlMs);
      if (fresh && cached) {
        if (cached.verdict.verdict !== "missing" || age <= confirmMs) return cached.verdict;
      } else if ((failedUntil.get(path) ?? 0) > now()) {
        return null;
      }
      return refresh(path, clientIp);
    },
    /** Forget every verdict (after a revalidation on this instance, and in tests). */
    clear(): void {
      cache.clear();
      failedUntil.clear();
    },
    size: () => cache.size,
  };
}

export type ProxyLookup = ReturnType<typeof createProxyLookup>;

const registryKey = Symbol.for("vitalos.content.proxyLookup");
type Registry = { [registryKey]?: ProxyLookup };

/**
 * One instance per process, shared through `globalThis`: the proxy and the route handlers are
 * bundled separately, so a module-level variable would not be shared, but on one Node process
 * (`next start`, or a warm Vercel instance) the revalidate route can then clear the proxy's
 * verdicts. On other instances the 30 s TTL and the 3 s confirmation bound staleness.
 */
export function sharedProxyLookup(create: () => ProxyLookup): ProxyLookup {
  const registry = globalThis as Registry;
  registry[registryKey] ??= create();
  return registry[registryKey];
}

/** Clears this process's proxy verdicts, if the proxy has created them. */
export function clearProxyLookupVerdicts(): void {
  (globalThis as Registry)[registryKey]?.clear();
}
