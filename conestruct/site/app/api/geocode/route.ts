import { NextRequest } from "next/server";
import { geocodeAddress } from "@/lib/geocode";
import { rateLimitOr429 } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 1024;

export async function POST(req: NextRequest) {
  const over = await rateLimitOr429(req, "geocode", 40);
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

  const address = (body as { address?: unknown })?.address;
  if (typeof address !== "string" || !address.trim()) {
    return new Response("Invalid address", { status: 400 });
  }

  const result = await geocodeAddress(address, req.signal);
  if (!result.ok) {
    return new Response(result.reason, { status: result.status });
  }
  return Response.json({
    lat: result.lat,
    lng: result.lng,
    placeType: result.placeType,
  });
}
