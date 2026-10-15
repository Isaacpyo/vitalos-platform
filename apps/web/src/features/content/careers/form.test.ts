import { describe, expect, it } from "vitest";
import {
  CV_MAX_BYTES,
  cvError,
  cvMimeOf,
  formCopy,
  mapErrorCodes,
  messages,
  validateApplication,
} from "./form";
import type { ApplicationFields } from "./form";

const valid: ApplicationFields = {
  name: "Example Applicant",
  email: "applicant@example.test",
  phone: "",
  location: "",
  linkedinUrl: "",
  portfolioUrl: "",
  coverNote: "",
  rightToWork: "yes",
  noticePeriod: "",
  consent: true,
};
const pdf = { name: "cv.pdf", size: 1000, type: "application/pdf" };

describe("validateApplication", () => {
  it("accepts a complete application", () => {
    expect(validateApplication(valid, pdf)).toEqual({});
  });

  it("uses the brief's words for every required field, in form order", () => {
    const errors = validateApplication(
      { ...valid, name: " ", email: "not-an-email", rightToWork: "", consent: false },
      null,
    );
    expect(errors).toEqual({
      name: "Enter your name",
      email: "Enter a valid email address",
      cv: "Upload your CV as a PDF or Word document",
      rightToWork: "Choose an answer",
      consent: "Tick the box to agree to the candidate privacy notice",
    });
    expect(Object.keys(errors)).toEqual(["name", "email", "cv", "rightToWork", "consent"]);
  });

  it("checks the CV type by MIME type or extension, and its size", () => {
    expect(cvError(pdf)).toBeNull();
    expect(cvError({ name: "cv.docx", size: 10, type: "" })).toBeNull();
    expect(cvMimeOf({ name: "CV.DOCX", size: 1, type: "" })).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(cvError({ name: "cv.exe", size: 10, type: "application/x-msdownload" })).toBe(
      messages.cvType,
    );
    expect(cvError({ name: "cv.doc", size: 10, type: "application/msword" })).toBe(messages.cvType);
    expect(cvError({ ...pdf, size: CV_MAX_BYTES + 1 })).toBe("Your CV must be 10 MB or smaller");
    expect(cvError({ ...pdf, size: CV_MAX_BYTES })).toBeNull();
  });

  it("limits the cover note to 3,000 characters and checks web addresses", () => {
    expect(validateApplication({ ...valid, coverNote: "x".repeat(3001) }, pdf)).toEqual({
      coverNote: messages.tooLong,
    });
    expect(validateApplication({ ...valid, linkedinUrl: "linkedin.com/in/x" }, pdf)).toEqual({
      linkedinUrl: messages.url,
    });
    expect(validateApplication({ ...valid, portfolioUrl: "https://example.test/me" }, pdf)).toEqual(
      {},
    );
  });
});

describe("mapErrorCodes", () => {
  it("maps the admin's codes to the brief's messages", () => {
    expect(mapErrorCodes({ roleSlug: "role_closed" })).toEqual({
      fields: {},
      form: "This role is no longer accepting applications.",
    });
    expect(mapErrorCodes({ email: "rate_limited" }).form).toBe(
      "You're sending applications quickly. Try again in a few minutes.",
    );
    expect(mapErrorCodes({ uploadId: "upload_missing" }).fields.cv).toBe(
      "Couldn't upload your CV. Check your connection and try again.",
    );
    expect(mapErrorCodes({ uploadId: "upload_type" }).fields.cv).toBe(messages.cvType);
    expect(mapErrorCodes({ size: "upload_size" }).fields.cv).toBe(messages.cvSize);
    expect(mapErrorCodes({ email: "invalid", name: "required" }).fields).toEqual({
      email: messages.email,
      name: messages.name,
    });
    expect(mapErrorCodes({ turnstile: "invalid" }).form).toBe(messages.securityCheck);
    expect(mapErrorCodes({ body: "invalid" }).form).toBe(messages.unavailable);
  });

  it("states the success copy exactly", () => {
    expect(formCopy.successTitle).toBe("Application received.");
    expect(formCopy.successBody("Example role")).toBe(
      "We've received your application for Example role.",
    );
    expect(formCopy.noScript).toBe("Turn on JavaScript to upload your CV and apply.");
  });
});
