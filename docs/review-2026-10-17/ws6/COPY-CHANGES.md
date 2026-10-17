# WS6 public copy changes (Relay widget and Relay answers)

| Where | Before | After | Source |
|---|---|---|---|
| Relay panel header (team offline, out of hours) | `AI ASSISTANT · TEAM OFFLINE` | `AI ASSISTANT · TEAM BACK MONDAY 09:00`, computed from the Relay Settings business hours (Europe/London) | Relay Settings `businessHours`; existing offline wording |
| Relay welcome, last row (out of hours) | `Talk to a person` | `Leave your email and we'll reply` / `The team is offline. Back Monday 09:00.` | Settings default `outOfHoursText` ("We'll reply by email on the next working day") |
| Hand-off card (out of hours) | `Talk to a person.` / "A Vitalos specialist can pick this up here…" | `Leave your email.` / "The team is offline right now and back Monday 09:00. Leave your details and we'll reply by email." | Same source; the form and consent text are unchanged |
| Staff message label | `TEMITOPE.AGBOLA · VITALOS` | `Temitope · Vitalos` (or `Vitalos team`) | Finding D3; brand normal case |
| Thumbs-down follow-up (new) | — | "What went wrong?" · "It was wrong" · "It was incomplete" · "It didn't understand me" · "Skip" | Finding D6 reason set |
| Returning visitor (new) | Transcript restored silently | "Welcome back." / "You have a previous conversation with Relay on this device." · "Continue previous conversation" · "Start new" | Finding C2 |
| Relay reply to "Hello" (new, fixed) | Model call or a low-confidence reply | "Hello. I'm Relay, the Vitalos AI assistant. Ask me what we do, how an engagement starts or about your project, and I'll answer from our published information and show my sources." | Settings default greeting (`DEFAULT_GREETING`) |
| Relay reply to "thanks" (new, fixed) | Model call | "You're welcome. Ask another question whenever you like, or choose Talk to a person to reach the team." | Widget copy ("Talk to a person") |
| Relay reply to "bye" (new, fixed) | Model call | "Thanks for stopping by. This conversation stays here if you want to come back to it." | Widget behaviour (stored conversation, "Continue previous conversation") |
| Relay reply to "ok" (new, fixed) | Model call | "What else would you like to know about Vitalos?" | None needed: a question, with no claim |
| Relay fixed facts (system prompt) | "One firm, five practices … Labs … not a practice." / "Five solutions: …" | "One firm, six practices: Consulting; Engineering; AI & Data; Experience; Managed Services; Labs (research and technical proof)." / "Six solutions: … Technology Recovery & Reliability." | Decision 1; `solutionNames` in `packages/cms/src/locked-copy.ts` |
| Repo knowledge `practices.md`, `company-overview.md`, `solutions-offers-sectors.md` | Five practices / five solutions | Six practices (Labs the sixth) / six solutions | Decision 1; locked copy |

## Draft knowledge entries (not live: `status: draft`, `confirmation: needed`)

| Entry | Source of every sentence |
|---|---|
| `founder.md` "Who founded Vitalos" | Author profile on https://vitalos.co.uk/insights/authors/temitope-agbola and the author box of "Strategy that gets engineered: introducing Vitalos" (fetched 17 Oct 2026), verbatim |
| `solutions-list.md` | `solutionNames` (locked copy) and each solution's `summary` in `packages/cms/src/draft/content/solutions.ts` |
| `getting-started.md` | "Two ways to start" in `packages/cms/src/draft/content/pages.ts` (How We Work and About) and `how-engagements-start.md` ("Talk to Vitalos", "describe the problem") |
| `modernise-my-system.md` | The Application Modernisation solution (`approach`, FAQ answers) and the Technology Health Assessment offer (`summary`, `scope`) in the CMS draft content |
