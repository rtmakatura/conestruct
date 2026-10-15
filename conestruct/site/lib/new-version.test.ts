// @vitest-environment happy-dom
//
// #242 — an open tab learns a newer frontend is live: it compares the
// build it runs with /api/version's answer, every VERSION_POLL_MS and when
// it becomes visible.  It never reloads; it only reports.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useNewVersion, VERSION_POLL_MS } from "./new-version";

function answer(body: unknown, ok = true) {
  const fetchMock = vi.fn(() =>
    Promise.resolve({ ok, json: async () => body } as unknown as Response),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useNewVersion (#242)", () => {
  it("never asks without a built sha", async () => {
    const f = answer({ sha: "new" });
    const { result } = renderHook(() => useNewVersion(null));
    await tick(VERSION_POLL_MS * 2);
    expect(f).not.toHaveBeenCalled();
    expect(result.current).toBe(false);
  });

  it("stays false while the served build is this one", async () => {
    const f = answer({ sha: "abc" });
    const { result } = renderHook(() => useNewVersion("abc"));
    await tick(VERSION_POLL_MS);
    expect(f).toHaveBeenCalledWith("/api/version", { cache: "no-store" });
    expect(result.current).toBe(false);
  });

  it("turns true on the first poll that sees a different build", async () => {
    answer({ sha: "def" });
    const { result } = renderHook(() => useNewVersion("abc"));
    await tick(VERSION_POLL_MS - 1);
    expect(result.current).toBe(false);
    await tick(1);
    expect(result.current).toBe(true);
  });

  it("an empty, missing or failed answer is no signal", async () => {
    for (const [body, ok] of [[{ sha: "" }, true], [{ sha: null }, true], [{ sha: "def" }, false]] as const) {
      answer(body, ok);
      const { result, unmount } = renderHook(() => useNewVersion("abc"));
      await tick(VERSION_POLL_MS);
      expect(result.current).toBe(false);
      unmount();
    }
  });

  it("asks when the tab becomes visible again", async () => {
    const f = answer({ sha: "def" });
    const { result } = renderHook(() => useNewVersion("abc"));
    expect(f).not.toHaveBeenCalled();
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(f).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(true);
  });
});
