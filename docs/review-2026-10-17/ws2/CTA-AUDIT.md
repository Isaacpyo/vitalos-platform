# CTA audit (finding B13)

WS2, 17 Oct 2026. Every call to action on the public site: label, destination before and after this branch, and what the visitor sees. Source of labels: the repo content files and locked copy.

**Mismatch found and fixed:** the content files give each page's call to action an enquiry topic (`cta(label, intent)`), but `ctaToLink` dropped it, so every "Discuss ..." button opened a blank contact form. `ctaToLink` now appends `?intent=` for contact links, and offer pages always open the form on that offer (`?intent=offer&offer={slug}`), as the offer pages' own fallback already did (`apps/web/src/lib/view-mapping/hrefs.ts`). The contact page reads both parameters (`contact-params.ts`) and puts no personal data in the URL.

## Page calls to action

| Page | Label | Before | After | What the visitor sees |
| --- | --- | --- | --- | --- |
| `/what-we-do/consulting` | Discuss a transformation challenge (hero and closing card) | `/contact` | `/contact?intent=project` | Form on "A new project" |
| `/what-we-do/engineering` | Discuss an engineering challenge (hero and closing card) | `/contact` | `/contact?intent=engineering` | Form on "Engineering support" |
| `/what-we-do/ai-data` | Discuss an AI opportunity (hero and closing card) | `/contact` | `/contact?intent=ai` | Form on "AI" |
| `/what-we-do/experience` | Discuss a product or experience challenge (hero and closing card) | `/contact` | `/contact?intent=project` | Form on "A new project" |
| `/what-we-do/managed-services` | Discuss ongoing support or a takeover (hero and closing card) | `/contact` | `/contact?intent=managed-services` | Form on "Managed services" |
| `/solutions/ai-transformation` | Start with an AI Opportunity Assessment (hero and closing card) | `/contact` | `/contact?intent=ai` | Form on "AI" |
| `/solutions/business-process-modernisation` | Discuss an operations challenge (hero and closing card) | `/contact` | `/contact?intent=project` | Form on "A new project" |
| `/solutions/digital-product-transformation` | Discuss a digital product (hero and closing card) | `/contact` | `/contact?intent=project` | Form on "A new project" |
| `/solutions/application-modernisation` | Discuss a legacy system (hero and closing card) | `/contact` | `/contact?intent=engineering` | Form on "Engineering support" |
| `/solutions/data-intelligence-transformation` | Discuss a data challenge (hero and closing card) | `/contact` | `/contact?intent=ai` | Form on "AI" |
| `/solutions/technology-recovery-reliability` | Discuss an unstable system (hero and closing card) | `/contact` | `/contact?intent=engineering` | Form on "Engineering support" |
| `/offers/digital-transformation-discovery` | Discuss a transformation discovery (hero and closing card) | `/contact` | `/contact?intent=offer&offer=digital-transformation-discovery` | Form on "One of our offers", offer `digital-transformation-discovery` attached |
| `/offers/technology-health-assessment` | Discuss a health assessment (hero and closing card) | `/contact` | `/contact?intent=offer&offer=technology-health-assessment` | Form on "One of our offers", offer `technology-health-assessment` attached |
| `/offers/ai-opportunity-assessment` | Discuss an AI Opportunity Assessment (hero and closing card) | `/contact` | `/contact?intent=offer&offer=ai-opportunity-assessment` | Form on "One of our offers", offer `ai-opportunity-assessment` attached |
| `/offers/ai-prototype-sprint` | Discuss an AI prototype (hero and closing card) | `/contact` | `/contact?intent=offer&offer=ai-prototype-sprint` | Form on "One of our offers", offer `ai-prototype-sprint` attached |
| `/offers/custom-digital-product` | Discuss a new product (hero and closing card) | `/contact` | `/contact?intent=offer&offer=custom-digital-product` | Form on "One of our offers", offer `custom-digital-product` attached |
| `/offers/application-modernisation` | Discuss a modernisation (hero and closing card) | `/contact` | `/contact?intent=offer&offer=application-modernisation` | Form on "One of our offers", offer `application-modernisation` attached |
| `/offers/systems-integration` | Discuss an integration (hero and closing card) | `/contact` | `/contact?intent=offer&offer=systems-integration` | Form on "One of our offers", offer `systems-integration` attached |
| `/offers/business-process-automation` | Discuss automating a process (hero and closing card) | `/contact` | `/contact?intent=offer&offer=business-process-automation` | Form on "One of our offers", offer `business-process-automation` attached |
| `/offers/data-bi-modernisation` | Discuss data and reporting (hero and closing card) | `/contact` | `/contact?intent=offer&offer=data-bi-modernisation` | Form on "One of our offers", offer `data-bi-modernisation` attached |
| `/offers/customer-experience-transformation` | Discuss a customer experience (hero and closing card) | `/contact` | `/contact?intent=offer&offer=customer-experience-transformation` | Form on "One of our offers", offer `customer-experience-transformation` attached |
| `/offers/engineering-rescue` | Discuss a rescue (hero and closing card) | `/contact` | `/contact?intent=offer&offer=engineering-rescue` | Form on "One of our offers", offer `engineering-rescue` attached |
| `/offers/managed-engineering-application-care` | Discuss ongoing support (hero and closing card) | `/contact` | `/contact?intent=offer&offer=managed-engineering-application-care` | Form on "One of our offers", offer `managed-engineering-application-care` attached |
| `/offers/product-discovery` | Discuss a product discovery (hero and closing card) | `/contact` | `/contact?intent=offer&offer=product-discovery` | Form on "One of our offers", offer `product-discovery` attached |
| `/industries/health-care` | Discuss a health & care challenge (hero and closing card) | `/contact` | `/contact?intent=project` | Form on "A new project" |
| `/industries/retail-commerce-consumer` | Discuss a commerce challenge (hero and closing card) | `/contact` | `/contact?intent=project` | Form on "A new project" |
| `/industries/operations-industry-logistics` | Discuss an operations challenge (hero and closing card) | `/contact` | `/contact?intent=project` | Form on "A new project" |
| `/industries/growth-technology` | Discuss a product or platform (hero and closing card) | `/contact` | `/contact?intent=engineering` | Form on "Engineering support" |

## Route pages and shared actions

| Where | Label | Destination | What the visitor sees | Status |
| --- | --- | --- | --- | --- |
| Header (both variants), every page | Talk to Vitalos | `/contact` | Blank form, topic to choose | OK (general action) |
| Homepage hero | Explore what we do | `/what-we-do` | What We Do index | OK |
| Closing card, every page | Talk to Vitalos / Explore what we do | the page CTA or `/contact`; `/what-we-do` | As the page CTA | OK (follows the page CTA, now with its topic) |
| `/what-we-do`, `/about` | Talk to Vitalos | was `/contact`, now `/contact?intent=general` | Form on "Something else" | Fixed (content intent `general`) |
| `/solutions`, `/industries`, `/how-we-work` | Talk to Vitalos | `/contact?intent=project` | Form on "A new project" | Fixed |
| `/offers` | Talk to Vitalos | `/contact?intent=offer` | Form on "One of our offers" | Fixed |
| `/trust` closing card | Request procurement evidence / Talk to Vitalos | `/contact?intent=procurement`; `/contact` | Form on "Procurement" | OK (already correct) |
| `/trust/procurement`, `/trust/certifications` | Request procurement evidence | `/contact?intent=procurement` | Form on "Procurement" | OK |
| `/trust/security` | security.txt | `/.well-known/security.txt` | RFC 9116 file | New |
| Support menu (current nav) | the six enquiry topics | `/contact?intent=…` | Form on the same topic (labels shared with the form) | OK |
| `/faq`, each section | Contact | `/contact?intent=ai` (AI Transformation) or `?intent=project` | Form on that topic | New |
| `/faq`, each section | Ask Relay | opens the Relay panel (only when Relay is on) | Relay | New |
| 404 | Talk to Vitalos; Go to the homepage; main routes; Ask Relay where to find it | `/contact`; `/`; section indexes (gated ones only when open) | — | New routes list |
| Offer pages, "What happens next" | — (no link) | — | Steps: enquiry, the offer's scope, its next phase | New |
| About, "How we prove it" and homepage | Quality gates; Vitalos Labs; Trust Centre; Insights | `/how-we-work`; `/labs`; `/trust`; `/insights` (only when open) | Those pages | New |
| IA nav (preview) | Work (shown as Labs) | `/labs` while Work is closed | Labs index | New; never `/work` |

Labels are unchanged: the content labels are approved repo copy. "Talk to Vitalos" is locked copy. No link to `/work`, `/podcast` (while off) or a closed section was found in either navigation variant (crawl in NOTES.md).
