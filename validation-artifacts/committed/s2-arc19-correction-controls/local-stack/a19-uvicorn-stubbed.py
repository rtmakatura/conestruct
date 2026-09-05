"""s2-arc19 local run — uvicorn with the Overpass mirror list pointed at
the local stand-in (a19-overpass-mock.py on 8766).  Everything else is
the working tree's real backend."""
import sys

sys.path.insert(0, sys.argv[1])
import src.rules.site_detection as sd  # noqa: E402

sd.OVERPASS_MIRRORS = ("http://127.0.0.1:8766/api/interpreter",)
import uvicorn  # noqa: E402

uvicorn.run("src.api.render_api:app", host="127.0.0.1", port=8765, log_level="info")
