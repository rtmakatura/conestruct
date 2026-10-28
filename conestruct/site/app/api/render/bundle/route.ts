import { NextRequest } from "next/server";
import JSZip from "jszip";
import {
  fetchAllRenderParts,
  RENDER_PART_FILENAMES,
} from "@/lib/render-proxy";
import { coerceQuoteSettings } from "@/lib/quote-settings";
import { isScenario } from "@/lib/scenarios";
import { rateLimitOr429 } from "@/lib/rate-limit";
import { packageFilename } from "@/lib/download-name";

// #122: give cold-start / heavy renders headroom under Vercel's function
// limit (60s < the backend's 120s cap) instead of an opaque NetworkError.
export const maxDuration = 60;

const MAX_BODY_BYTES = 32 * 1024;

export async function POST(req: NextRequest) {
  const over = await rateLimitOr429(req, "render-bundle", 10);
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
  const settings = coerceQuoteSettings(
    (body as { settings?: unknown })?.settings,
  );

  let parts;
  try {
    parts = await fetchAllRenderParts(scenario, settings);
  } catch (err) {
    console.error("bundle render failed", err);
    return new Response("Render failed", { status: 502 });
  }

  const zip = new JSZip();
  for (const part of parts) {
    zip.file(RENDER_PART_FILENAMES[part.kind], part.bytes);
  }
  const zipBytes = await zip.generateAsync({ type: "uint8array" });

  // #401: the zip button's name for the same plan, except the day: here
  // it is the server's local day (UTC on Vercel), there the browser's.
  // The browser saves under the button's name (a.download), so this
  // header only names a zip fetched outside the page.
  const headers = new Headers();
  headers.set("content-type", "application/zip");
  headers.set(
    "content-disposition",
    `attachment; filename="${packageFilename(scenario)}"`,
  );
  headers.set("cache-control", "private, no-store");
  return new Response(zipBytes, { status: 200, headers });
}
