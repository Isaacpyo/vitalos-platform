/**
 * Small talk (ADR-048, finding D2): greetings, thanks, goodbyes and bare acknowledgements get a
 * short, fixed reply in the Relay voice with no retrieval, no model call, no gap and no token use.
 * Only whole messages qualify: "Hello, what does Vitalos do?" carries a question and goes to
 * retrieval as usual.
 */
export type SmallTalkKind = "greeting" | "thanks" | "goodbye" | "ack";

const PHRASES: Record<SmallTalkKind, string[]> = {
  goodbye: [
    "bye",
    "bye bye",
    "goodbye",
    "good bye",
    "see you",
    "see ya",
    "see you later",
    "later",
    "thats all",
    "that is all",
    "thats it",
    "that is it",
    "no thanks",
    "no thank you",
    "nothing else",
    "good night",
    "goodnight",
  ],
  thanks: [
    "thanks",
    "thank you",
    "thankyou",
    "thanks a lot",
    "thank you very much",
    "thanks very much",
    "many thanks",
    "cheers",
    "ta",
    "thx",
    "much appreciated",
    "appreciated",
    "great thanks",
    "ok thanks",
    "okay thanks",
    "perfect thanks",
    "brilliant thanks",
    "lovely thanks",
  ],
  greeting: [
    "hi",
    "hello",
    "hey",
    "hiya",
    "howdy",
    "greetings",
    "yo",
    "morning",
    "afternoon",
    "evening",
    "good morning",
    "good afternoon",
    "good evening",
    "how are you",
    "how are you doing",
    "how are things",
    "hows it going",
    "how is it going",
    "you there",
    "anyone there",
    "is anyone there",
  ],
  ack: [
    "ok",
    "okay",
    "k",
    "great",
    "cool",
    "nice",
    "perfect",
    "brilliant",
    "lovely",
    "got it",
    "understood",
    "sure",
    "alright",
    "all right",
    "fine",
    "noted",
    "makes sense",
  ],
};

/** Words that may surround small talk without changing it ("hi there", "thanks Relay"). */
const FILLER = new Set([
  "there",
  "relay",
  "vitalos",
  "team",
  "all",
  "again",
  "so",
  "much",
  "and",
  "then",
]);

/** Fixed replies. Sources: the Relay greeting (Settings default) and the widget copy. */
export const SMALL_TALK_REPLIES: Record<SmallTalkKind, string> = {
  greeting:
    "Hello. I'm Relay, the Vitalos AI assistant. Ask me what we do, how an engagement starts or about your project, and I'll answer from our published information and show my sources.",
  thanks:
    "You're welcome. Ask another question whenever you like, or choose Talk to a person to reach the team.",
  goodbye: "Thanks for stopping by. This conversation stays here if you want to come back to it.",
  ack: "What else would you like to know about Vitalos?",
};

const normalise = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The kind of small talk `text` is, or null when it carries anything else. */
export function smallTalkKind(text: string): SmallTalkKind | null {
  const t = normalise(text);
  if (!t || t.split(" ").length > 7) return null;
  const words = t.split(" ").filter((w) => !FILLER.has(w));
  if (words.length === 0) return null;
  const rest = ` ${words.join(" ")} `;
  const found = new Set<SmallTalkKind>();
  let remaining = rest;
  for (const kind of ["goodbye", "thanks", "greeting", "ack"] as const) {
    // Longest phrases first, so "thank you very much" is consumed before "thank you".
    for (const phrase of [...PHRASES[kind]].sort((a, b) => b.length - a.length)) {
      const needle = ` ${phrase} `;
      while (remaining.includes(needle)) {
        remaining = remaining.replace(needle, " ");
        found.add(kind);
      }
    }
  }
  if (remaining.trim()) return null;
  for (const kind of ["goodbye", "thanks", "greeting", "ack"] as const)
    if (found.has(kind)) return kind;
  return null;
}
