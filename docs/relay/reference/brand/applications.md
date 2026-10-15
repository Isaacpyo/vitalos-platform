# Applications

## Website

- Use a `midnight` hero with a 124-160px statement, the full stop in `cobalt`, one `cobalt-600` call to action, the Convergence entering on the right half and a light annotation layer (`WebsiteHero`). The bands slide in once on load and respect reduced motion.
- Follow the hero with the five practices as a ruled row, then the AI journey, then proof. Alternate midnight and off-white bands.
- Keep a single primary call to action per screen: Start a conversation.

## Reports and proposals

- Covers come in three editions: midnight (formal), cobalt signal (flagship) and white (drafts). Wordmark top left, mono reference top right, the Convergence through the middle, title in 46px Manrope 800 below it, classification line at the foot (`ProposalCover`).
- Open each chapter with a cobalt signal page carrying a 120px chapter numeral.
- Inside pages: white, 12-column grid, `eyebrow` section numbers, hairline rules, one figure per page (`AssessmentReport`).
- Use only illustrative figures that are labelled as such until real findings exist.

## Presentations

- Title slides follow the cover; content slides use a white or off-white ground, a `headline` and one diagram. Section dividers use midnight with `display-lg`.
- Put the logo symbol bottom right at 24px.

## Social

- Use square tiles (`SocialTile`) rotating midnight, cobalt and off-white grounds: one statement at 46-64px, the Convergence cropped into a corner or edge, the wordmark bottom left. Use the same system for the LinkedIn banner.

## Business and digital cards

- Front midnight with the Convergence alone; back white with the logo, name in Manrope 800, details in `mono-data`, and a cobalt-and-mineral edge strip (`BusinessCard`).

## Handing off to Figma and code

- Map the token groups to Figma variable collections: Color (modes Light and Dark), Type, Spacing, Radius, Stroke, Layout. Reuse the token names as variable names.
- Build the Convergence as one Figma component with properties for thickness, gap, x-start, merge point and ground (midnight, cobalt, light).
- In code, load `tokens.css` and the two Google Fonts; read colours through the semantic tokens (`surface-100`, `ink`, `action`, `line`) so the dark theme follows.
- Keep the semantic layer as the only thing components reference; foundation names (`midnight`, `cobalt`) appear in brand artwork and fixed grounds only.
