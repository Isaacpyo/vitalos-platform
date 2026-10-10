/**
 * Cloudflare Turnstile server-side verification. Contract only: implemented by workstream D.
 */
export interface VerifyTurnstileInput {
  secret: string;
  token: string;
  remoteIp?: string;
  expectedHostname?: string;
  expectedAction: "enquiry";
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface VerifyTurnstileResult {
  success: boolean;
  errorCodes: readonly string[];
}

/** Stub: fails closed until workstream D implements it. */
export function verifyTurnstileToken(input: VerifyTurnstileInput): Promise<VerifyTurnstileResult> {
  void input;
  return Promise.resolve({ success: false, errorCodes: ["not-implemented"] });
}
