import type { RichText as RichTextValue } from "@vitalos/cms";
import { FeatureGrid } from "@vitalos/ui";
import type { IconName } from "@vitalos/ui";
import { InlineText, RichText } from "../../components/rich-text";
import { richTextToPlainText } from "../../lib/cms/rich-text";
import { isCardBody, isCardSection, splitBody } from "../../lib/view-mapping/body-sections";
import type { BodySection } from "../../lib/view-mapping/body-sections";
import { Band, itemLevel } from "./bands";
import type { BandFactory } from "./bands";

export interface BodyBandsOptions {
  /** The band heading when the body reads as one set of cards (and for any lead text). */
  heading?: string | undefined;
  eyebrow?: string | undefined;
  /** Icons for list items, in order: the items become icon cards instead of rows. */
  listIcons?: readonly IconName[] | undefined;
}

const columnsFor = (count: number): 2 | 3 => (count === 2 || count === 4 ? 2 : 3);

/** A short headed section as a card: its title and its paragraphs, keeping any inline links. */
const cardItem = (section: BodySection) =>
  section.inlineLinks
    ? {
        title: section.title,
        text: richTextToPlainText(section.blocks).trim(),
        richText: <InlineText value={section.blocks} />,
      }
    : { title: section.title, text: section.paragraphs.join(" ") };

/**
 * A page body as homepage-style bands (pages redesign, 15 Oct 2026). A body of short headed
 * paragraphs is one band of cards (the h2s become the card titles). Otherwise each h2 section is
 * a band: its paragraphs are the description beside the heading and its list is a set of rows
 * (or icon cards). Sections with links or other rich blocks keep their rich text. The words are
 * the body's own; nothing is added.
 */
export function bodyBands(
  body: RichTextValue | undefined,
  { heading, eyebrow, listIcons }: BodyBandsOptions = {},
): BandFactory[] {
  if (!body || body.length === 0) return [];
  const split = splitBody(body);
  const leadText = split.lead.paragraphs.join(" ") || undefined;

  if (isCardBody(split)) {
    const level = itemLevel(heading);
    return [
      (tone) => (
        <Band tone={tone} heading={heading} eyebrow={eyebrow} intro={leadText}>
          <FeatureGrid
            headingLevel={level}
            columns={columnsFor(split.sections.length)}
            items={split.sections.map(cardItem)}
          />
        </Band>
      ),
    ];
  }

  // With a structural heading (for example "Approach") the whole body is one band: the lead is
  // its description, short headed paragraphs are cards and each list sits under its own h3.
  if (heading) {
    const cards = split.sections.filter(isCardSection);
    const others = split.sections.filter((section) => !isCardSection(section));
    return [
      (tone) => (
        <Band tone={tone} heading={heading} eyebrow={eyebrow} intro={leadText}>
          {split.lead.rich || split.lead.items.length > 0 ? (
            <SectionBody section={split.lead} level={3} listIcons={listIcons} />
          ) : null}
          {cards.length > 0 ? (
            <FeatureGrid
              headingLevel={3}
              columns={columnsFor(cards.length)}
              items={cards.map(cardItem)}
            />
          ) : null}
          {others.map((section, index) => (
            <div key={`${section.title}-${index}`} className="mt-(--space-8)">
              <h3 className="m-0 text-h3 text-balance text-tone-heading">{section.title}</h3>
              {section.paragraphs.length > 0 && !section.rich ? (
                <p className="m-0 mt-(--space-3) max-w-(--container-prose) text-body-l text-pretty">
                  {section.paragraphs.join(" ")}
                </p>
              ) : null}
              <div className="mt-(--space-5)">
                <SectionBody section={section} level={4} listIcons={listIcons} />
              </div>
            </div>
          ))}
        </Band>
      ),
    ];
  }

  const bands: BandFactory[] = [];
  if (split.lead.rich || split.lead.items.length > 0) {
    bands.push((tone) => sectionBand(split.lead, tone, undefined, eyebrow, listIcons));
  } else if (leadText && split.sections.length === 0) {
    bands.push((tone) => (
      <Band tone={tone} eyebrow={eyebrow}>
        <p className="m-0 max-w-(--container-prose) text-body-l text-pretty">{leadText}</p>
      </Band>
    ));
  }
  const leadUsed = split.lead.rich || split.lead.items.length > 0;
  // Runs of two or more short headed paragraphs read as one band of cards (their headings are the
  // card titles, at h2); any other section is a band of its own.
  const isPlain = isCardSection;
  let index = 0;
  while (index < split.sections.length) {
    const start = index;
    while (index < split.sections.length && isPlain(split.sections[index]!)) index += 1;
    const run = split.sections.slice(start, index);
    const intro = start === 0 && !leadUsed ? leadText : undefined;
    if (run.length >= 2) {
      bands.push((tone) => (
        <Band tone={tone} eyebrow={eyebrow}>
          {intro ? (
            <p className="m-0 mb-(--space-7) max-w-(--container-prose) text-body-l text-pretty">
              {intro}
            </p>
          ) : null}
          <FeatureGrid
            headingLevel={2}
            columns={columnsFor(run.length)}
            items={run.map(cardItem)}
          />
        </Band>
      ));
      continue;
    }
    const section = split.sections[index]!;
    const first = run.length === 1 ? run[0]! : section;
    if (run.length === 0) index += 1;
    bands.push((tone) =>
      sectionBand(
        intro ? { ...first, paragraphs: [intro, ...first.paragraphs] } : first,
        tone,
        first.title,
        eyebrow,
        listIcons,
      ),
    );
  }
  return bands;
}

function sectionBand(
  section: BodySection,
  tone: Parameters<BandFactory>[0],
  heading: string | undefined,
  eyebrow: string | undefined,
  listIcons: readonly IconName[] | undefined,
) {
  if (section.rich) {
    return (
      <Band tone={tone} heading={heading} eyebrow={eyebrow}>
        <RichText value={section.blocks} />
      </Band>
    );
  }
  const intro = section.paragraphs.join(" ") || undefined;
  const iconCards = listIcons && section.items.length <= listIcons.length;
  return (
    <Band tone={tone} heading={heading} eyebrow={eyebrow} intro={intro}>
      {section.items.length > 0 ? (
        <FeatureGrid
          headingLevel={itemLevel(heading)}
          variant={iconCards ? "cards" : "rows"}
          columns={columnsFor(section.items.length)}
          items={section.items.map((text, index) => ({
            text,
            ...(iconCards && listIcons?.[index] ? { icon: listIcons[index] } : {}),
          }))}
        />
      ) : null}
    </Band>
  );
}

/** A section's list (as rows or icon cards) or, when it needs them, its rich-text blocks. */
function SectionBody({
  section,
  level,
  listIcons,
}: Readonly<{
  section: BodySection;
  level: 3 | 4;
  listIcons: readonly IconName[] | undefined;
}>) {
  if (section.rich) return <RichText value={section.blocks} />;
  if (section.items.length === 0) return null;
  const iconCards = listIcons && section.items.length <= listIcons.length;
  return (
    <FeatureGrid
      headingLevel={level}
      variant={iconCards ? "cards" : "rows"}
      columns={columnsFor(section.items.length)}
      items={section.items.map((text, index) => ({
        text,
        ...(iconCards && listIcons?.[index] ? { icon: listIcons[index] } : {}),
      }))}
    />
  );
}
