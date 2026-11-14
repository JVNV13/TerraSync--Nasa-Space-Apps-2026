"""Measured climate for every Earth site, from NASA POWER (no login needed).

Source: NASA POWER climatology API v2.10 (MERRA-2 / CERES based, long-term mean)
        https://power.larc.nasa.gov/api/temporal/climatology/point
Usage:  python tools/build_earth_climate.py [out.json]

Grid resolution is ~0.5 deg (~50 km): values describe the surrounding region, not the exact spot.
"""
import csv, json, sys, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PARAMS = 'T2M,T2M_MAX,T2M_MIN,PS,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN'
URL = ('https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=' + PARAMS +
       '&community=RE&longitude={lon}&latitude={lat}&format=JSON')


def fetch(lat, lon, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(URL.format(lat=lat, lon=lon), timeout=90) as r:
                return json.load(r)
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(3 * (i + 1))


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'data' / 'earth_climate_nasa_power.json'
    sites, units = [], None
    with (ROOT / 'data' / 'synthetic_sites.csv').open(encoding='utf-8') as fh:
        for r in csv.DictReader(fh):
            if r['planet'] != 'Earth':
                continue
            lat, lon = float(r['geographic.latitude']), float(r['geographic.longitude'])
            d = fetch(lat, lon)
            p = d['properties']['parameter']
            units = units or {k: v['units'] for k, v in d['parameters'].items()}
            sites.append(dict(id=r['id'], name=r['name'], latitude=lat, longitude=lon,
                              annual_mean={k: v['ANN'] for k, v in p.items()}))
            print(r['id'], r['name'][:40], sites[-1]['annual_mean'])
    out.write_text(json.dumps(dict(
        source='NASA POWER climatology v2.10 (long-term annual mean)', units=units,
        caveat='~0.5 deg grid (~50 km): regional climate, not the exact spot.',
        generated_by='tools/build_earth_climate.py', sites=sites), indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
