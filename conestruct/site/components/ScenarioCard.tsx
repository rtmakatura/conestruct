export const SCENARIO_FIELDS = [
  { key: "road_type:", val: "rural divided hwy" },
  { key: "speed_limit:", val: "65 mph" },
  { key: "closure:", val: "right lane" },
  { key: "length:", val: "0.4 mi" },
  { key: "lanes_dir:", val: "2" },
  { key: "project:", val: "I-25 MM 184" },
] as const;

type Phase = "typing" | "generating" | "revealed";

type Props = {
  phase: Phase;
  activeIdx: number;
  partial: string;
  progress: number;
};

export function ScenarioCard({ phase, activeIdx, partial, progress }: Props) {
  const phaseLabel =
    phase === "typing" ? "INPUT" : phase === "generating" ? "GENERATING" : "READY";

  return (
    <div className="absolute -top-5 -left-2.5 w-[280px] z-[3] bg-white border border-line font-mono text-[12px] shadow-[0_12px_32px_-16px_rgba(27,40,56,0.18)]">
      {/* header */}
      <div className="flex items-center justify-between bg-navy text-paper px-3 py-2 text-[10px] uppercase tracking-[0.12em]">
        <span>SCENARIO INPUT</span>
        <span className="w-1.5 h-1.5 bg-green rounded-full animate-pulse" />
      </div>

      {/* body */}
      <div className="px-3.5 pt-3.5 pb-2 text-navy min-h-[140px]">
        {SCENARIO_FIELDS.map((f, i) => {
          if (i > activeIdx) return null;
          const isActive = i === activeIdx;
          const isDone = i < activeIdx;
          return (
            <div key={f.key} className="block">
              <span className="text-ink-faint">{f.key} </span>
              <span className="text-navy font-medium">
                {isDone ? f.val : partial}
              </span>
              {isActive && (
                <span className="inline-block w-[7px] h-3.5 bg-orange ml-0.5 align-text-bottom animate-blink" />
              )}
            </div>
          );
        })}
      </div>

      {/* progress */}
      <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-ink-faint">
        <span>{phaseLabel}</span>
        <div className="flex-1 h-1 bg-beige-deep mx-3 relative">
          <div
            className="h-full bg-orange transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span>{Math.round(progress)}%</span>
      </div>
    </div>
  );
}
