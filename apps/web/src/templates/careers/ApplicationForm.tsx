"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import {
  Button,
  Checkbox,
  Field,
  FormErrorSummary,
  Icon,
  TextInput,
  TextLink,
  Textarea,
  VisuallyHidden,
} from "@vitalos/ui";
import { TurnstileWidget } from "../../components/contact/TurnstileWidget";
import {
  COVER_NOTE_COUNTER_FROM,
  COVER_NOTE_MAX,
  cvError,
  cvMimeOf,
  fieldOrder,
  formCopy,
  mapErrorCodes,
  messages,
  rightToWorkOptions,
  validateApplication,
} from "../../features/content/careers/form";
import type { ApplicationFields, FieldName } from "../../features/content/careers/form";

/**
 * The application form (brief 6.3, A9): the only client JavaScript on a role page. It uploads
 * the CV straight to the admin's storage with a single-use ticket (the file never passes through
 * the website), then sends the application. Hidden until hydrated: without JavaScript the
 * `<noscript>` line says what to do instead.
 */

export interface ApplicationFormProps {
  roleSlug: string;
  roleTitle: string;
  privacyNoticeUrl: string;
  /** The site's contact address, for the confirmation's withdrawal line; omitted when unknown. */
  contactEmail?: string | undefined;
  /** Public Turnstile site key, or undefined when Turnstile is not configured. */
  turnstileSiteKey?: string | undefined;
}

type Status = "idle" | "sending" | "sent";

interface Ticket {
  uploadId: string;
  uploadUrl: string;
  headers: Record<string, string>;
}

const empty: ApplicationFields = {
  name: "",
  email: "",
  phone: "",
  location: "",
  linkedinUrl: "",
  portfolioUrl: "",
  coverNote: "",
  rightToWork: "",
  noticePeriod: "",
  consent: false,
};

const noSubscription = () => () => undefined;

const sizeLabel = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

type TextFieldName = Exclude<keyof ApplicationFields, "consent" | "rightToWork" | "coverNote">;

async function postJson(url: string, body: unknown): Promise<{ status: number; data: unknown }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { status: response.status, data };
}

const errorsOf = (data: unknown): Record<string, string> =>
  typeof data === "object" && data !== null && "errors" in data && typeof data.errors === "object"
    ? (data.errors as Record<string, string>)
    : {};

export function ApplicationForm({
  roleSlug,
  roleTitle,
  privacyNoticeUrl,
  contactEmail,
  turnstileSiteKey,
}: Readonly<ApplicationFormProps>) {
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const id = useId();
  const fieldId = useCallback((name: FieldName) => `${id}-${name}`, [id]);
  const [fields, setFields] = useState<ApplicationFields>(empty);
  const [cv, setCv] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<{ roleTitle: string; processHtml: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [turnstileReset, setTurnstileReset] = useState(0);
  // Counts sends that failed validation, so the error summary takes focus again each time.
  const [attempt, setAttempt] = useState(0);
  const [submissionId] = useState(() => crypto.randomUUID());
  const ticket = useRef<{ file: File; ticket: Ticket } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const focusAfterErrors = useRef(false);

  useEffect(() => {
    if (status === "sent") successRef.current?.focus();
  }, [status]);

  useEffect(() => {
    if (!focusAfterErrors.current) return;
    focusAfterErrors.current = false;
    const first = fieldOrder.find((name) => errors[name]);
    if (first) {
      const target = document.getElementById(
        fieldId(first === "rightToWork" ? "rightToWork" : first),
      );
      (target?.querySelector<HTMLElement>("input") ?? target)?.focus();
    } else if (formError) {
      summaryRef.current?.focus();
    }
  }, [errors, formError, fieldId]);

  const cvInfo = cv ? { name: cv.name, size: cv.size, type: cv.type } : null;

  /** Re-checks one field against the shared rules: sets its message, or clears it when fixed. */
  const recheck = (name: FieldName, next: ApplicationFields) => {
    const message = validateApplication(next, cvInfo)[name];
    setErrors((current) => {
      if (current[name] === message) return current;
      const updated = { ...current };
      if (message) updated[name] = message;
      else delete updated[name];
      return updated;
    });
  };

  /** Typing clears a shown error as soon as the answer is valid; it never adds one. */
  const change = <K extends keyof ApplicationFields>(name: K, value: ApplicationFields[K]) => {
    const next = { ...fields, [name]: value };
    setFields(next);
    if (errors[name as FieldName]) recheck(name as FieldName, next);
  };

  /**
   * Inline validation on leaving a field: an answer that was given is checked straight away; a
   * required field left empty is only reported when the form is sent (no error for just tabbing
   * through).
   */
  const blur = (name: TextFieldName | "coverNote") => {
    if (fields[name].trim() || errors[name]) recheck(name, fields);
  };

  const showErrors = (next: Partial<Record<FieldName, string>>, form: string | null = null) => {
    focusAfterErrors.current = true;
    setErrors(next);
    setFormError(form);
  };

  const chooseFile = (file: File | null) => {
    if (!file) {
      const input = document.getElementById(fieldId("cv")) as HTMLInputElement | null;
      if (input) input.value = "";
    }
    setCv(file);
    ticket.current = null;
    const problem = file ? cvError({ name: file.name, size: file.size, type: file.type }) : null;
    setErrors((current) => {
      const next = { ...current };
      if (problem) next.cv = problem;
      else delete next.cv;
      return next;
    });
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) =>
    chooseFile(event.target.files?.[0] ?? null);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0] ?? null);
  };

  async function upload(file: File, token: string, honeypot: string): Promise<Ticket | null> {
    if (ticket.current?.file === file) return ticket.current.ticket;
    const mime = cvMimeOf({ name: file.name, size: file.size, type: file.type });
    let response: { status: number; data: unknown };
    try {
      response = await postJson("/api/careers/uploads", {
        roleSlug,
        filename: file.name,
        size: file.size,
        mime: mime ?? file.type,
        turnstileToken: token,
        ...(honeypot ? { website: honeypot } : {}),
      });
    } catch {
      showErrors({ cv: messages.upload });
      return null;
    }
    if (response.status !== 200) {
      const mapped = mapErrorCodes(errorsOf(response.data));
      if (response.status === 503 || (!mapped.form && Object.keys(mapped.fields).length === 0)) {
        mapped.fields.cv = messages.upload;
      }
      showErrors(mapped.fields, mapped.form);
      setTurnstileReset((value) => value + 1);
      return null;
    }
    const issued = response.data as Ticket;
    try {
      const put = await fetch(issued.uploadUrl, {
        method: "PUT",
        headers: issued.headers,
        body: file,
      });
      if (!put.ok) throw new Error(String(put.status));
    } catch {
      showErrors({ cv: messages.upload });
      setTurnstileReset((value) => value + 1);
      return null;
    }
    ticket.current = { file, ticket: issued };
    return issued;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    const found = validateApplication(
      fields,
      cv ? { name: cv.name, size: cv.size, type: cv.type } : null,
    );
    if (Object.keys(found).length > 0 || !cv) {
      setAttempt((value) => value + 1);
      showErrors(found);
      return;
    }
    setStatus("sending");
    setFormError(null);
    const data = new FormData(event.currentTarget);
    const token = String(data.get("cf-turnstile-response") ?? "");
    const honeypot = String(data.get("website") ?? "");
    const issued = await upload(cv, token, honeypot);
    if (!issued) {
      setStatus("idle");
      return;
    }
    let response: { status: number; data: unknown };
    try {
      response = await postJson("/api/careers/applications", {
        submissionId,
        roleSlug,
        uploadId: issued.uploadId,
        ...fields,
        ...(honeypot ? { website: honeypot } : {}),
      });
    } catch {
      setStatus("idle");
      showErrors({}, messages.unavailable);
      return;
    }
    if (response.status === 200) {
      const accepted = response.data as { roleTitle?: string; processHtml?: string };
      setResult({
        roleTitle: accepted.roleTitle ?? roleTitle,
        processHtml: accepted.processHtml ?? "",
      });
      setStatus("sent");
      return;
    }
    setStatus("idle");
    if (response.status === 503) {
      showErrors({}, messages.unavailable);
      return;
    }
    const mapped = mapErrorCodes(errorsOf(response.data));
    // An upload the admin no longer accepts needs a fresh one next time.
    if (mapped.fields.cv) ticket.current = null;
    showErrors(
      mapped.fields,
      mapped.form ?? (Object.keys(mapped.fields).length ? null : messages.unavailable),
    );
  }

  if (status === "sent" && result) {
    const email = contactEmail?.trim();
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        className="border-t-2 border-tone-action pt-(--space-5) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tone-focus"
      >
        <h3 className="m-0 text-h2 text-tone-heading">
          {formCopy.successTitle.slice(0, -1)}
          <span className="text-tone-link">.</span>
        </h3>
        <p className="mt-(--space-4) text-body-l text-tone-text">
          {formCopy.successBody(result.roleTitle)}
        </p>
        <h4 className="m-0 mt-(--space-6) text-h3 text-tone-heading">{formCopy.nextHeading}</h4>
        <p className="m-0 mt-(--space-3) text-body text-tone-text">{formCopy.nextAssess}</p>
        {result.processHtml ? (
          <div
            className="mt-(--space-3) text-body text-tone-text [&_li]:my-(--space-2) [&_ol]:list-decimal [&_ol]:pl-(--space-5) [&_p]:my-(--space-3) [&_ul]:list-disc [&_ul]:pl-(--space-5)"
            // Sanitised by the site's one renderer on the server.
            dangerouslySetInnerHTML={{ __html: result.processHtml }}
          />
        ) : null}
        <p className="m-0 mt-(--space-3) text-body text-tone-text">
          {formCopy.nextContactBefore}
          <TextLink href={privacyNoticeUrl} arrow={false}>
            {formCopy.consentLink}
          </TextLink>
          {formCopy.nextContactAfter}
        </p>
        {email ? (
          <p className="m-0 mt-(--space-3) text-body text-tone-text">
            {formCopy.withdrawBefore}
            <TextLink href={`mailto:${email}`} arrow={false}>
              {email}
            </TextLink>
            {formCopy.withdrawAfter}
          </p>
        ) : null}
      </div>
    );
  }

  const errorList = fieldOrder.filter((name) => errors[name]);
  const remaining = COVER_NOTE_MAX - fields.coverNote.length;
  const showCounter = fields.coverNote.length >= COVER_NOTE_COUNTER_FROM;
  const cvHint = `${fieldId("cv")}-hint`;
  const cvErrorId = `${fieldId("cv")}-error`;
  const cvChosen = `${fieldId("cv")}-chosen`;
  const coverCount = `${fieldId("coverNote")}-count`;
  const rightToWorkError = `${fieldId("rightToWork")}-error`;

  /** The error line under a control the shared Field does not wrap (CV, right to work). */
  const ownError = (name: FieldName, errorElementId: string) =>
    errors[name] ? (
      <p
        id={errorElementId}
        className="m-0 mt-(--space-2) flex items-start gap-(--space-2) text-small text-danger"
      >
        <Icon name="error" size={16} className="mt-0.5 shrink-0" />
        <span>
          <VisuallyHidden>Error: </VisuallyHidden>
          {errors[name]}
        </span>
      </p>
    ) : null;

  const text = (
    name: TextFieldName,
    title: string,
    props: {
      type?: string;
      autoComplete?: string;
      required?: boolean;
      inputMode?: "url" | "tel" | "email";
    },
  ) => (
    <Field
      id={fieldId(name)}
      label={title}
      optional={!props.required}
      optionalText={formCopy.optional}
      error={errors[name]}
    >
      <TextInput
        name={name}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        value={fields[name]}
        onChange={(event) => change(name, event.target.value)}
        onBlur={() => blur(name)}
        aria-required={props.required ? true : undefined}
      />
    </Field>
  );

  return (
    <>
      <noscript>
        <p className="m-0 text-body-l text-tone-text">{formCopy.noScript}</p>
      </noscript>
      <form
        ref={formRef}
        hidden={!hydrated}
        noValidate
        onSubmit={onSubmit}
        className="flex max-w-[44rem] flex-col gap-(--space-5)"
      >
        {formError ? (
          <div
            ref={summaryRef}
            tabIndex={-1}
            role="alert"
            className="rounded-sm border-2 border-danger bg-tone-bg p-(--space-5)"
          >
            <p className="m-0 flex items-center gap-(--space-2) text-body font-semibold text-danger">
              <Icon name="error" size={20} className="shrink-0" />
              {formError}
            </p>
          </div>
        ) : null}
        {errorList.length > 1 ? (
          <FormErrorSummary
            title={formCopy.errorSummary}
            focusKey={attempt}
            errors={errorList.map((name) => ({
              fieldId: fieldId(name),
              message: errors[name],
            }))}
          />
        ) : null}

        {text("name", formCopy.name, { autoComplete: "name", required: true })}
        {text("email", formCopy.email, {
          type: "email",
          autoComplete: "email",
          inputMode: "email",
          required: true,
        })}
        {text("phone", formCopy.phone, { type: "tel", autoComplete: "tel", inputMode: "tel" })}
        {text("location", formCopy.location, { autoComplete: "address-level2" })}
        {text("linkedinUrl", formCopy.linkedinUrl, { type: "url", inputMode: "url" })}
        {text("portfolioUrl", formCopy.portfolioUrl, { type: "url", inputMode: "url" })}

        <div>
          <span
            id={`${fieldId("cv")}-label`}
            className="block text-body font-semibold text-tone-heading"
          >
            {formCopy.cv}
          </span>
          <p id={cvHint} className="m-0 mt-(--space-2) text-small text-tone-muted">
            {formCopy.cvHint}
          </p>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`mt-(--space-2) flex flex-wrap items-center gap-(--space-3) rounded-sm border-2 border-dashed bg-tone-control-bg p-(--space-4) transition-colors duration-(--duration-feedback) ease-(--ease-standard) ${dragging ? "border-tone-action" : errors.cv ? "border-danger" : "border-tone-control-border"}`}
          >
            <input
              id={fieldId("cv")}
              name="cv"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={onFile}
              aria-labelledby={`${fieldId("cv")}-label ${fieldId("cv")}-choose`}
              aria-invalid={errors.cv ? true : undefined}
              aria-describedby={[
                cvHint,
                cv ? cvChosen : undefined,
                errors.cv ? cvErrorId : undefined,
              ]
                .filter(Boolean)
                .join(" ")}
              className="peer sr-only"
            />
            <label
              id={`${fieldId("cv")}-choose`}
              htmlFor={fieldId("cv")}
              className="inline-flex min-h-(--size-control) cursor-pointer items-center rounded-sm border border-tone-heading bg-tone-bg px-(--space-4) text-body font-semibold text-tone-heading transition-colors duration-(--duration-feedback) ease-(--ease-standard) hover:bg-tone-heading hover:text-tone-bg peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-tone-focus"
            >
              {cv ? formCopy.cvReplace : formCopy.cvChoose}
            </label>
            {cv ? (
              <>
                <p id={cvChosen} className="m-0 min-w-0 break-all text-body text-tone-heading">
                  {cv.name}, {sizeLabel(cv.size)}
                </p>
                <Button
                  type="button"
                  variant="text"
                  className="min-h-11"
                  onClick={() => chooseFile(null)}
                >
                  {formCopy.cvRemove}
                  <span className="sr-only"> {cv.name}</span>
                </Button>
              </>
            ) : (
              <span className="text-body text-tone-muted">{formCopy.cvDrop}</span>
            )}
          </div>
          <p aria-live="polite" className="sr-only">
            {cv ? formCopy.cvChosen(cv.name) : ""}
          </p>
          {ownError("cv", cvErrorId)}
        </div>

        <Field
          id={fieldId("coverNote")}
          label={formCopy.coverNote}
          optional
          optionalText={formCopy.optional}
          error={errors.coverNote}
        >
          <Textarea
            name="coverNote"
            rows={6}
            maxLength={COVER_NOTE_MAX}
            value={fields.coverNote}
            onChange={(event) => change("coverNote", event.target.value)}
            onBlur={() => blur("coverNote")}
            aria-describedby={showCounter ? coverCount : undefined}
          />
          <p id={coverCount} aria-live="polite" className="m-0 text-small text-tone-muted">
            {showCounter ? formCopy.remaining(remaining) : ""}
          </p>
        </Field>

        <fieldset
          id={fieldId("rightToWork")}
          aria-describedby={errors.rightToWork ? rightToWorkError : undefined}
          className="m-0 border-0 p-0"
        >
          <legend className="text-body font-semibold text-tone-heading">
            {formCopy.rightToWork}
          </legend>
          <div className="mt-(--space-2) flex flex-col gap-(--space-2)">
            {rightToWorkOptions.map((option) => (
              <label
                key={option.value}
                className="flex min-h-11 items-center gap-(--space-3) text-body text-tone-text"
              >
                <input
                  type="radio"
                  name="rightToWork"
                  value={option.value}
                  checked={fields.rightToWork === option.value}
                  onChange={() => change("rightToWork", option.value)}
                  aria-invalid={errors.rightToWork ? true : undefined}
                  className="size-5 accent-tone-action"
                />
                {option.label}
              </label>
            ))}
          </div>
          {ownError("rightToWork", rightToWorkError)}
        </fieldset>

        {text("noticePeriod", formCopy.noticePeriod, {})}

        <Checkbox
          id={fieldId("consent")}
          name="consent"
          checked={fields.consent}
          onChange={(event) => change("consent", event.target.checked)}
          error={errors.consent}
          label={
            <>
              {formCopy.consentBefore}
              <TextLink href={privacyNoticeUrl} arrow={false}>
                {formCopy.consentLink}
              </TextLink>
              {formCopy.consentAfter}
            </>
          }
        />

        {/* Honeypot: hidden from people and assistive technology; bots fill it. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor={`${id}-website`}>Website</label>
          <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {turnstileSiteKey ? (
          <TurnstileWidget siteKey={turnstileSiteKey} action="careers" resetKey={turnstileReset} />
        ) : null}

        <div>
          <Button
            type="submit"
            size="lg"
            aria-disabled={status === "sending" || undefined}
            aria-busy={status === "sending" || undefined}
          >
            {status === "sending" ? formCopy.sending : formCopy.submit}
          </Button>
        </div>
      </form>
    </>
  );
}
