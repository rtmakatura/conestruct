#!/usr/bin/env bash
# Vercel "Ignored Build Step" (conestruct/site/vercel.json ignoreCommand).
# Exit 0 = SKIP the build.  Any other exit = BUILD.
#
# ship-loop rulings R1 (validation-artifacts/committed/ship-loop/rulings.md):
# compare $VERCEL_GIT_PREVIOUS_SHA..$VERCEL_GIT_COMMIT_SHA over the site and
# the outside paths its tests read; any error builds; an empty or missing
# PREVIOUS_SHA (a branch's first deploy, a redeploy) builds.
#
# The range, not HEAD^..HEAD: ship.ps1 fast-forwards a whole branch and
# Vercel builds only the pushed tip, so the tip's own diff can miss a site
# change earlier in the push (the #301 zoom ship: a7225ff changed the site,
# its tip 0ddc85e did not).
#
# SITE_INPUTS is the one list.  ship.ps1's served-sha step reads it from
# this file, and tests/build-inputs.test.ts fails when the site or its
# tests read a path outside the site dir that is not on it (R2).

# SITE_INPUTS: relative to conestruct/site
SITE_INPUTS=(
  "."
  "../../tests/fixtures/tiering"
  "../../tests/fixtures/centerline"
  "../../scripts/gate.cjs"
  "../../scripts/modal-healthz-probe.mjs"
)
# END SITE_INPUTS

cd "$(dirname "$0")" || { echo "BUILD: cannot enter the site dir"; exit 1; }

prev="${VERCEL_GIT_PREVIOUS_SHA:-}"
cur="${VERCEL_GIT_COMMIT_SHA:-}"

if [ -z "$prev" ] || [ -z "$cur" ]; then
  echo "BUILD: no previous deployed sha to compare (a branch's first deploy, or unset)"
  exit 1
fi
if [ "$prev" = "$cur" ]; then
  echo "BUILD: previous sha equals this sha ($cur): a redeploy"
  exit 1
fi

git diff --quiet "$prev" "$cur" -- "${SITE_INPUTS[@]}"
rc=$?
if [ "$rc" -eq 0 ]; then
  echo "SKIP: no change to the site or its inputs in ${prev:0:7}..${cur:0:7}"
  exit 0
fi
if [ "$rc" -eq 1 ]; then
  echo "BUILD: the site or its inputs changed in ${prev:0:7}..${cur:0:7}"
else
  echo "BUILD: git diff failed (exit $rc) comparing ${prev:0:7}..${cur:0:7}; building to be safe"
fi
exit 1
