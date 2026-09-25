#!/bin/sh
# Baseline then anchor-shifted run of the full Python suite.
cd /c/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-289-kind-and-field || exit 1
PY=/c/Users/rtmak/Documents/traffic-control-tool/.venv/Scripts/python.exe
OUT=/c/Users/rtmak/.claude/jobs/cf0a8ecb/tmp/agentB
export PYTHONPATH="C:/Users/rtmak/.claude/jobs/cf0a8ecb/tmp/agentB/plug;."
ANCHOR_SHIFT=0 $PY -m pytest -q -p no:cacheprovider -p anchor_shift_probe -rf > "$OUT/base.txt" 2>&1
ANCHOR_SHIFT=1 $PY -m pytest -q -p no:cacheprovider -p anchor_shift_probe -rf > "$OUT/shift.txt" 2>&1
echo done
