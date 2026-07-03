#!/usr/bin/env bash
# Clip + resample a (remote) Cloud-Optimized GeoTIFF to an NX x NY elevation grid (JSON).
# Usage: dem_grid.sh S W N E NX NY SRC OUT   (SRC = /vsicurl/https://host/dtm.tif)
set -euo pipefail
S=$1 W=$2 N=$3 E=$4 NX=$5 NY=$6 SRC=$7 OUT=$8
TMP=$(mktemp --suffix=.tif)
gdalwarp -q -overwrite -t_srs EPSG:4326 -te "$W" "$S" "$E" "$N" -ts "$NX" "$NY" -r bilinear "$SRC" "$TMP"
python3 - "$TMP" "$OUT" "$NX" "$NY" <<'PY'
import sys, json
from osgeo import gdal
tif, out, NX, NY = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
band = gdal.Open(tif).GetRasterBand(1)
arr = band.ReadAsArray()                      # shape (NY, NX), row 0 = north
grid = [[float(v) for v in row] for row in arr][::-1]   # flip to south→north
json.dump({"NX": NX, "NY": NY, "grid": grid}, open(out, "w"))
PY
rm -f "$TMP"
