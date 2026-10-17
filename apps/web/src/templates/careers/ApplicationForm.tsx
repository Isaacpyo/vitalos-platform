"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { ChangeEvent, DragEvent, FormEvent, ReactNode } from "react";
import { Button, SubmissionDialog } from "@vitalos/ui";
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

const inputClass =
  "block min-h-11 w-full border border-tone-control-border bg-tone-control-bg px-(--space-3) text-body text-tone-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tone-focus aria-[invalid=true]:border-danger";

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
  turnstileSiteKey,
}: Readonly<ApplicationFormProps>) {
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const id = useId();
  const fieldId = useCallback((name: FieldName) => `${id}-${name}`, [id]);
  const errorId = (name: FieldName) => `${id}-${name}-error`;
  const [fields, setFields] = useState<ApplicationFields>(empty);
  const [cv, setCv] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<{ roleTitle: string; processHtml: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [submissionId] = useState(() => crypto.randomUUID());
  const ticket = useRef<{ file: File; ticket: Ticket } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const focusAfterErrors = useRef(false);

  const [confirmationClosed, setConfirmationClosed] = useState(false);

  useEffect(() => {
    // While the confirmation dialog is open the page is inert; focus lands here once it closes.
    if (status === "sent" && confirmationClosed) successRef.current?.focus();
  }, [status, confirmationClosed]);

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

  const set = <K extends keyof ApplicationFields>(name: K, value: ApplicationFields[K]) =>
    setFields((current) => ({ ...current, [name]: value }));

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

  const dialog = (
    <SubmissionDialog
      open={status === "sending" || (status === "sent" && !confirmationClosed)}
      phase={status === "sent" ? "success" : "sending"}
      sendingTitle="Sending your application�"
      successTitle={formCopy.successTitle}
      onClose={() => setConfirmationClosed(true)}
    >
      <p className="m-0">{formCopy.successBody(result?.roleTitle ?? roleTitle)}</p>
    </SubmissionDialog>
  );

  if (status === "sent" && result) {
    return (
      <>
        {dialog}
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
          {result.processHtml ? (
            <div
              className="mt-(--space-4) text-body text-tone-text [&_li]:my-(--space-2) [&_ol]:list-decimal [&_ol]:pl-(--space-5) [&_p]:my-(--space-3) [&_ul]:list-disc [&_ul]:pl-(--space-5)"
              // Sanitised by the site's one renderer on the server.
              dangerouslySetInnerHTML={{ __html: result.processHtml }}
            />
          ) : null}
        </div>
      </>
    );
  }

  const describedBy = (name: FieldName, hint?: string) =>
    [hint, errors[name] ? errorId(name) : undefined].filter(Boolean).join(" ") || undefined;
  const invalid = (name: FieldName) => (errors[name] ? true : undefined);
  const errorText = (name: FieldName) =>
    errors[name] ? (
      <p id={errorId(name)} className="m-0 mt-(--space-1) text-small text-danger">
        {errors[name]}
      </p>
    ) : null;
  const optional = <span className="font-normal text-tone-muted"> {formCopy.optional}</span>;
  const label = (name: FieldName, text: string, extra?: ReactNode) => (
    <label htmlFor={fieldId(name)} className="block text-body font-semibold text-tone-heading">
      {text}
      {extra}
    </label>
  );
  const text = (
    name: Exclude<keyof ApplicationFields, "consent" | "rightToWork" | "coverNote">,
    title: string,
    props: {
      type?: string;
      autoComplete?: string;
      required?: boolean;
      inputMode?: "url" | "tel" | "email";
    },
  ) => (
    <div>
      {label(name, title, props.required ? null : optional)}
      <input
        id={fieldId(name)}
        name={name}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        inputMode={props.inputMode}
        value={fields[name]}
        onChange={(event) => set(name, event.target.value)}
        aria-invalid={invalid(name)}
        aria-describedby={describedBy(name)}
        aria-required={props.required ? true : undefined}
        className={`mt-(--space-2) ${inputClass}`}
      />
      {errorText(name)}
    </div>
  );

  const errorList = fieldOrder.filter((name) => errors[name]);
  const remaining = COVER_NOTE_MAX - fields.coverNote.length;
  const coverHint = `${fieldId("coverNote")}-count`;
  const cvHint = `${fieldId("cv")}-hint`;

  return (
    <>
      {dialog}
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
        {errorList.length > 1 || formError ? (
          <div
            ref={summaryRef}
            tabIndex={-1}
            role="alert"
            className="border-l-4 border-danger bg-tone-tile-bg p-(--space-4)"
          >
            <p className="m-0 text-body font-semibold text-tone-heading">
              {formError ?? formCopy.errorSummary}
            </p>
            {errorList.length > 1 ? (
              <ul className="m-0 mt-(--space-2) list-disc pl-(--space-5)">
                {errorList.map((name) => (
                  <li key={name}>
                    <a
                      href={`#${fieldId(name)}`}
                      className="text-body text-tone-link underline underline-offset-4"
                    >
                      {errors[name]}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
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
          <p id={cvHint} className="m-0 mt-(--space-1) text-small text-tone-muted">
            {formCopy.cvHint}
          </p>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`mt-(--space-2) flex flex-wrap items-center gap-(--space-3) border border-dashed p-(--space-4) ${dragging ? "border-tone-action bg-tone-tile-bg" : errors.cv ? "border-danger" : "border-tone-control-border"}`}
          >
            <input
              id={fieldId("cv")}
              name="cv"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={onFile}
              aria-labelledby={`${fieldId("cv")}-label ${fieldId("cv")}-choose`}
              aria-invalid={invalid("cv")}
              aria-describedby={describedBy("cv", cvHint)}
              className="peer sr-only"
            />
            <label
              id={`${fieldId("cv")}-choose`}
              htmlFor={fieldId("cv")}
              className="inline-flex min-h-11 cursor-pointer items-center border border-tone-control-border px-(--space-4) text-body font-semibold text-tone-heading peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-tone-focus"
            >
              {formCopy.cvChoose}
            </label>
            {cv ? (
              <>
                <p className="m-0 text-body text-tone-heading" aria-live="polite">
                  {cv.name}, {sizeLabel(cv.size)}
                </p>
                <button
                  type="button"
                  onClick={() => chooseFile(null)}
                  className="min-h-11 border border-tone-control-border px-(--space-3) text-body text-tone-heading focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tone-focus"
                >
                  {formCopy.cvRemove}
                  <span className="sr-only"> {cv.name}</span>
                </button>
              </>
            ) : (
              <span className="text-body text-tone-muted">{formCopy.cvDrop}</span>
            )}
          </div>
          {errorText("cv")}
        </div>

        <div>
          {label("coverNote", formCopy.coverNote, optional)}
          <textarea
            id={fieldId("coverNote")}
            name="coverNote"
            rows={6}
            maxLength={COVER_NOTE_MAX}
            value={fields.coverNote}
            onChange={(event) => set("coverNote", event.target.value)}
            aria-invalid={invalid("coverNote")}
            aria-describedby={describedBy(
              "coverNote",
              fields.coverNote.length >= COVER_NOTE_COUNTER_FROM ? coverHint : undefined,
            )}
            className={`mt-(--space-2) ${inputClass} py-(--space-2)`}
          />
          <p
            id={coverHint}
            aria-live="polite"
            className="m-0 mt-(--space-1) text-small text-tone-muted"
          >
            {fields.coverNote.length >= COVER_NOTE_COUNTER_FROM
              ? formCopy.remaining(remaining)
              : ""}
          </p>
          {errorText("coverNote")}
        </div>

        <fieldset
          id={fieldId("rightToWork")}
          aria-invalid={invalid("rightToWork")}
          aria-describedby={describedBy("rightToWork")}
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
                  onChange={() => set("rightToWork", option.value)}
                  className="size-5 accent-tone-action"
                />
                {option.label}
              </label>
            ))}
          </div>
          {errorText("rightToWork")}
        </fieldset>

        {text("noticePeriod", formCopy.noticePeriod, {})}

        <div>
          <label className="flex items-start gap-(--space-3) text-body text-tone-text">
            <input
              id={fieldId("consent")}
              type="checkbox"
              name="consent"
              checked={fields.consent}
              onChange={(event) => set("consent", event.target.checked)}
              aria-invalid={invalid("consent")}
              aria-describedby={describedBy("consent")}
              className="mt-1 size-5 shrink-0 accent-tone-action"
            />
            <span>
              {formCopy.consentBefore}
              <a href={privacyNoticeUrl} className="text-tone-link underline underline-offset-4">
                {formCopy.consentLink}
              </a>
              {formCopy.consentAfter}
            </span>
          </label>
          {errorText("consent")}
        </div>

        {/* Honeypot: hidden from people and assistive technology; bots fill it. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor={`${id}-website`}>Website</label>
          <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {turnstileSiteKey ? (
          <TurnstileWidget siteKey={turnstileSiteKey} action="careers" resetKey={turnstileReset} />
        ) : null}

        <div>
          <Button type="submit" size="md" loading={status === "sending"}>
            {status === "sending" ? formCopy.sending : formCopy.submit}
          </Button>
        </div>
      </form>
    </>
  );
}
