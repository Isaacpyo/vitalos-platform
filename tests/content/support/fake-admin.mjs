// A fake Super Admin content API for the Insights and Careers suites (tests/content). It serves
// the shared contract fixtures (obviously fictional) and verifies every signed request with
// scheme v1, independently of the website's own signing code, so a drift in either side fails the
// suite. It also plays the careers intake (brief A9): upload tickets, the fallback PUT upload
// target (single-use token, exact size, CORS for the website origin) and applications.
//
//   node tests/content/support/fake-admin.mjs [--port 8799] [--web-origin http://127.0.0.1:3220]
//
// Control endpoints (test only, unsigned): GET /__hits (request counts), GET /__down?v=1|0
// (drop every connection), GET /__state?insights=0|1&careers=0|1 (open or close the sections),
// GET /__roles?close={slug} or ?open={slug} (close a role for the intake only, as if it closed
// after the page was cached).
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

export const READ_KEY = { id: "e2e-read", secret: "e2e-read-secret-not-a-secret-000000000000" };
export const SUBMIT_KEY = { id: "e2e-submit", secret: "e2e-submit-secret-not-a-secret-0000000000" };
export const PREVIEW_KEY = {
  id: "e2e-preview",
  secret: "e2e-preview-secret-not-a-secret-00000000",
};

const fixturesDir = new URL("../../../contracts/content-api/v1/fixtures/", import.meta.url);
const fixture = (name) => JSON.parse(readFileSync(new URL(`${name}.json`, fixturesDir), "utf8"));

const CV_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
const MAX_CV = 10 * 1024 * 1024;

const state = { insights: true, careers: true, down: false };
const closedForIntake = new Set();
const tickets = new Map();
const applications = new Map();
const hits = {};

const openRole = (slug) => ({ ...fixture("role-open"), slug });
const intakeRoles = new Set(["example-role-fixture", "example-role-closing"]);

const routes = {
  "/api/content/v1/site-state": () => ({
    ...fixture("site-state"),
    insightsOpen: state.insights,
    careersOpen: state.careers,
  }),
  "/api/content/v1/insights/posts": () => fixture("post-page"),
  "/api/content/v1/insights/posts/example-post-1": () => fixture("post-detail"),
  "/api/content/v1/insights/posts/old-slug": () => fixture("redirect"),
  "/api/content/v1/insights/authors/example-author": () => fixture("author"),
  "/api/content/v1/insights/topics": () => fixture("topics"),
  "/api/content/v1/insights/topics/example-topic": () => fixture("topic"),
  "/api/content/v1/insights/feed": () => fixture("feed"),
  "/api/content/v1/careers/page": () => fixture("careers-page"),
  "/api/content/v1/careers/roles/example-role-fixture": () => openRole("example-role-fixture"),
  "/api/content/v1/careers/roles/example-role-closing": () => openRole("example-role-closing"),
  "/api/content/v1/careers/roles/closed-role": () => ({
    ...fixture("role-closed"),
    slug: "closed-role",
  }),
  "/api/content/v1/careers/roles/old-role": () => ({ redirect: "example-role-fixture" }),
  "/api/content/v1/home": () => (state.insights ? fixture("home") : fixture("home-empty")),
  "/api/content/v1/sitemap": () => fixture("sitemap"),
  "/api/content/v1/preview/post/00000000-0000-4000-8000-000000000101": () =>
    fixture("preview-post"),
};

function verified(req, body, scope, key) {
  const timestamp = String(req.headers["x-vitalos-timestamp"] ?? "");
  const canonical = [
    "v1",
    scope,
    timestamp,
    req.method,
    req.url,
    createHash("sha256").update(body).digest("hex"),
  ].join("\n");
  const expected = `v1=${createHmac("sha256", key.secret).update(canonical).digest("hex")}`;
  const presented = String(req.headers["x-vitalos-signature"] ?? "");
  return (
    req.headers["x-vitalos-key-id"] === key.id &&
    presented.length === expected.length &&
    timingSafeEqual(Buffer.from(presented), Buffer.from(expected)) &&
    Math.abs(Date.now() / 1000 - Number(timestamp)) <= 300
  );
}

const isPdf = (data) => data.subarray(0, 5).toString("latin1") === "%PDF-";
const isZip = (data) => data.subarray(0, 4).toString("latin1") === "PK\u0003\u0004";

export function startFakeAdmin(port = 8799, webOrigin = "http://127.0.0.1:3220") {
  const base = `http://127.0.0.1:${port}`;
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const url = new URL(req.url, base);
      const send = (status, value, headers = {}) => {
        res.writeHead(status, { "content-type": "application/json", ...headers });
        res.end(value === undefined ? undefined : JSON.stringify(value));
      };
      if (url.pathname === "/__hits") return send(200, hits);
      if (url.pathname === "/__down") {
        state.down = url.searchParams.get("v") === "1";
        return send(200, { down: state.down });
      }
      if (url.pathname === "/__state") {
        for (const key of ["insights", "careers"]) {
          if (url.searchParams.has(key)) state[key] = url.searchParams.get(key) === "1";
        }
        return send(200, state);
      }
      if (url.pathname === "/__roles") {
        const close = url.searchParams.get("close");
        const open = url.searchParams.get("open");
        if (close) closedForIntake.add(close);
        if (open) closedForIntake.delete(open);
        return send(200, { closed: [...closedForIntake] });
      }
      hits[url.pathname] = (hits[url.pathname] ?? 0) + 1;
      if (state.down) return req.socket.destroy();

      // The browser's CV upload (unsigned: the token is the capability; CORS for the website).
      const upload = /^\/api\/careers\/v1\/uploads\/([0-9a-f-]{36})$/.exec(url.pathname);
      if (upload) {
        const origin = String(req.headers.origin ?? "");
        const cors =
          origin === webOrigin
            ? {
                "access-control-allow-origin": origin,
                "access-control-allow-methods": "PUT, OPTIONS",
                "access-control-allow-headers": "Content-Type",
                vary: "Origin",
              }
            : { vary: "Origin" };
        if (origin && origin !== webOrigin) return send(403, { error: "Origin not allowed" }, cors);
        if (req.method === "OPTIONS") return send(204, undefined, cors);
        const ticket = tickets.get(upload[1]);
        if (req.method !== "PUT" || !ticket || url.searchParams.get("token") !== ticket.token) {
          return send(403, { error: "Invalid upload token" }, cors);
        }
        if (ticket.uploaded) return send(403, { error: "This upload link has been used" }, cors);
        if (String(req.headers["content-type"] ?? "").split(";")[0] !== ticket.mime) {
          return send(400, { error: "Wrong content type" }, cors);
        }
        if (body.length !== ticket.size) return send(400, { error: "Size mismatch" }, cors);
        const ok = ticket.mime === "application/pdf" ? isPdf(body) : isZip(body);
        if (!ok) return send(400, { error: "Not a PDF or Word document" }, cors);
        ticket.uploaded = true;
        return send(204, undefined, cors);
      }

      const careers = url.pathname.startsWith("/api/careers/v1/");
      const scope = careers ? "submit" : url.pathname === "/api/content/v1/tick" ? "tick" : "read";
      const key = careers ? SUBMIT_KEY : READ_KEY;
      if (!verified(req, body, scope, key)) return send(401, { error: "unauthorized" });

      if (url.pathname === "/api/careers/v1/upload-tickets") {
        const data = JSON.parse(body.toString("utf8") || "{}");
        const errors = {};
        if (!intakeRoles.has(data.roleSlug)) errors.roleSlug = "invalid";
        if (!CV_TYPES[data.mime]) errors.mime = "upload_type";
        else if (
          !String(data.filename ?? "")
            .toLowerCase()
            .endsWith(`.${CV_TYPES[data.mime]}`)
        ) {
          errors.filename = "upload_type";
        }
        if (!Number.isInteger(data.size) || data.size < 1) errors.size = "invalid";
        else if (data.size > MAX_CV) errors.size = "upload_size";
        if (Object.keys(errors).length) return send(400, { errors });
        if (closedForIntake.has(data.roleSlug))
          return send(409, { errors: { roleSlug: "role_closed" } });
        const id = randomUUID();
        const token = randomUUID().replace(/-/g, "");
        tickets.set(id, {
          roleSlug: data.roleSlug,
          mime: data.mime,
          size: data.size,
          token,
          uploaded: false,
        });
        return send(201, {
          uploadId: id,
          uploadUrl: `${base}/api/careers/v1/uploads/${id}?token=${token}`,
          method: "PUT",
          headers: { "Content-Type": data.mime },
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        });
      }

      if (url.pathname === "/api/careers/v1/applications") {
        const data = JSON.parse(body.toString("utf8") || "{}");
        const existing = applications.get(data.submissionId);
        if (existing) return send(200, existing);
        if (closedForIntake.has(data.roleSlug))
          return send(409, { errors: { roleSlug: "role_closed" } });
        const ticket = tickets.get(data.uploadId);
        if (!ticket || !ticket.uploaded)
          return send(422, { errors: { uploadId: "upload_missing" } });
        const accepted = {
          applicationId: randomUUID(),
          roleTitle: "Example role (fixture)",
          process: "Example hiring process (fixture).",
        };
        applications.set(data.submissionId, accepted);
        return send(201, accepted);
      }

      if (
        url.pathname.startsWith("/api/content/v1/preview/") &&
        !req.headers["x-vitalos-preview-token"]
      ) {
        return send(401, { error: "unauthorized" });
      }
      if (url.pathname === "/api/content/v1/tick") {
        return send(200, { promoted: 0, closed: 0, delivered: 0, nextDueAt: null });
      }
      const route = routes[url.pathname];
      if (!route) return send(404, { error: "not found" });
      return send(200, route());
    });
  });
  server.listen(port, "127.0.0.1");
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const flag = (name, fallback) => {
    const index = process.argv.indexOf(name);
    return index === -1 ? fallback : process.argv[index + 1];
  };
  const port = Number(flag("--port", "8799"));
  startFakeAdmin(port, flag("--web-origin", "http://127.0.0.1:3220"));
  console.log(`fake admin listening on http://127.0.0.1:${port}`);
}
