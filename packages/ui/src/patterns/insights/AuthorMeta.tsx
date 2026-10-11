import { MetaRow, type MetaItem } from "../../primitives/MetaRow";
import { formatDate } from "../_internal/date";
import { hasText } from "../_internal/types";

/** Matches PersonSummary ({ name via title, role }) once the web app resolves the profile `href`. */
export interface AuthorLink {
  name: string;
  /** Profile link. Omitted inside stretched-link cards, where nested links would compete. */
  href?: string | undefined;
}

export interface AuthorMetaProps {
  authors?: readonly AuthorLink[] | undefined;
  /** ISO date. */
  publishedAt?: string | undefined;
  /** ISO date. Shown only when it differs from `publishedAt`. */
  updatedAt?: string | undefined;
  /** Read time as text, supplied by the caller (for example "6 min"). */
  readTime?: string | undefined;
  /** Field labels. Defaults are structural English labels. */
  labels?:
    | {
        author?: string | undefined;
        authors?: string | undefined;
        published?: string | undefined;
        updated?: string | undefined;
        readTime?: string | undefined;
      }
    | undefined;
  locale?: string | undefined;
  className?: string | undefined;
}

/** Author(s), published and updated dates and read time as a labelled row. Empty renders nothing. */
export function AuthorMeta({
  authors,
  publishedAt,
  updatedAt,
  readTime,
  labels,
  locale,
  className,
}: AuthorMetaProps) {
  const items: MetaItem[] = [];
  const named = (authors ?? []).filter((author) => hasText(author.name));
  if (named.length > 0) {
    items.push({
      label: named.length === 1 ? (labels?.author ?? "Author") : (labels?.authors ?? "Authors"),
      value: (
        <>
          {named.map((author, index) => (
            <span key={`${author.name}-${index}`}>
              {index > 0 ? ", " : null}
              {author.href ? (
                <a
                  href={author.href}
                  className="text-tone-link underline underline-offset-4 hover:text-tone-link-hover"
                >
                  {author.name}
                </a>
              ) : (
                author.name
              )}
            </span>
          ))}
        </>
      ),
    });
  }
  if (hasText(publishedAt)) {
    items.push({
      label: labels?.published ?? "Published",
      value: <time dateTime={publishedAt}>{formatDate(publishedAt, locale)}</time>,
    });
  }
  if (hasText(updatedAt) && updatedAt !== publishedAt) {
    items.push({
      label: labels?.updated ?? "Updated",
      value: <time dateTime={updatedAt}>{formatDate(updatedAt, locale)}</time>,
    });
  }
  if (hasText(readTime)) items.push({ label: labels?.readTime ?? "Read time", value: readTime });
  return <MetaRow items={items} {...(className ? { className } : {})} />;
}
