# Schematic Rendering

Approach for rendering MHT plan sheets as PDF documents. The rendering
pipeline converts a device layout (from `src/generation/`) into a PDF plan
sheet styled after CDOT S-630-1 typicals.

Implemented in `src/rendering/`.

---

## Rendering Stack

| Layer | Library | Purpose |
|-------|---------|---------|
| Vector drawing | **svgwrite** | Generate SVG elements: road geometry, lane lines, device sprites, labels, dimensions |
| Rasterization | **cairosvg** | Convert SVG → PDF page or PNG for preview |
| PDF assembly | **reportlab** | Title block, sheet border, multi-page assembly, metadata |

### Why This Stack

- **svgwrite** is pure Python, produces clean SVG that can be inspected and
  debugged visually in a browser. No native dependencies.
- **cairosvg** converts SVG to PDF/PNG with high fidelity. Depends on Cairo
  (available via cairocffi on Windows/Mac/Linux).
- **reportlab** handles the parts SVG can't: multi-page PDF documents, title
  block text with precise font metrics, page numbering, PDF metadata.

### Pipeline Flow

```
Layout object (from src/generation/)
  → src/rendering/plan_sheet.py
    → svgwrite: build SVG of road + devices + dimensions
    → cairosvg: render SVG → PDF page content
    → reportlab: compose title block + plan content → final multi-page PDF
  → output: plan_sheet.pdf
```

---

## Coordinate System

All rendering uses a **feet-based coordinate system** that maps directly to
the physical layout:

| Axis | Direction | Origin |
|------|-----------|--------|
| X | Along road (upstream → downstream) | Start of advance warning area |
| Y | Across road (left → right facing downstream) | Left edge of roadway |

### Scale

- Default: **1 inch = 40 feet** (matching CDOT S-630-1 typical scale)
- Sheet size: Arch D (24" × 36") → covers 960 ft × 1,440 ft
- For longer work zones: auto-scale or multi-sheet with overlap
- PDF output at 300 DPI for print quality

### Coordinate Transform

```python
def feet_to_svg(x_ft: float, y_ft: float, scale: float = 40.0, dpi: float = 72.0) -> tuple:
    """Convert feet coordinates to SVG points."""
    inches_per_foot = 1.0 / scale
    points_per_inch = dpi  # SVG default is 72 points/inch (CSS px)
    x_svg = x_ft * inches_per_foot * points_per_inch
    y_svg = y_ft * inches_per_foot * points_per_inch
    return (x_svg, y_svg)
```

---

## Layer Ordering (Back to Front)

1. **Aerial embed** (optional) — Mapbox Static API image, clipped to road area
2. **Road surface** — Gray fill for pavement area
3. **Lane markings** — White/yellow dashed and solid lines
4. **Shoulders** — Lighter fill outside travel lanes
5. **Work zone hatching** — Diagonal line fill for work area
6. **Buffer zone** — Light hatching or dashed outline
7. **Taper lines** — Dashed lines showing taper geometry
8. **Devices** — Sprites placed at computed positions
9. **Dimension lines** — Spacing dimensions, taper lengths, buffer distances
10. **Labels** — Sign text (MUTCD codes), zone labels, direction arrows
11. **Title block** — Sheet border, project info, legend, scale bar

---

## Device Sprites

Sprites are PNG images stored in `assets/sprites/`, one per device class from
the 15-class taxonomy. Source: cropped from the 1,038 labeled WSDOT TCP
bounding boxes.

### Sprite Requirements

| Property | Value |
|----------|-------|
| Format | PNG with transparency |
| Resolution | 300 DPI source, scaled at render time |
| Orientation | Plan-view (top-down), north-up default |
| Naming | `{class_name_lower}.png` (e.g., `cone.png`, `drum.png`) |

### Sprite Placement

Sprites are positioned at their computed (x, y) coordinates from the layout
engine. Rotation is applied for angled placements (e.g., devices along a
curved taper). Scale is uniform within a sheet.

---

## Optional Aerial Embed

When `MAPBOX_TOKEN` is set, `src/rendering/plan_sheet.py` can fetch a Mapbox
Static API satellite image as a background layer.

### API Call

```
GET https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/
    {lon},{lat},{zoom},{bearing},{pitch}/
    {width}x{height}@2x
    ?access_token={MAPBOX_TOKEN}
```

### Constraints

- Free tier: 100,000 requests/month (sufficient for V1)
- Image size: max 1280×1280 px (standard), 2560×2560 px (@2x)
- The aerial image is a visual aid only — device placement is on the
  schematic geometry, not georeferenced to the aerial

### When to Use

- User provides a lat/lon or address for the work zone
- Aerial helps the TCS visualize terrain, intersections, and landmarks
- Optional — plan is fully functional without it

---

## Title Block

The title block follows CDOT plan sheet conventions:

| Element | Position | Content |
|---------|----------|---------|
| Sheet border | Full page | Standard CDOT border line |
| Project info | Bottom-right | Project name, route, location |
| Case reference | Bottom-right | "S-630-1 Case {N}" |
| Scale bar | Bottom-center | Graphical scale + text "1" = 40'" |
| North arrow | Top-right corner | Standard north arrow symbol |
| Legend | Bottom-left or right | Device symbols with labels |
| Date | Bottom-right | Generation date |
| Page number | Bottom-right | "Sheet {N} of {M}" |

### Font

- Primary: Helvetica (available in reportlab without additional fonts)
- Title text: 14 pt bold
- Label text: 8–10 pt regular
- Dimension text: 7 pt

---

## CDOT S-630-1 Style Constants

Defined in `src/rendering/styles.py`:

| Element | Style |
|---------|-------|
| Road surface | Fill: #D0D0D0 (light gray) |
| Lane lines (white dashed) | Stroke: white, 2 pt, dash: 10-30 |
| Lane lines (yellow solid) | Stroke: #FFD700, 2 pt, solid |
| Edge line | Stroke: white, 2 pt, solid |
| Work zone hatching | Stroke: #FF6B00 (orange), 1 pt, 45° diagonal, 12 pt spacing |
| Buffer zone | Stroke: #FF6B00, 1 pt, dashed outline |
| Taper line | Stroke: black, 1.5 pt, dashed |
| Dimension line | Stroke: black, 0.5 pt, with arrowheads |
| Dimension text | 7 pt Helvetica, black |
