import { expect, test } from "@playwright/test";
import { NO_DRAFT_CONTACT, isDraftRun } from "../support/content-source";

// /.well-known/security.txt (RFC 9116; finding B8, ADR-045 era). Plain text with the required
// Contact and Expires fields, Expires in the future and under a year away.
test("security.txt publishes the contact, a future expiry, the language and the canonical URL", async ({
  request,
}) => {
  test.skip(isDraftRun, NO_DRAFT_CONTACT);
  const response = await request.get("/.well-known/security.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/^text\/plain/);
  const body = await response.text();
  expect(body).toMatch(/^Contact: mailto:\S+@\S+$/m);
  expect(body).toMatch(/^Preferred-Languages: en$/m);
  expect(body).toMatch(/^Canonical: https?:\/\/\S+\/\.well-known\/security\.txt$/m);
  const expires = /^Expires: (\S+)$/m.exec(body)?.[1];
  const at = Date.parse(expires ?? "");
  expect(at).toBeGreaterThan(Date.now());
  expect(at - Date.now()).toBeLessThan(366 * 24 * 60 * 60 * 1000);
});
