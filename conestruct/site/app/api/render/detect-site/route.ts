import { NextRequest } from "next/server";
import {
  fetchSiteDetection,
  type DetectSiteRequestBody,
} from "@/lib/render-proxy";
import { rateLimitOr429 } from "@/lib/rate-limit";

// #122: give cold-start / heavy renders headroom under Vercel's function
// limit (60s < the backend's 120s cap) instead of an opaque NetworkError.
export const maxDuration = 60;

const MAX_BODY_BYTES = 1024;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export async function POST(req: NextRequest) {
  const over = await rateLimitOr429(req, "render-detect-site", 20);
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
    lat?: unknown;
    lng?: unknown;
    radius_m?: unknown;
    bearing_deg?: unknown;
    speed_mph?: unknown;
    work_zone_ft?: unknown;
    closure_type?: unknown;
    road_type?: unknown;
    lane_width_ft?: unknown;
  };
  if (!isFiniteNumber(b.lat) || b.lat < -90 || b.lat > 90) {
    return new Response("Invalid lat", { status: 400 });
  }
  if (!isFiniteNumber(b.lng) || b.lng < -180 || b.lng > 180) {
    return new Response("Invalid lng", { status: 400 });
  }
  const radius =
    isFiniteNumber(b.radius_m) && b.radius_m >= 50 && b.radius_m <= 2000
      ? b.radius_m
      : 500;

  // Corridor parameters are all optional; each is included only if it
  // passes its individual range check.  The Modal service requires the
  // full quintet (bearing/speed/work-zone-length/closure/road-type) to
  // run corridor mode and falls back to point-and-radius otherwise — so
  // partial sets degrade gracefully instead of 400'ing here.
  const payload: DetectSiteRequestBody = {
    lat: b.lat,
    lng: b.lng,
    radius_m: radius,
  };
  if (
    isFiniteNumber(b.bearing_deg) &&
    b.bearing_deg >= 0 &&
    b.bearing_deg <= 360
  ) {
    payload.bearing_deg = b.bearing_deg;
  }
  if (isFiniteNumber(b.speed_mph) && b.speed_mph >= 10 && b.speed_mph <= 85) {
    payload.speed_mph = b.speed_mph;
  }
  if (
    isFiniteNumber(b.work_zone_ft) &&
    b.work_zone_ft >= 10 &&
    b.work_zone_ft <= 20000
  ) {
    payload.work_zone_ft = b.work_zone_ft;
  }
  if (typeof b.closure_type === "string" && b.closure_type.length <= 64) {
    payload.closure_type = b.closure_type;
  }
  if (typeof b.road_type === "string" && b.road_type.length <= 64) {
    payload.road_type = b.road_type;
  }
  if (
    isFiniteNumber(b.lane_width_ft) &&
    b.lane_width_ft >= 8 &&
    b.lane_width_ft <= 20
  ) {
    payload.lane_width_ft = b.lane_width_ft;
  }

  return fetchSiteDetection(payload);
}
