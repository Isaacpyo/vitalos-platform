import type {
  ContentSource,
  DocKind,
  GetDocumentArgs,
  HomePageView,
  LabType,
  PublicationGates,
  ReadOpts,
  RoutePageKey,
  RoutePageViewFor,
  SiteChromeView,
  SitemapEntry,
  SlugFor,
  SummaryFor,
  ViewFor,
} from "@vitalos/cms";

/**
 * Decides whether a read is a preview read. Called once per content call. The explicit
 * `preview` option wins when it is `false`; `true` is only honoured when previewing is possible.
 */
export type PreviewResolver = (explicit: boolean | undefined) => Promise<boolean>;

/**
 * Wraps a `ContentSource` so every read resolves its `preview` option, normally from Draft Mode.
 * Pages therefore call `source.getDocument("practice", slug)` and get drafts for editors and
 * published content for everyone else, with no per-page draft-mode code. `listParams` and
 * `getSitemapEntries` always read published content: they feed static generation and the sitemap.
 */
export class DraftAwareContentSource implements ContentSource {
  constructor(
    private readonly inner: ContentSource,
    private readonly resolvePreview: PreviewResolver,
  ) {}

  private async opts(o?: ReadOpts): Promise<ReadOpts> {
    return { ...o, preview: await this.resolvePreview(o?.preview) };
  }

  async getSiteChrome(o?: ReadOpts): Promise<SiteChromeView> {
    return this.inner.getSiteChrome(await this.opts(o));
  }

  async getHomePage(o?: ReadOpts): Promise<HomePageView | null> {
    return this.inner.getHomePage(await this.opts(o));
  }

  async getRoutePage<K extends RoutePageKey>(
    key: K,
    o?: ReadOpts,
  ): Promise<RoutePageViewFor<K> | null> {
    return this.inner.getRoutePage(key, await this.opts(o));
  }

  async getDocument<T extends DocKind>(
    kind: T,
    slug: SlugFor<T>,
    ...args: GetDocumentArgs<T>
  ): Promise<ViewFor<T> | null> {
    const [o] = args as [(ReadOpts & { labType?: LabType }) | undefined];
    const resolved = { ...o, preview: await this.resolvePreview(o?.preview) };
    return this.inner.getDocument(kind, slug, ...([resolved] as unknown as GetDocumentArgs<T>));
  }

  async listSummaries<T extends DocKind>(kind: T, o?: ReadOpts): Promise<SummaryFor<T>[]> {
    return this.inner.listSummaries(kind, await this.opts(o));
  }

  listParams(kind: DocKind): Promise<Record<string, string>[]> {
    return this.inner.listParams(kind);
  }

  getSitemapEntries(): Promise<SitemapEntry[]> {
    return this.inner.getSitemapEntries();
  }

  async getPublicationGates(o?: ReadOpts): Promise<PublicationGates> {
    return this.inner.getPublicationGates(await this.opts(o));
  }
}

/** Always published, whatever the caller asks for. Used by the sitemap and static generation. */
export const publishedOnly: PreviewResolver = () => Promise.resolve(false);
