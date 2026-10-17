import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readBuildEnv } from "./build";
import { readPublicEnv } from "./public";
import { deriveFeatures, parseEnv, safeParseEnv, EnvValidationError } from "./schema";
import { features, readServerEnv } from "./server";

const explicitProductionChoices = {
  NEXT_PUBLIC_SITE_URL: "https://www.example.invalid",
  VITALOS_CONTENT_SOURCE: "empty",
  VITALOS_ENQUIRY_BACKEND: "disabled",
};

const production = { VITALOS_DEPLOY_ENV: "production", ...explicitProductionChoices };

function issuePaths(source: Record<string, string>): string[] {
  const result = safeParseEnv(source);
  return result.success ? [] : result.issues.map((issue) => issue.path);
}

describe("deploy environment", () => {
  it("defaults to local with a local site URL and the repo content source", () => {
    const env = parseEnv({});
    expect(env.deployEnv).toBe("local");
    expect(env.siteUrl).toBe("http://localhost:3000");
    expect(env.contentSource).toBe("repo");
    expect(env.enquiry.backend).toBe("disabled");
    expect(env.email.provider).toBe("none");
  });

  it.each([
    ["production", "production"],
    ["preview", "preview"],
    ["development", "local"],
  ] as const)("derives %s from VERCEL_ENV=%s", (vercelEnv, expected) => {
    const env = parseEnv({ VERCEL_ENV: vercelEnv, ...explicitProductionChoices });
    expect(env.deployEnv).toBe(expected);
  });

  it("lets VITALOS_DEPLOY_ENV override VERCEL_ENV (staging)", () => {
    const env = parseEnv({
      VERCEL_ENV: "preview",
      VITALOS_DEPLOY_ENV: "staging",
      NEXT_PUBLIC_SITE_URL: "https://staging.example.invalid",
    });
    expect(env.deployEnv).toBe("staging");
  });

  it("falls back to VERCEL_URL for non-production site URLs", () => {
    const env = parseEnv({ VERCEL_ENV: "preview", VERCEL_URL: "preview-abc.example.invalid" });
    expect(env.siteUrl).toBe("https://preview-abc.example.invalid");
  });

  it("requires an explicit https NEXT_PUBLIC_SITE_URL in production", () => {
    expect(issuePaths({ VITALOS_DEPLOY_ENV: "production" })).toContain("NEXT_PUBLIC_SITE_URL");
    expect(
      issuePaths({ VITALOS_DEPLOY_ENV: "production", NEXT_PUBLIC_SITE_URL: "http://x.invalid" }),
    ).toContain("NEXT_PUBLIC_SITE_URL");
    expect(issuePaths({ VERCEL_ENV: "production", VERCEL_URL: "x.invalid" })).toContain(
      "NEXT_PUBLIC_SITE_URL",
    );
  });
});

describe("production guards", () => {
  it("rejects fixtures in production", () => {
    expect(issuePaths({ ...production, VITALOS_CONTENT_SOURCE: "fixtures" })).toEqual([
      "VITALOS_CONTENT_SOURCE",
    ]);
  });

  it("allows fixtures outside production", () => {
    for (const deployEnv of ["local", "preview", "staging"]) {
      const env = parseEnv({
        VITALOS_DEPLOY_ENV: deployEnv,
        NEXT_PUBLIC_SITE_URL: "https://x.invalid",
        VITALOS_CONTENT_SOURCE: "fixtures",
        VITALOS_FIXTURE_SET: "sparse",
      });
      expect(env.contentSource).toBe("fixtures");
      expect(env.fixtureSet).toBe("sparse");
    }
  });

  it("rejects draft content in production", () => {
    expect(issuePaths({ ...production, VITALOS_CONTENT_SOURCE: "draft" })).toEqual([
      "VITALOS_CONTENT_SOURCE",
    ]);
    expect(() => readBuildEnv({ ...production, VITALOS_CONTENT_SOURCE: "draft" })).toThrow(
      EnvValidationError,
    );
    try {
      readBuildEnv({ ...production, VITALOS_CONTENT_SOURCE: "draft" });
    } catch (error) {
      expect((error as EnvValidationError).issues.map((issue) => issue.path)).toEqual([
        "VITALOS_CONTENT_SOURCE",
      ]);
    }
  });

  it("rejects draft content in production whichever way production is signalled", () => {
    expect(
      issuePaths({
        VERCEL_ENV: "production",
        ...explicitProductionChoices,
        VITALOS_CONTENT_SOURCE: "draft",
      }),
    ).toEqual(["VITALOS_CONTENT_SOURCE"]);
  });

  it("never serves draft or fixtures on a Vercel production deployment, whatever VITALOS_DEPLOY_ENV says", () => {
    for (const source of ["draft", "fixtures"]) {
      for (const override of ["local", "preview", "staging"]) {
        expect(
          issuePaths({
            VERCEL_ENV: "production",
            VITALOS_DEPLOY_ENV: override,
            NEXT_PUBLIC_SITE_URL: "https://www.example.invalid",
            VITALOS_CONTENT_SOURCE: source,
            VITALOS_ENQUIRY_BACKEND: "memory",
          }),
          `${source} with ${override}`,
        ).toContain("VITALOS_DEPLOY_ENV");
        const build = () =>
          readBuildEnv({
            VERCEL_ENV: "production",
            VITALOS_DEPLOY_ENV: override,
            NEXT_PUBLIC_SITE_URL: "https://www.example.invalid",
            VITALOS_CONTENT_SOURCE: source,
          });
        expect(build).toThrow(EnvValidationError);
        try {
          build();
        } catch (error) {
          expect((error as EnvValidationError).issues.map((issue) => issue.path)).toContain(
            "VITALOS_DEPLOY_ENV",
          );
        }
      }
    }
  });

  it("allows draft content outside production", () => {
    for (const deployEnv of ["local", "preview", "staging"]) {
      const env = parseEnv({
        VITALOS_DEPLOY_ENV: deployEnv,
        NEXT_PUBLIC_SITE_URL: "https://x.invalid",
        VITALOS_CONTENT_SOURCE: "draft",
        VITALOS_ENQUIRY_BACKEND: "memory",
      });
      expect(env.contentSource).toBe("draft");
      expect(deriveFeatures(env).indexable).toBe(false);
    }
  });

  it("never records real enquiries against the draft privacy notice", () => {
    expect(
      issuePaths({
        VITALOS_DEPLOY_ENV: "staging",
        NEXT_PUBLIC_SITE_URL: "https://x.invalid",
        VITALOS_CONTENT_SOURCE: "draft",
        VITALOS_ENQUIRY_BACKEND: "supabase",
        SUPABASE_URL: "https://project.example.invalid",
        SUPABASE_SECRET_KEY: "x".repeat(24),
      }),
    ).toEqual(["VITALOS_ENQUIRY_BACKEND"]);
    // Implied supabase (configured, backend unset) is caught the same way.
    expect(
      issuePaths({
        VITALOS_CONTENT_SOURCE: "draft",
        SUPABASE_URL: "https://project.example.invalid",
        SUPABASE_SECRET_KEY: "x".repeat(24),
      }),
    ).toEqual(["VITALOS_ENQUIRY_BACKEND"]);
  });

  it("rejects the memory enquiry backend in production", () => {
    expect(issuePaths({ ...production, VITALOS_ENQUIRY_BACKEND: "memory" })).toEqual([
      "VITALOS_ENQUIRY_BACKEND",
    ]);
    expect(parseEnv({ VITALOS_ENQUIRY_BACKEND: "memory" }).enquiry.backend).toBe("memory");
  });

  it("treats CRON_SECRET as optional and requires 32+ characters when set", () => {
    expect(issuePaths(production)).toEqual([]);
    expect(issuePaths({ ...production, CRON_SECRET: "c".repeat(32) })).toEqual([]);
    expect(issuePaths({ ...production, CRON_SECRET: "short" })).toEqual(["CRON_SECRET"]);
    expect(issuePaths({ ...production, CRON_SECRET: "c".repeat(31) })).toEqual(["CRON_SECRET"]);
  });

  it("rejects the console email provider in production", () => {
    expect(issuePaths({ ...production, EMAIL_PROVIDER: "console" })).toEqual(["EMAIL_PROVIDER"]);
  });

  it("rejects provider none in production once a notification recipient is set", () => {
    const withTo = { ...production, ENQUIRY_NOTIFICATION_TO: "ops@example.invalid" };
    expect(issuePaths(withTo)).toEqual(["EMAIL_PROVIDER"]);
    expect(issuePaths({ ...withTo, EMAIL_PROVIDER: "none" })).toEqual(["EMAIL_PROVIDER"]);
    // Without a recipient, none stays valid; outside production it is not enforced.
    expect(issuePaths(production)).toEqual([]);
    expect(issuePaths({ ENQUIRY_NOTIFICATION_TO: "ops@example.invalid" })).toEqual([]);
    expect(
      issuePaths({
        ...withTo,
        EMAIL_PROVIDER: "postmark",
        EMAIL_FROM: "Vitalos <noreply@example.invalid>",
        EMAIL_PROVIDER_API_KEY: "key-fixture",
      }),
    ).toEqual([]);
  });

  it("requires sender, key and recipient when postmark or resend is selected", () => {
    for (const provider of ["postmark", "resend"]) {
      expect(issuePaths({ EMAIL_PROVIDER: provider }).sort()).toEqual([
        "EMAIL_FROM",
        "EMAIL_PROVIDER_API_KEY",
        "ENQUIRY_NOTIFICATION_TO",
      ]);
      const env = parseEnv({
        EMAIL_PROVIDER: provider,
        EMAIL_FROM: "noreply@example.invalid",
        EMAIL_PROVIDER_API_KEY: "key-fixture",
        ENQUIRY_NOTIFICATION_TO: "ops@example.invalid",
      });
      expect(env.email).toEqual({
        provider,
        apiKey: "key-fixture",
        from: "noreply@example.invalid",
      });
      expect(deriveFeatures(env).emailNotifications).toBe(true);
    }
  });

  it("accepts RESEND_API_KEY as a fallback key only for resend, with EMAIL_PROVIDER_API_KEY winning", () => {
    const base = {
      EMAIL_FROM: "noreply@example.invalid",
      ENQUIRY_NOTIFICATION_TO: "ops@example.invalid",
    };
    const alias = parseEnv({ ...base, EMAIL_PROVIDER: "resend", RESEND_API_KEY: "alias-fixture" });
    expect(alias.email.apiKey).toBe("alias-fixture");
    const both = parseEnv({
      ...base,
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "alias-fixture",
      EMAIL_PROVIDER_API_KEY: "primary-fixture",
    });
    expect(both.email.apiKey).toBe("primary-fixture");
    expect(
      issuePaths({ ...base, EMAIL_PROVIDER: "postmark", RESEND_API_KEY: "alias-fixture" }),
    ).toEqual(["EMAIL_PROVIDER_API_KEY"]);
    expect(issuePaths({ ...base, EMAIL_PROVIDER: "resend" })).toEqual(["EMAIL_PROVIDER_API_KEY"]);
    // Production still requires a key for resend; the alias satisfies it.
    const prod = { ...production, ...base, EMAIL_PROVIDER: "resend" };
    expect(issuePaths(prod)).toEqual(["EMAIL_PROVIDER_API_KEY"]);
    expect(issuePaths({ ...prod, RESEND_API_KEY: "alias-fixture" })).toEqual([]);
  });

  it("rejects a multi-line or malformed sender and never echoes the key in errors", () => {
    const base = {
      EMAIL_PROVIDER: "resend",
      EMAIL_PROVIDER_API_KEY: "secret-key-fixture",
      ENQUIRY_NOTIFICATION_TO: "ops@example.invalid",
    };
    expect(
      issuePaths({ ...base, EMAIL_FROM: "a@example.invalid\nBcc: x@example.invalid" }),
    ).toEqual(["EMAIL_FROM"]);
    const result = safeParseEnv({ ...base, EMAIL_FROM: "bad>\nsender" });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret-key-fixture");
    for (const from of [
      "noreply",
      "Vitalos <noreply>",
      "a@x.invalid, b@y.invalid",
      "Vitalos <a@x.invalid>, <b@y.invalid>",
      "a@x.invalid\tb@y.invalid",
      "a@x",
      "bad>\nsender",
    ]) {
      expect(issuePaths({ ...base, EMAIL_FROM: from }), from).toEqual(["EMAIL_FROM"]);
    }
    for (const from of [
      "noreply@example.invalid",
      "Vitalos <noreply@example.invalid>",
      '"Vitalos Ltd" <noreply@example.invalid>',
    ]) {
      expect(issuePaths({ ...base, EMAIL_FROM: from }), from).toEqual([]);
    }
  });

  it("allows the repo content source in production, with the supabase enquiry backend", () => {
    const paths = issuePaths({
      ...production,
      VITALOS_CONTENT_SOURCE: "repo",
      VITALOS_ENQUIRY_BACKEND: "supabase",
      SUPABASE_URL: "https://project.example.invalid",
      SUPABASE_SECRET_KEY: "x".repeat(24),
    });
    expect(paths).not.toContain("VITALOS_CONTENT_SOURCE");
    expect(paths).not.toContain("VITALOS_ENQUIRY_BACKEND");
    expect(parseEnv({ ...production, VITALOS_CONTENT_SOURCE: "repo" }).contentSource).toBe("repo");
  });

  it("accepts a deliberate empty content source and disabled enquiries in production", () => {
    const env = parseEnv(production);
    expect(env.contentSource).toBe("empty");
    expect(env.enquiry.backend).toBe("disabled");
  });

  it("requires the content source and enquiry backend to be explicit in production", () => {
    const implicit = {
      VITALOS_DEPLOY_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://www.example.invalid",
    };
    expect(issuePaths(implicit).sort()).toEqual([
      "VITALOS_CONTENT_SOURCE",
      "VITALOS_ENQUIRY_BACKEND",
    ]);
    // Implicit defaults stay fine outside production.
    expect(
      issuePaths({ VITALOS_DEPLOY_ENV: "staging", NEXT_PUBLIC_SITE_URL: "https://s.invalid" }),
    ).toEqual([]);
  });

  it("rejects any non-production deploy env override on a Vercel production deployment", () => {
    for (const override of ["local", "preview", "staging"]) {
      expect(
        issuePaths({
          ...explicitProductionChoices,
          VERCEL_ENV: "production",
          VITALOS_DEPLOY_ENV: override,
        }),
      ).toEqual(["VITALOS_DEPLOY_ENV"]);
    }
    expect(
      issuePaths({
        ...explicitProductionChoices,
        VERCEL_ENV: "production",
        VITALOS_DEPLOY_ENV: "production",
      }),
    ).toEqual([]);
  });

  it("does not treat NODE_ENV=production as a production deployment (fail-closed to local)", () => {
    // next build / next start set NODE_ENV=production everywhere, so it carries no deploy signal.
    const env = parseEnv({ NODE_ENV: "production" });
    expect(env.deployEnv).toBe("local");
    expect(deriveFeatures(env).indexable).toBe(false);
  });
});

describe("production enquiry hardening", () => {
  const supabaseProduction = {
    VITALOS_DEPLOY_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "https://www.example.invalid",
    VITALOS_CONTENT_SOURCE: "empty",
    VITALOS_ENQUIRY_BACKEND: "supabase",
    SUPABASE_URL: "https://project.example.invalid",
    SUPABASE_SECRET_KEY: "x".repeat(24),
  };
  const complete = {
    ...supabaseProduction,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAAfixturesitekey",
    TURNSTILE_SECRET_KEY: "0x4AAAAAAAfixturesecretkey",
    ENQUIRY_IP_HASH_SALT: "s".repeat(24),
    ENQUIRY_PRIVACY_NOTICE_VERSION: "2026-10",
  };

  it("requires Turnstile, the IP hash salt and the privacy notice version with the supabase backend", () => {
    expect(issuePaths(supabaseProduction).sort()).toEqual([
      "ENQUIRY_IP_HASH_SALT",
      "ENQUIRY_PRIVACY_NOTICE_VERSION",
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
      "TURNSTILE_SECRET_KEY",
    ]);
    expect(safeParseEnv(complete).success).toBe(true);
  });

  it("does not require them for local or preview supabase runs", () => {
    const { VITALOS_DEPLOY_ENV: _drop, ...rest } = supabaseProduction;
    void _drop;
    expect(safeParseEnv({ ...rest, VITALOS_DEPLOY_ENV: "preview" }).success).toBe(true);
    expect(safeParseEnv({ ...rest, VITALOS_DEPLOY_ENV: "local" }).success).toBe(true);
  });

  it("does not require them when enquiries are deliberately disabled", () => {
    expect(safeParseEnv(production).success).toBe(true);
  });

  it.each([
    "1x0000000000000000000000000000000AA",
    "2x0000000000000000000000000000000AA",
    "3x0000000000000000000000000000000AA",
  ])("rejects Cloudflare's dummy secret %s in production", (secret) => {
    expect(issuePaths({ ...complete, TURNSTILE_SECRET_KEY: secret })).toEqual([
      "TURNSTILE_SECRET_KEY",
    ]);
  });

  it("rejects Cloudflare's dummy site key in production but allows it outside production", () => {
    const siteKey = "1x00000000000000000000AA";
    expect(issuePaths({ ...complete, NEXT_PUBLIC_TURNSTILE_SITE_KEY: siteKey })).toEqual([
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    ]);
    const local = {
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: siteKey,
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
    };
    expect(safeParseEnv(local).success).toBe(true);
  });

  it("rejects a malformed privacy notice version without echoing it", () => {
    const result = safeParseEnv({ ...complete, ENQUIRY_PRIVACY_NOTICE_VERSION: "bad version!" });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain("bad version!");
  });
});

describe("cross-field rules", () => {
  it("requires Supabase credentials for the supabase backend", () => {
    expect(issuePaths({ VITALOS_ENQUIRY_BACKEND: "supabase" }).sort()).toEqual([
      "SUPABASE_SECRET_KEY",
      "SUPABASE_URL",
    ]);
  });

  it("defaults the backend to supabase when credentials are present", () => {
    const env = parseEnv({
      SUPABASE_URL: "https://project.example.invalid",
      SUPABASE_SECRET_KEY: "x".repeat(24),
    });
    expect(env.enquiry.backend).toBe("supabase");
  });

  it("requires Turnstile keys as a pair", () => {
    expect(issuePaths({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x0000000000000000" })).toEqual([
      "TURNSTILE_SECRET_KEY",
    ]);
    expect(issuePaths({ TURNSTILE_SECRET_KEY: "1x0000000000000000" })).toEqual([
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    ]);
  });

  it("treats empty values (FOO=) as unset", () => {
    const env = parseEnv({
      SUPABASE_URL: "  ",
      VITALOS_CONTENT_SOURCE: "",
    });
    expect(env.contentSource).toBe("repo");
    expect(env.supabase.url).toBeUndefined();
  });

  it("rejects malformed values without echoing them", () => {
    const secret = "not-a-url-secret-value";
    const result = safeParseEnv({ SUPABASE_URL: secret });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(() => parseEnv({ SUPABASE_URL: secret })).toThrow(EnvValidationError);
    try {
      parseEnv({ SUPABASE_URL: secret });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});

describe("site URL", () => {
  it.each([
    "ftp://x.invalid",
    "https://x.invalid/path",
    "https://x.invalid/?q=1",
    "https://x.invalid#frag",
    "https://x.invalid?",
    "not a url",
  ])("rejects %s", (value) => {
    expect(issuePaths({ NEXT_PUBLIC_SITE_URL: value })).toEqual(["NEXT_PUBLIC_SITE_URL"]);
  });

  it("normalises to the origin", () => {
    expect(parseEnv({ NEXT_PUBLIC_SITE_URL: "https://WWW.Example.invalid/" }).siteUrl).toBe(
      "https://www.example.invalid",
    );
    expect(parseEnv({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }).siteUrl).toBe(
      "http://localhost:3000",
    );
  });
});

describe("feature flags", () => {
  it("are all off for an empty environment", () => {
    expect(deriveFeatures(parseEnv({}))).toEqual({
      turnstile: false,
      enquiryPersistence: false,
      emailNotifications: false,
      indexable: false,
      content: false,
      relay: false,
    });
  });

  it("turn on from configuration", () => {
    const env = parseEnv({
      ...production,
      VITALOS_CONTENT_SOURCE: "repo",
      VITALOS_ENQUIRY_BACKEND: "supabase",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAAfixturesitekey",
      TURNSTILE_SECRET_KEY: "0x4AAAAAAAfixturesecretkey",
      ENQUIRY_IP_HASH_SALT: "s".repeat(24),
      ENQUIRY_PRIVACY_NOTICE_VERSION: "2026-10",
      SUPABASE_URL: "https://project.example.invalid",
      SUPABASE_SECRET_KEY: "x".repeat(24),
      EMAIL_PROVIDER_API_KEY: "key",
    });
    expect(deriveFeatures(env)).toEqual({
      turnstile: true,
      enquiryPersistence: true,
      emailNotifications: false,
      indexable: true,
      content: false,
      relay: false,
    });
  });

  it("only enable email notifications with a provider and a recipient", () => {
    const env = parseEnv({
      EMAIL_PROVIDER: "console",
      ENQUIRY_NOTIFICATION_TO: "a@example.invalid",
    });
    expect(deriveFeatures(env).emailNotifications).toBe(true);
  });
});

describe("entries", () => {
  it("server entry loads under Vitest via the server-only alias", () => {
    expect(readServerEnv({}).deployEnv).toBe("local");
    expect(typeof features.indexable).toBe("boolean");
  });

  it("build entry exposes only non-secret values", () => {
    const build = readBuildEnv({
      ...production,
      SUPABASE_URL: "https://project.example.invalid",
      SUPABASE_SECRET_KEY: "x".repeat(24),
    });
    expect(build.indexable).toBe(true);
    expect(Object.keys(build).sort()).toEqual([
      "careersUploadOrigin",
      "contentApiOrigin",
      "contentMediaOrigin",
      "contentSource",
      "deployEnv",
      "enableHsts",
      "indexable",
      "relayEnabled",
      "relayRealtimeOrigin",
      "siteUrl",
      "siteVerification",
      "turnstileEnabled",
    ]);
  });

  it("build entry carries the public search verification tokens and nothing else from search", () => {
    const build = readBuildEnv({
      ...production,
      GOOGLE_SITE_VERIFICATION: "example-google-token",
      BING_SITE_VERIFICATION: "EXAMPLEBINGTOKEN01",
      INDEXNOW_KEY: "example-indexnow-key",
    });
    expect(build.siteVerification).toEqual({
      google: "example-google-token",
      bing: "EXAMPLEBINGTOKEN01",
    });
    expect(JSON.stringify(build)).not.toContain("example-indexnow-key");
  });

  it("rejects a whole meta tag where a verification token is expected", () => {
    expect(() =>
      readBuildEnv({
        ...production,
        GOOGLE_SITE_VERIFICATION: '<meta name="google-site-verification" content="x">',
      }),
    ).toThrow(EnvValidationError);
  });

  it("public entry defaults analytics to none and accepts vercel only", () => {
    const base = { NEXT_PUBLIC_SITE_URL: "https://www.example.invalid" };
    expect(readPublicEnv(base).analyticsProvider).toBe("none");
    expect(
      readPublicEnv({ ...base, NEXT_PUBLIC_ANALYTICS_PROVIDER: "vercel" }).analyticsProvider,
    ).toBe("vercel");
    expect(() => readPublicEnv({ ...base, NEXT_PUBLIC_ANALYTICS_PROVIDER: "ga4" })).toThrow();
  });

  it("build entry fails fast on invalid production config", () => {
    expect(() => readBuildEnv({ ...production, VITALOS_CONTENT_SOURCE: "fixtures" })).toThrow(
      EnvValidationError,
    );
  });

  it("public entry never invents a site URL", () => {
    expect(() => readPublicEnv({})).toThrow(/NEXT_PUBLIC_SITE_URL/);
    expect(() => readPublicEnv({ NEXT_PUBLIC_SITE_URL: "" })).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("public entry reads NEXT_PUBLIC_* only", () => {
    const env = readPublicEnv({
      NEXT_PUBLIC_SITE_URL: "https://www.example.invalid",
      SUPABASE_SECRET_KEY: "x".repeat(24),
    });
    expect(env.siteUrl).toBe("https://www.example.invalid");
    expect(JSON.stringify(env)).not.toContain("xxxx");
  });

  it("build and public entries and the schema never import server-only", () => {
    for (const file of ["build.ts", "public.ts", "schema.ts"]) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      expect(source, file).not.toMatch(/(?:import|from)\s+["']server-only["']/);
    }
  });
});

describe("content API (Insights and Careers)", () => {
  const secret = "s".repeat(40);
  const other = "t".repeat(40);

  it("is not configured by default, with a 600 s cache TTL", () => {
    const env = parseEnv({});
    expect(env.content).toEqual({
      apiBaseUrl: undefined,
      readKey: undefined,
      submitKey: undefined,
      revalidateKeys: [],
      renderKeys: [],
      previewKeys: [],
      cacheTtlSeconds: 600,
      mediaOrigin: undefined,
      uploadOrigin: undefined,
      tickSecret: undefined,
    });
    expect(deriveFeatures(env).content).toBe(false);
  });

  it("reads the base URL, single keys and key lists", () => {
    const env = parseEnv({
      CONTENT_API_BASE_URL: "https://admin.example.invalid/",
      CONTENT_READ_KEY_ID: "web-read-1",
      CONTENT_READ_SECRET: secret,
      CAREERS_SUBMIT_KEY_ID: "web-submit-1",
      CAREERS_SUBMIT_SECRET: other,
      CONTENT_REVALIDATE_SECRET: `rev-2:${other}, rev-1:${secret}`,
      CONTENT_RENDER_SECRET: `render-1:${secret}`,
      CONTENT_PREVIEW_SECRET: `preview-1:${secret}`,
      CONTENT_CACHE_TTL_SECONDS: "120",
      CONTENT_MEDIA_HOST: "media.example.invalid",
      CAREERS_UPLOAD_HOST: "https://uploads.example.invalid",
    });
    expect(env.content.apiBaseUrl).toBe("https://admin.example.invalid");
    expect(env.content.readKey).toEqual({ id: "web-read-1", secret });
    expect(env.content.submitKey).toEqual({ id: "web-submit-1", secret: other });
    expect(env.content.revalidateKeys).toEqual([
      { id: "rev-2", secret: other },
      { id: "rev-1", secret },
    ]);
    expect(env.content.cacheTtlSeconds).toBe(120);
    expect(env.content.mediaOrigin).toBe("https://media.example.invalid");
    expect(env.content.uploadOrigin).toBe("https://uploads.example.invalid");
    expect(deriveFeatures(env).content).toBe(true);
    const build = readBuildEnv({
      CONTENT_MEDIA_HOST: "media.example.invalid",
      CAREERS_UPLOAD_HOST: "uploads.example.invalid",
    });
    expect(build.contentMediaOrigin).toBe("https://media.example.invalid");
    expect(build.careersUploadOrigin).toBe("https://uploads.example.invalid");
    expect(JSON.stringify(build)).not.toContain("ssss");
  });

  it("requires the read key once the base URL is set, and key ids with their secrets", () => {
    expect(issuePaths({ CONTENT_API_BASE_URL: "https://admin.example.invalid" }).sort()).toEqual([
      "CONTENT_READ_KEY_ID",
      "CONTENT_READ_SECRET",
    ]);
    expect(issuePaths({ CONTENT_READ_KEY_ID: "web-read-1" })).toEqual(["CONTENT_READ_SECRET"]);
    expect(issuePaths({ CAREERS_SUBMIT_SECRET: secret })).toEqual(["CAREERS_SUBMIT_KEY_ID"]);
  });

  it("rejects malformed key lists without echoing them", () => {
    for (const value of [
      "no-colon",
      `UPPER:${secret}`,
      "short:abc",
      `a:${secret},a:${other}`,
      `:${secret}`,
    ]) {
      const result = safeParseEnv({ CONTENT_REVALIDATE_SECRET: value });
      expect(result.success, value).toBe(false);
      if (!result.success) {
        expect(result.issues.map((issue) => issue.path)).toEqual(["CONTENT_REVALIDATE_SECRET"]);
        expect(JSON.stringify(result.issues)).not.toContain("sss");
      }
    }
  });

  it("bounds the cache TTL and rejects non-numbers", () => {
    expect(issuePaths({ CONTENT_CACHE_TTL_SECONDS: "5" })).toEqual(["CONTENT_CACHE_TTL_SECONDS"]);
    expect(issuePaths({ CONTENT_CACHE_TTL_SECONDS: "ten" })).toEqual(["CONTENT_CACHE_TTL_SECONDS"]);
  });

  it("requires https for the admin, media and upload hosts in production", () => {
    expect(
      issuePaths({
        ...production,
        CONTENT_API_BASE_URL: "http://admin.example.invalid",
        CONTENT_READ_KEY_ID: "web-read-1",
        CONTENT_READ_SECRET: secret,
        CONTENT_MEDIA_HOST: "http://media.example.invalid",
        CAREERS_UPLOAD_HOST: "http://uploads.example.invalid",
      }).sort(),
    ).toEqual(["CAREERS_UPLOAD_HOST", "CONTENT_API_BASE_URL", "CONTENT_MEDIA_HOST"]);
    // Plain http is fine for local runs.
    expect(
      issuePaths({
        CONTENT_API_BASE_URL: "http://127.0.0.1:8010",
        CONTENT_READ_KEY_ID: "web-read-1",
        CONTENT_READ_SECRET: secret,
      }),
    ).toEqual([]);
  });

  it("rejects a media host with a path", () => {
    expect(issuePaths({ CONTENT_MEDIA_HOST: "https://media.example.invalid/content" })).toEqual([
      "CONTENT_MEDIA_HOST",
    ]);
  });
});

describe("Vitalos Relay", () => {
  const base = {
    RELAY_ENABLED: "true",
    RELAY_TOKEN_PEPPER: "p".repeat(40),
    RELAY_IP_SALT: "s".repeat(20),
  };
  const prod = {
    ...production,
    ...base,
    SUPABASE_URL: "https://project.example.invalid",
    SUPABASE_SECRET_KEY: "x".repeat(24),
    RELAY_LLM_PROVIDER: "deepseek",
    DEEPSEEK_API_KEY: "sk-fixture-fixture-fixture",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAAfixturesitekey",
    TURNSTILE_SECRET_KEY: "0x4AAAAAAAfixturesecretkey",
    RELAY_ADMIN_API_SECRET: "a".repeat(40),
    RELAY_WEBHOOK_SECRET: "w".repeat(40),
    RELAY_SUPERADMIN_WEBHOOK_URL: "https://admin.example.invalid/api/inbound/relay",
  };

  it("is off by default and needs nothing then", () => {
    const env = parseEnv({});
    expect(env.relay.enabled).toBe(false);
    expect(env.relay.store).toBe("memory");
    expect(env.relay.provider).toBe("mock");
    expect(issuePaths(production)).toEqual([]);
  });

  it("requires the token pepper and IP salt when enabled", () => {
    expect(issuePaths({ RELAY_ENABLED: "true" }).sort()).toEqual([
      "RELAY_IP_SALT",
      "RELAY_TOKEN_PEPPER",
    ]);
    expect(issuePaths(base)).toEqual([]);
  });

  it("is complete in production with every secret and forbids mock and memory there", () => {
    expect(issuePaths(prod)).toEqual([]);
    expect(issuePaths({ ...prod, RELAY_LLM_PROVIDER: "mock" })).toEqual(["RELAY_LLM_PROVIDER"]);
    expect(issuePaths({ ...prod, RELAY_STORE: "memory" })).toEqual(["RELAY_STORE"]);
    const { RELAY_ADMIN_API_SECRET: _a, RELAY_SUPERADMIN_WEBHOOK_URL: _w, ...missing } = prod;
    void _a;
    void _w;
    expect(issuePaths(missing).sort()).toEqual([
      "RELAY_ADMIN_API_SECRET",
      "RELAY_SUPERADMIN_WEBHOOK_URL",
    ]);
  });

  it("rejects retired DeepSeek models and needs a key for the deepseek provider", () => {
    expect(issuePaths({ ...base, RELAY_MODEL: "deepseek-chat" })).toEqual(["RELAY_MODEL"]);
    expect(issuePaths({ ...base, RELAY_LLM_PROVIDER: "deepseek" })).toEqual(["DEEPSEEK_API_KEY"]);
  });

  it("gates the FAQ on the hub page only in production by default", () => {
    expect(parseEnv(prod).relay.faqRequireHubActive).toBe(true);
    expect(parseEnv(base).relay.faqRequireHubActive).toBe(false);
  });

  it("allows the site origin and production domains, and exposes the realtime origin to the build", () => {
    expect(parseEnv(prod).relay.allowedOrigins).toEqual(
      expect.arrayContaining(["https://www.example.invalid", "https://www.vitalos.co.uk"]),
    );
    const build = readBuildEnv({
      ...prod,
      RELAY_REALTIME_PUBLIC_KEY: "sb_publishable_fixture_fixture",
    });
    expect(build.relayEnabled).toBe(true);
    expect(build.relayRealtimeOrigin).toBe("wss://project.example.invalid");
    expect(JSON.stringify(build)).not.toContain("sb_publishable_fixture");
  });

  it("never echoes secret values in errors", () => {
    const result = safeParseEnv({ ...prod, RELAY_ADMIN_API_SECRET: "short-secret-value" });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain("short-secret-value");
  });
});

describe("site presentation flags (ADR-045)", () => {
  it("keeps production and local on the current navigation, no podcast and no Founder section", () => {
    for (const source of [{}, { VERCEL_ENV: "production", ...explicitProductionChoices }]) {
      expect(parseEnv(source).site).toEqual({
        navVariant: "current",
        podcastEnabled: false,
        aboutFounderEnabled: false,
      });
    }
  });

  it("shows the IA navigation and the Founder section on Vercel previews when unset", () => {
    const env = parseEnv({ VERCEL_ENV: "preview", ...explicitProductionChoices });
    expect(env.site).toEqual({
      navVariant: "ia",
      podcastEnabled: false,
      aboutFounderEnabled: true,
    });
  });

  it("lets each variable override its default", () => {
    const env = parseEnv({
      VERCEL_ENV: "preview",
      ...explicitProductionChoices,
      NEXT_PUBLIC_NAV_VARIANT: "current",
      PODCAST_ENABLED: "true",
      ABOUT_FOUNDER_ENABLED: "false",
    });
    expect(env.site).toEqual({
      navVariant: "current",
      podcastEnabled: true,
      aboutFounderEnabled: false,
    });
    expect(parseEnv({ NEXT_PUBLIC_NAV_VARIANT: "ia" }).site.navVariant).toBe("ia");
  });

  it("rejects an unknown navigation variant", () => {
    expect(issuePaths({ NEXT_PUBLIC_NAV_VARIANT: "mega" })).toContain("NEXT_PUBLIC_NAV_VARIANT");
    expect(issuePaths({ PODCAST_ENABLED: "yes" })).toContain("PODCAST_ENABLED");
  });
});
