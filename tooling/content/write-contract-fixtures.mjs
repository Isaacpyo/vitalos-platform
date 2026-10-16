// Writes the shared content-API fixtures (contracts/content-api/v1/fixtures). Every value is an
// obviously fictional example ("Example author", "Example role (fixture)"); none may be loaded into
// a production database. Run: node tooling/content/write-contract-fixtures.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../contracts/content-api/v1/fixtures",
);
mkdirSync(root, { recursive: true });

const date = (iso, long, short) => ({ iso, long, short });
const published = date("2026-10-12T09:00:00Z", "12 October 2026", "12 Oct 2026");
const author = {
  id: "00000000-0000-4000-8000-0000000000a1",
  slug: "example-author",
  name: "Example Author",
  roleTitle: "Example role title",
  initials: "EA",
  avatar: null,
};
const topic = {
  id: "00000000-0000-4000-8000-0000000000c1",
  slug: "example-topic",
  name: "Example topic",
  kind: "topic",
};
const format = {
  key: "engineering_note",
  label: "Engineering note",
  plural: "Engineering notes",
  slug: "engineering-note",
};
const summary = (n, extra = {}) => ({
  id: `00000000-0000-4000-8000-00000000010${n}`,
  slug: `example-post-${n}`,
  title: `Example post ${n} (fixture)`,
  excerpt: "Example excerpt for a fixture post. It is not real content.",
  format,
  authors: [author],
  topics: [topic],
  practice: { key: "engineering", label: "Engineering" },
  cover: null,
  publishedAt: published,
  updatedAt: null,
  readingMinutes: 3,
  featured: false,
  ...extra,
});
const detail = {
  ...summary(1, {
    cover: {
      url: "https://media.example.test/content/00000000-0000-4000-8000-000000000f01.jpg",
      alt: "Example cover image",
      width: 1600,
      height: 900,
      caption: null,
    },
    updatedAt: date("2026-10-14T10:30:00Z", "14 October 2026", "14 Oct 2026"),
  }),
  bodyMarkdown:
    "## Example heading\n\nExample paragraph with a footnote.[^1]\n\n[^1]: Example source (fixture).\n",
  seo: {
    title: "Example post 1 (fixture)",
    description: "Example description.",
    canonicalUrl: null,
    noindex: false,
  },
  cta: { label: "Talk to Vitalos", href: "/contact" },
  related: [summary(2)],
  lastModified: "2026-10-14T10:30:00Z",
};
const role = {
  id: "00000000-0000-4000-8000-0000000002a1",
  slug: "example-role-fixture",
  title: "Example role (fixture)",
  practice: { key: "engineering", label: "Engineering" },
  level: { key: "l3_senior", label: "Senior" },
  location: "Example City",
  workModel: { key: "hybrid", label: "Hybrid" },
  employmentType: { key: "permanent_full_time", label: "Permanent" },
  salary: {
    min: 10000,
    max: 20000,
    currency: "GBP",
    period: "year",
    label: "£10,000–£20,000 a year",
  },
  closesAt: date("2026-11-30T23:59:00Z", "30 November 2026", "30 Nov 2026"),
  showOnHome: true,
};
const careersCopy = {
  heading: "Build what you advise.",
  intro:
    "Vitalos offers consequential technology work, close to the problem, where you build what you advise. People get senior responsibility and direct client exposure, consulting and engineering in one environment, AI used as a real delivery capability, and high standards without unnecessary bureaucracy.",
  values: [
    "Ownership",
    "Candour",
    "Craft",
    "Commercial sense",
    "Clarity",
    "Learning",
    "Collaboration",
    "Respect",
    "Pragmatism",
    "Client stewardship",
  ],
  statements: [
    "Work is remote-capable by design, with written context and documented decisions, and in-person time is used where it adds value.",
    "Technical people can progress without having to become people managers.",
  ],
  emptyState:
    "There are no open roles right now. Roles are published here only when they are real.",
  associatesLine: null,
  benefits: "",
  process: "",
  salaryPolicy: "",
  equalOpportunities: "",
  privacyNoticeUrl: "/legal/privacy",
  privacyNoticeVersion: "2026-10",
  speculativeApplications: false,
};
const insightsCopy = {
  heading: "Engineering clarity from complexity.",
  intro: "Practical writing on modernisation, data and AI for leaders who have to make it work.",
  editorialNote:
    "Every substantive Vitalos Insight has a named human author who is accountable for its accuracy and judgement. Claims, citations and figures are checked before anything is published.",
};
const roleDetail = {
  ...role,
  state: "open",
  summary: "Example summary for a fixture role. It is not a real vacancy.",
  sections: {
    about: "Example about text (fixture).",
    responsibilities: "- Example responsibility",
    requirements: "- Example requirement",
    niceToHave: "",
    process: "",
    equalOpportunities: "",
  },
  sponsorship: null,
  apply: { mode: "form", externalUrl: null },
  datePosted: published,
  lastModified: "2026-10-12T09:00:00Z",
  privacy: { noticeUrl: "/legal/privacy", noticeVersion: "2026-10" },
};
const page = (items, extra = {}) => ({
  items,
  page: 1,
  pageSize: 12,
  total: items.length,
  totalPages: items.length > 0 ? 1 : 0,
  featured: null,
  formats: items.length > 0 ? [{ ...format, count: items.length }] : [],
  topics: items.length > 0 ? [{ ...topic, count: items.length }] : [],
  ...extra,
});

// fixture name -> [schema, payload]. Schema names are components in openapi.yaml, or the inline
// response of an operation (see index.json's $comment).
const fixtures = {
  "site-state": [
    "SiteState",
    {
      insightsOpen: true,
      careersOpen: true,
      insights: insightsCopy,
      nextDueAt: "2026-10-12T10:00:00Z",
    },
  ],
  "site-state-closed": [
    "SiteState",
    { insightsOpen: false, careersOpen: false, insights: insightsCopy, nextDueAt: null },
  ],
  "post-page": [
    "PostPage",
    page([summary(2), summary(3)], {
      total: 3,
      featured: summary(1, { featured: true }),
      formats: [{ ...format, count: 3 }],
      topics: [{ ...topic, count: 3 }],
    }),
  ],
  "post-page-empty": ["PostPage", page([])],
  "post-detail": ["PostDetail", detail],
  redirect: ["Redirect", { redirect: "example-post-1" }],
  author: [
    "AuthorResponse",
    {
      author: {
        ...author,
        firstName: "Example",
        bioMarkdown: "Example biography (fixture).",
        linkedinUrl: null,
      },
      posts: [summary(1)],
    },
  ],
  topics: ["TopicsResponse", { topics: [{ ...topic, count: 3 }] }],
  topic: [
    "TopicResponse",
    {
      topic: { ...topic, description: "Example topic description (fixture)." },
      posts: page([summary(1)]),
    },
  ],
  feed: ["FeedResponse", { items: [summary(1), summary(2)] }],
  "careers-page": [
    "CareersPage",
    { copy: careersCopy, groups: [{ practice: role.practice, roles: [role] }], total: 1 },
  ],
  "careers-page-empty": ["CareersPage", { copy: careersCopy, groups: [], total: 0 }],
  "role-open": ["RoleDetail", roleDetail],
  "role-closed": [
    "ClosedRole",
    {
      state: "closed",
      slug: role.slug,
      title: role.title,
      practice: role.practice,
      closedAt: date("2026-11-30T23:59:00Z", "30 November 2026", "30 Nov 2026"),
    },
  ],
  home: [
    "Home",
    {
      insights: {
        heading: insightsCopy.heading,
        intro: insightsCopy.intro,
        items: [summary(1), summary(2), summary(3)],
      },
      careers: {
        heading: careersCopy.heading,
        intro:
          "Vitalos offers consequential technology work, close to the problem, where you build what you advise.",
        roles: [role],
        message: null,
        associatesLine: null,
      },
    },
  ],
  "home-empty": ["Home", { insights: null, careers: null }],
  sitemap: [
    "Sitemap",
    {
      entries: [
        { path: "/insights", lastModified: "2026-10-14T10:30:00Z" },
        { path: "/insights/example-post-1", lastModified: "2026-10-14T10:30:00Z" },
        { path: "/insights/topics/example-topic", lastModified: "2026-10-14T10:30:00Z" },
        { path: "/insights/authors/example-author", lastModified: "2026-10-14T10:30:00Z" },
        { path: "/careers", lastModified: "2026-10-12T09:00:00Z" },
        { path: "/careers/example-role-fixture", lastModified: "2026-10-12T09:00:00Z" },
      ],
    },
  ],
  "preview-post": ["Preview", { entity: "post", status: "draft", post: detail, role: null }],
  "preview-role": ["Preview", { entity: "role", status: "draft", post: null, role: roleDetail }],
  "revalidate-request": [
    "RevalidateRequest",
    {
      eventId: "00000000-0000-4000-8000-0000000003e1",
      kind: "publish",
      tags: [
        "insights",
        "insights:list",
        "insights:post:example-post-1",
        "insights:author:example-author",
        "insights:topic:example-topic",
        "home",
        "feed",
        "sitemap",
      ],
      paths: ["/insights/example-post-1"],
    },
  ],
  "render-request": [
    "RenderRequest",
    { markdown: "## Example heading\n\nExample paragraph.", context: "post" },
  ],
  "render-response": [
    "RenderResponse",
    {
      html: '<h2 id="example-heading">Example heading</h2>\n<p>Example paragraph.</p>',
      toc: [{ id: "example-heading", text: "Example heading", depth: 2 }],
      footnotes: 0,
      warnings: [{ code: "missing_alt", message: "An image has no alt text.", blocking: true }],
    },
  ],
  "upload-ticket-request": [
    "UploadTicketRequest",
    { roleSlug: role.slug, filename: "example-cv.pdf", size: 20480, mime: "application/pdf" },
  ],
  "upload-ticket": [
    "UploadTicket",
    {
      uploadId: "00000000-0000-4000-8000-0000000004a1",
      uploadUrl:
        "https://admin.example.test/api/careers/v1/uploads/00000000-0000-4000-8000-0000000004a1?token=example-token",
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      expiresAt: "2026-10-12T09:10:00Z",
    },
  ],
  "application-request": [
    "ApplicationRequest",
    {
      submissionId: "00000000-0000-4000-8000-0000000005a1",
      roleSlug: role.slug,
      uploadId: "00000000-0000-4000-8000-0000000004a1",
      name: "Example Applicant",
      email: "applicant@example.test",
      phone: "",
      location: "Example City",
      linkedinUrl: "",
      portfolioUrl: "",
      rightToWork: "yes",
      noticePeriod: "",
      coverNote: "Example cover note (fixture).",
      consent: true,
      noticeVersion: "2026-10",
      source: "role_page",
      clientIp: "192.0.2.1",
      userAgent: "fixture",
    },
  ],
  "application-accepted": [
    "ApplicationAccepted",
    { applicationId: "00000000-0000-4000-8000-0000000006a1", roleTitle: role.title, process: "" },
  ],
  "application-errors": [
    "ApplicationErrors",
    { errors: { email: "invalid", uploadId: "upload_type" } },
  ],
};

const index = {};
for (const [name, [schema, payload]] of Object.entries(fixtures)) {
  writeFileSync(join(root, `${name}.json`), `${JSON.stringify(payload, null, 2)}\n`);
  index[name] = schema;
}
writeFileSync(
  join(root, "index.json"),
  `${JSON.stringify(
    {
      $comment:
        "Fixture name -> schema. Names ending in Response are the inline 200 response of an operation in openapi.yaml: AuthorResponse = getAuthor (non-redirect branch), TopicsResponse = listTopics, TopicResponse = getTopic, FeedResponse = getFeed.",
      fixtures: index,
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${Object.keys(fixtures).length} fixtures`);
