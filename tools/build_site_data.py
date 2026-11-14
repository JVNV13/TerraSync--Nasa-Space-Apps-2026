#!/usr/bin/env python3
"""Connect the processed Mars data to the website.

Reads   Mars_Processed/  (GeoTIFFs + reports written by Mars_Processed/pipeline.py)
Writes  data/mars_measured.csv   one catalogue row per measured HiRISE patch (site CSV schema)
        data/mars_terrain.json   the rasters behind the Mars terrain view (elevation, slope,
                                 24 Sun scenarios, slope distribution, MOLA context)

Nothing is invented here: every number is read from a pipeline product, and the script
cross-checks the rasters against the pipeline's own reports before writing anything.
Fields the Mars data do not measure (geology, climate, water, ...) are left blank.

Run:  python3 tools/build_site_data.py        (needs numpy + rasterio)
"""
import base64, csv, json, sys
from pathlib import Path
import numpy as np
import rasterio

ROOT = Path(__file__).resolve().parent.parent
MP = ROOT / 'Mars_Processed'
OUT = ROOT / 'data'
NOD = -9999.0

# Catalogue identity of each processed patch. Names describe position only (derived from the
# product georeferencing); no geological interpretation is attached.
PATCHES = {
    'DTEED_033651_1990_033717_1990_A01': dict(id='MH-001', name='HiRISE DTM patch 033651_1990 (east of Jezero · north)'),
    'DTEED_042328_1985_033150_1985_A01': dict(id='MH-002', name='HiRISE DTM patch 042328_1985 (east of Jezero · south)'),
}

problems = []
def check(ok, msg):
    if not ok:
        problems.append(msg)

def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode('ascii')

def read(rel):
    with rasterio.open(MP / rel) as s:
        return s.read(1), s

def build_patch(source, ident):
    stats = json.loads((MP / f'reports/{source}_patch_statistics.json').read_text())
    z, src = read(f'processed/common/{source}_DEM_analysis_30m.tif')
    ok = read(f'processed/common/{source}_valid_analysis.tif')[0].astype(bool)
    slope = read(f'processed/terrain/{source}_slope.tif')[0]
    dv = read(f'processed/terrain/{source}_derivative_valid.tif')[0].astype(bool)
    h, w = z.shape
    dx, dy = abs(src.transform.a), abs(src.transform.e)

    # ---- cross-checks against the pipeline reports
    check(ok.all() and not (z == NOD).any(), f'{source}: analysis DEM has invalid cells')
    check([h, w] == stats['analysis_grid_dimensions'], f'{source}: grid size differs from report')
    check(abs(float(z.mean()) - stats['analysis_height']['mean']) < 1e-2, f'{source}: DEM mean differs from report')
    sv = slope[dv]
    check(((slope != NOD) == dv).all(), f'{source}: slope NoData does not match derivative-valid mask')
    check(sv.min() >= 0 and sv.max() <= 90, f'{source}: slope outside 0-90 deg')
    check(abs(float(sv.astype(np.float64).mean()) - stats['terrain_stats']['slope']['mean']) < 1e-4, f'{source}: slope mean differs from report')
    dist = stats['slope_distribution']
    counts, _ = np.histogram(sv, bins=np.arange(0, len(dist['counts']) + 1) * dist['bin_width_deg'])
    check(list(map(int, counts)) == dist['counts'], f'{source}: slope histogram differs from report')

    # ---- rasters, quantised for transport (elevation 0.01 m, slope 0.01 deg)
    zmin = float(z.min())
    elev_q = np.round((z.astype(np.float64) - zmin) * 100).astype('<u2')
    check(float(z.max()) - zmin < 650, f'{source}: elevation range too large for 16-bit centimetres')
    slope_q = np.where(dv, np.round(slope.astype(np.float64) * 100), 65535).astype('<u2')

    scen_rows = {(int(r['altitude_deg']), int(r['azimuth_deg'])): r for r in csv.DictReader((MP / f'reports/{source}_sun_summary.csv').open())}
    scenarios = []
    for (alt, az), r in sorted(scen_rows.items()):
        tag = f'{source}_alt{alt:02d}_az{az:03d}'
        cast = read(f'processed/illumination/{tag}_cast_shadow.tif')[0]
        selfs = read(f'processed/illumination/{tag}_self_shadow.tif')[0]
        cosi = read(f'processed/illumination/{tag}_cos_incidence.tif')[0]
        check(np.isin(cast, [0, 1, 255]).all() and np.isin(selfs, [0, 1, 255]).all(), f'{tag}: unexpected shadow codes')
        check(int((cast == 1).sum()) == int(r['cast_shadow_cells']) and int((cast == 255).sum()) == int(r['cast_unresolved_cells']), f'{tag}: cast counts differ from sun_summary.csv')
        check(int((selfs == 1).sum()) == int(r['self_shadow_cells']), f'{tag}: self-shadow count differs from sun_summary.csv')
        check(((selfs != 255) == dv).all() and ((cosi != NOD) == dv).all(), f'{tag}: illumination validity differs from derivative mask')
        shadowed = (cast == 1) | (selfs == 1)
        lit = (cast == 0) & (selfs == 0)
        # one byte per cell: 0 lit, 1 cast shadow, 2 self shadow only, 3 unresolved
        state = np.full(cast.shape, 3, np.uint8)
        state[lit] = 0
        state[selfs == 1] = 2
        state[cast == 1] = 1
        cos_q = np.where(dv, np.round((np.clip(cosi, -1, 1) + 1) * 127), 255).astype(np.uint8)
        n = cast.size
        scenarios.append(dict(
            alt=alt, az=az,
            lit=int(lit.sum()), cast=int((cast == 1).sum()), self_only=int(((selfs == 1) & (cast != 1)).sum()),
            unresolved=int(n - lit.sum() - shadowed.sum()),
            shadowed_of_resolved=float(r['shadowed_fraction_of_resolved']) if r['shadowed_fraction_of_resolved'] else None,
            state=b64(state), cos=b64(cos_q)))

    relief = stats['terrain_stats']['local_relief']
    rough = stats['terrain_stats']['roughness_std']
    sl = stats['terrain_stats']['slope']
    loc = stats['location']
    patch = dict(
        id=ident['id'], name=ident['name'], source=source,
        product='HiRISE stereo DTM (PDS), 2 m posts, aggregated to ~30 m',
        width=w, height=h, cell_m=[dx, dy],
        size_km=[w * dx / 1000, h * dy / 1000],
        center_lonlat=[loc['center_lon_east_deg'], loc['center_lat_deg']],
        bounds_lonlat=loc['bounds_lonlat_deg'],
        vertical_reference=stats['vertical_reference'],
        elevation=dict(min=zmin, max=float(z.max()), mean=stats['analysis_height']['mean'], std=stats['analysis_height']['std'], scale=0.01, offset=zmin, data=b64(elev_q)),
        slope=dict(min=sl['min'], max=sl['max'], mean=sl['mean'], std=sl['std'], scale=0.01, nodata=65535, data=b64(slope_q)),
        slope_distribution=dist,
        relief_150m=relief, roughness_std_150m=rough,
        aspect=stats['terrain_stats']['aspect'],
        scenarios=scenarios)

    f = lambda v, d=3: f'{v:.{d}f}'
    row = {
        'id': ident['id'], 'name': ident['name'], 'planet': 'Mars', 'is_synthetic': 'False', 'is_control': 'False',
        'geographic.latitude': f(loc['center_lat_deg'], 4), 'geographic.longitude': f(loc['center_lon_east_deg'], 4),
        'geographic.coordinate_system': 'planetocentric_east_positive',
        'geographic.region': 'East of Jezero crater',
        'geographic.elevation_m': f(stats['analysis_height']['mean'], 1),
        'geographic.elevation_reference': 'Mars 2000 equipotential datum (HiRISE DTM label)',
        'terrain.slope_mean_deg': f(sl['mean']), 'terrain.slope_max_deg': f(sl['max']),
        'terrain.slope_median_deg': f(dist['percentiles_deg']['p50']), 'terrain.slope_p95_deg': f(dist['percentiles_deg']['p95']),
        'terrain.slope_hist_1deg': '|'.join(str(c) for c in dist['counts']),
        'terrain.relief_150m_m': f(relief['mean']), 'terrain.roughness_std_150m_m': f(rough['mean']),
        'terrain.elevation_range_m': f(float(z.max()) - zmin, 1),
        'data_source': f'HiRISE DTM {source} (PDS), {w * dx / 1000:.1f} x {h * dy / 1000:.1f} km patch at ~30 m cells; Mars_Processed/pipeline.py',
        'summary': (f'Measured terrain patch: {w * dx / 1000:.1f} x {h * dy / 1000:.1f} km of a HiRISE stereo DTM, ~{loc["center_lat_deg"]:.2f}N {loc["center_lon_east_deg"]:.2f}E, east of Jezero crater. '
                    f'Slope median {dist["percentiles_deg"]["p50"]:.1f} deg, 95th percentile {dist["percentiles_deg"]["p95"]:.1f} deg at a ~60 m baseline. '
                    'Only elevation, slope, relief and roughness are measured; geology, climate and water fields are not recorded.'),
    }
    row['measured_fields'] = '|'.join(k for k in row if '.' in k)
    return patch, row

def build_mola():
    a, src = read('processed/common/MOLA_regional_context_128ppd.tif')
    meta = json.loads((MP / 'metadata/MOLA_metadata.json').read_text())
    b = src.bounds
    check([b.left, b.bottom, b.right, b.top] == meta['extracted_context_bbox_lonlat'], 'MOLA context bounds differ from metadata')
    return dict(source=meta['source'], unit=meta['unit'], width=a.shape[1], height=a.shape[0],
                bounds_lonlat=[b.left, b.bottom, b.right, b.top], pixels_per_degree=meta['resolution_pixels_per_degree'],
                min=int(a.min()), max=int(a.max()), data=b64(a.astype('<i2')))

def main():
    params = json.loads((MP / 'metadata/processing_parameters.json').read_text())
    tests = json.loads((MP / 'reports/verification_tests.json').read_text())
    check(tests['all_passed'], 'pipeline verification tests did not all pass')
    patches, rows = [], []
    for source, ident in PATCHES.items():
        p, r = build_patch(source, ident)
        patches.append(p); rows.append(r)
    mola = build_mola()
    # sanity: MOLA sampled at each patch centre should be within the patch's own elevation range (+-150 m datum/scale slack)
    m = np.frombuffer(base64.b64decode(mola['data']), '<i2').reshape(mola['height'], mola['width'])
    for p in patches:
        lon, lat = p['center_lonlat']; W, S, E_, N = mola['bounds_lonlat']
        c = int((lon - W) / (E_ - W) * mola['width']); r = int((N - lat) / (N - S) * mola['height'])
        p['mola_at_center_m'] = int(m[r, c])
        check(p['elevation']['min'] - 150 <= m[r, c] <= p['elevation']['max'] + 150, f"{p['source']}: MOLA at patch centre ({m[r, c]} m) is far from the HiRISE patch range - georeferencing suspect")
    if problems:
        print('DATA PROBLEMS - nothing written:', *problems, sep='\n  ')
        sys.exit(1)
    OUT.mkdir(exist_ok=True)
    doc = dict(
        generated_by='tools/build_site_data.py from Mars_Processed/',
        body='Mars',
        sun=dict(altitudes_deg=params['sun_altitudes_deg'], azimuths_deg=params['sun_azimuths_deg'], max_ray_m=1200,
                 azimuth_reference='clockwise from grid north', note='Hypothetical Sun positions, not dates or times.'),
        state_codes={'0': 'lit', '1': 'cast shadow', '2': 'self shadow only', '3': 'unresolved'},
        cos_encoding='uint8 = round((cos_incidence + 1) * 127); 255 = no local normal',
        pipeline_tests=dict(count=len(tests['tests']), all_passed=tests['all_passed']),
        patches=patches, mola=mola)
    (OUT / 'mars_terrain.json').write_text(json.dumps(doc, separators=(',', ':')))
    cols = list(rows[0])
    with (OUT / 'mars_measured.csv').open('w', newline='') as fh:
        wri = csv.DictWriter(fh, fieldnames=cols); wri.writeheader(); wri.writerows(rows)
    print(f'wrote data/mars_measured.csv ({len(rows)} rows) and data/mars_terrain.json ({(OUT / "mars_terrain.json").stat().st_size / 1024:.0f} kB); all cross-checks passed')

if __name__ == '__main__':
    main()
