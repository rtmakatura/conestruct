import { NextRequest } from "next/server";
import { fetchAuditTrail } from "@/lib/render-proxy";
import { isScenario } from "@/lib/scenarios";
import { rateLimitOr429 } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 32 * 1024;

export async function POST(req: NextRequest) {
  const over = await rateLimitOr429(req, "render-audit", 30);
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

  const scenario = (body as { scenario?: unknown })?.scenario;
  if (!isScenario(scenario)) {
    return new Response("Invalid scenario", { status: 400 });
  }

  return fetchAuditTrail(scenario);
}
