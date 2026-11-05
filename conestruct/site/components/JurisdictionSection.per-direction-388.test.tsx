// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mountJurisdiction, openRow, openSection, rowOf } from "./reference-test-utils";
import type { AppliedDelta, JurisdictionBlock } from "@/lib/jurisdiction";
import demo from "./__fixtures__/jurisdiction-demo.json";

// #388 R5: the changed-rule row shows the count the backend worked out for
// this plan (Thornton stipulation 6: two signs per direction of travel
// affected), never the record's missing qty read as 1 (Rule 3).  #443 moved
// the number into the row's detail.  Rendered output, Rule 11.

const stipulation6 = (qty?: number): AppliedDelta =>
  ({
    rule: "Two signs per direction of travel affected.",
    source: { doc: "Thornton permit", status: "verified" },
    severity: "count",
    status: "fires",
    raised: true,
    effect: { op: "add_device", device: "advance_sign", qty_per_direction: 2 },
    ...(qty === undefined ? {} : { qty }),
  }) as unknown as AppliedDelta;

const mountWith = (d: AppliedDelta) => {
  const thornton = (demo as { jurisdictions: Record<string, unknown> }).jurisdictions.thornton as JurisdictionBlock;
  return mountJurisdiction({ ...thornton, applied_deltas: [d] });
};

afterEach(cleanup);

describe("#388 R5: the plan's count, from the backend", () => {
  it("shows the backend's per-plan qty", async () => {
    const user = userEvent.setup();
    mountWith(stipulation6(4));
    await openSection(user, "reference");
    const row = rowOf("reference", rowTitle())!;
    await openRow(user, row);
    expect(within(row).getByText("+4 devices")).toBeTruthy();
  });

  it("shows no number when the plan's count is absent (Rule 10)", async () => {
    const user = userEvent.setup();
    mountWith(stipulation6());
    await openSection(user, "reference");
    const row = rowOf("reference", rowTitle())!;
    await openRow(user, row);
    expect(within(row).getByText("— per direction")).toBeTruthy();
    expect(row.textContent).not.toMatch(/\+\d/);
  });
});

/** The row's title is `deltaTitle`'s; read it from the one changed row drawn. */
function rowTitle(): string {
  const title = document.querySelector("[data-row=delta-0] .rr-title")!.textContent!;
  return title.replace(/:$/, "");
}
