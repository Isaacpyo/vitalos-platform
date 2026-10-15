import type { Meta, StoryObj } from "@storybook/react-vite";
import { RelayLauncher } from "@vitalos/relay-widget";
import type { VisitorMessage } from "@vitalos/relay-core/contract";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { FakeRelay, QUESTIONS, ago } from "./_fakeRelay";
import type { Scenario } from "./_fakeRelay";

/**
 * The real Relay launcher and panel, driven by a scripted fake of the visitor API
 * (`_fakeRelay.tsx`). Nothing here touches the network. The panel is lazily loaded and reopens
 * from the seeded tab-session flag, exactly as it does on a page navigation.
 *
 * The responsive stories use the Storybook viewport; open them from the Storybook UI at 390px.
 */
const meta = {
  title: "Relay/Widget",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Widget({ scenario }: { scenario: Scenario }) {
  return (
    <FakeRelay scenario={scenario}>
      <div style={{ minHeight: "100vh" }}>
        <RelayLauncher symbolSrc="/brand/vitalos-symbol.png" privacyUrl="/legal/privacy" />
      </div>
    </FakeRelay>
  );
}

// --- Seeded conversations -----------------------------------------------------------------------

const QUESTION = "Can you take over a struggling software project?";

const answeredMessages: VisitorMessage[] = [
  { id: "m1", senderType: "visitor", body: QUESTION, createdAt: ago(4) },
  {
    id: "m2",
    senderType: "ai",
    body: "Yes. We take over software that has stalled, starting with a short, fixed-scope review of the code, the delivery history and the team [1]. You then get a written plan with what to keep, what to fix and what to stop [2].\n\n- A review that reports in two weeks\n- A plan you can take to your board",
    createdAt: ago(3),
    citations: [
      {
        n: 1,
        title: "Engineering rescue (example source)",
        url: "/offers/engineering-rescue",
        type: "OFFER",
      },
      {
        n: 2,
        title: "Delivery review (example source)",
        url: "/guides/delivery-review",
        type: "GUIDE",
      },
    ],
    nextStep: {
      kind: "link",
      label: "See how an engineering rescue works",
      href: "/offers/engineering-rescue",
    },
    feedback: null,
  },
];

const lowConfidenceMessages: VisitorMessage[] = [
  {
    id: "m1",
    senderType: "visitor",
    body: "Do you hold a particular certification for this?",
    createdAt: ago(3),
  },
  {
    id: "m2",
    senderType: "ai",
    body: "I can't confirm that from Vitalos's published information, so I won't guess. A person from the team can answer this properly.",
    createdAt: ago(2),
    citations: [],
    lowConfidence: true,
    handoffSuggested: true,
  },
];

const waitingMessages: VisitorMessage[] = [
  ...answeredMessages,
  {
    id: "m3",
    senderType: "system",
    body: "handoff_requested",
    event: "handoff_requested",
    createdAt: ago(1),
  },
];

const person = { name: "Temitope Agbola", initials: "TA" };

const joinedMessages: VisitorMessage[] = [
  ...answeredMessages,
  {
    id: "m3",
    senderType: "system",
    body: "handoff_requested",
    event: "handoff_requested",
    createdAt: ago(2),
  },
  {
    id: "m4",
    senderType: "system",
    body: "admin_joined",
    event: "admin_joined",
    createdAt: ago(1),
    meta: { name: person.name },
  },
  {
    id: "m5",
    senderType: "admin",
    body: "Hello, this is Temitope from Vitalos. I've read the conversation. Could you tell me roughly how long the project has been stalled?",
    createdAt: ago(1),
    adminName: person.name,
    adminInitials: person.initials,
  },
];

// --- Scenarios (module scope: a stable identity per story) -----------------------------------------

const online: Scenario = { team: "online", seen: true, open: true };
const offline: Scenario = { team: "offline", seen: true, open: true };
const answered: Scenario = {
  ...online,
  conversation: { status: "ai", messages: answeredMessages },
};
const talkedToTeam = { name: "Example Visitor", email: "visitor@example.com" };

// --- Stories -------------------------------------------------------------------------------------

export const LauncherClosed: Story = {
  name: "Launcher, closed (first visit, labelled)",
  render: () => <Widget scenario={{ team: "online" }} />,
};

export const LauncherClosedReturning: Story = {
  name: "Launcher, closed (returning visitor)",
  render: () => <Widget scenario={{ team: "online", seen: true }} />,
};

export const WelcomeTeamOnline: Story = {
  name: "Welcome: suggested questions, team online",
  render: () => <Widget scenario={online} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(QUESTIONS[0]!);
    await waitFor(() => expect(canvas.getByText("TEAM ONLINE")).toBeVisible());
  },
};

export const WelcomeTeamOffline: Story = {
  name: "Welcome: team offline / out of hours",
  render: () => <Widget scenario={offline} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText(QUESTIONS[0]!);
  },
};

export const StreamingAnswer: Story = {
  name: "Streaming answer (in progress)",
  render: () => (
    <Widget
      scenario={{
        ...online,
        chat: {
          kind: "streaming",
          text: "We take over software that has stalled, starting with a short, fixed-scope review of the code, the delivery history and the team",
        },
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText(QUESTION));
    await canvas.findByRole("button", { name: "Stop generating" });
  },
};

export const AnsweredWithSources: Story = {
  name: "Answered: sources, citations, next step, feedback",
  render: () => <Widget scenario={answered} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("button", { name: "Helpful" });
    await canvas.findByText(/See how an engineering rescue works/);
  },
};

export const LowConfidenceOffersPerson: Story = {
  name: "Low confidence: offers a person",
  render: () => (
    <Widget
      scenario={{ ...online, conversation: { status: "ai", messages: lowConfidenceMessages } }}
    />
  ),
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(/I can't confirm that/);
  },
};

export const HandoffFormEmpty: Story = {
  name: "Hand-off form (empty)",
  render: () => <Widget scenario={online} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /Talk to a person/ }));
    await canvas.findByRole("button", { name: "Connect me to a person" });
  },
};

export const HandoffFormErrors: Story = {
  name: "Hand-off form (validation errors)",
  render: () => <Widget scenario={online} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: /Talk to a person/ }));
    await userEvent.type(await canvas.findByLabelText("Work email"), "not-an-email");
    await userEvent.click(canvas.getByRole("button", { name: "Connect me to a person" }));
    await canvas.findByText("Enter your name");
    await canvas.findByText("Enter a valid email address");
    await canvas.findByText(/Tick the box/);
  },
};

export const WaitingForPerson: Story = {
  name: "Waiting for a person (team online)",
  render: () => (
    <Widget
      scenario={{
        ...online,
        conversation: {
          status: "awaiting_human",
          contact: talkedToTeam,
          messages: waitingMessages,
        },
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole("log", { name: "Conversation" });
  },
};

export const WaitingForPersonOutOfHours: Story = {
  name: "Waiting for a person (out of hours)",
  render: () => (
    <Widget
      scenario={{
        ...offline,
        conversation: {
          status: "awaiting_human",
          contact: talkedToTeam,
          messages: waitingMessages.map((m) =>
            m.event === "handoff_requested" ? { ...m, meta: { outOfHours: true } } : m,
          ),
        },
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole("log", { name: "Conversation" });
  },
};

export const PersonJoinedWithReply: Story = {
  name: "Person joined, with admin reply",
  render: () => (
    <Widget
      scenario={{
        ...online,
        conversation: { status: "human", person, contact: talkedToTeam, messages: joinedMessages },
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(/I've read the conversation/);
  },
};

export const UnavailableNotice: Story = {
  name: "Notice: Relay unavailable",
  render: () => (
    <Widget
      scenario={{
        ...online,
        chat: {
          kind: "stream-error",
          code: "unavailable",
          message: "Relay can't answer right now. You can still talk to a person.",
        },
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText(QUESTION));
    await canvas.findByText(/Relay can't answer right now/);
  },
};
export const RateLimitedNotice: Story = {
  name: "Notice: rate limited",
  render: () => (
    <Widget
      scenario={{
        ...online,
        chat: {
          kind: "stream-error",
          code: "rate_limited",
          message: "You're sending messages quickly. Try again in a minute.",
        },
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText(QUESTION));
    await canvas.findByText(/sending messages quickly/);
  },
};

export const AnsweredMobile390: Story = {
  name: "Answered, mobile 390px",
  globals: { viewport: { value: "mobile390", isRotated: false } },
  render: () => <Widget scenario={answered} />,
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole("button", { name: "Helpful" });
  },
};

export const WelcomeMobile390: Story = {
  name: "Welcome, mobile 390px",
  globals: { viewport: { value: "mobile390", isRotated: false } },
  render: () => <Widget scenario={online} />,
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText(QUESTIONS[0]!);
  },
};
