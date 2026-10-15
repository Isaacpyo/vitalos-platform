// Shared settings for the two-app content suites (tests/content-sync). Both apps run locally:
// the real Super Admin (Django, SQLite) and a production build of the website. Two small proxies
// sit in front of them so a spec can take either side "down" without stopping a server:
//
//   website ──read──▶ ADMIN_PROXY (8021) ──▶ admin (8020)
//   admin ──revalidate/render──▶ web (3230) and WEB_PROXY (3231) ──▶ web (3230)
//
// Every key below is a test-only value that protects nothing. Never reuse them anywhere else.

export const ADMIN_PORT = Number(process.env.SYNC_E2E_ADMIN_PORT ?? 8020);
export const ADMIN_PROXY_PORT = ADMIN_PORT + 1;
export const WEB_PORT = Number(process.env.SYNC_E2E_WEB_PORT ?? 3230);
export const WEB_PROXY_PORT = WEB_PORT + 1;
export const CONTROL_PORT = Number(process.env.SYNC_E2E_CONTROL_PORT ?? 8029);

export const ADMIN_URL = `http://127.0.0.1:${ADMIN_PORT}`;
export const ADMIN_PROXY_URL = `http://127.0.0.1:${ADMIN_PROXY_PORT}`;
export const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
export const WEB_PROXY_URL = `http://127.0.0.1:${WEB_PROXY_PORT}`;
export const CONTROL_URL = `http://127.0.0.1:${CONTROL_PORT}`;

export const ADMIN_EMAIL = "e2e-admin@example.test";
export const ADMIN_PASSWORD = "example-e2e-password-not-a-secret";

const READ = ["e2e-read", "e2e-read-secret-not-a-secret-000000000000"];
const SUBMIT = ["e2e-submit", "e2e-submit-secret-not-a-secret-0000000000"];
export const REVALIDATE = "e2e-revalidate:e2e-revalidate-secret-not-a-secret-000";
const RENDER = "e2e-render:e2e-render-secret-not-a-secret-000000000";
const PREVIEW = "e2e-preview:e2e-preview-secret-not-a-secret-00000000";
export const CRON_SECRET = "e2e-cron-secret-not-a-secret-00000000000";
export const READ_KEY = { id: READ[0], secret: READ[1] };

export const adminEnv = {
  DJANGO_SETTINGS_MODULE: "config.settings.dev",
  APP_ENVIRONMENT: "development",
  APP_BASE_URL: ADMIN_URL,
  ALLOWED_HOSTS: "127.0.0.1,localhost",
  CSRF_TRUSTED_ORIGINS: ADMIN_URL,
  OTP_REQUIRED_FOR_SUPERADMIN: "false",
  EMAIL_TRANSPORT: "log",
  LOG_FORMAT: "text",
  // The suites drive the tick themselves (as the Worker would); no background tick.
  CONTENT_OPPORTUNISTIC_TICK: "false",
  CONTENT_WEB_TARGETS: `${WEB_URL},${WEB_PROXY_URL}`,
  CONTENT_READ_CLIENT_KEYS: READ.join(":"),
  CAREERS_SUBMIT_CLIENT_KEYS: SUBMIT.join(":"),
  CONTENT_REVALIDATE_SECRET: REVALIDATE,
  CONTENT_RENDER_SECRET: RENDER,
  CONTENT_PREVIEW_SECRET: PREVIEW,
  CONTENT_IP_SALT: "e2e-ip-salt-not-a-secret",
  CONTENT_READ_RATE_LIMIT: "100000",
  E2E_ADMIN_EMAIL: ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD: ADMIN_PASSWORD,
};

export const webEnv = {
  NEXT_PUBLIC_SITE_URL: WEB_URL,
  VITALOS_DEPLOY_ENV: "local",
  VITALOS_CONTENT_SOURCE: "fixtures",
  VITALOS_ENQUIRY_BACKEND: "memory",
  ENQUIRY_IP_HASH_SALT: "e2e-only-ip-hash-salt-not-a-secret",
  EMAIL_PROVIDER: "none",
  CRON_SECRET,
  CONTENT_API_BASE_URL: ADMIN_PROXY_URL,
  CONTENT_READ_KEY_ID: READ[0],
  CONTENT_READ_SECRET: READ[1],
  CAREERS_SUBMIT_KEY_ID: SUBMIT[0],
  CAREERS_SUBMIT_SECRET: SUBMIT[1],
  CONTENT_REVALIDATE_SECRET: REVALIDATE,
  CONTENT_RENDER_SECRET: RENDER,
  CONTENT_PREVIEW_SECRET: PREVIEW,
  CONTENT_CACHE_TTL_SECONDS: process.env.SYNC_E2E_TTL ?? "600",
  CONTENT_MEDIA_HOST: ADMIN_URL,
  CAREERS_UPLOAD_HOST: ADMIN_URL,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000BB",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
};
