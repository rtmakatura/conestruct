import { HOW } from "@/lib/coming-soon-copy";

// 01's three small line drawings (design/PlanSheet.dc.html, "01 HOW").
// Decorative (aria-hidden): the card's words say what the step is.  Same
// geometry rule as PlanDrawing — x in percent, y in pixels, text in a
// type role — so the labels stay 10.5 px at every card width.
//
// A2-Q6: the labels are non-numeric.  The design's "210 ft N of W 38th
// Ave" is a string the product does not produce (no nearest-intersection
// producer, lib/scenarios/band-facts.ts), and "lane closure · 300 ft ·
// confirmed" is not the product's format.  A2-Q7: the pin and bracket
// are --ink; nothing here is clickable.

const H = 140;

export function StepDrawing({ step }: { step: 0 | 1 | 2 }) {
  return (
    <svg className="cs-step-art" width="100%" height={H} aria-hidden="true">
      {step === 0 && (
        <>
          <line className="cs-road" x1="0" x2="100%" y1="60" y2="60" />
          <line className="cs-road" x1="0" x2="100%" y1="100" y2="100" />
          <line className="cs-lane cs-lane-sm" x1="0" x2="100%" y1="80" y2="80" />
          <line className="cs-call" x1="50%" x2="50%" y1="88" y2="52" />
          <svg x="50%" y="0" overflow="visible">
            <circle className="cs-call cs-pin" cy="46" r="7" />
            <circle className="cs-call-dot" cy="90" r="3" />
            <text className="tr-prov" fill="currentColor" x="12" y="122">
              {HOW.steps[0].label}
            </text>
          </svg>
        </>
      )}
      {step === 1 && (
        <>
          <line className="cs-road" x1="0" x2="100%" y1="50" y2="50" />
          <line className="cs-road" x1="0" x2="100%" y1="110" y2="110" />
          <line className="cs-lane cs-lane-sm" x1="0" x2="100%" y1="80" y2="80" />
          <rect className="cs-box" x="34.09%" y="82" width="31.82%" height="26" />
          <line className="cs-call" x1="34.09%" x2="34.09%" y1="124" y2="130" />
          <line className="cs-call" x1="65.91%" x2="65.91%" y1="124" y2="130" />
          <line className="cs-call" x1="34.09%" x2="65.91%" y1="130" y2="130" />
          <text className="tr-prov" fill="currentColor" x="50%" y="30" textAnchor="middle">
            {HOW.steps[1].label}
          </text>
        </>
      )}
      {step === 2 && (
        <>
          <rect className="cs-doc" x="27.27%" y="18" width="45.45%" height="106" />
          <line className="cs-doc-line" x1="30%" x2="70%" y1="54" y2="54" />
          <line className="cs-doc-line" x1="30%" x2="61.36%" y1="70" y2="70" />
          <line className="cs-doc-line" x1="30%" x2="65.91%" y1="86" y2="86" />
          <rect className="cs-doc" x="54.55%" y="96" width="18.18%" height="28" />
          <line className="cs-doc-title" x1="30%" x2="45.45%" y1="34" y2="34" />
        </>
      )}
    </svg>
  );
}
