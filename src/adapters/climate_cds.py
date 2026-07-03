#!/usr/bin/env python3
"""ERA5-Land baseline + CMIP6 ssp245 (2050) point climate. Needs ~/.cdsapirc, cdsapi, xarray.
Called by climate.js when ENABLE_CDS=1. Prints the common climate JSON to stdout."""
import sys, json

def main(lat, lon):
    import cdsapi, xarray as xr
    c = cdsapi.Client()
    area = [lat + 0.25, lon - 0.25, lat - 0.25, lon + 0.25]  # N,W,S,E

    c.retrieve('reanalysis-era5-land-monthly-means', {
        'product_type': 'monthly_averaged_reanalysis',
        'variable': ['2m_temperature', 'total_precipitation'],
        'year': [str(y) for y in range(2001, 2011)],
        'month': [f'{m:02d}' for m in range(1, 13)],
        'time': '00:00', 'area': area, 'format': 'netcdf'
    }, '/tmp/base.nc')

    c.retrieve('projections-cmip6', {
        'temporal_resolution': 'monthly', 'experiment': 'ssp2_4_5',
        'variable': ['near_surface_air_temperature', 'precipitation'],
        'model': 'mpi_esm1_2_lr',
        'year': [str(y) for y in range(2041, 2051)],
        'month': [f'{m:02d}' for m in range(1, 13)],
        'area': area, 'format': 'netcdf'
    }, '/tmp/fut.nc')

    def pt(nc, var):
        d = xr.open_dataset(nc)
        v = d[var].sel(latitude=lat, longitude=lon, method='nearest')
        return float(v.mean())

    baseT = pt('/tmp/base.nc', 't2m') - 273.15
    futT = pt('/tmp/fut.nc', 'tas') - 273.15
    print(json.dumps({
        'source': 'ERA5-Land + CMIP6 ssp245',
        'baseline': {'meanT': round(baseT, 1)},
        'y2050': {'meanT': round(futT, 1)},
        'delta': {'T': round(futT - baseT, 1)}
    }))

if __name__ == '__main__':
    main(float(sys.argv[1]), float(sys.argv[2]))
