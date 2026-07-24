import { NextRequest } from "next/server";
import { fetchCorridorSpec } from "@/lib/render-proxy";
import { rateLimitOr429 } from "@/lib/rate-limit";

// Engine-removal PR D: proxy for the picker modal's corridor-preview
// zone lengths (POST /render/corridor-spec on Modal).  Same rate-limit
// posture as the audit proxy; the body is shape-checked here and
// schema-validated by Pydantic upstream (422 on out-of-domain values).

const MAX_BODY_BYTES = 4 * 1024;

export async function POST(req: NextRequest) {
  const over = await rateLimitOr429(req, "render-corridor-spec", 30);
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
