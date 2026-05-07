"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  DEFAULT_QUOTE_SETTINGS,
  type QuoteSettings,
} from "@/lib/quote-settings";
import type { Scenario } from "@/lib/scenarios";

type DeliveryStatus =
  | { state: "idle" }
  | { state: "resolving" }
  | { state: "auto"; miles: number }
  | { state: "manual" }
  | { state: "error" };

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
  permit_fee: number;
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

function safeFilename(name: string | undefined, ext: string): string {
  const cleaned = (name ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9 _-]+/g, "_")
    .replace(/\s+/g, "_");
  return `${cleaned || "plan"}.${ext}`;
}

export function QuotePanel({ mode }: Props) {
  const [settings, setSettings] = useState<QuoteSettings>(
    DEFAULT_QUOTE_SETTINGS,
  );
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryStatus>({ state: "idle" });

  // Latest settings in a ref so the async distance handler can write back to
  // the current settings object instead of a stale closure value.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const lat = mode.kind === "public" ? mode.scenario.meta.lat : 0;
  const lng = mode.kind === "public" ? mode.scenario.meta.lng : 0;

  useEffect(() => {
    if (mode.kind !== "public") return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (lat === 0 && lng === 0) return;

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

  return (
    <section className="output-card mb-8 !p-7">
      <span className="corner tl" />
      <span className="corner br" />
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--ink-faint)] mb-1.5">
        <span className="text-[color:var(--orange)]">D</span> · DELIVERABLE 04
      </div>
      <h3 className="text-[16px] font-bold text-[color:var(--heading-on-paper)] m-0 mb-1.5 tracking-[-0.01em]">
        Pricing quote
      </h3>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)] mb-5">
        XLSX · CONTRACTOR ESTIMATE · OVERHEAD + PROFIT
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
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
          onChange={(v) => setSettings({ ...settings, num_flaggers: v })}
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
          label="Permit fee ($)"
          value={settings.permit_fee}
          min={0}
          max={100_000}
          step={50}
          onChange={(v) => setSettings({ ...settings, permit_fee: v })}
        />
      </div>

      {mode.kind === "public" ? (
        <div className="flex flex-col md:flex-row gap-3">
          <button
            type="button"
            onClick={onPreview}
            disabled={busy}
            className="md:flex-1 font-sans font-semibold text-[13px] bg-[color:var(--paper-line)] text-[color:var(--ink-on-paper)] px-3 py-3 cursor-pointer flex items-center justify-center gap-2.5 hover:bg-[color:var(--paper-line-hover)] transition-colors disabled:opacity-60"
          >
            {busy ? "Calculating…" : "Preview breakdown"}
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="md:flex-1 font-sans font-semibold text-[13px] bg-[color:var(--canvas)] text-white px-3 py-3 cursor-pointer flex items-center justify-center gap-2.5 hover:bg-[color:var(--cyan-deep)] transition-colors disabled:opacity-60"
          >
            {downloading ? "Rendering…" : "Download Quote (XLSX)"}
            <span className="font-mono">↓</span>
          </button>
        </div>
      ) : mode.planId ? (
        <a
          href={`/api/plans/${mode.planId}/quote`}
          download
          className="block w-full font-sans font-semibold text-[13px] bg-[color:var(--canvas)] text-white px-3 py-3 cursor-pointer flex items-center justify-center gap-2.5 hover:bg-[color:var(--cyan-deep)] transition-colors"
        >
          Download Quote (XLSX)
          <span className="font-mono">↓</span>
        </a>
      ) : (
        <Link
          href={SIGNUP_HREF}
          className="block w-full font-sans font-semibold text-[13px] bg-[color:var(--canvas)] text-white px-3 py-3 cursor-pointer flex items-center justify-center gap-2.5 hover:bg-[color:var(--cyan-deep)] transition-colors"
        >
          Sign up to download Quote
          <span className="font-mono">↓</span>
        </Link>
      )}

      {err && (
        <div className="mt-3 font-mono text-[11px] text-[color:var(--orange)]">
          {err}
        </div>
      )}

      {breakdown && (
        <div className="mt-7">
          <div className="flex justify-between items-baseline border-t border-b border-dashed border-[color:var(--paper-line)] py-3 mb-5">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)]">
              Total estimate
            </span>
            <span className="font-mono text-[28px] text-[color:var(--orange)] font-semibold">
              {fmtTotal(breakdown.total)}
            </span>
          </div>

          <BreakdownGroup
            title="Equipment Rental"
            subtotal={breakdown.equipment_total}
          >
            <table className="w-full text-[12px]">
              <thead className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--ink-faint)]">
                <tr className="border-b border-dashed border-[color:var(--paper-line)]">
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
                    key={`${line.device_type}-${line.label || line.item_number}`}
                    className="border-b border-dotted border-[color:var(--paper-line)]"
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
                <tr className="border-b border-dashed border-[color:var(--paper-line)]">
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
                    className="border-b border-dotted border-[color:var(--paper-line)]"
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
                <tr className="border-b border-dashed border-[color:var(--paper-line)]">
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
                    className="border-b border-dotted border-[color:var(--paper-line)]"
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
            title="Permits & Admin"
            subtotal={breakdown.permit_fee}
          >
            <p className="text-[12px]">
              {breakdown.permit_fee > 0
                ? `Permit fee: ${fmtCurrency(breakdown.permit_fee)}`
                : "No permit fee entered."}
            </p>
          </BreakdownGroup>

          <BreakdownGroup
            title={`Markup — overhead ${(breakdown.overhead_pct * 100).toFixed(0)}%, profit ${(breakdown.profit_pct * 100).toFixed(0)}%`}
            subtotal={breakdown.overhead + breakdown.profit}
          >
            <table className="w-full text-[12px]">
              <tbody>
                <tr className="border-b border-dotted border-[color:var(--paper-line)]">
                  <td className="py-1.5">Subtotal (pre-markup)</td>
                  <td className="text-right py-1.5 font-mono">
                    {fmtCurrency(breakdown.subtotal)}
                  </td>
                </tr>
                <tr className="border-b border-dotted border-[color:var(--paper-line)]">
                  <td className="py-1.5">
                    Overhead ({(breakdown.overhead_pct * 100).toFixed(0)}%)
                  </td>
                  <td className="text-right py-1.5 font-mono">
                    {fmtCurrency(breakdown.overhead)}
                  </td>
                </tr>
                <tr className="border-b border-dotted border-[color:var(--paper-line)]">
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
        className="bg-transparent border border-[color:var(--paper-line)] text-[13px] font-mono px-2.5 py-2 outline-none focus:border-[color:var(--canvas)]"
      />
      {caption && (
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.08em] ${
            caption.tone === "accent"
              ? "text-[color:var(--orange)]"
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
    <div className="border-t border-[color:var(--paper-line)] py-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex justify-between items-baseline py-1.5 cursor-pointer hover:opacity-80"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--ink-on-paper)]">
          <span className="text-[color:var(--orange)] mr-2">
            {open ? "−" : "+"}
          </span>
          {title}
        </span>
        <span className="font-mono text-[14px] text-[color:var(--ink-on-paper)] font-semibold">
          {fmtCurrency(subtotal)}
        </span>
      </button>
      {open && <div className="mt-2 mb-3">{children}</div>}
    </div>
  );
}
