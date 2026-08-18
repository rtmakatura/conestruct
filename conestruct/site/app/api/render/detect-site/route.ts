import { NextRequest } from "next/server";
import {
  fetchSiteDetection,
  type DetectSiteRequestBody,
} from "@/lib/render-proxy";
import { rateLimitOr429 } from "@/lib/rate-limit";

// #122: give cold-start / heavy renders headroom under Vercel's function
// limit (60s < the backend's 120s cap) instead of an opaque NetworkError.
export const maxDuration = 60;

// 32 KB — joins the render-family bound (audit / [kind] / bundle /
// quote-breakdown / device-breakdown, all 32 KB): since #207 this body
// carries the confirmed road's centerline geometry, the same payload
// class those routes already accept.  The original 1 KB bound predated
// the geometry and 413'd every relay-bearing detect (the s2-arc3
// live-check finding); the byte bound is the vertex cap, same as the
// render surface.
const MAX_BODY_BYTES = 32 * 1024;

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
    centerline?: unknown;
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
  // #207: the confirmed road's centerline geometry.  This route is an
  // allowlist re-constructor, so the field must be named here or it is
  // silently stripped before the Modal service ever sees it — exactly
  // the defect the s2-arc3 live checks caught.  Same degrade-not-400
  // style as the other optional fields: a malformed or too-short
  // geometry is omitted, and the Modal service classifies on the chord
  // (identical to the field being absent).
  if (
    Array.isArray(b.centerline) &&
    b.centerline.length >= 2 &&
    b.centerline.every(
      (p): p is [number, number] =>
        Array.isArray(p) &&
        p.length === 2 &&
        isFiniteNumber(p[0]) &&
        p[0] >= -90 &&
        p[0] <= 90 &&
        isFiniteNumber(p[1]) &&
        p[1] >= -180 &&
        p[1] <= 180,
    )
  ) {
    payload.centerline = b.centerline;
  }

  return fetchSiteDetection(payload);
}
