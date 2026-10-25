#!/bin/bash
# usage: run.sh d|m  < code
D=/c/Users/rtmak/AppData/Local/Temp/claude/C--Users-rtmak-Documents-traffic-control-tool/77c62d3c-25b3-4480-b4da-bc9ca554bc5f/scratchpad/wt/cmd/$1
rm -f $D/done $D/out.txt
cat > $D/in.tmp && mv $D/in.tmp $D/in.js
for i in $(seq 1 900); do [ -f $D/done ] && break; sleep 0.2; done
cat $D/out.txt
