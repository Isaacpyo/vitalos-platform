import type { Metadata } from "next";
import { loadCareersPage } from "../../../src/features/content/careers/load";
import { CAREERS_BASE } from "../../../src/features/content/routes";
import { Breadcrumbs, homeCrumb } from "../../../src/templates/institutional/breadcrumbs";
import { CareersTemplate } from "../../../src/templates/careers/CareersTemplate";
import { careersMetadata } from "../../../src/templates/careers/metadata";

/** `/careers` (brief 6.1), behind `careers_open`. Static, refreshed by tags and the TTL. */
export async function generateMetadata(): Promise<Metadata> {
  const { page } = await loadCareersPage();
  return careersMetadata({ path: CAREERS_BASE, title: "", description: page.copy.intro });
}

export default async function CareersPage() {
  const view = await loadCareersPage();
  return (
    <>
      <Breadcrumbs
        trail={[homeCrumb, { name: "Careers", path: CAREERS_BASE }]}
        page={{
          type: "CollectionPage",
          name: view.page.copy.heading,
          description: view.page.copy.intro,
        }}
      />
      <CareersTemplate view={view} />
    </>
  );
}
