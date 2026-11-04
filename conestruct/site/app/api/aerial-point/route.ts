import { NextRequest } from "next/server";
import { fetchAerialPoint } from "@/lib/render-proxy";
import { rateLimitOr429 } from "@/lib/rate-limit";

// #440 X3 — a tap on the WHERE band's `pin` picture.  The thin proxy for
// POST /render/aerial-point on Modal: it checks the body's shape and
// forwards exactly the pin, the frame, the zoom step and the tap; the
// backend turns the pixel into a coordinate (Rule 3).  The same body cap
// and rate-limit posture as the corridor-map read.
const MAX_BODY_BYTES = 4 * 1024;

function px(v: unknown, min: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= 1280 ? v : null;
}

function finite(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

export async function POST(req: NextRequest) {
  const over = await rateLimitOr429(req, "aerial-point", 30);
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

  const b = (body ?? {}) as Record<string, unknown>;
  const lat = finite(b.lat, -85, 85);
  const lng = finite(b.lng, -180, 180);
  const width = px(b.width, 120);
  const height = px(b.height, 80);
  const zoom = b.zoom === undefined ? 0 : b.zoom;
  const zoomOk = typeof zoom === "number" && Number.isInteger(zoom) && zoom >= -1 && zoom <= 3;
  const x = width === null ? null : finite(b.x, 0, width);
  const y = height === null ? null : finite(b.y, 0, height);
  if (lat === null || lng === null || width === null || height === null || !zoomOk || x === null || y === null) {
    return new Response("Invalid tap", { status: 400 });
  }

  return fetchAerialPoint({
    lat,
    lng,
    width,
    height,
    ...(zoom !== 0 ? { zoom: zoom as number } : {}),
    x,
    y,
  });
}
