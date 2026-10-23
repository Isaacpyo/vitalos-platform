import { createHash, createHmac, randomUUID } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { RELAY_TEST_ADMIN_SECRET } from "../../playwright.config";

/**
 * A stand-in for the Super Admin in the browser suites: signs admin API calls exactly as
 * superadmin/apps/relay/client.py does (docs/relay/API.md), with the test-only secret.
 */
export const ADMIN = {
  id: "sa:1",
  name: "Temitope Agbola",
  initials: "TA",
  email: "temitope@vitalos.co.uk",
  role: "SuperAdmin",
};

export async function adminCall(
  request: APIRequestContext,
  method: "GET" | "POST" | "PUT",
  pathWithQuery: string,
  body?: unknown,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const path = `/api/relay/admin${pathWithQuery}`;
  const raw = body === undefined ? "" : JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const admin = Buffer.from(JSON.stringify(ADMIN)).toString("base64url");
  const canonical = [ts, method, path, admin, createHash("sha256").update(raw).digest("hex")].join(
    "\n",
  );
  const signature = `v1=${createHmac("sha256", RELAY_TEST_ADMIN_SECRET).update(canonical).digest("hex")}`;
  const res = await request.fetch(path, {
    method,
    headers: {
      "x-relay-timestamp": ts,
      "x-relay-admin": admin,
      "x-relay-signature": signature,
      ...(raw ? { "content-type": "application/json" } : {}),
    },
    ...(raw ? { data: raw } : {}),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown> };
  return { status: res.status(), data: json.data ?? {} };
}

export const newId = () => randomUUID();

/** Opens the panel from the launcher and waits for the welcome screen. */
export async function openRelay(page: Page) {
  const launcher = page.getByRole("button", { name: /Open chat with Relay/ });
  const panel = page.locator("#relay-panel");
  // A click that lands before hydration does nothing: retry until the panel is open. Check the
  // panel, not the launcher: once a modal panel opens the launcher leaves the accessibility tree.
  await expect(async () => {
    if (!(await panel.isVisible())) await launcher.click({ timeout: 2000 });
    await expect(panel).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await expect(page.getByText("Ask Vitalos.")).toBeVisible({ timeout: 10_000 });
}

/** Opens the hand-off form from the options menu (the welcome screen has no caption link). */
export async function openHandoffFromMenu(page: Page) {
  await page.getByRole("button", { name: "Conversation options" }).click();
  await page.getByRole("menuitem", { name: "Talk to a person" }).click();
}

/** Sends a message through the composer and waits for Relay's answer to finish streaming. */
export async function ask(page: Page, text: string) {
  const composer = page.getByLabel("Message Relay");
  await composer.fill(text);
  await composer.press("Enter");
  await expect(page.locator(".relay-answer").last()).not.toHaveAttribute("aria-busy", "true", {
    timeout: 30_000,
  });
  await expect(page.locator(".relay-answer").last().getByText("Was this helpful?")).toBeVisible();
}

/**
 * Relay specs cover the public site with Askbridge off. When the server is built for the Askbridge
 * variant (E2E_ASKBRIDGE=1, ADR-045) Relay does not render, so those specs skip themselves.
 */
export const askbridgeOn = process.env.E2E_ASKBRIDGE === "1";
