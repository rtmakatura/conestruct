import { NextRequest } from "next/server";
import { geocodeAddress } from "@/lib/geocode";

const MAX_BODY_BYTES = 1024;
const RATE_LIMIT_PER_MIN = 40;

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

  const address = (body as { address?: unknown })?.address;
  if (typeof address !== "string" || !address.trim()) {
    return new Response("Invalid address", { status: 400 });
  }

  const result = await geocodeAddress(address, req.signal);
  if (!result.ok) {
    return new Response(result.reason, { status: result.status });
  }
  return Response.json({ lat: result.lat, lng: result.lng });
}
