import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.SENTRY_TEST_ENABLED !== "1") {
    return new NextResponse("not found", { status: 404 });
  }
  throw new Error("Sentry frontend verification: intentional Next.js API 500");
}
