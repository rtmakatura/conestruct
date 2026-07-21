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

import { useState, type ReactNode } from "react";
import { SCENARIO_KINDS, type RoadType, type Scenario } from "@/lib/scenarios";
import { hhmm } from "@/lib/jurisdiction";

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
}

export function SetupStrip({ scenario, setScenario, onReopen }: Props) {
  const [edit, setEdit] = useState<string | null>(null);
  const done = () => setEdit(null);

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
      ? `${hhmm(schedule.start_time)}–${hhmm(schedule.end_time)}`
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
  const speedMax = SPEED_MAX[scenario.kind] ?? 75;
  const speeds: number[] = [];
  for (let s = 25; s <= speedMax; s += 5) speeds.push(s);

  const Simple = ({
    id,
    k,
    val,
    children,
  }: {
    id: string;
    k: string;
    val: ReactNode;
    children: ReactNode;
  }) =>
    edit === id ? (
      <div className="sv-editor">{children}</div>
    ) : (
      <button
        type="button"
        className="sv"
        onClick={() => setEdit(id)}
        aria-label={`Edit ${k}`}
      >
        <span className="k">{k}</span>
        <span className="val">{val}</span>
        <span className="edit-ic" aria-hidden>
          ✎
        </span>
      </button>
    );

  const Structural = ({ k, val }: { k: string; val: ReactNode }) => (
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

  return (
    <div className="setup-strip">
      <Structural k="Scenario" val={kindLabel(scenario.kind)} />
      {roadType && <Structural k="Road" val={ROAD_TYPE_LABELS[roadType]} />}

      <Simple id="speed" k="Speed" val={`${scenario.speed} mph`}>
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
        <Simple id="width" k="Lane W" val={`${scenario.laneWidth} ft`}>
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

      <Simple id="date" k="Date" val={dateLabel}>
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

      <Simple id="hours" k="Hours" val={hoursLabel}>
        <label className="k" htmlFor="strip-start">
          Hours
        </label>
        <select
          id="strip-start"
          autoFocus
          value={schedule?.start_time ?? 7}
          onChange={(e) => setSchedule({ start_time: +e.target.value })}
        >
          {HALF_HOURS.map((h) => (
            <option key={h} value={h}>
              {hhmm(h)}
            </option>
          ))}
        </select>
        <span aria-hidden>–</span>
        <select
          aria-label="End time"
          value={schedule?.end_time ?? 15.5}
          onChange={(e) => {
            setSchedule({ end_time: +e.target.value });
            done();
          }}
          onBlur={done}
        >
          {HALF_HOURS.filter((h) => h > (schedule?.start_time ?? 0)).map(
            (h) => (
              <option key={h} value={h}>
                {hhmm(h)}
              </option>
            ),
          )}
        </select>
      </Simple>

      <button type="button" className="strip-edit-all" onClick={onReopen}>
        Edit full setup <span aria-hidden>⤢</span>
      </button>
    </div>
  );
}
