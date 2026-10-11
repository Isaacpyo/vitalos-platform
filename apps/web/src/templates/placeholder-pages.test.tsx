import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { draftContent } from "@vitalos/cms/draft";
import { fullFixtureSet } from "@vitalos/cms/fixtures";
import type { CaseStudyView, InsightView, JobView, PersonView } from "@vitalos/cms";
import { evaluateGates } from "@vitalos/cms";
import { placeholderNoticeText } from "../components/placeholder-notice";
import { AboutPage } from "./about/AboutPage";
import { LeadershipPage } from "./about/LeadershipPage";
import { CareersIndex } from "./careers/CareersIndex";
import { JobPage } from "./careers/JobPage";
import { ArticlePage } from "./insights/ArticlePage";
import { InsightsIndex } from "./insights/InsightsIndex";
import { ProfilePage } from "./people/ProfilePage";
import { CaseStudyPage } from "./work/CaseStudyPage";
import { WorkIndex } from "./work/WorkIndex";
import { isPublicCaseStudy, isVerifiedProof } from "./work/map";

vi.mock("../features/seo/context", () => ({
  getSeoContext: () => ({ siteUrl: "https://www.example.invalid", indexable: false }),
}));

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>);
const gates = evaluateGates({ work: 2, insights: 6, labs: 1, industries: 1, careers: 1 });
const now = new Date("2026-10-11T00:00:00Z");
const { documents } = draftContent.set;

const notice = placeholderNoticeText.title;
const ldJson = "application/ld+json";

describe("pages that render placeholder content", () => {
  it("shows the notice and emits no structured data on an article page", () => {
    const insight = documents.insight[0] as InsightView;
    const markup = html(<ArticlePage data={{ insight, gates, draft: false }} />);
    expect(markup).toContain(notice);
    expect(markup).not.toContain(ldJson);
  });

  it("shows the notice and emits no structured data on a persona page", () => {
    const person = documents.person[0] as PersonView;
    const markup = html(<ProfilePage data={{ person, gates, draft: false }} />);
    expect(markup).toContain(notice);
    expect(markup).not.toContain(ldJson);
  });

  it("shows the notice and emits no structured data on the role page", () => {
    const job = documents.job[0] as JobView;
    const markup = html(<JobPage data={{ job, gates, now, draft: false }} />);
    expect(markup).toContain(notice);
    expect(markup).not.toContain(ldJson);
    // No salary; the application link is the careers contact route.
    expect(markup).not.toMatch(/salary|£/i);
    expect(markup).toContain('href="/contact?intent=careers"');
  });

  it("shows the notice and no outcome, metric or testimonial on a case study page", () => {
    const study = documents.caseStudy[0] as CaseStudyView;
    const markup = html(<CaseStudyPage data={{ study, gates, draft: false }} />);
    expect(markup).toContain(notice);
    expect(markup).not.toContain(ldJson);
    expect(markup).toContain("Illustrative scenario (placeholder)");
    expect(markup).not.toMatch(/Contracted by Vitalos|<blockquote/);
  });

  it("shows the notice on the indexes, Leadership and About", () => {
    const people = documents.person as readonly PersonView[];
    const leaders = people.filter((person) => person.isLeadership);
    expect(
      html(
        <InsightsIndex
          data={{ page: null, insights: [...(documents.insight as InsightView[])], draft: false }}
        />,
      ),
    ).toContain(notice);
    expect(
      html(
        <WorkIndex
          data={{
            page: null,
            studies: [...(documents.caseStudy as CaseStudyView[])],
            draft: false,
          }}
        />,
      ),
    ).toContain(notice);
    expect(
      html(
        <CareersIndex
          data={{ page: null, jobs: [{ ...(documents.job[0] as JobView) }], draft: false }}
        />,
      ),
    ).toContain(notice);
    expect(html(<LeadershipPage data={{ page: null, leaders, draft: false }} />)).toContain(notice);
    expect(html(<AboutPage data={{ page: null, leaders, gates, draft: false }} />)).toContain(
      notice,
    );
  });

  it("emits no breadcrumb structured data on placeholder pages", () => {
    const insight = documents.insight[0] as InsightView;
    expect(html(<ArticlePage data={{ insight, gates, draft: false }} />)).not.toContain("ListItem");
  });
});

describe("pages that render real content", () => {
  it("show no placeholder notice and keep their structured data", () => {
    const insight = fullFixtureSet.documents.insight[0] as InsightView;
    const markup = html(<ArticlePage data={{ insight, gates, draft: false }} />);
    expect(markup).not.toContain(notice);
    expect(markup).toContain(ldJson);
  });
});

describe("Work proof rule", () => {
  it("counts a placeholder case study as public, and a pending real one as not", () => {
    const placeholder = documents.caseStudy[0] as CaseStudyView;
    expect(isVerifiedProof(placeholder)).toBe(false);
    expect(isPublicCaseStudy(placeholder)).toBe(true);
    const real: Partial<CaseStudyView> = { ...placeholder };
    delete real.placeholder;
    expect(isPublicCaseStudy(real as CaseStudyView)).toBe(false);
  });
});
