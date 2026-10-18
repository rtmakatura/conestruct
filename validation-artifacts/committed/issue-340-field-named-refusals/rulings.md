# #340 rulings — a schema refusal names its field

Issue: https://github.com/rtmakatura/conestruct/issues/340. One arc, no checkpoint stop: the ruling below is the issue's proposed solution and fits existing rules (R145).

## S1 — R145 self-ruled: the proxy's 422 relay puts the field name in front of pydantic's built-in messages
`validationPassthrough` (`conestruct/site/lib/render-proxy.ts`) keeps each 422 entry's `loc` long enough to name the field: the message becomes `<field>: <msg>`, e.g. `speed: Input should be less than or equal to 75`.
- **The field name is the last string in `loc`.** The backend's shape, captured through TestClient on this branch: `["body", "shoulder", "speed"]` (speed 80, speed 15, speed 62), `["body", "shoulder", "lanes"]` (5 lanes). The middle element is the discriminated union's tag, not a field; the last string is the field the operator sent. A loc whose last string is `body` (e.g. `union_tag_not_found`) gets no prefix.
- **Only pydantic's built-in messages get the prefix.** An entry of `type: "value_error"` is a sentence one of our validators wrote (the drawable-width check, loc `["body", "shoulder"]`); it already says what is wrong and stays byte-identical. This is the issue's "other refusals are unchanged".
- **Pydantic's wording is kept.** The issue's "speed: must be 75 mph or less" was an example; rewriting each constraint type into new words with units would be new copy for an API-only message (the form's controls keep operators inside the ranges). Naming the field is the defect (P3).
- **Every built-in type gets the prefix, not just the three bounds.** The wrong-enum case (`literal_error` on `workType`, `duration`) had the same defect and now reads `workType: Input should be ...`. Stated as a deliberate behaviour change (Rule 5).

Rules: 5, 10 (the message no longer drops what the backend said), 11 (tested at the proxy layer on the captured shapes).
