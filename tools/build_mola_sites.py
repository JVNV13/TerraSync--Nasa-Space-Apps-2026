"""Measured regional terrain for every Mars site, from the global MOLA MEGDR grid.

Source: MGS MOLA MEGDR megt90n000eb (global topography, 16 pixels/degree, ~3.7 km/pixel at the equator),
        https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/
Usage:  python tools/build_mola_sites.py <dir containing megt90n000eb.img/.lbl> [out.json]

Values are REGIONAL (a ~41 km window), not local terrain: slope baseline is ~7 km, so a steep crater wall
or a lander ellipse is far rougher than these numbers. MOLA cells include interpolated bins.
Elevation datum: MOLA areoid (IAU2000).
"""
import csv, json, math, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PPD = 16
R_KM = 3396.0
HALF = 5  # window half-size in cells -> 11 x 11 cells (~41 km at the equator)


def load(src):
    a = np.fromfile(Path(src) / 'megt90n000eb.img', dtype='>i2').reshape(2880, 5760).astype(np.float64)
    return a


def bilinear(a, lat, lon):
    lon %= 360.0
    x = lon * PPD - 0.5
    y = (90.0 - lat) * PPD - 0.5
    x0, y0 = math.floor(x), math.floor(y)
    fx, fy = x - x0, y - y0
    def px(yy, xx):
        return a[min(max(yy, 0), a.shape[0] - 1), xx % a.shape[1]]
    return (px(y0, x0) * (1 - fx) * (1 - fy) + px(y0, x0 + 1) * fx * (1 - fy)
            + px(y0 + 1, x0) * (1 - fx) * fy + px(y0 + 1, x0 + 1) * fx * fy)


def window_stats(a, lat, lon):
    lon %= 360.0
    r0 = min(max(int(round((90.0 - lat) * PPD)), HALF + 1), a.shape[0] - HALF - 2)
    c0 = int(round(lon * PPD))
    rows = np.arange(r0 - HALF - 1, r0 + HALF + 2)
    cols = np.arange(c0 - HALF - 1, c0 + HALF + 2) % a.shape[1]
    z = a[np.ix_(rows, cols)]
    lats = 90.0 - (rows + 0.5) / PPD
    dy = np.radians(1.0 / PPD) * R_KM * 1000.0
    dx = dy * np.cos(np.radians(lats))[:, None]
    dzdx = (z[1:-1, 2:] - z[1:-1, :-2]) / (2 * dx[1:-1])
    dzdy = (z[:-2, 1:-1] - z[2:, 1:-1]) / (2 * dy)
    slope = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))
    core = z[1:-1, 1:-1]
    return dict(
        slope_mean_deg=float(slope.mean()), slope_median_deg=float(np.median(slope)),
        slope_p95_deg=float(np.percentile(slope, 95)), slope_max_deg=float(slope.max()),
        relief_m=float(core.max() - core.min()), roughness_std_m=float(core.std()),
        window_km_ns=float((2 * HALF + 1) * dy / 1000.0), window_km_ew=float((2 * HALF + 1) * dx[HALF + 1, 0] / 1000.0),
    )


def main():
    src = sys.argv[1]
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'data' / 'mars_mola_sites.json'
    a = load(src)
    sites = []
    with (ROOT / 'data' / 'synthetic_sites.csv').open(encoding='utf-8') as fh:
        for r in csv.DictReader(fh):
            if r['planet'] != 'Mars':
                continue
            lat, lon = float(r['geographic.latitude']), float(r['geographic.longitude'])
            s = dict(id=r['id'], name=r['name'], latitude=lat, longitude_east=lon % 360.0,
                     elevation_m=round(float(bilinear(a, lat, lon)), 1))
            s.update({k: round(v, 3) for k, v in window_stats(a, lat, lon).items()})
            sites.append(s)
    doc = dict(
        source='MGS MOLA MEGDR megt90n000eb, 16 pixels/degree', unit_elevation='m above MOLA areoid (IAU2000)',
        caveat='Regional ~41 km window at ~3.7 km/pixel; slope baseline ~7 km. Not local terrain. Cells include interpolated bins.',
        generated_by='tools/build_mola_sites.py', sites=sites)
    out.write_text(json.dumps(doc, indent=1), encoding='utf-8')
    for s in sites:
        print(f"{s['id']:7} {s['name'][:42]:42} elev {s['elevation_m']:8.1f} m  slope {s['slope_mean_deg']:5.2f}/{s['slope_p95_deg']:5.2f} deg  relief {s['relief_m']:7.0f} m")


if __name__ == '__main__':
    main()
