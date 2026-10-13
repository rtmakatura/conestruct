# The Mapbox wordmark hidden in the picker (R140, investigation only, no code)

Investigated 2026-10-13. Probe scripts read the tokens at run time and never printed or stored
them.

## Why `display: none`

Mapbox GL JS (installed **3.23.1**; `package.json` asks `^3.8.0`) hides its own logo control
whenever any map source says the logo isn't required:

- `node_modules/mapbox-gl/dist/mapbox-gl-dev.js:94601`: the control starts hidden
  (`this._container.style.display = "none";`) and re-checks on every `sourcedata` event (:94602).
- `:94616–94619` `_updateLogo` sets `block`/`none` from `_logoRequired()`.
- `:94621–94631` `_logoRequired` returns false if any source has `mapbox_logo` false:
  `if (source.hasOwnProperty("mapbox_logo") && !source.mapbox_logo) { return false; }`
- `:53168–53169` copies `mapbox_logo` from the TileJSON onto the source; `:53191` uses the style's
  inlined TileJSON when present.

**What Mapbox now serves:** the picker's default style is
`mapbox://styles/mapbox/satellite-streets-v12` (`LocationPickerModal.tsx:163-164`). Requested the
way GL JS requests it (with `&sdk=js-3.23.1`), the style API inlines the `mapbox.satellite` source
with **`mapbox_logo: false`** (the streets source: `true`). Production's token and the local
`.env.local` token (different tokens) get the same answer. The standalone TileJSON
(`/v4/mapbox.satellite.json`) still says `true`, and the `streets-v12` style says `true`: on
production, toggling the picker to Streets brings the wordmark back (`display: block`, 88×23).

**Nothing changed on our side:** mapbox-gl last changed in `9f8ba85` (2026-05-11); the map options
are `accessToken, container, style, center, zoom, attributionControl: true` (no `logoPosition`,
`customAttribution` or `mapbox_logo` override); `cc84890`'s CSS is phone-only and never touches
`.mapboxgl-ctrl-logo` (and CSS can't write an inline `style`).

**Reading:** a change on Mapbox's side to the satellite tileset's metadata in the style API,
apparently not rolled out everywhere (the two endpoints disagree, and the local run saw the
wordmark again later on 10-13). Not tied to one token. An account effect can't be fully ruled out
without knowing which account each token belongs to.

## Do the terms still require it?

[docs.mapbox.com/help/getting-started/attribution](https://docs.mapbox.com/help/getting-started/attribution/):

> Maps using Mapbox map styles or data supplied by Mapbox must display both the Mapbox logo and
> text attribution.

> You must also display the Mapbox logo if your map uses a custom style or custom data hosted by
> Mapbox.

> You may not style the Mapbox logo.

The only exceptions on that page drop the *text* credit, never the logo ("you may omit text
attribution but must still include the Mapbox logo"). No plan- or account-based exception, and no
documentation of what `mapbox_logo: false` means or who may set it.

[mapbox.com/legal/tos](https://www.mapbox.com/legal/tos):

> You may not remove any proprietary notices or product identification labels from the Services.

The product terms page links to a PDF (not read). **Our plan isn't recorded in the repo**; the
only pricing note (`issue-301-band-aerial/checkpoint.md:150`, "free to 50,000 a month, then $5.00
per 1,000") suggests pay-as-you-go.

## Conclusion

Mapbox's own code hid the wordmark because Mapbox's style API started marking the satellite
source `mapbox_logo: false`; we didn't remove it. The published terms still say a map using
Mapbox styles must show the logo, with no plan exception. Relying on the hidden state would need
written confirmation from Mapbox (support or contract) that the flag excuses us; until then the
safe reading is that the wordmark is still required.
