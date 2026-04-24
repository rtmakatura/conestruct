# src/rendering

Layout-to-PDF plan sheet renderer. Uses svgwrite to draw the schematic road
geometry and device placements as SVG, cairosvg to rasterize SVG to PDF/PNG,
and reportlab for title block assembly and multi-page PDF output in CDOT
S-630-1 typical style. Optionally embeds a Mapbox Static API aerial image
when a MAPBOX_TOKEN environment variable is set.
