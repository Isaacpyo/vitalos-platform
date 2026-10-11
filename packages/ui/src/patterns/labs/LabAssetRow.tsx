import { EditorialRow, type RowBaseProps } from "../_internal/EditorialRow";
import { MaturityBadge, type MaturityKey } from "./MaturityBadge";

/** Matches LabAssetSummary plus `href`. */
export interface LabAssetRowProps extends RowBaseProps {
  maturity: MaturityKey;
  /** Maturity in words (required, see MaturityBadge). */
  maturityLabel: string;
}

/**
 * Lab asset row: type (`eyebrow`), title, maturity badge directly under it, technical summary.
 * Maturity sits next to the title so it is seen before anything else.
 */
export function LabAssetRow({ maturity, maturityLabel, ...row }: LabAssetRowProps) {
  return (
    <EditorialRow
      kind="lab"
      lead={<MaturityBadge maturity={maturity} label={maturityLabel} />}
      {...row}
    />
  );
}
