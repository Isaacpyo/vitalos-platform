import "server-only";
import { getEnv } from "@vitalos/config";
import { after } from "next/server";
import { createRelay } from "./composition";
import type { Relay } from "./composition";

const key = Symbol.for("vitalos.relay");
type GlobalWithRelay = typeof globalThis & { [key]?: Relay };

/**
 * Work that must not delay the response (alerts, pings, usage). `after` resolves the current
 * request scope when it is called; outside a request (tests, scripts) the task simply runs.
 */
function defer(task: () => Promise<unknown>): void {
  const run = () => task().catch(() => undefined);
  try {
    after(run);
  } catch {
    void run();
  }
}

/** The process-wide Relay instance, built once from the validated server environment. */
export function getRelay(): Relay {
  const holder = globalThis as GlobalWithRelay;
  holder[key] ??= createRelay(getEnv(), defer);
  return holder[key];
}
