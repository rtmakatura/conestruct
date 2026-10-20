import io, os, sys
os.environ["RENDER_API_SECRET"]="s"; os.environ["MAPBOX_TOKEN"]=""
from fastapi.testclient import TestClient
import pypdfium2 as pdfium
from src.rules import site_detection as sd
sd._overpass_request_with_fallback=lambda *a,**k:({"elements":[]},None)
from src.api.render_api import app
c=TestClient(app)
body={"kind":"shoulder","meta":{"project":"T","address":"","lat":0.0,"lng":0.0},"roadType":"freeway","speed":65,"lanes":3,"laneWidth":11.0,"divided":True,"workType":"utility_locate","duration":"short","workLen":1500.0,"night":True,"roadLanesPerDirection":4}
r=c.post("/render/pdf",headers={"Authorization":"Bearer s"},json=body); assert r.status_code==200,r.text[:300]
pg=pdfium.PdfDocument(io.BytesIO(r.content))[0]
pg.render(scale=2).to_pil().save(sys.argv[1])
