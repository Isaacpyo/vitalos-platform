import type { LabAssetSummary } from "@vitalos/cms";
import { LabAssetRow } from "@vitalos/ui";
import { ListFilter } from "../institutional/list-filter";
import { rowFilterAttributes } from "../institutional/list-filter-model";
import { labFilterDimensions, labFilterGroups, labRowProps } from "./map";

/** A crawlable list of lab assets with a client-side maturity filter (hides rows, never changes the URL). */
export function LabList({
  id,
  assets,
}: Readonly<{ id: string; assets: readonly LabAssetSummary[] }>) {
  const groups = labFilterGroups(assets);
  return (
    <>
      <ListFilter listId={id} groups={groups} total={assets.length} />
      <ul id={id} className="m-0 list-none p-0">
        {assets.map((asset) => (
          <li key={asset.id} {...rowFilterAttributes(asset, labFilterDimensions, groups)}>
            <LabAssetRow {...labRowProps(asset)} headingLevel={2} />
          </li>
        ))}
      </ul>
    </>
  );
}
