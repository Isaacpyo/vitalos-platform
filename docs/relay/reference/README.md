# Vitalos Relay — reference pack

Unzip into the repo at `docs/relay/reference/`. Open any `.html` in a browser (fonts load from Google Fonts); each has a `.png` render beside it.

## Precedence (highest first)

1. `brand/` — the current Vitalos design system (v2, 10 Oct 2026): `brand-book.md`, `applications.md`, `messaging.md`, `engagement-model.md`, `tokens.json` (+ generated `tokens.css`) and the original logo files in `logos/`. This is the source of truth for colour, type, spacing, radii, logo use, motif and voice.
2. `website/` — the current Vitalos website designs built on that system: `homepage-desktop`, `homepage-megamenu`, `homepage-mobile` (10 Oct) and the six `how-we-work-*` section designs (12 Oct, newest). Relay must sit on these pages without clashing, and reuse their header, button, link and icon patterns.
3. `relay/` — the Relay boards (widget, hand-off, live chat, mobile, super admin inbox, alerts, email, knowledge, flow). They apply 1 and 2 to the chat feature.

## Known inconsistencies in the source designs (resolved for Relay)

- **Practices.** The newest design (`how-we-work-Practices*`, 12 Oct) shows **five practices: Consulting, Engineering, AI & Data, Experience, Managed Services**. The homepage (10 Oct) still says "Six practices" and adds Labs; `engagement-model.md` lists older names. Relay uses the five from 12 Oct and treats Labs as a site section, not a practice.
- **Primary call to action.** The website designs use **"Talk to Vitalos"** (mobile header: "Talk to us"); `messaging.md` says "Start a conversation". Relay follows the website: "Talk to Vitalos".

## Logos

Use the files in `brand/logos/` exactly (see its README). Never redraw, recolour or re-letter them. The horizontal lock-up has a dark wordmark: white and off-white grounds only. The symbol has a transparent ground and works on midnight.

Sample people and companies in the Relay boards (Alex Morgan, Example Care Group, Jordan Ellis) are fictional.
