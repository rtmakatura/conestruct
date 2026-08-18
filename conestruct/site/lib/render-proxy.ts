import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { getDb, plans } from "@/db";
import { toScenario } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios";
import { withRelayedCenterline } from "@/lib/scenarios/centerline-relay";
import { BUNDLE_PART_KINDS } from "@/lib/render-types";
import {
  DEFAULT_QUOTE_SETTINGS,
  type QuoteSettings,
} from "@/lib/quote-settings";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RenderKind =
  | "pdf"
  | "xlsx"
  | "markdown"
  | "quote"
  | "crew-pdf"
  | "audit-pdf";

const EXT: Record<RenderKind, string> = {
  pdf: "pdf",
  xlsx: "xlsx",
  markdown: "md",
  quote: "xlsx",
  // The crew narrative rendered as a PDF — a distinct deliverable from
  // the plan-sheet PDF, so name it "<plan>.crew.pdf" to avoid collision.
  "crew-pdf": "crew.pdf",
  // The audit trail rendered as a PDF — likewise distinct from the
  // plan-sheet PDF.
  "audit-pdf": "audit.pdf",
};

// #184 — an upstream validation rejection must reach the client as the
// validation it is, not as an outage.  Two upstream shapes qualify:
//
//   400 — an HTTPException the render API raised deliberately (gate
//   refusals, the geometry taper floor).  Forwarded body-intact, as the
//   audit/device/download paths always have.
//
//   422 — FastAPI's automatic Pydantic rejection (schema bounds and the
//   cross-field validators, e.g. the drawable-half-road check).  The body
//   is a ``detail`` ARRAY of error objects the client has no parser for;
//   collapsing it to 502 presented the user's input problem as a server
//   outage with a Retry that could never succeed.  Translated here to a
//   400 whose body is the ``{"detail": "<message>"}`` shape backend 400s
//   already use, so the existing PLAN DECLINED path (#180) renders the
//   validation message with no client change.  Pydantic prefixes
//   model-validator messages with "Value error, " — stripped, it isn't
//   part of the sentence the validator wrote.
//
// Returns null for every other status (including an unparseable 422 —
// a body we can't quote honestly stays an honest 502 at the call site).
export function validationPassthrough(
  status: number,
  detail: string,
): Response | null {
  if (status === 400) {
    return new Response(detail || "Invalid scenario", {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (status !== 422) return null;
  let message: string;
  try {
    const body = JSON.parse(detail) as {
      detail?: { msg?: unknown }[];
    };
    const msgs = (body.detail ?? [])
      .map((e) => (typeof e.msg === "string" ? e.msg : ""))
      .filter(Boolean)
      .map((m) => m.replace(/^Value error, /, ""));
    if (msgs.length === 0) return null;
    message = msgs.join(" · ");
  } catch {
    return null;
  }
  return new Response(JSON.stringify({ detail: message }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}

function safeFilename(name: string, ext: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9 _-]+/g, "_")
    .replace(/\s+/g, "_");
  return `${cleaned || "plan"}.${ext}`;
}

export async function renderScenarioToResponse(
  scenario: Scenario,
  kind: RenderKind,
  opts: { downloadName?: string; quoteSettings?: QuoteSettings } = {},
): Promise<Response> {
  const url = process.env.MODAL_RENDER_URL;
  const secret = process.env.MODAL_RENDER_SECRET;
  if (!url || !secret) {
    return new Response("Render service not configured", { status: 503 });
  }

  // #140: materialize meta.centerline from the confirmed road at the
  // wire boundary (same at every upstream POST site in this module).
  const wireScenario = withRelayedCenterline(scenario);
  const requestBody =
    kind === "quote"
      ? { scenario: wireScenario, settings: opts.quoteSettings ?? DEFAULT_QUOTE_SETTINGS }
      : wireScenario;

  let upstream: Response;
  try {
    upstream = await fetch(`${url.replace(/\/$/, "")}/render/${kind}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    console.error("render proxy fetch failed", err);
    return new Response("Render service unreachable", { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error(`render upstream ${upstream.status}`, detail);
    // 400 = validation error (e.g., work zone shorter than required taper).
    // Pass the structured detail through so the UI can show the user *why*
    // their config was rejected, instead of a generic "Render failed".
    // 422 = schema rejection, translated to the same shape (#184).
    const validation = validationPassthrough(upstream.status, detail);
    if (validation) return validation;
    return new Response("Render failed", { status: 502 });
  }

  const baseName = opts.downloadName ?? scenario.meta?.project ?? "plan";
  const filename = safeFilename(baseName, EXT[kind]);
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("content-disposition", `attachment; filename="${filename}"`);
  headers.set("cache-control", "private, no-store");

  return new Response(upstream.body, { status: 200, headers });
}

export async function fetchQuoteBreakdown(
  scenario: Scenario,
  settings: QuoteSettings,
): Promise<Response> {
  const url = process.env.MODAL_RENDER_URL;
  const secret = process.env.MODAL_RENDER_SECRET;
  if (!url || !secret) {
    return new Response("Render service not configured", { status: 503 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${url.replace(/\/$/, "")}/render/quote-breakdown`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ scenario: withRelayedCenterline(scenario), settings }),
      },
    );
  } catch (err) {
    console.error("quote breakdown fetch failed", err);
    return new Response("Render service unreachable", { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error(`quote breakdown upstream ${upstream.status}`, detail);
    // #184: this path used to collapse even deliberate 400s to 502 — on
    // the money surface, a gate refusal read as an outage.  Same
    // validation passthrough as the audit/device/download paths.
    const validation = validationPassthrough(upstream.status, detail);
    if (validation) return validation;
    return new Response("Render failed", { status: 502 });
  }

  const headers = new Headers();
  headers.set(
    "content-type",
    upstream.headers.get("content-type") ?? "application/json",
  );
  headers.set("cache-control", "private, no-store");
  return new Response(upstream.body, { status: 200, headers });
}

export async function fetchDeviceBreakdown(
  scenario: Scenario,
): Promise<Response> {
  const url = process.env.MODAL_RENDER_URL;
  const secret = process.env.MODAL_RENDER_SECRET;
  if (!url || !secret) {
    return new Response("Render service not configured", { status: 503 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${url.replace(/\/$/, "")}/render/device-breakdown`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify(withRelayedCenterline(scenario)),
      },
    );
  } catch (err) {
    console.error("device breakdown fetch failed", err);
    return new Response("Render service unreachable", { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error(`device breakdown upstream ${upstream.status}`, detail);
    const validation = validationPassthrough(upstream.status, detail);
    if (validation) return validation;
    return new Response("Device breakdown failed", { status: 502 });
  }

  const headers = new Headers();
  headers.set(
    "content-type",
    upstream.headers.get("content-type") ?? "application/json",
  );
  headers.set("cache-control", "private, no-store");
  return new Response(upstream.body, { status: 200, headers });
}

export async function fetchAuditTrail(
  scenario: Scenario,
): Promise<Response> {
  const url = process.env.MODAL_RENDER_URL;
  const secret = process.env.MODAL_RENDER_SECRET;
  if (!url || !secret) {
    return new Response("Render service not configured", { status: 503 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${url.replace(/\/$/, "")}/render/audit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(withRelayedCenterline(scenario)),
    });
  } catch (err) {
    console.error("audit trail fetch failed", err);
    return new Response("Render service unreachable", { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error(`audit trail upstream ${upstream.status}`, detail);
    const validation = validationPassthrough(upstream.status, detail);
    if (validation) return validation;
    return new Response("Audit trail failed", { status: 502 });
  }

  const headers = new Headers();
  headers.set(
    "content-type",
    upstream.headers.get("content-type") ?? "application/json",
  );
  headers.set("cache-control", "private, no-store");
  return new Response(upstream.body, { status: 200, headers });
}

// Engine-removal PR D: corridor-preview zone lengths for the picker
// modal.  The body mirrors CorridorSpecRequest (render_api.py) — kind /
// speed / optional roadType; lane width, shoulder width and lanes-closed
// ride the backend defaults, which match the values the retired frontend
// mirror used for the preview.
export interface CorridorSpecRequestBody {
  kind: string;
  speed: number;
  roadType?: string | null;
}

export async function fetchCorridorSpec(
  body: CorridorSpecRequestBody,
): Promise<Response> {
  const url = process.env.MODAL_RENDER_URL;
  const secret = process.env.MODAL_RENDER_SECRET;
  if (!url || !secret) {
    return new Response("Render service not configured", { status: 503 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${url.replace(/\/$/, "")}/render/corridor-spec`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("corridor spec fetch failed", err);
    return new Response("Render service unreachable", { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error(`corridor spec upstream ${upstream.status}`, detail);
    return new Response("Corridor spec failed", { status: 502 });
  }

  const headers = new Headers();
  headers.set(
    "content-type",
    upstream.headers.get("content-type") ?? "application/json",
  );
  headers.set("cache-control", "private, no-store");
  return new Response(upstream.body, { status: 200, headers });
}

type BundlePart = { kind: RenderKind; bytes: ArrayBuffer; contentType: string };

async function fetchPartFromModal(
  scenario: Scenario,
  kind: RenderKind,
  quoteSettings: QuoteSettings,
): Promise<BundlePart> {
  const url = process.env.MODAL_RENDER_URL!;
  const secret = process.env.MODAL_RENDER_SECRET!;
  const requestBody =
    kind === "quote" ? { scenario, settings: quoteSettings } : scenario;
  const upstream = await fetch(`${url.replace(/\/$/, "")}/render/${kind}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(requestBody),
  });
  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    throw new Error(`render ${kind} upstream ${upstream.status}: ${detail}`);
  }
  const bytes = await upstream.arrayBuffer();
  const contentType =
    upstream.headers.get("content-type") ?? "application/octet-stream";
  return { kind, bytes, contentType };
}

// Fetch every render kind in parallel and return the raw bytes plus a
// content-type for each.  Lets the bundle route zip them without
// touching streaming-body details.
export async function fetchAllRenderParts(
  scenario: Scenario,
  quoteSettings: QuoteSettings,
): Promise<BundlePart[]> {
  const url = process.env.MODAL_RENDER_URL;
  const secret = process.env.MODAL_RENDER_SECRET;
  if (!url || !secret) {
    throw new Error("Render service not configured");
  }
  const kinds: RenderKind[] = [...BUNDLE_PART_KINDS];
  return Promise.all(
    kinds.map((kind) => fetchPartFromModal(scenario, kind, quoteSettings)),
  );
}

export const RENDER_PART_FILENAMES: Record<RenderKind, string> = {
  pdf: "plan_sheet.pdf",
  xlsx: "device_list.xlsx",
  markdown: "crew_narrative.md",
  quote: "quote.xlsx",
  // Not bundle parts (fetchAllRenderParts renders the four above); the
  // crew and audit PDFs are standalone downloads. Named here only to
  // satisfy the RenderKind record.
  "crew-pdf": "crew_narrative.pdf",
  "audit-pdf": "audit_trail.pdf",
};

export interface DetectSiteRequestBody {
  lat: number;
  lng: number;
  radius_m: number;
  // Corridor parameters.  When all five are present, the Modal service
  // builds a WorkCorridor and runs corridor-aware detection; otherwise
  // it falls back to the legacy point-and-radius detector.
  bearing_deg?: number;
  speed_mph?: number;
  work_zone_ft?: number;
  closure_type?: string;
  road_type?: string;
  lane_width_ft?: number;
  // #207: the confirmed road's way geometry, materialized through the
  // same staleness-guarded relay as ScenarioMeta.centerline (#140).
  // With it the Modal service classifies detected features in the
  // road's station frame; absent, the straight-chord frame as before.
  centerline?: Array<[number, number]>;
}

export async function fetchSiteDetection(
  body: DetectSiteRequestBody,
): Promise<Response> {
  const url = process.env.MODAL_RENDER_URL;
  const secret = process.env.MODAL_RENDER_SECRET;
  if (!url || !secret) {
    return new Response("Render service not configured", { status: 503 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${url.replace(/\/$/, "")}/render/detect-site`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("site detection fetch failed", err);
    return new Response("Render service unreachable", { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error(`site detection upstream ${upstream.status}`, detail);
    return new Response("Site detection failed", { status: 502 });
  }

  const headers = new Headers();
  headers.set(
    "content-type",
    upstream.headers.get("content-type") ?? "application/json",
  );
  headers.set("cache-control", "private, no-store");
  return new Response(upstream.body, { status: 200, headers });
}

export async function fetchJurisdictionSuggest(body: {
  lat: number;
  lng: number;
}): Promise<Response> {
  const url = process.env.MODAL_RENDER_URL;
  const secret = process.env.MODAL_RENDER_SECRET;
  if (!url || !secret) {
    return new Response("Render service not configured", { status: 503 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${url.replace(/\/$/, "")}/jurisdiction/suggest`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("jurisdiction suggest fetch failed", err);
    return new Response("Render service unreachable", { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error(`jurisdiction suggest upstream ${upstream.status}`, detail);
    return new Response("Jurisdiction suggest failed", { status: 502 });
  }

  const headers = new Headers();
  headers.set(
    "content-type",
    upstream.headers.get("content-type") ?? "application/json",
  );
  headers.set("cache-control", "private, no-store");
  return new Response(upstream.body, { status: 200, headers });
}

export async function proxyRender(
  planId: string,
  kind: RenderKind,
): Promise<Response> {
  if (!UUID_RE.test(planId)) {
    return new Response("Not found", { status: 404 });
  }

  const { userId, orgId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  if (!orgId) return new Response("No active company", { status: 403 });

  const db = getDb();
  const [row] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.companyId, orgId)))
    .limit(1);

  if (!row) return new Response("Not found", { status: 404 });

  const scenario = toScenario(row.data);
  return renderScenarioToResponse(scenario, kind, { downloadName: row.name });
}
