// s2-arc7 (Refs #219) — shared mount helper for the migrated Zone 3
// suites: TieredReference with jurisdiction-only inputs (the audit
// group off), the shape the pre-generation zone renders.

import { render } from "@testing-library/react";
import { TieredReference } from "./TieredReference";
import { PINNED_SHOULDER } from "./test-fixtures";
import type {
  JurisdictionBlock,
  StreetClass,
  WorkScheduleInput,
} from "@/lib/jurisdiction";

export function mountTiered(
  jurisdiction: JurisdictionBlock | null,
  schedule: WorkScheduleInput | null = null,
  streetClass: StreetClass | null = "arterial",
) {
  return render(
    <TieredReference
      jurisdiction={jurisdiction}
      jurisdictionLoading={false}
      streetClass={streetClass}
      schedule={schedule}
      scenario={PINNED_SHOULDER}
      audit={{ state: "loading", lastReady: null }}
      onRetry={() => {}}
      generated={false}
      showAudit={false}
      breakdown={{ state: "loading" }}
    />,
  );
}
