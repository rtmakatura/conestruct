// #347: the cross-street path in lib/geocode.ts, against a stubbed Mapbox.
// The stub's features are the shapes Mapbox v5 returned on 2026-10-18
// (validation-artifacts/committed/issue-347-geocoder/outcome.md); the live
// run of the same cases is lib/geocode.live.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geocodeAddress, parseCrossStreets, WEAK_RELEVANCE, weakMatch } from "./geocode";
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
    const longmont = {
      ...addr([-105.1033, 40.1598], 0.927778, "Longmont", CO, "1"),
      // #554: the answer holds the typed ZIP, as recorded in #384's probe.
      place_name: "1 South Main Street, Longmont, Colorado 80501, United States",
    };
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

// #554 (Ryan, 2026-11-23): a weak match is marked and named.  The shapes
// are the answers Mapbox v5 gave on 2026-11-23 (validation-artifacts/
// committed/issue-554-weak-match-notice/probe/mapbox-answers.json).
function hit(
  place_name: string,
  center: [number, number],
  relevance: number,
  more: Record<string, unknown> = {},
) {
  const city = place_name.split(", ")[1];
  return {
    id: "address.1",
    place_type: ["address"],
    relevance,
    place_name,
    center,
    context: [
      { id: "place.1", text: city },
      { id: "region.1", text: "Colorado", short_code: "US-CO" },
    ],
    ...more,
  };
}
const HOLLY = hit("39 North Main Street, Holly, Colorado 81047, United States", [-102.122704, 38.053441], 1, {
  address: "39",
});
const WALSH = hit("W Boulevard, Walsh, Kansas 81090, United States", [-102.041892, 37.294763], 1);
const ELSEWHERE = { id: "address.9", place_type: ["address"], relevance: 1, center: [-111.81555, 43.672666] };

describe("#554: a weak match is marked, named and still located", () => {
  it.each([
    ["39 N, 44.4", HOLLY, "39 North Main Street, Holly, Colorado 81047"],
    ["105° W, 39.7401", WALSH, "W Boulevard, Walsh, Kansas 81090"],
    ["39 N, 104 W", HOLLY, "39 North Main Street, Holly, Colorado 81047"],
  ])("%s: a street address at relevance 1 that lacks a typed number is weak", async (q, boxedHit, name) => {
    answer = (u) => ({ features: [boxed(u) ? boxedHit : ELSEWHERE] });
    const [lng, lat] = boxedHit.center;
    expect(await geocodeAddress(q)).toEqual({
      ok: true,
      lat,
      lng,
      placeType: "address",
      weak: true,
      placeName: name,
    });
  });

  it("the weak answer's numbers are the pins #554 reports", () => {
    expect([HOLLY.center[1].toFixed(4), HOLLY.center[0].toFixed(4)]).toEqual(["38.0534", "-102.1227"]);
    expect([WALSH.center[1].toFixed(4), WALSH.center[0].toFixed(4)]).toEqual(["37.2948", "-102.0419"]);
  });

  it.each([
    ["1437 Bannock St, Denver", "1437 Bannock Street, Denver, Colorado 80202, United States", {}],
    ["1437 Bannock St Apt 4, Denver", "1437 Bannock Street, Denver, Colorado 80202, United States", {}],
    ["1437 Bannock St #210, Denver", "1437 Bannock Street, Denver, Colorado 80202, United States", {}],
    ["1437 Bannock St, Suite 300, Denver", "1437 Bannock Street, Denver, Colorado 80202, United States", {}],
    ["1437 Bannock St, Denver, CO 80202-5337", "1437 Bannock Street, Denver, Colorado 80202, United States", {}],
    ["1437 N 14", "1437 North 14th Street, Gunnison, Colorado 81230, United States", {}],
    ["E 6th Ave, Denver", "East 6th Avenue, Denver, Colorado 80230, United States", {}],
    ["Lookout Mountain Rd", "Lookout Mountain Road, Golden, Colorado 80401, United States", {}],
    ["I-25", "Interstate 25, Trinidad, Colorado 81082, United States", {}],
    // Mapbox names the street otherwise; the words that matched hold the number.
    [
      "E-470",
      "North Valdai Street, Aurora, Colorado 80018, United States",
      { matching_place_name: "E-470 Frontage Road, Aurora, Colorado 80018, United States" },
    ],
    [
      "Hwy 36",
      "US Route 36, Idalia, Colorado 80758, United States",
      { matching_place_name: "Highway 36, Idalia, Colorado 80758, United States" },
    ],
  ] as [string, string, Record<string, unknown>][])("%s: a full match that holds every typed number is not weak", async (q, name, more) => {
    answer = () => ({ features: [hit(name, [-104.99, 39.74], 1, more)] });
    expect(await geocodeAddress(q)).toEqual({ ok: true, lat: 39.74, lng: -104.99, placeType: "address" });
  });

  it("a unit word inside another word is not a unit: 4 after 'Flapt' is checked", () => {
    expect(weakMatch("12 Flapt 4", hit("12 Flapt Street, Denver, Colorado 80202, United States", [0, 0], 1))).toBe(true);
    expect(weakMatch("12 Flapt St Apt. 4", hit("12 Flapt Street, Denver, Colorado 80202, United States", [0, 0], 1))).toBe(false);
  });

  // The threshold, 0.9 CHOSEN (rulings.md call 4), on answers #384 lets
  // through below 1: in the typed city, with the typed house number.
  it.each([
    [0.988175, false], // "1437 Banock St, Denver", recorded
    [0.946667, false], // "1437 Bannock, Denver, CO 80202", recorded
    [0.927778, false], // "1 Main St, Longmont, CO 80501", #384's probe
    [0.9, false],
    [0.899999, true],
    [0.872889, true], // a wrong answer in #384's probe
  ])("relevance %f in the typed city: weak is %s", async (relevance, weak) => {
    expect(WEAK_RELEVANCE).toBe(0.9);
    const f = hit("1437 Bannock Street, Denver, Colorado 80202, United States", [-104.99097, 39.739247], relevance, {
      address: "1437",
    });
    answer = () => ({ features: [f] });
    const r = await geocodeAddress("1437 Banock St, Denver");
    expect(r).toEqual({
      ok: true,
      lat: 39.739247,
      lng: -104.99097,
      placeType: "address",
      ...(weak ? { weak: true, placeName: "1437 Bannock Street, Denver, Colorado 80202" } : {}),
    });
  });

  it("an answer with no relevance is weak (Rule 10)", () => {
    const { relevance: _dropped, ...f } = hit("1437 Bannock Street, Denver, Colorado 80202, United States", [0, 0], 1);
    expect(weakMatch("1437 Bannock St", f)).toBe(true);
  });

  it.each(["country", "region", "postcode", "district", "place", "locality", "neighborhood"])(
    "an area (%s) is the town notice's, not weak",
    async (type) => {
      answer = () => ({
        features: [{ id: `${type}.1`, place_type: [type], relevance: 1, place_name: "Lafayette, Colorado, United States", center: [-105.0897, 39.9936] }],
      });
      expect(await geocodeAddress("Lafayette")).toEqual({ ok: true, lat: 39.9936, lng: -105.0897, placeType: type });
    },
  );

  it.each([["poi"], ["some_future_type"], [null]])(
    "neither a street address nor an area (%s) is weak",
    async (type) => {
      answer = () => ({
        features: [
          {
            id: "x.1",
            ...(type ? { place_type: [type] } : {}),
            relevance: 1,
            place_name: "Coors Field, 2001 Blake St, Denver, Colorado 80205, United States",
            center: [-104.9942, 39.7559],
          },
        ],
      });
      expect(await geocodeAddress("Coors Field")).toEqual({
        ok: true,
        lat: 39.7559,
        lng: -104.9942,
        placeType: type,
        weak: true,
        placeName: "Coors Field, 2001 Blake St, Denver, Colorado 80205",
      });
    },
  );

  it("a weak answer with no place_name is named by its coordinates (Rule 10)", async () => {
    answer = () => ({ features: [{ id: "poi.1", place_type: ["poi"], relevance: 1, center: [-104.9942, 39.7559] }] });
    const r = await geocodeAddress("Coors Field");
    expect(r).toMatchObject({ weak: true, placeName: "39.75590, -104.99420" });
  });

  it("#384's refusals stand: a partial match outside a typed city is still 404, never a weak pin", async () => {
    const josephine = hit("North Josephine Street, Denver, Colorado 80206, United States", [-104.958255, 39.731141], 0.99);
    answer = () => ({ features: [josephine] });
    expect(await geocodeAddress("39.7401° N")).toEqual({ ok: false, status: 404, reason: "check address" });
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
