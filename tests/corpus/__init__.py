"""MUTCD validation corpus for the V1 shoulder-closure path.

A systematic set of scenarios pinned at the ``/render/audit`` HTTP endpoint
so any future change that alters a computed value fails a test.

Two provenance tiers, kept structurally distinct (see ``manifest`` and
``test_manifest_integrity``):

* ``spec-verified`` anchors — hand-authored ground-truth values, asserted by
  equality. Cannot be satisfied by a snapshot.
* ``current-behavior`` snapshots — lock today's output so it can't silently
  regress; explicitly NOT spec-verified.

No corpus test touches the live network (see ``conftest._no_network``).
"""
