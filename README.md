# traffic-control-tool

Generate complete Maintenance of Traffic (MHT/MOT) plan packages from a work zone description. A certified Traffic Control Supervisor fills out a web form — jurisdiction, speed limit, lane count, closure type, duration — and receives three output files ready for field use and bid submission.

This tool targets Colorado Department of Transportation (CDOT) state highways as its first jurisdiction. It implements the 39 typical traffic control cases from CDOT Standard Plan S-630-1, applying MUTCD Part 6 spacing and taper formulas to place devices on schematic road geometry. No CAD software or uploaded drawings required.

The three output files per generation are: (1) a PDF plan sheet rendered in CDOT S-630-1 typical style showing devices placed on a schematic road, (2) an Excel device list with CDOT Section 630 pay items and quantities, and (3) a Markdown crew narrative with setup instructions, flagger positions, and takedown sequence.

## Architecture

```
traffic-control-tool/
  src/
    rules/          # MUTCD rules engine (device vocab, spacing, tapers, validators)
    generation/     # Scenario -> device layout pipeline (CDOT cases, road geometry)
    rendering/      # Layout -> PDF plan sheet (svgwrite + cairosvg + reportlab)
    narrative/      # Layout -> crew narrative (Jinja2 + Claude Haiku)
    export/         # Layout -> Excel device list (openpyxl, CDOT Spec 630 pay items)
    api/            # Streamlit web UI
  assets/
    sprites/        # Device symbol PNGs (cropped from labeled WSDOT data)
    templates/      # Plan sheet border/title block templates
    pay_items/      # CDOT Section 630 pay item reference data
  configs/          # CDOT case definitions (YAML)
  skills/           # Claude Code skills (domain knowledge)
  tests/            # pytest tests
```

## Setup

Requires Python 3.11+ and [uv](https://docs.astral.sh/uv/).

```bash
uv sync
uv run pre-commit install
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full pre-commit setup, including frontend hooks and required `npm install` for the Next.js site.

### Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | Claude Haiku for crew narrative generation |
| `MAPBOX_TOKEN` | No | Mapbox Static API for optional aerial embeds in plan sheets |

### Run the app

```bash
uv run streamlit run src/api/app.py
```

## License

This project's own code is MIT-licensed. See [LICENSE](LICENSE).

---

## Previous scope

This project was originally a YOLO-based symbol detection tool for identifying
traffic control devices on DOT plan PDF sheets. That code has been archived to
[`legacy/`](legacy/README.md) and may be reused for sprite extraction. See
[`PIVOT_PLAN.md`](PIVOT_PLAN.md) for the full migration plan.
