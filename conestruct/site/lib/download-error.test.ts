// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadSavedPart, extractValidationMessage } from "./download-error";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("extractValidationMessage (moved from OutputCards, #203)", () => {
  it("reads detail.message, then a string detail, else the default", async () => {
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 400 });
    expect(await extractValidationMessage(json({ detail: { message: "Too short." } }))).toBe(
      "Too short.",
    );
    expect(await extractValidationMessage(json({ detail: "Bad speed." }))).toBe("Bad speed.");
    expect(await extractValidationMessage(new Response("not json", { status: 400 }))).toBe(
      "Invalid scenario",
    );
  });
});

describe("downloadSavedPart", () => {
  it("names a non-400 failure by its status", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("x", { status: 503 }))));
    expect(await downloadSavedPart("/api/plans/p/pdf", "pdf")).toBe("Render failed (503)");
  });

  it("falls back to plan.<ext> when the route sends no filename", async () => {
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} }));
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("x", { status: 200 }))));
    expect(await downloadSavedPart("/api/plans/p/xlsx", "xlsx")).toBeNull();
    expect(names).toEqual(["plan.xlsx"]);
  });
});
