// #347: the cross-street path in lib/geocode.ts, against a stubbed Mapbox.
// The stub's features are the shapes Mapbox v5 returned on 2026-10-18
// (validation-artifacts/committed/issue-347-geocoder/outcome.md); the live
// run of the same cases is lib/geocode.live.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geocodeAddress, parseCrossStreets } from "./geocode";
import {
  areaForKey,
  areaForName,
  bboxCenter,
  COLORADO_BBOX,
  COMBINED_BBOX,
} from "./jurisdiction-areas";

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

// #384 (R1 Ryan): the plain-address path, against the shapes Mapbox v5
// returned on 2026-10-23 (validation-artifacts/committed/issue-384-address-colorado/probe.txt).
function addr(
  center: [number, number],
  relevance: number,
  city: string,
  region: [string, string],
  house?: string,
) {
  return {
    id: "address.1",
    center,
    place_type: ["address"],
    relevance,
    ...(house ? { address: house } : {}),
    context: [
      { id: "place.1", text: city },
      { id: "region.1", text: region[0], short_code: region[1] },
    ],
  };
}
const CO: [string, string] = ["Colorado", "US-CO"];
const BROOMFIELD = addr([-105.0718, 39.916], 0.862963, "Broomfield", CO, "100");
const LAFAYETTE_IN = addr([-86.8959, 40.4193], 1, "Lafayette", ["Indiana", "US-IN"], "100");
const boxed = (u: URL) => u.searchParams.has("bbox");

describe("a plain street address resolves only inside Colorado (#384)", () => {
  it("a full match in the Colorado box is the answer: one request, CO spelled out", async () => {
    answer = () => ({ features: [addr([-104.99097, 39.739247], 1, "Denver", CO, "1437")] });
    const r = await geocodeAddress("1437 Bannock St, Denver, CO");
    expect(r).toEqual({ ok: true, lat: 39.739247, lng: -104.99097, placeType: "address" });
    expect(calls).toHaveLength(1);
    expect(calls[0].toString()).toBe(
      "https://api.mapbox.com/geocoding/v5/mapbox.places/1437%20Bannock%20St%2C%20Denver%2C%20Colorado.json?access_token=tok&limit=1&bbox=" +
        COLORADO_BBOX.join(","),
    );
  });

  it("a partial match in a typed city, with the typed house number, is the answer", async () => {
    const longmont = addr([-105.1033, 40.1598], 0.927778, "Longmont", CO, "1");
    answer = () => ({ features: [longmont] });
    const r = await geocodeAddress("1 Main St, Longmont, CO 80501");
    expect(r).toEqual({ ok: true, lat: 40.1598, lng: -105.1033, placeType: "address" });
    expect(query(calls[0])).toBe("1 Main St, Longmont, Colorado 80501");
    expect(calls).toHaveLength(2);
  });

  it("100 Main St, Lafayette, CO: Broomfield isn't the typed city, so check the address (was Wisconsin)", async () => {
    answer = (u) => ({ features: [boxed(u) ? BROOMFIELD : LAFAYETTE_IN] });
    const r = await geocodeAddress("100 Main St, Lafayette, CO");
    expect(r).toEqual({ ok: false, status: 404, reason: "check address" });
  });

  it("100 Main St, Lafayette: no state named, a Colorado candidate exists, so check the address (was Indiana)", async () => {
    answer = (u) => ({ features: [boxed(u) ? addr([-105.0718, 39.916], 0.805556, "Broomfield", CO, "100") : LAFAYETTE_IN] });
    const r = await geocodeAddress("100 Main St, Lafayette");
    expect(r).toEqual({ ok: false, status: 404, reason: "check address" });
  });

  it("100 Main St, Aurora: the typed city but no house number, so check the address (was Indiana)", async () => {
    const sMain = addr([-104.7585, 39.615], 0.872889, "Aurora", CO);
    const auroraIn = addr([-84.8994, 39.0574], 1, "Aurora", ["Indiana", "US-IN"], "100");
    answer = (u) => ({ features: [boxed(u) ? sMain : auroraIn] });
    const r = await geocodeAddress("100 Main St, Aurora");
    expect(r).toEqual({ ok: false, status: 404, reason: "check address" });
  });

  it.each([
    ["350 5th Ave, New York, NY", ["New York", "US-NY"]],
    ["1600 Pennsylvania Ave, Washington, DC", ["District of Columbia", "US-DC"]],
    ["100 Main St, Lafayette, Indiana 47901", ["Indiana", "US-IN"]],
  ] as [string, [string, string]][])("%s names another state: 422", async (q, region) => {
    answer = (u) => ({
      features: [boxed(u) ? BROOMFIELD : addr([-80, 40], 0.9, "Elsewhere", region, "1")],
    });
    const r = await geocodeAddress(q);
    expect(r).toEqual({ ok: false, status: 422, reason: "outside colorado" });
  });

  it("Lafayette, LA: a full match in the box (a Leadville street) doesn't stand when Louisiana is named", async () => {
    const leadville = { ...addr([-106.1854, 39.2649], 1, "Leadville", CO), text: "Lafayette" };
    const louisiana = {
      id: "place.1",
      text: "Lafayette",
      center: [-92.0198, 30.2241],
      place_type: ["place"],
      relevance: 1,
      context: [{ id: "region.1", text: "Louisiana", short_code: "US-LA" }],
    };
    answer = (u) => ({ features: [boxed(u) ? leadville : louisiana] });
    const r = await geocodeAddress("Lafayette, LA");
    expect(r).toEqual({ ok: false, status: 422, reason: "outside colorado" });
  });

  it("a full match with a city last (no state) checks for another state, then stands", async () => {
    const bannock = addr([-104.99097, 39.739247], 1, "Denver", CO, "1437");
    answer = () => ({ features: [bannock] });
    const r = await geocodeAddress("1437 Bannock St, Denver");
    expect(r).toEqual({ ok: true, lat: 39.739247, lng: -104.99097, placeType: "address" });
    expect(calls).toHaveLength(2);
  });

  it("no Colorado candidate at all, an answer elsewhere: 422", async () => {
    answer = (u) => ({ features: boxed(u) ? [] : [LAFAYETTE_IN] });
    const r = await geocodeAddress("100 Main St, Lafayette");
    expect(r).toEqual({ ok: false, status: 422, reason: "outside colorado" });
  });

  it("nothing anywhere: 404 no match", async () => {
    answer = () => ({ features: [] });
    const r = await geocodeAddress("zzzz");
    expect(r).toEqual({ ok: false, status: 404, reason: "no match" });
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

// #376 (R1, reverses #347 ruling 2): a typed city resolves only inside
// Colorado.  The stub answers the city lookup the way Mapbox did on
// 2026-10-23 (checkpoint.md): inside the Colorado box with the Colorado
// place, with no box with the place Mapbox ranks first anywhere.
describe("#376 a typed city resolves only inside Colorado", () => {
  const place = (center: number[], relevance: number) => ({
    center,
    bbox: [center[0] - 0.05, center[1] - 0.05, center[0] + 0.05, center[1] + 0.05],
    place_type: ["place"],
    relevance,
  });
  const LAFAYETTE_CO = place([-105.090462, 39.998235], 1);
  const LAFAYETTE_LA = place([-92.018777, 30.222907], 1);
  const LAFAYETTE_CA = place([-122.120302, 37.891883], 1);
  const DILLON_CORNER = {
    center: [-105.090397, 39.957998],
    place_type: ["address"],
    properties: { accuracy: "intersection" },
  };
  const COLORADO = COLORADO_BBOX.join(",");
  const boxed = (u: URL) => u.searchParams.get("bbox") === COLORADO;

  function lafayette(u: URL) {
    if (u.searchParams.get("types") === "address") return { features: [DILLON_CORNER] };
    if (boxed(u)) return { features: [LAFAYETTE_CO] };
    // Mapbox with no box: "CO" read as California, no state as Louisiana.
    return { features: [query(u).endsWith(", CO") ? LAFAYETTE_CA : LAFAYETTE_LA] };
  }

  it.each([
    ["US 287 & Dillon Rd, Lafayette, CO", null, "Lafayette, Colorado"],
    ["US 287 & Dillon Rd, Lafayette", null, "Lafayette"],
    ["US 287 & Dillon Rd, Lafayette", "cdot", "Lafayette"],
    ["US 287 & Dillon Rd, Lafayette, Colorado", null, "Lafayette, Colorado"],
  ])("%s (jurisdiction %s): the Colorado corner, one city lookup held to Colorado", async (q, jk, lookup) => {
    answer = lafayette;
    const r = await geocodeAddress(q, undefined, { jurisdictionKey: jk });
    expect(r).toEqual({ ok: true, lat: 39.957998, lng: -105.090397, placeType: "intersection" });
    expect(calls).toHaveLength(2);
    expect(query(calls[0])).toBe(lookup);
    expect(calls[0].searchParams.get("bbox")).toBe(COLORADO);
    expect(calls[1].searchParams.get("bbox")).toBe(LAFAYETTE_CO.bbox.join(","));
  });

  it.each([
    ["Colfax & Main, Aurora, IL", place([-104.830668, 39.740328], 0.5), place([-88.315002, 41.758194], 1)],
    ["Johnston & Pinhook, Lafayette, LA", place([-105.090462, 39.998235], 0.5), LAFAYETTE_LA],
  ])("%s: another state named ⇒ 422 outside colorado, never the Colorado namesake", async (q, inCo, anywhere) => {
    answer = (u) => ({ features: [boxed(u) ? inCo : anywhere] });
    const r = await geocodeAddress(q);
    expect(r).toEqual({ ok: false, status: 422, reason: "outside colorado" });
    expect(calls).toHaveLength(2); // no street search
  });

  it("nothing in Colorado and Mapbox's best answer elsewhere, even partial ⇒ 422 outside colorado", async () => {
    answer = (u) => ({ features: boxed(u) ? [] : [place([-92.0, 30.2], 0.5)] });
    const r = await geocodeAddress("Main & 1st, Breaux Bridge");
    expect(r).toEqual({ ok: false, status: 422, reason: "outside colorado" });
  });

  it("a partial match inside Colorado ⇒ 404 check spelling", async () => {
    answer = (u) => ({
      features: [boxed(u) ? place([-105.090462, 39.998235], 0.67) : place([-92.018777, 30.222907], 0.67)],
    });
    const r = await geocodeAddress("US 287 & Dillon Rd, Lafayete");
    expect(r).toEqual({ ok: false, status: 404, reason: "check spelling" });
  });

  it("a Colorado place with no extent: a flagged corner outside Colorado (Plainwell, MI) is refused", async () => {
    const NO_EXTENT = { center: [-105.2, 39.6], place_type: ["locality"], relevance: 1 };
    answer = (u) => ({ features: u.searchParams.get("types") === "address" ? [PLAINWELL_MI] : [NO_EXTENT] });
    const r = await geocodeAddress("Main & 1st, Somewhere");
    expect(calls[1].searchParams.get("bbox")).toBeNull();
    expect(r).toEqual({ ok: true, lat: 39.6, lng: -105.2, placeType: "place" });
  });
});
