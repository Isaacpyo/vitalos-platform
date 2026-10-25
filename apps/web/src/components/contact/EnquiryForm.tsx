"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Checkbox,
  Field,
  Icon,
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
  enquiryFormFields,
  healthcareNeeds,
  healthcareOrganisationTypes,
  isHealthcareIntent,
  utmKeys,
} from "@vitalos/validation/enquiry";
import type { EnquiryFieldName, UtmKey } from "@vitalos/validation/enquiry";
import { initialEnquiryFormState } from "../../features/enquiries/form-state";
import type { EnquiryFormState, EnquiryFormValues } from "../../features/enquiries/form-state";
import {
  healthcareNeedLabels,
  healthcareOrganisationTypeLabels,
  noPatientInformationNotice,
  preselectedNeeds,
} from "../../features/enquiries/healthcare";
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
  healthcareOrganisationType: "enquiry-healthcare-organisation-type",
  healthcareSites: "enquiry-healthcare-sites",
  healthcareSystems: "enquiry-healthcare-systems",
  healthcareNeeds: "enquiry-healthcare-needs",
} as const;

/** Visible fields, in form order: the error summary lists errors in this order. */
const visibleFieldOrder = [
  "name",
  "workEmail",
  "organisation",
  "role",
  "intent",
  "healthcare",
  "goal",
  "timeframe",
  "consent",
] as const satisfies readonly ((keyof typeof fieldIds | "healthcare") & EnquiryFieldName)[];

/** Where an error on the Health & Care block points: the group of needs. */
const errorTarget = (name: (typeof visibleFieldOrder)[number]): string =>
  name === "healthcare" ? fieldIds.healthcareNeeds : fieldIds[name];

const FORM_ID = "enquiry-form";

/** Two fields side by side from sm; stacked below. */
const PAIR_CLASSES = "grid gap-(--space-6) sm:grid-cols-2";

const goalHint = "Describe the problem or outcome in at least 20 characters.";

/**
 * The Health & Care questions (Website Build Pack, 25 Oct 2026, Part 2), shown with a Health &
 * Care topic. All optional. The needs are a native checkbox group in a fieldset, so the legend
 * names the group for assistive technology.
 */
function HealthcareFields({
  values,
  preselected,
  error,
}: Readonly<{
  values: EnquiryFormValues;
  preselected: readonly string[];
  error: string | undefined;
}>) {
  const echoed = values.healthcareNeeds?.split(",").filter(Boolean);
  const checked = new Set(echoed ?? preselected);
  return (
    <>
      <div className={PAIR_CLASSES}>
        <Field label="Organisation type" id={fieldIds.healthcareOrganisationType} optional>
          <Select
            name={enquiryFormFields.healthcareOrganisationType}
            defaultValue={values.healthcareOrganisationType ?? ""}
          >
            <option value="">Choose a type</option>
            {healthcareOrganisationTypes.map((value) => (
              <option key={value} value={value}>
                {healthcareOrganisationTypeLabels[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Number of sites" id={fieldIds.healthcareSites} optional>
          <TextInput
            name={enquiryFormFields.healthcareSites}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            defaultValue={values.healthcareSites ?? ""}
          />
        </Field>
      </div>
      <fieldset
        id={fieldIds.healthcareNeeds}
        tabIndex={-1}
        aria-describedby={error ? `${fieldIds.healthcareNeeds}-error` : undefined}
        className="m-0 flex flex-col gap-(--space-3) border-0 p-0 outline-none"
      >
        <legend className="mb-(--space-3) p-0 text-body font-semibold text-tone-heading">
          What do you need? <span className="font-normal text-tone-muted">(optional)</span>
        </legend>
        {error ? (
          <p
            id={`${fieldIds.healthcareNeeds}-error`}
            className="m-0 flex items-start gap-(--space-2) text-small text-danger"
          >
            <Icon name="error" size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}
        <div className="grid gap-(--space-3) sm:grid-cols-2">
          {healthcareNeeds.map((need) => (
            <Checkbox
              key={need}
              id={`${fieldIds.healthcareNeeds}-${need}`}
              name={enquiryFormFields.healthcareNeeds}
              value={need}
              defaultChecked={checked.has(need)}
              label={healthcareNeedLabels[need]}
            />
          ))}
        </div>
      </fieldset>
      <Field label="Systems you use today" id={fieldIds.healthcareSystems} optional>
        <TextInput
          name={enquiryFormFields.healthcareSystems}
          defaultValue={values.healthcareSystems ?? ""}
        />
      </Field>
    </>
  );
}

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
  // The topic as the visitor changes it: the Health & Care fields follow it (with JavaScript;
  // without it they follow the topic the page opened with).
  const [selectedIntent, setIntent] = useState<string | undefined>(undefined);
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
      summary.push({ fieldId: errorTarget(name), message });
      seen.add(name);
    }
  }
  // Errors on fields the visitor cannot see (source path, pre-filled offer, notice version,
  // security check) still have to be reported; link them to the form itself.
  for (const [name, message] of Object.entries(fieldErrors)) {
    if (message && !seen.has(name)) summary.push({ fieldId: FORM_ID, message });
  }

  const initialIntent = values.intent ?? prefill?.intent ?? "";
  const offerSlug = values.offerSlug ?? prefill?.offerSlug;

  const intent = selectedIntent ?? initialIntent;
  const healthcare = isHealthcareIntent(intent);

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

      <div className={PAIR_CLASSES}>
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
      <div className={PAIR_CLASSES}>
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
      <Field
        label="What would you like to talk about?"
        id={fieldIds.intent}
        required
        error={fieldErrors.intent}
      >
        <Select
          name="intent"
          defaultValue={initialIntent}
          onChange={(event) => setIntent(event.currentTarget.value)}
        >
          <option value="">Choose a topic</option>
          {intentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      {healthcare ? (
        <HealthcareFields
          values={values}
          preselected={preselectedNeeds(intent, offerSlug)}
          error={fieldErrors.healthcare}
        />
      ) : null}
      <Field
        label="What do you want to achieve?"
        id={fieldIds.goal}
        required
        hint={
          healthcare ? (
            <>
              <span className="flex items-start gap-(--space-2) font-semibold text-tone-heading">
                <Icon name="warning" size={16} className="mt-(--space-1) shrink-0" />
                <span>{noPatientInformationNotice}</span>
              </span>
              <span className="mt-(--space-1) block">{goalHint}</span>
            </>
          ) : (
            goalHint
          )
        }
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
  const [state, formAction, pending] = useActionState(action, initialEnquiryFormState);
  return (
    <>
      <EnquiryFormView {...rest} state={state} formAction={formAction} />
      {/* Open while the request is in flight (including the redirect to the thank-you page). On a
          validation or delivery error it closes and the form's own message takes focus. */}
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
