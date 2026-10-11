import { TURNSTILE_PROVIDER_ERRORS, verifyTurnstileToken } from "@vitalos/security/turnstile";
import type { HumanVerification, HumanVerifier } from "../domain/ports";

/** Cloudflare Turnstile (Siteverify). Provider outages throw, so the enquiry fails closed. */
export class TurnstileVerifier implements HumanVerifier {
  constructor(
    private readonly options: {
      secret: string;
      /** Hostname of the public site; pinned against the challenge's reported hostname. */
      expectedHostname: string | undefined;
      fetch?: typeof fetch;
      timeoutMs?: number;
    },
  ) {}

  async verify(input: {
    token: string | undefined;
    ip: string | undefined;
  }): Promise<HumanVerification> {
    if (!input.token) return "failed";
    const result = await verifyTurnstileToken({
      secret: this.options.secret,
      token: input.token,
      expectedAction: "enquiry",
      ...(input.ip ? { remoteIp: input.ip } : {}),
      ...(this.options.expectedHostname ? { expectedHostname: this.options.expectedHostname } : {}),
      ...(this.options.fetch ? { fetch: this.options.fetch } : {}),
      ...(this.options.timeoutMs ? { timeoutMs: this.options.timeoutMs } : {}),
    });
    if (result.success) return "passed";
    if (result.errorCodes.some((code) => TURNSTILE_PROVIDER_ERRORS.includes(code))) {
      throw new Error("turnstile-unavailable");
    }
    return "failed";
  }
}

/** Used when Turnstile is not configured. */
export class DisabledVerifier implements HumanVerifier {
  verify(): Promise<HumanVerification> {
    return Promise.resolve("disabled");
  }
}
