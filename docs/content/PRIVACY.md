# Candidate privacy notice (draft) and recruitment DPIA note

Status: **draft for owner approval. Not published.** Careers stays closed in production until the owner approves this notice, its retention period and the processors listed (ADR-041). Items in square brackets are decisions for the owner and must be resolved before publication. They are never shown on the site.

---

## Part 1: candidate privacy notice (draft text)

### Who we are

Vitalos Technologies Limited (company number 16696895), registered office 114 High Street, Bentley, Doncaster, England, DN5 0AT, is the controller of the personal data you give us when you apply for a role. You can contact us about it at support@vitalos.co.uk.

### What we collect

When you apply through our careers pages we collect:

- your name and email address;
- optionally, your phone number, where you are based, your LinkedIn and portfolio or GitHub links, your notice period and a cover note;
- your answer to whether you have the right to work in the UK;
- your CV;
- the role you applied for, when you applied, your agreement to this notice and its version;
- a one-way hashed form of your IP address and your browser's user agent, used to prevent abuse.

We do not ask for special-category data, such as health, ethnicity or religion. If your CV or cover note includes it, we use it only as part of assessing your application, and we do not record it anywhere else.

If you apply, our team adds its own notes, a record of the stage your application has reached, and a record of who viewed your CV and when.

### Why we use it, and our lawful basis

- **To assess your application and contact you about it.** Lawful basis: taking steps at your request before entering into a contract [owner to confirm; alternative: legitimate interests in recruiting].
- **To check your right to work in the UK if we make you an offer.** Lawful basis: legal obligation.
- **To protect the application form from abuse** (rate limits, human verification). Lawful basis: legitimate interests.

We do not use your data for marketing, we do not sell it, and we do not use automated decision-making to decide the outcome of an application. We do not send your CV or application to any AI service.

### Who processes it for us

- **[Microsoft Azure (UK South)]**, which hosts our internal administration system, where applications are stored.
- **[Supabase or Neon (London)]**, the database for that system [owner to confirm which is live].
- **[Cloudflare R2]**, private object storage for CV files [only once the bucket is created; see ADR-041].
- **Vercel**, which hosts our website and passes your application to our administration system.
- **Cloudflare Turnstile**, which checks that the form is used by a person.
- **[Resend]**, the email service we use for internal alerts about new applications, and for emails to you only if we switch them on [owner decision: candidate emails are off].

Your data is stored in the UK or the EEA [owner to confirm for each processor].

### How long we keep it

We delete your application and CV **[6] months** after the later of the date we made a decision about it and the date the role closed. If we hire you, your application moves to your employment records and is handled under our employee privacy notice. Incomplete uploads that were never submitted are deleted within 24 hours.

### Your rights

You can ask for a copy of your data, ask us to correct it, ask us to delete it, object to how we use it or ask us to restrict it, by emailing support@vitalos.co.uk. You can withdraw your application at any time in the same way, and we will delete it. If you are unhappy with how we handle your data, you can complain to the Information Commissioner's Office (ico.org.uk).

### Changes

This notice has a version number shown on the application form. We record which version you agreed to.

---

## Part 2: DPIA note (recruitment data)

- **Processing:** collecting and assessing job applications, including CVs that may contain special-category data.
- **Necessity and proportionality:**
  - Only the fields needed to assess an application are collected, and every field except name, email, CV, right to work and consent is optional.
  - Retention is bounded (6 months by default) and enforced by a nightly job, which stays a dry run until `RETENTION_ENFORCE=true` is set.
- **Risks and mitigations:**

| Risk                       | Mitigation                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unauthorised access to CVs | Private bucket; downloads only by permitted staff through 60-second signed URLs; every view logged; TOTP required for SuperAdmin                                           |
| Malicious files            | Magic-byte checks (PDF, or a DOCX ZIP containing `word/document.xml`); always downloaded as attachments, never rendered; virus scanning is a paid option awaiting approval |
| Abuse or spam              | Turnstile, honeypot, per-IP and per-email rate limits                                                                                                                      |
| Over-retention             | Nightly retention job; `hired` applications flagged for manual handling                                                                                                    |
| Leakage through logs       | Ids, timings and error codes only; no candidate data in logs; nothing sent to AI providers                                                                                 |
| Data in transit            | HTTPS everywhere; signed server-to-server requests (ADR-040)                                                                                                               |

- **Residual risk:** low, once the owner approves the processors, retention and notice.
- **Review:** before Careers opens in production, and yearly after that.
