# #337 rulings — the crew sheet's Note 8 line on divided shoulder plans

Governing ruling: **#243 R54**. Under CDOT S-630-1 Sheet 2 General Note 8's exception ("except where only one shoulder is closed (ex: Case 11 on Sheet 7)"), a shoulder closure isn't required to sign both sides. The divided shoulder generator mirrors anyway, as a house choice, CHOSEN (`src/generation/layout.py:287-293`). The audit's Note 8 row already reads "Not required: one shoulder closed (Note 8's Case 11 exception)" (`src/api/audit.py:1060-1084`).

## S1 (R145 self-ruled): split the Safety Notes line by closure type
- `is_divided` and `closure_type == "shoulder"`: "Divided highway: this plan posts signs on both sides of the roadway by choice. CDOT S-630-1 Sheet 2 General Note 8 doesn't require it when only one shoulder is closed (Case 11 on Sheet 7)."
- `is_divided` (a lane closure): the existing line, unchanged.
- Fits R54 and the issue's proposed solution. It adds no new number or fact: the Note 8 text and the Case 11 / Sheet 7 pointer are the ones the audit already cites.

## S2 (R145 self-ruled): the divided work-beyond-shoulder mirror is out of scope
`generate_work_beyond_shoulder` places no mirror signs on a divided road (`layout.py:2396`), yet the crew steps' `{% if is_divided %}` clauses ("Place matching sign on left side") still say it does. That kind is gated. This is a separate defect, filed as #343 rather than widening #337. With the S1 split, its Safety Notes line now reads "by choice". That is no more wrong than before, and #343 fixes both.
