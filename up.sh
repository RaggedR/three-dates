#!/bin/sh
# up.sh — five servers in the background. Their traces go to /tmp/tower-<name>.log;
# use ./demo.sh instead if you want the whole trace on one terminal.
set -e
cd "$(dirname "$0")"
./down.sh >/dev/null 2>&1 || true
./wait-ports.sh free
for s in bankfeed ledger invoices matcher books; do
  deno run --quiet --allow-net --allow-run --allow-read --allow-env \
    "$s.server.ts" > "/tmp/tower-$s.log" 2>&1 &
  echo "$!" >> /tmp/tower.pids
done
./wait-ports.sh up
echo "up: books :8787  bankfeed :8788  ledger :8789  invoices :8790  matcher :8791"
