"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  Checkbox,
  Field,
  FormErrorSummary,
  Select,
  StatusMessage,
  SubmissionDialog,
  SubmitButton,
  TextInput,
  Textarea,
  TextLink,
  VisuallyHidden,
} from "@vitalos/ui";
import type { FormError } from "@vitalos/ui";
import {
  AI_DATA_OFFER_NOT_SURE,
  AI_DATA_OUTCOME_MAX,
  AI_DATA_OUTCOME_MIN,
  AI_DATA_PROBLEM_MAX,
  AI_DATA_PROBLEM_MIN,
  AI_DATA_PROCESS_MAX,
  aiDataBudgetBands,
  aiDataBudgetLabels,
  aiDataOfferLabels,
  aiDataOffers,
  aiDataSectorLabels,
  aiDataSectors,
} from "@vitalos/validation/ai-data-enquiry";
import type { AiDataFieldName } from "@vitalos/validation/ai-data-enquiry";
import { enquiryFormFields, utmKeys } from "@vitalos/validation/enquiry";
import type { UtmKey } from "@vitalos/validation/enquiry";
import { initialAiDataFormState } from "../../features/ai-data/enquiry/form-state";
import type { AiDataFormState, AiDataFormValues } from "../../features/ai-data/enquiry/form-state";
import { TurnstileWidget } from "../contact/TurnstileWidget";
import { timeframeOptions } from "../contact/labels";

/** The `submitAiDataEnquiryAction` signature (a Server Action passed in from the page). */
export type AiDataEnquiryAction = (
  previous: AiDataFormState,
  formData: FormData,
) => Promise<AiDataFormState>;

export interface AiDataEnquiryFormProps {
  action: AiDataEnquiryAction;
  /** Read on the server from config and passed in; never chosen by the client. */
  privacyNoticeVersion: string;
  /** A fresh UUID per render, generated on the server. */
  idempotencyKey: string;
  prefill?: {
    offer?: string | undefined;
    utm?: Partial<Record<UtmKey, string>> | undefined;
  };
  turnstileSiteKey?: string | undefined;
  contactEmail?: string | undefined;
  privacyHref?: string;
}

const fieldIds = {
  name: "aid-name",
  workEmail: "aid-work-email",
  organisation: "aid-organisation",
  role: "aid-role",
  sector: "aid-sector",
  problem: "aid-problem",
  currentProcess: "aid-current-process",
  desiredOutcome: "aid-desired-outcome",
  offer: "aid-offer",
  timeframe: "aid-timeframe",
  budget: "aid-budget",
  consent: "aid-consent",
} as const satisfies Partial<Record<AiDataFieldName, string>>;

/** Visible fields in form order: the error summary lists errors in this order. */
const visibleFieldOrder = Object.keys(fieldIds) as (keyof typeof fieldIds)[];

const FORM_ID = "ai-data-enquiry-form";
const PAIR = "grid gap-(--space-6) sm:grid-cols-2";

const emailLink = (email: string) => (
  <a className="underline underline-offset-4" href={`mailto:${email}`}>
    {email}
  </a>
);

export interface AiDataEnquiryFormViewProps extends Omit<AiDataEnquiryFormProps, "action"> {
  state: AiDataFormState;
  formAction: (formData: FormData) => void;
}

/**
 * Stateless view of the AI & Data enquiry form for a given state. A plain `<form action>`: the
 * native POST to the Server Action works without JavaScript; `useActionState` enhances it.
 */
export function AiDataEnquiryFormView({
  state,
  formAction,
  privacyNoticeVersion,
  idempotencyKey,
  prefill,
  turnstileSiteKey,
  contactEmail,
  privacyHref = "/legal/privacy",
}: AiDataEnquiryFormViewProps) {
  const outcome = useRef<HTMLDivElement>(null);
  const showsOutcome =
    state.status === "rejected" ||
    state.status === "rate-limited" ||
    state.status === "unavailable";
  useEffect(() => {
    if (showsOutcome) outcome.current?.focus();
  }, [showsOutcome, state]);

  const values: AiDataFormValues =
    state.status === "idle" || state.status === "accepted" ? {} : state.values;
  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};

  const summary: FormError[] = [];
  const seen = new Set<string>();
  for (const name of visibleFieldOrder) {
    const message = fieldErrors[name];
    if (message) {
      summary.push({ fieldId: fieldIds[name], message });
      seen.add(name);
    }
  }
  for (const [name, message] of Object.entries(fieldErrors)) {
    if (message && !seen.has(name)) summary.push({ fieldId: FORM_ID, message });
  }

  const offer =
    values.offer ??
    (prefill?.offer && (aiDataOffers as readonly string[]).includes(prefill.offer)
      ? prefill.offer
      : "");

  return (
    <form
      id={FORM_ID}
      action={formAction}
      noValidate
      tabIndex={-1}
      className="relative flex flex-col gap-(--space-6) outline-none"
      aria-label="Discuss your business challenge"
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
                  : "Your enquiry was not sent"
            }
          >
            <p>{state.message}</p>
            <p className="mt-(--space-2)">
              {state.status === "rejected" && turnstileSiteKey
                ? "The security check needs JavaScript. "
                : null}
              Your details are still in the form.
              {contactEmail ? <> You can also email {emailLink(contactEmail)}.</> : null}
            </p>
          </StatusMessage>
        </div>
      ) : null}

      {state.status === "invalid" ? (
        <FormErrorSummary errors={summary} title={state.message} focusKey={state} />
      ) : null}

      <input type="hidden" name="privacyNoticeVersion" value={privacyNoticeVersion} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {utmKeys.map((key) => {
        const value = prefill?.utm?.[key];
        return value ? (
          <input key={key} type="hidden" name={enquiryFormFields.utm(key)} value={value} />
        ) : null;
      })}

      <fieldset className="m-0 flex min-w-0 flex-col gap-(--space-6) border-0 p-0">
        <legend className="mb-(--space-5) p-0 text-h3 text-tone-heading">About you</legend>
        <div className={PAIR}>
          <Field label="Name" id={fieldIds.name} required error={fieldErrors.name}>
            <TextInput name="name" autoComplete="name" defaultValue={values.name ?? ""} />
          </Field>
          <Field label="Work email" id={fieldIds.workEmail} required error={fieldErrors.workEmail}>
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
        <div className={PAIR}>
          <Field
            label="Organisation"
            id={fieldIds.organisation}
            required
            error={fieldErrors.organisation}
          >
            <TextInput
              name="organisation"
              autoComplete="organization"
              defaultValue={values.organisation ?? ""}
            />
          </Field>
          <Field label="Role" id={fieldIds.role} optional error={fieldErrors.role}>
            <TextInput
              name="role"
              autoComplete="organization-title"
              defaultValue={values.role ?? ""}
            />
          </Field>
        </div>
        <Field label="Sector" id={fieldIds.sector} required error={fieldErrors.sector}>
          <Select name="sector" defaultValue={values.sector ?? ""}>
            <option value="">Choose the closest sector</option>
            {aiDataSectors.map((sector) => (
              <option key={sector} value={sector}>
                {aiDataSectorLabels[sector]}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>

      <div className="border-t border-tone-border pt-(--space-6)">
        <fieldset className="m-0 flex min-w-0 flex-col gap-(--space-6) border-0 p-0">
          <legend className="mb-(--space-5) p-0 text-h3 text-tone-heading">Your challenge</legend>
          <Field
            label="Business problem or workflow"
            id={fieldIds.problem}
            required
            hint={`What happens today, who does it and what goes wrong. ${AI_DATA_PROBLEM_MIN} to ${AI_DATA_PROBLEM_MAX} characters.`}
            error={fieldErrors.problem}
          >
            <Textarea
              name="problem"
              rows={6}
              maxLength={AI_DATA_PROBLEM_MAX}
              defaultValue={values.problem ?? ""}
            />
          </Field>
          <Field
            label="Current tools and process"
            id={fieldIds.currentProcess}
            optional
            hint={`For example the software, spreadsheets or paper involved. Up to ${AI_DATA_PROCESS_MAX} characters.`}
            error={fieldErrors.currentProcess}
          >
            <Textarea
              name="currentProcess"
              rows={4}
              maxLength={AI_DATA_PROCESS_MAX}
              defaultValue={values.currentProcess ?? ""}
            />
          </Field>
          <Field
            label="Desired outcome"
            id={fieldIds.desiredOutcome}
            required
            hint={`What would be better if this worked. ${AI_DATA_OUTCOME_MIN} to ${AI_DATA_OUTCOME_MAX} characters.`}
            error={fieldErrors.desiredOutcome}
          >
            <Textarea
              name="desiredOutcome"
              rows={4}
              maxLength={AI_DATA_OUTCOME_MAX}
              defaultValue={values.desiredOutcome ?? ""}
            />
          </Field>
        </fieldset>
      </div>

      <div className="border-t border-tone-border pt-(--space-6)">
        <fieldset className="m-0 flex min-w-0 flex-col gap-(--space-6) border-0 p-0">
          <legend className="mb-(--space-5) p-0 text-h3 text-tone-heading">Scope</legend>
          <div className={PAIR}>
            <Field label="Offer of interest" id={fieldIds.offer} optional error={fieldErrors.offer}>
              <Select name="offer" defaultValue={offer}>
                <option value="">No preference</option>
                {aiDataOffers.map((key) => (
                  <option key={key} value={key}>
                    {aiDataOfferLabels[key]}
                  </option>
                ))}
                <option value={AI_DATA_OFFER_NOT_SURE}>Not sure yet</option>
              </Select>
            </Field>
            <Field label="Timeframe" id={fieldIds.timeframe} required error={fieldErrors.timeframe}>
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
            label="Indicative budget"
            id={fieldIds.budget}
            optional
            hint="Your own estimate, to help us suggest a sensible first step. Leave it blank if you prefer."
            error={fieldErrors.budget}
          >
            <Select name="budget" defaultValue={values.budget ?? ""}>
              <option value="">Prefer not to say</option>
              {aiDataBudgetBands.map((band) => (
                <option key={band} value={band}>
                  {aiDataBudgetLabels[band]}
                </option>
              ))}
            </Select>
          </Field>
        </fieldset>
      </div>

      <Checkbox
        id={fieldIds.consent}
        name="consent"
        required
        error={fieldErrors.consent}
        label={
          <>
            I have read the{" "}
            <TextLink href={privacyHref} arrow={false} target="_blank" rel="noopener">
              privacy notice
              <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
            </TextLink>
            .
          </>
        }
      />

      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="aid-website">Leave this field empty</label>
        <input
          id="aid-website"
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

      <div>
        <SubmitButton pendingLabel="Sending">Send your challenge</SubmitButton>
      </div>
    </form>
  );
}

export function AiDataEnquiryForm({ action, ...rest }: AiDataEnquiryFormProps) {
  const [state, formAction, pending] = useActionState(action, initialAiDataFormState);
  return (
    <>
      <AiDataEnquiryFormView {...rest} state={state} formAction={formAction} />
      <SubmissionDialog
        open={pending}
        phase="sending"
        sendingTitle="Sending your enquiry…"
        successTitle="Your enquiry has been received"
        onClose={() => undefined}
      />
    </>
  );
}
