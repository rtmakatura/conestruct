type Props = {
  W: number;
  S: number;
  L: number;
  B: number;
  sp: number;
};

function DimLine({
  x1,
  x2,
  y,
  label,
  small,
}: {
  x1: number;
  x2: number;
  y: number;
  label: string;
  small?: boolean;
}) {
  const mid = (x1 + x2) / 2;
  const w = Math.max(50, label.length * 6 + 8);
  return (
    <g>
      <line x1={x1} y1={y - 4} x2={x1} y2={y + 22} stroke="#E8710A" strokeWidth="0.6" />
      <line x1={x2} y1={y - 4} x2={x2} y2={y + 22} stroke="#E8710A" strokeWidth="0.6" />
      <line x1={x1} y1={y + 5} x2={x2} y2={y + 5} stroke="#E8710A" strokeWidth="0.6" />
      <path
        d={`M ${x1 + 1} ${y + 2} L ${x1 + 5} ${y + 5} L ${x1 + 1} ${y + 8}`}
        fill="none"
        stroke="#E8710A"
        strokeWidth="0.6"
      />
      <path
        d={`M ${x2 - 1} ${y + 2} L ${x2 - 5} ${y + 5} L ${x2 - 1} ${y + 8}`}
        fill="none"
        stroke="#E8710A"
        strokeWidth="0.6"
      />
      <rect x={mid - w / 2} y={y - 6} width={w} height="11" fill="#FAF6F0" />
      <text
        x={mid}
        y={y + 2}
        textAnchor="middle"
        fontFamily="var(--font-mono), JetBrains Mono, monospace"
        fontSize={small ? 8 : 9}
        fill="#1B2838"
        fontWeight="600"
      >
        {label}
      </text>
    </g>
  );
}

export function TaperViz({ L, B, sp }: Props) {
  const scale = 0.45;
  const taperPx = L * scale;
  const bufferPx = B * scale;
  const tangentPx = 60;
  const totalContent = tangentPx + taperPx + bufferPx + 100;
  const vbW = Math.max(800, totalContent + 60);
  const vbH = 180;

  const lane1Y = 50;
  const lane2Y = 95;
  const laneH = 38;

  const t0 = 30 + tangentPx;
  const t1 = t0 + taperPx;
  const b1 = t1 + bufferPx;
  const w1 = b1 + 80;

  const numTaper = Math.max(4, Math.round(L / sp));
  const taperDevices = Array.from({ length: numTaper + 1 }, (_, i) => {
    const tt = i / numTaper;
    return {
      x: t0 + tt * taperPx,
      y: lane2Y + tt * laneH * 0.5,
    };
  });

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "auto", display: "block", maxHeight: 200 }}
    >
      <rect x="0" y={lane1Y} width={vbW} height={laneH} fill="#D9D3CA" />
      <rect x="0" y={lane2Y} width={vbW} height={laneH} fill="#CFC8BD" />
      <line x1="0" y1={lane1Y} x2={vbW} y2={lane1Y} stroke="#9A8E7A" strokeWidth="0.6" />
      <line
        x1="0"
        y1={lane2Y + laneH}
        x2={vbW}
        y2={lane2Y + laneH}
        stroke="#9A8E7A"
        strokeWidth="0.6"
      />
      <line
        x1="0"
        y1={lane2Y}
        x2={t0}
        y2={lane2Y}
        stroke="#FAF6F0"
        strokeWidth="1.4"
        strokeDasharray="10 8"
      />

      <defs>
        <pattern
          id="hatch2"
          patternUnits="userSpaceOnUse"
          width="8"
          height="8"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="8"
            stroke="#C44A6E"
            strokeWidth="0.5"
            opacity="0.5"
          />
        </pattern>
      </defs>
      <rect x={t1} y={lane2Y} width={w1 - t1} height={laneH} fill="#F2C9D6" opacity="0.6" />
      <rect x={t1} y={lane2Y} width={w1 - t1} height={laneH} fill="url(#hatch2)" />

      {taperDevices.map((d, i) => (
        <g key={i} transform={`translate(${d.x}, ${d.y})`}>
          <path
            d="M 0 0 L -3 6 L 3 6 Z"
            fill="#E8710A"
            stroke="#C45F08"
            strokeWidth="0.4"
          />
        </g>
      ))}

      <DimLine x1={t0} x2={t1} y={28} label={`L = ${L} ft`} />
      <DimLine x1={t1} x2={b1} y={28} label={`B = ${B} ft`} />
      <DimLine
        x1={t0}
        x2={t0 + sp * scale}
        y={lane2Y + laneH + 22}
        label={`${sp} ft o.c.`}
        small
      />

      <g transform={`translate(40, ${lane1Y + laneH / 2})`} opacity="0.55">
        <line x1="0" y1="0" x2="20" y2="0" stroke="#1B2838" strokeWidth="1" />
        <path
          d="M 20 0 L 16 -3 M 20 0 L 16 3"
          stroke="#1B2838"
          strokeWidth="1"
          fill="none"
        />
      </g>
    </svg>
  );
}
