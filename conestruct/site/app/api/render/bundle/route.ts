import { NextRequest } from "next/server";
import JSZip from "jszip";
import {
  fetchAllRenderParts,
  RENDER_PART_FILENAMES,
} from "@/lib/render-proxy";
import { coerceQuoteSettings } from "@/lib/quote-settings";
import { isScenario } from "@/lib/scenarios";
import { rateLimitOr429 } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 32 * 1024;

function safeFilename(name: string | undefined): string {
  const cleaned = (name ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9 _-]+/g, "_")
    .replace(/\s+/g, "_");
  return cleaned || "plan";
}

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

  const baseName = safeFilename(scenario.meta?.project);
  const headers = new Headers();
  headers.set("content-type", "application/zip");
  headers.set(
    "content-disposition",
    `attachment; filename="${baseName}_mht_package.zip"`,
  );
  headers.set("cache-control", "private, no-store");
  return new Response(zipBytes, { status: 200, headers });
}
