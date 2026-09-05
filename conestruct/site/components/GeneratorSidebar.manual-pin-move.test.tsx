// @vitest-environment happy-dom
//
// fix-224-manual-pin-move (Refs #224): a coordinate typed into the
// Location step's manual entry is a pin move and clears the operator's
// site-condition corrections exactly as the picker's Save does — both
// doors call withPin.  The s2-arc18 prod J1 finding: the manual fields
// wrote meta.lat through setMeta and bypassed the clearing.  Mounted
// through the REAL GeneratorSidebar inside GeneratorShell: the test types
// into the Latitude field and reads what the bundle request carries.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SHOULDER } from "@/lib/scenarios";
import type { ShoulderScenario } from "@/lib/scenarios/types";

vi.mock("./AppNav", () => ({ AppNav: () => null }));
vi.mock("./AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("./AppFooter", () => ({ AppFooter: () => null }));
vi.mock("./StatusBar", () => ({ StatusBar: () => null }));
vi.mock("./OutputCards", () => ({
  OutputCards: ({ onDownloadAll }: { onDownloadAll?: () => void }) => (
    <button type="button" onClick={onDownloadAll}>
      ALL_ZIP
    </button>
  ),
}));
vi.mock("./TieredReference", () => ({ TieredReference: () => null }));
vi.mock("./DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));
vi.mock("./LocationPickerModal", () => ({ LocationPickerModal: () => null }));

import { GeneratorShell } from "./GeneratorShell";

type BundleBody = { scenario: ShoulderScenario };
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
  return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as unknown as Response);
});

beforeEach(() => {
  bundleBody = null;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(URL, "createObjectURL", { value: () => "blob:mock", configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const CORRECTIONS = [
  {
    flag: "pedestrian_facility" as const,
    action: "dismiss" as const,
    reason: "fenced" as const,
    recorded_at: "2026-09-04T12:00:00+00:00",
  },
];

async function mountPinnedWithCorrections() {
  render(
    <GeneratorShell
      mode="sandbox"
      initialScenario={{
        ...DEFAULT_SHOULDER,
        meta: {
          ...DEFAULT_SHOULDER.meta,
          lat: 39.7113,
          lng: -105.0815,
          bearingDeg: 180,
          siteConditionOverrides: CORRECTIONS,
        },
      }}
    />,
  );
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}
// The manual entry's Latitude input: the label's sibling input (the same
// structure the live check drives with label:text-is("Latitude")).
const latInput = () => {
  const label = Array.from(document.querySelectorAll("label")).find(
    (l) => l.textContent?.trim() === "Latitude",
  );
  if (!label) throw new Error("no Latitude label — is the manual entry open?");
  return label.parentElement!.querySelector("input")!;
};
async function generate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText("Generate plan"));
  await user.click(screen.getByText("ALL_ZIP"));
  await waitFor(() => expect(bundleBody).not.toBeNull());
  return bundleBody!.scenario;
}

describe("manual coordinate entry is a pin move (fix-224-manual-pin-move)", () => {
  it("typing a new latitude drops siteConditionOverrides; re-typing the same value keeps them", async () => {
    const user = userEvent.setup();
    await mountPinnedWithCorrections();
    // The pinned Location step's manual entry.
    await user.click(screen.getByRole("button", { name: "Edit manually" }));
    expect(screen.getByText("Hide manual entry")).toBeTruthy();
    // Control first: the same coordinate is not a move.
    fireEvent.change(latInput(), { target: { value: "39.7113" } });
    let sent = await generate(user);
    expect(sent.meta.lat).toBe(39.7113);
    expect(sent.meta.siteConditionOverrides).toEqual(CORRECTIONS);
    // The move.
    await user.click(screen.getByText(/Edit full setup/));
    // Reopen remounts the Location step with the manual panel closed.
    await user.click(screen.getByRole("button", { name: "Edit manually" }));
    fireEvent.change(latInput(), { target: { value: "39.7114" } });
    bundleBody = null;
    sent = await generate(user);
    expect(sent.meta.lat).toBe(39.7114);
    expect("siteConditionOverrides" in sent.meta).toBe(false);
  });
});
