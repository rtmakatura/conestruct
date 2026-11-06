// @vitest-environment happy-dom
//
// #446 T23 and the review's finding 5: useCrossStreetTag answers only for the
// key it was asked about, and going back to a key re-reads it (Rule 10: a held
// answer isn't this read's answer).
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { DEFAULT_SHOULDER } from "./scenarios";
import type { Scenario } from "./scenarios/types";
import { useCrossStreetTag } from "./cross-street-tag";

const at = (lat: number) =>
  ({ ...DEFAULT_SHOULDER, meta: { ...DEFAULT_SHOULDER.meta, lat, lng: -104.96 } }) as Scenario;
const FOUND = {
  status: "found",
  text: "80 ft W of Race Street",
  provenance_text: "cross street from the map",
  cross_street: "Race Street",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useCrossStreetTag across keys", () => {
  it("A, B, A: A's old answer doesn't come back while A is read again, or after that read fails", async () => {
    let answer: () => Promise<Response> = async () =>
      ({ ok: true, json: async () => FOUND }) as unknown as Response;
    vi.stubGlobal("fetch", vi.fn(() => answer()));
    const a = at(39.74);
    const h = renderHook(({ s }: { s: Scenario }) => useCrossStreetTag(s), {
      initialProps: { s: a },
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(h.result.current?.text).toBe(FOUND.text);

    let fail: () => void = () => {};
    answer = () =>
      new Promise((_res, rej) => {
        fail = () => rej(new Error("down"));
      });
    await act(async () => h.rerender({ s: at(39.75) }));
    expect(h.result.current).toBeNull();

    await act(async () => h.rerender({ s: a }));
    expect(h.result.current).toBeNull();
    await act(async () => {
      fail();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(h.result.current).toBeNull();
  });
});
