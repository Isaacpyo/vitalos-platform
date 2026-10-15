/**
 * Cloudflare Turnstile server-side verification ("Siteverify").
 *
 * Server-side validation is mandatory whenever the widget is used: a token issued in the browser
 * proves nothing until Siteverify confirms it. This function fails closed. It never throws and
 * never includes the secret or the token in its result.
 */
export const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface VerifyTurnstileInput {
  secret: string;
  token: string;
  remoteIp?: string;
  /** When set, the hostname Cloudflare reports for the solved challenge must match. */
  expectedHostname?: string;
  expectedAction: "enquiry" | "relay";
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface VerifyTurnstileResult {
  success: boolean;
  errorCodes: readonly string[];
}

/** Error codes that mean "could not reach or understand Cloudflare", not "token is bad". */
export const TURNSTILE_PROVIDER_ERRORS: readonly string[] = [
  "network-error",
  "timeout",
  "http-error",
  "invalid-response",
];

/**
 * Cloudflare's documented dummy secrets (always pass / always fail / token already spent). Their
 * responses carry placeholder hostnames and actions, so hostname/action pinning is skipped for
 * them. They are public test fixtures, not credentials.
 */
export const isTurnstileTestSecret = (secret: string): boolean =>
  /^[123]x0{20,}[A-Za-z]*$/.test(secret);

interface SiteverifyBody {
  success?: unknown;
  "error-codes"?: unknown;
  hostname?: unknown;
  action?: unknown;
}

/**
 * What Cloudflare documents for its dummy secrets: `1x` always passes, `2x` always fails and `3x`
 * reports an already-spent token. Answering these locally keeps tests and local development off
 * the network: a call to Cloudflare can time out or fail on a busy runner, and a provider outage
 * is deliberately reported as "unavailable" (fail closed), which made the enquiry end-to-end
 * flows flaky. Only these public test secrets are answered here; the configuration rejects them
 * in production, so a real deployment always verifies against Cloudflare.
 */
function answerTestSecret(secret: string): VerifyTurnstileResult {
  if (secret.startsWith("1")) return { success: true, errorCodes: [] };
  if (secret.startsWith("2")) return { success: false, errorCodes: ["invalid-input-response"] };
  return { success: false, errorCodes: ["timeout-or-duplicate"] };
}

export async function verifyTurnstileToken(
  input: VerifyTurnstileInput,
): Promise<VerifyTurnstileResult> {
  const fail = (...codes: string[]): VerifyTurnstileResult => ({
    success: false,
    errorCodes: codes,
  });
  if (!input.token) return fail("missing-input-response");
  if (!input.secret) return fail("missing-input-secret");
  // An injected `fetch` (unit tests of the network path) is always honoured.
  if (!input.fetch && isTurnstileTestSecret(input.secret)) return answerTestSecret(input.secret);

  const body = new URLSearchParams({ secret: input.secret, response: input.token });
  if (input.remoteIp) body.set("remoteip", input.remoteIp);

  let response: Response;
  try {
    response = await (input.fetch ?? fetch)(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(input.timeoutMs ?? 5000),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return fail(timedOut ? "timeout" : "network-error");
  }
  if (!response.ok) return fail("http-error");

  let data: SiteverifyBody;
  try {
    const parsed: unknown = await response.json();
    if (typeof parsed !== "object" || parsed === null) return fail("invalid-response");
    data = parsed;
  } catch {
    return fail("invalid-response");
  }

  const errorCodes = Array.isArray(data["error-codes"])
    ? data["error-codes"].filter((code): code is string => typeof code === "string")
    : [];
  if (data.success !== true) return { success: false, errorCodes };

  if (!isTurnstileTestSecret(input.secret)) {
    if (input.expectedHostname && data.hostname !== input.expectedHostname) {
      return fail("hostname-mismatch");
    }
    if (data.action !== input.expectedAction) return fail("action-mismatch");
  }
  return { success: true, errorCodes: [] };
}
