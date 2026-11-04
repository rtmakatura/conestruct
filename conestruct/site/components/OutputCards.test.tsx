// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { OutputCards } from "./OutputCards";
import { BUNDLE_PART_KINDS, bundleLabel } from "@/lib/render-types";
import { planFingerprint } from "@/lib/download-name";
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
//
// #437 branch 3 (rulings 11-13): one DOWNLOADS section; each card's mono
// spec line and separate .qty line became ONE plain `.desc` sentence (a
// lead + " <b>N</b> noun."); titles are h4; single-file buttons read
// "Download ↓" and keep the whole action as their accessible name.

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
    // #437 branch 3 (ruling 12): the mono spec line ("11×17 · TA-3 ·
    // S-630-1", "CDOT BID-READY", ...) is gone; each card's .desc is one
    // plain sentence, its count the wire's figure in <b>.
    expect(plan.textContent).toContain("Plan sheet");
    expect(plan.querySelector(".desc")!.textContent).toBe(
      "The drawing for the crew and the permit. 42 devices.",
    );
    expect(plan.querySelector(".desc b")!.textContent).toBe("42"); // total_devices
    expect(plan.textContent).not.toContain("TA-3");
    expect(devices.textContent).toContain("Device list");
    expect(devices.querySelector(".desc")!.textContent).toBe(
      "What to load on the truck. 6 types, CDOT bid items.",
    );
    expect(devices.querySelector(".desc b")!.textContent).toBe("6"); // unique_types
    expect(crew.textContent).toContain("Crew instructions");
    expect(crew.querySelector(".desc")!.textContent).toBe("Setup and takedown, in order. 8 steps.");
    expect(crew.querySelector(".desc b")!.textContent).toBe("8"); // step_count
    // #261: the audit PDF is the fourth card — the deliverable a TCS
    // needs, on the same .dl-btn path as every other download.
    expect(audit.textContent).toContain("Audit trail");
    expect(audit.querySelector(".fmt")!.textContent).toBe("PDF");
    expect(audit.querySelector(".desc")!.textContent).toBe(
      "Every number and the rule behind it. 13 checks.",
    );
    expect(audit.querySelector(".desc b")!.textContent).toBe("13"); // auditChecked
    // No separate quantity line any more: the count lives in the sentence.
    expect(audit.querySelector(".qty")).toBeNull();
    // #437 branch 3: the plain line takes the note role.
    for (const c of cards(container)) {
      expect(c.querySelector(".desc")!.classList.contains("tr-note")).toBe(true);
    }
  });

  it("#437 ruling 12: a count of one takes the singular noun", () => {
    const { container } = renderPublic({
      breakdown: { state: "ready", data: { devices: [], total_devices: 1, unique_types: 1 } },
      summary: { ...SUMMARY, step_count: 1 },
      auditChecked: 1,
    });
    expect(cards(container).map((c) => c.querySelector(".desc")!.textContent)).toEqual([
      "The drawing for the crew and the permit. 1 device.",
      "What to load on the truck. 1 type, CDOT bid items.",
      "Setup and takedown, in order. 1 step.",
      "Every number and the rule behind it. 1 check.",
    ]);
  });

  it("#289 fidelity F4 (X8): no MHT PACKAGE heading — the file count is stated ONCE, beside the zip (ruling 193); the zip carries 6 parts", () => {
    // The zip (and the count riding it) renders only in public mode with
    // a download-all handler — pass one so the count is on the page.
    renderPublic({ onDownloadAll: () => {} });
    // #401: the zip carries every card's file plus quote.xlsx; the
    // count is stated ONCE (#253 / ruling 193).  The "MHT PACKAGE"
    // heading was the old results head's — rules 84–86 make the row the
    // four cards — so it is gone, and the count sits beside the zip it
    // counts.
    expect(BUNDLE_PART_KINDS.length).toBe(6);
    expect(screen.queryByText("MHT PACKAGE")).toBeNull();
    // Rule 168 (R137 Q1): two homes in the markup, beside the zip (the
    // desk) and the file-count line under it (the phone); CSS shows one
    // per width (components/rule-168.test.tsx).
    const homes = screen.getAllByText(bundleLabel());
    expect(homes).toHaveLength(2);
    expect(homes[0].classList.contains("dl-all-count")).toBe(true);
    expect(homes[1].closest(".dl-files")).not.toBeNull();
    expect(screen.queryByText(/\d (FILES|SHEETS)/)).toBeNull();
  });

  // #261 (P16 / Rule 10): no "…" and no "—" — a quantity the system has
  // not computed is left unsaid while it is on its way, and the honest
  // words "Not generated." with every download withheld when the
  // breakdown failed (the package cannot be built without it; F-S5-1's
  // "— devices" with live buttons).
  // #437 branch 3 (ruling 12 / D5): the reserved-height .qty line is
  // gone; a null count drops its sentence and the lead stands alone.
  it("loading: the counts the wire has not given are dropped; the buttons stand", () => {
    const { container: loading } = renderPublic({
      breakdown: { state: "loading" },
      summary: null,
    });
    const descs = cards(loading).map((c) => c.querySelector(".desc")!);
    expect(descs[0].textContent).toBe("The drawing for the crew and the permit."); // devices
    expect(descs[1].textContent).toBe("What to load on the truck."); // types
    expect(descs[2].textContent).toBe("Setup and takedown, in order."); // steps (null summary)
    expect(descs[3].textContent).toBe("Every number and the rule behind it. 13 checks.");
    for (const d of descs.slice(0, 3)) expect(d.querySelector("b")).toBeNull();
    expect(cards(loading)[0].textContent).not.toContain("…");
    expect((cards(loading)[0].querySelector(".dl-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("breakdown failed: every card says \"Not generated.\" and every button is disabled", () => {
    const { container: errored } = renderPublic({
      breakdown: { state: "error", message: "boom" },
      summary: null,
    });
    for (const card of cards(errored)) {
      // #437 branch 3: the words close the card's one sentence.
      const desc = card.querySelector(".desc")!.textContent!;
      expect(desc.endsWith(" Not generated.")).toBe(true);
      expect(card.querySelector(".desc b")).toBeNull();
      for (const b of Array.from(card.querySelectorAll(".dl-btn"))) {
        expect((b as HTMLButtonElement).disabled).toBe(true);
      }
    }
    expect(document.body.textContent).not.toContain("—");
  });

  it("breakdown failed, saved mode: the row-backed downloads are inert too", () => {
    const { container } = render(
      <OutputCards
        summary={SUMMARY}
        generated={true}
        mode={{ kind: "saved", planId: "plan-1" }}
        breakdown={{ state: "error", message: "boom" }}
        auditChecked={13}
      />,
    );
    // #203: fetch-driven buttons now, disabled like the public ones.
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".dl-card button.dl-btn"),
    );
    expect(buttons).toHaveLength(5);
    for (const b of buttons) expect(b.disabled).toBe(true);
    expect(container.querySelectorAll(".dl-card a")).toHaveLength(0);
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
    // #437 branch 3 (ruling 12): the single-file buttons read "Download ↓";
    // the accessible name keeps the whole action.
    expect(screen.getByRole("button", { name: "Download plan sheet PDF" }).textContent).toBe("Download↓");
    expect(screen.getByRole("button", { name: "Download device list XLSX" }).textContent).toBe("Download↓");
    expect(screen.getByRole("button", { name: "Download audit trail PDF" }).textContent).toBe("Download↓");
    expect(screen.queryByText("Download PDF")).toBeNull();
    // #329: the crew card's shared row says the format; the accessible
    // name keeps the whole action.
    const crewPdf = screen.getByRole("button", { name: "Download crew instructions PDF" });
    expect(crewPdf.textContent).toBe("PDF↓");

    fireEvent.click(screen.getByRole("button", { name: "Download crew instructions .md" }));
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

    const zip = screen.getByRole("button", { name: /Download all \(\.zip\)/ });
    fireEvent.click(zip);
    expect(onDownloadAll).toHaveBeenCalledTimes(1);

    cleanup();
    // #252: no "Bundling…" word on the button — the working band is the
    // one working voice; the button keeps its label and disables.
    renderPublic({ onDownloadAll, bundling: true });
    const busy = screen.getByRole("button", { name: /Download all \(\.zip\)/ }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(document.body.textContent).not.toMatch(/Bundling/);
  });

  // #437 branch 3 (rulings 11, 13): the warning row discloses open answers
  // without locking the files, and the price quote's row comes last.
  it("#437: the warning row names the open answers (files stay live); the quote slot renders last", () => {
    const { container } = renderPublic({ onDownloadAll: () => {}, pendingAnswers: 0 });
    expect(screen.queryByTestId("dl-warn")).toBeNull();
    expect(container.querySelector(".dl-quote")).toBeNull();
    cleanup();

    const one = renderPublic({ onDownloadAll: () => {}, pendingAnswers: 1 });
    expect(screen.getByTestId("dl-warn").textContent).toContain(
      "These files match the plan before your answer. Answer first and they'll update.",
    );
    for (const b of Array.from(one.container.querySelectorAll<HTMLButtonElement>(".dl-btn"))) {
      expect(b.disabled).toBe(false);
    }
    cleanup();

    const { container: c3 } = renderPublic({
      onDownloadAll: () => {},
      pendingAnswers: 3,
      quote: <div data-testid="quote-stub">Price quote</div>,
    });
    expect(screen.getByTestId("dl-warn").textContent).toContain("before your 3 answers.");
    const sec = c3.querySelector('[data-testid="downloads"]')!;
    expect(sec.lastElementChild!.classList.contains("dl-quote")).toBe(true);
    expect(sec.lastElementChild!.contains(screen.getByTestId("quote-stub"))).toBe(true);
    expect(screen.getByRole("button", { name: /Download all \(\.zip\)/ }).textContent).toBe(
      "Download all (.zip) ↓",
    );
  });

  it("saved mode with a plan id: cards download from the plan's routes and no zip button renders", async () => {
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
    // #203: buttons that GET the plan's routes (in card order), not
    // anchors that navigate the tab on a failure.
    expect(container.querySelectorAll(".dl-card a")).toHaveLength(0);
    const fetched: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        fetched.push(url);
        return Promise.resolve(new Response("x", { status: 200 }));
      }),
    );
    for (const b of Array.from(
      container.querySelectorAll<HTMLButtonElement>(".dl-card button.dl-btn"),
    )) {
      fireEvent.click(b);
      await waitFor(() => expect(b.disabled).toBe(false));
    }
    vi.unstubAllGlobals();
    expect(fetched).toEqual([
      "/api/plans/plan-1/pdf",
      "/api/plans/plan-1/xlsx",
      "/api/plans/plan-1/crew-pdf",
      "/api/plans/plan-1/markdown",
      "/api/plans/plan-1/audit-pdf",
    ]);
    // Ruling: a zip button that has no bundle route must not render.
    expect(screen.queryByText(/Download all \(\.zip\)/)).toBeNull();
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

  it("#289: renders NOTHING before generation — Part 1 §2.1's 'no download empty-state panel'", () => {
    const { container } = render(
      <OutputCards
        summary={null}
        generated={false}
        mode={{ kind: "public", scenario: SCENARIO }}
        breakdown={{ state: "loading" }}
      />,
    );
    expect(container.innerHTML).toBe("");
    expect(document.querySelector(".dl-card")).toBeNull();
  });

  it("#289: under a DECLINE it still says 'No package yet' — rule 120", () => {
    // The absence is an answer there: a package was asked for and
    // refused.  Before Generate nobody asked.
    render(
      <OutputCards
        summary={null}
        generated={false}
        declined
        mode={{ kind: "public", scenario: SCENARIO }}
        breakdown={{ state: "loading" }}
      />,
    );
    expect(screen.getByText("No package yet")).toBeTruthy();
    // And not the flow sentence, which is §8.30's dropped intro.
    expect(document.body.textContent).not.toContain("press generate");
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
    "Lane width 10.0 ft is below the 11 ft minimum for freeway work zones.";

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

  // #437 branch 3 (ruling 12): the section has its own heading
  // (DOWNLOADS), so each card title sits one level under it.  #438 item
  // 5: DOWNLOADS is a results section title, h2; the card titles are h3.
  it("the card title is an h3 under the DOWNLOADS h2 (no h2 or h4 inside a card)", () => {
    const { container } = renderPublic();
    expect(container.querySelectorAll(".dl-card h2, .dl-card h4")).toHaveLength(0);
    const h3 = Array.from(container.querySelectorAll(".dl-card > .top > h3")).map((h) => h.textContent);
    expect(h3).toEqual(cards(container).map((c) => c.querySelector(".top")!.firstElementChild!.textContent));
    expect(h3).toContain("Plan sheet");
    const sec = container.querySelector('[data-testid="downloads"]')!;
    expect(sec.querySelector(":scope > .dl-head > h2")!.textContent).toBe("DOWNLOADS");
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
    // #289 fidelity F2: rule 85's title is role 3 — 12.5 px (was 14).
    // #437 branch 3 (ruling 12): the title is at the body-value token, 600;
    // #438 item 5: the title is an h3 now, so no h4 rule is left on the card.
    expect(rule(".workbench .dl-card h3")).toContain("font-size: var(--fs-body-value)");
    expect(rule(".workbench .dl-card h3")).toContain("font-weight: 600");
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
// #401 (W11): a sandbox plan has no project name, and every card saved
// as plan.*, so two plans collided as "plan (1).pdf".  Clicked through the
// mounted cards: each file is named for the road, the kind, the day and a
// fingerprint of the plan, so two different plans never share a name.
describe("sandbox filenames (#401)", () => {
  const COLFAX = {
    kind: "shoulder",
    workLen: 500,
    meta: {
      project: "",
      work: { side: "right" },
      confirmedRoad: { candidate: { name: "East Colfax Avenue", ref: null } },
    },
  } as unknown as Scenario;

  async function savedNames(scenario: Scenario): Promise<string[]> {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 27, 12, 0));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(["x"]) })),
    );
    URL.createObjectURL = () => "blob:x";
    URL.revokeObjectURL = () => {};
    const downloads: string[] = [];
    const spy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });
    const { container, unmount } = renderPublic({ mode: { kind: "public", scenario } });
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>(".dl-btn"));
    for (const [i, b] of buttons.entries()) {
      fireEvent.click(b);
      await vi.waitFor(() => expect(downloads).toHaveLength(i + 1));
    }
    unmount();
    spy.mockRestore();
    vi.useRealTimers();
    return downloads;
  }

  it("every card's file is named road_kind_day_fingerprint when the plan has no project name", async () => {
    const base = `East-Colfax-Avenue_shoulder_2026-10-27_${planFingerprint(COLFAX)}`;
    expect(await savedNames(COLFAX)).toEqual([
      `${base}.pdf`,
      `${base}.xlsx`,
      `${base}.crew.pdf`,
      `${base}.md`,
      `${base}.audit.pdf`,
    ]);
  });

  it("two plans that differ only by side, or only by length, save under different names", async () => {
    const left = { ...COLFAX, meta: { ...COLFAX.meta, work: { side: "left" } } } as Scenario;
    const longer = { ...COLFAX, workLen: 800 } as Scenario;
    const [a, b, c] = [await savedNames(COLFAX), await savedNames(left), await savedNames(longer)];
    for (let i = 0; i < a.length; i += 1) {
      expect(new Set([a[i], b[i], c[i]]).size).toBe(3);
    }
  });

  it("the zip waits on the audit, as the audit card does (its PDF is in the zip)", () => {
    const { container } = renderPublic({ onDownloadAll: () => {}, auditChecked: null });
    const zip = container.querySelector<HTMLButtonElement>(".dl-all button")!;
    expect(zip.disabled).toBe(true);
    cleanup();
    const ready = renderPublic({ onDownloadAll: () => {}, auditChecked: 13 });
    expect(ready.container.querySelector<HTMLButtonElement>(".dl-all button")!.disabled).toBe(false);
  });
});

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

  it("no settled audit (auditChecked null): the count sentence is dropped, and the button is disabled", () => {
    const { container } = renderPublic({ auditChecked: null });
    const audit = cards(container)[3];
    // #437 branch 3 (ruling 12 / D5): no reserved .qty line; the lead
    // stands alone and no number is shown for a count the wire withheld.
    expect(audit.querySelector(".desc")!.textContent).toBe("Every number and the rule behind it.");
    expect(audit.querySelector(".desc b")).toBeNull();
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
