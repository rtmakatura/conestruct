import pypdfium2 as pdfium
from src.generation.layout import generate_shoulder_closure_divided
from src.rendering.plan_sheet import render_plan_sheet
from src.rules.validators import ScenarioParams
import sys
p=ScenarioParams(speed_mph=65,num_lanes=2,closure_type="shoulder",road_type="freeway",work_zone_length_ft=1000.0,is_divided=True,work_zone_speed_mph=60)
out=sys.argv[1]
render_plan_sheet(generate_shoulder_closure_divided(p),p,output_path=out)
d=pdfium.PdfDocument(out); tp=d[0].get_textpage(); t=" ".join(tp.get_text_range(0,tp.count_chars()).split()); d.close()
i=t.find("ADVANCE WARNING"); print(t[i:i+1300])
