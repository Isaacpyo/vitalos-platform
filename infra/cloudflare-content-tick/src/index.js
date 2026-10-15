// Vitalos content tick (ADR-038). A Cloudflare Worker cron trigger that calls the website's
// `GET /api/content/cron/tick` every minute with the website's CRON_SECRET. The website decides
// whether anything is due and only then wakes the Super Admin, so idle minutes cost nothing.
//
// Secrets (wrangler secret put): TICK_URL (https://www.vitalos.co.uk/api/content/cron/tick),
// CRON_SECRET (the website's CRON_SECRET). Never logged.

const TIMEOUT_MS = 10_000;

/** Calls the tick URL once. Returns a small result object; never throws. */
export async function tick(env, fetchImpl = fetch) {
  if (!env.TICK_URL || !env.CRON_SECRET) return { ok: false, reason: "not-configured" };
  let url;
  try {
    url = new URL(env.TICK_URL);
  } catch {
    return { ok: false, reason: "bad-url" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "not-https" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${env.CRON_SECRET}`,
        "user-agent": "vitalos-content-tick/1.0",
      },
      signal: controller.signal,
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, reason: error && error.name === "AbortError" ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      tick(env).then((result) => {
        // Status codes and reasons only: no URLs, headers or bodies.
        if (!result.ok) console.warn("content tick failed", result.status ?? result.reason);
      }),
    );
  },
};
