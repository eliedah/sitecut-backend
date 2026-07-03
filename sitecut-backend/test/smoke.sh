#!/usr/bin/env bash
# Quick check that every endpoint responds. Start the server first: npm start
set -euo pipefail
BASE="${1:-http://localhost:8080}"
# small bbox in Rotterdam
S=51.915 W=4.470 N=51.920 E=4.478
LAT=51.917 LON=4.474

echo "health:";   curl -s "$BASE/health"; echo
echo "sources:";  curl -s "$BASE/api/sources?lat=$LAT&lon=$LON" | head -c 300; echo
echo "terrain:";  curl -s "$BASE/api/terrain?s=$S&w=$W&n=$N&e=$E" | head -c 200; echo
echo "buildings:";curl -s "$BASE/api/buildings?s=$S&w=$W&n=$N&e=$E" | head -c 200; echo
echo "climate:";  curl -s "$BASE/api/climate?lat=$LAT&lon=$LON"; echo
echo "kpi:";      curl -s "$BASE/api/kpi?s=$S&w=$W&n=$N&e=$E"; echo
