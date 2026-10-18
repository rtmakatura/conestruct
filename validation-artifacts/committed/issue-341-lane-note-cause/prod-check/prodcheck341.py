import io, json, os, sys, urllib.request
import pypdfium2 as pdfium
root = sys.argv[1]; out = sys.argv[2]
os.makedirs(out, exist_ok=True)
tok = next(l.split("=",1)[1].strip().strip('"') for l in open(os.path.join(root,"conestruct/site/.env.local"),encoding="utf-8") if l.startswith("GATE_BYPASS_TOKEN="))
base = "https://www.conestruct.com/api/render/"
def post(kind, body):
    req = urllib.request.Request(base+kind, data=json.dumps(body).encode(), method="POST",
        headers={"content-type":"application/json","x-conestruct-gate":tok})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.status, r.read()
lines=[]
for row in ("i25-r-65-night-3lanes","alameda-r-35"):
    body = json.load(open(os.path.join(root,"validation-artifacts/committed/audit-shoulder/runs",row,"request.json"),encoding="utf-8"))
    st,a = post("audit", body)
    items = {i["kind"]:i for i in (json.loads(a)["pending_verification"].get("items") or [])}
    label = items.get("lanes_drawn_below_road",{}).get("label")
    st2,pdf = post("pdf", body)
    text = " ".join(pdfium.PdfDocument(io.BytesIO(pdf))[0].get_textpage().get_text_range().split())
    i = text.find("DRAWN AS")
    note = text[i:i+170] if i>=0 else None
    lines.append(f"{row}\n  audit {st} label: {label}\n  pdf {st2} page 1: {note}")
open(os.path.join(out,"replay.txt"),"w",encoding="utf-8").write("\n".join(lines)+"\n")
print("\n".join(lines))
