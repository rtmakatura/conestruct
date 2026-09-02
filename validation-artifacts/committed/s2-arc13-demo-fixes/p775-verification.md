# MUTCD 11th Ed. printed p. 775 — verification by subject (Refs #229)

Source: `validation-artifacts/ta10_flagger/mutcd_part6.pdf`, page text extracted with pypdfium2
(full page text in `mutcd-p775-text.txt`; the PDF's U+2011 non-breaking hyphens are normalised to `-`).
Header line on the page: "December 2023 · MUTCD 11th Edition · Page 775 · Sect. 6B.06 to 6B.08".

## §6B.08 ¶04 (Guidance)
> The appropriate taper length (L) should be determined using the criteria shown in Tables 6B-3 and 6B-4.

## Table 6B-3. Taper Length Criteria for Temporary Traffic Control Zones
> Merging Taper — at least L
> Shifting Taper — at least 0.5 L
> Shoulder Taper — at least 0.33 L
> One-Lane, Two-Way Traffic Taper — 50 feet minimum, 100 feet maximum
> Downstream Taper — 50 feet minimum, 100 feet maximum
> Note: Use Table 6B-4 to calculate L

## Table 6B-4. Formulas for Determining Taper Length
> 40 mph or less — L = WS² / 60
> 45 mph or more — L = WS
> Where: L = taper length in feet; W = width of offset in feet; S = posted speed limit, or off-peak
> 85th-percentile speed prior to work starting, or the anticipated operating speed in mph

## The two cites after the fix, each against its row

| served claim | cite | row |
|---|---|---|
| L = W × S² / 60 (≤ 40 mph) / L = W × S (≥ 45 mph) | Sec 6B.08, Table 6B-4 (taper length L) | "40 mph or less L = WS²/60" / "45 mph or more L = WS" |
| shoulder run L/3 | per Sec 6B.08 (Table 6B-3) | "Shoulder Taper at least 0.33 L" |
| lane / near-intersection run = full L | (Table 6B-3) | "Merging Taper at least L" |

Values verified unchanged on the Lakewood control (35 mph, 8 ft shoulder): L = 8 × 35² / 60 = 163 ft, L/3 = 54 ft
(`tests/test_taper_citation_tables.py` pins both against the spacing helpers).

Citation counter: 18 → 19 (this defect). The correction above is itself a claim and is verified here by subject.
