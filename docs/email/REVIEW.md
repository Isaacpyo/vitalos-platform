# Email template review checklist

Used for the library review of October 2026 and for any new template. `manage.py review_email_templates` checks the mechanical rules (marked *auto*); a person checks the rest. `seed_problems` errors stop the seed from loading; review findings do not.

| Area | Rule |
|---|---|
| Variables | Every `{{variable}}` is in `VARIABLES` and has a sample value in `email_gallery.SAMPLE` (*auto* for unknown names). No hard-coded people: signatures use the sender variables, unless the template is founder-only (`review.FOUNDER_ONLY`) (*auto*). |
| Subject | Sentence case (*auto*, heuristic); 60 characters or fewer once merged with fallbacks (*auto*); no exclamation marks or emoji (*auto*). |
| Preheader | 40 to 100 characters once merged (*auto*); adds to the subject rather than repeating it (*auto* for exact repeats). |
| Header label | Two words or fewer (*auto*; "&" is not a word). The same label for the same purpose across a category; labels may differ between purposes (Invoice, Receipt, Overdue). |
| Button | One primary button at most (*auto*); a verb-phrase label ("Read the proposal"); `https:` or `mailto:` links only once merged (*auto*). |
| Structure | The same block order as the rest of the category: heading, opening text, the key facts (details, items, stats or steps), the button, closing text, signature. |
| Kind | Correct under PECR: outreach and marketing have a reason line and the unsubscribe footer (*auto*); transactional and internal email carries no marketing. |
| Copy | British English; plain, confident and calm; banned words from `docs/relay/reference/brand/messaging.md` (*auto*). Tighten, never add claims, prices, response times, guarantees, clients or people. A missing fact is `DRAFT — needs approval`. |
| Plain text | Reads well on its own: open the `.txt` in the gallery. |
| Retirement | Duplicates and obsolete templates are listed for retirement in the report, never archived or deleted. |
| `managed_by: website` | Mirrors code in `apps/web`; change the code, not the template. |

Record every copy change in `COPY-CHANGES.md` (email, field, before, after, reason).
