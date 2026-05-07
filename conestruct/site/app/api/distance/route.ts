import { NextRequest } from "next/server";
import { geocodeAddress } from "@/lib/geocode";
import { COMPANY_HQ_ADDRESS } from "@/lib/company";
import { approxRoadMiles, type LatLng } from "@/lib/distance";

const MAX_BODY_BYTES = 256;
const RATE_LIMIT_PER_MIN = 60;

const buckets = new Map<string, { count: number; reset: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const cur = buckets.get(ip);
  if (!cur || cur.reset < now) {
    buckets.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (cur.count >= RATE_LIMIT_PER_MIN) return false;
  cur.count++;
  return true;
}

let hqCache: LatLng | null = null;
let hqInflight: Promise<LatLng | null> | null = null;

async function getHq(signal?: AbortSignal): Promise<LatLng | null> {
  if (hqCache) return hqCache;
  if (hqInflight) return hqInflight;
  hqInflight = (async () => {
    const r = await geocodeAddress(COMPANY_HQ_ADDRESS, signal);
    if (!r.ok) return null;
    hqCache = { lat: r.lat, lng: r.lng };
    return hqCache;
  })().finally(() => {
    hqInflight = null;
  });
  return hqInflight;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (!rateLimit(ip)) {
    return new Response("Too many requests", { status: 429 });
  }

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

  const { lat, lng } = (body as { lat?: unknown; lng?: unknown }) ?? {};
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return new Response("Invalid coords", { status: 400 });
  }

  const hq = await getHq(req.signal);
  if (!hq) {
    return new Response("HQ geocode unavailable", { status: 503 });
  }

  const miles = approxRoadMiles(hq, { lat, lng });
  return Response.json({ miles });
}
