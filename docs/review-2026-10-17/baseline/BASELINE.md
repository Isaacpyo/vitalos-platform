# Live site baseline: vitalos.co.uk (17 Oct 2026)

Read-only capture of the live public site, taken before the overnight review changes. Only GET requests were made. No forms were submitted and the Relay chat was never opened.

- **Captured:** 17 Oct 2026, 04:39 to 07:50 UTC. Lighthouse ran 04:42 to 06:20 (the /about mobile rerun at 07:16), axe ran about 07:20, screenshots ran 07:25 to 07:45, and the outlier reruns ran 07:45 to 07:50.
- **Tools:** Lighthouse 12.8.2 (`npx lighthouse@12.8.2`, simulated throttling, default mobile plus `--preset=desktop`), Chrome 155 headless (system install), Playwright 1.64.0 (bundled Chromium), @axe-core/playwright 4.13.0 with axe-core 4.13.0, Node 24.19.0, Windows 11 laptop.
- **Raw data:** the Lighthouse JSON, axe JSON and scripts are kept outside the repo (`D:/tmp-review/baseline/`) and are not committed.

## Read this first: measurement caveats

- **The host machine was overloaded.** Drive C: ran out of space (0 bytes free) part-way through, and other sessions were running on the same machine. Lighthouse's CPU `benchmarkIndex` swung between **594 and 1937** across runs. Below about 1000, Lighthouse warns that the CPU is slower than it expects. Mobile TBT and performance scores are therefore noisy and pessimistic, so read them as an upper bound, not as field data. CLS and the accessibility scores are not affected.
- **/about mobile, first run:** failed with `ENOSPC` (disk full). The row below uses the rerun from 07:16, which ran while a `pnpm install` was competing for CPU.
- **/ mobile run 3:** ended with `PROTOCOL_TIMEOUT` in the ResponseCompression gatherer. Its metrics are present but the run is partial.
- **axe on /contact and /careers/senior-technology-consultant:** these pages never reach network idle while Cloudflare Turnstile is loaded, and an axe run with Turnstile present hung for more than 13 minutes (killed). The axe results for these two routes were taken with requests to `challenges.cloudflare.com` blocked, so the Turnstile iframe was not scanned.
- **Screenshots** were taken with `reducedMotion: "reduce"`. Under normal motion the `Reveal` component (`packages/ui/src/motion/Reveal.tsx`) leaves below-the-fold sections hidden in full-page captures, and the first attempt produced blank bands. With reduced motion the component renders statically, so the content is complete, but entrance animations are not shown. Fixed-position elements (the header and the "Ask Vitalos" launcher) appear at their viewport position within the full-page image.

## Lighthouse and axe per route

None of the 11 routes returned 404, so no substitutions were made. The axe tags were wcag2a, wcag2aa, wcag21a, wcag21aa and wcag22aa.

| Route                                 | Mobile perf | Mobile LCP | Mobile CLS | Mobile TBT | Desktop perf | Desktop LCP | Desktop TBT | A11y (m / d) | BP / SEO (mobile) | axe violations (crit / serious / mod / minor) | axe incomplete (color-contrast nodes) | benchmarkIndex (m / d) |
| ------------------------------------- | ----------- | ---------- | ---------- | ---------- | ------------ | ----------- | ----------- | ------------ | ----------------- | --------------------------------------------- | ------------------------------------- | ---------------------- |
| /                                     | 52          | 4.54 s     | 0.000      | 5437 ms    | 98           | 1.09 s      | 15 ms       | 100 / 100    | 100 / 100         | 0 (0/0/0/0)                                   | 52                                    | 921 / 1535             |
| /what-we-do                           | 86          | 3.17 s     | 0.000      | 157 ms     | 94           | 1.03 s      | 154 ms      | 100 / 100    | 100 / 100         | 0 (0/0/0/0)                                   | 25                                    | 1723 / 1656            |
| /solutions/ai-transformation          | 86          | 3.54 s     | 0.000      | 240 ms     | 98           | 0.97 s      | 70 ms       | 100 / 100    | 100 / 100         | 0 (0/0/0/0)                                   | 25                                    | 1799 / 1937            |
| /offers/ai-opportunity-assessment     | 71          | 3.38 s     | 0.000      | 851 ms     | 68           | 1.06 s      | 667 ms      | 100 / 100    | 100 / 100         | 0 (0/0/0/0)                                   | 13                                    | 720 / 919              |
| /industries/health-care               | 79          | 3.63 s     | 0.000      | 415 ms     | 94           | 0.96 s      | 166 ms      | 100 / 100    | 100 / 100         | 0 (0/0/0/0)                                   | 14                                    | 864 / 1420             |
| /about (mobile = rerun)               | 50          | 4.32 s     | 0.000      | 949 ms     | 95           | 0.92 s      | 140 ms      | 100 / 100    | 100 / 100         | 0 (0/0/0/0)                                   | 10                                    | 1045 / 877             |
| /insights/introducing-vitalos         | 25          | 22.91 s    | 0.000      | 45312 ms   | 85           | 1.00 s      | 298 ms      | 100 / 100    | 100 / 100         | 0 (0/0/0/0)                                   | 13                                    | 774 / 837              |
| /careers/senior-technology-consultant | 67          | 3.66 s     | 0.000      | 998 ms     | 97           | 0.95 s      | 94 ms       | 100 / 100    | 100 / 100         | 0 (0/0/0/0) *                                 | 21                                    | 832 / 796              |
| /contact                              | 80          | 3.01 s     | 0.000      | 563 ms     | 62           | 1.37 s      | 1442 ms     | 100 / 100    | 96 / 100          | 0 (0/0/0/0) *                                 | 8                                     | 903 / 594              |
| /trust                                | 65          | 3.31 s     | 0.000      | 1304 ms    | 88           | 0.90 s      | 248 ms      | 100 / 100    | 100 / 100         | 0 (0/0/0/0)                                   | 9                                     | 815 / 780              |
| /faq                                  | 44          | 5.70 s     | 0.000      | 12324 ms   | 98           | 0.90 s      | 74 ms       | 100 / 100    | 100 / 100         | 0 (0/0/0/0)                                   | 8                                     | 771 / 792              |

\* axe run with Turnstile blocked (see caveats). Desktop BP and SEO are 100 on every route except /contact, where BP is 96.

### Repeat runs (variance check)

| Run                                        | Perf | LCP    | CLS   | TBT     | A11y | BP / SEO  | benchmarkIndex |
| ------------------------------------------ | ---- | ------ | ----- | ------- | ---- | --------- | -------------- |
| / mobile run 2                             | 58   | 4.41 s | 0.000 | 1339 ms | 100  | 100 / 100 | 752            |
| / mobile run 3 (partial, PROTOCOL_TIMEOUT) | 54   | 3.03 s | 0.000 | 4340 ms | 100  | 100 / 92  | 781            |
| / desktop run 2                            | 84   | 1.24 s | 0.001 | 265 ms  | 100  | 100 / 100 | 851            |
| /faq mobile run 2                          | 62   | 2.78 s | 0.000 | 2500 ms | 100  | 100 / 100 | 986            |
| /insights/introducing-vitalos mobile run 2 | 88   | 2.81 s | 0.000 | 247 ms  | 100  | 100 / 100 | 1344           |

How to read this:

- **The /insights mobile first run (25, TBT 45 s, 78 s of main-thread work) was host noise.** The rerun scored 88. Treat the first run as invalid.
- **The home page is consistently the weakest on mobile:** 52, 58 and 54 across three runs, with TBT between 1.3 s and 5.4 s. On mobile, the main-thread cost attributed to the `/` document itself was 3.2 s to 8.0 s, against roughly 0.7 s to 2 s for the documents of other pages. The home HTML is 388,819 bytes uncompressed, and total transfer is 849 KB on mobile and 1.34 MB on desktop, against roughly 390 to 650 KB for most other routes.
- **Home mobile LCP** is the hero image (`/images/hero/cloud-infrastructure-640.webp`). In the first run, render delay was 3.23 s (71% of LCP), TTFB 0.72 s and load 0.59 s.
- **CLS is 0.000 to 0.006 everywhere.**
- **Shared script cost:** the chunks `/_next/static/immutable/chunks/2zy_-r0ob…` and `1csfaytgc…` dominate scripting time on most routes.

## Accessibility findings

- **axe reported no WCAG A/AA violations on any of the 11 routes.** The only `incomplete` (needs-review) item is `color-contrast`, mostly over images or gradients: 52 nodes on /, 25 each on /what-we-do and /solutions/ai-transformation.
- **Top violation IDs site-wide:** none from axe.
- **Lighthouse flags `label-content-name-mismatch` (WCAG 2.5.3 Label in Name) on every desktop run.** The Relay launcher shows the visible text "Ask Vitalos", but its accessible name is `aria-label="Open chat with Relay, the Vitalos assistant"`, which does not contain that text. The element is `button.relay-launcher.relay-launcher--labelled`. Lighthouse gives this audit no weight, so the score stays 100. The axe WCAG tag set does not include it either.
- **Lighthouse best-practices `inspector-issues`** on /contact (mobile and desktop): Chrome logged a "Content security policy" issue. Lighthouse gives no sub-item detail.

### Relay DOM before any interaction

On all 11 routes, `.relay-root` and the launcher button (`aria-expanded="false"`, `aria-controls="relay-panel"`) are in the server HTML and the DOM. **`#relay-panel` / `.relay-panel` is not in the DOM before interaction**, and `.relay-root` contains **no `<article>` elements**. The `<article>` elements on / (3), /insights/introducing-vitalos (4) and /careers/senior-technology-consultant (1) belong to page content, not to Relay. One consequence: `aria-controls="relay-panel"` points to an element that does not exist until the panel mounts.

### Empty-alt images and unnamed controls

This counts images with `alt=""` that are not inside `aria-hidden` or `inert` and have no presentation role. Controls means `a[href]`, `button`, `[role=button]` and `[role=link]`, excluding those hidden from assistive technology.

| Route       | Images | Empty alt, not hidden | Missing alt | Controls | Controls without an accessible name |
| ----------- | ------ | --------------------- | ----------- | -------- | ----------------------------------- |
| /           | 42     | 19                    | 0           | 211      | 0                                   |
| /what-we-do | 38     | 15                    | 0           | 207      | 0                                   |

- On /, the empty-alt images include the How We Work step images (`/images/how-we-work/qualify.webp`, `discover`, `define`, `design`, `engineer`, and others).
- On /what-we-do, they include the practice images (`/images/practices/consulting-1672.webp`, `engineering`, `ai-data`, `experience`, `managed-services`).
- Every route has at least one, `/brand/vitalos-symbol.png`.
- Whether these images are truly decorative was not judged here. Other routes: solutions/ai-transformation 6, industries/health-care 2, all others 1. No route had unnamed controls.

## Response headers for `/`

From `curl -sI https://vitalos.co.uk/`, served by Vercel (`X-Vercel-Cache: HIT`, region lhr1).

| Header                                                      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content-Security-Policy                                     | `default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://pub-c3b4653e12dc43949ca865bb520c4128.r2.dev; font-src 'self'; connect-src 'self' https://958e16fc012bc9f44c05eb94f2dd700c.r2.cloudflarestorage.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests` |
| Strict-Transport-Security                                   | `max-age=63072000` (no `includeSubDomains`, no `preload`)                                                                                                                                                                                                                                                                                                                                                                                                            |
| X-Frame-Options                                             | absent (`frame-ancestors 'none'` in the CSP covers framing)                                                                                                                                                                                                                                                                                                                                                                                                          |
| Cross-Origin-Opener-Policy                                  | absent                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Cross-Origin-Resource-Policy / Cross-Origin-Embedder-Policy | absent                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| X-Content-Type-Options                                      | `nosniff`                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Referrer-Policy                                             | `strict-origin-when-cross-origin`                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Permissions-Policy                                          | `accelerometer=(), bluetooth=(), browsing-topics=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), serial=(), usb=()`                                                                                                                                                                                                                                                                                                         |
| Access-Control-Allow-Origin                                 | `*` (on the HTML document)                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Cache-Control                                               | `public, max-age=0, must-revalidate`                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Content-Length                                              | 388819                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Notes on the headers:

- `script-src` and `style-src` both allow `'unsafe-inline'`. There is no nonce and no `strict-dynamic`.

## Visual observations from the screenshots (not scored)

- **/about:** the hero's right-hand media card shows only a generic image icon on a dark panel, with no picture, at 1440.
- **/podcast:** returns 200 and is linked from the footer, but it is **not listed in the sitemap**. Its screenshot was taken in addition to the sitemap set.

## Screenshots

- **What was captured:** 186 full-page JPEGs (quality 55) in `screens/`. There is one pair (`{slug}-1440.jpg` at 1440×900 and `{slug}-390.jpg` at 390×844) for each of the 92 sitemap URLs plus `/podcast`, giving 93 slugs. All returned 200 and none failed.
- **Size:** 55.2 MB in total. The largest file is 665 KB. No file exceeded 2.5 MB, so no height cap was applied.
- **Capture settings:** each page was scrolled through before capture, with reduced motion as described in the caveats. /contact and the three /careers role pages never reached network idle because of Turnstile, so they were captured at `load` plus 3 s.

Slugs, each with `-1440` and `-390`: `home`, `what-we-do`, `solutions`, `offers`, `industries`, `labs`, `about`, `how-we-work`, `trust`, `contact`, `faq`, `what-we-do-consulting`, `what-we-do-engineering`, `what-we-do-ai-data`, `what-we-do-experience`, `what-we-do-managed-services`, `solutions-ai-transformation`, `solutions-business-process-modernisation`, `solutions-digital-product-transformation`, `solutions-application-modernisation`, `solutions-data-intelligence-transformation`, `solutions-technology-recovery-reliability`, `offers-digital-transformation-discovery`, `offers-technology-health-assessment`, `offers-ai-opportunity-assessment`, `offers-ai-prototype-sprint`, `offers-custom-digital-product`, `offers-application-modernisation`, `offers-systems-integration`, `offers-business-process-automation`, `offers-data-bi-modernisation`, `offers-customer-experience-transformation`, `offers-engineering-rescue`, `offers-managed-engineering-application-care`, `offers-product-discovery`, `industries-health-care`, `industries-retail-commerce-consumer`, `industries-operations-industry-logistics`, `industries-growth-technology`, `labs-research-ai-opportunity-readiness-framework`, `labs-research-production-ai-evaluation-harness`, `labs-research-inherited-system-takeover-assessment`, `trust-security`, `trust-privacy`, `trust-responsible-ai`, `trust-accessibility`, `trust-resilience`, `trust-procurement`, `legal-privacy`, `legal-candidate-privacy`, `legal-cookies`, `legal-terms`, `legal-accessibility`, `labs-research`, `insights`, `insights-introducing-vitalos`, `insights-cyber-security-and-resilience-bill-managed-service-providers`, `insights-ai-agent-accountability-governance`, `insights-ai-inference-costs-finops`, `insights-disposable-software-short-lived-applications`, `insights-nhs-federated-data-platform-business-case-lessons`, `insights-eu-ai-act-digital-omnibus-uk-businesses`, `insights-ai-coding-tools-software-delivery-quality`, `insights-ai-data-readiness`, `insights-ai-agents-pilot-to-production`, `insights-agentic-commerce-uk-retailers`, `insights-ai-agent-security-prompt-injection-mcp`, `insights-cloud-waste-ai-costs-digital-sovereignty`, `insights-software-supply-chain-security-npm-attacks`, `insights-ai-legacy-modernisation-cobol`, `insights-ai-in-logistics-uk-multi-site`, `insights-uk-ai-adoption-dsit-research`, `insights-post-quantum-cryptography-migration-ncsc-timeline`, `insights-how-to-evaluate-ai-systems-before-production`, `insights-nhs-single-patient-record-interoperability`, `insights-agent-washing-how-to-spot-a-real-ai-agent`, `insights-topics-ai-and-agents`, `insights-topics-digital-transformation`, `insights-topics-health-and-care`, `insights-topics-retail-commerce-and-consumer`, `insights-topics-operations-industry-and-logistics`, `insights-topics-growth-and-technology`, `insights-topics-cloud-and-reliability`, `insights-topics-software-and-platforms`, `insights-topics-data`, `insights-topics-experience-and-commerce`, `insights-authors-temitope-agbola`, `insights-authors-vitalos`, `careers`, `careers-senior-technology-consultant`, `careers-ai-data-engineer`, `careers-senior-software-engineer`, `podcast`.
