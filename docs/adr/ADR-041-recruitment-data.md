# ADR 041 Recruitment data: handling, storage and retention

Status: Accepted (engineering, 15 October 2026). The retention period, the candidate privacy notice and candidate emails need owner approval before Careers opens in production.

## Context

Applications contain personal data. CVs can also contain special-category data such as health or ethnicity, volunteered by the candidate. The website runs on Vercel functions, which have a request-size limit, and the Super Admin (ADR-026) already has an S3-compatible storage adapter for enquiry attachments: Cloudflare R2 when `OBJECT_STORAGE_BUCKET` is set, local disk in development (ADR-029).

## Decision

1. **Where data lives.**
   - Applications, notes and events live in the admin's database (`careers` app).
   - CV files live in a **private** bucket: `CAREERS_CV_BUCKET`, on the same S3-compatible endpoint and credentials as enquiry attachments. With no bucket configured, CVs go to the admin's local `careers_cvs` storage. That is acceptable in development; in production no ticket is issued without a bucket unless the instance has persistent storage (see 6).
   - Object keys are random: `pending/{uuid}.{ext}`, then `applications/{applicationId}/cv.{ext}`. The original filename is sanitised and stored separately, never used as a key.
2. **Upload path.** The browser never sends the CV through the website's function:
   - the website verifies Turnstile and rate limits, then gets a single-use ticket from the admin (signed, scope `submit`);
   - the browser PUTs the file directly. With a bucket, the target is a pre-signed URL with a 10-minute expiry, an exact content length and CORS limited to the website origins. Without one, it is the admin's single-use fallback endpoint, limited to 10 MB and to the website origins;
   - the admin then checks that the object exists, its size and its magic bytes (`%PDF-`, or a ZIP containing `word/document.xml`) before it creates the application.
3. **Access.** Only staff with `careers.view_cv` can download a CV, through a 60-second signed URL (or a forced attachment download from local storage), with `Content-Disposition: attachment`. Every download is recorded as an `application_events` row.
4. **Abuse limits.** The website's existing limiter: 5 uploads and 3 applications an hour per IP. The admin: 3 applications a day per email. Turnstile and a honeypot apply too. A duplicate (same email and role within 30 days) is accepted and flagged.
5. **Retention.** Every night, the tick deletes each application and its CV `retention_months` (default 6) after the later of `decided_at` and the role's `closed_at`. `hired` applications are flagged for manual handling and not deleted. Pending uploads older than 24 hours are deleted. Each deletion is audited with a hashed id. Like the enquiry retention job, the deletion runs as a dry run until `RETENTION_ENFORCE=true` is set by a person.
6. **Production storage.** R2's free tier (10 GB of storage and 1M class-A operations a month) covers this volume at no cost. Creating the bucket needs the Cloudflare account. Until the bucket exists, production refuses CV upload tickets with "Applications are not open yet", so no CV is stored on the container's disk, which does not persist.
7. **Logging.** Ids, timings and error codes only; no candidate data or CV content is logged or sent to any AI provider.
8. **Candidate emails** (receipt, rejection, invitation) exist as templates and are sent only when `CAREERS_CANDIDATE_EMAILS_ENABLED=true`, which is off and on the approval list. Internal alerts go through the admin's existing mailer and notifications.

## Consequences

- The candidate privacy notice draft is in `docs/content/PRIVACY.md`. It is not published until the owner approves it, with its retention period.
- A DPIA note is in the same file. Virus scanning of CVs is a paid add-on and is on the approval list. Until then, CVs are only ever downloaded as attachments, never rendered in the browser.
