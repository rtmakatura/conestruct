# #378 red proof

Branch tests run against the base code (`git archive` of `225b44c`, with the two updated test files copied in):

```
FAILED tests/test_divided_near_intersection.py::test_the_wire_s_own_divided_true_is_still_refused
FAILED tests/test_intersection_schema.py::test_divided_mainline_rejects
2 failed, 41 passed
```

`test_the_refusal_s_advice_builds_the_divided_plan` passes on base too, as expected: #312's carriageway path already existed. The test pins that the refusal's advice is true.

On the branch: `43 passed`.
