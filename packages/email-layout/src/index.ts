// Shared layout for every Vitalos email (header, body blocks, footer), branded from the design
// tokens. Entry: `@vitalos/email-layout`. The Super Admin renders from the exported spec.
export { cleanLine, cleanMultiline, escapeHtml, truncate } from "./escape";
export { inlineImages, type InlineImage } from "./images";
export {
  COMPANY_PLACEHOLDERS,
  NOT_PROVIDED,
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
  type RenderedEmail,
  type SocialLink,
} from "./render";
export { layoutSpec, SPEC_VERSION } from "./spec";
export { DARK_MEDIA_QUERY, emailTheme } from "./theme";
