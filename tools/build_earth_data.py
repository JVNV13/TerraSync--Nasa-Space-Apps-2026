#!/usr/bin/env python3
"""Connect the processed Earth land-cover data (ESA WorldCover 2021 v200) to the website.

Reads   ESA_WorldCover_Processed/reports/*.csv          class areas and tile statistics
        ESA_WorldCover_Processed/metadata/scan_cache/    1500 x 1500 class previews per tile
                                                         (every 24th native pixel, ~220 m)
Writes  data/earth_landcover.json   one land-cover map + class breakdown per tile, and
                                    measured land-cover values for catalogue sites that
                                    fall inside a tile

Nothing is invented: class areas come from the exact native-resolution scan in the reports;
the maps and the site windows are read from the preview grids the notebook saved.

Run:  python tools/build_earth_data.py        (needs numpy)
"""
import base64, csv, json, math, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
EW = ROOT / 'ESA_WorldCover_Processed'
OUT = ROOT / 'data' / 'earth_landcover.json'

# Official WorldCover legend and colours (ESA Product User Manual v2).
CLASSES = [
    (10, 'Tree cover', '#006400'), (20, 'Shrubland', '#ffbb22'), (30, 'Grassland', '#ffff4c'),
    (40, 'Cropland', '#f096ff'), (50, 'Built-up', '#fa0000'), (60, 'Bare / sparse vegetation', '#b4b4b4'),
    (70, 'Snow and ice', '#f0f0f0'), (80, 'Permanent water bodies', '#0064c8'), (90, 'Herbaceous wetland', '#0096a0'),
    (95, 'Mangroves', '#00cf75'), (100, 'Moss and lichen', '#fae6a0'),
]
CODES = [c for c, _, _ in CLASSES]
VEG = {10, 20, 30, 40, 90, 95, 100}

# Plain-language identity of each 3 x 3 degree tile (bounds from the GeoTIFF georeferencing).
TILES = {
    'N27W015': dict(name='Canary Islands & Saharan coast', place='Lanzarote, Fuerteventura and the Moroccan coast', bounds=[-15, 27, -12, 30]),
    'N36W117': dict(name='Death Valley & Mojave Desert', place='Eastern California and southern Nevada, USA', bounds=[-117, 36, -114, 39]),
    'S24W069': dict(name='Atacama Desert', place='Salar de Atacama and the Andes, Chile', bounds=[-69, -24, -66, -21]),
}
SITE_RADIUS_KM = 5.0
DOWN = 4  # 1500 -> 375 cells per side for the web map

problems = []
def check(ok, msg):
    if not ok: problems.append(msg)

def b64(a):
    return base64.b64encode(np.ascontiguousarray(a, dtype=np.uint8).tobytes()).decode('ascii')

def read_csv(name):
    with open(EW / 'reports' / name, encoding='utf-8') as f:
        return list(csv.DictReader(f))

def block_mode(idx, k):
    """Most common class index in each k x k block (index 0 = no data)."""
    h, w = idx.shape
    b = idx[: h - h % k, : w - w % k].reshape(h // k, k, w // k, k).transpose(0, 2, 1, 3).reshape(h // k, w // k, k * k)
    counts = np.stack([(b == i).sum(-1) for i in range(len(CODES) + 1)], -1)
    counts[..., 0] = counts[..., 0] * 0.999  # prefer a class over no-data on ties
    return counts.argmax(-1).astype(np.uint8)

def main():
    classes = read_csv('class_comparison.csv')
    tiles = {r['tile']: r for r in read_csv('per_tile_statistics.csv')}
    with open(ROOT / 'data' / 'synthetic_sites.csv', encoding='utf-8') as f:
        earth_sites = [r for r in csv.DictReader(f) if r['planet'] == 'Earth']

    out_tiles, site_values = [], {}
    for tid, meta in TILES.items():
        st = tiles[tid]
        rows = {int(r['class_code']): r for r in classes if r['tile'] == tid}
        valid_km2 = float(st['valid_area_km2'])
        area = {c: float(rows[c]['area_km2']) for c in CODES}
        check(abs(sum(area.values()) - valid_km2) / valid_km2 < 1e-6, f'{tid}: class areas do not add up to the valid area')
        land_km2 = valid_km2 - area[80]
        breakdown = [dict(code=c, area_km2=round(area[c], 2), pct=round(100 * area[c] / valid_km2, 3)) for c in CODES if area[c] > 0]

        pv = np.load(EW / 'metadata' / 'scan_cache' / f'{tid}.npz')['preview']
        check(pv.shape == (1500, 1500), f'{tid}: unexpected preview shape {pv.shape}')
        lut = np.zeros(256, np.uint8)
        for i, c in enumerate(CODES): lut[c] = i + 1
        idx = lut[pv]
        unknown = set(np.unique(pv)) - set(CODES) - {0}
        check(not unknown, f'{tid}: preview has unknown codes {unknown}')
        grid = block_mode(idx, DOWN)

        # Sites inside this tile: land cover within SITE_RADIUS_KM, read from the preview grid.
        W, S, E, N = meta['bounds']
        deg = (E - W) / pv.shape[1]
        sites_here = []
        for s in earth_sites:
            lat, lon = float(s['geographic.latitude']), float(s['geographic.longitude'])
            if not (W <= lon < E and S <= lat < N):
                continue
            r0, c0 = (N - lat) / deg, (lon - W) / deg
            ky = SITE_RADIUS_KM / 111.32 / deg
            kx = SITE_RADIUS_KM / (111.32 * math.cos(math.radians(lat))) / deg
            yy, xx = np.mgrid[0:pv.shape[0], 0:pv.shape[1]]
            m = ((yy + 0.5 - r0) / ky) ** 2 + ((xx + 0.5 - c0) / kx) ** 2 <= 1
            win = pv[m]
            valid = win[win != 0]
            land = valid[valid != 80]
            check(land.size > 50, f'{s["id"]}: too few land samples ({land.size})')
            veg = float(np.isin(land, list(VEG)).mean() * 100)
            bare = float((land == 60).mean() * 100)
            water = float((valid == 80).mean() * 100) if valid.size else 0.0
            mix = {int(c): round(float((valid == c).mean() * 100), 2) for c in CODES if (valid == c).any()}
            site_values[s['id']] = {
                'tile': tid,
                'fields': {'habitability.vegetation_cover_pct': round(veg, 1)},
                'bare_pct_of_land': round(bare, 1), 'water_pct': round(water, 1), 'classes_pct': mix,
                'samples': int(valid.size), 'radius_km': SITE_RADIUS_KM,
                'source': f'ESA WorldCover 2021 v200, tile {tid}: share of land within {SITE_RADIUS_KM:g} km classed as vegetation (preview grid, ~220 m sampling)',
            }
            sites_here.append(dict(id=s['id'], name=s['name'], lat=lat, lon=lon))

        out_tiles.append({
            'id': tid, **meta,
            'valid_pct': round(float(st['valid_pct']), 2), 'valid_km2': round(valid_km2, 1),
            'land_km2': round(land_km2, 1),
            'bare_pct_of_land': round(100 * area[60] / land_km2, 2),
            'veg_pct_of_land': round(100 * sum(area[c] for c in VEG) / land_km2, 2),
            'water_pct': round(100 * area[80] / valid_km2, 2),
            'built_pct': round(100 * area[50] / valid_km2, 3),
            'dominant': st['dominant_class'],
            'classes': breakdown,
            'map': {'width': int(grid.shape[1]), 'height': int(grid.shape[0]), 'cell_deg': deg * DOWN, 'data': b64(grid)},
            'sites': sites_here,
        })

    if problems:
        print('NOT WRITTEN, checks failed:\n  ' + '\n  '.join(problems)); sys.exit(1)
    doc = {
        'product': 'ESA WorldCover 10 m 2021 v200',
        'citation': 'Zanaga et al. (2022), https://doi.org/10.5281/zenodo.7254221',
        'license': 'CC-BY 4.0',
        'credit': '© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium',
        'classes': [dict(code=c, name=n, color=col, index=i + 1) for i, (c, n, col) in enumerate(CLASSES)],
        'vegetation_codes': sorted(VEG),
        'tiles': out_tiles,
        'site_values': site_values,
    }
    OUT.write_text(json.dumps(doc, separators=(',', ':'), ensure_ascii=False), encoding='utf-8')
    print(f'wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)')
    for t in out_tiles:
        print(f"  {t['id']} {t['name']}: bare {t['bare_pct_of_land']}% of land, veg {t['veg_pct_of_land']}%, water {t['water_pct']}%, sites {[s['id'] for s in t['sites']]}")
    for k, v in site_values.items():
        print(f'  {k}: vegetation {v["fields"]["habitability.vegetation_cover_pct"]}% of land, bare {v["bare_pct_of_land"]}%, water {v["water_pct"]}% ({v["samples"]} samples)')

if __name__ == '__main__':
    main()
