import { NOT_FOUND } from "@/lib/coming-soon-copy";

// The 404, "Road closed" (coming-soon-gate R19; design/NotFound.dc.html —
// reference, not source).  Drawn in the site's linework: an outlined,
// hatched barricade across the road, an outlined ROAD CLOSED sign, and a
// dashed DETOUR that leaves before the barricade and leads home.  Same
// geometry rule as PlanDrawing (x in percent of 1358 units, y in px, text
// in type roles).  A2-Q7: the detour is --ink, not --act — the drawing is
// not clickable; the one primary under it is.

const W = 1358;
const pc = (x: number) => `${((x / W) * 100).toFixed(2)}%`;

function Glyph({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <svg x={pc(x)} y={y} overflow="visible">
      {children}
    </svg>
  );
}

export function RoadClosed() {
  const t = NOT_FOUND;
  return (
    <div className="cs-page">
      <svg className="cs-grid" aria-hidden="true">
        <defs>
          <pattern id="cs-grid" width="48" height="48" patternUnits="userSpaceOnUse" x="12" y="4">
            <path d="M20 24H28M24 20V28" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cs-grid)" />
      </svg>
      <section className="cs-sheet" aria-labelledby="cs-nf-h">
        <div className="cs-sheet-head">
          <span className="tr-step">{t.step}</span>
          <span className="tr-section">{t.sheet}</span>
          <span className="tr-prov cs-head-prov cs-nf-scale">{t.scale}</span>
        </div>
        <svg className="cs-nf-art" width="100%" height="400" role="img" aria-label={t.aria}>
          <defs>
            <pattern id="cs-nf-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path className="cs-nf-hatch" d="M0 0V8" />
            </pattern>
          </defs>
          <line className="cs-road" x1={pc(40)} x2={pc(1318)} y1="150" y2="150" />
          <line className="cs-road" x1={pc(40)} x2={pc(1318)} y1="270" y2="270" />
          <line className="cs-lane" x1={pc(40)} x2={pc(1318)} y1="210" y2="210" />
          <Glyph x={80} y={150}>
            <path className="cs-flow" d="M0 30H44M36 24L44 30L36 36M0 90H44M36 84L44 90L36 96" />
          </Glyph>
          {/* Beyond the closure: nothing. */}
          <rect className="cs-nf-beyond" x={pc(960)} y="151" width={pc(358)} height="118" />
          <Glyph x={764} y={150}>
            <rect className="cs-nf-barricade" width="16" height="120" fill="url(#cs-nf-hatch)" />
            <text className="tr-prov" fill="currentColor" x="8" y="142" textAnchor="middle">
              {t.barricade}
            </text>
          </Glyph>
          <Glyph x={860} y={270}>
            <line className="cs-sign" x1="0" x2="0" y1="0" y2="26" />
            <rect className="cs-nf-plate" x="-40" y="26" width="80" height="34" />
            <text className="tr-section" fill="currentColor" y="40" textAnchor="middle">
              {t.sign[0]}
            </text>
            <text className="tr-section" fill="currentColor" y="54" textAnchor="middle">
              {t.sign[1]}
            </text>
          </Glyph>
          {/* The detour: off the road before the barricade, back to home. */}
          <line className="cs-detour" x1={pc(560)} x2={pc(560)} y1="150" y2="70" />
          <line className="cs-detour" x1={pc(560)} x2={pc(240)} y1="70" y2="70" />
          <line className="cs-detour" x1={pc(240)} x2={pc(240)} y1="70" y2="40" />
          <Glyph x={240} y={38}>
            <path className="cs-detour cs-detour-head" d="M-6 10L0 0L6 10" />
          </Glyph>
          <Glyph x={560} y={90}>
            <rect className="cs-detour-box" x="-40" width="80" height="28" />
            <text className="tr-section" fill="currentColor" y="18" textAnchor="middle">
              {t.detour}
            </text>
          </Glyph>
          <text className="tr-prov cs-on-ink" fill="currentColor" x={pc(252)} y="44">
            {t.detourTo}
          </text>
          <text className="tr-prov" fill="currentColor" x={pc(40)} y="352">
            {t.note}
          </text>
        </svg>
        <div className="cs-nf-foot">
          <div className="cs-nf-text">
            <h1 id="cs-nf-h" className="tr-question">
              {t.heading}
            </h1>
            <p className="cs-body">{t.body}</p>
          </div>
          <a className="pri cs-nf-home" href="/">
            {t.home}
          </a>
        </div>
      </section>
    </div>
  );
}
