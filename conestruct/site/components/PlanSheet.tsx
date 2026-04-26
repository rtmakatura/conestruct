type Stage = 0 | 1 | 2 | 3 | 4;

type FadeProps = {
  stage: number;
  current: Stage;
  delayMs: number;
  children: React.ReactNode;
};

function Fade({ stage, current, delayMs, children }: FadeProps) {
  const visible = current >= stage;
  return (
    <g
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity 0.5s ease ${delayMs}ms`,
      }}
    >
      {children}
    </g>
  );
}

function Cone({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path
        d="M 0 0 L -4 8 L 4 8 Z"
        fill="#E8710A"
        stroke="#C45F08"
        strokeWidth="0.5"
      />
      <line x1="-3" y1="4" x2="3" y2="4" stroke="white" strokeWidth="0.6" />
    </g>
  );
}

function Sign({ x, y, code }: { x: number; y: number; code: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x="-7"
        y="-7"
        width="14"
        height="14"
        fill="#27AE60"
        transform="rotate(45)"
      />
      <text
        x="0"
        y="22"
        textAnchor="middle"
        fontFamily="var(--font-mono), JetBrains Mono, monospace"
        fontSize="8"
        fill="#1B2838"
        fontWeight="600"
      >
        {code}
      </text>
    </g>
  );
}

function ArrowBoard({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x="-14"
        y="-5"
        width="28"
        height="10"
        fill="#F2C94C"
        stroke="#1B2838"
        strokeWidth="0.4"
      />
      <path
        d="M -8 0 L 6 0 L 4 -3 M 6 0 L 4 3"
        stroke="#1B2838"
        strokeWidth="1"
        fill="none"
      />
    </g>
  );
}

function Dimension({
  x1,
  x2,
  y,
  label,
  sub,
}: {
  x1: number;
  x2: number;
  y: number;
  label: string;
  sub: string;
}) {
  const mid = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y} x2={x1} y2={y + 25} stroke="#E8710A" strokeWidth="0.6" />
      <line x1={x2} y1={y} x2={x2} y2={y + 25} stroke="#E8710A" strokeWidth="0.6" />
      <line x1={x1} y1={y + 6} x2={x2} y2={y + 6} stroke="#E8710A" strokeWidth="0.6" />
      <path
        d={`M ${x1 + 1} ${y + 3} L ${x1 + 5} ${y + 6} L ${x1 + 1} ${y + 9}`}
        fill="none"
        stroke="#E8710A"
        strokeWidth="0.6"
      />
      <path
        d={`M ${x2 - 1} ${y + 3} L ${x2 - 5} ${y + 6} L ${x2 - 1} ${y + 9}`}
        fill="none"
        stroke="#E8710A"
        strokeWidth="0.6"
      />
      <rect x={mid - 36} y={y - 6} width="72" height="12" fill="#FAF6F0" />
      <text
        x={mid}
        y={y + 2}
        textAnchor="middle"
        fontFamily="var(--font-mono), JetBrains Mono, monospace"
        fontSize="9"
        fill="#1B2838"
        fontWeight="600"
      >
        {label}
      </text>
      <text
        x={mid}
        y={y + 22}
        textAnchor="middle"
        fontFamily="var(--font-mono), JetBrains Mono, monospace"
        fontSize="7"
        fill="#8A95A4"
        letterSpacing="0.12em"
      >
        {sub}
      </text>
    </g>
  );
}

function Schematic({ revealStage }: { revealStage: Stage }) {
  const taperCones = Array.from({ length: 7 }, (_, i) => {
    const t = i / 6;
    const x = 360 + t * 220;
    const y = 220 - t * 50;
    return { x, y, key: "t" + i };
  });
  const lineCones = Array.from({ length: 10 }, (_, i) => ({
    x: 590 + i * 38,
    y: 170,
    key: "l" + i,
  }));

  return (
    <svg
      viewBox="0 0 1100 380"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%" }}
    >
      <Fade stage={1} current={revealStage} delayMs={0}>
        <rect x="0" y="120" width="1100" height="55" fill="#D9D3CA" />
        <rect x="0" y="175" width="1100" height="55" fill="#CFC8BD" />
        <rect x="0" y="230" width="1100" height="14" fill="#ECE4D9" />
        <rect x="0" y="244" width="1100" height="55" fill="#CFC8BD" />
        <rect x="0" y="299" width="1100" height="55" fill="#D9D3CA" />
        <line x1="0" y1="232" x2="1100" y2="232" stroke="#E5B83A" strokeWidth="1.4" />
        <line x1="0" y1="242" x2="1100" y2="242" stroke="#E5B83A" strokeWidth="1.4" />
        <line
          x1="0"
          y1="175"
          x2="1100"
          y2="175"
          stroke="#FAF6F0"
          strokeWidth="1.5"
          strokeDasharray="14 10"
        />
        <line
          x1="0"
          y1="299"
          x2="1100"
          y2="299"
          stroke="#FAF6F0"
          strokeWidth="1.5"
          strokeDasharray="14 10"
        />
        <line x1="0" y1="120" x2="1100" y2="120" stroke="#9A8E7A" strokeWidth="1" />
        <line x1="0" y1="354" x2="1100" y2="354" stroke="#9A8E7A" strokeWidth="1" />
        <g opacity="0.55">
          <path
            d="M 60 148 L 90 148 L 86 144 M 90 148 L 86 152"
            stroke="#1B2838"
            strokeWidth="1.2"
            fill="none"
          />
          <path
            d="M 60 207 L 90 207 L 86 203 M 90 207 L 86 211"
            stroke="#1B2838"
            strokeWidth="1.2"
            fill="none"
          />
        </g>
      </Fade>

      <Fade stage={2} current={revealStage} delayMs={300}>
        <path
          d="M 580 175 L 1000 175 L 1000 230 L 580 230 Z"
          fill="#F2C9D6"
          opacity="0.65"
        />
        <defs>
          <pattern
            id="hatch"
            patternUnits="userSpaceOnUse"
            width="10"
            height="10"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="10"
              stroke="#C44A6E"
              strokeWidth="0.7"
              opacity="0.4"
            />
          </pattern>
        </defs>
        <rect x="580" y="175" width="420" height="55" fill="url(#hatch)" />
        <text
          x="790"
          y="207"
          textAnchor="middle"
          fontFamily="var(--font-mono), JetBrains Mono, monospace"
          fontSize="11"
          fill="#1B2838"
          fontWeight="600"
          letterSpacing="0.12em"
        >
          WORK AREA
        </text>
      </Fade>

      <Fade stage={2} current={revealStage} delayMs={550}>
        {taperCones.map((c) => (
          <Cone key={c.key} x={c.x} y={c.y} />
        ))}
        {lineCones.map((c) => (
          <Cone key={c.key} x={c.x} y={c.y} />
        ))}
      </Fade>

      <Fade stage={3} current={revealStage} delayMs={850}>
        <Dimension x1={360} x2={580} y={92} label="L = 650 ft" sub="TAPER" />
        <Dimension x1={580} x2={780} y={92} label="B = 645 ft" sub="BUFFER" />
        <Dimension x1={780} x2={1000} y={92} label="0.40 mi" sub="WORK ZONE" />
      </Fade>

      <Fade stage={4} current={revealStage} delayMs={1100}>
        <Sign x={120} y={108} code="W20-1" />
        <Sign x={210} y={108} code="W20-5" />
        <Sign x={300} y={108} code="W4-2" />
        <ArrowBoard x={480} y={195} />
      </Fade>

      <Fade stage={1} current={revealStage} delayMs={0}>
        <g transform="translate(1040, 350)" opacity="0.7">
          <circle cx="0" cy="0" r="14" fill="none" stroke="#1B2838" strokeWidth="0.8" />
          <path d="M 0 -10 L 4 6 L 0 3 L -4 6 Z" fill="#1B2838" />
          <text
            x="0"
            y="22"
            textAnchor="middle"
            fontFamily="var(--font-mono), JetBrains Mono, monospace"
            fontSize="8"
            fill="#1B2838"
          >
            N
          </text>
        </g>
      </Fade>
    </svg>
  );
}

export function PlanSheet({ revealStage }: { revealStage: Stage }) {
  return (
    <div className="relative bg-paper border border-line overflow-hidden aspect-[11/8.5] shadow-[0_1px_0_rgba(27,40,56,0.05),0_24px_48px_-24px_rgba(27,40,56,0.25)]">
      {/* fine grid overlay */}
      <div className="absolute inset-0 pointer-events-none blueprint-grid-fine" />

      {/* title block */}
      <div className="absolute top-0 left-0 right-0 z-[2] flex justify-between bg-white border-b border-line px-3.5 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-navy">
        <span className="font-semibold">Method of Handling Traffic</span>
        <span className="text-ink-faint">SHT 1 OF 1 · MUTCD 2023 · CDOT S-630-1</span>
      </div>

      {/* schematic */}
      <div className="absolute top-7 bottom-20 left-0 right-0 overflow-hidden">
        <Schematic revealStage={revealStage} />
        <div
          className={`absolute inset-0 flex items-center justify-center bg-paper z-[4] font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint transition-opacity duration-500 ${
            revealStage > 0 ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <span className="inline-block w-2.5 h-2.5 mr-3 rounded-full border-[1.5px] border-line border-t-orange animate-spin" />
          Computing taper · spacing · sign placement
        </div>
      </div>

      {/* bottom legend + notes */}
      <div className="absolute bottom-0 left-0 right-0 z-[2] grid grid-cols-2 bg-white border-t border-line font-mono text-[9px]">
        <div className="px-3 py-2 border-r border-line">
          <h4 className="m-0 mb-1.5 text-[9px] uppercase tracking-[0.12em] text-ink-faint font-semibold">
            Legend
          </h4>
          <div className="flex items-center gap-2 text-[10px] text-navy mb-[3px]">
            <span
              className="shrink-0"
              style={{
                width: 0,
                height: 0,
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderBottom: "8px solid var(--orange)",
              }}
            />
            Channelizing device (cone)
          </div>
          <div className="flex items-center gap-2 text-[10px] text-navy mb-[3px]">
            <span className="shrink-0 bg-green w-2 h-2 m-px rotate-45" />
            Advance warning sign
          </div>
          <div className="flex items-center gap-2 text-[10px] text-navy mb-[3px]">
            <span
              className="shrink-0"
              style={{ width: 10, height: 10, background: "#F2C94C" }}
            />
            Arrow board
          </div>
        </div>
        <div className="px-3 py-2">
          <h4 className="m-0 mb-1.5 text-[9px] uppercase tracking-[0.12em] text-ink-faint font-semibold">
            Notes
          </h4>
          {[
            ["Taper L", "650 ft"],
            ["Buffer B", "645 ft"],
            ["Spacing", "65 ft o.c."],
            ["Devices", "34 cones · 5 signs"],
          ].map(([label, val]) => (
            <div
              key={label}
              className="flex justify-between text-[10px] text-navy mb-0.5"
            >
              <span className="text-ink-faint">{label}</span>
              <span>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
