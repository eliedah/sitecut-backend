#!/usr/bin/env bash
# Warm the cache for frequently-requested areas so first-hit latency is low.
# Add one line per hot bbox. Run nightly via cron.
set -euo pipefail
BASE="${1:-http://localhost:8080}"

warm () {  # s w n e
  local s=$1 w=$2 n=$3 e=$4
  curl -s "$BASE/api/buildings?s=$s&w=$w&n=$n&e=$e" >/dev/null || true
  curl -s "$BASE/api/terrain?s=$s&w=$w&n=$n&e=$e"   >/dev/null || true
}

# examples — replace with your areas
warm 51.90 4.46 51.93 4.50     # Rotterdam
warm 37.55 126.97 37.58 127.01 # Seoul
echo "prebake done"
