import type {
  LlmProvider,
  StreamAnswerInput,
  StreamEvent,
  SummaryInput,
  SummaryOutput,
  Usage,
} from "./provider";

/**
 * Deterministic provider for tests, Storybook, previews and environments without a DeepSeek key
 * (RELAY_LLM_PROVIDER=mock). It answers only from the SOURCES block of the final user message,
 * cites them, and follows the hand-off rules: with low retrieval confidence, or a request for a
 * quote, proposal or price, it says a person can help and emits the hand-off marker.
 */
export interface MockOptions {
  /** Delay between streamed chunks (ms). */
  chunkDelayMs?: number;
}

interface ParsedSource {
  n: number;
  title: string;
  text: string;
}

export function parseUserMessage(message: string): {
  confident: boolean;
  sources: ParsedSource[];
  question: string;
} {
  const confident = /^Retrieval: confident$/m.test(message);
  const sourcesBlock = /\nSOURCES\n([\s\S]*?)\n\nQUESTION\n/.exec(message)?.[1] ?? "";
  const question = /\nQUESTION\n([\s\S]*)$/.exec(message)?.[1]?.trim() ?? "";
  const sources: ParsedSource[] = [];
  // One source: a header line "[n] title (type) link", then its text up to the next header or
  // the end of the block. No `m` flag: `$` must mean the end of the whole block, otherwise a
  // source that spans lines would be cut at its first line.
  const re =
    /(?:^|\n)\[(\d+)\] (.+?) \([A-Za-z]+\)[^\n]*\n([\s\S]*?)(?=\n\[\d+\] [^\n]*\([A-Za-z]+\)[^\n]*\n|$)/g;
  for (const m of sourcesBlock.matchAll(re)) {
    sources.push({
      n: Number(m[1]),
      title: (m[2] as string).trim(),
      text: (m[3] as string).trim(),
    });
  }
  return { confident, sources, question };
}

const sentences = (text: string) =>
  text
    // A leading heading line (no sentence punctuation) is a label, not an answer.
    .replace(/^[^.?!\n]{1,120}\n(?=\S)/, "")
    .replace(/^#+ .*$/gm, "")
    .replace(/^.*›.*$/gm, "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12 && !/^[-*]/.test(s));

export function mockAnswer(message: string): string {
  const { confident, sources, question } = parseUserMessage(message);
  if (/\b(quote|proposal|price|pricing|cost|how much)\b/i.test(question)) {
    const lead = confident && sources[0] ? `${sentences(sources[0].text)[0] ?? ""} [1] ` : "";
    return `${lead}Costs depend on scope, so I won't guess. A person from the team can help with this.\n[[handoff]]`.trim();
  }
  if (!confident || sources.length === 0) {
    return "I can't confirm that from Vitalos's published information, so I won't guess. A person from the team can help with this.\n[[handoff]]";
  }
  const first = sentences(sources[0]?.text ?? "").slice(0, 2);
  const parts = [`${first.join(" ")} [1]`];
  const second = sources[1] ? sentences(sources[1].text)[0] : undefined;
  if (second && sources[1]?.title !== sources[0]?.title) parts.push(`${second} [2]`);
  return parts.join("\n\n");
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });

const estimate = (text: string) => Math.ceil(text.length / 4);

export class MockProvider implements LlmProvider {
  readonly name = "mock" as const;
  constructor(private readonly options: MockOptions = {}) {}

  async *streamAnswer(input: StreamAnswerInput): AsyncIterable<StreamEvent> {
    const last = input.messages.at(-1)?.content ?? "";
    const answer = mockAnswer(last);
    const chunks = answer.match(/\S+\s*/g) ?? [];
    for (const chunk of chunks) {
      if (input.abortSignal.aborted) {
        yield { type: "error", code: "aborted" };
        return;
      }
      await sleep(this.options.chunkDelayMs ?? 0, input.abortSignal);
      if (input.abortSignal.aborted) {
        yield { type: "error", code: "aborted" };
        return;
      }
      yield { type: "delta", text: chunk };
    }
    const usage: Usage = {
      inputTokens:
        estimate(input.system) + input.messages.reduce((s, m) => s + estimate(m.content), 0),
      outputTokens: estimate(answer),
      cacheHitTokens: estimate(input.system),
    };
    yield { type: "done", usage };
  }

  generateSummary(input: SummaryInput): Promise<{ output: SummaryOutput; usage: Usage }> {
    const firstVisitor = /VISITOR: (.+)/.exec(input.transcript)?.[1] ?? "a question";
    const topic = firstVisitor
      .replace(/\[[a-z-]+\]/g, "")
      .split(/\s+/)
      .slice(0, 14)
      .join(" ");
    return Promise.resolve({
      output: {
        summary: `Visitor asked: ${topic}. Relay offered a person.`
          .split(/\s+/)
          .slice(0, 40)
          .join(" "),
        intent: /\b(price|cost|quote)\b/i.test(input.transcript) ? "pricing" : "service_enquiry",
        sector: /\b(care|health|nhs)\b/i.test(input.transcript) ? "health_care" : null,
        urgency: /\b(urgent|asap|today)\b/i.test(input.transcript) ? "high" : "normal",
      },
      usage: { inputTokens: estimate(input.transcript), outputTokens: 40, cacheHitTokens: 0 },
    });
  }
}
