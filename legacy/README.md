# Legacy: Symbol Detection Era

**Archived:** 2026-04-24
**Pre-pivot state:** No commits existed yet (repo was untracked working tree).

This directory contains code from the original product scope: a YOLO-based
symbol detection tool that identified traffic control devices (cones, drums,
barricades, signs) on DOT plan PDF sheets.

The project pivoted on 2026-04-24 to an MHT/MOT generation tool that
produces traffic control plan packages from user-described work zone
scenarios. See `PIVOT_PLAN.md` in the repo root for the full migration plan.

## What's here

```
legacy/
  src/
    detection/       # YOLOv11 training pipeline (tiling, training, evaluation)
    scraping/        # TxDOT FTP plan PDF scraper
    pdf_processing/  # TCP sheet isolation from plan PDFs (PyMuPDF)
    labeling/        # Label Studio import, export, audit, migration scripts
    api/             # Gradio detection demo app
    evaluation/      # Evaluation module placeholder
  scripts/           # HuggingFace Spaces deployment script
  notebooks/         # Kaggle training notebook
  configs/           # Label Studio labeling interface XML config
```

## What's preserved elsewhere

- **203 labeled WSDOT TCP PNGs** remain in `data/processed/wsdot_typicals/`
  (repurposed as a sprite library source for the generation product).
- **1,038 labeled bounding boxes** remain in the local Label Studio database
  (will be exported as device sprite crops).
- **15-class taxonomy** carries forward as the device vocabulary in
  `src/rules/devices.py`.

## Why archive, not delete

This code may be useful for:
1. Extracting device sprites from the labeled WSDOT data
2. Resuming the detection product if market feedback warrants it
3. Reference implementations for PDF rendering and processing patterns
