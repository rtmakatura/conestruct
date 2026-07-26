import { NextRequest } from "next/server";
import {
  renderScenarioToResponse,
  type RenderKind,
} from "@/lib/render-proxy";
import { coerceQuoteSettings } from "@/lib/quote-settings";
import { isScenario } from "@/lib/scenarios";
import { rateLimitOr429 } from "@/lib/rate-limit";

// #122: give cold-start / heavy renders headroom under Vercel's function
// limit (60s < the backend's 120s cap) instead of an opaque NetworkError.
export const maxDuration = 60;

const KINDS: ReadonlySet<RenderKind> = new Set([
  "pdf",
  "xlsx",
  "markdown",
  "quote",
  "crew-pdf",
  "audit-pdf",
]);
const MAX_BODY_BYTES = 32 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: { kind: string } },
) {
  if (!KINDS.has(params.kind as RenderKind)) {
    return new Response("Not found", { status: 404 });
  }

  const over = await rateLimitOr429(req, "render-kind", 20);
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

  const kind = params.kind as RenderKind;
  if (kind === "quote") {
    const settings = coerceQuoteSettings(
      (body as { settings?: unknown })?.settings,
    );
    return renderScenarioToResponse(scenario, kind, { quoteSettings: settings });
  }

  return renderScenarioToResponse(scenario, kind);
}
