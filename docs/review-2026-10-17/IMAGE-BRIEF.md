# Image brief

Generated from `apps/web/src/content/media-slots.ts` by `pnpm media:slots`. Do not edit by hand.

Every place on the public site where a real photograph, screenshot or diagram could go. None of these images exists yet. Until one does, production renders nothing in its place and the layout closes up; development and previews show a labelled placeholder. The hero artwork of every page is drawn in code from the brand's graphic language (ADR-044) and needs no image.

Rules: real, rights-cleared images only. No stock photography, no AI-generated images, no people who have not agreed in writing, and nothing that implies a client, outcome or person that is not real. Save the file as `apps/web/public/media/{id}.webp` (per item: `{id}.{slug}.webp`) at the size given.

| Slot | Page | Section | Ratio | Size (px) | What it should show | Who could supply it | Production without it |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `about.hero` | `/about` | Hero | 4:3 | 1600 × 1200 | A real photograph of the Vitalos team working together, or of the working space. No stock imagery. | A commissioned photographer, or a team member with a good camera, at the Vitalos working space. Everyone shown agrees in writing. | Renders nothing |
| `careers.hero` | `/careers` | Hero | 4:3 | 1600 × 1200 | A real photograph of the team or the working space, suitable for people considering a role. | A commissioned photographer, or a team member, at the Vitalos working space. Everyone shown agrees in writing. | Renders nothing |
| `labs.asset.{slug}` | `/labs/[type]/[slug]` | Hero | 16:9 | 1600 × 900 | A screenshot or diagram of the asset itself (framework page, harness output, assessment template). No decorative imagery. | The team member who built the asset: a screenshot or an exported diagram. | Renders nothing |
| `work.case-study.{slug}` | `/work/[slug]` | Hero | 16:9 | 1600 × 900 | A screenshot or photograph of the delivered work, used only with the client's written permission. | The delivery team, with the client's written permission for the specific image. | Renders nothing |
| `insights.article.{slug}` | `/insights/[slug]` | Hero (article cover) | 16:9 | 1600 × 900 | A cover that illustrates the article: a diagram, a screenshot or a real photograph. No stock or AI-generated imagery. Covers are uploaded in the Super Admin (Insights › Posts › Cover, ADR-039); an article without one shows no hero image. | The article's author or the editor, uploaded in the Super Admin. | Renders nothing |
| `about.founder` | `/about` | Founder (behind ABOUT_FOUNDER_ENABLED) | 1:1 | 800 × 800 | A real portrait of the founder, head and shoulders, natural light, plain background. Used only with their agreement. | A commissioned photographer, or the founder's own approved portrait. | Renders nothing |
| `insights.author.{slug}` | `/insights/[slug]` | Author block | 1:1 | 400 × 400 | A real portrait of the author, head and shoulders. Without one the author block shows initials. | The author's own approved portrait, or one taken by a commissioned photographer. | Renders nothing |
