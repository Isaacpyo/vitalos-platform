"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { Button, Textarea } from "@vitalos/ui";
import type { UtmKey } from "@vitalos/validation/enquiry";
import { vercelAnalyticsSink } from "../../../features/analytics/vercel-sink";
import {
  requestBriefDraftAction,
  requestBriefQuestionsAction,
} from "../../../features/ai-data/brief/actions";
import {
  cardsFromDraft,
  editCard,
  revertCard,
  setCardRemoved,
} from "../../../features/ai-data/brief/cards";
import {
  draftChecklistBrief,
  selectQuestions,
} from "../../../features/ai-data/brief/question-bank";
import {
  DRAFT_STORAGE_KEY,
  initialDraft,
  parseDraft,
  reducer,
  serialiseDraft,
  steps,
} from "../../../features/ai-data/brief/state";
import type {
  DraftState,
  Notice as NoticeState,
  Step,
} from "../../../features/ai-data/brief/state";
import { exampleChips, topics } from "../../../features/ai-data/brief/topics";
import { BRIEF_LIMITS } from "../../../features/ai-data/brief/types";
import type {
  BriefAnswer,
  BriefQuestion,
  Source,
  TopicSlug,
} from "../../../features/ai-data/brief/types";
import type { AssistFailure } from "../../../features/ai-data/brief/assist-client";
import type { AiDataEnquiryAction } from "../AiDataEnquiryForm";
import { BriefCardView } from "./BriefCardView";
import { ShareStep } from "./ShareStep";
import {
  Chip,
  ChipRow,
  Notice,
  ProvenanceTag,
  Skeleton,
  cx,
  secondaryButton,
  textButton,
} from "./parts";

export interface GuidedBriefProps {
  /** The AI assist is configured on this deployment. Otherwise the opt-in is not offered. */
  aiAvailable: boolean;
  initialTopic: TopicSlug | null;
  /** A fresh UUID per page load, generated on the server; the draft keeps it for the brief. */
  idempotencyKey: string;
  action: AiDataEnquiryAction;
  privacyNoticeVersion: string;
  offer?: string | undefined;
  utm?: Partial<Record<UtmKey, string>> | undefined;
  turnstileSiteKey?: string | undefined;
  contactEmail?: string | undefined;
  simpleFormHref: string;
}

const stepLabels: Record<Step, string> = {
  describe: "Describe the workflow",
  questions: "A few questions",
  brief: "Review your brief",
  share: "Share your brief",
};

const failureText: Record<AssistFailure, string> = {
  "not-configured": "AI suggestions are not switched on here.",
  busy: "The AI assistant is busy at the moment.",
  "rate-limited": "The AI assistant is busy at the moment.",
  timeout: "The AI assistant took too long to answer.",
  unavailable: "The AI assistant is not available right now.",
  invalid: "The AI assistant gave an answer we could not use.",
};

const unavailableNotice = (reason: AssistFailure): NoticeState => ({
  kind: "ai-unavailable",
  message: `${failureText[reason]} We used our checklist instead: nothing below was written by AI.`,
});

const track = vercelAnalyticsSink.track;

/**
 * The guided brief on /ai-data/contact (W6): describe, follow-up questions, an editable brief and
 * a share step. State is a pure reducer persisted to sessionStorage only. Text reaches the AI
 * endpoint (through a server action) only after the explicit opt-in; without it, or when AI is
 * unavailable, a deterministic checklist runs and is labelled as such.
 */
export function GuidedBrief(props: GuidedBriefProps) {
  const { aiAvailable, initialTopic, idempotencyKey, simpleFormHref } = props;
  const [draft, dispatch] = useReducer(reducer, undefined, () => ({
    ...initialDraft(idempotencyKey, initialTopic),
    description: initialTopic ? topics[initialTopic].starter : "",
  }));
  const [busy, setBusy] = useState<"questions" | "brief" | null>(null);
  const [fieldError, setFieldError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const restoring = useRef(false);
  const started = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepChanged = useRef(false);
  /** What an async step just did; announced together with the step change that follows it. */
  const resultNote = useRef("");

  // Restore a draft from this tab's session (never from anywhere else).
  useEffect(() => {
    try {
      const stored = parseDraft(sessionStorage.getItem(DRAFT_STORAGE_KEY));
      if (stored && (initialTopic === null || stored.topic === initialTopic)) {
        restoring.current = true;
        dispatch({ type: "restore", draft: stored });
        started.current = stored.description.trim() !== "";
      }
    } catch {
      // sessionStorage can be blocked; the brief then simply starts empty.
    }
  }, [initialTopic]);

  // Persist the draft, without the opt-in. Nothing is written until the visitor has typed.
  useEffect(() => {
    // The first pass after a restore still holds the pre-restore draft: do not overwrite storage.
    if (restoring.current) {
      restoring.current = false;
      return;
    }
    try {
      const touched = draft.description.trim() !== "" && started.current;
      if (touched) sessionStorage.setItem(DRAFT_STORAGE_KEY, serialiseDraft(draft));
    } catch {
      // ignore
    }
  }, [draft]);

  // Move focus to the step heading and announce the step when it changes (not on first render).
  useEffect(() => {
    if (!stepChanged.current) {
      stepChanged.current = true;
      return;
    }
    headingRef.current?.focus();
    const note = resultNote.current;
    resultNote.current = "";
    setAnnouncement(
      `Step ${steps.indexOf(draft.step) + 1} of ${steps.length}: ${stepLabels[draft.step]}.${note ? ` ${note}` : ""}`,
    );
  }, [draft.step]);

  function markStarted() {
    if (started.current) return;
    started.current = true;
    track("brief_started", { topic: draft.topic ?? "none" });
  }

  const aiAnswers = (state: DraftState): BriefAnswer[] =>
    state.questions
      .map((q) => ({ id: q.id, question: q.question, answer: (state.answers[q.id] ?? "").trim() }))
      .filter((entry) => entry.answer !== "");

  async function continueFromDescribe() {
    const description = draft.description.trim();
    if (description.length < BRIEF_LIMITS.descriptionMin) {
      setFieldError(
        `Tell us a little more (at least ${BRIEF_LIMITS.descriptionMin} characters) so the questions can be relevant.`,
      );
      return;
    }
    setFieldError("");
    markStarted();
    // Unchanged text with questions already prepared: just go back to them.
    if (draft.questions.length > 0) {
      dispatch({ type: "go", step: "questions" });
      return;
    }
    const checklist = () => selectQuestions({ description, topic: draft.topic });
    if (!(aiAvailable && draft.aiOptIn)) {
      dispatch({
        type: "questions-ready",
        questions: checklist(),
        source: "checklist",
        notice: null,
      });
      return;
    }
    setBusy("questions");
    setAnnouncement("Asking the AI assistant for questions.");
    const result = await requestBriefQuestionsAction({
      aiConsent: true,
      description,
      topic: draft.topic,
      answers: [],
    });
    setBusy(null);
    if (result.source === "ai") {
      dispatch({ type: "questions-ready", questions: result.data, source: "ai", notice: null });
      resultNote.current = "Questions suggested by AI are ready.";
    } else {
      dispatch({
        type: "questions-ready",
        questions: checklist(),
        source: "checklist",
        notice: unavailableNotice(result.reason),
      });
      resultNote.current = "The AI assistant was not available. Checklist questions are ready.";
    }
  }

  async function prepareBrief() {
    const description = draft.description.trim();
    const answers = aiAnswers(draft);
    track("brief_questions_answered", {
      count: answers.length,
      source: draft.questionsSource ?? "checklist",
    });
    const checklist = () =>
      cardsFromDraft(
        draftChecklistBrief({
          description,
          topic: draft.topic,
          questions: draft.questions,
          answers,
        }),
        "checklist",
      );
    if (!(aiAvailable && draft.aiOptIn && draft.questionsSource === "ai")) {
      dispatch({ type: "brief-ready", cards: checklist(), source: "checklist", notice: null });
      return;
    }
    setBusy("brief");
    setAnnouncement("Asking the AI assistant to draft your brief.");
    const result = await requestBriefDraftAction({
      aiConsent: true,
      description,
      topic: draft.topic,
      answers,
    });
    setBusy(null);
    if (result.source === "ai") {
      dispatch({
        type: "brief-ready",
        cards: cardsFromDraft(result.data, "ai"),
        source: "ai",
        notice: null,
      });
      resultNote.current = "Your brief is ready to review. It was drafted by AI.";
    } else {
      dispatch({
        type: "brief-ready",
        cards: checklist(),
        source: "checklist",
        notice: unavailableNotice(result.reason),
      });
      resultNote.current =
        "The AI assistant was not available. Your brief was prepared from our checklist.";
    }
  }

  function approveBrief() {
    const kept = draft.cards.filter((card) => !card.removed);
    track("brief_completed", {
      source: draft.briefSource ?? "checklist",
      cardsKept: kept.length,
      cardsEdited: kept.filter((card) => card.edited).length,
    });
    dispatch({ type: "go", step: "share" });
  }

  function startOver() {
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
    started.current = false;
    setFieldError("");
    dispatch({ type: "reset", idempotencyKey: crypto.randomUUID(), topic: null });
    setAnnouncement("Started over. Your draft was cleared from this browser.");
  }

  const stepNumber = steps.indexOf(draft.step) + 1;
  const loading = busy !== null;

  return (
    <div className="flex flex-col gap-(--space-6)" data-guided-brief>
      <p role="status" className="sr-only" data-testid="brief-announcer">
        {announcement}
      </p>

      <header className="flex flex-wrap items-center justify-between gap-(--space-3)">
        <ol aria-label="Progress" className="m-0 flex list-none gap-(--space-2) p-0">
          {steps.map((step, index) => (
            <li
              key={step}
              aria-current={step === draft.step ? "step" : undefined}
              className={cx(
                "flex min-h-8 items-center gap-(--space-2) rounded-full border px-(--space-3) text-small",
                step === draft.step
                  ? "border-aid-signal bg-aid-signal-soft font-semibold text-aid-heading"
                  : index < stepNumber - 1
                    ? "border-aid-line text-aid-heading"
                    : "border-aid-border text-aid-muted",
              )}
            >
              <span aria-hidden="true">{index + 1}</span>
              <span className={step === draft.step ? "" : "max-sm:sr-only"}>
                {stepLabels[step]}
              </span>
            </li>
          ))}
        </ol>
        <button type="button" className={textButton} onClick={startOver}>
          Start over
        </button>
      </header>

      <div
        key={draft.step}
        className="flex flex-col gap-(--space-6) motion-safe:animate-[aid-step-in_var(--duration-feedback)_var(--ease-standard)]"
      >
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="m-0 text-h3 text-aid-heading outline-offset-4"
        >
          {stepLabels[draft.step]}
        </h2>

        {draft.step === "describe" ? (
          <DescribeStep
            draft={draft}
            aiAvailable={aiAvailable}
            busy={busy === "questions"}
            error={fieldError}
            simpleFormHref={simpleFormHref}
            onChange={(description) => {
              markStarted();
              if (fieldError) setFieldError("");
              dispatch({ type: "describe", description });
            }}
            onOptIn={(value) => {
              dispatch({ type: "opt-in", value });
              track("brief_ai_opt_in", { enabled: value });
            }}
            onContinue={() => void continueFromDescribe()}
          />
        ) : null}

        {draft.step === "questions" ? (
          <QuestionsStep
            draft={draft}
            busy={busy === "brief"}
            onAnswer={(id, value) => dispatch({ type: "answer", id, value })}
            onBack={() => dispatch({ type: "go", step: "describe" })}
            onNext={() => void prepareBrief()}
          />
        ) : null}

        {draft.step === "brief" ? (
          <section aria-label="Your brief" className="flex flex-col gap-(--space-5)">
            <SourceBanner
              source={draft.briefSource ?? "checklist"}
              notice={draft.notice}
              kind="brief"
            />
            <div className="grid gap-(--space-5)">
              {draft.cards.map((card) => (
                <BriefCardView
                  key={card.key}
                  card={card}
                  onEdit={(text) =>
                    dispatch({ type: "cards", cards: editCard(draft.cards, card.key, text) })
                  }
                  onRevert={() =>
                    dispatch({ type: "cards", cards: revertCard(draft.cards, card.key) })
                  }
                  onRemove={() =>
                    dispatch({ type: "cards", cards: setCardRemoved(draft.cards, card.key, true) })
                  }
                  onRestore={() =>
                    dispatch({ type: "cards", cards: setCardRemoved(draft.cards, card.key, false) })
                  }
                />
              ))}
            </div>
            <p className="m-0 text-small text-aid-muted">
              Nothing has been sent to us yet. Share the brief when you are happy with it, and we
              will ask for your contact details then.
            </p>
            <div className="flex flex-wrap gap-(--space-3)">
              <Button type="button" size="lg" onClick={approveBrief}>
                Share this brief
              </Button>
              <button
                type="button"
                className={secondaryButton}
                onClick={() => dispatch({ type: "go", step: "questions" })}
              >
                Back to questions
              </button>
            </div>
          </section>
        ) : null}

        {draft.step === "share" ? (
          <ShareStep
            draft={draft}
            action={props.action}
            privacyNoticeVersion={props.privacyNoticeVersion}
            utm={props.utm}
            offer={props.offer}
            turnstileSiteKey={props.turnstileSiteKey}
            contactEmail={props.contactEmail}
            onBackToBrief={() => dispatch({ type: "go", step: "brief" })}
          />
        ) : null}
      </div>

      {loading ? <span className="sr-only">Working</span> : null}
    </div>
  );
}

function SourceBanner({
  source,
  notice,
  kind,
}: Readonly<{ source: Source; notice: NoticeState | null; kind: "questions" | "brief" }>) {
  return (
    <div className="flex flex-col gap-(--space-3)">
      {notice ? (
        <Notice tone="warn" title="AI was not used">
          {notice.message}
        </Notice>
      ) : null}
      {source === "ai" ? (
        <Notice
          tone="info"
          title={kind === "brief" ? "Drafted by AI" : "Questions suggested by AI"}
        >
          Everything the AI wrote is a suggestion. Check it, edit it or remove it. Your own words
          are marked &ldquo;You said&rdquo;.
        </Notice>
      ) : (
        <Notice
          tone="info"
          title={
            kind === "brief"
              ? "Prepared from our checklist: no AI used"
              : "Questions from our checklist: no AI used"
          }
        >
          {kind === "brief"
            ? "Your own words are marked “You said”. Suggestions come from a fixed checklist, not from a model."
            : "These questions come from a fixed checklist chosen from your description and topic."}
        </Notice>
      )}
    </div>
  );
}

function DescribeStep({
  draft,
  aiAvailable,
  busy,
  error,
  simpleFormHref,
  onChange,
  onOptIn,
  onContinue,
}: Readonly<{
  draft: DraftState;
  aiAvailable: boolean;
  busy: boolean;
  error: string;
  simpleFormHref: string;
  onChange: (value: string) => void;
  onOptIn: (value: boolean) => void;
  onContinue: () => void;
}>) {
  const remaining = BRIEF_LIMITS.descriptionMax - draft.description.length;
  return (
    <div className="flex flex-col gap-(--space-5)">
      <div className="flex flex-col gap-(--space-3)">
        <label htmlFor="aidb-description" className="font-semibold text-aid-heading">
          Describe the workflow you want to improve, in your own words
        </label>
        <p id="aidb-description-hint" className="m-0 text-small text-aid-muted">
          What happens today, who does it, and what goes wrong. No need to be formal. Please do not
          include personal data about your customers or staff.
        </p>
        <Textarea
          id="aidb-description"
          rows={6}
          maxLength={BRIEF_LIMITS.descriptionMax}
          value={draft.description}
          aria-describedby={cx(
            "aidb-description-hint",
            error && "aidb-description-error",
            "aidb-description-count",
          )}
          aria-invalid={error ? true : undefined}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="flex flex-wrap justify-between gap-(--space-3) text-small">
          <p
            id="aidb-description-error"
            role={error ? "alert" : undefined}
            className="m-0 text-aid-error"
          >
            {error}
          </p>
          <p id="aidb-description-count" className="m-0 text-aid-muted">
            {remaining} characters left
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-(--space-2)">
        <p className="m-0 text-small font-semibold text-aid-heading">Or start from an example</p>
        <ChipRow label="Example starting points">
          {exampleChips.map((chip) => (
            <Chip
              key={chip.label}
              disabled={busy}
              pressed={draft.description === chip.text}
              onClick={() => onChange(chip.text)}
            >
              {chip.label}
            </Chip>
          ))}
        </ChipRow>
      </div>

      <AiOptIn available={aiAvailable} checked={draft.aiOptIn} disabled={busy} onChange={onOptIn} />

      {busy ? (
        <div className="flex flex-col gap-(--space-3)" aria-live="polite">
          <p className="m-0 text-small text-aid-muted">
            Asking the AI assistant for questions&hellip;
          </p>
          <Skeleton lines={3} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-(--space-4)">
        <Button type="button" size="lg" loading={busy} onClick={onContinue}>
          {busy ? "Preparing questions" : "Continue"}
        </Button>
        <a
          href={simpleFormHref}
          className="inline-flex min-h-11 items-center font-semibold text-aid-link underline underline-offset-4 hover:text-aid-link-hover"
        >
          Prefer a simple form?
        </a>
      </div>
    </div>
  );
}

/** The data-use explanation and the explicit opt-in. Text is sent to the AI endpoint only if ticked. */
function AiOptIn({
  available,
  checked,
  disabled,
  onChange,
}: Readonly<{
  available: boolean;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}>) {
  if (!available) {
    return (
      <Notice tone="info" title="AI suggestions are not available right now">
        We will ask you questions from our checklist instead. It works the same way, and no AI is
        used.
      </Notice>
    );
  }
  return (
    <div className="flex flex-col gap-(--space-3) rounded-md border border-aid-border bg-aid-surface p-(--space-4)">
      <label className="flex min-h-11 cursor-pointer items-start gap-(--space-3)">
        <input
          type="checkbox"
          name="aiOptIn"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 size-5 shrink-0 accent-(--color-aid-action) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aid-focus"
        />
        <span>
          <span className="font-semibold text-aid-heading">
            Use AI to suggest questions and draft my brief
          </span>
          <span className="block text-small text-aid-muted">
            Optional. Leave it off and we will use our checklist questions instead.
          </span>
        </span>
      </label>
      <details className="text-small text-aid-text">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-aid-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aid-focus">
          What happens to my text if I turn this on?
        </summary>
        <div className="flex flex-col gap-(--space-2) pt-(--space-2)">
          <p className="m-0">
            Your description and your answers are sent to Vitalos&rsquo;s systems and on to our AI
            model provider, only to suggest questions and draft the brief. Nothing is sent until you
            continue with this switched on.
          </p>
          <p className="m-0">
            What you write is only kept by us if you choose to share the brief. We do not make any
            claim here about the provider&rsquo;s own handling of data. Please leave out personal
            data about customers or staff.
          </p>
          <p className="m-0">
            AI output is a suggestion. You can edit or remove any of it, and you will see which
            parts are yours and which were suggested.
          </p>
        </div>
      </details>
    </div>
  );
}

function QuestionsStep({
  draft,
  busy,
  onAnswer,
  onBack,
  onNext,
}: Readonly<{
  draft: DraftState;
  busy: boolean;
  onAnswer: (id: string, value: string) => void;
  onBack: () => void;
  onNext: () => void;
}>) {
  const answered = draft.questions.filter((q) => (draft.answers[q.id] ?? "").trim() !== "").length;
  return (
    <div className="flex flex-col gap-(--space-5)">
      <SourceBanner
        source={draft.questionsSource ?? "checklist"}
        notice={draft.notice}
        kind="questions"
      />
      <div className="flex flex-wrap items-center gap-(--space-2) text-small text-aid-muted">
        <ProvenanceTag kind="you">Your description</ProvenanceTag>
        <span className="min-w-0 break-words">
          {draft.description.length > 140
            ? `${draft.description.slice(0, 140)}…`
            : draft.description}
        </span>
      </div>
      <p className="m-0 text-small text-aid-muted">
        Every question is optional. Pick a suggestion, write your own answer, or skip it; skipped
        questions become &ldquo;unknowns&rdquo; in the brief.
      </p>
      {draft.questions.map((question, index) => (
        <QuestionBlock
          key={question.id}
          question={question}
          index={index}
          value={draft.answers[question.id] ?? ""}
          disabled={busy}
          onChange={(value) => onAnswer(question.id, value)}
        />
      ))}
      {busy ? (
        <div className="flex flex-col gap-(--space-3)" aria-live="polite">
          <p className="m-0 text-small text-aid-muted">
            Asking the AI assistant to draft your brief&hellip;
          </p>
          <Skeleton lines={4} />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-(--space-3)">
        <Button type="button" size="lg" loading={busy} onClick={onNext}>
          {busy
            ? "Preparing your brief"
            : answered === 0
              ? "Prepare my brief anyway"
              : "Prepare my brief"}
        </Button>
        <button type="button" className={secondaryButton} onClick={onBack} disabled={busy}>
          Back
        </button>
      </div>
    </div>
  );
}

function QuestionBlock({
  question,
  index,
  value,
  disabled,
  onChange,
}: Readonly<{
  question: BriefQuestion;
  index: number;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}>) {
  const inputId = `aidb-answer-${question.id}`;
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-(--space-3) rounded-lg border border-aid-border bg-aid-surface p-(--space-5)">
      <legend className="px-(--space-2) font-semibold text-aid-heading">
        {index + 1}. {question.question}
      </legend>
      {question.why ? <p className="m-0 text-small text-aid-muted">{question.why}</p> : null}
      {question.suggestions.length > 0 ? (
        <ChipRow label={`Quick answers for question ${index + 1}`}>
          {question.suggestions.map((suggestion) => (
            <Chip
              key={suggestion}
              disabled={disabled}
              pressed={value === suggestion}
              onClick={() => onChange(value === suggestion ? "" : suggestion)}
            >
              {suggestion}
            </Chip>
          ))}
        </ChipRow>
      ) : null}
      <label htmlFor={inputId} className="text-small font-semibold text-aid-heading">
        Your answer <span className="font-normal text-aid-muted">(optional)</span>
      </label>
      <Textarea
        id={inputId}
        rows={2}
        maxLength={BRIEF_LIMITS.answerMax}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </fieldset>
  );
}
