import { NextRequest } from "next/server";
import { fetchNeedsYouMap } from "@/lib/render-proxy";
import { isScenario } from "@/lib/scenarios";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { isScannedFlag } from "@/lib/scenarios/site-corrections";

// #122: headroom under Vercel's function limit, as the corridor-map read.
export const maxDuration = 60;

// #447 — a NEEDS YOU question's map.  The thin proxy for POST
// /render/needs-you-map on Modal, which frames and draws it with the server's
// Mapbox token.  Same body cap and rate-limit posture as /api/corridor-map.
const MAX_BODY_BYTES = 32 * 1024;

function px(v: unknown, min: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= 1280 ? v : null;
}

export async function POST(req: NextRequest) {
  const over = await rateLimitOr429(req, "needs-you-map", 30);
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
    flag?: unknown;
    width?: unknown;
    height?: unknown;
    zoom?: unknown;
  };
  if (!isScenario(b.scenario)) {
    return new Response("Invalid scenario", { status: 400 });
  }
  const width = px(b.width, 120);
  const height = px(b.height, 80);
  const zoom = b.zoom === undefined ? 0 : b.zoom;
  const zoomOk = typeof zoom === "number" && Number.isInteger(zoom) && zoom >= -1 && zoom <= 3;
  if (typeof b.flag !== "string" || !isScannedFlag(b.flag) || width === null || height === null || !zoomOk) {
    return new Response("Invalid picture request", { status: 400 });
  }

  return fetchNeedsYouMap(b.scenario, {
    flag: b.flag,
    width,
    height,
    ...(zoom !== 0 ? { zoom } : {}),
  });
}
