import type { RichText as RichTextValue } from "@vitalos/cms";
import { CodeBlock, Heading } from "@vitalos/ui";
import { RichText } from "../../components/rich-text";
import { buildArticleBody } from "./body-model";
import type { ArticleBodyModel } from "./body-model";

const headingSpacing = {
  2: "mt-(--space-7) mb-(--space-4)",
  3: "mt-(--space-6) mb-(--space-3)",
  4: "mt-(--space-5) mb-(--space-2)",
} as const;

/**
 * The article body: rich text with identifiable headings (targets of the contents links) and code
 * blocks rendered through the CodeBlock island (copy button after hydration; readable without
 * JavaScript). Everything else is the standard RichText renderer.
 */
export function ArticleBody({
  body,
  model,
}: Readonly<{ body: RichTextValue; model?: ArticleBodyModel }>) {
  const { segments } = model ?? buildArticleBody(body);
  return (
    <div className="min-w-0">
      {segments.map((segment) => {
        switch (segment.type) {
          case "heading":
            return (
              <Heading
                key={segment.key}
                id={segment.id}
                level={segment.level}
                size={segment.level === 2 ? "h2" : segment.level === 3 ? "h3" : "h4"}
                className={`max-w-(--container-prose) ${headingSpacing[segment.level]}`}
                style={{ scrollMarginTop: "6rem" }}
              >
                {segment.text}
              </Heading>
            );
          case "code":
            return (
              <CodeBlock
                key={segment.key}
                code={segment.code}
                language={segment.language}
                className="my-(--space-5) max-w-(--container-prose)"
              />
            );
          case "blocks":
            return <RichText key={segment.key} value={segment.blocks} />;
        }
      })}
    </div>
  );
}
