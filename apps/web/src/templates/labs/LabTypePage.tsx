import { navLabels, routes } from "@vitalos/cms";
import { Stack } from "@vitalos/ui";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { PageBand, PageHeader } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import { LabList } from "./LabList";
import type { LabTypeData } from "./load";
import { labTypeLabel } from "./map";

/** One Labs category. The heading is the locked type label (Stage 8 §15). */
export function LabTypePage({ data }: Readonly<{ data: LabTypeData }>) {
  const { type, assets } = data;
  const label = labTypeLabel(type);
  return (
    <PageMain>
      <PageBand>
        <Stack gap={8}>
          <Breadcrumbs
            trail={[
              homeCrumb,
              { name: navLabels.labs, path: routes.labs() },
              { name: label, path: routes.labType(type) },
            ]}
          />
          <PageHeader title={label} />
          <LabList id="lab-type-list" assets={assets} />
        </Stack>
      </PageBand>
    </PageMain>
  );
}
