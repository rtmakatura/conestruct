// #347: the route hands the form's jurisdiction to the geocoder.
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const geocodeAddress = vi.fn();
vi.mock("@/lib/geocode", () => ({ geocodeAddress: (...a: unknown[]) => geocodeAddress(...a) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitOr429: async () => null }));

import { POST } from "./route";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/geocode", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => geocodeAddress.mockReset());

describe("POST /api/geocode", () => {
  it("forwards jurisdiction_key and returns the intersection answer", async () => {
    geocodeAddress.mockResolvedValue({ ok: true, lat: 39.739964, lng: -104.966006, placeType: "intersection" });
    const res = await POST(req({ address: "Colfax & Williams", jurisdiction_key: "denver" }));
    expect(geocodeAddress.mock.calls[0][0]).toBe("Colfax & Williams");
    expect(geocodeAddress.mock.calls[0][2]).toEqual({ jurisdictionKey: "denver" });
    expect(await res.json()).toEqual({ lat: 39.739964, lng: -104.966006, placeType: "intersection" });
  });

  it("a missing or non-string jurisdiction_key is null", async () => {
    geocodeAddress.mockResolvedValue({ ok: false, status: 404, reason: "no intersection match" });
    const res = await POST(req({ address: "Colfax & Main", jurisdiction_key: 7 }));
    expect(geocodeAddress.mock.calls[0][2]).toEqual({ jurisdictionKey: null });
    expect(res.status).toBe(404);
  });
});
