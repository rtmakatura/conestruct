# 223 probe — NI wire sections (TestClient at the arc tip; identical result first obtained at d8419d6 pre-arc)
status: 200
section keys: ['advance', 'approaches', 'buffer', 'case', 'colorado', 'corridor_spec', 'corridor_validation', 'flagger', 'geometry_validation', 'site_adjustments', 'spacing', 'taper']
taper: {'L_calc_text': 'L = 10.5 x 40^2 / 60 = 280 ft', 'formula_choice': 'Speed 40 mph < 45 mph threshold -> using L = W x S^2 / 60'}
buffer lookup: MUTCD Table 6B-2: 305 ft (CDOT supplement silent at this speed)
spacing: L = 280 ft / 40 ft max spacing -> 8 drums at 40.0 ft intervals
advance signs: 5
colorado checks: 4 all_pass: True
case: Case 18: Traffic control around a work area near an intersection, one lane close
summary: {'ta': 'TA-22', 'cdot_sheet': 'S-630-1', 'case_id': 'Case 18: Traffic control around a work area near an intersection, one lane closed', 'taper_length_ft': 280, 'buffer_space_ft': 305.0}
plan_flags: {'validation_warnings': 0, 'compliance_fails': 0, 'v1_limitations': 3, 'is_clean': False}

# mapping-grounding probe — Denver jurisdiction block statuses
deltas: [('Arrow board required if closing one or m', 'count', 'fires')]
personnel: [("TCP 'must be prepared by a certified Traffic ", 'fires', False), ('Signalized intersection affected (per the Cit', 'conditional', False)]
device: [('Steel plates: friction coefficient >=0.35, be', 'fires', False)]
hazard: [("TCP 'denied for accuracy or compliance with t", 'fires', True), ('Unauthorized sidewalk/street/alley closure, o', 'fires', True)]
hours_eval: unknown
