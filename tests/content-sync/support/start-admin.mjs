// Starts the real Super Admin for tests/content-sync: a fresh SQLite database, migrations, the
// fixture seed (tests/content-sync/support/seed.py), then `runserver`. Run from the repo root.
// Writes the seed (ids and slugs) to test-results/content-sync/seed.json for the specs.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ADMIN_PORT, adminEnv } from "./env.mjs";

const root = resolve(".");
const superadmin = join(root, "superadmin");
const python = [
  join(superadmin, ".venv", "Scripts", "python.exe"),
  join(superadmin, ".venv", "bin", "python"),
].find((candidate) => existsSync(candidate));
if (!python) {
  console.error("No superadmin/.venv found: create it and install requirements-dev.txt first");
  process.exit(1);
}

const state = join(root, "test-results", "content-sync");
mkdirSync(state, { recursive: true });
const database = join(state, "admin.sqlite3");
rmSync(database, { force: true });

const env = {
  ...process.env,
  ...adminEnv,
  DATABASE_URL: `sqlite:///${database.replaceAll("\\", "/")}`,
  E2E_SEED_POSTS: process.env.E2E_SEED_POSTS ?? "30",
};
const run = (args) => {
  const result = spawnSync(python, ["manage.py", ...args], {
    cwd: superadmin,
    env,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stdout, result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
};

run(["migrate", "-v0"]);
const seedPath = join(root, "tests", "content-sync", "support", "seed.py").replaceAll("\\", "/");
const output = run(["shell", "-c", `exec(open(${JSON.stringify(seedPath)}).read())`]);
const line = output.split("\n").find((entry) => entry.startsWith("SEED_JSON "));
if (!line) {
  console.error("seed.py printed no SEED_JSON line");
  process.exit(1);
}
writeFileSync(join(state, "seed.json"), line.slice("SEED_JSON ".length));

const server = spawn(python, ["manage.py", "runserver", `127.0.0.1:${ADMIN_PORT}`, "--noreload"], {
  cwd: superadmin,
  env,
  stdio: "inherit",
});
const stop = () => server.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => process.exit(code ?? 0));
