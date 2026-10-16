/**
 * The application form's rules and words (brief 6.3, A9), shared by the client form and the
 * website routes so both say the same thing. Pure: no framework or browser imports.
 */

export const CV_MAX_BYTES = 10 * 1024 * 1024;
export const COVER_NOTE_MAX = 3000;
/** The cover-note counter appears from this many characters. */
export const COVER_NOTE_COUNTER_FROM = 2500;

export const cvTypes = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const;
export type CvMime = keyof typeof cvTypes;

export const rightToWorkOptions = [
  { value: "yes", label: "Yes" },
  { value: "needs_sponsorship", label: "I would need sponsorship" },
  { value: "prefer_to_discuss", label: "I'd prefer to discuss" },
] as const;
export type RightToWork = (typeof rightToWorkOptions)[number]["value"];

export const formCopy = {
  heading: "Apply for this role",
  name: "Full name",
  email: "Email",
  phone: "Phone",
  location: "Where are you based?",
  linkedinUrl: "LinkedIn URL",
  portfolioUrl: "Portfolio or GitHub URL",
  cv: "CV",
  cvHint: "PDF or Word, up to 10 MB.",
  cvChoose: "Choose a file",
  cvDrop: "or drag and drop it here",
  cvRemove: "Remove",
  coverNote: "Cover note",
  rightToWork: "Do you have the right to work in the UK?",
  noticePeriod: "Notice period",
  optional: "(optional)",
  consentBefore: "I agree that Vitalos may process my application as described in the ",
  consentLink: "candidate privacy notice",
  consentAfter: ".",
  submit: "Send application",
  sending: "Sending",
  noScript: "Turn on JavaScript to upload your CV and apply.",
  errorSummary: "There is a problem",
  successTitle: "Application received.",
  successBody: (roleTitle: string) => `We've received your application for ${roleTitle}.`,
  remaining: (left: number) =>
    left === 1 ? "1 character remaining" : `${left} characters remaining`,
} as const;

export const messages = {
  name: "Enter your name",
  email: "Enter a valid email address",
  cvType: "Upload your CV as a PDF or Word document",
  cvSize: "Your CV must be 10 MB or smaller",
  choose: "Choose an answer",
  consent: "Tick the box to agree to the candidate privacy notice",
  upload: "Couldn't upload your CV. Check your connection and try again.",
  rateLimited: "You're sending applications quickly. Try again in a few minutes.",
  roleClosed: "This role is no longer accepting applications.",
  // Not in the brief: shown only when the application itself cannot be sent.
  unavailable: "We couldn't send your application. Check your connection and try again.",
  tooLong: "This answer is too long",
  securityCheck: "The security check could not be completed. Reload the page and try again.",
  url: "Enter a full web address, starting with https://",
} as const;

export type FieldName =
  | "name"
  | "email"
  | "phone"
  | "location"
  | "linkedinUrl"
  | "portfolioUrl"
  | "cv"
  | "coverNote"
  | "rightToWork"
  | "noticePeriod"
  | "consent";

/** The order errors are listed and focused in (the form's order). */
export const fieldOrder: readonly FieldName[] = [
  "name",
  "email",
  "phone",
  "location",
  "linkedinUrl",
  "portfolioUrl",
  "cv",
  "coverNote",
  "rightToWork",
  "noticePeriod",
  "consent",
];

export interface ApplicationFields {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  portfolioUrl: string;
  coverNote: string;
  rightToWork: string;
  noticePeriod: string;
  consent: boolean;
}

export interface CvFile {
  name: string;
  size: number;
  type: string;
}

const limits: Partial<Record<FieldName, number>> = {
  name: 200,
  email: 254,
  phone: 40,
  location: 120,
  linkedinUrl: 300,
  portfolioUrl: 300,
  coverNote: COVER_NOTE_MAX,
  noticePeriod: 100,
};

const EMAIL = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+$/;
const HTTP_URL = /^https?:\/\/[^\s<>"']+$/i;

/** The CV's type from its MIME type, else its extension (browsers often omit DOCX's type). */
export function cvMimeOf(file: CvFile): CvMime | null {
  if (file.type in cvTypes) return file.type as CvMime;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return null;
}

export function cvError(file: CvFile | null): string | null {
  if (!file) return messages.cvType;
  if (!cvMimeOf(file)) return messages.cvType;
  if (file.size < 1 || file.size > CV_MAX_BYTES)
    return file.size < 1 ? messages.cvType : messages.cvSize;
  return null;
}

/** Field errors, in form order. Empty when the form can be sent. */
export function validateApplication(
  fields: ApplicationFields,
  cv: CvFile | null,
): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  if (!fields.name.trim()) errors.name = messages.name;
  if (!EMAIL.test(fields.email.trim())) errors.email = messages.email;
  for (const field of ["linkedinUrl", "portfolioUrl"] as const) {
    const value = fields[field].trim();
    if (value && !HTTP_URL.test(value)) errors[field] = messages.url;
  }
  const cvProblem = cvError(cv);
  if (cvProblem) errors.cv = cvProblem;
  if (!rightToWorkOptions.some((option) => option.value === fields.rightToWork)) {
    errors.rightToWork = messages.choose;
  }
  if (!fields.consent) errors.consent = messages.consent;
  for (const [field, limit] of Object.entries(limits) as [FieldName, number][]) {
    const value = fields[field as keyof ApplicationFields];
    if (typeof value === "string" && value.trim().length > limit && !errors[field]) {
      errors[field] = messages.tooLong;
    }
  }
  return Object.fromEntries(
    fieldOrder.filter((field) => errors[field]).map((field) => [field, errors[field]]),
  ) as Partial<Record<FieldName, string>>;
}

export type ErrorCode =
  | "required"
  | "invalid"
  | "too_long"
  | "upload_missing"
  | "upload_type"
  | "upload_size"
  | "role_closed"
  | "rate_limited";

export interface MappedErrors {
  fields: Partial<Record<FieldName, string>>;
  /** A form-level message (role closed, rate limited, service unavailable). */
  form: string | null;
}

const fieldMessages: Partial<Record<FieldName, Partial<Record<ErrorCode, string>>>> = {
  name: { required: messages.name, invalid: messages.name, too_long: messages.tooLong },
  email: { required: messages.email, invalid: messages.email, too_long: messages.email },
  rightToWork: { required: messages.choose, invalid: messages.choose },
  consent: { required: messages.consent, invalid: messages.consent },
  linkedinUrl: { invalid: messages.url },
  portfolioUrl: { invalid: messages.url },
};

const apiField: Record<string, FieldName> = {
  name: "name",
  email: "email",
  phone: "phone",
  location: "location",
  linkedinUrl: "linkedinUrl",
  portfolioUrl: "portfolioUrl",
  coverNote: "coverNote",
  rightToWork: "rightToWork",
  noticePeriod: "noticePeriod",
  consent: "consent",
  uploadId: "cv",
  filename: "cv",
  size: "cv",
  mime: "cv",
};

/**
 * The admin's (and the website routes') error codes in the brief's words. Upload problems land on
 * the CV field; a closed role and rate limits are form-level; anything unexpected is reported as
 * "could not send" rather than invented detail.
 */
export function mapErrorCodes(errors: Record<string, string>): MappedErrors {
  const mapped: MappedErrors = { fields: {}, form: null };
  for (const [key, code] of Object.entries(errors)) {
    if (code === "role_closed") mapped.form = messages.roleClosed;
    else if (code === "rate_limited") mapped.form ??= messages.rateLimited;
    else if (code === "upload_type") mapped.fields.cv = messages.cvType;
    else if (code === "upload_size") mapped.fields.cv = messages.cvSize;
    else if (code === "upload_missing") mapped.fields.cv = messages.upload;
    else if (key === "turnstile") mapped.form = messages.securityCheck;
    else {
      const field = apiField[key];
      const message = field
        ? (fieldMessages[field]?.[code as ErrorCode] ?? messages.tooLong)
        : null;
      if (field && message) mapped.fields[field] = code === "too_long" ? messages.tooLong : message;
      else mapped.form ??= messages.unavailable;
    }
  }
  return mapped;
}
