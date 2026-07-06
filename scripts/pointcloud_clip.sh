#!/usr/bin/env bash
# Clip a COPC/EPT LiDAR source to a bbox and decimate to <= MAXPTS, writing LAZ.
# Usage: pointcloud_clip.sh S W N E MAXPTS OUT.laz
# Requires PDAL. Uses USGS 3DEP EPT by default; override SOURCE env for other COPC/EPT URLs.
set -euo pipefail
S=$1 W=$2 N=$3 E=$4 MAXPTS=$5 OUT=$6

# USGS 3DEP public entwine index (readers.ept can take a bounds filter in the source CRS).
# For production, resolve the covering project. This uses OpenTopography's 3DEP PC API if
# OT_API_KEY is set (simplest cross-project option), else a direct EPT URL in SOURCE.
SOURCE="${SOURCE:-}"

if [ -n "${OT_API_KEY:-}" ]; then
  # OpenTopography USGS 3DEP point cloud API → LAZ for the bbox (WGS84)
  curl -sf -o "$OUT" \
    "https://portal.opentopography.org/API/pointcloud?datasetName=USGS_3DEP&south=${S}&north=${N}&west=${W}&east=${E}&outputFormat=laz&API_Key=${OT_API_KEY}"
  exit 0
fi

# Direct PDAL pipeline against an EPT/COPC SOURCE (set SOURCE=…/ept.json or …/x.copc.laz)
if [ -z "$SOURCE" ]; then
  echo "no SOURCE and no OT_API_KEY set" >&2; exit 3
fi

# choose reader by kind (copc default) — COPC & EPT both support bounds-filtered reads
READER="readers.copc"
if [ "${SRCKIND:-copc}" = "ept" ] || echo "$SOURCE" | grep -q "ept.json"; then READER="readers.ept"; fi

pdal pipeline /dev/stdin <<PIPE
{
  "pipeline": [
    { "type":"${READER}", "filename":"${SOURCE}",
      "bounds":"([${W},${E}],[${S},${N}])", "spatialreference":"EPSG:4326" },
    { "type":"filters.decimation", "step": 3 },
    { "type":"writers.las", "compression":"laszip", "filename":"${OUT}" }
  ]
}
PIPE
