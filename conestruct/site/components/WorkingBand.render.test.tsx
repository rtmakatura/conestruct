// @vitest-environment happy-dom
//
// #252 (s2-arc23, GO ruling a: RENDERING) — a file render is a server
// request too.  While one is open the band says RENDERING · {file} and
// the lock holds; the per-button busy words are gone (one voice); a
// plan request outranks a render in the sentence.  Mounted through the
// real shell, cards, pricing panel and tiered reference.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));
vi.mock("./GeneratorSidebar", () => ({
  GeneratorSidebar: ({ onGenerate }: { onGenerate: () => void }) => (
    <button type="button" onClick={onGenerate}>
      Generate package
    </button>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";
import { PINNED_SHOULDER } from "./test-fixtures";

const AUDIT = {
  summary: { ta: "TA-3", cdot_sheet: "S-630-1" },
  sections: {
    taper: {},
    buffer: {},
    spacing: {},
    advance: {},
    colorado: {},
    case: {},
    flagger: {},
    corridor_validation: { checked: false, warnings: [] },
    geometry_validation: { violations: [], all_pass: true },
    site_scan: {
      status: "ok",
      mode: "corridor",
      measured_at: "2026-09-04T12:00:00+00:00",
      buckets: {
        intersections: { detected: false, count: 0 },
        interchanges: { detected: false, count: 0 },
        sidewalks: { detected: false, count: 0 },
        bike_facilities: { detected: false, count: 0 },
        schools: { detected: false, count: 0 },
      },
      flags: {},
      corrections: [],
    },
  },
  pending_verification: { count: 0, note: "", tracking_issue: null },
  plan_flags: { validation_warnings: 0, compliance_fails: 0, v1_limitations: 0, is_clean: true },
};
const BREAKDOWN = {
  devices: [],
  total_devices: 4,
  unique_types: 2,
  zone_geometry: { taper_l_ft: 1, buffer_b_ft: 1, device_spacing_ft: 1, work_len_ft: 1 },
};
const ok = (data: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => "",
    blob: async () => new Blob(["x"]),
  }) as unknown as Response;
type Held = { promise: Promise<Response>; release: () => void };
function hold(data: unknown = {}, good = true): Held {
  let release!: () => void;
  const promise = new Promise<Response>((r) => {
    release = () => r(good ? ok(data) : ({ ok: false, status: 500, text: async () => "" } as unknown as Response));
  });
  return { promise, release };
}
// Every file render is held until the test releases it.
let renders: Record<string, Held> = {};
let auditHeld: Held | null = null;
const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/audit-pdf")) return (renders["audit-pdf"] ??= hold()).promise;
  // The preview's answer shape is the quote panel's business: a failed
  // preview closes the request just the same, which is all this suite asks.
  if (url.includes("/api/render/quote-breakdown")) return (renders["quote-breakdown"] ??= hold({}, false)).promise;
  if (url.includes("/api/render/audit")) return auditHeld ? auditHeld.promise : Promise.resolve(ok(AUDIT));
  if (url.includes("/api/render/device-breakdown")) return Promise.resolve(ok(BREAKDOWN));
  const m = url.match(/\/api\/render\/([a-z-]+)/);
  if (m) return (renders[m[1]] ??= hold()).promise;
  return Promise.resolve(ok({}));
});
beforeEach(() => {
  fetchMock.mockClear();
  renders = {};
  auditHeld = null;
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = () => "blob:x";
  URL.revokeObjectURL = () => {};
  Element.prototype.scrollIntoView = function () {};
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400));
  });
}
async function generate() {
  render(<GeneratorShell mode="sandbox" initialScenario={PINNED_SHOULDER} />);
  await settle();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Generate package" }));
  await settle();
  expect(document.querySelector(".working-band")).toBeNull();
  return user;
}
const band = () => document.querySelector(".working-band");
const verb = () => band()?.querySelector(".wb-verb")?.textContent ?? null;
const object = () => band()?.querySelector(".wb-object")?.textContent ?? null;
const locked = () => document.querySelector(".workbench")!.classList.contains("ws-locked");
async function releaseRender(kind: string) {
  await act(async () => {
    renders[kind].release();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("#252 — RENDERING: a file render raises the band and the lock", () => {
  it("a per-file render says RENDERING · {file}, locks the page, and the band leaves with the response; the button never says 'Rendering…'", async () => {
    const user = await generate();
    const pdf = screen.getAllByRole("button", { name: /Download PDF/ })[0];
    await user.click(pdf);
    expect(band()).not.toBeNull();
    expect(verb()).toBe("RENDERING");
    expect(object()).toBe("plan sheet PDF");
    expect(locked()).toBe(true);
    expect(document.body.textContent).not.toMatch(/Rendering…|Bundling…|Calculating…/);
    // Every download button is a locked write while the file renders.
    for (const b of screen.getAllByRole("button", { name: /Download/ })) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
    await releaseRender("pdf");
    expect(band()).toBeNull();
    expect(locked()).toBe(false);
    expect(document.body.textContent).not.toMatch(/Rendering…/);
  });

  it("the zip, the quote preview, the quote XLSX and the audit PDF each name their file", async () => {
    const user = await generate();
    await user.click(screen.getByRole("button", { name: /All \(\.zip\)/ }));
    expect(object()).toBe("MHT package ZIP");
    await releaseRender("bundle");
    expect(band()).toBeNull();

    await user.click(screen.getByRole("button", { name: /Pricing quote/i }));
    await user.click(screen.getByRole("button", { name: "Preview breakdown" }));
    expect(object()).toBe("quote preview");
    await releaseRender("quote-breakdown");
    expect(band()).toBeNull();
    await user.click(screen.getByRole("button", { name: /Download Quote/ }));
    expect(object()).toBe("quote XLSX");
    await releaseRender("quote");
    expect(band()).toBeNull();

    // #261: the audit PDF is the fourth download card; the band object
    // "audit PDF" relocates with it byte-identical (lib/working-band.ts
    // untouched — the string lives in the caller).  The tier body no
    // longer carries a link.
    expect(screen.queryByRole("button", { name: /Audit PDF/ })).toBeNull();
    const auditCard = document.querySelectorAll(".dl-card")[3] as HTMLElement;
    expect(auditCard.textContent).toContain("Audit trail");
    await user.click(auditCard.querySelector(".dl-btn") as HTMLButtonElement);
    expect(object()).toBe("audit PDF");
    await releaseRender("audit-pdf");
    expect(band()).toBeNull();
    expect((auditCard.querySelector(".dl-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("a render closing hands the page back; the next plan request speaks in its own voice (precedence over an open render is the unit test's)", async () => {
    const user = await generate();
    await user.click(screen.getAllByRole("button", { name: /Download PDF/ })[0]);
    expect(object()).toBe("plan sheet PDF");
    // Under the lock no edit can open a plan request alongside the
    // render, so the two never co-exist from the UI; the ordering when
    // they do is lib/working-band.test.ts's case.  Here: the render
    // closes, the lock lifts, an edit opens the plan pair.
    auditHeld = hold(AUDIT);
    await releaseRender("pdf");
    expect(band()).toBeNull();
    await user.click(screen.getByRole("button", { name: /Edit Speed/i }));
    await user.selectOptions(screen.getByLabelText("Speed"), "35");
    await settle();
    expect(verb()).toBe("RE-GENERATING");
    expect(object()).toBe("after an edit to speed");
    await act(async () => {
      auditHeld!.release();
    });
    await settle();
    expect(band()).toBeNull();
  });
});
