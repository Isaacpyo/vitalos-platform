# Careers settings draft (B7)

This is a draft for Temitope to approve, written for the WS4 review run on 17 October 2026. Nothing in it has been saved to production. Each field goes into **Super Admin › Careers › Settings**, which stores one `CareersSettings.config` row (defaults in `superadmin/apps/careers/config.py`). Each section on the website stays hidden while its field is empty, and the same holds once a field is filled and later cleared.

Under each paragraph is the source it comes from. Where no approved source exists, the draft says **GAP: needs owner input** and offers no wording in its place. Approved sources (RUN-PROMPT 0.4) used here:

- **Live** is the public Careers copy, read by GET from https://vitalos.co.uk/careers and the three role pages on 17 Oct 2026.
- **CAR-xx** is an entry in the Master FAQ snapshot `packages/relay-knowledge/faq/master-faq.snapshot.json` (version 1, generated 15 Oct 2026). Status is checked for each entry:
  - CAR-02, CAR-03, CAR-04 and CAR-05 are **Verified**.
  - CAR-01 and CAR-07 are **Needs confirmation**. Neither is used.
- **HWW** is How We Work, `packages/cms/src/draft/content/pages.ts` (`howWeWork`).
- **CPN** is the candidate privacy notice, `packages/cms/src/repo/legal.ts` (`candidatePrivacy`). The owner approved it on 16 Oct 2026.

## What is live today (checked 17 Oct 2026)

| Field | Live state | Notes |
|---|---|---|
| Benefits | empty, hidden | — |
| Default hiring process | empty, hidden | No role has its own process either: none of the three role pages shows "How we hire". |
| Salary policy | empty, hidden | — |
| Equal opportunities | **filled and live** on `/careers` and on every role page | FINDINGS B7 lists it as empty, which is out of date. The live text is quoted in section 4 below. |
| Intro | live text is shorter than the seeded copy | The live intro ends "…and high standards.", while the seed (`content_sync/copy.py`) and CAR-02 end "…and high standards without unnecessary bureaucracy." Someone shortened it in the admin. This is noted only; nothing was changed. |

## 1. Benefits

The Master FAQ states no benefits: no pension, holiday, equipment, learning budget, insurance or salary review. CAR-02 (Verified) says Vitalos "describes only benefits and working practices that are real". What follows is therefore limited to working practices that a Verified entry states. It is not a benefits list. The owner should decide whether this field should carry working practices at all, or wait until real benefits are confirmed.

> **Working at Vitalos**
>
> - Work is remote-capable by design, with written context and documented decisions, and in-person time is used where it adds value.

Source: Live careers statement 1; CAR-02 (Verified), full answer. Note: this line already shows on `/careers` under "How we work". If it is repeated here, the page will say it twice, so consider leaving it out.

> - There is a technical career path to Principal level that does not require becoming a line manager.

Source: CAR-05 (Verified), short answer: "Vitalos has a technical career path to Principal level that does not require becoming a line manager." The live careers statement 2 says the same in shorter form.

> - Learning is supported through project stretch, mentoring, design reviews, Labs work and certifications that build real capability.

Source: CAR-05 (Verified), full answer, last sentence, quoted word for word.

**GAP: needs owner input.** These are not stated in any source: pension, annual leave, sick pay, equipment, a learning or certification budget, salary review cycle, insurance, enhanced parental leave, and any other contractual benefit. Do not publish a "Benefits" heading over working practices alone unless you are happy for it to read that way. If you would rather keep the field empty until real benefits are listed, the section stays hidden.

## 2. Default hiring process

This is used for every role that has no process of its own (`Role.process_md` falls back to it). It is shown on the role page as the "How we hire" block, and in the confirmation the candidate sees after applying. The content API sends it as `sections.process` on a role and as `process` in the `ApplicationAccepted` response.

> We use a structured process, kept proportionate to the role:
>
> 1. Screening
> 2. A realistic work sample or case exercise
> 3. A technical or professional interview
> 4. A client communication interview
> 5. A values and leadership conversation
> 6. Risk-based reference and identity checks

Source: CAR-03 (Verified), short answer: "Vitalos uses a structured process: screening, a realistic work sample or case exercise, a technical or professional interview, a client communication interview, a values and leadership conversation, and risk-based reference and identity checks." The words "kept proportionate to the role" come from CAR-03's full answer: "The process is kept proportionate to the role."

> Questions and scoring are structured, so decisions do not depend on who feels most similar to the interviewer.

Source: CAR-03 (Verified), short answer, quoted word for word.

> Work samples are designed to show reasoning on problems similar to the job. Senior candidates are not asked to produce large unpaid consulting deliverables that we could reuse commercially.

Source: CAR-03 (Verified), full answer. The wording is shortened and moved into the first person ("Vitalos could reuse" becomes "we could reuse").

> If you need an adjustment to apply or to take part in an interview, email support@vitalos.co.uk and tell us what would help. We will make reasonable adjustments.

Source: the Live equal-opportunities statement, paragraph 2, quoted word for word. Note: it already shows on every role page in the equal-opportunities section. Leave it out here if you do not want it twice.

**GAP: needs owner input.**

- How long each stage takes, and how long the process takes overall.
- Whether every role uses all six stages. "Proportionate to the role" suggests not, so say which stages are left out for which levels, or set `process_md` on each role.
- How and when candidates hear back. Candidate emails are off (`CAREERS_CANDIDATE_EMAILS_ENABLED=false`), so do not promise a receipt or outcome email.
- Whether interviews are remote or in person.

## 3. Salary policy

No approved source states a salary policy. The facts below can be observed, but they are not a policy.

- All three open roles show a salary range (Live role pages; `show_salary` is on).
- The admin's rule for opening a role already requires either a salary minimum and maximum, or an explicit choice to hide the salary with the note "Check whether salary information is required for this role" (`docs/content/BRIEF.md` 7.4).
- CAR-05 (Verified): "titles follow real responsibility rather than tenure", and promotion "is not automatic after a set time, nor used as a retention tactic".

Proposed wording. **This is a proposal for the owner to approve, not a sourced fact.** It turns the current practice into a commitment:

> **Owner to approve:** Every role we advertise shows its salary range. Titles follow real responsibility rather than tenure, and promotion needs sustained evidence of next-level scope and quality; it is not automatic after a set time.

Source for sentence 1: none. It is a proposal based on observed current practice, and the owner must confirm it. Source for sentence 2: CAR-05 (Verified), short and full answers, shortened. It describes promotion, not pay. If that does not belong under "Salary policy", leave sentence 2 out.

**GAP: needs owner input.**

- How bands are set: benchmarking source, and whether bands go by level, by practice or by role.
- Whether the range shown is the full band or the hiring range.
- Whether there is any bonus, equity or day-rate policy for associates. CAR-04 (Verified) mentions associates but says nothing about pay.
- When pay is reviewed.

## 4. Equal-opportunities statement

**It is already live.** It is not empty. This is the text shown on `/careers` and on every role page as of 17 Oct 2026:

> Vitalos welcomes applications from everyone. We assess every application on the skills, experience and potential it shows for the role. We do not discriminate on the grounds of age, disability, gender reassignment, marriage and civil partnership, pregnancy and maternity, race, religion or belief, sex or sexual orientation, the protected characteristics under the Equality Act 2010.
>
> If you need an adjustment to apply or to take part in an interview, email support@vitalos.co.uk and tell us what would help. We will make reasonable adjustments.

It names all nine protected characteristics in the Equality Act 2010. **Needs owner approval:** please confirm that you entered or approved this text. The run cannot see who saved it; the admin audit log for Careers settings will show that. No change is proposed.

Optional wording, **for the owner to approve, offered as a proposal and not a fact.** It is standard UK practice to state where you stand on disability-confident or guaranteed-interview schemes only when you are actually signed up to them. No source says Vitalos is signed up to any such scheme, so nothing about that is drafted. The only optional change offered is a small edit for readability:

> **Owner to approve (wording only, no new claim):** "…race, religion or belief, sex, or sexual orientation. These are the protected characteristics under the Equality Act 2010."

Source: the Live statement, re-punctuated. No claim is added.

## How to apply this draft (owner)

1. Super Admin › Careers › Settings. Paste the approved text into **Default hiring process** first: it has the strongest source (CAR-03, Verified). Leave **Benefits** and **Salary policy** empty until the gaps above are filled.
2. Save. Then check `/careers` and one role page. "How we hire" appears as a section on `/careers` and as the new panel on every role page without its own process. Its steps also appear in the confirmation after a test application.
3. Nothing here needs a deploy. The website reads the settings through the content API (ADR-040).
