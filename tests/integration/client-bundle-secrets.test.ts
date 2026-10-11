import { describe, expect, it } from "vitest";
// @ts-expect-error The script is plain ESM JavaScript without type declarations.
import { scanText, serverEnvNames } from "../../tooling/scripts/check-client-bundle-secrets.mjs";

describe("client bundle secret scanner", () => {
  it("derives server-only names from the config schema and leaves public ones out", async () => {
    const names: string[] = await serverEnvNames();
    expect(names).toContain("SUPABASE_SECRET_KEY");
    expect(names).toContain("TURNSTILE_SECRET_KEY");
    for (const email of [
      "EMAIL_PROVIDER",
      "EMAIL_PROVIDER_API_KEY",
      "RESEND_API_KEY",
      "EMAIL_FROM",
    ]) {
      expect(names).toContain(email);
    }
    expect(names).not.toContain("NEXT_PUBLIC_SITE_URL");
    expect(names).not.toContain("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  });

  it("flags a server env var name and a secret-shaped value, without echoing the value", async () => {
    const names: string[] = await serverEnvNames();
    const findings: { label: string }[] = scanText(
      'x=process.env.OUTBOX_DISPATCH_SECRET;y="sb_secret_abcdefghijklmnopqrstuvwxyz"',
      names,
    );
    const labels = findings.map((f) => f.label);
    expect(labels).toContain("server env var name OUTBOX_DISPATCH_SECRET");
    expect(labels).toContain("Supabase secret key");
    expect(JSON.stringify(findings)).not.toContain("abcdefghijklmnopqrstuvwxyz");
  });

  it("does not flag public names or a longer identifier that merely contains a server name", async () => {
    const names: string[] = await serverEnvNames();
    expect(
      scanText(
        "NEXT_PUBLIC_TURNSTILE_SITE_KEY NEXT_PUBLIC_SITE_URL MY_TURNSTILE_SECRET_KEY_X",
        names,
      ),
    ).toEqual([]);
  });

  it("flags a Resend-style API key value without echoing it", async () => {
    const names: string[] = await serverEnvNames();
    const findings = scanText('const k="re_AbCdEfGhIjKlMnOpQrStUv123456";', names);
    expect(findings).toEqual([{ label: "Resend API key" }]);
    expect(JSON.stringify(findings)).not.toContain("AbCdEf");
  });
});
