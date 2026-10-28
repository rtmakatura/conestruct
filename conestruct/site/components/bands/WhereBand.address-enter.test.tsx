// @vitest-environment happy-dom
//
// #402: Enter in the WHERE band's "Address or cross streets" field did
// nothing.  The field only stored `meta.address`; the search lives in the
// picker, which "Pick on map" opens (ruling 189: one door onto the pin).
// Enter now opens the same picker, which is handed the typed text as its
// address (and, with a map, searches it on open, as it does for the button).
//
// Mounted flow (Rule 11): the sandbox shell, the WHERE band's real field.
// The picker is mocked to show whether it is open and the address it was
// handed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SCENARIO } from "@/lib/scenarios";
import { GeneratorShell } from "../GeneratorShell";
import { openWhere } from "../__fixtures__/band-helpers";
import { corridorGeometryResponse, withOperatorSpeed } from "../test-fixtures";

vi.mock("../AppNav", () => ({ AppNav: () => null }));
vi.mock("../AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("../AppFooter", () => ({ AppFooter: () => null }));
vi.mock("../StatusBar", () => ({ StatusBar: () => null }));
vi.mock("../OutputCards", () => ({ OutputCards: () => null }));
vi.mock("../TieredReference", () => ({ TieredReference: () => null }));
vi.mock("../DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));
vi.mock("../LocationPickerModal", () => ({
  LocationPickerModal: ({
    open,
    initial,
  }: {
    open: boolean;
    initial: { address?: string };
  }) =>
    open ? (
      <div data-testid="picker-mock" data-address={initial.address ?? ""} />
    ) : null,
}));

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/render/corridor-geometry")) {
    return Promise.resolve(corridorGeometryResponse());
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({}),
  } as unknown as Response);
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const TYPED = "1600 E Colfax Ave, Denver";
const picker = () => screen.queryByTestId("picker-mock");

async function mountWhere() {
  const user = userEvent.setup();
  render(<GeneratorShell mode="sandbox" initialScenario={withOperatorSpeed(DEFAULT_SCENARIO)} />);
  await act(async () => {
    await Promise.resolve();
  });
  await openWhere();
  return user;
}

describe("#402: Enter in the band's address field", () => {
  it("opens the picker with the typed text as its address", async () => {
    const user = await mountWhere();
    const field = screen.getByLabelText("Address or cross streets");
    await user.type(field, TYPED);
    expect(picker()).toBeNull();

    await user.keyboard("{Enter}");

    expect(picker()).not.toBeNull();
    expect(picker()!.getAttribute("data-address")).toBe(TYPED);
  });

  it("is the same door as Pick on map (button unchanged)", async () => {
    const user = await mountWhere();
    await user.type(screen.getByLabelText("Address or cross streets"), TYPED);
    await user.click(screen.getByTestId("where-open-picker"));

    expect(picker()).not.toBeNull();
    expect(picker()!.getAttribute("data-address")).toBe(TYPED);
  });

  it("does nothing while an input method is composing, or for other keys", async () => {
    const user = await mountWhere();
    const field = screen.getByLabelText("Address or cross streets");
    await user.type(field, TYPED);

    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    expect(picker()).toBeNull();
    fireEvent.keyDown(field, { key: "a" });
    expect(picker()).toBeNull();
  });
});
