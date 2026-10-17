# WS5 public copy changes

| Page | Before | After | Source |
|---|---|---|---|
| `/llms.txt` | "Five practices (Consulting, Engineering, AI & Data, Experience and Managed Services) share one delivery lifecycle, from strategy to production." | "Six practices (Consulting, Engineering, AI & Data, Experience, Managed Services and Labs) share one delivery lifecycle, from strategy to production." | DECISIONS.md decision 1 (six practices, Labs the sixth) |
| `/llms.txt` | (no section list) | New "Sections" list: What We Do, Solutions, Offers, Industries, Labs, Insights, Careers, each linking to its index (only those in the sitemap) | Existing nav labels (`navLabels`, `structuralLabels`); no new wording |
| Every page, header and footer logo link | Accessible name "VITALOS" (the image alt text) | Accessible name "Vitalos home"; logo images `alt=""` inside the link | C3 (accessible names); the brand name from locked copy |
| Footer legal row | (none) | "RSS feed" → `/insights/feed.xml`, while Insights is listed | C9; a structural label, no claim |
| `<head>` of every page | Feed link only on `/insights` | `<link rel="alternate" type="application/rss+xml" title="Vitalos Insights">` | C9; brand name + existing section name |
| `/manifest.webmanifest` | (none) | name and short_name "Vitalos", description = the locked descriptor | `brandName`, `descriptor` (locked copy) |

Privacy notice: no change shipped. A draft paragraph for the owner is in NOTES.md.
