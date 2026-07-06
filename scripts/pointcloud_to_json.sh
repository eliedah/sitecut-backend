#!/usr/bin/env bash
# Convert a LAZ clip to compact JSON in LOCAL metres relative to the bbox SW corner.
# Output: { "n":N, "xyz":[e,u,nth,...], "rgb":[r,g,b,...]|null, "hasRGB":bool }
# Usage: pointcloud_to_json.sh IN.laz S W OUT.json
set -euo pipefail
IN=$1 S=$2 W=$3 OUT=$4
TXT=$(mktemp --suffix=.txt)
# reproject to WGS84 and dump X(lon) Y(lat) Z RGB via PDAL → text
pdal translate "$IN" "$TXT" --writers.text.format=csv \
  --writers.text.order="X,Y,Z,Red,Green,Blue" --writers.text.keep_unspecified=false \
  --filters.reprojection.out_srs="EPSG:4326" -f filters.reprojection 2>/dev/null || \
pdal translate "$IN" "$TXT" --writers.text.format=csv --writers.text.order="X,Y,Z,Red,Green,Blue"

python3 - "$TXT" "$S" "$W" "$OUT" <<'PY'
import sys, json, math
txt, S, W, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
R=6378137.0
lat0=math.radians(S); mPerLon=math.radians(1)*R*math.cos(lat0); mPerLat=math.radians(1)*R
xyz=[]; rgb=[]; hasRGB=False; n=0
with open(txt) as f:
    header=f.readline()
    for line in f:
        p=line.strip().split(',')
        if len(p)<3: continue
        try:
            lon=float(p[0]); lat=float(p[1]); z=float(p[2])
        except: continue
        e=(lon-W)*mPerLon; nth=(lat-S)*mPerLat
        xyz += [round(e,2), round(z,2), round(-nth,2)]   # x=east, y=up, z=-north (Three.js)
        if len(p)>=6 and p[3] and p[4] and p[5]:
            r=int(float(p[3])); g=int(float(p[4])); b=int(float(p[5]))
            if r>255 or g>255 or b>255:  # 16-bit → 8-bit
                r>>=8; g>>=8; b>>=8
            rgb += [r,g,b]; hasRGB=True
        n+=1
json.dump({"n":n,"xyz":xyz,"rgb":rgb if hasRGB else None,"hasRGB":hasRGB}, open(out,'w'))
PY
rm -f "$TXT"
