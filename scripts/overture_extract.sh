#!/usr/bin/env bash
# Extract Overture features in a bbox to JSON rows (id, height, levels, geom=GeoJSON string).
# Usage: overture_extract.sh S W N E THEME TYPE OUT
set -euo pipefail
S=$1 W=$2 N=$3 E=$4 THEME=$5 TYPE=$6 OUT=$7
REL="${OVERTURE_RELEASE:-2025-01-22.0}"
duckdb -c "
INSTALL spatial; INSTALL httpfs; LOAD spatial; LOAD httpfs;
SET s3_region='us-west-2';
COPY (
  SELECT id,
         TRY_CAST(height AS DOUBLE)     AS height,
         TRY_CAST(num_floors AS INTEGER) AS levels,
         ST_AsGeoJSON(ST_GeomFromWKB(geometry)) AS geom
  FROM read_parquet('s3://overturemaps-us-west-2/release/${REL}/theme=${THEME}/type=${TYPE}/*', hive_partitioning=1)
  WHERE bbox.xmin BETWEEN ${W} AND ${E}
    AND bbox.ymin BETWEEN ${S} AND ${N}
) TO '${OUT}' (FORMAT JSON, ARRAY true);
"
