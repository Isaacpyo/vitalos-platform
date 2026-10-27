// Shared layout for every Vitalos email (header, body blocks, footer), branded from the design
// tokens. Entry: `@vitalos/email-layout`. The Super Admin renders from the exported spec.
export { cleanLine, cleanMultiline, escapeHtml, truncate } from "./escape";
export { inlineImages, type InlineImage } from "./images";
export {
  COMPANY_PLACEHOLDERS,
  CORRESPONDENCE_BLOCKS,
  NOT_PROVIDED,
  checkDocument,
  isSafeUrl,
  renderEmail,
  renderHtml,
  renderText,
  type BadgeTone,
  type Block,
  type CompanyFacts,
  type DetailRow,
  type EmailDocument,
  type FooterInput,
  type ListItem,
  type RenderedEmail,
  type SocialLink,
  type Stat,
} from "./render";
export { layoutSpec, SPEC_VERSION } from "./spec";
export { DARK_MEDIA_QUERY, emailTheme } from "./theme";
