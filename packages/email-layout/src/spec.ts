import { inlineImages } from "./images";
import { COMPANY_PLACEHOLDERS, NOT_PROVIDED } from "./render";
import { snippets } from "./snippets";
import { DARK_MEDIA_QUERY, PREHEADER_PAD, STYLE_BLOCKS, emailTheme } from "./theme";

/**
 * The layout as data, for renderers that cannot import this package (the Super Admin is Python).
 * The tests write it to `superadmin/email-layout/email-layout.json` and fail if the committed copy
 * differs, so the Super Admin always renders with exactly the same markup, colours and images.
 */
export const SPEC_VERSION = 2;

export function layoutSpec() {
  return {
    version: SPEC_VERSION,
    generatedBy: "packages/email-layout (do not edit by hand; run the package tests with -u)",
    theme: emailTheme,
    styleBlocks: STYLE_BLOCKS,
    darkMediaQuery: DARK_MEDIA_QUERY,
    preheaderPad: PREHEADER_PAD,
    notProvided: NOT_PROVIDED,
    companyPlaceholders: COMPANY_PLACEHOLDERS,
    snippets,
    images: inlineImages,
  };
}
