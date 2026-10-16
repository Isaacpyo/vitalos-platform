import assert from "node:assert/strict";
import { test } from "node:test";
import { tick } from "../src/index.js";

const env = {
  TICK_URL: "https://www.example.test/api/content/cron/tick",
  TICK_SECRET: "test-secret",
};

test("calls the tick URL with the bearer secret", async () => {
  let seen;
  const result = await tick(env, async (url, init) => {
    seen = { url, init };
    return new Response("{}", { status: 200 });
  });
  assert.deepEqual(result, { ok: true, status: 200 });
  assert.equal(seen.url, env.TICK_URL);
  assert.equal(seen.init.method, "GET");
  assert.equal(seen.init.headers.authorization, "Bearer test-secret");
});

test("refuses when not configured or not https", async () => {
  const never = async () => assert.fail("must not fetch");
  assert.equal((await tick({}, never)).reason, "not-configured");
  assert.equal(
    (await tick({ ...env, TICK_URL: "http://www.example.test/x" }, never)).reason,
    "not-https",
  );
  assert.equal((await tick({ ...env, TICK_URL: "not a url" }, never)).reason, "bad-url");
});

test("reports failures without throwing", async () => {
  assert.deepEqual(await tick(env, async () => new Response("", { status: 503 })), {
    ok: false,
    status: 503,
  });
  const network = await tick(env, async () => {
    throw new TypeError("fetch failed");
  });
  assert.equal(network.reason, "network");
});
