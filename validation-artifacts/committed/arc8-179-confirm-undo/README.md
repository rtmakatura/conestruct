# Arc 8 evidence — #179 confirm rows vanish, no undo

Capture instrument: `confirm-capture-179.instrument.tsx` (log-only; run
by copying to `conestruct/site/components/ConfirmCapture179.scratch.test.tsx`
— the SAME file produced both logs, so their diff is the evidence).

- `pre-fix-capture-log.txt` — at clean `e003708` (main), 2026-08-02.
- `post-fix-capture-log.txt` — at `b36800c` (issue-179-confirm-undo tip).

| Capture | Pre-fix | Post-fix |
|---|---|---|
| A — #86 multilane tick (E Colfax shape 5 total / 3 forward) | row GONE from the checkbox list post-tick; `aria-checked` never true; payload carries the marker with nothing on screen | row persists, `checked:"true"`, desc "Map data reported 5 total lanes (3 forward) — untick to restore detection" |
| B — #136 single-lane tick | same vanish | row persists checked, "Map data reported 1 total lane" |
| C — #158 one-way tick | same vanish | row persists checked, "Map data reported a one-way road (oneway=yes)" |
| D — multi-tick #86 then #158 | both vanish in sequence; two markers, zero visible state | each row persists checked independently; after tick 1 the #158 row still renders armed beside the confirmed #86 row |
| E — NI "Lane count is right" (gated kind) | banner vanishes; marker rides wire invisibly | banner replaced by the confirmed note + "Undo — restore detected lane data" button. **Instrument caveat:** the capture's DOM query lists only `[role=checkbox]` and alert buttons, so the note (a plain div + button) does not appear in E's log line — `GeneratorForms.confirm-undo.test.tsx` asserts it mounted |
| F — NI confirm-then-edit ordering hazard | records the semantics finding: the post-confirm manual edit touches only `lanesPerDirection` and records nothing — the erase set is disjoint from every user-editable field, so marker-reversal IS snapshot restore | unchanged capture; the undo path (restore relays, preserve the manual count) is asserted mounted |

Payload lines in both logs additionally show the byte-level shapes the
mounted suites assert: post-tick payloads carry the marker; the
tick-then-untick payload equality is asserted in
`GeneratorForms.confirm-undo.test.tsx` (form level) and
`GeneratorShell.confirm-undo-loop.test.tsx` (audit POST body level).

Adjacent debt, flagged not fixed (in the approved scope): the NI
sidebar's one-time needs-confirmation hold does not return on undo —
UI state, not payload; the restored relays re-engage the backend gate,
which is the only blocking path (documented at the undo handler).
