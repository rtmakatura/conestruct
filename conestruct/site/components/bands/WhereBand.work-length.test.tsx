// @vitest-environment happy-dom
//
// #403: a negative work-zone length is refused as one, not as missing.
//
// Mounted flow (Rule 11): the sandbox shell, a pin, a side, then the WHERE
// band's "Work zone length (ft)" field.  Typing -5 and leaving the field
// used to read "◌ not set" with "Work zone length is required." under the
// field and under Generate, beside a box showing -5.  The bound is the
// backend's (`workLen: float = Field(gt=0.0, ...)`, src/api/schemas.py);
// the message names it.  A cleared field (written as 0) still reads
// "required", and the 20,000 ft cap keeps its own message.
//
// #428: a typed 0 used to vanish from the box and read as the cleared
// field ("◌ not set", "required").  It now stays in the box as 0 and
// reads "more than 0 ft"; only an emptied box reads "required".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SCENARIO } from "@/lib/scenarios";
import { GeneratorShell } from "../GeneratorShell";
import { answerSide, openWhere } from "../__fixtures__/band-helpers";
import { corridorGeometryResponse, withOperatorSpeed } from "../test-fixtures";


vi.mock("../AppNav", () => ({ AppNav: () => null }));
vi.mock("../AppSheetMeta", () => ({ AppSheetMeta: () => null }));
vi.mock("../AppFooter", () => ({ AppFooter: () => null }));
vi.mock("../StatusBar", () => ({ StatusBar: () => null }));
vi.mock("../OutputCards", () => ({ OutputCards: () => null }));
vi.mock("../TieredReference", () => ({ TieredReference: () => null }));
vi.mock("../DeviceBreakdown", () => ({ DeviceBreakdown: () => null }));
vi.mock("../LocationPickerModal", () => ({
  LocationPickerModal: ({ onSave }: { onSave: (r: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSave({
          address: "1600 E Colfax Ave, Denver",
          lat: 39.74003,
          lng: -104.96555,
          // #290: the picker carries no length.
          classification: null,
          overrides: {},
        })
      }
    >
      APPLY_PIN
    </button>
  ),
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

async function mountAndPin() {
  const user = userEvent.setup();
  render(<GeneratorShell mode="sandbox" initialScenario={withOperatorSpeed(DEFAULT_SCENARIO)} />);
  await act(async () => {
    await Promise.resolve();
  });
  await openWhere();
  await user.click(screen.getByText("Pick on map"));
  await user.click(screen.getByText("APPLY_PIN"));
  await answerSide();
  await openWhere();
  return user;
}

async function commitLength(user: ReturnType<typeof userEvent.setup>, typed: string) {
  const field = document.getElementById("band-worklen") as HTMLInputElement;
  await user.clear(field);
  if (typed !== "") await user.type(field, typed);
  await user.tab();
  return field;
}

// The field's own error line (FieldErrorLine, role="alert", "⚠ " + message)
// inside the work-length cell, and the Generate band's blocker line.
const fieldAlert = () =>
  document
    .getElementById("band-worklen")!
    .closest(".a-col")!
    .querySelector('[role="alert"]')?.textContent ?? null;
const marker = () => screen.getByTestId("info-toggle-worklen").textContent;
const ctaReason = () =>
  document.querySelector('[data-testid="cta-reason"]')?.textContent ?? null;

const MORE_THAN_0 = "Work zone length must be more than 0 ft.";
const REQUIRED = "Work zone length is required.";

describe("#403: the work-zone length field says what is wrong", () => {
  it("-5: the box keeps -5, the marker is the operator's word with no mark, and both lines say 'more than 0 ft'", async () => {
    const user = await mountAndPin();
    const field = await commitLength(user, "-5");
    await waitFor(() => expect(fieldAlert()).toBe(`⚠ ${MORE_THAN_0}`));
    expect(field.value).toBe("-5");
    expect(marker()).toBe("yours");
    expect(marker()).not.toMatch(/not set|✓|◌/);
    expect(screen.getByTestId("prov-worklen").textContent).toBe(
      "your answer · the extent the plan is built for",
    );
    expect(ctaReason()).toBe(MORE_THAN_0);
    expect(document.body.textContent).not.toContain(REQUIRED);
  });

  it("a cleared field still says required and '◌ not set'", async () => {
    const user = await mountAndPin();
    const field = await commitLength(user, "");
    await waitFor(() => expect(fieldAlert()).toBe(`⚠ ${REQUIRED}`));
    expect(field.value).toBe("");
    expect(marker()).toBe("◌ not set");
    expect(ctaReason()).toBe(REQUIRED);
  });

  it("#428: a typed 0 stays in the box and both lines say 'more than 0 ft', with the refused-length marker", async () => {
    const user = await mountAndPin();
    const field = await commitLength(user, "0");
    await waitFor(() => expect(fieldAlert()).toBe(`⚠ ${MORE_THAN_0}`));
    expect(field.value).toBe("0");
    // The marker #403 gives a negative length (#429 holds that form).
    expect(marker()).toBe("yours");
    expect(marker()).not.toMatch(/not set|✓|◌/);
    expect(screen.getByTestId("prov-worklen").textContent).toBe(
      "your answer · the extent the plan is built for",
    );
    expect(ctaReason()).toBe(MORE_THAN_0);
    expect(document.body.textContent).not.toContain(REQUIRED);
  });

  it("#428: a typed 0, then an emptied box, reads required and '◌ not set' again; a real length clears both", async () => {
    const user = await mountAndPin();
    await commitLength(user, "0");
    await waitFor(() => expect(fieldAlert()).toBe(`⚠ ${MORE_THAN_0}`));
    const field = await commitLength(user, "");
    await waitFor(() => expect(fieldAlert()).toBe(`⚠ ${REQUIRED}`));
    expect(field.value).toBe("");
    expect(marker()).toBe("◌ not set");
    expect(screen.getByTestId("prov-worklen").textContent).toBe(
      "not set · the extent the plan is built for",
    );
    expect(ctaReason()).toBe(REQUIRED);
    await commitLength(user, "0");
    await waitFor(() => expect(fieldAlert()).toBe(`⚠ ${MORE_THAN_0}`));
    expect(field.value).toBe("0");
    await commitLength(user, "500");
    await waitFor(() => expect(fieldAlert()).toBeNull());
    expect(field.value).toBe("500");
    expect(marker()).toBe("✓ yours");
    expect(document.body.textContent).not.toContain(MORE_THAN_0);
    expect(document.body.textContent).not.toContain(REQUIRED);
  });

  it("the 20,000 ft cap keeps its own message", async () => {
    const user = await mountAndPin();
    await commitLength(user, "99999");
    const cap =
      "Work zone can't exceed 20,000 ft (about 3.8 miles) on a single plan. " +
      "Split a longer project into multiple plans.";
    await waitFor(() => expect(fieldAlert()).toBe(`⚠ ${cap}`));
    expect(ctaReason()).toBe(cap);
  });

  // #429 (Ryan, 2026-10-29): "#429 yes (plain "yours", over-cap too)."
  it("#429: a length over the cap reads the refused-length marker, plain 'yours'; 20,000 itself keeps '✓ yours'", async () => {
    const user = await mountAndPin();
    const field = await commitLength(user, "99999");
    await waitFor(() => expect(fieldAlert()).toMatch(/can't exceed 20,000 ft/));
    expect(field.value).toBe("99999");
    expect(marker()).toBe("yours");
    expect(marker()).not.toMatch(/not set|✓|◌/);
    expect(screen.getByTestId("prov-worklen").textContent).toBe(
      "your answer · the extent the plan is built for",
    );
    await commitLength(user, "20000");
    await waitFor(() => expect(fieldAlert()).toBeNull());
    expect(marker()).toBe("✓ yours");
  });
});

// #432 (Ryan, 2026-10-29): "#432: refuse decimals with "Use whole feet"
// instead of truncating."  The box keeps the typed decimal; the field and
// the Generate blocker refuse it; the marker is the refused-length one.
describe("#432: a typed decimal stays in the box and the field says 'Use whole feet'", () => {
  const WHOLE_FEET = "Use whole feet for the work zone length.";
  it("512.5 stays 512.5, reads 'Use whole feet' in the field and the blocker, plain 'yours'; 512 clears both", async () => {
    const user = await mountAndPin();
    const field = await commitLength(user, "512.5");
    await waitFor(() => expect(fieldAlert()).toBe(`⚠ ${WHOLE_FEET}`));
    expect(field.value).toBe("512.5");
    expect(ctaReason()).toBe(WHOLE_FEET);
    expect(marker()).toBe("yours");
    expect(marker()).not.toMatch(/✓|◌/);

    await commitLength(user, "512");
    await waitFor(() => expect(fieldAlert()).toBeNull());
    expect(field.value).toBe("512");
    expect(marker()).toBe("✓ yours");
    expect(document.body.textContent).not.toContain(WHOLE_FEET);
  });

  it("0.5 stays 0.5 and reads 'Use whole feet', not 'more than 0 ft'", async () => {
    const user = await mountAndPin();
    const field = await commitLength(user, "0.5");
    await waitFor(() => expect(fieldAlert()).toBe(`⚠ ${WHOLE_FEET}`));
    expect(field.value).toBe("0.5");
    expect(ctaReason()).toBe(WHOLE_FEET);
    expect(document.body.textContent).not.toContain(MORE_THAN_0);
  });
});

