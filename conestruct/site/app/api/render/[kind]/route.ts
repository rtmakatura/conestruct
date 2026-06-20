import { NextRequest } from "next/server";
import {
  renderScenarioToResponse,
  type RenderKind,
} from "@/lib/render-proxy";
import { coerceQuoteSettings } from "@/lib/quote-settings";
import { isScenario } from "@/lib/scenarios";

const KINDS: ReadonlySet<RenderKind> = new Set([
  "pdf",
  "xlsx",
  "markdown",
  "quote",
  "crew-pdf",
]);
const MAX_BODY_BYTES = 32 * 1024;
const RATE_LIMIT_PER_MIN = 20;

// Best-effort per-IP cap as cheap insurance. In a serverless environment
// each instance has its own bucket — this catches a single hot client,
// not a distributed flood. Swap for a Redis/Upstash limiter if abuse shows up.
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

export async function POST(
  req: NextRequest,
  { params }: { params: { kind: string } },
) {
  if (!KINDS.has(params.kind as RenderKind)) {
    return new Response("Not found", { status: 404 });
  }

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

  const scenario = (body as { scenario?: unknown })?.scenario;
  if (!isScenario(scenario)) {
    return new Response("Invalid scenario", { status: 400 });
  }

  const kind = params.kind as RenderKind;
  if (kind === "quote") {
    const settings = coerceQuoteSettings(
      (body as { settings?: unknown })?.settings,
    );
    return renderScenarioToResponse(scenario, kind, { quoteSettings: settings });
  }

  return renderScenarioToResponse(scenario, kind);
}
