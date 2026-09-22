"use client";

// #289 Phase 2 — the NOT-CHECKED disclosure, moved out of the setup
// strip and into the results stack.
//
// §8.27 deletes the strip (#262 closes by deletion).  This block was the
// one thing on it that was not an editor: a disclosure about the SCAN,
// not a correction of it, printed when a plan was generated with the
// scan unavailable and the operator pressed "Generate anyway".
//
// It belongs with the answer it qualifies.  The strip sat above the
// results and so did this; now the results stack holds it, beside the
// refusal container that handles the other half of the same story (a
// scan that refused, rather than one that was proceeded past).
//
// UNCHANGED, and the parts that matter are the ones that look like
// formatting: the `.sys-event` container is #227's (amber rule, ⚠ glyph,
// provenance on line 2); the backend's `disclosure` renders as ONE text
// node, which is #198's discipline and what keeps it greppable; and the
// stamp is `fmtScanStamp`'s slice with the full ISO on the `<time>`,
// the same formatter the block footer and the refusal container use
// (#258, P11/P12 — one formatter, never a second clock).

import type { SiteScanProvenance } from "@/lib/render-types";
import { fmtScanStamp } from "@/lib/scenarios/site-corrections";

export function SiteNotChecked({
  siteScan,
}: {
  /** #224 phase 2: the STAMPED view — null while a refetch is in
   *  flight, so a prior input's disclosure never renders as current. */
  siteScan: SiteScanProvenance | null;
}) {
  // #224 phase 2 (rule 10): the disclosure is loud — the #227 system-
  // event container, ⚠ + words, the backend string as ONE text node
  // (one voice), provenance on line 2.  Only for a proceed-anyway plan
  // (status unavailable + proceeded_anyway + the string itself).
  const notChecked =
    siteScan &&
    siteScan.status === "unavailable" &&
    siteScan.proceeded_anyway === true &&
    typeof siteScan.disclosure === "string"
      ? siteScan
      : null;
  if (!notChecked) return null;
  return (
    <div className="sys-event warn site-not-checked mb-3">
      <div className="tr-section mb-1.5">Site conditions</div>
      <div className="flex items-start gap-2">
        <span className="sys-glyph" aria-hidden="true">
          ⚠
        </span>
        <span>{notChecked.disclosure}</span>
      </div>
      {/* #258 (P11/P12): the same sliced stamp as the block footer
          and the refusal container — one formatter; ISO on <time>. */}
      <div className="tr-prov mt-1.5">
        site scan
        {notChecked.error ? ` · ${notChecked.error}` : ""}
        {notChecked.measured_at ? (
          <>
            {" · attempted "}
            <time dateTime={notChecked.measured_at} title={notChecked.measured_at}>
              {fmtScanStamp(notChecked.measured_at)}
            </time>
          </>
        ) : null}
        {" · re-generate to retry"}
      </div>
    </div>
  );
}
