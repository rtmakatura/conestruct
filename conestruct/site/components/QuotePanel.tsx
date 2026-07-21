"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { type QuoteSettings } from "@/lib/quote-settings";
import { expectedFlaggerCount, type Scenario } from "@/lib/scenarios";

// Lifted to GeneratorShell (restage): the pricing card unmounts across
// reopen → regenerate cycles now, so any state guarding a manual edit
// must outlive this component — the #74 clobber class otherwise
// resurfaces (a remount resets "manual" to "auto" and the auto-effects
// re-impose detected values over the user's numbers).
export type DeliveryStatus =
  | { state: "idle" }
  | { state: "resolving" }
  | { state: "auto"; miles: number }
  | { state: "manual" }
  | { state: "error" };

export type FlaggerSource = "auto" | "manual";

interface PublicMode {
  kind: "public";
  scenario: Scenario;
}
interface SavedMode {
  kind: "saved";
  planId: string | null;
}
type Mode = PublicMode | SavedMode;

interface Props {
  mode: Mode;
  // Settings are owned by GeneratorShell (the single source) so the bundle
  // download and this panel read/write the same store. Lifting them up also
  // keeps the user's edits alive across a generate cycle.
  settings: QuoteSettings;
  setSettings: Dispatch<SetStateAction<QuoteSettings>>;
  // Manual-override guards, shell-owned for the same reason (see the
  // type comment above).
  flaggerSource: FlaggerSource;
  setFlaggerSource: Dispatch<SetStateAction<FlaggerSource>>;
  delivery: DeliveryStatus;
  setDelivery: Dispatch<SetStateAction<DeliveryStatus>>;
  // Restage: inside Zone 2's collapsed pricing card the outer card
  // chrome (corner ticks, deliverable eyebrow, panel title) belongs to
  // the card head, so the embedded panel drops its own.
  embedded?: boolean;
  // Reports the last previewed backend total so the collapsed card head
  // can show it.  Null until a preview has run.
  onTotalChange?: (total: number | null) => void;
}

interface EquipmentLine {
  item_number: number;
  device_type: string;
  label: string;
  description: string;
  qty: number;
  unit: string;
  daily_rate: number;
  days: number;
  extended: number;
  note: string;
}
interface LaborLine {
  role: string;
  personnel: number;
  hours_per_day: number;
  days: number;
  rate: number;
  extended: number;
}
interface DeliveryLine {
  item: string;
  trips: number;
  distance_miles: number;
  rate_per_mile: number;
  min_trip_charge: number;
  extended: number;
}
interface Breakdown {
  equipment_lines: EquipmentLine[];
  labor_lines: LaborLine[];
  delivery_lines: DeliveryLine[];
  is_night: boolean;
  night_multiplier: number;
  overhead_pct: number;
  profit_pct: number;
  equipment_total: number;
  labor_total: number;
  delivery_total: number;
  subtotal: number;
  overhead: number;
  profit: number;
  total: number;
}

const SIGNUP_HREF = "/app";

const fmtCurrency = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtTotal = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

// A stored fraction (0.1) shown as a percent (10). Round to 2 decimals so
// 0.1 * 100 doesn't surface its float dust (10.000000000000002) in the input.
const pctToDisplay = (frac: number) => Math.round(frac * 10000) / 100;

function safeFilename(name: string | undefined, ext: string): string {
  const cleaned = (name ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9 _-]+/g, "_")
    .replace(/\s+/g, "_");
  return `${cleaned || "plan"}.${ext}`;
}

export function QuotePanel({
  mode,
  settings,
  setSettings,
  flaggerSource,
  setFlaggerSource,
  delivery,
  setDelivery,
  embedded = false,
  onTotalChange,
}: Props) {
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Latest settings in a ref so the async distance handler can write back to
  // the current settings object instead of a stale closure value.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const lat = mode.kind === "public" ? mode.scenario.meta.lat : 0;
  const lng = mode.kind === "public" ? mode.scenario.meta.lng : 0;

  // Auto-fill the flagger headcount from the layout (only flagger
  // scenarios station flaggers; everything else returns 0).  Skip
  // the sync once the user has typed their own value — the manual
  // override stays in place until they switch scenarios (the kind
  // change resets flaggerSource in GeneratorShell, which owns it).
  const autoFlaggers =
    mode.kind === "public" ? expectedFlaggerCount(mode.scenario) : 0;
  useEffect(() => {
    if (mode.kind !== "public") return;
    if (flaggerSource === "manual") return;
    if (settingsRef.current.num_flaggers === autoFlaggers) return;
    setSettings({ ...settingsRef.current, num_flaggers: autoFlaggers });
    // mode.kind is stable; autoFlaggers/flaggerSource drive the sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFlaggers, flaggerSource]);

  useEffect(() => {
    if (mode.kind !== "public") return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (lat === 0 && lng === 0) return;
    // A manual distance survives a remount (the pricing card unmounts
    // across reopen cycles now) — never auto-overwrite it.
    if (delivery.state === "manual") return;

    const controller = new AbortController();
    setDelivery({ state: "resolving" });
    (async () => {
      try {
        const r = await fetch("/api/distance", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lat, lng }),
          signal: controller.signal,
        });
        if (!r.ok) {
          setDelivery({ state: "error" });
          return;
        }
        const { miles } = (await r.json()) as { miles: number };
        setSettings({
          ...settingsRef.current,
          delivery_distance_miles: miles,
        });
        setDelivery({ state: "auto", miles });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setDelivery({ state: "error" });
      }
    })();
    return () => controller.abort();
    // mode.kind is stable for the panel's lifetime; lat/lng drive re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  const onPreview = async () => {
    if (mode.kind !== "public") return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/render/quote-breakdown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario: mode.scenario, settings }),
      });
      if (!res.ok) {
        setErr(`Preview failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as Breakdown;
      setBreakdown(data);
      onTotalChange?.(data.total);
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async () => {
    if (mode.kind !== "public") return;
    setDownloading(true);
    setErr(null);
    try {
      const res = await fetch("/api/render/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario: mode.scenario, settings }),
      });
      if (!res.ok) {
        setErr(`Render failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = safeFilename(mode.scenario.meta?.project, "xlsx");
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErr("Network error");
    } finally {
      setDownloading(false);
    }
  };

  const body = (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <NumberField
          label="Duration (days)"
          value={settings.project_duration_days}
          min={1}
          max={365}
          step={1}
          onChange={(v) =>
            setSettings({ ...settings, project_duration_days: v })
          }
        />
        <NumberField
          label="Flaggers"
          value={settings.num_flaggers}
          min={0}
          max={20}
          step={1}
          onChange={(v) => {
            setSettings({ ...settings, num_flaggers: v });
            setFlaggerSource("manual");
          }}
          caption={flaggerCaption(flaggerSource, autoFlaggers)}
        />
        <NumberField
          label="Delivery (mi)"
          value={settings.delivery_distance_miles}
          min={0}
          max={500}
          step={5}
          onChange={(v) => {
            setSettings({ ...settings, delivery_distance_miles: v });
            setDelivery({ state: "manual" });
          }}
          caption={deliveryCaption(delivery)}
        />
        <NumberField
          label="Overhead (%)"
          value={pctToDisplay(settings.overhead_pct)}
          min={0}
          max={100}
          step={1}
          onChange={(v) =>
            setSettings({ ...settings, overhead_pct: v / 100 })
          }
        />
        <NumberField
          label="Profit (%)"
          value={pctToDisplay(settings.profit_pct)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => setSettings({ ...settings, profit_pct: v / 100 })}
        />
        <NumberField
          label="Flagger ($/hr)"
          value={settings.flagger_hourly_rate}
          min={0}
          max={500}
          step={1}
          onChange={(v) =>
            setSettings({ ...settings, flagger_hourly_rate: v })
          }
        />
        <NumberField
          label="TCS ($/hr)"
          value={settings.tcs_hourly_rate}
          min={0}
          max={500}
          step={1}
          onChange={(v) => setSettings({ ...settings, tcs_hourly_rate: v })}
        />
        <NumberField
          label="Crew ($/hr)"
          value={settings.crew_hourly_rate}
          min={0}
          max={500}
          step={1}
          onChange={(v) => setSettings({ ...settings, crew_hourly_rate: v })}
        />
      </div>

      {mode.kind === "public" ? (
        <div className="flex flex-col md:flex-row gap-3">
          <button
            type="button"
            onClick={onPreview}
            disabled={busy}
            className="md:flex-1 font-sans font-semibold text-[13px] bg-transparent border border-[color:var(--rule)] text-[color:var(--ink)] px-3 py-3 cursor-pointer flex items-center justify-center gap-2.5 hover:border-[color:var(--act)] hover:text-[color:var(--act)] transition-colors disabled:opacity-60"
          >
            {busy ? "Calculating…" : "Preview breakdown"}
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="md:flex-1 font-sans font-semibold text-[13px] bg-[color:var(--act)] text-[color:var(--on-act)] px-3 py-3 cursor-pointer flex items-center justify-center gap-2.5 hover:bg-[color:var(--act-bright)] transition-colors disabled:opacity-60"
          >
            {downloading ? "Rendering…" : "Download Quote (XLSX)"}
            <span className="font-mono">↓</span>
          </button>
        </div>
      ) : mode.planId ? (
        <a
          href={`/api/plans/${mode.planId}/quote`}
          download
          className="block w-full font-sans font-semibold text-[13px] bg-[color:var(--act)] text-[color:var(--on-act)] px-3 py-3 cursor-pointer flex items-center justify-center gap-2.5 hover:bg-[color:var(--act-bright)] transition-colors"
        >
          Download Quote (XLSX)
          <span className="font-mono">↓</span>
        </a>
      ) : (
        <Link
          href={SIGNUP_HREF}
          className="block w-full font-sans font-semibold text-[13px] bg-[color:var(--act)] text-[color:var(--on-act)] px-3 py-3 cursor-pointer flex items-center justify-center gap-2.5 hover:bg-[color:var(--act-bright)] transition-colors"
        >
          Sign up to download Quote
          <span className="font-mono">↓</span>
        </Link>
      )}

      {err && (
        <div className="mt-3 font-mono text-[11px] text-[color:var(--fail)]">
          {err}
        </div>
      )}

      {breakdown && (
        <div className="mt-7">
          <div className="flex justify-between items-baseline border-t border-b border-dashed border-[color:var(--rule-soft)] py-3 mb-5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)]">
              Total estimate
            </span>
            <span className="font-mono text-[28px] text-[color:var(--dim)] font-semibold">
              {fmtTotal(breakdown.total)}
            </span>
          </div>

          <BreakdownGroup
            title="Equipment Rental"
            subtotal={breakdown.equipment_total}
          >
            <table className="w-full text-[12px]">
              <thead className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)]">
                <tr className="border-b border-dashed border-[color:var(--rule-soft)]">
                  <th className="text-left py-1.5">Device</th>
                  <th className="text-left py-1.5">Label</th>
                  <th className="text-right py-1.5">Qty</th>
                  <th className="text-right py-1.5">Daily</th>
                  <th className="text-right py-1.5">Days</th>
                  <th className="text-right py-1.5">Extended</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.equipment_lines.map((line) => (
                  <tr
                    key={line.item_number}
                    className="border-b border-dotted border-[color:var(--rule-soft)]"
                  >
                    <td className="py-1.5">{line.device_type}</td>
                    <td className="py-1.5">{line.label || "—"}</td>
                    <td className="text-right py-1.5">{line.qty}</td>
                    <td className="text-right py-1.5 font-mono">
                      {fmtCurrency(line.daily_rate)}
                    </td>
                    <td className="text-right py-1.5">{line.days}</td>
                    <td className="text-right py-1.5 font-mono">
                      {fmtCurrency(line.extended)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </BreakdownGroup>

          <BreakdownGroup title="Labor" subtotal={breakdown.labor_total}>
            <table className="w-full text-[12px]">
              <thead className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)]">
                <tr className="border-b border-dashed border-[color:var(--rule-soft)]">
                  <th className="text-left py-1.5">Role</th>
                  <th className="text-right py-1.5">Personnel</th>
                  <th className="text-right py-1.5">Hrs/Day</th>
                  <th className="text-right py-1.5">Days</th>
                  <th className="text-right py-1.5">Rate</th>
                  <th className="text-right py-1.5">Extended</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.labor_lines.map((line) => (
                  <tr
                    key={line.role}
                    className="border-b border-dotted border-[color:var(--rule-soft)]"
                  >
                    <td className="py-1.5">{line.role}</td>
                    <td className="text-right py-1.5">{line.personnel}</td>
                    <td className="text-right py-1.5">{line.hours_per_day}</td>
                    <td className="text-right py-1.5">{line.days}</td>
                    <td className="text-right py-1.5 font-mono">
                      {fmtCurrency(line.rate)}/hr
                    </td>
                    <td className="text-right py-1.5 font-mono">
                      {fmtCurrency(line.extended)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {breakdown.is_night && (
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)] mt-2">
                Night differential applied:{" "}
                {breakdown.night_multiplier.toFixed(1)}x to all labor lines
              </p>
            )}
          </BreakdownGroup>

          <BreakdownGroup
            title="Delivery & Logistics"
            subtotal={breakdown.delivery_total}
          >
            <table className="w-full text-[12px]">
              <thead className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)]">
                <tr className="border-b border-dashed border-[color:var(--rule-soft)]">
                  <th className="text-left py-1.5">Item</th>
                  <th className="text-right py-1.5">Trips</th>
                  <th className="text-right py-1.5">Distance</th>
                  <th className="text-right py-1.5">Rate</th>
                  <th className="text-right py-1.5">Min</th>
                  <th className="text-right py-1.5">Extended</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.delivery_lines.map((line) => (
                  <tr
                    key={line.item}
                    className="border-b border-dotted border-[color:var(--rule-soft)]"
                  >
                    <td className="py-1.5">{line.item}</td>
                    <td className="text-right py-1.5">{line.trips}</td>
                    <td className="text-right py-1.5">
                      {line.distance_miles} mi
                    </td>
                    <td className="text-right py-1.5 font-mono">
                      {fmtCurrency(line.rate_per_mile)}/mi
                    </td>
                    <td className="text-right py-1.5 font-mono">
                      {fmtCurrency(line.min_trip_charge)}
                    </td>
                    <td className="text-right py-1.5 font-mono">
                      {fmtCurrency(line.extended)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </BreakdownGroup>

          <BreakdownGroup
            title={`Markup — overhead ${(breakdown.overhead_pct * 100).toFixed(0)}%, profit ${(breakdown.profit_pct * 100).toFixed(0)}%`}
            subtotal={breakdown.overhead + breakdown.profit}
          >
            <table className="w-full text-[12px]">
              <tbody>
                <tr className="border-b border-dotted border-[color:var(--rule-soft)]">
                  <td className="py-1.5">Subtotal (pre-markup)</td>
                  <td className="text-right py-1.5 font-mono">
                    {fmtCurrency(breakdown.subtotal)}
                  </td>
                </tr>
                <tr className="border-b border-dotted border-[color:var(--rule-soft)]">
                  <td className="py-1.5">
                    Overhead ({(breakdown.overhead_pct * 100).toFixed(0)}%)
                  </td>
                  <td className="text-right py-1.5 font-mono">
                    {fmtCurrency(breakdown.overhead)}
                  </td>
                </tr>
                <tr className="border-b border-dotted border-[color:var(--rule-soft)]">
                  <td className="py-1.5">
                    Profit ({(breakdown.profit_pct * 100).toFixed(0)}%)
                  </td>
                  <td className="text-right py-1.5 font-mono">
                    {fmtCurrency(breakdown.profit)}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 font-semibold">TOTAL ESTIMATE</td>
                  <td className="text-right py-1.5 font-mono font-semibold">
                    {fmtCurrency(breakdown.total)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)] mt-2">
              Profit calculated on subtotal + overhead (Colorado vendor convention).
            </p>
          </BreakdownGroup>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="pt-3">{body}</div>;
  }

  return (
    <section className="output-card mb-8 !p-7">
      <span className="corner tl" />
      <span className="corner br" />
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--ink-faint)] mb-1.5">
        <span className="text-[color:var(--dim)]">D</span> · DELIVERABLE 04
      </div>
      <h3 className="text-[16px] font-bold text-[color:var(--heading-on-paper)] m-0 mb-1.5 tracking-[-0.01em]">
        Pricing quote
      </h3>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)] mb-5">
        XLSX · CONTRACTOR ESTIMATE · OVERHEAD + PROFIT
      </div>
      {body}
    </section>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  caption,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  caption?: { text: string; tone: "muted" | "accent" };
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)]">
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="bg-[color:var(--canvas)] border border-[color:var(--rule)] text-[13px] font-mono px-2.5 py-2 outline-none focus:bg-[color:var(--raise)] focus:border-[color:var(--act)] focus:[box-shadow:0_0_0_2px_var(--act-glow)]"
      />
      {caption && (
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.08em] ${
            caption.tone === "accent"
              ? "text-[color:var(--dim)]"
              : "text-[color:var(--ink-faint)]"
          }`}
        >
          {caption.text}
        </span>
      )}
    </label>
  );
}

function deliveryCaption(
  s: DeliveryStatus,
): { text: string; tone: "muted" | "accent" } | undefined {
  switch (s.state) {
    case "resolving":
      return { text: "Resolving distance from HQ…", tone: "muted" };
    case "auto":
      return { text: `Auto · ${s.miles} mi from HQ`, tone: "accent" };
    case "error":
      return { text: "Auto-detect failed — enter manually", tone: "muted" };
    case "manual":
    case "idle":
      return undefined;
  }
}

function flaggerCaption(
  source: FlaggerSource,
  auto: number,
): { text: string; tone: "muted" | "accent" } | undefined {
  if (source === "manual") return { text: "Manual override", tone: "muted" };
  return { text: `Auto · ${auto} from layout`, tone: "accent" };
}

function BreakdownGroup({
  title,
  subtotal,
  children,
}: {
  title: string;
  subtotal: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-[color:var(--rule-soft)] py-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex justify-between items-baseline py-1.5 cursor-pointer hover:opacity-80"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--ink)]">
          <span className="text-[color:var(--act)] mr-2">
            {open ? "−" : "+"}
          </span>
          {title}
        </span>
        <span className="font-mono text-[14px] text-[color:var(--ink)] font-semibold">
          {fmtCurrency(subtotal)}
        </span>
      </button>
      {open && <div className="mt-2 mb-3">{children}</div>}
    </div>
  );
}
