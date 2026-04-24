# src/generation

Scenario-to-layout pipeline. Loads CDOT S-630-1 case definitions from
`configs/cdot_cases.yaml`, models schematic road geometry (lanes, shoulders,
medians), and places devices on that geometry according to MUTCD rules. The
output is a structured layout object consumed by the rendering, export, and
narrative packages.
