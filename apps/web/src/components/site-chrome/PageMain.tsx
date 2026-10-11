/**
 * The one `<main>` of a page. The shell (app/(site)/layout.tsx) renders the header and footer;
 * every page renders exactly one `<main id="main" tabIndex={-1}>`, so the skip link (`#main`, root
 * layout) always has a target and a page never has two main landmarks. The element lives in a
 * single component shared with the proof and institutional templates; the contact page renders
 * the same element itself.
 */
export { PageMain } from "../../templates/institutional/page-main";
