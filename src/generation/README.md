# src/generation

Scenario-to-layout pipeline. The CDOT S-630-1 case layouts are implemented
as hard-coded generators in `layout.py` (there is no external case-definition
file). It models schematic road geometry (lanes, shoulders, medians) and
places devices on that geometry according to MUTCD rules. The output is a
structured layout object consumed by the rendering, export, and narrative
packages. See `skills/cdot-s630-cases/SKILL.md` for the emitted case
vocabulary.
