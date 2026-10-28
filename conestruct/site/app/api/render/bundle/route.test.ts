// #401 (W10/W11, Rule 11: tested at the route, where the zip is built).
// The page put "4 files" beside four cards that offer five files, and the
// zip held a different four: no crew PDF, no audit PDF, plus a quote no
// card offers.  It was named plan_mht_package.zip on every sandbox plan.
// Here the real route builds the real zip from stubbed backend renders,
// and the zip is opened and read.
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({ auth: async () => ({}) }));
vi.mock("@/db", () => ({ getDb: () => ({}), plans: {} }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitOr429: async () => null }));

import { POST } from "./route";
import { bundleLabel } from "@/lib/render-types";
import { planFingerprint } from "@/lib/download-name";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { Scenario } from "@/lib/scenarios";

const SCENARIO = {
  ...DEFAULT_SHOULDER,
  meta: {
    ...DEFAULT_SHOULDER.meta,
    confirmedRoad: { candidate: { name: "East Colfax Avenue", ref: null } },
  },
} as unknown as Scenario;

const rendered: string[] = [];

beforeEach(() => {
  rendered.length = 0;
  process.env.MODAL_RENDER_URL = "https://modal.test";
  process.env.MODAL_RENDER_SECRET = "s";
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 27, 12, 0));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const kind = url.slice(url.lastIndexOf("/") + 1);
      rendered.push(kind);
      return new Response(new TextEncoder().encode(`bytes of ${kind}`), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function bundle(scenario: Scenario) {
  const body = JSON.stringify({ scenario });
  const res = await POST(
    new Request("http://x/api/render/bundle", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(body.length) },
      body,
    }) as never,
  );
  expect(res.status).toBe(200);
  const zip = await JSZip.loadAsync(await res.arrayBuffer());
  return { res, zip };
}

describe("the download-all zip (#401)", () => {
  it("holds every card's file plus the quote, and the label counts them", async () => {
    const { zip } = await bundle(SCENARIO);
    const names = Object.keys(zip.files);
    expect(names).toEqual([
      "plan_sheet.pdf",
      "device_list.xlsx",
      "crew_narrative.pdf",
      "crew_narrative.md",
      "audit_trail.pdf",
      "quote.xlsx",
    ]);
    // Each entry is the render of its own kind.
    expect(await zip.file("crew_narrative.pdf")!.async("string")).toBe("bytes of crew-pdf");
    expect(await zip.file("audit_trail.pdf")!.async("string")).toBe("bytes of audit-pdf");
    expect(rendered.sort()).toEqual(
      ["audit-pdf", "crew-pdf", "markdown", "pdf", "quote", "xlsx"],
    );
    // The label beside the zip says what is in it (Rule 10).
    expect(bundleLabel()).toBe(`${names.length} files, with the quote`);
  });

  it("a sandbox plan's zip is named for its road, kind, day and fingerprint, with no 'mht'", async () => {
    const { res } = await bundle(SCENARIO);
    expect(res.headers.get("content-disposition")).toBe(
      `attachment; filename="East-Colfax-Avenue_shoulder_2026-10-27_${planFingerprint(SCENARIO)}_package.zip"`,
    );
  });

  it("a plan with a project name keeps it", async () => {
    const named = { ...SCENARIO, meta: { ...SCENARIO.meta, project: "Test Job" } } as Scenario;
    const { res } = await bundle(named);
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="Test_Job_package.zip"',
    );
  });
});
