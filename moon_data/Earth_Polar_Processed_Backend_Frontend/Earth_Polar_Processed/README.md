# Earth Polar Processed — NASA Space Apps exploratory pipeline

Three Copernicus GLO-30 DSM source GeoTIFFs were read from `Earth.zip` and preserved outside this ZIP, unchanged. `processed/common/` holds 80m DSMs (200×200 context and 80×80 cores), validity masks, and zero-change masks. `terrain/` holds slope (degrees), aspect (clockwise from **grid north**, flats NaN), 5×5 (400m) local elevation range (m) and 5×5 plane-detrended RMS roughness (m). `illumination/` contains 24 casts per site: 0 clear to 6.4km, 1 blocked, 2 unresolved. Core size is 6.4km square, context 16km square.

## Important scientific limits
- These are tile-centered exploratory regions, **not confirmed field training sites**, bare rock or verified McMurdo/Peary Land polygons. No land-cover dataset was provided, so land cover and training suitability remain **unverified**.
- Copernicus DEM is a DSM (may contain snow/ice, canopy, buildings); its 80m output spacing does not prove 80m intrinsic accuracy. Sources' pixel sizes vary by latitude. Elevation is in metres; vertical datum must be corroborated from primary product metadata.
- No NoData filling, smoothing, ocean detection from zeros, or DEM outlier deletion. A count of potential >100m pixel-to-pixel jumps is for inspection only, not a defect verdict. All modified masks contain zero.
- Aspect is clockwise from grid north. Sun azimuths in CSV are clockwise from true north, converted to grid frame via local projection convergence. Sun angles are hypothetical, not solar ephemerides.
- Ray search 6400m in steps of 80m; bilinear interpolation, observer at DSM height, Earth curvature correction `d²/(2×6371008.8m)` and no refraction. The beam exits incomplete context => unresolved (2), **never illuminated**. Blocked fraction excludes unresolved pixels from denominator. Context insufficiency and finite search range limit shadow results. Not permanent shadow and not a measured shadow length. Self-shadowing and photometric hillshade are not computed.
- The sample region, 80m ray step, far-field coverage, vertical datum, ground cover, and UTM distortion need independent validation before scientific claims. No lunar/mars data in this package, hence no similarity rank. No annual low-sun duration model was run; no actual visiting windows inferred.
- `frontend/dashboard_data.json` paths to pictures and files are relative to `frontend/`. `frontend/sites_wgs84.geojson` is WGS84 core geometry. Backend should serve GeoTIFF/JSON/CSV; frontend may display PNG previews and scenario validity warnings.

## Reproducibility
`code/run_earth_polar.py` is executed code; `01_Earth_Polar_Cleaning_Preprocessing.ipynb` is an executed, compact notebook entry point. Re-execution requires the three original source TIFFs in `/mnt/data/earth_inputs` unless you edit `INPUT`/`ROOT`. The `metadata/source_and_transformations.json` fingerprint is SHA256(source bytes + stable settings JSON + EPSG); outputs in this run are fresh (fingerprints recorded, no automatic cache skip is implemented). `reports/automated_tests.json` tests known slope/aspect, flat terrain, barrier, unknown gap and edge.

References: https://copernicus-dem-30m.s3.amazonaws.com/readme.html and https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM .
