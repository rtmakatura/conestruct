// #347: the cross-street path in lib/geocode.ts, against a stubbed Mapbox.
// The stub's features are the shapes Mapbox v5 returned on 2026-10-18
// (validation-artifacts/committed/issue-347-geocoder/outcome.md); the live
// run of the same cases is lib/geocode.live.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geocodeAddress, parseCrossStreets } from "./geocode";
import { areaForKey, areaForName, bboxCenter, COMBINED_BBOX } from "./jurisdiction-areas";

const CORNER = {
  center: [-104.966006, 39.739964],
  place_type: ["address"],
  properties: { accuracy: "intersection" },
};
const SCHUYLER_NE = {
  center: [-97.064631, 41.452042],
  place_type: ["address"],
  properties: {},
};
const PLAINWELL_MI = {
  center: [-85.641768, 42.437325],
  place_type: ["address"],
  properties: { accuracy: "intersection" },
};
const STREET = {
  center: [-104.965881, 39.729264],
  place_type: ["address"],
  properties: { accuracy: "street" },
};

let calls: URL[];
let answer: (u: URL) => unknown;

beforeEach(() => {
  vi.stubEnv("MAPBOX_TOKEN", "tok");
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const u = new URL(input);
      calls.push(u);
      return { ok: true, status: 200, json: async () => answer(u) } as Response;
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function query(u: URL): string {
  return decodeURIComponent(u.pathname.split("/").pop()!.replace(/\.json$/, ""));
}

describe("parseCrossStreets", () => {
  it.each([
    ["Colfax & Williams, Denver", { streets: "Colfax & Williams", city: "Denver" }],
    ["Colfax and Williams", { streets: "Colfax and Williams", city: null }],
    ["E Colfax Ave & N Race St, Denver", { streets: "E Colfax Ave & N Race St", city: "Denver" }],
    ["Colfax & Main, Aurora, IL", { streets: "Colfax & Main", city: "Aurora, IL" }],
    ["Main St at 5th Ave", { streets: "Main St at 5th Ave", city: null }],
  ])("%s is a street pair", (q, want) => {
    expect(parseCrossStreets(q)).toEqual(want);
  });

  it.each(["1437 Bannock St, Denver, CO", "Sand Creek Dr, Denver", "Lafayette, CO", "Colfax &"])(
    "%s is not a street pair",
    (q) => {
      expect(parseCrossStreets(q)).toBeNull();
    },
  );
});

describe("a plain street address keeps its one unchanged request", () => {
  it("asks limit=1 with no type, box or proximity", async () => {
    answer = () => ({
      features: [{ center: [-104.99097, 39.739247], place_type: ["address"] }],
    });
    const r = await geocodeAddress("1437 Bannock St, Denver, CO");
    expect(r).toEqual({ ok: true, lat: 39.739247, lng: -104.99097, placeType: "address" });
    expect(calls).toHaveLength(1);
    expect(calls[0].toString()).toBe(
      "https://api.mapbox.com/geocoding/v5/mapbox.places/1437%20Bannock%20St%2C%20Denver%2C%20CO.json?access_token=tok&limit=1",
    );
  });
});

describe("cross streets with a city typed", () => {
  it("Colfax & Williams, Denver: searches the pair inside Denver's TIGER box, not 'Denver' as a street", async () => {
    // Mapbox's answer to the full string was Schuyler, NE; the pair alone
    // ranks a plain street first and the corner second.
    answer = (u) => ({ features: query(u) === "Colfax & Williams" ? [STREET, CORNER] : [SCHUYLER_NE] });
    const r = await geocodeAddress("Colfax & Williams, Denver");
    expect(r).toEqual({ ok: true, lat: 39.739964, lng: -104.966006, placeType: "intersection" });
    expect(calls).toHaveLength(1); // Denver is a TIGER place: no city lookup
    const denver = areaForKey("denver")!;
    expect(query(calls[0])).toBe("Colfax & Williams");
    expect(calls[0].searchParams.get("types")).toBe("address");
    expect(calls[0].searchParams.get("bbox")).toBe(denver.bbox.join(","));
  });

  it("Colfax & Main, Aurora: Aurora's TIGER box; no corner there ⇒ the area, coarse", async () => {
    answer = () => ({ features: [STREET] });
    const aurora = areaForName("Aurora")!;
    const r = await geocodeAddress("Colfax & Main, Aurora");
    const [lng, lat] = bboxCenter(aurora.bbox);
    expect(r).toEqual({ ok: true, lat, lng, placeType: "place" });
    expect(calls[0].searchParams.get("bbox")).toBe(aurora.bbox.join(","));
  });

  it("Colfax & Main, Aurora, IL: another state named ⇒ Mapbox resolves the city", async () => {
    const IL = { center: [-88.32, 41.76], bbox: [-88.4, 41.69, -88.2, 41.82], place_type: ["place"] };
    answer = (u) => ({ features: query(u) === "Aurora, IL" ? [IL] : [] });
    const r = await geocodeAddress("Colfax & Main, Aurora, IL");
    expect(query(calls[0])).toBe("Aurora, IL");
    expect(calls[0].searchParams.get("types")).toBe("place,locality");
    expect(calls[1].searchParams.get("bbox")).toBe(IL.bbox.join(","));
    expect(r).toEqual({ ok: true, lat: 41.76, lng: -88.32, placeType: "place" });
  });

  it("an unknown city Mapbox cannot place ⇒ 404", async () => {
    answer = () => ({ features: [] });
    const r = await geocodeAddress("Colfax & Main, Nowheresville");
    expect(r).toEqual({ ok: false, status: 404, reason: "no match" });
  });
});

describe("cross streets with no city typed", () => {
  it("a selected jurisdiction scopes the search to its TIGER box", async () => {
    answer = () => ({ features: [CORNER] });
    const r = await geocodeAddress("Colfax & Williams", undefined, { jurisdictionKey: "denver" });
    expect(r).toEqual({ ok: true, lat: 39.739964, lng: -104.966006, placeType: "intersection" });
    expect(calls[0].searchParams.get("bbox")).toBe(areaForKey("denver")!.bbox.join(","));
  });

  it("a selected jurisdiction with no corner found ⇒ its area, coarse", async () => {
    answer = () => ({ features: [STREET] });
    const r = await geocodeAddress("Colfax & Main", undefined, { jurisdictionKey: "denver" });
    const [lng, lat] = bboxCenter(areaForKey("denver")!.bbox);
    expect(r).toEqual({ ok: true, lat, lng, placeType: "place" });
  });

  it("no jurisdiction: searches all our places together; accepts only a flagged corner", async () => {
    answer = () => ({ features: [STREET, CORNER] });
    const r = await geocodeAddress("Colfax and Williams");
    expect(r).toEqual({ ok: true, lat: 39.739964, lng: -104.966006, placeType: "intersection" });
    expect(calls[0].searchParams.get("bbox")).toBe(COMBINED_BBOX.join(","));
  });

  it("no jurisdiction and no flagged result: 422, add a city; never the street address", async () => {
    answer = () => ({ features: [SCHUYLER_NE, STREET] });
    const r = await geocodeAddress("Colfax & Williams");
    expect(r).toEqual({ ok: false, status: 422, reason: "add a city" });
  });

  it("no jurisdiction: a flagged corner outside our places (Plainwell, MI) is refused", async () => {
    answer = () => ({ features: [PLAINWELL_MI] });
    const r = await geocodeAddress("Colfax & Main");
    expect(r).toEqual({ ok: false, status: 422, reason: "add a city" });
  });

});

// #352: the jurisdictions with no TIGER place search their authority's
// extent (data/boundaries/extents.json) instead of all our places.
describe("cross streets with no city, a jurisdiction with no TIGER place", () => {
  // A stub corner in Colorado but outside the 31 places' combined box.
  const OUTSIDE_PLACES = {
    center: [-106.0011, 39.2247],
    place_type: ["address"],
    properties: { accuracy: "intersection" },
  };

  it("cdot searches Colorado and lands a flagged corner outside our places", async () => {
    answer = () => ({ features: [STREET, OUTSIDE_PLACES] });
    const r = await geocodeAddress("US 285 & CO 9", undefined, { jurisdictionKey: "cdot" });
    expect(r).toEqual({ ok: true, lat: 39.2247, lng: -106.0011, placeType: "intersection" });
    const colorado = areaForKey("cdot")!;
    expect(colorado.name).toBe("Colorado");
    expect(calls[0].searchParams.get("bbox")).toBe(colorado.bbox.join(","));
    expect(calls[0].searchParams.get("bbox")).not.toBe(COMBINED_BBOX.join(","));
  });

  it("cdot: a flagged corner outside Colorado (Plainwell, MI) is refused", async () => {
    answer = () => ({ features: [PLAINWELL_MI] });
    const r = await geocodeAddress("Colfax & Main", undefined, { jurisdictionKey: "cdot" });
    expect(r).toEqual({ ok: false, status: 422, reason: "add a city" });
  });

  it("cdot with no flagged corner: 422, never the middle of Colorado", async () => {
    answer = () => ({ features: [STREET] });
    const r = await geocodeAddress("Colfax & Main", undefined, { jurisdictionKey: "cdot" });
    expect(r).toEqual({ ok: false, status: 422, reason: "add a city" });
  });

  it("el_paso searches its TIGER county; a miss recenters on the county, coarse", async () => {
    answer = () => ({ features: [STREET] });
    const r = await geocodeAddress("Academy & Platte", undefined, { jurisdictionKey: "el_paso" });
    const county = areaForKey("el_paso")!;
    expect(county.name).toBe("El Paso County");
    expect(calls[0].searchParams.get("bbox")).toBe(county.bbox.join(","));
    const [lng, lat] = bboxCenter(county.bbox);
    expect(r).toEqual({ ok: true, lat, lng, placeType: "place" });
  });

  it("loveland searches its TIGER place", async () => {
    answer = () => ({ features: [STREET] });
    await geocodeAddress("Eisenhower & Lincoln", undefined, { jurisdictionKey: "loveland" });
    expect(calls[0].searchParams.get("bbox")).toBe(areaForKey("loveland")!.bbox.join(","));
  });

  it("e470 has no sourced polygon: all our places, 422 on a miss", async () => {
    answer = () => ({ features: [STREET] });
    const r = await geocodeAddress("Colfax & Main", undefined, { jurisdictionKey: "e470" });
    expect(areaForKey("e470")).toBeNull();
    expect(calls[0].searchParams.get("bbox")).toBe(COMBINED_BBOX.join(","));
    expect(r).toEqual({ ok: false, status: 422, reason: "add a city" });
  });

  it("the authority areas are never matched as a typed city", () => {
    expect(areaForName("Colorado")).toBeNull();
    expect(areaForName("El Paso County")).toBeNull();
    expect(areaForName("Loveland")).toBeNull();
  });
});

it("Mapbox unreachable on the cross-street path is still a 502", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
  expect(await geocodeAddress("Colfax & Williams")).toEqual({
    ok: false,
    status: 502,
    reason: "mapbox unreachable",
  });
});
