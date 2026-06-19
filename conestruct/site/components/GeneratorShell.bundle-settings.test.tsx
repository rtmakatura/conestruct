// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { QuoteSettings } from "@/lib/quote-settings";

// Pins the two regressions surfaced in PR-1 smoke testing (issue #74), both
// rooted in the quote settings living in QuotePanel's local state:
//   1. "Generate package" POSTed { scenario } with no settings, so the bundle
//      route coerced DEFAULT rates and ignored the user's edits.
//   2. The generate cycle flipped status -> unmounted QuotePanel -> its
//      settings useState reinitialized to DEFAULT (and the auto-flagger /
//      auto-delivery effects re-ran), wiping the edited fields.
// A static renderToStaticMarkup test (the pattern used by the other component
// tests) can't exercise these — they live in effects and a real generate
// click — so this file opts into a DOM environment (happy-dom) via the
// per-file pragma above.

// Mock the sibling panels so the real GeneratorShell + real QuotePanel mount
// without dragging in Clerk (AppNav), mapbox (GeneratorSidebar), or the
// network-driven panels. The GeneratorSidebar stub exposes the one control
// the test drives: a button wired to onGenerate.
vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./OutputCards", () => ({ OutputCards: () => null }));
vi.mock("./AuditTrail", () => ({ AuditTrail: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));
vi.mock("./GeneratorSidebar", () => ({
  GeneratorSidebar: ({ onGenerate }: { onGenerate: () => void }) => (
    <button type="button" onClick={onGenerate}>
      Generate package
    </button>
  ),
}));

// Import after the mocks are registered (vi.mock is hoisted, but keep the
// real subject below the stubs for readability).
import { GeneratorShell } from "./GeneratorShell";

type BundleBody = { scenario: unknown; settings: QuoteSettings };

let bundleBody: BundleBody | null = null;

const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes("/api/render/bundle")) {
    bundleBody = JSON.parse(String(init?.body)) as BundleBody;
    return Promise.resolve({
      ok: true,
      status: 200,
      blob: async () => new Blob(["zip"]),
    } as unknown as Response);
  }
  // device-breakdown + audit fire on mount; keep them benign.
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

beforeEach(() => {
  bundleBody = null;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  // happy-dom implements neither, and onGenerate's blob-download dance touches
  // both; a real anchor click would also log a "navigation not implemented"
  // error, so stub it to a no-op.
  Object.defineProperty(URL, "createObjectURL", {
    value: () => "blob:mock",
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: () => {},
    configurable: true,
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function mountSandbox() {
  render(<GeneratorShell mode="sandbox" />);
  // Flush the device-breakdown + audit fetches fired on mount so their state
  // updates settle inside act() before we interact (two ticks: the fetch
  // promise, then res.json()).
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("GeneratorShell bundle download — live quote settings (#74)", () => {
  it("sends the user's edited rates to /api/render/bundle", async () => {
    const user = userEvent.setup();
    await mountSandbox();

    const overhead = screen.getByLabelText(/Overhead/i) as HTMLInputElement;
    fireEvent.change(overhead, { target: { value: "25" } });
    expect(overhead.value).toBe("25");

    await user.click(screen.getByText("Generate package"));

    await waitFor(() => expect(bundleBody).not.toBeNull());
    // 0.25, not the 0.10 default: the on-screen edit reached the bundle body.
    expect(bundleBody?.settings.overhead_pct).toBe(0.25);
  });

  it("keeps the edited rate field after a generate cycle", async () => {
    const user = userEvent.setup();
    await mountSandbox();

    const overhead = screen.getByLabelText(/Overhead/i) as HTMLInputElement;
    fireEvent.change(overhead, { target: { value: "25" } });

    await user.click(screen.getByText("Generate package"));
    await waitFor(() => expect(bundleBody).not.toBeNull());

    // Old bug: the generate cycle unmounted QuotePanel, reinitializing its
    // settings useState to DEFAULT and snapping this back to "10".
    expect(overhead.value).toBe("25");
  });

  it("preserves a manual flagger count and delivery distance through a generate cycle", async () => {
    const user = userEvent.setup();
    await mountSandbox();

    const flaggers = screen.getByLabelText(/Flaggers/i) as HTMLInputElement;
    const delivery = screen.getByLabelText(/Delivery/i) as HTMLInputElement;
    // Shoulder-scenario defaults: auto flaggers = 0, delivery = 20. Picking
    // values that differ from the auto/default makes a survival assertion
    // meaningful — if the auto-effects re-ran, flaggers would snap to 0.
    fireEvent.change(flaggers, { target: { value: "3" } });
    fireEvent.change(delivery, { target: { value: "99" } });
    expect(flaggers.value).toBe("3");
    expect(delivery.value).toBe("99");

    await user.click(screen.getByText("Generate package"));
    await waitFor(() => expect(bundleBody).not.toBeNull());

    // The edits reach the bundle...
    expect(bundleBody?.settings.num_flaggers).toBe(3);
    expect(bundleBody?.settings.delivery_distance_miles).toBe(99);
    // ...and survive the cycle. Old bug: the remount reset flaggerSource to
    // "auto" and delivery to "idle", so the auto-flagger effect (-> 0) and the
    // settings reinit (-> 20) re-clobbered the manual entries.
    expect(flaggers.value).toBe("3");
    expect(delivery.value).toBe("99");
  });
});
