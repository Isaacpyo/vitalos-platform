/**
 * GENERATED from contracts/content-api/v1/openapi.yaml by openapi-typescript. Do not edit.
 * Regenerate with `pnpm content:types`; `pnpm content:types:check` and the web tests fail on drift.
 */
export interface paths {
  "/api/content/v1/site-state": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Whether Insights and Careers are open, plus Insights page copy. */
    get: operations["getSiteState"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/content/v1/insights/posts": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Published posts, 12 per page, newest first. */
    get: operations["listPosts"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/content/v1/insights/posts/{slug}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** A published post, or a redirect for an old slug. */
    get: operations["getPost"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/content/v1/insights/authors/{slug}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** An author with published posts, and those posts (newest first, at most 100). */
    get: operations["getAuthor"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/content/v1/insights/topics": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Topics and sectors with at least one published post. */
    get: operations["listTopics"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/content/v1/insights/topics/{slug}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** A topic with published posts, and one page of them. */
    get: operations["getTopic"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/content/v1/insights/feed": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** The newest 20 published posts. */
    get: operations["getFeed"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/content/v1/careers/page": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["getCareersPage"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/content/v1/careers/roles/{slug}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** An open role, a closed role's notice, or a redirect. Paused, draft, archived and unknown roles are 404. */
    get: operations["getRole"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/content/v1/home": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["getHome"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/content/v1/sitemap": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Every public Insights and Careers URL with its last modification. Closed sections contribute nothing. */
    get: operations["getSitemap"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/content/v1/preview/{entity}/{id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** The working copy, shaped like the published snapshot. Signed with a read key (scope `read`) and needs a valid preview token for the same entity and id. Post slugs `page`, `authors`, `topics` and `feed` are reserved and refused by the admin. */
    get: operations["getPreview"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/content/v1/tick": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Runs the due work of content_tick now (ADR-042). Signed with a read key and scope `tick`; empty JSON body `{}`. */
    post: operations["tick"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/content/v1/health": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["getHealth"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/careers/v1/upload-tickets": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** A single-use, 10-minute upload URL for a CV under pending/ (scope submit). */
    post: operations["createUploadTicket"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/careers/v1/uploads/{uploadId}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    /**
     * Fallback upload target when no object storage is configured. Called by the browser, not
     *     signed: the `token` query parameter is the single-use capability. CORS allows only the
     *     website origins. The exact declared size and the 10 MB limit are enforced.
     */
    put: operations["putUpload"];
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/careers/v1/applications": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Creates an application from a completed upload (scope submit). Idempotent by submissionId. */
    post: operations["createApplication"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/content/revalidate": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Website. Revalidates tags and paths for one sync event (scope revalidate). */
    post: operations["revalidate"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/content/render": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    /** Website. Renders Markdown with the site's one renderer (scope render). Body at most 200 KB. */
    post: operations["render"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/api/content/preview": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /** Website. Verifies a preview token, enables Draft Mode and redirects to the item's path. */
    get: operations["enterPreview"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    Error: {
      error: string;
    };
    Slug: string;
    /** Format: uuid */
    Uuid: string;
    /** @description An enum value with its public label. */
    Choice: {
      key: string;
      label: string;
    };
    /** @description A post format. `slug` is the URL form used in `?format=`. */
    FormatChoice: {
      /** @enum {string} */
      key:
        | "executive_briefing"
        | "insight_article"
        | "point_of_view"
        | "engineering_note"
        | "guide"
        | "research_report"
        | "case_derived_insight";
      label: string;
      plural: string;
      slug: components["schemas"]["Slug"];
    };
    PracticeChoice: {
      /** @enum {string} */
      key: "consulting" | "engineering" | "ai_data" | "experience" | "managed_services" | "labs";
      label: string;
    };
    /** @description A moment with its Europe/London display forms, e.g. long "12 October 2026", short "12 Oct 2026". */
    DateValue: {
      /** Format: date-time */
      iso: string;
      long: string;
      short: string;
    };
    Image: {
      /** Format: uri */
      url: string;
      alt: string;
      width: number;
      height: number;
      caption?: string | null;
    };
    AuthorRef: {
      id: components["schemas"]["Uuid"];
      slug: components["schemas"]["Slug"];
      name: string;
      /**
       * @description An organisation author (the Vitalos team) is shown with the Vitalos symbol instead of a photo or initials, and is an Organization in structured data. Absent means person.
       * @enum {string}
       */
      kind?: "person" | "organisation";
      roleTitle: string;
      initials: string;
      avatar: components["schemas"]["Image"] | null;
    };
    AuthorDetail: components["schemas"]["AuthorRef"] & {
      firstName: string;
      bioMarkdown: string;
      /** Format: uri */
      linkedinUrl: string | null;
    };
    TopicRef: {
      id: components["schemas"]["Uuid"];
      slug: components["schemas"]["Slug"];
      name: string;
      /** @enum {string} */
      kind: "topic" | "sector";
      /** @description Published posts in the topic (lists only). */
      count?: number;
    };
    TopicDetail: components["schemas"]["TopicRef"] & {
      description: string;
    };
    PostSummary: {
      id: components["schemas"]["Uuid"];
      slug: components["schemas"]["Slug"];
      title: string;
      excerpt: string;
      format: components["schemas"]["FormatChoice"];
      authors: components["schemas"]["AuthorRef"][];
      topics: components["schemas"]["TopicRef"][];
      practice: components["schemas"]["PracticeChoice"] | null;
      cover: components["schemas"]["Image"] | null;
      publishedAt: components["schemas"]["DateValue"];
      /** @description The public "Updated" date; set only for material updates. */
      updatedAt: components["schemas"]["DateValue"] | null;
      readingMinutes: number;
      featured: boolean;
    };
    PostDetail: components["schemas"]["PostSummary"] & {
      /** @description Markdown (brief 4.4). Body images uploaded through the admin carry their stored dimensions as a URL fragment, `![alt](https://media.../content/{uuid}.jpg#w=1600&h=900 "caption")`; the renderer uses them for width and height and strips the fragment. */
      bodyMarkdown: string;
      seo: {
        title: string;
        description: string;
        /** Format: uri */
        canonicalUrl: string | null;
        noindex: boolean;
      };
      cta: {
        label: string;
        /** @description An internal path or an https://vitalos.co.uk URL. */
        href: string;
      };
      related: components["schemas"]["PostSummary"][];
      /** Format: date-time */
      lastModified: string;
    };
    PostPage: {
      items: components["schemas"]["PostSummary"][];
      page: number;
      /** @constant */
      pageSize: 12;
      total: number;
      totalPages: number;
      /** @description Only on page 1 of an unfiltered list; never repeated in `items` of any page. */
      featured: components["schemas"]["PostSummary"] | null;
      /** @description Formats with at least one published post, in the fixed format order. */
      formats: (components["schemas"]["FormatChoice"] & {
        count: number;
      })[];
      /** @description Topics and sectors with at least one published post, in sort order. */
      topics: components["schemas"]["TopicRef"][];
    };
    Redirect: {
      redirect: components["schemas"]["Slug"];
    };
    InsightsCopy: {
      heading: string;
      intro: string;
      editorialNote: string;
      /** @description Shown instead of editorialNote on posts whose only author is an organisation. */
      organisationEditorialNote?: string;
    };
    SalaryValue: {
      min: number;
      max: number;
      currency: string;
      /** @enum {string} */
      period: "year" | "day";
      /** @description e.g. £55,000–£65,000 a year */
      label: string;
    };
    RoleSummary: {
      id: components["schemas"]["Uuid"];
      slug: components["schemas"]["Slug"];
      title: string;
      practice: components["schemas"]["PracticeChoice"];
      /** @description Null when the level is hidden. */
      level: components["schemas"]["Choice"] | null;
      location: string;
      workModel: components["schemas"]["Choice"];
      employmentType: components["schemas"]["Choice"];
      /** @description Null when the salary is hidden. */
      salary: components["schemas"]["SalaryValue"] | null;
      closesAt: components["schemas"]["DateValue"] | null;
      showOnHome: boolean;
    };
    RoleDetail: components["schemas"]["RoleSummary"] & {
      /** @constant */
      state: "open";
      summary: string;
      /** @description Markdown; empty strings are not shown. */
      sections: {
        about: string;
        responsibilities: string;
        requirements: string;
        niceToHave: string;
        /** @description The role's own text, else the careers default. */
        process: string;
        equalOpportunities: string;
      };
      /** @description Null when not stated. */
      sponsorship: components["schemas"]["Choice"] | null;
      apply: {
        /** @enum {string} */
        mode: "form" | "external";
        /** Format: uri */
        externalUrl: string | null;
      };
      datePosted: components["schemas"]["DateValue"];
      /** Format: date-time */
      lastModified: string;
      privacy: {
        noticeUrl: string | null;
        noticeVersion: string | null;
      };
    };
    ClosedRole: {
      /** @constant */
      state: "closed";
      slug: components["schemas"]["Slug"];
      title: string;
      practice: components["schemas"]["PracticeChoice"];
      closedAt: components["schemas"]["DateValue"];
    };
    CareersCopy: {
      heading: string;
      intro: string;
      values: string[];
      statements: string[];
      emptyState: string;
      /** @description Null unless the associates line is enabled (CAR-01). */
      associatesLine: string | null;
      /** @description Markdown; hidden when empty. */
      benefits: string;
      process: string;
      salaryPolicy: string;
      equalOpportunities: string;
      privacyNoticeUrl: string | null;
      privacyNoticeVersion: string | null;
      speculativeApplications: boolean;
    };
    CareersPage: {
      copy: components["schemas"]["CareersCopy"];
      /** @description Open roles by practice, in the fixed practice order; empty practices are left out. */
      groups: {
        practice: components["schemas"]["PracticeChoice"];
        roles: components["schemas"]["RoleSummary"][];
      }[];
      total: number;
    };
    HomeInsights: {
      heading: string;
      intro: string;
      items: components["schemas"]["PostSummary"][];
    };
    HomeCareers: {
      heading: string;
      intro: string;
      roles: components["schemas"]["RoleSummary"][];
      /** @description The empty-state copy, only when no roles are open and the section is set to show a message. */
      message: string | null;
      associatesLine: string | null;
    };
    Home: {
      /** @description Null when Insights is closed, the section is disabled, or nothing is published. */
      insights: components["schemas"]["HomeInsights"] | null;
      /** @description Null when Careers is closed, the section is disabled, or no roles are open and the section hides. */
      careers: components["schemas"]["HomeCareers"] | null;
    };
    SiteState: {
      insightsOpen: boolean;
      careersOpen: boolean;
      /**
       * Format: date-time
       * @description Earliest pending scheduled publish, role closing or sync retry, including overdue ones; the website's tick calls the admin only once it has passed (ADR-042).
       */
      nextDueAt: string | null;
      insights: components["schemas"]["InsightsCopy"];
    };
    Sitemap: {
      entries: {
        path: string;
        /** Format: date-time */
        lastModified: string;
      }[];
    };
    Preview: {
      /** @enum {string} */
      entity: "post" | "role";
      /** @description The working copy's status, e.g. draft. */
      status: string;
      post: components["schemas"]["PostDetail"] | null;
      role: components["schemas"]["RoleDetail"] | null;
    };
    RevalidateRequest: {
      eventId: components["schemas"]["Uuid"];
      /**
       * @description publish: stale-while-revalidate then warm the paths; remove: expire immediately.
       * @enum {string}
       */
      kind: "publish" | "remove";
      tags: string[];
      paths: string[];
    };
    RevalidateResponse: {
      revalidated: string[];
    };
    RenderRequest: {
      markdown: string;
      /** @enum {string} */
      context: "post" | "role" | "author" | "settings";
    };
    RenderWarning: {
      /** @enum {string} */
      code: "missing_alt" | "h1_in_body" | "image_host" | "html_stripped" | "heading_level";
      message: string;
      blocking: boolean;
    };
    RenderResponse: {
      html: string;
      toc: {
        id: string;
        text: string;
        depth: number;
      }[];
      footnotes: number;
      warnings: components["schemas"]["RenderWarning"][];
      /** @description Questions under a level 2 "Frequently asked questions" heading (each a level 3 heading) with their answers as plain text, for FAQPage structured data. Empty when the body has no such section. */
      faq?: {
        question: string;
        answer: string;
      }[];
    };
    UploadTicketRequest: {
      roleSlug: components["schemas"]["Slug"];
      filename: string;
      size: number;
      /** @enum {string} */
      mime:
        | "application/pdf"
        | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    };
    UploadTicket: {
      uploadId: components["schemas"]["Uuid"];
      /** Format: uri */
      uploadUrl: string;
      /** @constant */
      method: "PUT";
      /** @description Headers the browser must send with the PUT (Content-Type and nothing secret). */
      headers: {
        [key: string]: string;
      };
      /** Format: date-time */
      expiresAt: string;
    };
    ApplicationRequest: {
      submissionId: components["schemas"]["Uuid"];
      roleSlug: components["schemas"]["Slug"];
      uploadId: components["schemas"]["Uuid"];
      name: string;
      /** Format: email */
      email: string;
      phone?: string;
      location?: string;
      linkedinUrl?: string;
      portfolioUrl?: string;
      /** @enum {string} */
      rightToWork: "yes" | "needs_sponsorship" | "prefer_to_discuss";
      noticePeriod?: string;
      coverNote?: string;
      /** @constant */
      consent: true;
      noticeVersion: string;
      /** @enum {string} */
      source: "careers_page" | "homepage" | "role_page";
      /** @description Hashed with a salt by the admin; never stored raw. */
      clientIp: string;
      userAgent: string;
    };
    ApplicationAccepted: {
      applicationId: components["schemas"]["Uuid"];
      roleTitle: string;
      /** @description Hiring process Markdown, or empty. */
      process: string;
    };
    ApplicationErrors: {
      /** @description Field name to error code. */
      errors: {
        [key: string]:
          | "required"
          | "invalid"
          | "too_long"
          | "upload_missing"
          | "upload_type"
          | "upload_size"
          | "role_closed"
          | "rate_limited";
      };
    };
  };
  responses: {
    /** @description Unknown, or not public. */
    NotFound: {
      headers: {
        [name: string]: unknown;
      };
      content: {
        "application/json": components["schemas"]["Error"];
      };
    };
    /** @description Missing, tampered, stale or wrong-scope signature. */
    Unauthorized: {
      headers: {
        [name: string]: unknown;
      };
      content: {
        "application/json": components["schemas"]["Error"];
      };
    };
    /** @description Invalid request body or parameters. */
    BadRequest: {
      headers: {
        [name: string]: unknown;
      };
      content: {
        "application/json": components["schemas"]["Error"];
      };
    };
    /** @description Body larger than the endpoint allows. */
    PayloadTooLarge: {
      headers: {
        [name: string]: unknown;
      };
      content: {
        "application/json": components["schemas"]["Error"];
      };
    };
    /** @description Rate limited. */
    TooManyRequests: {
      headers: {
        [name: string]: unknown;
      };
      content: {
        "application/json": components["schemas"]["Error"];
      };
    };
  };
  parameters: {
    Slug: components["schemas"]["Slug"];
    Page: number;
  };
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  getSiteState: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SiteState"];
        };
      };
      401: components["responses"]["Unauthorized"];
    };
  };
  listPosts: {
    parameters: {
      query?: {
        page?: components["parameters"]["Page"];
        format?: components["schemas"]["Slug"];
        topic?: components["schemas"]["Slug"];
        author?: components["schemas"]["Slug"];
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["PostPage"];
        };
      };
      401: components["responses"]["Unauthorized"];
      404: components["responses"]["NotFound"];
    };
  };
  getPost: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        slug: components["parameters"]["Slug"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            components["schemas"]["PostDetail"] | components["schemas"]["Redirect"];
        };
      };
      401: components["responses"]["Unauthorized"];
      404: components["responses"]["NotFound"];
    };
  };
  getAuthor: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        slug: components["parameters"]["Slug"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | {
                author: components["schemas"]["AuthorDetail"];
                posts: components["schemas"]["PostSummary"][];
              }
            | components["schemas"]["Redirect"];
        };
      };
      401: components["responses"]["Unauthorized"];
      404: components["responses"]["NotFound"];
    };
  };
  listTopics: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            topics: components["schemas"]["TopicRef"][];
          };
        };
      };
      401: components["responses"]["Unauthorized"];
    };
  };
  getTopic: {
    parameters: {
      query?: {
        page?: components["parameters"]["Page"];
      };
      header?: never;
      path: {
        slug: components["parameters"]["Slug"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            topic: components["schemas"]["TopicDetail"];
            posts: components["schemas"]["PostPage"];
          };
        };
      };
      401: components["responses"]["Unauthorized"];
      404: components["responses"]["NotFound"];
    };
  };
  getFeed: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            items: components["schemas"]["PostSummary"][];
          };
        };
      };
      401: components["responses"]["Unauthorized"];
    };
  };
  getCareersPage: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["CareersPage"];
        };
      };
      401: components["responses"]["Unauthorized"];
    };
  };
  getRole: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        slug: components["parameters"]["Slug"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json":
            | components["schemas"]["RoleDetail"]
            | components["schemas"]["ClosedRole"]
            | components["schemas"]["Redirect"];
        };
      };
      401: components["responses"]["Unauthorized"];
      404: components["responses"]["NotFound"];
    };
  };
  getHome: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["Home"];
        };
      };
      401: components["responses"]["Unauthorized"];
    };
  };
  getSitemap: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["Sitemap"];
        };
      };
      401: components["responses"]["Unauthorized"];
    };
  };
  getPreview: {
    parameters: {
      query?: never;
      header: {
        "X-Vitalos-Preview-Token": string;
      };
      path: {
        entity: "post" | "role";
        id: components["schemas"]["Uuid"];
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["Preview"];
        };
      };
      401: components["responses"]["Unauthorized"];
      404: components["responses"]["NotFound"];
    };
  };
  tick: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            promoted: number;
            closed: number;
            delivered: number;
            /** Format: date-time */
            nextDueAt: string | null;
          };
        };
      };
      401: components["responses"]["Unauthorized"];
    };
  };
  getHealth: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": {
            /** @constant */
            status: "ok";
          };
        };
      };
      401: components["responses"]["Unauthorized"];
    };
  };
  createUploadTicket: {
    parameters: {
      query?: never;
      header?: {
        /** @description The applicant's IP as the website sees it, hashed by the admin with a salt for a per-IP cap (10 tickets an hour) and never stored raw. It is outside the canonical string and trusted because only the website holds a submit key. */
        "X-Vitalos-Client-Ip"?: string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["UploadTicketRequest"];
      };
    };
    responses: {
      /** @description Created */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["UploadTicket"];
        };
      };
      /** @description Invalid */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApplicationErrors"];
        };
      };
      401: components["responses"]["Unauthorized"];
      /** @description The role is not accepting applications. */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApplicationErrors"];
        };
      };
      /** @description Too many tickets for this client IP (rate_limited). */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApplicationErrors"];
        };
      };
      /** @description CV storage is not configured in production (upload_missing). */
      503: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApplicationErrors"];
        };
      };
    };
  };
  putUpload: {
    parameters: {
      query: {
        token: string;
      };
      header?: never;
      path: {
        uploadId: components["schemas"]["Uuid"];
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/pdf": string;
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": string;
      };
    };
    responses: {
      /** @description Stored */
      204: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      400: components["responses"]["BadRequest"];
      403: components["responses"]["Unauthorized"];
      413: components["responses"]["PayloadTooLarge"];
    };
  };
  createApplication: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ApplicationRequest"];
      };
    };
    responses: {
      /** @description Already received (same submissionId). */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApplicationAccepted"];
        };
      };
      /** @description Created */
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApplicationAccepted"];
        };
      };
      /** @description Invalid */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApplicationErrors"];
        };
      };
      401: components["responses"]["Unauthorized"];
      /** @description Role closed */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApplicationErrors"];
        };
      };
      /** @description The upload is missing or invalid */
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApplicationErrors"];
        };
      };
      /** @description Rate limited */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApplicationErrors"];
        };
      };
    };
  };
  revalidate: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["RevalidateRequest"];
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["RevalidateResponse"];
        };
      };
      400: components["responses"]["BadRequest"];
      401: components["responses"]["Unauthorized"];
      429: components["responses"]["TooManyRequests"];
    };
  };
  render: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["RenderRequest"];
      };
    };
    responses: {
      /** @description OK */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["RenderResponse"];
        };
      };
      401: components["responses"]["Unauthorized"];
      413: components["responses"]["PayloadTooLarge"];
      429: components["responses"]["TooManyRequests"];
    };
  };
  enterPreview: {
    parameters: {
      query: {
        token: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Redirect to the item */
      307: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
      401: components["responses"]["Unauthorized"];
    };
  };
}
