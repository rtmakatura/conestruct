# Pivot Plan: Symbol Detection -> MHT/MOT Generation

**Date:** 2026-04-24
**Status:** DRAFT — awaiting review before execution

---

## 1. Files to Archive (not delete)

Move to `legacy/` at repo root. These were built for the symbol-detection
product and are not reusable for the generation product.

| File | Rationale |
|------|-----------|
| `src/detection/__init__.py` | YOLO training pipeline — generation product doesn't run object detection |
| `src/detection/train.py` | YOLO tiling, training, and evaluation — not used in generation flow |
| `src/scraping/__init__.py` | DOT PDF scraper scaffolding — we don't scrape plan PDFs in V1 |
| `src/scraping/txdot.py` | TxDOT FTP scraper — Texas-specific, we're targeting Colorado |
| `src/pdf_processing/__init__.py` | TCP sheet isolation from plan PDFs — we generate PDFs, not parse them |
| `src/pdf_processing/isolate_tcp.py` | PyMuPDF-based TCP page extraction — not needed for generation |
| `src/labeling/__init__.py` | Label Studio tooling scaffolding |
| `src/labeling/import_to_label_studio.py` | Image import script — labeling workflow is paused |
| `src/labeling/export_to_yolo.py` | YOLO export script — no YOLO training in generation product |
| `src/labeling/audit_annotations.py` | Annotation audit script — labeling workflow is paused |
| `src/labeling/migrate_taxonomy.py` | Class name migration — labeling workflow is paused |
| `src/api/demo_app.py` | Gradio detection demo — entirely replaced by the generation web form |
| `src/api/__init__.py` | Detection API scaffolding |
| `src/evaluation/__init__.py` | Evaluation module placeholder — not used in generation flow |
| `scripts/deploy_to_hf_spaces.sh` | HF Spaces deployment for the Gradio detection demo |
| `notebooks/01_train_on_kaggle.ipynb` | Kaggle training notebook — not applicable |
| `configs/label_studio_config.xml` | Label Studio labeling interface config |

**Archive preserves:** directory structure under `legacy/` so paths remain
readable (e.g., `legacy/src/detection/train.py`).

---

## 2. Files to Keep As-Is

| File / Directory | Rationale |
|-----------------|-----------|
| `pyproject.toml` | Monorepo config — dependencies will change but structure stays |
| `.pre-commit-config.yaml` | Ruff + pre-commit hooks — reusable |
| `.gitignore` | Standard Python gitignore — reusable |
| `.vscode/settings.json` | Editor config — reusable |
| `LICENSE` | MIT license — unchanged |
| `src/__init__.py` | Top-level package init — reusable |
| `tests/.gitkeep` | Test directory placeholder |
| `data/.gitkeep` | Data directory placeholder |
| `eval/.gitkeep` | Eval directory placeholder |
| `notebooks/.gitkeep` | Notebooks directory placeholder |
| `data/processed/wsdot_typicals/` | 203 labeled WSDOT TCP PNGs — repurpose as sprite library source |
| `data/backups/migration_log_*.csv` | Migration audit trail — keep for reference |
| Label Studio database (local) | 1,038 labeled bounding boxes — export symbol crops later for sprites |

---

## 3. Files to Rewrite

| File | What Changes |
|------|-------------|
| `README.md` | Complete rewrite: new product description, new scope, new setup instructions, new roadmap |
| `pyproject.toml` | New description, swap dependencies (drop ultralytics/fitz, add reportlab/openpyxl/jinja2/fastapi) |

---

## 4. New Directories/Files to Create

```
src/
  rules/                          # MUTCD rules engine
    __init__.py
    devices.py                    # Device vocabulary (15 classes + Colorado additions)
    spacing.py                    # Taper formulas, buffer distances, device spacing
    tables.py                     # MUTCD Table 6C-3, 6C-4 lookups (speed -> distance)
    validators.py                 # Validate a placement layout against MUTCD rules

  generation/                     # Scenario -> layout pipeline
    __init__.py
    scenarios.py                  # CDOT S-630-1 case definitions (39 cases)
    layout.py                     # Place devices on schematic road geometry
    road_geometry.py              # Simple lane/shoulder/median models (not CAD)

  rendering/                      # Layout -> PDF plan sheet
    __init__.py
    plan_sheet.py                 # Render schematic plan: svgwrite for drawing, cairosvg for rasterization, reportlab for title block + multi-page PDF assembly. Optional Mapbox Static API aerial embed (requires MAPBOX_TOKEN).
    styles.py                     # CDOT S-630-1 visual style constants (line weights, colors, fonts)
    sprites.py                    # Load and place device sprites on the plan

  narrative/                      # Layout -> crew instructions
    __init__.py
    crew_narrative.py             # Generate setup/takedown Markdown from layout
    templates/                    # Jinja2 templates for narrative sections
      base.md.j2
      setup.md.j2
      takedown.md.j2

  export/                         # Layout -> Excel device list
    __init__.py
    device_list.py                # Build CDOT Spec 630 pay item spreadsheet
    cdot_pay_items.py             # CDOT Section 630 pay item codes and units

  api/                            # Web application
    __init__.py
    app.py                        # Streamlit single-form generation UI with file downloads
    schemas.py                    # Pydantic models for scenario input/output

assets/
  sprites/                        # Device symbol PNGs cropped from labeled data
    cone.png
    drum.png
    ...                           # One per device class (15+)
  templates/                      # CDOT-style plan sheet templates/backgrounds
    s630_border.svg               # Standard plan sheet border
  pay_items/                      # Reference data
    cdot_630_items.csv            # CDOT Spec 630 pay item codes, units, descriptions

configs/
  cdot_cases.yaml                 # 39 CDOT case scenario definitions
```

---

## 5. Skills to Create, Modify, or Retire

### Modify

| Skill | Action |
|-------|--------|
| `mutcd-symbols` | **Rewrite** as device vocabulary for the rules engine. Keep the 15-class taxonomy as the device type enum. Add Colorado-specific devices (CDOT Type 2 barrier, CDOT-specific sign panels). Remove labeling-specific content (hotkeys, confusion pairs, DPI notes). Add MUTCD Part 6 section references for each device. |
| `dot-data-sources` | **Rewrite** as `colorado-sources`. Drop TxDOT/WSDOT/ODOT sections. Add CDOT-specific references: S-630-1 typical cases document, CDOT Spec 630 pay items, CDOT M&S Standards, Colorado-specific speed/spacing tables. |

### Shelve (move to `legacy/skills/`)

| Skill | Rationale |
|-------|-----------|
| `civil-pdf-parsing` | We generate PDFs, not parse them. DPI/tiling/text-extraction knowledge not needed. |
| `yolo-training-pipeline` | No object detection in V1. Tiling, augmentation, NMS knowledge not applicable. |
| `label-studio-workflow` | Labeling is paused. Keep in legacy for when we resume sprite extraction. |

### Create New

| Skill | Purpose |
|-------|---------|
| `mutcd-rules-engine` | MUTCD Part 6 math: taper length formulas (L = WS^2/60 for >= 45mph, L = WS for < 45mph), buffer space calculations, longitudinal spacing from Table 6C-4, advance warning sign spacing from Table 6C-3. Include worked examples for each formula. |
| `cdot-s630-cases` | The 39 CDOT S-630-1 typical case scenarios. For each case: applicable road types, lane configurations, closure types, required devices, and layout geometry. This is the core domain knowledge for V1. |
| `schematic-rendering` | Approach for rendering plan sheets: svgwrite for vector drawing, cairosvg for SVG-to-PDF rasterization, reportlab for title block and multi-page PDF assembly. Covers coordinate system, device placement logic, layer ordering, line weights, text placement, output resolution. Optional Mapbox Static API aerial embed. |
| `device-list-export` | CDOT Spec 630 pay item mapping: how each of the 15 device classes maps to a CDOT pay item code + unit, quantity roll-up rules, CHANNELIZER_OPTIONAL probability weighting, Excel output format. |

---

## 6. Order of Execution

### Phase 0: Housekeeping

1. Archive detection-era files to `legacy/`
2. Shelve detection-era skills to `legacy/skills/`
3. Rewrite `README.md` with new product scope
4. Update `pyproject.toml` dependencies (drop YOLO/fitz, add reportlab/openpyxl/jinja2/fastapi)
5. Create new directory structure (empty `__init__.py` files)

### Phase 1: Domain Knowledge (skills + reference data)

6. Rewrite `mutcd-symbols` skill as device vocabulary
7. Create `mutcd-rules-engine` skill — codify taper/spacing/buffer formulas
8. Rewrite `dot-data-sources` as `colorado-sources` skill
9. Create `cdot-s630-cases` skill — document all 39 CDOT cases
10. Create `device-list-export` skill — CDOT pay item mapping
11. Build `configs/cdot_cases.yaml` and `assets/pay_items/cdot_630_items.csv`

### Phase 2: Rules Engine

12. Build `src/rules/devices.py` — device enum with all 15 classes: CONE, DRUM, TUBULAR_MARKER, BARRICADE_TYPE_II, BARRICADE_TYPE_III, LONGITUDINAL_CHANNELIZER, ARROW_BOARD, PCMS, TRUCK_MOUNTED_ATTENUATOR, TEMPORARY_BARRIER, FLAGGER_STATION, TEMPORARY_SIGNAL, SIGN_GENERIC, DETOUR_MARKER, CHANNELIZER_OPTIONAL. Device defaults live as dataclass attributes, not a separate YAML file.
13. Build `src/rules/tables.py` — MUTCD lookup tables
14. Build `src/rules/spacing.py` — taper/buffer/spacing calculations
15. Build `src/rules/validators.py` — layout validation
16. Write tests for rules engine (pure math — highly testable)

### Phase 3: Layout Generation

17. Build `src/generation/road_geometry.py` — schematic lane models
18. Build `src/generation/scenarios.py` — load CDOT case definitions
19. Build `src/generation/layout.py` — device placement on geometry
20. Write tests for layout generation

### Phase 4: Outputs

21. Extract device sprites from labeled WSDOT data (one-time script)
22. Build `src/rendering/plan_sheet.py` — PDF plan rendering
23. Create `schematic-rendering` skill
24. Build `src/export/device_list.py` — Excel device list
25. Build `src/narrative/crew_narrative.py` — LLM-based crew narrative generation via Claude Haiku (anthropic SDK)
26. Write tests for all three output formats

### Phase 5: Web Application

27. Build `src/api/app.py` — Streamlit form with scenario input fields
28. Wire form -> rules engine -> layout -> three output files
29. Add Streamlit download buttons for PDF + Excel + Markdown
30. End-to-end integration test: submit scenario, get three files

### Phase 6: Validation

31. Manual review: generate plans for 3-5 CDOT cases, compare against S-630-1 typicals
32. Iterate on device placement and rendering fidelity
33. Get feedback from a TCS (Traffic Control Supervisor) if possible

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `MAPBOX_TOKEN` | Optional | Mapbox Static API token for aerial embed in plan sheets (`src/rendering/plan_sheet.py` calls Mapbox via httpx) |
| `ANTHROPIC_API_KEY` | Required | Claude Haiku API key for LLM-based crew narrative generation (`src/narrative/crew_narrative.py`) |

## Dependencies to Add (pyproject.toml)

```
reportlab>=4.0           # PDF title block and multi-page assembly
svgwrite>=1.4            # Plan sheet SVG drawing
cairosvg>=2.7            # SVG -> PDF/PNG rasterization
openpyxl>=3.1            # Excel output
jinja2>=3.1              # Narrative templating
streamlit>=1.40          # V1 web UI (single-form generation tool)
pydantic>=2.0            # Input validation / schemas
pyyaml>=6.0              # CDOT case config files
anthropic>=0.40          # Claude Haiku for crew narrative generation
```

## Dependencies to Drop

```
ultralytics>=8.3         # YOLO — not needed for generation
gradio>=5.0              # Detection demo UI — replaced by Streamlit
beautifulsoup4>=4.12     # Scraping — not needed
label-studio>=1.14       # Labeling — move to dev-only or drop
```

## Dependencies to Keep

```
pymupdf>=1.25            # Reading CDOT reference PDFs, extracting sign sprites
pillow>=11.0             # Image handling for sprites
numpy>=2.0               # Geometry math
opencv-python-headless>=4.10  # Sprite cropping (may drop later)
httpx>=0.28              # Mapbox Static API calls, potential integrations
pypdfium2>=4.30          # PDF post-processing / validation
```
