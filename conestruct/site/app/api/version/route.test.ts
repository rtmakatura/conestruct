// #242: /api/version answers the inlined build sha, never cached.
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("GET /api/version (#242)", () => {
  it("answers the deployment's build sha with no-store", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA", "824840f329ef");
    const { GET } = await import("./route");
    const res = GET();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ sha: "824840f329ef" });
  });

  it("answers null when no sha was built in", async () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA", undefined as unknown as string);
    const { GET } = await import("./route");
    expect(await GET().json()).toEqual({ sha: null });
  });
});
