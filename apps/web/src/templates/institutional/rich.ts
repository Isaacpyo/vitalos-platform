import type { RichText } from "@vitalos/cms";
import { normaliseRichText } from "../../lib/cms/rich-text";

/** True when a rich-text field would render something (not only empty or unsafe blocks). */
export function hasRichText(value: RichText | null | undefined): value is RichText {
  return normaliseRichText(value).length > 0;
}
