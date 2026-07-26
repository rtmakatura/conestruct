import { NextRequest } from "next/server";
import { fetchJurisdictionSuggest } from "@/lib/render-proxy";
import { rateLimitOr429 } from "@/lib/rate-limit";

// #122: give cold-start / heavy renders headroom under Vercel's function
// limit (60s < the backend's 120s cap) instead of an opaque NetworkError.
export const maxDuration = 60;

const MAX_BODY_BYTES = 512;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export async function POST(req: NextRequest) {
  const over = await rateLimitOr429(req, "jurisdiction-suggest", 30);
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

  const b = (body ?? {}) as { lat?: unknown; lng?: unknown };
  if (!isFiniteNumber(b.lat) || b.lat < -90 || b.lat > 90) {
    return new Response("Invalid lat", { status: 400 });
  }
  if (!isFiniteNumber(b.lng) || b.lng < -180 || b.lng > 180) {
    return new Response("Invalid lng", { status: 400 });
  }

  return fetchJurisdictionSuggest({ lat: b.lat, lng: b.lng });
}
