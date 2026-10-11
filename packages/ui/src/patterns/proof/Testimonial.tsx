import { Quote } from "../../primitives/Quote";
import { hasText } from "../_internal/types";

/** Matches TestimonialView. Attribution is mandatory: there are no anonymous quotes. */
export interface TestimonialProps {
  quote: string;
  /** Named individual. Without it nothing renders. */
  attribution: string;
  /** Role and organisation, appended to the attribution. */
  role?: string | undefined;
  /** URL of the published source of the quotation. */
  cite?: string | undefined;
  className?: string | undefined;
}

/** A short, specific, attributed quotation (Stage 9 section 18). */
export function Testimonial({ quote, attribution, role, cite, className }: TestimonialProps) {
  if (!hasText(quote) || !hasText(attribution)) return null;
  return (
    <Quote
      attribution={hasText(role) ? `${attribution}, ${role}` : attribution}
      {...(cite ? { cite } : {})}
      {...(className ? { className } : {})}
    >
      {quote}
    </Quote>
  );
}
