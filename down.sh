#!/bin/sh
# Stop everything started by up.sh.
if [ -f /tmp/tower.pids ]; then
  while read -r pid; do kill "$pid" 2>/dev/null || true; done < /tmp/tower.pids
  rm -f /tmp/tower.pids
fi
for p in 8787 8788 8789 8790 8791; do
  pid=$(lsof -ti "tcp:$p" 2>/dev/null || true)
  [ -n "$pid" ] && kill $pid 2>/dev/null || true
done
exit 0
