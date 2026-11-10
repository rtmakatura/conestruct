"use client";

// #490 C11 / C13: Mapbox's logo and attribution, drawn by the page on a frame
// that shows the band aerial.  The picture is asked of Mapbox without them
// (`logo=false`, `attribution=false`, src/api/render_api.py) because the page
// scales it to cover its frame, which would crop them; drawn here they are
// never scaled.  Sources: validation-artifacts/committed/missions/
// ux-columns-copy-maps/issue-490/rulings.md (C11).

// Mapbox's own logo element (a.mapboxgl-ctrl-logo), not restyled.
import "mapbox-gl/dist/mapbox-gl.css";

/** The attribution the satellite picture carries when Mapbox draws it (its
 *  static image reads "© Maxar © Mapbox © OpenStreetMap"), with the links
 *  Mapbox's attribution guide gives for static maps and "Improve this map"
 *  (https://docs.mapbox.com/help/getting-started/attribution/, "Static &
 *  print"; Maxar for the satellite style, its SDK sections). */
export const MAPBOX_ATTRIBUTION: readonly { text: string; href: string }[] = [
  { text: "© Maxar", href: "https://www.maxar.com/" },
  { text: "© Mapbox", href: "https://www.mapbox.com/about/maps/" },
  { text: "© OpenStreetMap", href: "https://www.openstreetmap.org/copyright" },
  { text: "Improve this map", href: "https://apps.mapbox.com/feedback/" },
];

/** The logo and the attribution line, one row (the line wraps above the logo
 *  when the row is too narrow).  `linked`: each a link, a read the write lock
 *  leaves live; off where the frame is `aria-hidden` (the Generate outline),
 *  so nothing in it is focusable: the guide's text-only form and an unlinked
 *  logo. */
export function MapboxMarks({
  testid,
  linked,
}: {
  testid: string;
  linked: boolean;
}) {
  return (
    <div className="mbx-marks" data-testid={`${testid}-marks`}>
      <span className="mbx-logo" data-testid={`${testid}-logo`}>
        {linked ? (
          <a
            className="mapboxgl-ctrl-logo"
            href="https://www.mapbox.com/"
            target="_blank"
            rel="noopener nofollow"
            aria-label="Mapbox logo"
            data-read=""
          />
        ) : (
          // An <a> with no href: the logo's own element, not focusable.
          <a className="mapboxgl-ctrl-logo" aria-label="Mapbox logo" />
        )}
      </span>
      <MapboxAttribution testid={`${testid}-attribution`} linked={linked} />
    </div>
  );
}

/** The attribution line alone (MapboxMarks draws it beside the logo; the
 *  WHERE band also draws it under a narrow frame). */
export function MapboxAttribution({
  testid,
  linked,
  className = "",
}: {
  testid: string;
  linked: boolean;
  className?: string;
}) {
  return (
    <p
      className={`mbx-attrib tr-prov ${className}`.trim()}
      data-testid={testid}
    >
      {MAPBOX_ATTRIBUTION.map((l, i) => (
        <span key={l.text}>
          {i > 0 ? " " : null}
          {linked ? (
            <a
              href={l.href}
              target="_blank"
              rel="noopener nofollow"
              data-read=""
            >
              {l.text}
            </a>
          ) : (
            <span className="mbx-text">{l.text}</span>
          )}
        </span>
      ))}
    </p>
  );
}
