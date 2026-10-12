# Rulings: #312 (a near-intersection lane closure on a divided road)

## R134 (Ryan, 2026-10-12), verbatim

> R133 accepted on your prod check.
>
> R134, #312 rulings:
> - Q1: (a), #309's route. Mirror all 8 mainline signs on the median side; one-way and two-way plans stay byte-identical.
> - Q2: -4.0 ft, marked CHOSEN as in #309.
> - Q3: An audit "pending verification" line, plus one crew-sheet line asking the Engineer to confirm the signing at the median opening. Nothing drawn.
> - Q4: "· Divided Highway".
> - 20 mph for near-intersection (main road and cross street): only if S-630-1 Sheet 10's key-distance table, or the source the backend floor cites, has a 20 mph row. Quote it with a page cite. If it doesn't, keep the 25 floor and report what the source says (Rule 12); no change without a source.
>
> Build issue-312-divided-ni. Report before ship with the Colorado Blvd plan sheet, audit PDF and crew sheet (before and after), the Rule 5 outcome against your prediction, and the go.

## The 20 mph question: what the sources say (the floor stays at 25)

**S-630-1 Sheet 10's key: no 20 mph row.** The key is CDOT S-630-1 (July 2026), Standard Sheet No. 10
of 26, "* Key to Advance Signing Distances", PDF p.158
(`validation-artifacts/committed/issue-300-left-side-oneway/sources/s630-1-2026-pdf158.txt:96-108`).
Its rows are road types with speed bands, not speeds:

> "ROAD TYPE A B C / URBAN (< = 40 MPH) 100 100 100 / URBAN (> = 45 MPH) 350 350 350 / RURAL 500 500 500 / EXPRESSWAY/FREEWAY 1000 1500 2640"

A 20 mph urban road falls inside the "< = 40 MPH" band (A = B = C = 100 ft), but the key names no
20 mph row. The row values above are read off the extraction's column layout; that's the column order
the code's key table already uses.

**The source the floor cites: a project ruling, not a standard.** The approach floor,
`src/api/schemas.py:800-803`:

> "Floor 25 per the increment-1 ruling — matching the enabled kinds' form floor, not the Table 6B-2
> grid floor (the tables serve 20 mph, but that wider bound was offered and declined)."

The mainline floor (`:881-882` on `issue-312-divided-ni-r2`) points to it: "floor 25 per the
increment-1 ruling (same as the approach floor above)".

- **The ruling's text isn't in the repo.** I searched `validation-artifacts/` and `src/`; only these
  two comments name it.
- **The "Table 6B-2" it mentions is MUTCD 11th Ed. Table 6B-2, the longitudinal buffer space table.**
  It does run from 20 mph (`src/rules/spacing.py:227`: "valid values are 20, 25, 30, ..., 75"), but it
  is not the advance-signing key the near-intersection signs are placed from.

**So, under R134 and Rule 12, the 25 floor stays and nothing changes.** If you want 20, the source to
rule on is whether Sheet 10's "URBAN (< = 40 MPH)" band covers 20 mph on this plate. The band
suggests it does, but the plate doesn't say so in a row.
