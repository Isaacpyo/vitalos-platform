/**
 * Styles for the renderer's HTML (brief 5.2), applied from the wrapper so the sanitised markup
 * needs no classes of its own beyond the few the renderer sets (code-block, callout,
 * table-scroll, footnotes). Design tokens only.
 */
export const articleBodyClass = [
  "min-w-0 max-w-[68ch] text-body-l text-tone-text",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:my-(--space-5)",
  "[&_h2]:mt-(--space-8) [&_h2]:mb-(--space-4) [&_h2]:text-h2 [&_h2]:text-tone-heading [&_h2]:scroll-mt-(--space-8)",
  "[&_h3]:mt-(--space-7) [&_h3]:mb-(--space-3) [&_h3]:text-h3 [&_h3]:text-tone-heading [&_h3]:scroll-mt-(--space-8)",
  "[&_h4]:mt-(--space-6) [&_h4]:mb-(--space-2) [&_h4]:text-body-l [&_h4]:font-semibold [&_h4]:text-tone-heading",
  "[&_ul]:my-(--space-5) [&_ul]:list-disc [&_ul]:pl-(--space-5)",
  "[&_ol]:my-(--space-5) [&_ol]:list-decimal [&_ol]:pl-(--space-5)",
  "[&_li]:my-(--space-2)",
  "[&_a]:text-tone-link [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-tone-link-hover",
  "[&_strong]:font-semibold",
  "[&_blockquote]:my-(--space-7) [&_blockquote]:border-t [&_blockquote]:border-tone-border [&_blockquote]:pt-(--space-5) [&_blockquote]:text-h3 [&_blockquote]:font-semibold [&_blockquote]:text-tone-heading",
  "[&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.9em]",
  "[&_pre.code-block]:my-(--space-3) [&_pre.code-block]:overflow-x-auto [&_pre.code-block]:bg-midnight-950 [&_pre.code-block]:p-(--space-5) [&_pre.code-block]:font-mono [&_pre.code-block]:text-small [&_pre.code-block]:leading-relaxed [&_pre.code-block]:text-cloud-50",
  "[&_.callout]:my-(--space-6) [&_.callout]:border-t-2 [&_.callout]:border-tone-action [&_.callout]:bg-tone-tile-bg [&_.callout]:px-(--space-5) [&_.callout]:py-(--space-4)",
  "[&_.callout-warning]:border-tone-heading",
  "[&_.callout-title]:font-mono [&_.callout-title]:text-eyebrow [&_.callout-title]:tracking-widest [&_.callout-title]:uppercase [&_.callout-title]:text-tone-heading",
  "[&_.table-scroll]:my-(--space-6) [&_.table-scroll]:overflow-x-auto",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-body",
  "[&_th]:border-b [&_th]:border-tone-heading [&_th]:px-(--space-3) [&_th]:py-(--space-2) [&_th]:text-left [&_th]:font-semibold",
  "[&_td]:border-b [&_td]:border-tone-border [&_td]:px-(--space-3) [&_td]:py-(--space-2) [&_td]:align-top",
  "[&_figure]:my-(--space-7) [&_img]:h-auto [&_img]:max-w-full",
  "[&_figcaption]:mt-(--space-2) [&_figcaption]:text-small [&_figcaption]:text-tone-muted",
  "[&_hr]:my-(--space-7) [&_hr]:border-tone-border",
  "[&_section.footnotes]:mt-(--space-8) [&_section.footnotes]:border-t [&_section.footnotes]:border-tone-border [&_section.footnotes]:pt-(--space-5) [&_section.footnotes]:text-small",
  "[&_.footnotes-label]:font-mono [&_.footnotes-label]:text-eyebrow [&_.footnotes-label]:tracking-widest [&_.footnotes-label]:uppercase [&_.footnotes-label]:text-tone-muted",
  "[&_sup]:text-[0.75em]",
].join(" ");
