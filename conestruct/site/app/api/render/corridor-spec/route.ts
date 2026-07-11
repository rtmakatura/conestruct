import { NextRequest } from "next/server";
import { fetchCorridorSpec } from "@/lib/render-proxy";

// Engine-removal PR D: proxy for the picker modal's corridor-preview
// zone lengths (POST /render/corridor-spec on Modal).  Same rate-limit
// posture as the audit proxy; the body is shape-checked here and
// schema-validated by Pydantic upstream (422 on out-of-domain values).

const MAX_BODY_BYTES = 4 * 1024;
const RATE_LIMIT_PER_MIN = 30;

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

  const b = body as {
    kind?: unknown;
    speed?: unknown;
    roadType?: unknown;
  };
  if (typeof b.kind !== "string" || typeof b.speed !== "number") {
    return new Response("Invalid request", { status: 400 });
  }
  if (b.roadType !== undefined && b.roadType !== null && typeof b.roadType !== "string") {
    return new Response("Invalid request", { status: 400 });
  }

  return fetchCorridorSpec({
    kind: b.kind,
    speed: b.speed,
    roadType: (b.roadType as string | null | undefined) ?? undefined,
  });
}
