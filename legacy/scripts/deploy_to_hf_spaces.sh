#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Deploy to HuggingFace Spaces
# ============================================================
# Prerequisites:
#   1. pip install huggingface_hub  (or uv pip install huggingface_hub)
#   2. huggingface-cli login
#   3. Create a Space at https://huggingface.co/spaces
#   4. Set HF_SPACE below
#
# The Space must be configured as:
#   - SDK: Gradio
#   - Hardware: CPU Basic (free tier)
# ============================================================

# TODO: Set your HuggingFace Space name
HF_SPACE="YOUR_USERNAME/tcp-symbol-detector"  # <-- CHANGE THIS

MODEL_WEIGHTS="weights/best.pt"

# Verify model weights exist
if [ ! -f "$MODEL_WEIGHTS" ]; then
    echo "ERROR: Model weights not found at $MODEL_WEIGHTS"
    echo "Train a model first, then copy best.pt to weights/"
    exit 1
fi

# Verify HF CLI is available
if ! command -v huggingface-cli &> /dev/null; then
    echo "ERROR: huggingface-cli not found. Install with: pip install huggingface_hub"
    exit 1
fi

# Create a temporary staging directory with only what the Space needs
STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT

echo "Staging files for deployment..."

# Copy source code
cp -r src/ "$STAGING/src/"

# Copy model weights
mkdir -p "$STAGING/weights"
cp "$MODEL_WEIGHTS" "$STAGING/weights/best.pt"

# Copy configs
cp -r configs/ "$STAGING/configs/"

# Create app.py entry point (HF Spaces convention)
cat > "$STAGING/app.py" << 'PYEOF'
"""HuggingFace Spaces entry point."""
from src.api.demo_app import create_app

app = create_app(model_path="weights/best.pt")
app.launch()
PYEOF

# Create requirements.txt (HF Spaces uses pip, not uv)
cat > "$STAGING/requirements.txt" << 'REQEOF'
pymupdf>=1.25
pillow>=11.0
numpy>=2.0
ultralytics>=8.3
opencv-python-headless>=4.10
gradio>=5.0
REQEOF

echo "Uploading to HuggingFace Space: $HF_SPACE"
huggingface-cli upload "$HF_SPACE" "$STAGING" . --repo-type space

echo ""
echo "Deployed! View at: https://huggingface.co/spaces/$HF_SPACE"
