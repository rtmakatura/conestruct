# Rule 5 prediction: issue-194-saved-quote (written before any code)

Base: `issue-307-download-rescan` at `88e26001` (stacked).

## What changes

**One component, `conestruct/site/components/QuotePanel.tsx`, in saved mode only** (`mode.kind === "saved"`: the workbench at `/app/plans/[id]`, behind the unset `NEXT_PUBLIC_AUTH_UI`, reachable signed in by URL).

- The eight `NumberField`s go: Duration, Flaggers (with its "Auto · 0 from layout" caption), Delivery, Overhead, Profit, Flagger $/hr, TCS $/hr, Crew $/hr.
- In their place is one `tr-prov` line built from `DEFAULT_QUOTE_SETTINGS`, reading today:

  > This saved plan's quote uses the default settings: 1 day, 0 flaggers, 20 mi delivery, 10% overhead, 10% profit, and $55 flagger, $75 TCS and $45 crew per hour. Custom rates can't be saved with a plan yet.

- The download control below it (the anchor, the dirty-plan "Save to download the edited plan", or the sign-up link) is unchanged.

**Public mode (`/sandbox`) is unchanged:** same fields, same captions, same buttons.

## Tests

- New `components/QuotePanel.saved-mode.test.tsx`, mounted (Rule 11):
  - saved mode renders no spinbutton and no "Auto ·" caption;
  - it renders the line with each default's value;
  - the download anchor still points at `/api/plans/<id>/quote`;
  - public mode still renders the eight fields and the flagger caption.
- Existing suites unchanged. Type census unchanged (`tr-prov` is a role class, not a Tailwind size). Site suite count +the new test's cases.

## Ship

Frontend-only. On prod the saved surface is dormant (flag off; seeing it needs a signed-in account), so the prod check is `/sandbox`'s quote panel unchanged: the eight fields and the flagger caption are present after a Generate.
