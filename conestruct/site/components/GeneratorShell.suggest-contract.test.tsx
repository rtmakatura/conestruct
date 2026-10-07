// @vitest-environment happy-dom
//
// R108 / R110 — the pin GUESSES the jurisdiction; it never asks to be
// confirmed.  Payload-level, mounted-flow assertions (Rule 11).
//
// Authority: validation-artifacts/committed/setup-what-redesign/rulings.md.
// R108: "Street class (from the road) and jurisdiction (from the pin) are
// prefilled ... and the operator changes them if they're wrong ... If the
// pin has no jurisdiction guess, the field stays '◌ not set', as today."
// R110 Q1: the wire carries the raw fact of each untouched guess (the pin
// it was guessed at), which the backend re-derives; Q4: "Never overwrite
// a value the operator set."
//
// This suite replaces Endeavor B's "suggest never sets / Confirm is the
// only writer" contract, which R108 supersedes (checkpoint §3, rows 3, 5,
// 6, 7, 11).  What carries over whole: the lookup failing leaves the
// picker exactly as it works without it, and no pin means no lookup.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Scenario } from "@/lib/scenarios";
import { DEFAULT_SCENARIO } from "@/lib/scenarios";
import { setJurisdictionByOperator } from "@/lib/scenarios/guesses";
import { JurisdictionEvidence, type JurisdictionLookup } from "./JurisdictionSection";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./QuotePanel", () => ({ QuotePanel: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

const DENVER_PIN = { lat: 39.7392, lng: -104.9903 };
const PARKER_PIN = { lat: 39.5186, lng: -104.7614 };

// The sidebar stub stands in for the column: pin drops through the REAL
// setScenario (the picker's write path), the jurisdiction select through
// the REAL operator writer the WHAT band uses, and the lookup's evidence
// as the band renders it.
vi.mock("./GeneratorSidebar", () => ({
  GeneratorSidebar: ({
    scenario,
    setScenario,
    jurisdictionLookup,
  }: {
    scenario: Scenario;
    setScenario: (s: Scenario) => void;
    jurisdictionLookup?: JurisdictionLookup;
  }) => (
    <div>
      {(
        [
          ["stub-drop-pin-denver", DENVER_PIN],
          ["stub-drop-pin-parker", PARKER_PIN],
        ] as const
      ).map(([label, pin]) => (
        <button
          key={label}
          type="button"
          onClick={() =>
            setScenario({
              ...scenario,
              // #290: the side a located plan carries.
              meta: { ...scenario.meta, ...pin, work: { side: "right", heading: "N" } },
            })
          }
        >
          {label}
        </button>
      ))}
      <label htmlFor="what-jurisdiction">Jurisdiction</label>
      <select
        id="what-jurisdiction"
        value={scenario.jurisdiction_key ?? ""}
        onChange={(e) =>
          setScenario(setJurisdictionByOperator(scenario, e.target.value || null))
        }
      >
        <option value="">Not set: MUTCD + CDOT only</option>
        <option value="denver">Denver</option>
        <option value="parker">Parker</option>
      </select>
      {jurisdictionLookup && <JurisdictionEvidence lookup={jurisdictionLookup} />}
    </div>
  ),
}));

import { GeneratorShell } from "./GeneratorShell";

const SUGGEST_DENVER = {
  suggestion: "denver",
  reason:
    "Pin is inside Denver municipal limits (US Census TIGER/Line Place boundaries, 2025 vintage).",
  confidence: "inside",
  distance_to_boundary_ft: 17288.2,
  warnings: [],
  boundary_source: {
    source: "US Census TIGER/Line Place boundaries",
    vintage: "2025",
  },
};

type Wire = {
  jurisdiction_key?: string | null;
  guesses?: { jurisdiction_key?: { lat: number; lng: number } } | null;
  meta: { lat: number; lng: number };
};

let bodies: Wire[] = [];
let suggestCalls = 0;
let suggestResponse: () => Response;

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes("/api/jurisdiction/suggest")) {
    suggestCalls += 1;
    return Promise.resolve(suggestResponse());
  }
  if (url.includes("/api/render/")) {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (body?.scenario) bodies.push(body.scenario as Wire);
  }
  return Promise.resolve(jsonResponse(200, {}));
});

beforeEach(() => {
  bodies = [];
  suggestCalls = 0;
  suggestResponse = () => jsonResponse(200, SUGGEST_DENVER);
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  // THE INVARIANT, over every payload any case sent: a pin guess on the
  // wire names that payload's own pin and a filled field — never a stale
  // one (the backend would refuse it with guess_stale).
  for (const b of bodies) {
    const g = b.guesses?.jurisdiction_key;
    if (!g) continue;
    expect(g).toEqual({ lat: b.meta.lat, lng: b.meta.lng });
    expect(b.jurisdiction_key).toBeTruthy();
  }
  cleanup();
  vi.unstubAllGlobals();
});

const select = () => document.querySelector("#what-jurisdiction") as HTMLSelectElement;
const last = () => bodies[bodies.length - 1];

describe("the pin guesses the jurisdiction (R108)", () => {
  it("a pin dropped in this session fills an empty field and relays the pin it came from", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    await user.click(screen.getByText("stub-drop-pin-denver"));
    await waitFor(() => expect(select().value).toBe("denver"), { timeout: 3000 });
    await waitFor(() => expect(last()?.jurisdiction_key).toBe("denver"));
    expect(last().guesses?.jurisdiction_key).toEqual(DENVER_PIN);
    expect(suggestCalls).toBe(1);
    // No confirm step anywhere.
    expect(screen.queryByRole("button", { name: /^Confirm/ })).toBeNull();
    // The evidence and the TIGER caveat still ride along (Rule 10).
    expect(screen.getByText(/Boundary data is approximate/)).toBeTruthy();
  });

  it("never overwrites the operator's jurisdiction (R110 Q4)", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    await user.selectOptions(select(), "parker");
    await user.click(screen.getByText("stub-drop-pin-denver"));
    await waitFor(() => expect(suggestCalls).toBe(1), { timeout: 3000 });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(select().value).toBe("parker");
    await waitFor(() => expect(last()?.jurisdiction_key).toBe("parker"));
    expect(last().guesses?.jurisdiction_key).toBeUndefined();
  });

  it("the operator's change replaces the guess and drops its record", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    await user.click(screen.getByText("stub-drop-pin-denver"));
    await waitFor(() => expect(select().value).toBe("denver"), { timeout: 3000 });
    await user.selectOptions(select(), "parker");
    await waitFor(() => expect(last()?.jurisdiction_key).toBe("parker"));
    expect(last().guesses ?? null).toBeNull();
  });

  it("a moved pin drops the old guess in the same write, then guesses again", async () => {
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    await user.click(screen.getByText("stub-drop-pin-denver"));
    await waitFor(() => expect(select().value).toBe("denver"), { timeout: 3000 });
    suggestResponse = () => jsonResponse(200, { ...SUGGEST_DENVER, suggestion: "parker" });
    await user.click(screen.getByText("stub-drop-pin-parker"));
    await waitFor(() => expect(select().value).toBe("parker"), { timeout: 3000 });
    await waitFor(() => expect(last()?.guesses?.jurisdiction_key).toEqual(PARKER_PIN));
    // The afterEach invariant holds over the whole sequence: no payload
    // carried Denver's pin with Parker's coordinates.
  });

  it("no answer for the pin leaves the field not set", async () => {
    suggestResponse = () =>
      jsonResponse(200, { ...SUGGEST_DENVER, suggestion: null, confidence: "outside" });
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    await user.click(screen.getByText("stub-drop-pin-denver"));
    await waitFor(() => expect(suggestCalls).toBe(1), { timeout: 3000 });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(select().value).toBe("");
    for (const b of bodies) expect(b.jurisdiction_key ?? null).toBeNull();
  });

  it("lookup failure: nothing is filled in, and the picker works as it does without it", async () => {
    suggestResponse = () => jsonResponse(500, { detail: "boom" });
    const user = userEvent.setup();
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    await user.click(screen.getByText("stub-drop-pin-denver"));
    await waitFor(() => expect(suggestCalls).toBe(1), { timeout: 3000 });
    await waitFor(() => expect(screen.queryByText(/Checking boundary data/)).toBeNull());
    expect(screen.getByText(/The boundary lookup didn't answer/)).toBeTruthy();
    expect(select().value).toBe("");
    await user.selectOptions(select(), "parker");
    await waitFor(() => expect(last()?.jurisdiction_key).toBe("parker"));
  });

  it("no pin (default 0/0): no lookup ever fires", async () => {
    render(<GeneratorShell mode="sandbox" initialScenario={DEFAULT_SCENARIO} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 600));
    });
    expect(suggestCalls).toBe(0);
    expect(screen.getByText(/Drop a site pin to look up the jurisdiction/)).toBeTruthy();
  });
});
