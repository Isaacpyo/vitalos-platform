import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";

import worker, { MAX_BODY_BYTES, sign } from "../src/index.js";

const RAW = Buffer.from("From: a@example.com\r\nSubject: Hello\r\n\r\nBody é\r\n", "utf8");
const ENV = {
  INBOUND_WEBHOOK_URL: "https://admin.example.test/api/inbound/email",
  INBOUND_WEBHOOK_SECRET: "test-secret",
  FORWARD_TO: "inbox@example.test",
};

function makeMessage(overrides = {}) {
  const calls = [];
  const message = {
    from: "sender@example.org",
    to: "support@vitalos.co.uk",
    rawSize: RAW.byteLength,
    raw: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(RAW));
        controller.close();
      },
    }),
    async forward(address, headers) {
      calls.push({ address, headers });
    },
    ...overrides,
  };
  return { message, calls };
}

describe("inbound worker", () => {
  const realFetch = globalThis.fetch;
  const realError = console.error;
  let requests;
  let errors;

  beforeEach(() => {
    requests = [];
    errors = [];
    console.error = (...args) => errors.push(args.join(" "));
    globalThis.fetch = async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ status: "stored" }), { status: 200 });
    };
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    console.error = realError;
  });

  it("forwards to the existing inbox with only X- headers added", async () => {
    const { message, calls } = makeMessage();
    await worker.email(message, ENV);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].address, "inbox@example.test");
    for (const [name] of calls[0].headers) assert.match(name, /^x-/i);
  });

  it("posts the raw bytes with a signature that matches an independent HMAC", async () => {
    const { message } = makeMessage();
    await worker.email(message, ENV);
    assert.equal(requests.length, 1);
    const { url, init } = requests[0];
    assert.equal(url, ENV.INBOUND_WEBHOOK_URL);
    assert.equal(init.method, "POST");
    const headers = init.headers;
    assert.equal(headers["Content-Type"], "message/rfc822");
    assert.equal(headers["X-Vitalos-Envelope-From"], "sender@example.org");
    assert.equal(headers["X-Vitalos-Envelope-To"], "support@vitalos.co.uk");
    assert.match(headers["X-Vitalos-Timestamp"], /^\d{10}$/);
    assert.deepEqual(Buffer.from(init.body), RAW);
    const expected = createHmac("sha256", ENV.INBOUND_WEBHOOK_SECRET)
      .update(`${headers["X-Vitalos-Timestamp"]}.`)
      .update(RAW)
      .digest("hex");
    assert.equal(headers["X-Vitalos-Signature"], expected);
    assert.match(headers["X-Vitalos-Signature"], /^[0-9a-f]{64}$/);
  });

  it("sign() equals Node createHmac for arbitrary bytes", async () => {
    const bytes = Uint8Array.from([0, 255, 10, 13, 46, 128]);
    const expected = createHmac("sha256", "k").update("1700000000.").update(bytes).digest("hex");
    assert.equal(await sign("k", "1700000000", bytes.buffer), expected);
  });

  it("still forwards, and does not throw, when the POST fails", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("network down: secret-body-content");
    };
    const { message, calls } = makeMessage();
    await worker.email(message, ENV);
    assert.equal(calls.length, 1);
    assert.ok(errors.length > 0);
    assert.ok(errors.every((line) => !line.includes("secret-body-content")));
  });

  it("does not throw when the app answers with an error status", async () => {
    globalThis.fetch = async () => new Response("no", { status: 401 });
    const { message, calls } = makeMessage();
    await worker.email(message, ENV);
    assert.equal(calls.length, 1);
    assert.ok(errors.some((line) => line.includes("401")));
  });

  it("still forwards when the raw stream cannot be read", async () => {
    const { message, calls } = makeMessage({
      raw: new ReadableStream({
        start(controller) {
          controller.error(new Error("boom"));
        },
      }),
    });
    await worker.email(message, ENV);
    assert.equal(calls.length, 1);
    assert.equal(requests.length, 0);
  });

  it("forwards only, without posting, above the size limit", async () => {
    const { message, calls } = makeMessage({ rawSize: MAX_BODY_BYTES + 1 });
    await worker.email(message, ENV);
    assert.equal(calls.length, 1);
    assert.equal(requests.length, 0);
  });

  it("forwards only when the webhook is not configured", async () => {
    const { message, calls } = makeMessage();
    await worker.email(message, { FORWARD_TO: ENV.FORWARD_TO });
    assert.equal(calls.length, 1);
    assert.equal(requests.length, 0);
  });

  it("posts, then rethrows, when the forward itself fails", async () => {
    const failure = new Error("destination not verified");
    const { message } = makeMessage({
      async forward() {
        throw failure;
      },
    });
    await assert.rejects(worker.email(message, ENV), failure);
    assert.equal(requests.length, 1);
  });
});
