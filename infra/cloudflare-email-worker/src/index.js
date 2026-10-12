// Vitalos inbound mail Worker (Cloudflare Email Routing -> Email Worker).
//
// For every message to the routed address it:
//   1. reads the raw MIME once into memory (skipped above 25 MiB, which the app would reject anyway);
//   2. forwards the original message to the existing inbox (FORWARD_TO, a verified destination);
//   3. signs the raw bytes and POSTs them to the Super Admin (INBOUND_WEBHOOK_URL).
//
// Forwarding is the priority: the existing inbox must keep every message. Once the forward has
// succeeded this handler never throws, because a throw would make Cloudflare bounce the sender.
// Failures of the app call are logged without any message content and the Worker returns.
//
// Contract (superadmin/docs/email-setup.md): POST body = raw MIME, Content-Type message/rfc822,
// X-Vitalos-Timestamp = unix seconds, X-Vitalos-Signature = lowercase hex HMAC-SHA256 of
// `${timestamp}.` followed by the raw body bytes, plus X-Vitalos-Envelope-From / -To.

export const MAX_BODY_BYTES = 25 * 1024 * 1024;
const POST_TIMEOUT_MS = 10_000;

const encoder = new TextEncoder();

/** Lowercase hex HMAC-SHA256(secret, `${timestamp}.` + body). */
export async function sign(secret, timestamp, body) {
  const prefix = encoder.encode(`${timestamp}.`);
  const payload = new Uint8Array(prefix.length + body.byteLength);
  payload.set(prefix, 0);
  payload.set(new Uint8Array(body), prefix.length);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, payload));
  return Array.from(mac, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readRaw(message) {
  // Read before forwarding: the stream can be consumed once, and reading then forwarding is the
  // usual pattern (parse, then forward). The runtime docs do not state that forward() still works
  // after raw is read, so the test plan in email-setup.md checks it on the real route.
  return new Response(message.raw).arrayBuffer();
}

async function post(message, env, body) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await sign(env.INBOUND_WEBHOOK_SECRET, timestamp, body);
  const response = await fetch(env.INBOUND_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "message/rfc822",
      "X-Vitalos-Timestamp": timestamp,
      "X-Vitalos-Signature": signature,
      "X-Vitalos-Envelope-From": message.from,
      "X-Vitalos-Envelope-To": message.to,
    },
    body,
    signal: AbortSignal.timeout(POST_TIMEOUT_MS),
  });
  if (!response.ok) {
    console.error(`inbound webhook answered HTTP ${response.status}`);
  }
}

export default {
  async email(message, env) {
    let body = null;
    const configured = Boolean(env.INBOUND_WEBHOOK_URL && env.INBOUND_WEBHOOK_SECRET);

    if (message.rawSize > MAX_BODY_BYTES) {
      console.error(`message of ${message.rawSize} bytes is over the limit; forwarded only`);
    } else if (!configured) {
      console.error("INBOUND_WEBHOOK_URL or INBOUND_WEBHOOK_SECRET is not set; forwarded only");
    } else {
      try {
        body = await readRaw(message);
      } catch (error) {
        console.error(`could not read the message: ${error?.name ?? "error"}`);
      }
    }

    // Forward first. Only X- headers may be added to a forwarded message.
    let forwardError = null;
    try {
      if (!env.FORWARD_TO) throw new Error("FORWARD_TO is not set");
      await message.forward(env.FORWARD_TO, new Headers({ "X-Vitalos-Inbound": "worker" }));
    } catch (error) {
      forwardError = error;
      console.error(`forward failed: ${error?.name ?? "error"}`);
    }

    if (body) {
      try {
        await post(message, env, body);
      } catch (error) {
        console.error(`inbound webhook call failed: ${error?.name ?? "error"}`);
      }
    }

    // Only a failed forward throws, so the sender is told. The app has already stored the message if
    // its call worked, and de-duplicates a resend by Message-ID.
    if (forwardError) throw forwardError;
  },
};
