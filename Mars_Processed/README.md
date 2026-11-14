# NASA Space Apps — Mars terrain and lighting preprocessing

## Executed work
Two **independent** HiRISE DTM patches (centres near 18.76N 78.15E and 18.27N 78.20E, planetocentric east-positive; both lie east of Jezero crater, outside its rim) are selected by valid-data density, preserved at their native ~2.019m pixel scale, and aggregated to ~30m using valid-data-aware averages. No missing data are filled. The two DTMs are geographically separated and have different equirectangular centers; **never mosaic** them as adjacent. All original source inputs remain outside this output directory; SHA256 hashes are recorded. Source files are not bundled in this deliverable.

## Files and semantics
- `processed/common`: native and 30m DEM, validity masks, native modified-cell masks (all 0), 30m source-valid-fraction; MOLA context for the Jezero region (77.5-79.0E, 17.5-19.0N) at **native 128 px/degree**, plus a coarse whole-tile preview. MOLA is **not** terrain merged with HiRISE.
- `processed/terrain`: quantitative slope degrees, downslope aspect degrees clockwise from **grid north** (flat = NoData), 150m local elevation relief (max-minus-min, m), 150m roughness (population std of elevations, m), 3x3 derivative-valid mask.
- `processed/illumination`: per patch, 24 hypothetical Sun scenarios (elevation 5,15,30 degrees x azimuth 0..315 in 45degree steps). `cast_shadow` 1=terrain occluded, 0=no barrier **within 1200m and valid ray**, 255=unresolved due to data border/void. `self_shadow` 1=facet faces away, 0=faces Sun, 255=unavailable local derivative. `cos_incidence` normalized incidence geometry; -9999 NoData. Cast shadows and self-shadow are separate rasters; the scenario summaries also give the combined state (shadowed = either, lit = both clear) and the shadowed fraction **of resolved cells**.
- `metadata`: copied non-large PDS labels, per-product georeferencing, source checksums, processing options and scientific cautions.
- `reports`: source quality inspection before/after, real numeric patch stats and scene summaries, actual tests and GeoTIFF reopen validation.
- `figures`: visual previews, not replacements for data layers.
- `frontend`: JSON dashboard, separate Mars-projected bounding polygons with **per-feature CRS WKT**, and preview PNGs under `figures`. These polygons **cannot be drawn on Earth Web Mercator**. The `.geojson` extension is solely a convenient feature container: its projected coordinate interpretation is Mars-specific and not RFC 7946 WGS84.
- `manifest.csv`: inventory with file size, purpose.

## Scientific limitations
HiRISE label: elevations in metres above **Mars 2000 equipotential datum**. MOLA label: topography relative to **GMM3 areoid** in IAU2000. Coincident-looking values are **not proof of identical vertical reference**, and their independent projection representations differ; no vertical-offset harmonization or MOLA infill attempted. MOLA gridded cells include **interpolated bins**, not all direct laser hits. Negative elevations are valid. No outlier correction, smoothing, or fills were carried out. Subpixel rocks, dust, minerals, camera response, and geographic permanent darkness are **not inferred**.

Native HiRISE 2m pixel spacing is not same as effective resolution; 30m aggregation is for approximate NASADEM pixel spacing, **not** an equal-resolution claim. Some border pixels cannot yield reliable normals or shadows. Ray search capped at 1200m and casts discrete cell-center approximations; a clear result does NOT certify no shadows from more distant obstacles. Solar azimuths are relative to local raster grid north, not calibrated true-north or Sun ephemerides. R=3396 km approximation with curvature correction; no atmospheric refraction. Mars is not lunar south pole. All Sun angles are explicitly hypothetical. Only limited ray visibility can be guaranteed; 255 code means unresolved, not illuminated.

## Reproduction and integration
Run `python pipeline.py`. With the `Mars/` source directory beside this folder it rebuilds everything; without it (the sources are not bundled) it runs in *derive* mode and rebuilds every product that depends only on the stored 30m analysis DEM (terrain, illumination, statistics, frontend, manifest). Requirements: `numpy`, `rasterio`, `scipy`, `numba`, `matplotlib`, `nbformat`, `nbclient`. Notebook is a reproducible launcher; JSON outputs report what was truly executed. To show rasters on Mars, use a planetary GIS and the product-specific projection WKT; avoid Earth leaflet defaults. The frontend can consume `frontend/dashboard_data.json`, `reports/*_sun_summary.csv`, and preview paths in the JSON. Raw rasters can be served as Cloud Optimized GeoTIFF **after** an optional separate COG conversion; current files are tiled/compressed regular GeoTIFFs. No Earth inputs were provided: there is no final cross-planet similarity rank.

## Official references
- https://hirise.lpl.arizona.edu/dtm/about.php
- https://hirise.lpl.arizona.edu/dtm/howto.php
- https://pds-geosciences.wustl.edu/missions/mgs/megdr.html
- https://pds-geosciences.wustl.edu/missions/mgs/mola.html

## Corrections in this revision
- Slope, aspect, incidence and the shadow ray-march now use the true east-west (~29.91m) and north-south (~29.99m) cell sizes; the first release used the east-west size on both axes.
- Statistics carry an explicit `unit` (slope was labelled `_m`); aspect uses circular statistics.
- Slope distributions (histogram, percentiles, exceedance) and patch longitude/latitude were added.
- Numba cache files are no longer part of the deliverable or the manifest.

## Output meaning and validation
See `metadata/processing_parameters.json`, `reports/verification_tests.json`, and `reports/geotiff_reopen_validation.json`. No independent laboratory or planetary GIS science validation has been claimed.
