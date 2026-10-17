import { describe, expect, it } from "vitest";
import { buildSecurityHeaders, type SecurityDeployEnv } from "./headers";

const find = (headers: { key: string; value: string }[], key: string) =>
  headers.find((header) => header.key === key)?.value;

describe("buildSecurityHeaders", () => {
  it.each<SecurityDeployEnv>(["local", "preview", "staging"])(
    "sends X-Robots-Tag noindex, nofollow in %s",
    (deployEnv) => {
      const headers = buildSecurityHeaders({ deployEnv, enableHsts: false });
      expect(find(headers, "X-Robots-Tag")).toBe("noindex, nofollow");
    },
  );

  it("does not send X-Robots-Tag in production", () => {
    const headers = buildSecurityHeaders({ deployEnv: "production", enableHsts: false });
    expect(find(headers, "X-Robots-Tag")).toBeUndefined();
  });

  it("fails closed: an unknown deploy env is not indexable", () => {
    const headers = buildSecurityHeaders({
      deployEnv: "Production" as SecurityDeployEnv,
      enableHsts: false,
    });
    expect(find(headers, "X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("always sends the baseline headers", () => {
    for (const deployEnv of ["local", "preview", "staging", "production"] as const) {
      const headers = buildSecurityHeaders({ deployEnv, enableHsts: false });
      expect(find(headers, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
      expect(find(headers, "X-Content-Type-Options")).toBe("nosniff");
      const permissions = find(headers, "Permissions-Policy");
      expect(permissions).toContain("camera=()");
      expect(permissions).toContain("microphone=()");
      expect(permissions).toContain("geolocation=()");
      expect(find(headers, "X-Frame-Options")).toBe("DENY");
      expect(find(headers, "Cross-Origin-Opener-Policy")).toBe("same-origin");
    }
  });

  it("never asks for HSTS preloading (an owner decision, ADR-047)", () => {
    const hsts = find(
      buildSecurityHeaders({ deployEnv: "production", enableHsts: true }),
      "Strict-Transport-Security",
    );
    expect(hsts).not.toContain("preload");
  });

  it("sends HSTS only when enabled and never for local", () => {
    expect(
      find(
        buildSecurityHeaders({ deployEnv: "production", enableHsts: false }),
        "Strict-Transport-Security",
      ),
    ).toBeUndefined();
    expect(
      find(
        buildSecurityHeaders({ deployEnv: "production", enableHsts: true }),
        "Strict-Transport-Security",
      ),
    ).toBe("max-age=63072000; includeSubDomains");
    expect(
      find(
        buildSecurityHeaders({ deployEnv: "local", enableHsts: true }),
        "Strict-Transport-Security",
      ),
    ).toBeUndefined();
  });

  it("passes the enforced and report-only CSP through unchanged", () => {
    const headers = buildSecurityHeaders({
      deployEnv: "preview",
      enableHsts: false,
      csp: "default-src 'self'",
      cspReportOnly: "default-src 'none'",
    });
    expect(find(headers, "Content-Security-Policy")).toBe("default-src 'self'");
    expect(find(headers, "Content-Security-Policy-Report-Only")).toBe("default-src 'none'");
  });

  it("omits CSP headers when no policy is given", () => {
    const headers = buildSecurityHeaders({ deployEnv: "production", enableHsts: false });
    expect(find(headers, "Content-Security-Policy")).toBeUndefined();
    expect(find(headers, "Content-Security-Policy-Report-Only")).toBeUndefined();
  });
});
