"use client";

// s2-arc7 (Refs #219) — Zone 3's triage-by-consequence restructure.
//
// The flat family stack (6–8 peer-ranked chips) becomes an always-on
// ledger line plus five consequence tiers; every fact renders in the
// tier its ALREADY-COMPUTED wire status implies (lib/tiering.ts — the
// ruled mapping, pure derivation, rule 3).  Row bodies are the existing
// renderers, exported from JurisdictionSection/AuditTrail and reused
// byte-preserved; family identity moves into row provenance.
//
//   ▲ CHANGED THIS PLAN   auto-open when non-empty
//   ⚠ NEEDS ATTENTION     auto-open when non-empty (hosts the audit
//                          declined/failed banners — #180 one-voice and
//                          the rule-10 visible-Retry contract)
//   ✓ CHECKED & PASSED    collapsed; every check named; formula cards
//                          one click in; hosts the Audit-PDF download
//   ◌ PENDING             collapsed, its own tier, never buried
//   i REFERENCE           collapsed; permit, hours windows, standing
//                          hazard meters, device table (uncounted —
//                          the ledger's reference token is unnumbered)
//
// Deliberate behavior deltas vs the retired stack (rule 5, enumerated
// at the arc checkpoint): additive audit rows now persist through a
// refetch under the "(refreshing…)" cue (the #187 loading-only
// fallback) instead of vanishing; the corridor checked-and-clean state
// renders as a named pass (ruled flag h).

import { useState, type ReactNode } from "react";
import { ReferenceChip } from "./ReferenceChip";
import {
  DeltaRowView,
  FactRows,
  HazardChip,
  HoursVerdictBlock,
  PermitFYI,
  ProvisionalBadge,
  WorkHoursCard,
} from "./JurisdictionSection";
import {
  AuditItem,
  CheckRow,
  SITE_ADJUSTMENT_DETAIL,
  auditFilename,
  approachesItem,
  buildScenarioItems,
  corridorValidationItem,
  finesDoubleItem,
  geometryValidationItem,
  pendingVerificationItem,
  settledData,
  siteAdjustmentsItem,
  type ItemSpec,
} from "./AuditTrail";
import { DeviceBreakdown, type DeviceBreakdownState } from "./DeviceBreakdown";
import { assignTiers, ledgerLine } from "@/lib/tiering";
import type {
  JurisdictionBlock,
  StreetClass,
  WorkScheduleInput,
} from "@/lib/jurisdiction";
import type { Scenario, SiteConditionFlag } from "@/lib/scenarios";
import type { AuditState, SiteAdjustmentRecord } from "@/lib/render-types";

interface Props {
  jurisdiction: JurisdictionBlock | null;
  jurisdictionLoading: boolean;
  /** #152 D: same-jurisdiction refetch in flight — content stays
   *  mounted; verdict surfaces (and the ledger, which is derived from
   *  verdicts) present as checking, never as current. */
  revalidating?: boolean;
  streetClass: StreetClass | null;
  schedule: WorkScheduleInput | null;
  scenario: Scenario;
  audit: AuditState;
  onRetry: () => void;
  /** When false (bundle generation), value fields render "—". */
  generated: boolean;
  /** Whether the verification facts render at all — Zone 3 shows the
   *  audit group post-generation and on an audit error (the strip's
   *  "retry below" must always land on a panel that exists, rule 10). */
  showAudit: boolean;
  breakdown: DeviceBreakdownState;
}

/** Small single-open accordion over ItemSpec lists (the retired
 *  audit-list loop, per tier). */
function ItemAccordion({ items, startNum }: { items: ItemSpec[]; startNum?: number }) {
  const [openIdx, setOpenIdx] = useState<number>(-1);
  if (items.length === 0) return null;
  return (
    <div className="audit-list">
      {items.map((item, i) => (
        <AuditItem
          key={item.title}
          num={String((startNum ?? 1) + i).padStart(2, "0")}
          title={item.title}
          result={item.result}
          cite={item.cite}
          open={openIdx === i}
          onClick={() => setOpenIdx(openIdx === i ? -1 : i)}
          dim={item.dim}
        >
          {item.body}
        </AuditItem>
      ))}
    </div>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return <div className="ref-group-label mt-3 first:mt-0">{children}</div>;
}

export function TieredReference({
  jurisdiction,
  jurisdictionLoading,
  revalidating = false,
  streetClass,
  schedule,
  scenario,
  audit,
  onRetry,
  generated,
  showAudit,
  breakdown,
}: Props) {
  const r = (n: number | string) => (generated ? String(n) : "—");

  // Audit-PDF export — unchanged from the retired panel: POSTs the live
  // scenario to the public render route; disabled while the audit for
  // this input failed or was declined.
  const [auditDl, setAuditDl] = useState<"idle" | "busy" | "error">("idle");
  const onDownloadAuditPdf = async () => {
    if (!generated || audit.state === "error" || auditDl === "busy") return;
    setAuditDl("busy");
    try {
      const res = await fetch("/api/render/audit-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      if (!res.ok) {
        setAuditDl("error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = auditFilename(scenario.meta?.project);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setAuditDl("idle");
    } catch {
      setAuditDl("error");
    }
  };

  const jur = jurisdictionLoading ? null : jurisdiction;
  const settled = showAudit ? settledData(audit) : null;
  const auditFailed = showAudit && audit.state === "error";
  const declined = auditFailed && audit.httpStatus === 400;
  const throttled = auditFailed && audit.httpStatus === 429;
  const isRefreshing = audit.state === "loading" && audit.lastReady !== null;
  const isFirstLoad = showAudit && audit.state === "loading" && audit.lastReady === null;

  const model = assignTiers({ jurisdiction: jur, audit: settled, auditFailed });

  // ── fact groups (same predicates as lib/tiering.ts — single mapping) ──
  const deltas = jur?.applied_deltas ?? [];
  const deltasChanged = deltas.filter(
    (d) => d.status === "fires" && d.severity !== "admin",
  );
  const deltasAttention = deltas.filter(
    (d) => d.status === "conditional" || d.status === "unknown",
  );
  const deltasAdmin = deltas.filter(
    (d) => d.status === "fires" && d.severity === "admin",
  );

  const siteRecords: SiteAdjustmentRecord[] = settled?.sections.site_adjustments ?? [];
  const siteChanged = siteRecords.filter(
    (rec) => rec.devices_added > 0 || (rec.devices_modified ?? 0) > 0,
  );
  const siteAdvisory = siteRecords.filter(
    (rec) => rec.devices_added === 0 && (rec.devices_modified ?? 0) === 0,
  );
  const siteRow = (rec: SiteAdjustmentRecord) => {
    const detail = SITE_ADJUSTMENT_DETAIL[rec.flag as SiteConditionFlag];
    return (
      <CheckRow
        key={rec.flag}
        label={detail?.label ?? rec.flag}
        detail={detail?.action ?? rec.action}
        tone="pass"
        tag={rec.citation}
      />
    );
  };
  // Deploy-window fallback: no backend records → the legacy aggregate
  // item renders (uncounted, matching the classifier's view of the wire).
  const legacySiteItem =
    settled && siteRecords.length === 0
      ? siteAdjustmentsItem(scenario.meta.siteConditions, undefined)
      : null;

  const colorado = settled?.sections.colorado as
    | {
        checks?: { pass: boolean; label: string; citation: string; detail: string }[];
        info_items?: { label: string; citation: string; detail: string }[];
      }
    | undefined;
  const coloradoPasses = (colorado?.checks ?? []).filter((c) => c.pass);
  const coloradoFails = (colorado?.checks ?? []).filter((c) => !c.pass);
  const coloradoInfos = colorado?.info_items ?? [];

  const corridorSection = settled?.sections.corridor_validation as
    | { checked?: boolean; warnings?: unknown[] }
    | undefined;
  const corridorItem = settled ? corridorValidationItem(settled.sections.corridor_validation) : null;
  const corridorClean =
    corridorSection?.checked === true && (corridorSection.warnings ?? []).length === 0;

  const geometryItem = settled ? geometryValidationItem(settled.sections.geometry_validation) : null;

  const finesSection = settled?.sections.fines_double;
  const finesItem = finesSection ? finesDoubleItem(finesSection) : null;
  const finesApplicable = finesSection?.applicable === true;

  const approachesSpec = settled ? approachesItem(settled.sections.approaches) : null;
  const approachesSection = settled?.sections.approaches as
    | { approaches?: { signalized?: boolean }[] }
    | undefined;
  const approachesSignalized = (approachesSection?.approaches ?? []).some(
    (a) => a.signalized === true,
  );

  const pendingSpec = settled ? pendingVerificationItem(settled.pending_verification) : null;

  // Trace items: the per-kind set minus the Colorado aggregate (its
  // checks render as named rows so "every check named at a glance"
  // holds — the aggregate accordion would hide them behind a click).
  const traceItems = settled
    ? buildScenarioItems(scenario, audit, generated, r).filter(
        (i) => !i.title.startsWith("Colorado requirements"),
      )
    : auditFailed
      ? buildScenarioItems(scenario, audit, generated, r).filter(
          (i) => !i.title.startsWith("Colorado requirements"),
        )
      : [];

  const hoursStatus = jur ? jur.hours_eval.status : null;

  // ── ledger ──
  const ledger = revalidating ? (
    <>
      ◌ checking against the updated inputs…
    </>
  ) : isFirstLoad ? (
    <>computing…</>
  ) : (
    <>
      <b>{ledgerLine(model.ledger)}</b>
      {isRefreshing && (
        <span className="normal-case tracking-normal"> (refreshing…)</span>
      )}
    </>
  );

  // ── tier bodies ──
  const changedBody: ReactNode[] = [];
  if (deltasChanged.length > 0) {
    changedBody.push(
      <div key="deltas">
        <GroupLabel>{jur?.name} deltas — fired</GroupLabel>
        {deltasChanged.map((d) => (
          <DeltaRowView key={d.rule} d={d} />
        ))}
      </div>,
    );
  }
  if (siteChanged.length > 0) {
    changedBody.push(
      <div key="site">
        <GroupLabel>Site adjustments — devices added or moved</GroupLabel>
        <div className="check-list">{siteChanged.map(siteRow)}</div>
      </div>,
    );
  }
  if (finesItem && finesApplicable) {
    changedBody.push(<ItemAccordion key="fines" items={[finesItem]} />);
  }

  const attentionBody: ReactNode[] = [];
  if (auditFailed) {
    attentionBody.push(
      declined ? (
        <div
          key="declined"
          className="flex items-baseline gap-3 mb-4 px-4 py-3 border-l-2 border-[color:var(--fail)] font-mono text-[12px] text-[color:var(--fail)]"
        >
          <span>
            Audit trail unavailable while generation is declined — see the
            notice above.
          </span>
        </div>
      ) : (
        <div
          key="failed"
          className="flex items-baseline gap-3 mb-4 px-4 py-3 border-l-2 border-[color:var(--fail)] font-mono text-[12px] text-[color:var(--fail)]"
        >
          <span>
            {throttled
              ? "Audit trail paused: too many updates in the last minute — retry in a moment."
              : `Audit trail failed: ${audit.state === "error" ? audit.message : ""}`}
          </span>
          <button
            type="button"
            onClick={onRetry}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--act)] hover:underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      ),
    );
  }
  if (jur && hoursStatus === "outside") {
    attentionBody.push(
      <div key="hours">
        <GroupLabel>Work hours — {jur.name}</GroupLabel>
        <HoursVerdictBlock jurisdiction={jur} schedule={schedule} verifying={revalidating} />
      </div>,
    );
  }
  if (deltasAttention.length > 0) {
    attentionBody.push(
      <div key="deltas">
        <GroupLabel>{jur?.name} deltas — conditional / needs input</GroupLabel>
        {deltasAttention.map((d) => (
          <DeltaRowView key={d.rule} d={d} />
        ))}
      </div>,
    );
  }
  if (jur && jur.chips.personnel.length > 0) {
    attentionBody.push(
      <div key="personnel">
        <GroupLabel>Personnel gates — obligations</GroupLabel>
        <FactRows
          chips={jur.chips.personnel}
          icon="◈"
          tone="border-[color:var(--act)]"
          jurName={jur.name}
        />
      </div>,
    );
  }
  if (jur && jur.chips.device.length > 0) {
    attentionBody.push(
      <div key="mandates">
        <GroupLabel>Device mandates — obligations</GroupLabel>
        <FactRows
          chips={jur.chips.device}
          icon="▮"
          tone="border-[color:var(--dim)]"
          jurName={jur.name}
        />
      </div>,
    );
  }
  if (coloradoFails.length > 0) {
    attentionBody.push(
      <div key="colorado" className="check-list">
        {coloradoFails.map((c, i) => (
          <CheckRow key={i} label={c.label} detail={c.detail} tone="fail" tag={c.citation} />
        ))}
      </div>,
    );
  }
  const attentionItems: ItemSpec[] = [
    ...(corridorItem ? [corridorItem] : []),
    ...(geometryItem ? [geometryItem] : []),
    ...(approachesSpec && approachesSignalized ? [approachesSpec] : []),
  ];
  if (attentionItems.length > 0) {
    attentionBody.push(<ItemAccordion key="items" items={attentionItems} />);
  }

  const checkedBody: ReactNode[] = [];
  if (showAudit) {
    checkedBody.push(
      <div key="chrome">
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <div className="font-sans text-[13px] text-[color:var(--ink-on-dark-faint)] max-w-[620px]">
            Every calculation is traced to its MUTCD or CDOT standard-plan
            source. Verify before stamping.
          </div>
          <button
            type="button"
            onClick={onDownloadAuditPdf}
            disabled={!generated || audit.state === "error" || auditDl === "busy"}
            title={
              declined
                ? "Unavailable — generation declined for this input"
                : audit.state === "error"
                  ? "Unavailable — the audit failed; retry first"
                  : undefined
            }
            className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--act)] hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-default cursor-pointer whitespace-nowrap"
          >
            {auditDl === "busy"
              ? "Rendering…"
              : auditDl === "error"
                ? "Try again"
                : "↓ Audit PDF"}
          </button>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--ink-on-dark-faint)] opacity-80 mb-4 max-w-[620px] leading-relaxed">
          Scope: federal MUTCD + CDOT standards (S-630-1). Other jurisdictions
          may impose additional requirements not yet captured.
        </div>
      </div>,
    );
  }
  if (isFirstLoad) {
    checkedBody.push(
      <div
        key="computing"
        className="font-mono text-[12px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] py-6"
      >
        Computing audit trail…
      </div>,
    );
  }
  if (traceItems.length > 0) {
    checkedBody.push(<ItemAccordion key="traces" items={traceItems} />);
  }
  const checkedRows: ReactNode[] = [];
  coloradoPasses.forEach((c, i) =>
    checkedRows.push(
      <CheckRow key={`p${i}`} label={c.label} detail={c.detail} tone="pass" tag={c.citation} />,
    ),
  );
  coloradoInfos.forEach((c, i) =>
    checkedRows.push(
      <CheckRow key={`i${i}`} label={c.label} detail={c.detail} tone="info" tag={c.citation} />,
    ),
  );
  if (corridorClean) {
    checkedRows.push(
      <CheckRow
        key="corridor"
        label="Site corridor validation"
        detail="checked against OSM — no warnings"
        tone="pass"
        tag="OPENSTREETMAP"
      />,
    );
  }
  siteAdvisory.forEach((rec) => checkedRows.push(siteRow(rec)));
  if (checkedRows.length > 0) {
    checkedBody.push(
      <div key="rows" className="check-list mt-2">
        {checkedRows}
      </div>,
    );
  }
  const checkedItems: ItemSpec[] = [
    ...(approachesSpec && !approachesSignalized ? [approachesSpec] : []),
    ...(finesItem && !finesApplicable ? [finesItem] : []),
    ...(legacySiteItem ? [legacySiteItem] : []),
  ];
  if (checkedItems.length > 0) {
    checkedBody.push(<ItemAccordion key="items" items={checkedItems} />);
  }
  if (jur && hoursStatus === "inside") {
    checkedBody.push(
      <div key="hours" className="mt-2">
        <GroupLabel>Work hours — {jur.name}</GroupLabel>
        <HoursVerdictBlock jurisdiction={jur} schedule={schedule} verifying={revalidating} />
      </div>,
    );
  }

  const pendingBody: ReactNode[] = [];
  if (pendingSpec) {
    pendingBody.push(
      <div key="pending" className="opacity-70">
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] mb-2">
          {pendingSpec.result}
        </div>
        {pendingSpec.body}
      </div>,
    );
  }
  if (jur && hoursStatus === "unknown") {
    pendingBody.push(
      <div key="hours" className="mt-2">
        <GroupLabel>Work hours — {jur.name}</GroupLabel>
        <HoursVerdictBlock jurisdiction={jur} schedule={schedule} verifying={revalidating} />
      </div>,
    );
  }

  const referenceBody: ReactNode[] = [];
  if (jur) {
    referenceBody.push(
      <div key="jur" className="ref-stack">
        <HazardChip jurisdiction={jur} />
        {deltasAdmin.length > 0 && (
          <div>
            <GroupLabel>{jur.name} deltas — administrative</GroupLabel>
            {deltasAdmin.map((d) => (
              <DeltaRowView key={d.rule} d={d} />
            ))}
          </div>
        )}
        <WorkHoursCard
          jurisdiction={jur}
          streetClass={streetClass}
          schedule={schedule}
          verifying={revalidating}
        />
        <PermitFYI
          jurisdiction={jur}
          // #199: a residual work_date under "Not set" is disavowed.
          workDate={
            schedule && schedule.date_mode !== "tbd" ? (schedule.work_date ?? null) : null
          }
        />
      </div>,
    );
  }
  if (showAudit) {
    referenceBody.push(
      <div key="devices" className={jur ? "mt-2" : undefined}>
        <DeviceBreakdown state={breakdown} onRetry={onRetry} />
      </div>,
    );
  }

  const breakdownError = breakdown.state === "error";

  return (
    <div aria-label="Plan reference tiers">
      <div className="flex items-baseline justify-between mb-1 pb-3 border-b border-[color:var(--rule)]">
        <h2 className="text-[20px] font-bold tracking-[-0.005em] text-white m-0">
          {jur ? `${jur.name} — jurisdiction rules` : "Plan reference"}
        </h2>
        {jur?.provisional && <ProvisionalBadge label="Contains provisional facts" />}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--ink-on-dark-faint)] mt-0 mb-2">
        informational · sourced corpus · never blocks generation
      </p>
      {jurisdictionLoading && (
        <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-[color:var(--ink-on-dark-faint)] py-2">
          Loading jurisdiction rules…
        </div>
      )}
      {/* The always-on ledger: all four counted tokens render, zeros
          included (ruled flag k); reference stays unnumbered. */}
      <p className="tier-ledger" data-testid="tier-ledger">
        {ledger}
      </p>

      <div className="ref-stack">
        {changedBody.length > 0 && (
          <ReferenceChip
            glyph="▲"
            sev="changed"
            label="Changed this plan"
            summary={<b>{model.ledger.changed}</b>}
            autoExpand={model.ledger.changed > 0}
          >
            {changedBody}
          </ReferenceChip>
        )}
        {attentionBody.length > 0 && (
          <ReferenceChip
            glyph="⚠"
            sev="warn"
            label="Needs attention"
            summary={<b>{model.ledger.attention}</b>}
            autoExpand={model.ledger.attention > 0}
          >
            {attentionBody}
          </ReferenceChip>
        )}
        {checkedBody.length > 0 && (
          <ReferenceChip
            glyph="✓"
            sev="info"
            label="Checked & passed"
            summary={
              <>
                <b>{model.ledger.checked}</b>
                {showAudit && !isFirstLoad && (
                  <>
                    {" "}
                    · <span className="verdict-ok">each cited</span>
                  </>
                )}
              </>
            }
          >
            {checkedBody}
          </ReferenceChip>
        )}
        {pendingBody.length > 0 && (
          <ReferenceChip
            glyph="◌"
            sev="pending"
            label="Pending / not verified"
            summary={<b>{model.ledger.pending}</b>}
          >
            {pendingBody}
          </ReferenceChip>
        )}
        {referenceBody.length > 0 && (
          <ReferenceChip
            glyph="i"
            sev="info"
            label="Reference"
            summary={
              <>
                permit · hours windows · device schedule
                {jur && jur.chips.hazard.length > 0 && <> · hazard meters</>}
              </>
            }
            autoExpand={breakdownError}
          >
            {referenceBody}
          </ReferenceChip>
        )}
      </div>
    </div>
  );
}
