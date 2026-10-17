import { createHash, timingSafeEqual } from "node:crypto";
import type { Relay } from "../composition";
import { errorResponse, json } from "./common";

const digest = (v: string) => createHash("sha256").update(v).digest();

/** Bearer check in constant time (hashing first equalises lengths). */
function authorised(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const presented = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  return timingSafeEqual(digest(presented), digest(secret));
}

/**
 * Scheduled jobs (ADR-038), called by pg_cron through pg_net with `CRON_SECRET`:
 * reminders (every 5 min), digest (hourly; sends at 08:45 London), faq-sync (every 15 min,
 * `?mode=full` nightly), ingest (hourly: website and repo knowledge, ADR-048).
 */
export async function handleCronRequest(
  request: Request,
  job: string,
  relay: Relay,
  secret: string | undefined,
): Promise<Response> {
  if (!authorised(request, secret)) return errorResponse("unauthorised", 401, "Unauthorised");
  try {
    switch (job) {
      case "reminders":
        return json(await relay.cron.reminders());
      case "digest":
        return json(await relay.cron.digest());
      case "ingest":
        // Hourly re-ingest of the bundled website and repo knowledge (ADR-048, D4).
        await relay.ready();
        return json(await relay.admin.ingestBundled("relay:cron"));
      case "faq-sync": {
        const full = new URL(request.url).searchParams.get("mode") === "full";
        const run = await relay.faq.cron(full);
        return json({
          mode: run.mode,
          added: run.added,
          updated: run.updated,
          archived: run.archived,
          held: run.held,
          errors: run.errors.length,
        });
      }
      default:
        return errorResponse("not_found", 404);
    }
  } catch {
    return errorResponse("unavailable", 503);
  }
}
