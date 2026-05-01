import { NextRequest } from "next/server";
import { fetchSiteDetection } from "@/lib/render-proxy";

const MAX_BODY_BYTES = 1024;
const RATE_LIMIT_PER_MIN = 20;

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

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
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

  const b = (body ?? {}) as { lat?: unknown; lng?: unknown; radius_m?: unknown };
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

  return fetchSiteDetection(b.lat, b.lng, radius);
}
