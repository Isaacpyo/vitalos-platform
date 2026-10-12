import { routes } from "@vitalos/cms";
import type { LegalPageView } from "@vitalos/cms";
import { MetaRow, Stack } from "@vitalos/ui";
import { RichText } from "../../components/rich-text";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { PageBand, PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import { hasRichText } from "../institutional/rich";
import { legalFacts } from "./map";

/** A legal page: the CMS title, version and effective date, and the CMS body. Nothing is written here. */
export function LegalPage({ page }: Readonly<{ page: LegalPageView }>) {
  return (
    <PageMain>
      <PageHeroBand
        size="prose"
        crumbs={
          <Breadcrumbs trail={[homeCrumb, { name: page.title, path: routes.legal(page.slug) }]} />
        }
        title={page.title}
      >
        <MetaRow items={legalFacts(page)} />
      </PageHeroBand>
      <PageBand size="prose">
        <Stack gap={8}>{hasRichText(page.body) ? <RichText value={page.body} /> : null}</Stack>
      </PageBand>
    </PageMain>
  );
}
