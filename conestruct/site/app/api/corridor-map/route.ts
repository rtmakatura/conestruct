import { NextRequest } from "next/server";
import { fetchCorridorMap, type CorridorMapStage } from "@/lib/render-proxy";
import { isScenario } from "@/lib/scenarios";
import { rateLimitOr429 } from "@/lib/rate-limit";

// #122: give cold-start / heavy renders headroom under Vercel's function
// limit (60s < the backend's 120s cap) instead of an opaque NetworkError.
export const maxDuration = 60;

// #301 piece 1 — the WHERE band's aerial.  Ruling 1 on the checkpoint:
// "Option (a), scenario in, PNG out, drawn on the backend, thin Next
// proxy."  This is the proxy: it checks the body's shape and forwards it to
// POST /render/corridor-map on Modal, which builds the corridor (#302's one
// layout call), draws page 2's own overlay and fetches the image with the
// server's Mapbox token.  The token never reaches this route or the browser.
// Same body cap and rate-limit posture as the corridor-geometry read.
const MAX_BODY_BYTES = 32 * 1024;
const STAGES: readonly CorridorMapStage[] = ["pin", "work", "laid_out"];

function px(v: unknown, min: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= 1280 ? v : null;
}

export async function POST(req: NextRequest) {
  const over = await rateLimitOr429(req, "corridor-map", 30);
  if (over) return over;

  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const b = (body ?? {}) as {
    scenario?: unknown;
    stage?: unknown;
    width?: unknown;
    height?: unknown;
    zoom?: unknown;
  };
  if (!isScenario(b.scenario)) {
    return new Response("Invalid scenario", { status: 400 });
  }
  const stage = STAGES.find((s) => s === b.stage);
  const width = px(b.width, 120);
  const height = px(b.height, 80);
  // The band's zoom step (Ryan's hand-check ruling, 2026-09-26): optional;
  // an integer from one step out to three in (the backend's bounds).
  const zoom = b.zoom === undefined ? 0 : b.zoom;
  const zoomOk = typeof zoom === "number" && Number.isInteger(zoom) && zoom >= -1 && zoom <= 3;
  if (!stage || width === null || height === null || !zoomOk) {
    return new Response("Invalid picture request", { status: 400 });
  }

  return fetchCorridorMap(b.scenario, {
    stage,
    width,
    height,
    ...(zoom !== 0 ? { zoom } : {}),
  });
}
