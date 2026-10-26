# Case studies

Case studies live in the Work section (`/work`, labelled "Case studies"; `/case-studies` redirects there). The content files are `packages/cms/src/draft/content/work.ts` (the two illustrative placeholder scenarios) and `packages/cms/src/draft/content/work-stories.ts` (real work, from the Website Build Pack of 25 October 2026).

## Content model

| Field                                                        | Rule                                                                                                                                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`, `slug`, `summary`                                   | Required.                                                                                                                                                            |
| `kind`                                                       | `client` or `product`. A product story has `engagementBasis: "vitalos-product"` and is labelled "Built and run by Vitalos".                                          |
| `sector`                                                     | The client description when the client is not named, for example "a vehicle workshop in Doncaster".                                                                  |
| `clientName`, `clientDisplay`, `clientPermission`            | A client is named (and a logo shown) only with `clientDisplay: "named"`, a name and the date of the client's written permission in `clientPermission`.               |
| `industries`, `practices`, `solutions`, `offers`, `products` | Cross-links. The industry drives the Work filters and the industry lead page's case studies block. An offer named here lists the case study on its page.             |
| `challenge`, `approach`, `outcome`                           | Required rich text. The story can run long.                                                                                                                          |
| `highlights`                                                 | Three points of eight words or fewer, each with an icon `key`, shown above the story.                                                                                |
| `visual`                                                     | What the case study's 4:3 image shows (`work.visual.{slug}` in `docs/design/IMAGE-SLOTS.md`).                                                                        |
| `metrics`                                                    | Each needs `source`, `verifiedBy` and verified evidence, or it is not shown.                                                                                         |
| `testimonial`                                                | Shown only for a named client, with verified evidence and a `permissionDate`.                                                                                        |
| `publishStatus`                                              | `draft`, `approved` or `published`. Only published case studies are served in production; previews show the others with a draft notice.                              |
| `evidence`                                                   | Set to `verified` (with `verifiedAt`) when the owner has checked the story. The Work section opens once two published case studies have verified evidence (ADR-022). |

## Publishing a case study

1. The client (for client work) approves the wording and every figure in writing.
2. Fill the outcome; remove every `[confirm …]` mark.
3. Record `clientPermission` only if the client agreed to be named.
4. Set `evidence: { status: "verified", verifiedAt: "<date>" }` and `publishStatus: "published"`.
5. Add the real image as `apps/web/public/media/work.visual.<slug>.webp`.

## Healthcare template (after the first pilot)

Health & Care case studies are added only after a pilot client signs off.

- **Title pattern:** Clinic admin pilot: [clinic type], [region]
- **Metrics to capture:** minutes per document before (from the audit) and after; documents per week; share of agent drafts accepted without edits; time from arrival to filing.
- **Highlights:** `timer` Minutes per document · `inbox` Documents per week · `check` Drafts accepted unedited.
- **Sign-off:** the clinic approves the wording and every metric in writing before `publishStatus` moves to `published`.

Once published, a Health & Care case study replaces the design-partner card on `/industries/health-care`.
