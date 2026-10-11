"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  Checkbox,
  Field,
  FormErrorSummary,
  Select,
  StatusMessage,
  SubmitButton,
  TextInput,
  Textarea,
  TextLink,
  VisuallyHidden,
} from "@vitalos/ui";
import type { FormError } from "@vitalos/ui";
import { enquiryFormFields, utmKeys } from "@vitalos/validation/enquiry";
import type { EnquiryFieldName, UtmKey } from "@vitalos/validation/enquiry";
import { initialEnquiryFormState } from "../../features/enquiries/form-state";
import type { EnquiryFormState, EnquiryFormValues } from "../../features/enquiries/form-state";
import { TurnstileWidget } from "./TurnstileWidget";
import { timeframeOptions } from "./labels";
import type { SelectOption } from "./labels";

/** The `submitEnquiryAction` signature (a Server Action passed in from the page). */
export type EnquiryAction = (
  previous: EnquiryFormState,
  formData: FormData,
) => Promise<EnquiryFormState>;

export interface EnquiryFormProps {
  action: EnquiryAction;
  /** Bare site path of this page, recorded as the enquiry's source. */
  sourcePath: string;
  /** Read on the server from config and passed in; never chosen by the client. */
  privacyNoticeVersion: string;
  /** A fresh UUID per render, generated on the server. */
  idempotencyKey: string;
  intentOptions: readonly SelectOption[];
  prefill?: {
    intent?: string | undefined;
    offerSlug?: string | undefined;
    utm?: Partial<Record<UtmKey, string>> | undefined;
  };
  /** Present only when Turnstile is enabled. */
  turnstileSiteKey?: string | undefined;
  /** Contact email from site settings, if editors have set one. */
  contactEmail?: string | undefined;
  /** CMS success message, if present. */
  successMessage?: string | undefined;
  privacyHref?: string;
}

const fieldIds = {
  name: "enquiry-name",
  workEmail: "enquiry-work-email",
  organisation: "enquiry-organisation",
  role: "enquiry-role",
  intent: "enquiry-intent",
  goal: "enquiry-goal",
  timeframe: "enquiry-timeframe",
  consent: "enquiry-consent",
} as const;

/** Visible fields, in form order: the error summary lists errors in this order. */
const visibleFieldOrder = [
  "name",
  "workEmail",
  "organisation",
  "role",
  "intent",
  "goal",
  "timeframe",
  "consent",
] as const satisfies readonly (keyof typeof fieldIds & EnquiryFieldName)[];

const FORM_ID = "enquiry-form";

const emailLink = (email: string) => (
  <a className="underline underline-offset-4" href={`mailto:${email}`}>
    {email}
  </a>
);

export interface EnquiryFormViewProps extends Omit<EnquiryFormProps, "action"> {
  state: EnquiryFormState;
  formAction: (formData: FormData) => void;
}

/**
 * Stateless view of the enquiry form for a given `EnquiryFormState`. It is a plain
 * `<form action>`: a native POST to the Server Action works without JavaScript, and
 * `useActionState` (in `EnquiryForm`) enhances it.
 */
export function EnquiryFormView({
  state,
  formAction,
  sourcePath,
  privacyNoticeVersion,
  idempotencyKey,
  intentOptions,
  prefill,
  turnstileSiteKey,
  contactEmail,
  successMessage,
  privacyHref = "/legal/privacy",
}: EnquiryFormViewProps) {
  const outcome = useRef<HTMLDivElement>(null);
  const showsOutcome = state.status !== "idle" && state.status !== "invalid";
  useEffect(() => {
    // Move focus to the result message so keyboard and screen reader users land on it.
    if (showsOutcome) outcome.current?.focus();
  }, [showsOutcome, state]);

  if (state.status === "accepted") {
    return (
      <div ref={outcome} tabIndex={-1} id="enquiry-outcome" className="outline-offset-4">
        <StatusMessage variant="success" title="Your enquiry has been received">
          <p>
            Your reference is <strong>{state.reference}</strong>. Keep it if you need to refer to
            this enquiry.
          </p>
          {successMessage ? <p className="mt-(--space-2)">{successMessage}</p> : null}
        </StatusMessage>
      </div>
    );
  }

  const values: EnquiryFormValues = state.status === "idle" ? {} : state.values;
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
  // Errors on fields the visitor cannot see (source path, pre-filled offer, notice version,
  // security check) still have to be reported; link them to the form itself.
  for (const [name, message] of Object.entries(fieldErrors)) {
    if (message && !seen.has(name)) summary.push({ fieldId: FORM_ID, message });
  }

  const intent = values.intent ?? prefill?.intent ?? "";
  const offerSlug = values.offerSlug ?? prefill?.offerSlug;

  const outcomeMessage =
    state.status === "rejected" || state.status === "rate-limited" || state.status === "unavailable"
      ? state
      : null;

  return (
    <form
      id={FORM_ID}
      action={formAction}
      noValidate
      tabIndex={-1}
      className="flex flex-col gap-(--space-6) outline-none"
      aria-label="Enquiry"
    >
      <div>
        {outcomeMessage ? (
          <div ref={outcome} tabIndex={-1} id="enquiry-outcome" className="outline-offset-4">
            <StatusMessage
              variant={outcomeMessage.status === "rate-limited" ? "warning" : "error"}
              title={
                outcomeMessage.status === "unavailable"
                  ? "Enquiries are unavailable right now"
                  : outcomeMessage.status === "rate-limited"
                    ? "Please wait before sending again"
                    : "Your enquiry was not sent"
              }
            >
              <p>{outcomeMessage.message}</p>
              {outcomeMessage.status === "rate-limited" ? (
                <p className="mt-(--space-2)">
                  Your details are still in the form. You can try again later
                  {contactEmail ? <>, or email {emailLink(contactEmail)}</> : null}.
                </p>
              ) : null}
              {outcomeMessage.status === "rejected" ? (
                <p className="mt-(--space-2)">
                  {turnstileSiteKey ? "The security check needs JavaScript. " : null}
                  Your details are still in the form.
                  {contactEmail ? <> You can also email {emailLink(contactEmail)}.</> : null}
                </p>
              ) : null}
              {outcomeMessage.status === "unavailable" && contactEmail ? (
                <p className="mt-(--space-2)">Email {emailLink(contactEmail)}.</p>
              ) : null}
            </StatusMessage>
          </div>
        ) : null}
      </div>

      {state.status === "invalid" ? (
        <FormErrorSummary errors={summary} title={state.message} focusKey={state} />
      ) : null}

      <input type="hidden" name="sourcePath" value={sourcePath} />
      <input type="hidden" name="privacyNoticeVersion" value={privacyNoticeVersion} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {offerSlug ? <input type="hidden" name="offerSlug" value={offerSlug} /> : null}
      {utmKeys.map((key) => {
        const value = prefill?.utm?.[key];
        return value ? (
          <input key={key} type="hidden" name={enquiryFormFields.utm(key)} value={value} />
        ) : null;
      })}

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
        <TextInput name="role" autoComplete="organization-title" defaultValue={values.role ?? ""} />
      </Field>
      <Field
        label="What would you like to talk about?"
        id={fieldIds.intent}
        required
        error={fieldErrors.intent}
      >
        <Select name="intent" defaultValue={intent}>
          <option value="">Choose a topic</option>
          {intentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="What do you want to achieve?"
        id={fieldIds.goal}
        required
        hint="Describe the problem or outcome in at least 20 characters."
        error={fieldErrors.goal}
      >
        <Textarea name="goal" rows={6} defaultValue={values.goal ?? ""} />
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

      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-10000px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        <label htmlFor="enquiry-website">Leave this field empty</label>
        <input
          id="enquiry-website"
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
        <SubmitButton pendingLabel="Sending">Send enquiry</SubmitButton>
      </div>
    </form>
  );
}

export function EnquiryForm({ action, ...rest }: EnquiryFormProps) {
  const [state, formAction] = useActionState(action, initialEnquiryFormState);
  return <EnquiryFormView {...rest} state={state} formAction={formAction} />;
}
