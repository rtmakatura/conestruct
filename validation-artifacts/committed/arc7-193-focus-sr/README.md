# Arc 7 — #193 focus / screen-reader after Generate

Evidence pack. The capture instrument (`a11y-repro.instrument.tsx`) is
log-only and byte-identical across both runs — the diff of its output
is the evidence. Run per the header comment (copy into
`conestruct/site/components/`, run isolated, delete the copy).

- `pre-fix-repro-log.txt` — at `0da6e12` (origin/main before any edit)
- `post-fix-repro-log.txt` — at the arc's third commit

| Capture | Pre-fix (0da6e12) | Post-fix |
|---|---|---|
| A — keyboard Enter on Generate (success) | focus `<body>`; live regions byte-identical before/after (nothing announces the package) | focus `<section zone>` (results); `role="status"` reads "Plan generated — 42 devices, 6 types." |
| B — failed generation | focus `<body>`; failure visible only (ribbon has no role) | focus `<section zone>`; ribbon is `role="alert"` |
| C — strip inline editor close | autoFocus in ✓, then focus `<body>` on done() | focus restored to the `Edit Speed` cell button |
| D — Reopen full setup | focus `<body>` | focus `<section zone>` (Setup) |
| E — background debounce settle (control) | focus unmoved ✓ | focus unmoved ✓ (unchanged, now asserted) |
| F — picker close with detached opener | focus `<body>` | `<body>` in this capture **by design**: the instrument mounts the modal bare, without the `restoreFallbackRef` the shell now passes. The fixed path (fallback focused; connected opener still preferred) is asserted mounted in `LocationPickerModal.a11y.test.tsx`. |

The pre-fix A row also shows the sidebar's jurisdiction-suggest
`aria-live` region silently unmounting with the panel — flagged in the
plan as adjacent debt, not fixed in this arc.
