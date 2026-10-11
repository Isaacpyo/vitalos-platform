import type { RichText as RichTextValue } from "@vitalos/cms";
import { normaliseRichText } from "../lib/cms/rich-text";
import type { InlineNode, ListNode, RichTextNode } from "../lib/cms/rich-text";
import { Callout, EvaluationTable, Prose, Quote } from "@vitalos/ui";
import { CmsImage } from "./cms-image";

export interface RichTextProps {
  /** A rich-text view-model field. Null, undefined and empty values render nothing. */
  value: RichTextValue | null | undefined;
  /** Editorial serif for long-form articles (Stage 7 §15.1; provisional). */
  serif?: boolean;
  className?: string;
}

function Inline({ node }: Readonly<{ node: InlineNode }>) {
  let content: React.ReactNode = node.text;
  if (node.code) content = <code>{content}</code>;
  if (node.em) content = <em>{content}</em>;
  if (node.strong) content = <strong>{content}</strong>;
  if (node.href) {
    const external = node.href.startsWith("https://");
    content = (
      <a href={node.href} {...(external ? { rel: "noopener noreferrer" } : {})}>
        {content}
      </a>
    );
  }
  return <>{content}</>;
}

function Inlines({ nodes }: Readonly<{ nodes: readonly InlineNode[] }>) {
  return nodes.map((node, index) => <Inline key={index} node={node} />);
}

function List({ list }: Readonly<{ list: ListNode }>) {
  const Tag = list.ordered ? "ol" : "ul";
  return (
    <Tag>
      {list.items.map((item, index) => (
        <li key={index}>
          <Inlines nodes={item.children} />
          {item.lists.map((nested) => (
            <List key={nested.key} list={nested} />
          ))}
        </li>
      ))}
    </Tag>
  );
}

function Node({ node }: Readonly<{ node: RichTextNode }>) {
  switch (node.type) {
    case "paragraph":
      return (
        <p>
          <Inlines nodes={node.children} />
        </p>
      );
    case "heading": {
      const Heading = `h${node.level}` as "h2" | "h3" | "h4";
      return (
        <Heading>
          <Inlines nodes={node.children} />
        </Heading>
      );
    }
    case "blockquote":
      return (
        <blockquote>
          <p>
            <Inlines nodes={node.children} />
          </p>
        </blockquote>
      );
    case "list":
      return <List list={node} />;
    case "callout":
      return <Callout {...(node.title ? { title: node.title } : {})}>{node.text}</Callout>;
    case "pullQuote":
      return <Quote attribution={node.attribution}>{node.quote}</Quote>;
    case "codeBlock":
      return (
        <pre {...(node.language ? { "data-language": node.language } : {})} tabIndex={0}>
          <code>{node.code}</code>
        </pre>
      );
    case "figure":
      return (
        <figure>
          <CmsImage image={node.image} className="h-auto max-w-full" />
          {node.caption ? <figcaption>{node.caption}</figcaption> : null}
        </figure>
      );
    case "dataTable": {
      const [dimensionHeading, ...columns] = node.columns;
      return (
        <EvaluationTable
          caption={node.caption}
          dimensionHeading={dimensionHeading}
          columns={columns as [string, ...string[]]}
          rows={node.rows.map(([dimension, ...values]) => ({
            dimension: dimension as string,
            values,
          }))}
        />
      );
    }
  }
}

/**
 * Renders a CMS rich-text field inside the design system's Prose (60 to 75 character measure,
 * styled headings, lists, links, quotes and code). Content never produces an h1: the page
 * template owns the single h1. Pass `serif` for long-form editorial articles.
 */
export function RichText({ value, serif, className }: Readonly<RichTextProps>) {
  const nodes = normaliseRichText(value);
  if (nodes.length === 0) return null;
  return (
    <Prose serif={serif ?? false} {...(className ? { className } : {})}>
      {nodes.map((node) => (
        <Node key={node.key} node={node} />
      ))}
    </Prose>
  );
}
