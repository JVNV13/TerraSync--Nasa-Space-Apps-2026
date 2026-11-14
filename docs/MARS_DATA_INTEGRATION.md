# Mars data: what was checked, fixed and connected

This records every change made to the data in `Mars_Processed/` and how that data reaches the website.

## 1. What the Mars data is

| | Patch A | Patch B |
|---|---|---|
| Source product | HiRISE DTM `DTEED_033651_1990_033717_1990_A01` | HiRISE DTM `DTEED_042328_1985_033150_1985_A01` |
| Centre (planetocentric, east-positive) | 18.757°N 78.146°E | 18.268°N 78.196°E |
| Size | 2.42 × 3.03 km, 81 × 101 cells | 2.42 × 3.03 km, 81 × 101 cells |
| Cell size (E–W × N–S) | 29.914 × 29.988 m | 29.917 × 29.991 m |
| Elevation | −2,564.6 to −2,153.7 m | −1,391.6 to −868.3 m |
| Website record | `MH-001` | `MH-002` |

Both patches lie east of Jezero crater, outside its rim. Per patch there are elevation, slope, aspect, local relief and roughness rasters, and 24 Sun scenarios (5°, 15°, 30° elevation × 8 azimuths) each with a cast-shadow, self-shadow and incidence raster. A MOLA grid (77.5–79.0°E, 17.5–19.0°N) gives regional context.

The original PDS files are not in the repository, so nothing at source level could be re-read. Everything below was checked against the stored 30 m analysis DEMs and the pipeline's own reports.

## 2. Audit results

Checks that passed with no change needed:

- Both analysis DEMs are 100% valid: no NoData, no NaN, no filled cells.
- Largest height step between neighbouring 2 m cells is 4.1 m (A) and 4.6 m (B). The 161 jumps above 50 m flagged in the full product A do not fall inside the selected patch.
- The 30 m DEM matches a block average of the 2 m patch (mean difference 0.06 m).
- Slope, aspect, relief, roughness and incidence rasters reproduce from the DEM with the pipeline's formulas (differences below 1e-5).
- All 48 scenario rows in the Sun summaries match the cell counts in the rasters.
- Georeferencing: MOLA sampled at each patch centre reads −2,436 m and −1,161 m, against HiRISE patch means of −2,422 m and −1,171 m.

Issues found:

| # | Issue | Effect | Action |
|---|---|---|---|
| 1 | Analysis cells are not square (29.91 m E–W, 29.99 m N–S) but slope, aspect, incidence and the shadow ray-march used the E–W size on both axes | Slope biased by up to 0.06°; a few shadow cells misclassified | Fixed in `pipeline.py`, products regenerated |
| 2 | Statistics used keys `min_m`, `mean_m`… for every quantity, including slope and aspect in degrees | Units mislabelled | Keys are now `min/max/mean/std` with an explicit `unit` |
| 3 | Aspect was summarised with an arithmetic mean and standard deviation | Meaningless for an angle: reported 132° and 241°, the circular means are 90° and 344° | Replaced by circular mean, resultant length and octant shares |
| 4 | Only mean and standard deviation of slope were reported | The two patches look alike (8.7° vs 8.6°) although their slopes are spread very differently | Added 1° histogram, percentiles and share steeper than 5–30° |
| 5 | Cast shadow and self shadow were only reported separately, and shadow counts were not related to the cells that could be resolved | Cells that face away from the Sun still count as "clear" in the cast-shadow raster (66 in one scenario checked); up to 54% of a patch is unresolved at some Sun positions | Added combined state and "shadowed share of resolved cells" to the summaries |
| 6 | No longitude/latitude for the patches; MOLA context described as "around Jezero" | Patches could not be placed; location wording imprecise | Added centre and bounds in degrees; README wording corrected |
| 7 | Numba cache files (`__pycache__/*.nbc`, `*.nbi`) were committed and listed in the manifest | Build artefacts in the deliverable | Removed, ignored, excluded from the manifest |
| 8 | `data/terratwin.csv` had been deleted on this branch while the site still fetched it | The website could not load at all | Site now loads `data/mars_measured.csv` + `data/synthetic_sites.csv` |

## 3. Changes to `Mars_Processed/`

`pipeline.py`

- `terrain()` takes separate E–W and N–S cell sizes.
- `cast_shadow()` marches in metres and converts to rows and columns with each axis' own size.
- Four new verification tests for non-square cells (15 tests in total, all pass).
- New *derive* mode: when the PDS sources are absent, every product that depends only on the 30 m DEM is rebuilt from the stored DEMs. With the sources present it runs the full pipeline as before.
- New outputs in `reports/*_patch_statistics.json`: `slope_distribution`, `location`, `vertical_reference`, circular aspect statistics.
- New columns in `reports/*_sun_summary.csv`: combined shadowed, lit and unresolved cells, shadowed fraction of resolved cells, resolved fraction of the patch.

Regenerated: `processed/terrain/*`, `processed/illumination/*`, `figures/*_elevation.png`, `figures/*_slope.png`, all reports except the source-level ones, `frontend/*`, `metadata/*_solar_scenarios.json`, `metadata/processing_parameters.json`, `manifest.csv`, `README.md`.

Not touched: the 2 m and 30 m DEMs and their masks, the MOLA rasters, PDS labels, `input_quality_before.json`, `MOLA_metadata.json`.

Size of the correction:

| | Patch A before → after | Patch B before → after |
|---|---|---|
| Mean slope | 8.7228° → 8.7146° | 8.5770° → 8.5606° |
| Max slope | 32.798° → 32.748° | 28.226° → 28.222° |
| Sun scenarios with changed shadow counts | 11 of 24 (at most 4 cells) | 4 of 24 (at most 19 cells) |

## 4. How the data reaches the website

```
Mars_Processed/  ──  tools/build_site_data.py  ──►  data/mars_measured.csv   (2 catalogue rows)
                                                    data/mars_terrain.json   (grids for the Terrain view)
data/synthetic_sites.csv  (the previous demonstration catalogue, unchanged)
```

`tools/build_site_data.py` re-checks the rasters against the pipeline reports (grid size, means, histogram, shadow counts, class codes, MOLA agreement) and writes nothing if a check fails.

- `mars_measured.csv` holds only what was measured: position, elevation, slope mean/median/95th percentile/max, slope histogram, relief, roughness. Geology, climate, water and habitability are left blank.
- `mars_terrain.json` holds elevation (0.01 m steps), slope (0.01° steps), and for each Sun scenario a per-cell state (lit, cast shadow, self shadow only, unresolved) and incidence cosine.
- `synthetic_sites.csv` is the earlier demonstration data: 16 Earth records and 14 Mars records. They are kept because no measured Earth data exists yet and the site needs Earth candidates to rank. Every value in it is labelled synthetic in the interface.

To refresh after changing the Mars data:

```bash
python3 Mars_Processed/pipeline.py
```

```bash
python3 tools/build_site_data.py
```

## 5. Website changes that depend on the data

1. **Terrain view** (`js/views/terrain.js`): elevation, slope and shadow maps for either patch, Sun azimuth and elevation sliders across the 24 scenarios, per-cell readout, shadow share by Sun direction, MOLA context.
2. **Field-level provenance** (`js/data.js`): each filled field of each record is measured or synthetic. A row is fully measured with `is_synthetic = false`, or mixed by listing columns in `measured_fields`. Badges appear on every field in Compare and Catalog; the header and Method page count values, not records.
3. **Slope distributions** (`js/engine.js`): slopes are scored by the overlap of two 1° histograms. Mean and max slope are used only when a site has no histogram. Patch A and B differ by 0.15° in mean slope but their distributions overlap by 68%.
4. **Fixed scoring scales** (`js/engine.js`): each numeric field has a fixed physical range, listed on the Method page. Scores no longer depend on which records are loaded.
5. **Name**: the site is "TerraSync" throughout.

## 6. Limits that remain

- There is no measured Earth terrain. Earth sites have only a synthetic mean and maximum slope, so an Earth site can be compared with the measured patches on those two numbers only. Such pairs are shown as "Limited data" and are not rated.
- Sun positions are hypothetical and relative to grid north. Shadows from terrain beyond 1,200 m are not modelled; cells whose ray leaves the patch first are unresolved.
- Slopes use a ~60 m baseline. Compare them only with terrain processed the same way.
- HiRISE and MOLA use different vertical datums; MOLA is context only.
- The fixed scoring ranges changed all synthetic pair scores relative to the earlier version, which normalised by the loaded records.
