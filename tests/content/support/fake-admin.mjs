// A fake Super Admin content API for the Insights and Careers suites (tests/content). It serves
// the shared contract fixtures (obviously fictional) and verifies every request with scheme v1,
// independently of the website's own signing code, so a drift in either side fails the suite.
//
//   node tests/content/support/fake-admin.mjs [--port 8799]
//
// Control endpoints (test only, unsigned): GET /__hits (request counts), GET /__down?v=1|0
// (drop every connection), GET /__state?insights=0|1&careers=0|1 (open or close the sections).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

export const READ_KEY = { id: "e2e-read", secret: "e2e-read-secret-not-a-secret-000000000000" };
export const PREVIEW_KEY = {
  id: "e2e-preview",
  secret: "e2e-preview-secret-not-a-secret-00000000",
};

const fixturesDir = new URL("../../../contracts/content-api/v1/fixtures/", import.meta.url);
const fixture = (name) => JSON.parse(readFileSync(new URL(`${name}.json`, fixturesDir), "utf8"));

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
  "/api/content/v1/careers/roles/example-role-fixture": () => fixture("role-open"),
  "/api/content/v1/careers/roles/closed-role": () => fixture("role-closed"),
  "/api/content/v1/home": () => (state.insights ? fixture("home") : fixture("home-empty")),
  "/api/content/v1/sitemap": () => fixture("sitemap"),
  "/api/content/v1/preview/post/00000000-0000-4000-8000-000000000101": () =>
    fixture("preview-post"),
};

const state = { insights: true, careers: true, down: false };
const hits = {};

function verified(req, body) {
  const url = new URL(req.url, "http://fake-admin");
  const scope = url.pathname === "/api/content/v1/tick" ? "tick" : "read";
  const timestamp = String(req.headers["x-vitalos-timestamp"] ?? "");
  const canonical = [
    "v1",
    scope,
    timestamp,
    req.method,
    req.url,
    createHash("sha256").update(body).digest("hex"),
  ].join("\n");
  const expected = `v1=${createHmac("sha256", READ_KEY.secret).update(canonical).digest("hex")}`;
  const presented = String(req.headers["x-vitalos-signature"] ?? "");
  return (
    req.headers["x-vitalos-key-id"] === READ_KEY.id &&
    presented.length === expected.length &&
    timingSafeEqual(Buffer.from(presented), Buffer.from(expected)) &&
    Math.abs(Date.now() / 1000 - Number(timestamp)) <= 300
  );
}

export function startFakeAdmin(port = 8799) {
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const url = new URL(req.url, "http://fake-admin");
      const json = (status, value) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(value));
      };
      if (url.pathname === "/__hits") return json(200, hits);
      if (url.pathname === "/__down") {
        state.down = url.searchParams.get("v") === "1";
        return json(200, { down: state.down });
      }
      if (url.pathname === "/__state") {
        for (const key of ["insights", "careers"]) {
          if (url.searchParams.has(key)) state[key] = url.searchParams.get(key) === "1";
        }
        return json(200, state);
      }
      hits[url.pathname] = (hits[url.pathname] ?? 0) + 1;
      if (state.down) return req.socket.destroy();
      if (!verified(req, body)) return json(401, { error: "unauthorized" });
      if (
        url.pathname.startsWith("/api/content/v1/preview/") &&
        !req.headers["x-vitalos-preview-token"]
      ) {
        return json(401, { error: "unauthorized" });
      }
      if (url.pathname === "/api/content/v1/tick") {
        return json(200, { promoted: 0, closed: 0, delivered: 0, nextDueAt: null });
      }
      const route = routes[url.pathname];
      if (!route) return json(404, { error: "not found" });
      return json(200, route());
    });
  });
  server.listen(port, "127.0.0.1");
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const portFlag = process.argv.indexOf("--port");
  const port = portFlag === -1 ? 8799 : Number(process.argv[portFlag + 1]);
  startFakeAdmin(port);
  console.log(`fake admin listening on http://127.0.0.1:${port}`);
}
