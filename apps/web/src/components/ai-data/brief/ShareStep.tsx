"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";
import {
  Checkbox,
  Field,
  FormErrorSummary,
  Select,
  StatusMessage,
  SubmitButton,
  TextInput,
  TextLink,
  VisuallyHidden,
} from "@vitalos/ui";
import type { FormError } from "@vitalos/ui";
import {
  AI_DATA_OFFER_NOT_SURE,
  aiDataOfferLabels,
  aiDataOffers,
  aiDataSectorLabels,
  aiDataSectors,
} from "@vitalos/validation/ai-data-enquiry";
import { enquiryFormFields, utmKeys } from "@vitalos/validation/enquiry";
import type { UtmKey } from "@vitalos/validation/enquiry";
import { initialAiDataFormState } from "../../../features/ai-data/enquiry/form-state";
import type { AiDataFormState } from "../../../features/ai-data/enquiry/form-state";
import { serialiseBrief } from "../../../features/ai-data/brief/serialise";
import { SHARED_STORAGE_KEY, serialiseShared } from "../../../features/ai-data/brief/state";
import type { DraftState } from "../../../features/ai-data/brief/state";
import type { AiDataEnquiryAction } from "../AiDataEnquiryForm";
import { TurnstileWidget } from "../../contact/TurnstileWidget";
import { timeframeOptions } from "../../contact/labels";
import { secondaryButton } from "./parts";

const ids = {
  name: "aidb-name",
  workEmail: "aidb-work-email",
  organisation: "aidb-organisation",
  role: "aidb-role",
  sector: "aidb-sector",
  offer: "aidb-offer",
  timeframe: "aidb-timeframe",
  consent: "aidb-consent",
} as const;

/** Fields that belong to the brief, not to the contact details: errors send the visitor back. */
const briefFields = ["problem", "currentProcess", "desiredOutcome"] as const;

export interface ShareStepProps {
  draft: DraftState;
  action: AiDataEnquiryAction;
  privacyNoticeVersion: string;
  utm?: Partial<Record<UtmKey, string>> | undefined;
  offer?: string | undefined;
  turnstileSiteKey?: string | undefined;
  contactEmail?: string | undefined;
  onBackToBrief: () => void;
}

/**
 * Share step: contact details are asked for only now, when the visitor chooses to share. The form
 * posts the approved brief to the SAME Server Action as the simple form (validation, rate limits,
 * human check, ADR-019 pipeline headers). The idempotency key is the draft's: a retry or a double
 * click is the same enquiry. The button is disabled while the request is pending.
 */
export function ShareStep({
  draft,
  action,
  privacyNoticeVersion,
  utm,
  offer,
  turnstileSiteKey,
  contactEmail,
  onBackToBrief,
}: ShareStepProps) {
  const [state, formAction] = useActionState<AiDataFormState, FormData>(
    action,
    initialAiDataFormState,
  );
  const outcome = useRef<HTMLDivElement>(null);
  const serialised = useMemo(
    () =>
      serialiseBrief({
        description: draft.description,
        answers: draft.questions
          .filter((q) => (draft.answers[q.id] ?? "").trim() !== "")
          .map((q) => ({ id: q.id, question: q.question, answer: draft.answers[q.id] ?? "" })),
        cards: draft.cards,
        questionsSource: draft.questionsSource ?? "checklist",
        briefSource: draft.briefSource ?? "checklist",
      }),
    [draft],
  );

  const showsOutcome =
    state.status === "rejected" ||
    state.status === "rate-limited" ||
    state.status === "unavailable";
  useEffect(() => {
    if (showsOutcome) outcome.current?.focus();
  }, [showsOutcome, state]);

  const values = state.status === "idle" || state.status === "accepted" ? {} : state.values;
  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};
  const briefProblem = briefFields.map((name) => fieldErrors[name]).find(Boolean);

  const summary: FormError[] = [];
  for (const [name, fieldId] of Object.entries(ids)) {
    const message = fieldErrors[name as keyof typeof fieldErrors];
    if (message) summary.push({ fieldId, message });
  }
  if (summary.length === 0 && state.status === "invalid") {
    summary.push({ fieldId: "aidb-form", message: state.message });
  }

  const keptCards = draft.cards.filter((card) => !card.removed).length;
  const preselected =
    values.offer ?? (offer && (aiDataOffers as readonly string[]).includes(offer) ? offer : "");

  function rememberSharedBrief() {
    // Kept in this tab for the receipt page (copy action). Removed from there on request.
    try {
      sessionStorage.setItem(
        SHARED_STORAGE_KEY,
        serialiseShared({
          fullText: serialised.fullText,
          source: draft.briefSource ?? "checklist",
          cardsKept: keptCards,
        }),
      );
    } catch {
      // Storage may be unavailable; the receipt then simply has no copy of the brief.
    }
  }

  return (
    <form
      id="aidb-form"
      action={formAction}
      onSubmit={rememberSharedBrief}
      noValidate
      tabIndex={-1}
      aria-label="Share your brief"
      className="relative flex flex-col gap-(--space-6) outline-none"
    >
      {showsOutcome ? (
        <div ref={outcome} tabIndex={-1} className="outline-offset-4">
          <StatusMessage
            variant={state.status === "rate-limited" ? "warning" : "error"}
            title={
              state.status === "unavailable"
                ? "Enquiries are unavailable right now"
                : state.status === "rate-limited"
                  ? "Please wait before sending again"
                  : "Your brief was not sent"
            }
          >
            <p>{state.message}</p>
            <p className="mt-(--space-2)">
              Your brief and details are still here, and sending again will not create a duplicate.
              {contactEmail ? (
                <>
                  {" "}
                  You can also email{" "}
                  <a className="underline underline-offset-4" href={`mailto:${contactEmail}`}>
                    {contactEmail}
                  </a>
                  .
                </>
              ) : null}
            </p>
          </StatusMessage>
        </div>
      ) : null}

      {state.status === "invalid" ? (
        <>
          <FormErrorSummary errors={summary} title={state.message} focusKey={state} />
          {briefProblem ? (
            <div className="flex flex-wrap items-center gap-(--space-3)">
              <p className="m-0 text-small text-aid-text">
                The brief itself needs a change: {briefProblem}
              </p>
              <button type="button" className={secondaryButton} onClick={onBackToBrief}>
                Back to my brief
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <input type="hidden" name="privacyNoticeVersion" value={privacyNoticeVersion} />
      <input type="hidden" name="idempotencyKey" value={draft.idempotencyKey} />
      <input type="hidden" name="problem" value={serialised.problem} />
      {serialised.currentProcess ? (
        <input type="hidden" name="currentProcess" value={serialised.currentProcess} />
      ) : null}
      <input type="hidden" name="desiredOutcome" value={serialised.desiredOutcome} />
      {utmKeys.map((key) => {
        const value = utm?.[key];
        return value ? (
          <input key={key} type="hidden" name={enquiryFormFields.utm(key)} value={value} />
        ) : null;
      })}

      <fieldset className="m-0 flex min-w-0 flex-col gap-(--space-6) border-0 p-0">
        <legend className="mb-(--space-5) p-0 text-h3 text-tone-heading">Where to reach you</legend>
        <div className="grid gap-(--space-6) sm:grid-cols-2">
          <Field label="Name" id={ids.name} required error={fieldErrors.name}>
            <TextInput name="name" autoComplete="name" defaultValue={values.name ?? ""} />
          </Field>
          <Field label="Work email" id={ids.workEmail} required error={fieldErrors.workEmail}>
            <TextInput
              name="workEmail"
              type="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              defaultValue={values.workEmail ?? ""}
            />
          </Field>
        </div>
        <div className="grid gap-(--space-6) sm:grid-cols-2">
          <Field
            label="Organisation"
            id={ids.organisation}
            required
            error={fieldErrors.organisation}
          >
            <TextInput
              name="organisation"
              autoComplete="organization"
              defaultValue={values.organisation ?? ""}
            />
          </Field>
          <Field label="Role" id={ids.role} optional error={fieldErrors.role}>
            <TextInput
              name="role"
              autoComplete="organization-title"
              defaultValue={values.role ?? ""}
            />
          </Field>
        </div>
        <div className="grid gap-(--space-6) sm:grid-cols-2">
          <Field label="Sector" id={ids.sector} required error={fieldErrors.sector}>
            <Select name="sector" defaultValue={values.sector ?? ""}>
              <option value="">Choose the closest sector</option>
              {aiDataSectors.map((sector) => (
                <option key={sector} value={sector}>
                  {aiDataSectorLabels[sector]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Timeframe" id={ids.timeframe} required error={fieldErrors.timeframe}>
            <Select name="timeframe" defaultValue={values.timeframe ?? ""}>
              <option value="">Choose a timeframe</option>
              {timeframeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label="Offer of interest"
          id={ids.offer}
          optional
          hint="Only if one of these fits. It is a pointer for the conversation, not a commitment."
          error={fieldErrors.offer}
        >
          <Select name="offer" defaultValue={preselected}>
            <option value="">No preference</option>
            {aiDataOffers.map((key) => (
              <option key={key} value={key}>
                {aiDataOfferLabels[key]}
              </option>
            ))}
            <option value={AI_DATA_OFFER_NOT_SURE}>Not sure yet</option>
          </Select>
        </Field>
      </fieldset>

      <Checkbox
        id={ids.consent}
        name="consent"
        required
        error={fieldErrors.consent}
        label={
          <>
            I have read the{" "}
            <TextLink href="/legal/privacy" arrow={false} target="_blank" rel="noopener">
              privacy notice
              <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
            </TextLink>{" "}
            and want to share this brief.
          </>
        }
      />

      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="aidb-website">Leave this field empty</label>
        <input
          id="aidb-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>

      {turnstileSiteKey ? (
        <TurnstileWidget siteKey={turnstileSiteKey} resetKey={state} contactEmail={contactEmail} />
      ) : null}

      <div className="flex flex-wrap items-center gap-(--space-4)">
        <SubmitButton pendingLabel="Sending your brief">Share my brief</SubmitButton>
        <button type="button" className={secondaryButton} onClick={onBackToBrief}>
          Back to my brief
        </button>
      </div>
    </form>
  );
}
