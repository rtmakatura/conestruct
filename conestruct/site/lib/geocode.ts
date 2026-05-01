// Server-only Mapbox geocoding. Reads MAPBOX_TOKEN from env so the token
// is never exposed to the browser. Mirrors the Streamlit ``_geocode_address``
// helper (v5 places API, limit=1).

export type GeocodeResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; status: number; reason: string };

export async function geocodeAddress(
  address: string,
  signal?: AbortSignal,
): Promise<GeocodeResult> {
  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return { ok: false, status: 503, reason: "MAPBOX_TOKEN not configured" };
  }

  const trimmed = address.trim();
  if (!trimmed) {
    return { ok: false, status: 400, reason: "empty address" };
  }

  const query = encodeURIComponent(trimmed);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${encodeURIComponent(
    token,
  )}&limit=1`;

  let upstream: Response;
  try {
    upstream = await fetch(url, { signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return { ok: false, status: 499, reason: "aborted" };
    }
    return { ok: false, status: 502, reason: "mapbox unreachable" };
  }

  if (!upstream.ok) {
    return { ok: false, status: 502, reason: `mapbox ${upstream.status}` };
  }

  const payload = (await upstream.json()) as {
    features?: Array<{ center?: [number, number] }>;
  };
  const center = payload.features?.[0]?.center;
  if (!center || center.length !== 2) {
    return { ok: false, status: 404, reason: "no match" };
  }

  const [lng, lat] = center;
  return { ok: true, lat, lng };
}
