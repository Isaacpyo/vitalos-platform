import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RELAY_EVENT } from "./events";
import { RelayLauncher } from "./launcher";
import { saveConversation } from "./storage";

/** Panel mounting, restore-on-choice, events and the one-tap thumbs-down reason (ADR-048). */

const settings = {
  questions: ["What does Vitalos do?"],
  greeting: "I'm Relay.",
  suggestedQuestions: [],
  teamStatus: "offline",
  outOfHoursText: "The team is offline right now.",
  privacyUrl: "/legal/privacy",
  noticeVersion: "2026-10",
  aiEnabled: true,
  nextOpening: { at: "2026-10-19T08:00:00.000Z", label: "Monday 09:00" },
};

const answer = {
  id: "11111111-1111-4111-8111-111111111111",
  senderType: "ai",
  body: "We modernise systems in stages.",
  createdAt: "2026-10-17T10:00:00.000Z",
  citations: [],
  nextStep: null,
  handoffSuggested: false,
  lowConfidence: false,
  feedback: null,
};

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.startsWith("/api/relay/suggestions")) return json(settings);
    if (url.includes("/messages"))
      return json({
        messages: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            senderType: "visitor",
            body: "Can you modernise my system?",
            createdAt: "2026-10-17T09:59:00.000Z",
          },
          answer,
        ],
        status: "ai",
        person: null,
        teamStatus: "offline",
        contact: null,
        nextOpening: settings.nextOpening,
      });
    if (url === "/api/relay/feedback") {
      void init;
      return json({ showHandoff: true });
    }
    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }) as unknown as typeof window.matchMedia;
  HTMLElement.prototype.scrollTo = () => undefined;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const launcher = () =>
  render(<RelayLauncher symbolSrc="/relay.svg" privacyUrl="/legal/privacy" />);

const openButton = () => screen.getByRole("button", { name: /Open chat with Relay/ });

describe("Relay launcher and panel mounting (C2)", () => {
  it("renders no panel until opened, and removes it on close", async () => {
    const { container } = launcher();
    expect(container.querySelector("#relay-panel")).toBeNull();
    const events: string[] = [];
    window.addEventListener(RELAY_EVENT, (e) => events.push((e as CustomEvent).detail.type));
    await act(async () => fireEvent.click(openButton()));
    await waitFor(() => expect(container.querySelector("#relay-panel")).not.toBeNull());
    expect(events).toEqual(["relay_opened"]);
    expect(container.querySelector("article")).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Close chat" })));
    expect(container.querySelector("#relay-panel")).toBeNull();
  });

  it("asks before restoring a stored conversation and fetches nothing until Continue", async () => {
    saveConversation({
      conversationId: "33333333-3333-4333-8333-333333333333",
      visitorToken: "t",
      channelKey: "k",
      realtime: null,
      lastSeenAt: new Date().toISOString(),
    });
    launcher();
    await act(async () => fireEvent.click(openButton()));
    const cont = await screen.findByRole("button", { name: "Continue previous conversation" });
    expect(screen.getByRole("button", { name: "Start new" })).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/messages"))).toBe(false);
    await act(async () => fireEvent.click(cont));
    await screen.findByText("We modernise systems in stages.");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/messages"))).toBe(true);
    // Staff and AI answers are groups inside the log, not article landmarks.
    expect(screen.getByRole("log").querySelector("article")).toBeNull();
    expect(screen.getAllByRole("group", { name: /Relay · AI/ }).length).toBeGreaterThan(0);
  });

  it("asks one reason after thumbs-down, then offers a person", async () => {
    saveConversation({
      conversationId: "33333333-3333-4333-8333-333333333333",
      visitorToken: "t",
      channelKey: "k",
      realtime: null,
      lastSeenAt: new Date().toISOString(),
    });
    window.sessionStorage.setItem("vitalos.relay.chosen", "33333333-3333-4333-8333-333333333333");
    launcher();
    await act(async () => fireEvent.click(openButton()));
    await screen.findByText("We modernise systems in stages.");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Not helpful" })));
    const reason = await screen.findByRole("button", { name: "It was incomplete" });
    await act(async () => fireEvent.click(reason));
    const bodies = fetchMock.mock.calls
      .filter(([url]) => url === "/api/relay/feedback")
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as { reason?: string });
    expect(bodies.at(-1)?.reason).toBe("incomplete");
    expect(await screen.findByRole("heading", { name: /Sorry that didn't answer it/ })).toBeTruthy();
  });

  it("shows the next opening time and the leave-your-email offer out of hours (D5)", async () => {
    launcher();
    await act(async () => fireEvent.click(openButton()));
    expect(await screen.findByText("TEAM BACK MONDAY 09:00")).toBeTruthy();
    expect(screen.getByText(/Leave your email and we'll reply/)).toBeTruthy();
  });
});
