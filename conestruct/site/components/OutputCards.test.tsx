// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { OutputCards } from "./OutputCards";
import { BUNDLE_PART_KINDS } from "@/lib/render-types";
import type { AuditSummary } from "@/lib/render-types";
import type { Scenario } from "@/lib/scenarios";
import type { DeviceBreakdownState } from "./DeviceBreakdown";

// Zone 2 download cards (restage of the former sheet-index table).
// OutputCards previously had zero tests and was mocked to null in every
// GeneratorShell suite — the exact blind spot class that let the picker
// re-apply bug (#112) ship green through 198 tests.  These are
// mounted-flow tests of the rendered cards: real backend values in the
// right cards, the loading/error fallbacks, all three mode variants,
// and the bundle-count header rule.

const SUMMARY: AuditSummary = {
  ta: "TA-3",
  cdot_sheet: "S-630-1",
  case_id: "Case 11",
  taper_length_ft: 183,
  taper_label: "L/3 (shoulder taper)",
  buffer_space_ft: 495,
  device_spacing_taper_ft: 55,
  device_spacing_tangent_ft: 110,
  step_count: 8,
};

const READY_BREAKDOWN: DeviceBreakdownState = {
  state: "ready",
  data: { devices: [], total_devices: 42, unique_types: 6 },
};

// Minimal scenario stand-in: OutputCards treats it as an opaque payload
// (POSTed verbatim to /api/render/*); only meta.project is read, for
// the download filename.
const SCENARIO = { meta: { project: "Test Job" } } as unknown as Scenario;

function renderPublic(
  overrides: Partial<Parameters<typeof OutputCards>[0]> = {},
) {
  return render(
    <OutputCards
      summary={SUMMARY}
      generated={true}
      mode={{ kind: "public", scenario: SCENARIO }}
      breakdown={READY_BREAKDOWN}
      auditChecked={13}
      {...overrides}
    />,
  );
}

function cards(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll(".dl-card"));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("OutputCards download cards", () => {
  it("renders one card per deliverable with backend values", () => {
    const { container } = renderPublic();

    const [plan, devices, crew, audit] = cards(container);
    expect(cards(container)).toHaveLength(4);

    // Backend-sourced quantities land in the right cards.
    expect(plan.textContent).toContain("Plan sheet");
    expect(plan.textContent).toContain("42"); // total_devices
    expect(plan.textContent).toContain("TA-3"); // summary.ta in the spec line
    expect(plan.textContent).toContain("S-630-1"); // summary.cdot_sheet
    expect(devices.textContent).toContain("Device list");
    expect(devices.textContent).toContain("6"); // unique_types
    expect(crew.textContent).toContain("Crew instructions");
    expect(crew.textContent).toContain("8"); // step_count
    // #261: the audit PDF is the fourth card — the deliverable a TCS
    // needs, on the same .dl-btn path as every other download.
    expect(audit.textContent).toContain("Audit trail");
    expect(audit.textContent).toContain("EVERY CHECK CITED");
    expect(audit.querySelector(".fmt")!.textContent).toBe("PDF");
    expect(audit.querySelector(".desc b")!.textContent).toBe("13"); // auditChecked
    expect(audit.textContent).toContain("checks");
  });

  it("derives the header file count from the actual bundle contents, not the card count", () => {
    renderPublic();
    // The zip carries quote.xlsx in addition to the three cards — the
    // label must describe the package (4 files), never the grid.
    expect(BUNDLE_PART_KINDS.length).toBe(4);
    expect(
      screen.getByText(`MHT PACKAGE · ${BUNDLE_PART_KINDS.length} FILES`),
    ).toBeTruthy();
    expect(screen.queryByText(/3 (FILES|SHEETS)/)).toBeNull();
  });

  // #261 (P16 / Rule 10): no "…" and no "—" — a quantity the system has
  // not computed is an EMPTY line of reserved height while it is on its
  // way, and the honest word "not generated" with every download
  // withheld when the breakdown failed (the package cannot be built
  // without it; F-S5-1's "— devices" with live buttons).
  it("loading: the quantity lines are present and empty; the buttons stand", () => {
    const { container: loading } = renderPublic({
      breakdown: { state: "loading" },
      summary: null,
    });
    for (const card of cards(loading)) {
      expect(card.querySelector(".desc .qty")).not.toBeNull();
    }
    expect(cards(loading)[0].querySelector(".desc .qty")!.textContent).toBe(""); // devices
    expect(cards(loading)[1].querySelector(".desc .qty")!.textContent).toBe(""); // types
    expect(cards(loading)[2].querySelector(".desc .qty")!.textContent).toBe(""); // steps (null summary)
    expect(cards(loading)[3].querySelector(".desc .qty")!.textContent).toBe("13 checks");
    expect(cards(loading)[0].textContent).not.toContain("…");
    expect((cards(loading)[0].querySelector(".dl-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("breakdown failed: every card says \"not generated\" and every button is disabled", () => {
    const { container: errored } = renderPublic({
      breakdown: { state: "error", message: "boom" },
      summary: null,
    });
    for (const card of cards(errored)) {
      expect(card.querySelector(".desc .qty")!.textContent).toBe("not generated");
      for (const b of Array.from(card.querySelectorAll(".dl-btn"))) {
        expect((b as HTMLButtonElement).disabled).toBe(true);
      }
    }
    expect(document.body.textContent).not.toContain("—");
  });

  it("breakdown failed, saved mode: the row-backed anchors are inert too", () => {
    const { container } = render(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "saved", planId: "plan-1" }}
        breakdown={{ state: "error", message: "boom" }}
        auditChecked={13}
      />,
    );
    const anchors = Array.from(container.querySelectorAll(".dl-card a.dl-btn"));
    expect(anchors).toHaveLength(5);
    for (const a of anchors) {
      expect(a.getAttribute("aria-disabled")).toBe("true");
    }
  });

  it("no \"—\" and no \"done\" in any .dl-card .desc text node, in any state", () => {
    const states: Array<Partial<Parameters<typeof OutputCards>[0]>> = [
      {},
      { breakdown: { state: "loading" } },
      { breakdown: { state: "loading" }, summary: null },
      { breakdown: { state: "error", message: "boom" } },
      { breakdown: { state: "error", message: "boom" }, summary: null },
      { auditChecked: null },
      { mode: { kind: "saved", planId: "plan-1" } },
      { mode: { kind: "saved", planId: "plan-1", dirty: true } },
      { mode: { kind: "saved", planId: null } },
    ];
    for (const overrides of states) {
      cleanup();
      const { container } = renderPublic(overrides);
      expect(cards(container)).toHaveLength(4);
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode())) {
        if (!(n.parentElement as HTMLElement).closest(".dl-card .desc")) continue;
        const text = n.textContent ?? "";
        expect(text, JSON.stringify(overrides)).not.toContain("—");
        expect(text, JSON.stringify(overrides)).not.toMatch(/\bdone\b/i);
        expect(text, JSON.stringify(overrides)).not.toContain("…");
      }
    }
  });

  it("public mode: the crew card offers PDF plus a secondary .md download, and clicking posts the scenario", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderPublic();
    expect(screen.getAllByText("Download PDF")).toHaveLength(3); // plan + crew + audit
    expect(screen.getByText("Download XLSX")).toBeTruthy();

    fireEvent.click(screen.getByText("Download .md"));
    await screen.findByText("Try again");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/render/markdown",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ scenario: SCENARIO }),
      }),
    );
  });

  it("public mode: renders the All (.zip) button wired to the bundle handler, disabled while bundling", () => {
    const onDownloadAll = vi.fn();
    renderPublic({ onDownloadAll });

    const zip = screen.getByRole("button", { name: /All \(\.zip\)/ });
    fireEvent.click(zip);
    expect(onDownloadAll).toHaveBeenCalledTimes(1);

    cleanup();
    // #252: no "Bundling…" word on the button — the working band is the
    // one working voice; the button keeps its label and disables.
    renderPublic({ onDownloadAll, bundling: true });
    const busy = screen.getByRole("button", { name: /All \(\.zip\)/ }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(document.body.textContent).not.toMatch(/Bundling/);
  });

  it("saved mode with a plan id: cards link to the plan's download routes and no zip button renders", () => {
    const onDownloadAll = vi.fn();
    const { container } = render(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "saved", planId: "plan-1" }}
        breakdown={READY_BREAKDOWN}
        onDownloadAll={onDownloadAll}
      />,
    );
    const hrefs = Array.from(container.querySelectorAll(".dl-card a")).map(
      (a) => a.getAttribute("href"),
    );
    expect(hrefs).toEqual([
      "/api/plans/plan-1/pdf",
      "/api/plans/plan-1/xlsx",
      "/api/plans/plan-1/crew-pdf",
      "/api/plans/plan-1/markdown",
      "/api/plans/plan-1/audit-pdf",
    ]);
    // Ruling: a zip button that has no bundle route must not render.
    expect(screen.queryByText(/All \(\.zip\)/)).toBeNull();
  });

  it("saved mode without a plan id: each card funnels to signup", () => {
    const { container } = render(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "saved", planId: null }}
        breakdown={READY_BREAKDOWN}
      />,
    );
    const links = Array.from(
      container.querySelectorAll('.dl-card a[href="/app"]'),
    );
    expect(links).toHaveLength(4);
    expect(links[0].textContent).toContain("Sign up to download PDF");
    expect(links[3].textContent).toContain("Sign up to download PDF");
  });

  it("renders the empty state before generation", () => {
    render(
      <OutputCards
        summary={null}
        generated={false}
        mode={{ kind: "public", scenario: SCENARIO }}
        breakdown={{ state: "loading" }}
      />,
    );
    expect(screen.getByText("No package yet")).toBeTruthy();
    expect(document.querySelector(".dl-card")).toBeNull();
  });

  // #258 (P2/P3/P16): under a declined plan the empty state is the
  // headline alone — the refusal container above it holds the actions,
  // so "press generate" is not repeated; no card, no button, no "—".
  it("renders the declined empty state: headline only, no instruction, no placeholders", () => {
    render(
      <OutputCards
        summary={null}
        generated={false}
        declined
        mode={{ kind: "public", scenario: SCENARIO }}
        breakdown={{ state: "error", message: "declined" }}
      />,
    );
    expect(document.querySelector(".empty-state")!.textContent).toBe("No package yet");
    expect(document.querySelector(".dl-card")).toBeNull();
    expect(document.querySelector(".dl-btn")).toBeNull();
    expect(document.body.textContent).not.toContain("—");
  });
});

// #197 (umbrella instance, no standalone issue): a download error is an
// ANSWER — it was computed for the scenario that was POSTed.  When the
// scenario changes, presenting the old error (and its "Try again" label)
// as current is the stale-as-current class.  The error carries the #197
// input-identity stamp and renders only while its scenario is on screen.
describe("download errors carry their input identity (#197)", () => {
  const FLOOR_400 =
    "Work zone length (50 ft) is shorter than the required shoulder taper.";

  function fail400() {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ detail: { message: FLOOR_400 } }),
        } as unknown as Response),
      ),
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the error for the scenario it answered, then drops it when the scenario changes", async () => {
    fail400();
    const s1 = { meta: { project: "A" } } as unknown as Scenario;
    const s2 = { meta: { project: "A" } } as unknown as Scenario;
    const view = render(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "public", scenario: s1 }}
        breakdown={READY_BREAKDOWN}
      />,
    );
    fireEvent.click(document.querySelector(".dl-btn") as HTMLButtonElement);
    expect(await screen.findByText(FLOOR_400)).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();

    // The input changes (every edit replaces the scenario object): the
    // stale error and its Try-again label must not survive.
    view.rerender(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "public", scenario: s2 }}
        breakdown={READY_BREAKDOWN}
      />,
    );
    expect(screen.queryByText(FLOOR_400)).toBeNull();
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("the error stays while its own scenario stays (unchanged input keeps the honest failure)", async () => {
    fail400();
    const s1 = { meta: { project: "A" } } as unknown as Scenario;
    render(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "public", scenario: s1 }}
        breakdown={READY_BREAKDOWN}
      />,
    );
    fireEvent.click(document.querySelector(".dl-btn") as HTMLButtonElement);
    expect(await screen.findByText(FLOOR_400)).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });
});

// #261 (P4/P11): every card's actions live in ONE bottom-anchored row —
// the crew card's PDF + .md sit side by side inside it — so the first
// button of every card shares one top and one bottom edge (the audit
// measured 1589 / 1589 / 1537 / 1589 with the crew card's two stacked
// buttons; F-S3-4).  The row is the card's last child; any note (a 400's
// message, the unsaved-edits line) prints ABOVE the row so the edge
// never moves (P1, declared).  The card title is an h3 under the zone's
// h2 (axe heading-order, F-S3-19).
describe("the action row (#261a)", () => {
  const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n"); // CRLF-normalised
  const rule = (selector: string) => {
    const m = css.match(
      new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " \\{[^}]*\\}"),
    );
    expect(m, `no rule for ${selector}`).not.toBeNull();
    return m![0].replace(/\s+/g, " ");
  };

  it("every card ends in one .dl-actions row holding all of its buttons; the crew card's two are siblings in it", () => {
    const { container } = renderPublic();
    for (const card of cards(container)) {
      const rows = card.querySelectorAll(":scope > .dl-actions");
      expect(rows).toHaveLength(1);
      expect(card.lastElementChild).toBe(rows[0]);
      const inRow = rows[0].querySelectorAll(":scope > .dl-btn").length;
      expect(inRow).toBe(card.querySelectorAll(".dl-btn").length);
      expect(inRow).toBeGreaterThanOrEqual(1);
    }
    const crew = cards(container).find((c) => c.textContent!.includes("Crew instructions"))!;
    expect(crew.querySelectorAll(":scope > .dl-actions > .dl-btn")).toHaveLength(2);
  });

  it("a 400's message prints above the row, never after it (the edge holds — P1)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ detail: { message: "Work zone too short." } }),
        } as unknown as Response),
      ),
    );
    const { container } = renderPublic();
    fireEvent.click(document.querySelector(".dl-btn") as HTMLButtonElement);
    const msg = await screen.findByText("Work zone too short.");
    const card = msg.closest(".dl-card")!;
    expect(card.lastElementChild!.classList.contains("dl-actions")).toBe(true);
    expect(msg.compareDocumentPosition(card.lastElementChild!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll(".dl-card .dl-actions")).toHaveLength(cards(container).length);
  });

  it("saved mode with unsaved edits: the note prints above the row too", () => {
    const { container } = render(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "saved", planId: "plan-1", dirty: true }}
        breakdown={READY_BREAKDOWN}
      />,
    );
    for (const card of cards(container)) {
      expect(card.lastElementChild!.classList.contains("dl-actions")).toBe(true);
      expect(card.textContent).toContain("Unsaved edits");
    }
  });

  it("the card title is an h3 (one h2 per zone; no h4 anywhere in a card)", () => {
    const { container } = renderPublic();
    expect(container.querySelectorAll(".dl-card h4")).toHaveLength(0);
    const h3 = Array.from(container.querySelectorAll(".dl-card > .top > h3")).map((h) => h.textContent);
    expect(h3).toEqual(cards(container).map((c) => c.querySelector(".top")!.firstElementChild!.textContent));
    expect(h3).toContain("Plan sheet");
  });

  it("globals.css: the row is bottom-anchored flex with an 8px gap, its buttons share the row (flex: 1 1 0, no own margin), 44 px targets at phone width; the title rule follows the h3", () => {
    expect(rule(".workbench .dl-actions")).toContain("margin-top: auto");
    expect(rule(".workbench .dl-actions")).toContain("display: flex");
    expect(rule(".workbench .dl-actions")).toContain("gap: 8px");
    expect(rule(".workbench .dl-actions .dl-btn")).toContain("margin-top: 0");
    expect(rule(".workbench .dl-actions .dl-btn")).toContain("flex: 1 1 0");
    // Measured (s2-arc26 browser leg, 1440): a shared row is 112 px per
    // button at the 266 px card; "Download PDF ↓" needs 121 at the card's
    // 9 px inset and 8 px gap and wrapped to 60 px.  Shared-row buttons
    // trim to a 4 px inset and gap (107 px) so the row stays 40 px.
    expect(rule(".workbench .dl-actions .dl-btn:not(:only-child)")).toContain("padding-left: 4px");
    expect(rule(".workbench .dl-actions .dl-btn:not(:only-child)")).toContain("padding-right: 4px");
    expect(rule(".workbench .dl-actions .dl-btn:not(:only-child)")).toContain("gap: 4px");
    expect(rule(".workbench .dl-card h3")).toContain("font-size: 14px");
    expect(css).not.toMatch(/\.dl-card h4/);
    const phone = css.slice(css.indexOf(".workbench .dl-actions {"));
    const q = phone.slice(phone.indexOf("@media (max-width: 480px)"));
    expect(q.slice(0, q.indexOf("}\n}") + 3).replace(/\s+/g, " ")).toContain(
      ".workbench .dl-actions .dl-btn { min-height: 44px; }",
    );
  });
});

// #261 (P11): the audit PDF moves from a mono text link inside the
// Checked & passed tier body (TieredReference.tsx:546-561, two clicks
// from the settled page) to the fourth card.  The POST body relocates
// byte-identical (`{ scenario }` — the same object the tier sent), the
// filename is auditFilename's (`<project>.audit.pdf`, so the browser
// never dedupes it against the plan sheet), and the quantity is the ✓
// tier's count — assignTiers' ledger.checked, handed in by the shell
// (the same token the audit-PDF cover prints).  Null (no settled audit
// for the input on screen — first load, or failed) prints an EMPTY
// quantity line of reserved height (P1/P16: no placeholder number) and
// disables the button: an audit that has not answered has no PDF.
describe("the audit card (#261b)", () => {
  it("clicking Download on the audit card POSTs { scenario } to /api/render/audit-pdf and saves <project>.audit.pdf", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => new Blob(["x"]),
    }));
    vi.stubGlobal("fetch", fetchMock);
    URL.createObjectURL = () => "blob:x";
    URL.revokeObjectURL = () => {};
    const downloads: string[] = [];
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });

    const { container } = renderPublic();
    const audit = cards(container)[3];
    fireEvent.click(audit.querySelector(".dl-btn") as HTMLButtonElement);
    await vi.waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/render/audit-pdf",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ scenario: SCENARIO }),
      }),
    );
    expect(downloads).toEqual(["Test_Job.audit.pdf"]);
  });

  it("no settled audit (auditChecked null): the quantity line is empty but present, and the button is disabled", () => {
    const { container } = renderPublic({ auditChecked: null });
    const audit = cards(container)[3];
    const qty = audit.querySelector(".desc .qty")!;
    expect(qty).not.toBeNull();
    expect(qty.textContent).toBe("");
    expect(audit.textContent).not.toContain("checks");
    expect((audit.querySelector(".dl-btn") as HTMLButtonElement).disabled).toBe(true);
    // The other cards are untouched by the audit's state.
    expect((cards(container)[0].querySelector(".dl-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("globals.css: four columns at desk, one at <= 980px", () => {
    const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8").replace(/\r\n/g, "\n");
    const dls = css.match(/\.workbench \.dls \{[^}]*\}/)![0].replace(/\s+/g, " ");
    expect(dls).toContain("grid-template-columns: repeat(4, 1fr)");
    const fromDls = css.slice(css.indexOf(".workbench .dls {"));
    const narrow = fromDls.slice(fromDls.indexOf("@media (max-width: 980px)"));
    expect(narrow.slice(0, narrow.indexOf("}\n}") + 3).replace(/\s+/g, " ")).toContain(
      ".workbench .dls { grid-template-columns: 1fr; }",
    );
  });
});
