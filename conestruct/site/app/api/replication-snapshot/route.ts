// Dev-only replication-snapshot proxy (Refs #102).
//
// TEMPORARY DIAGNOSTIC SCAFFOLDING — delete together with
// components/DebugSnapshotButton.tsx and the backend
// /render/replication-snapshot endpoint. Inlines its Modal fetch instead
// of extending lib/render-proxy.ts so the deletion is one self-contained
// diff. Guards mirror the sibling render routes (rate limit, body cap,
// scenario validation); the Modal secret stays server-side.

import { NextRequest } from "next/server";
import { isScenario } from "@/lib/scenarios";

const MAX_BODY_BYTES = 32 * 1024;
const RATE_LIMIT_PER_MIN = 10;

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

  const scenario = (body as { scenario?: unknown })?.scenario;
  if (!isScenario(scenario)) {
    return new Response("Invalid scenario", { status: 400 });
  }

  const url = process.env.MODAL_RENDER_URL;
  const secret = process.env.MODAL_RENDER_SECRET;
  if (!url || !secret) {
    return new Response("Render service not configured", { status: 503 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${url.replace(/\/$/, "")}/render/replication-snapshot`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify(body),
      },
    );
  } catch (err) {
    console.error("replication snapshot fetch failed", err);
    return new Response("Render service unreachable", { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error(`replication snapshot upstream ${upstream.status}`, detail);
    if (upstream.status === 400) {
      return new Response(detail || "Invalid scenario", {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("Snapshot failed", { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}
