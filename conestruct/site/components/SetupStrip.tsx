"use client";

// Generator restage (Endeavor A) — Zone 1's slim post-generation
// presentation.  One cell per scenario fact.  The edit split is the
// design's contract (4-states §"Zone 1 strip edit split"):
//   * SIMPLE values (speed, lane width, work-zone length, date, hours)
//     edit inline and recompute immediately — the shell already
//     refetches breakdown + audit on every scenario change.
//   * STRUCTURAL values (scenario kind, road type, location) reopen the
//     full setup panel — they gate which form renders.
// Presentation only: every edit writes the same Scenario fields the
// full panel writes; no new state shape, no new requests.

import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { SCENARIO_KINDS, type RoadType, type Scenario } from "@/lib/scenarios";
import type { SiteScanProvenance } from "@/lib/render-types";
import {
  hhmm,
  JURISDICTION_OPTIONS,
  type JurisdictionBlock,
  type StreetClass,
} from "@/lib/jurisdiction";

const STREET_CLASS_LABEL: Record<StreetClass, string> = {
  local: "Local",
  collector: "Collector",
  arterial: "Arterial",
};

const STREET_CLASSES: StreetClass[] = ["local", "collector", "arterial"];

const ROAD_TYPE_LABELS: Record<RoadType, string> = {
  rural_undivided: "Rural — undivided",
  rural_divided: "Rural — divided",
  urban_arterial: "Urban arterial",
  freeway: "Freeway / interstate",
};

// Per-kind posted-speed ceiling — mirrors the full panel's slider
// bounds (ShoulderForm 25–75, FlaggerForm 25–55).  The strip must not
// offer a speed the panel itself refuses.
const SPEED_MAX: Partial<Record<Scenario["kind"], number>> = {
  shoulder: 75,
  flagger_lane_closure: 55,
};

const HALF_HOURS = Array.from({ length: 48 }, (_, i) => i * 0.5);

// #193: Simple/Structural live at module level ON PURPOSE.  As inner
// components they were re-created every render, so React remounted
// every cell on every keystroke — which detached the focused node
// (masked by autoFocus refiring) and made any focus restore target a
// dead button.  Stable identity keeps cells (and the caret) alive
// across scenario writes.
function Simple({
  id,
  k,
  val,
  edit,
  open,
  cellRefs,
  children,
}: {
  id: string;
  k: string;
  val: ReactNode;
  edit: string | null;
  open: (id: string) => void;
  cellRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  children: ReactNode;
}) {
  return edit === id ? (
    <div className="sv-editor">{children}</div>
  ) : (
    <button
      type="button"
      ref={(el) => {
        cellRefs.current[id] = el;
      }}
      className="sv"
      onClick={() => open(id)}
      aria-label={`Edit ${k}`}
    >
      <span className="k">{k}</span>
      <span className="val">{val}</span>
      <span className="edit-ic" aria-hidden>
        ✎
      </span>
    </button>
  );
}

function Structural({
  k,
  val,
  onReopen,
}: {
  k: string;
  val: ReactNode;
  onReopen: () => void;
}) {
  return (
    <button
      type="button"
      className="sv structural"
      onClick={onReopen}
      title="Reopen full setup to change"
      aria-label={`${k} — reopen full setup to change`}
    >
      <span className="k">{k}</span>
      <span className="val">{val}</span>
      <span className="edit-ic" aria-hidden>
        ⤢
      </span>
    </button>
  );
}

function kindLabel(kind: Scenario["kind"]): string {
  return SCENARIO_KINDS.find((k) => k.v === kind)?.l ?? kind;
}

function fmtWorkDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface Props {
  scenario: Scenario;
  setScenario: (next: Scenario) => void;
  onReopen: () => void;
  /**
   * #224 phase 2 — the settled audit's ``sections.site_scan`` for the
   * input on screen (the STAMPED view: null while a refetch is in
   * flight, so a prior input's disclosure never renders as current).
   * The panel prints the NOT-CHECKED disclosure for a proceed-anyway
   * plan as a #227 system event; every other scan state prints nothing.
   */
  siteScan?: SiteScanProvenance | null;
  // Surface B (#152): a late jurisdiction / street-class change is a
  // real estimator move, so the post-generate strip edits them inline —
  // the Speed-edit treatment.  The evaluated block (when loaded) names
  // the jurisdiction; the setters write the same scenario fields the
  // full panel does.
  jurisdiction?: JurisdictionBlock | null;
  setJurisdictionKey?: (k: string | null) => void;
  setStreetClass?: (c: StreetClass) => void;
}

export function SetupStrip({
  scenario,
  setScenario,
  onReopen,
  siteScan = null,
  jurisdiction = null,
  setJurisdictionKey,
  setStreetClass,
}: Props) {
  const [edit, setEdit] = useState<string | null>(null);
  // #193: closing an editor unmounts the focused control (autoFocus
  // handled the way IN; nothing handled the way out — focus fell to
  // <body> on every inline edit).  Remember which cell opened the
  // editor and put focus back on its button once it remounts.
  const cellRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const restoreRef = useRef<string | null>(null);
  const done = () => {
    restoreRef.current = edit;
    setEdit(null);
  };
  useEffect(() => {
    if (edit !== null || restoreRef.current === null) return;
    const id = restoreRef.current;
    restoreRef.current = null;
    // Restore only when the close actually dropped focus (change/blur
    // to nowhere) — a user who tabbed or clicked onto another control
    // moved focus deliberately, and yanking it back would be its own
    // focus bug.
    const active = document.activeElement;
    if (!active || active === document.body) cellRefs.current[id]?.focus();
  }, [edit]);

  const schedule = scenario.schedule ?? null;
  const dateLabel =
    schedule && schedule.date_mode !== "tbd" && schedule.work_date
      ? fmtWorkDate(schedule.work_date)
      : "TBD";
  const hoursLabel =
    schedule &&
    schedule.date_mode !== "tbd" &&
    schedule.start_time != null &&
    schedule.end_time != null
      ? `${hhmm(schedule.start_time)}–${hhmm(schedule.end_time)}${
          schedule.end_time < schedule.start_time ? " (+1 day)" : ""
        }`
      : "—";

  const setSchedule = (
    patch: Partial<NonNullable<Scenario["schedule"]>>,
  ): void => {
    setScenario({
      ...scenario,
      schedule: { date_mode: "single", ...(schedule ?? {}), ...patch },
    } as Scenario);
  };

  const roadType =
    "roadType" in scenario ? (scenario.roadType as RoadType) : null;

  const jurisdictionKey = scenario.jurisdiction_key ?? null;
  const jurisdictionLabel = jurisdictionKey
    ? (jurisdiction?.name ??
      JURISDICTION_OPTIONS.find((o) => o.key === jurisdictionKey)?.label ??
      jurisdictionKey)
    : "None";
  const streetClass = scenario.street_class ?? null;
  const classLabelText = streetClass
    ? STREET_CLASS_LABEL[streetClass]
    : "Not set";
  const speedMax = SPEED_MAX[scenario.kind] ?? 75;
  const speeds: number[] = [];
  for (let s = 25; s <= speedMax; s += 5) speeds.push(s);

  // #224 phase 2 (rule 10): the disclosure is loud — the #227 system-
  // event container above the fact strip, ⚠ + words, the backend string
  // as ONE text node (one voice), provenance on line 2.  Only for a
  // proceed-anyway plan (status unavailable + proceeded_anyway + the
  // string itself).
  const notChecked =
    siteScan &&
    siteScan.status === "unavailable" &&
    siteScan.proceeded_anyway === true &&
    typeof siteScan.disclosure === "string"
      ? siteScan
      : null;
  return (
    <>
      {notChecked && (
        <div className="sys-event warn site-not-checked mb-3">
          <div className="tr-section mb-1.5">Site conditions</div>
          <div className="flex items-start gap-2">
            <span className="sys-glyph" aria-hidden="true">
              ⚠
            </span>
            <span>{notChecked.disclosure}</span>
          </div>
          <div className="tr-prov mt-1.5">
            {[
              "site scan",
              notChecked.error ?? null,
              notChecked.measured_at ? `attempted ${notChecked.measured_at}` : null,
              "re-generate to retry",
            ]
              .filter((p): p is string => p !== null)
              .join(" · ")}
          </div>
        </div>
      )}
    <div className="setup-strip">
      <Structural
        k="Scenario"
        val={kindLabel(scenario.kind)}
        onReopen={onReopen}
      />
      {roadType && (
        <Structural
          k="Road"
          val={ROAD_TYPE_LABELS[roadType]}
          onReopen={onReopen}
        />
      )}

      {setJurisdictionKey && (
        <Simple
          id="jurisdiction"
          k="Jurisdiction"
          val={jurisdictionLabel}
          edit={edit}
          open={setEdit}
          cellRefs={cellRefs}
        >
          <label className="k" htmlFor="strip-jurisdiction">
            Jurisdiction
          </label>
          <select
            id="strip-jurisdiction"
            autoFocus
            value={jurisdictionKey ?? ""}
            onChange={(e) => {
              setJurisdictionKey(e.target.value || null);
              done();
            }}
            onBlur={done}
          >
            <option value="">None — baseline</option>
            {JURISDICTION_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </Simple>
      )}

      {setStreetClass && (
        <Simple
          id="class"
          k="Class"
          val={classLabelText}
          edit={edit}
          open={setEdit}
          cellRefs={cellRefs}
        >
          <span className="k">Street class</span>
          <div
            role="group"
            aria-label="Street classification"
            className="classpick"
          >
            {STREET_CLASSES.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={streetClass === v}
                onClick={() => {
                  setStreetClass(v);
                  done();
                }}
                className={streetClass === v ? "on" : ""}
              >
                {STREET_CLASS_LABEL[v]}
              </button>
            ))}
          </div>
        </Simple>
      )}

      <Simple
        id="speed"
        k="Speed"
        val={`${scenario.speed} mph`}
        edit={edit}
        open={setEdit}
        cellRefs={cellRefs}
      >
        <label className="k" htmlFor="strip-speed">
          Speed
        </label>
        <select
          id="strip-speed"
          autoFocus
          value={scenario.speed}
          onChange={(e) => {
            setScenario({ ...scenario, speed: +e.target.value } as Scenario);
            done();
          }}
          onBlur={done}
        >
          {speeds.map((s) => (
            <option key={s} value={s}>
              {s} mph
            </option>
          ))}
        </select>
      </Simple>

      {"laneWidth" in scenario && (
        <Simple
          id="width"
          k="Lane W"
          val={`${scenario.laneWidth} ft`}
          edit={edit}
          open={setEdit}
          cellRefs={cellRefs}
        >
          <label className="k" htmlFor="strip-width">
            Lane width
          </label>
          <select
            id="strip-width"
            autoFocus
            value={scenario.laneWidth}
            onChange={(e) => {
              setScenario({
                ...scenario,
                laneWidth: +e.target.value,
              } as Scenario);
              done();
            }}
            onBlur={done}
          >
            {[9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14].map((w) => (
              <option key={w} value={w}>
                {w} ft
              </option>
            ))}
          </select>
        </Simple>
      )}

      <Simple
        id="work"
        k="Work zone"
        val={`${scenario.workLen.toLocaleString("en-US")} ft`}
        edit={edit}
        open={setEdit}
        cellRefs={cellRefs}
      >
        <label className="k" htmlFor="strip-worklen">
          Work zone (ft)
        </label>
        <input
          id="strip-worklen"
          autoFocus
          type="number"
          step={10}
          min={0}
          value={scenario.workLen || ""}
          style={{ width: 90 }}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            setScenario({
              ...scenario,
              workLen: Number.isFinite(n) ? n : 0,
            } as Scenario);
          }}
          onBlur={done}
        />
      </Simple>

      <Simple
        id="date"
        k="Date"
        val={dateLabel}
        edit={edit}
        open={setEdit}
        cellRefs={cellRefs}
      >
        <label className="k" htmlFor="strip-date">
          Work date
        </label>
        <input
          id="strip-date"
          autoFocus
          type="date"
          value={
            schedule?.date_mode !== "tbd" ? (schedule?.work_date ?? "") : ""
          }
          onChange={(e) =>
            setSchedule({ date_mode: "single", work_date: e.target.value })
          }
          onBlur={done}
        />
      </Simple>

      <Simple
        id="hours"
        k="Hours"
        val={hoursLabel}
        edit={edit}
        open={setEdit}
        cellRefs={cellRefs}
      >
        <label className="k" htmlFor="strip-start">
          Hours
        </label>
        {/* The selects display exactly what the scenario holds — the old
            7:00/15:30 placeholder values were never written, so the strip
            showed a schedule the payload didn't carry (#188 defect 3). */}
        <select
          id="strip-start"
          autoFocus
          value={schedule?.start_time ?? ""}
          onChange={(e) => {
            const v = e.target.value === "" ? undefined : +e.target.value;
            setSchedule(
              v != null && schedule?.end_time === v
                ? { start_time: v, end_time: undefined }
                : { start_time: v },
            );
          }}
        >
          <option value="">—</option>
          {HALF_HOURS.map((h) => (
            <option key={h} value={h}>
              {hhmm(h)}
            </option>
          ))}
        </select>
        <span aria-hidden>–</span>
        <select
          aria-label="End time"
          value={schedule?.end_time ?? ""}
          onChange={(e) => {
            setSchedule({
              end_time: e.target.value === "" ? undefined : +e.target.value,
            });
            done();
          }}
          onBlur={done}
        >
          <option value="">—</option>
          {/* end < start wraps past midnight (#188); only end == start is
              excluded (ambiguous, rejected at the wire). */}
          {HALF_HOURS.filter((h) => h !== schedule?.start_time).map((h) => (
            <option key={h} value={h}>
              {schedule?.start_time != null && h < schedule.start_time
                ? `${hhmm(h)} (next day)`
                : hhmm(h)}
            </option>
          ))}
        </select>
      </Simple>

      <button type="button" className="strip-edit-all" onClick={onReopen}>
        Edit full setup <span aria-hidden>⤢</span>
      </button>
    </div>
    </>
  );
}
