import { ZONE_CHANNEL, ZONE_COLOR, type CorridorZone } from "@/lib/corridor-zones";

// #131: a corridor legend keyed by a colour chip alone can't be read by a
// colour-vision-deficient user or off a grayscale print — the same failure
// as the map it explains.  So every swatch is a *line sample* carrying the
// zone's actual non-colour channel: its dash signature and its width rank,
// the same ones the map draws.  Colour is retained as the redundant cue.
export function ZoneChannelSwatch({
  zone,
  className,
}: {
  zone: CorridorZone;
  className?: string;
}) {
  const ch = ZONE_CHANNEL[zone];
  // Rank 1..5 → ~1.2..3.6 px, matching the map's monotonic width ramp.
  const stroke = 0.6 * ch.widthRank + 0.6;
  // dash units are multiples of the line width, exactly as mapbox-gl reads
  // them; a single-element array is the "solid" sentinel → no dasharray.
  const dash =
    ch.dash.length > 1 ? ch.dash.map((d) => d * stroke).join(" ") : undefined;
  return (
    <svg
      className={className}
      width="24"
      height="8"
      viewBox="0 0 24 8"
      aria-hidden="true"
    >
      <line
        x1="1"
        y1="4"
        x2="23"
        y2="4"
        stroke={ZONE_COLOR[zone]}
        strokeWidth={stroke}
        strokeDasharray={dash}
        strokeLinecap={dash ? "butt" : "round"}
      />
    </svg>
  );
}
