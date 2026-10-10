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
  it("defaults to local with a local site URL and an empty content source", () => {
    const env = parseEnv({});
    expect(env.deployEnv).toBe("local");
    expect(env.siteUrl).toBe("http://localhost:3000");
    expect(env.contentSource).toBe("empty");
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

  it("rejects the memory enquiry backend in production", () => {
    expect(issuePaths({ ...production, VITALOS_ENQUIRY_BACKEND: "memory" })).toEqual([
      "VITALOS_ENQUIRY_BACKEND",
    ]);
    expect(parseEnv({ VITALOS_ENQUIRY_BACKEND: "memory" }).enquiry.backend).toBe("memory");
  });

  it("rejects the console email provider in production", () => {
    expect(issuePaths({ ...production, EMAIL_PROVIDER: "console" })).toEqual(["EMAIL_PROVIDER"]);
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

  it("never falls back to the development Sanity dataset in production", () => {
    const sanity = {
      ...production,
      VITALOS_CONTENT_SOURCE: "sanity",
      NEXT_PUBLIC_SANITY_PROJECT_ID: "abc123",
    };
    expect(issuePaths(sanity)).toEqual(["NEXT_PUBLIC_SANITY_DATASET"]);
    expect(parseEnv({ ...sanity, NEXT_PUBLIC_SANITY_DATASET: "production" }).sanity.dataset).toBe(
      "production",
    );
    // Not required when the source is not sanity, or outside production.
    expect(issuePaths(production)).toEqual([]);
    expect(
      issuePaths({
        VITALOS_CONTENT_SOURCE: "sanity",
        NEXT_PUBLIC_SANITY_PROJECT_ID: "abc123",
      }),
    ).toEqual([]);
  });

  it("rejects local or preview deploy env overrides on a Vercel production deployment", () => {
    for (const override of ["local", "preview"]) {
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
  it("requires a Sanity project id when the content source is sanity", () => {
    expect(issuePaths({ VITALOS_CONTENT_SOURCE: "sanity" })).toEqual([
      "NEXT_PUBLIC_SANITY_PROJECT_ID",
    ]);
  });

  it("defaults the content source to sanity when a project id is present", () => {
    const env = parseEnv({ NEXT_PUBLIC_SANITY_PROJECT_ID: "abc123" });
    expect(env.contentSource).toBe("sanity");
    expect(env.sanity.dataset).toBe("development");
  });

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
      NEXT_PUBLIC_SANITY_PROJECT_ID: "",
      SUPABASE_URL: "  ",
      VITALOS_CONTENT_SOURCE: "",
    });
    expect(env.contentSource).toBe("empty");
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

  it("applies the same origin rule to the Studio origin", () => {
    expect(issuePaths({ SANITY_STUDIO_ORIGIN: "https://studio.example.invalid/desk" })).toEqual([
      "SANITY_STUDIO_ORIGIN",
    ]);
  });
});

describe("feature flags", () => {
  it("are all off for an empty environment", () => {
    expect(deriveFeatures(parseEnv({}))).toEqual({
      cms: false,
      turnstile: false,
      enquiryPersistence: false,
      emailNotifications: false,
      indexable: false,
    });
  });

  it("turn on from configuration", () => {
    const env = parseEnv({
      ...production,
      VITALOS_CONTENT_SOURCE: "sanity",
      VITALOS_ENQUIRY_BACKEND: "supabase",
      NEXT_PUBLIC_SANITY_DATASET: "production",
      NEXT_PUBLIC_SANITY_PROJECT_ID: "abc123",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x4AAAAAAAfixturesitekey",
      TURNSTILE_SECRET_KEY: "0x4AAAAAAAfixturesecretkey",
      ENQUIRY_IP_HASH_SALT: "s".repeat(24),
      ENQUIRY_PRIVACY_NOTICE_VERSION: "2026-10",
      SUPABASE_URL: "https://project.example.invalid",
      SUPABASE_SECRET_KEY: "x".repeat(24),
      EMAIL_PROVIDER_API_KEY: "key",
      ENQUIRY_NOTIFICATION_TO: "ops@example.invalid",
    });
    expect(deriveFeatures(env)).toEqual({
      cms: true,
      turnstile: true,
      enquiryPersistence: true,
      emailNotifications: false,
      indexable: true,
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
      "contentSource",
      "deployEnv",
      "enableHsts",
      "indexable",
      "sanityProjectId",
      "sanityStudioOrigin",
      "siteUrl",
      "turnstileEnabled",
    ]);
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
    expect(env.sanityApiVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("build and public entries and the schema never import server-only", () => {
    for (const file of ["build.ts", "public.ts", "schema.ts"]) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      expect(source, file).not.toMatch(/(?:import|from)\s+["']server-only["']/);
    }
  });
});
