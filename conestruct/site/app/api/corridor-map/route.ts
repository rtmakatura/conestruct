import { NextRequest } from "next/server";
import { corridorMapUrl, type CorridorSpec } from "@/lib/corridor-map";
import { rateLimitOr429 } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 1024;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function parseCorridor(body: unknown): { ok: true; spec: CorridorSpec } | { ok: false; reason: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, reason: "Invalid body" };
  }
  const c = body as Record<string, unknown>;
  const required = [
    "anchorLat",
    "anchorLng",
    "bearingDeg",
    "advanceWarningFt",
    "taperFt",
    "bufferFt",
    "workZoneFt",
    "downstreamTaperFt",
  ] as const;
  for (const key of required) {
    if (!isFiniteNumber(c[key])) {
      return { ok: false, reason: `Missing/invalid ${key}` };
    }
  }
  const spec: CorridorSpec = {
    anchorLat: c.anchorLat as number,
    anchorLng: c.anchorLng as number,
    bearingDeg: c.bearingDeg as number,
    advanceWarningFt: c.advanceWarningFt as number,
    taperFt: c.taperFt as number,
    bufferFt: c.bufferFt as number,
    workZoneFt: c.workZoneFt as number,
    downstreamTaperFt: c.downstreamTaperFt as number,
  };
  // Sanity bounds — total length anywhere from a few hundred ft to a
  // couple miles.  Reject obviously-malformed corridors so we don't
  // build a 50-MB Mapbox URL on the server.
  const total =
    spec.advanceWarningFt +
    spec.taperFt +
    spec.bufferFt +
    spec.workZoneFt +
    spec.downstreamTaperFt;
  if (total <= 0 || total > 60_000) {
    return { ok: false, reason: "Corridor length out of range" };
  }
  return { ok: true, spec };
}

export async function POST(req: NextRequest) {
  const over = await rateLimitOr429(req, "corridor-map", 60);
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

  const parsed = parseCorridor(body);
  if (!parsed.ok) {
    return new Response(parsed.reason, { status: 400 });
  }

  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return new Response("MAPBOX_TOKEN not configured", { status: 503 });
  }

  const url = corridorMapUrl(parsed.spec, token);
  // Return only the URL — the server holds the token.  The browser will
  // fetch the resulting image directly from Mapbox.
  return Response.json({ url });
}
