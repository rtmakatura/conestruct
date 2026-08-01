"""185f — screen/file cent agreement: the XLSX captured by re-issuing the
page's own quote POST (identical body) must carry the same TOTAL ESTIMATE
the re-previewed screen showed, to the cent."""
import openpyxl, re, sys

screen = open("screen-total.txt").read().strip()          # e.g. "$272.64"
screen_val = float(screen.replace("$", "").replace(",", ""))
wb = openpyxl.load_workbook("quote-after-edit.xlsx", data_only=True)
ws = wb.active
total = None
for row in ws.iter_rows():
    for c in row:
        if isinstance(c.value, str) and "TOTAL ESTIMATE" in c.value.upper():
            nums = [x.value for x in row if isinstance(x.value, (int, float))]
            total = nums[-1] if nums else None
print(f"screen 2dp total: {screen} ({screen_val:.2f})")
print(f"XLSX TOTAL ESTIMATE cell: {total}")
ok = total is not None and abs(total - screen_val) < 0.005
print("185f " + ("PASS — screen and XLSX agree to the cent" if ok else "FAIL — disagreement"))
sys.exit(0 if ok else 1)
