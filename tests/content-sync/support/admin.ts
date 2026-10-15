import { createHash, createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { request, type APIRequestContext, type Page } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_URL,
  CONTROL_URL,
  CRON_SECRET,
  READ_KEY,
  REVALIDATE,
  WEB_URL,
  adminEnv,
} from "./env.mjs";

export interface SeedPost {
  id: string;
  slug: string;
  title: string;
}
export interface Seed {
  posts: SeedPost[];
  author: string;
  topic: string;
  role: SeedPost;
}

export function readSeed(): Seed {
  const path = join(process.cwd(), "test-results", "content-sync", "seed.json");
  return JSON.parse(readFileSync(path, "utf8")) as Seed;
}

const CHECKS = ["authors", "claims", "citations", "images", "seo"];

function csrfFrom(html: string): string {
  const match = /name="csrfmiddlewaretoken" value="([^"]+)"/.exec(html);
  if (!match?.[1]) throw new Error("No CSRF token on the admin page");
  return match[1];
}

/** A signed-in session on the local Super Admin, driven over HTTP like the browser forms. */
export class Admin {
  private constructor(
    readonly api: APIRequestContext,
    private csrf: string,
  ) {}

  static async signIn(): Promise<Admin> {
    const api = await request.newContext({ baseURL: ADMIN_URL });
    const login = await api.get("/login/");
    const token = csrfFrom(await login.text());
    const response = await api.post("/login/", {
      form: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, csrfmiddlewaretoken: token },
      headers: { referer: `${ADMIN_URL}/login/` },
      maxRedirects: 0,
    });
    if (response.status() !== 302) throw new Error(`Admin sign-in failed: ${response.status()}`);
    const home = await api.get("/insights/posts/");
    return new Admin(api, csrfFrom(await home.text()));
  }

  private async post(path: string, form: Record<string, string> = {}) {
    return this.api.post(path, {
      form: { ...form, csrfmiddlewaretoken: this.csrf },
      headers: { referer: `${ADMIN_URL}${path}` },
      maxRedirects: 0,
    });
  }

  /**
   * Runs a workflow action and returns the moment the admin's success response arrived. Every
   * action answers 302; success or failure is read from the flash message afterwards, so the
   * returned time is the response itself (brief 3.1: measured from the admin's success response).
   */
  async action(postId: string, action: string, form: Record<string, string> = {}): Promise<number> {
    const response = await this.post(`/insights/posts/${postId}/actions/${action}/`, form);
    const at = Date.now();
    if (response.status() !== 302) throw new Error(`${action}: HTTP ${response.status()}`);
    const page = await (await this.api.get(`/insights/posts/${postId}/`)).text();
    const error = /role="status" class="[^"]*rose[^"]*">([^<]+)</.exec(page);
    if (error) throw new Error(`${action} refused: ${error[1]}`);
    return at;
  }

  /** Careers role actions (open, publish, pause, close, reopen, archive); same rules as posts. */
  async roleAction(roleId: string, action: string): Promise<number> {
    const response = await this.post(`/careers/roles/${roleId}/actions/${action}/`);
    const at = Date.now();
    if (response.status() !== 302) throw new Error(`${action}: HTTP ${response.status()}`);
    const page = await (await this.api.get(`/careers/roles/${roleId}/`)).text();
    const error = /role="status" class="[^"]*rose[^"]*">([^<]+)</.exec(page);
    if (error) throw new Error(`${action} refused: ${error[1]}`);
    return at;
  }

  async tickChecks(postId: string): Promise<void> {
    for (const key of CHECKS) {
      const response = await this.post(`/insights/posts/${postId}/checks/${key}/`, {
        checked: "1",
      });
      if (response.status() >= 400) throw new Error(`check ${key}: HTTP ${response.status()}`);
    }
  }

  /** Cookies for a browser page (slug edits go through the real editor and its autosave). */
  async storageState() {
    return this.api.storageState();
  }

  async editorPage(page: Page, postId: string): Promise<void> {
    await page.context().addCookies((await this.api.storageState()).cookies);
    await page.goto(`${ADMIN_URL}/insights/posts/${postId}/`);
  }

  async syncPage(): Promise<string> {
    return (await this.api.get("/content/sync/")).text();
  }

  async dispose() {
    await this.api.dispose();
  }
}

/** Scheme v1 (contracts/content-api/v1/openapi.yaml), for test-side tick and revalidate calls. */
function signedHeaders(
  scope: string,
  method: string,
  path: string,
  body: string,
  id: string,
  secret: string,
) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const canonical = ["v1", scope, timestamp, method, path, bodyHash].join("\n");
  const signature = createHmac("sha256", secret).update(canonical).digest("hex");
  return {
    "content-type": "application/json",
    "x-vitalos-key-id": id,
    "x-vitalos-timestamp": timestamp,
    "x-vitalos-signature": `v1=${signature}`,
  };
}

/** Runs the admin's tick now (what the Worker -> website -> admin chain does when work is due). */
export async function adminTick(): Promise<{
  promoted: number;
  closed: number;
  delivered: number;
}> {
  const path = "/api/content/v1/tick";
  const response = await fetch(`${ADMIN_URL}${path}`, {
    method: "POST",
    body: "{}",
    headers: signedHeaders("tick", "POST", path, "{}", READ_KEY.id, READ_KEY.secret),
  });
  if (!response.ok) throw new Error(`admin tick: HTTP ${response.status}`);
  return (await response.json()) as { promoted: number; closed: number; delivered: number };
}

/** The production trigger path: the Worker calls the website's tick route with CRON_SECRET. */
export async function websiteTick(): Promise<unknown> {
  const response = await fetch(`${WEB_URL}/api/content/cron/tick`, {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  if (!response.ok) throw new Error(`website tick: HTTP ${response.status}`);
  return response.json();
}

/** A signed revalidation, as the admin would send it (used to force a re-render in drills). */
export async function revalidate(kind: "publish" | "remove", tags: string[], paths: string[] = []) {
  const [id, secret] = REVALIDATE.split(":") as [string, string];
  const path = "/api/content/revalidate";
  const body = JSON.stringify({ eventId: crypto.randomUUID(), kind, tags, paths });
  const response = await fetch(`${WEB_URL}${path}`, {
    method: "POST",
    body,
    headers: signedHeaders("revalidate", "POST", path, body, id, secret),
  });
  if (!response.ok) throw new Error(`revalidate: HTTP ${response.status}`);
}

export async function setReachable(side: "admin" | "web", up: boolean) {
  await fetch(`${CONTROL_URL}/${side}/${up ? "up" : "down"}`, { method: "POST" });
}

/** Polls `check` until it returns true; returns the elapsed milliseconds since `from`. */
export async function until(
  check: () => Promise<boolean>,
  from: number,
  timeoutMs: number,
  everyMs = 100,
) {
  for (;;) {
    if (await check()) return Date.now() - from;
    if (Date.now() - from > timeoutMs) throw new Error(`Not reached within ${timeoutMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, everyMs));
  }
}

/** Fetches a website path without following redirects or using any cache on the client side. */
export async function site(path: string) {
  const response = await fetch(`${WEB_URL}${path}`, { redirect: "manual", cache: "no-store" });
  return { status: response.status, text: await response.text(), headers: response.headers };
}

/** Evaluates a Python expression in the admin's E2E database (counts and flags only). */
export function adminQuery(expression: string): string {
  const root = process.cwd();
  const superadmin = join(root, "superadmin");
  const python = [
    join(superadmin, ".venv", "Scripts", "python.exe"),
    join(superadmin, ".venv", "bin", "python"),
  ].find((candidate) => existsSync(candidate));
  if (!python) throw new Error("No superadmin/.venv");
  const database = join(root, "test-results", "content-sync", "admin.sqlite3").replaceAll(
    "\\",
    "/",
  );
  const result = spawnSync(python, ["manage.py", "shell", "-c", `print(${expression})`], {
    cwd: superadmin,
    env: { ...process.env, ...adminEnv, DATABASE_URL: `sqlite:///${database}` },
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`admin query failed: ${result.stderr}`);
  return result.stdout.trim().split("\n").at(-1) ?? "";
}
