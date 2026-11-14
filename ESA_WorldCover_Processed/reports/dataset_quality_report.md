# ESA WorldCover 2021 v200 quality report

Inspected 3 GeoTIFFs in new_data. Analyzed 3 Map tiles. All original TIFF SHA-256 hashes matched before and after processing.

| Tile | Valid pixels | Valid % | NoData % | Unexpected | Distinct classes | Classified km² | Dominant by area |
|---|---:|---:|---:|---:|---:|---:|---|
| N27W015 | 510,638,102 | 39.40109 | 60.59891 | 0 | 8 | 38,626.28 | Permanent water bodies (58.61%) |
| N36W117 | 1,296,000,000 | 100.00000 | 0.00000 | 0 | 10 | 88,316.48 | Bare / sparse vegetation (42.92%) |
| S24W069 | 1,296,000,000 | 100.00000 | 0.00000 | 0 | 9 | 102,538.29 | Bare / sparse vegetation (79.18%) |

## Distribution and cleaning

- N27W015: Permanent water bodies 58.61%, Bare / sparse vegetation 39.56%, Grassland 1.25%.
- N36W117: Bare / sparse vegetation 42.92%, Shrubland 25.57%, Grassland 17.42%.
- S24W069: Bare / sparse vegetation 79.18%, Grassland 20.03%, Permanent water bodies 0.63%.

No cleaning was required. Every classified pixel had an official code. Code 0 is declared NoData. Class 80 is permanent water and is included in valid totals. Source codes, CRS, spatial resolution, and registration were preserved.

## NASADEM compatibility

- N27W015 → n28w014: 100.00% geometric footprint overlap and 56.19760% classified coverage in that footprint.
- N27W015 → n29w014: 100.00% geometric footprint overlap and 40.89181% classified coverage in that footprint.
- N36W117 → n36w117: 100.00% geometric footprint overlap and 100.00000% classified coverage in that footprint.
- S24W069 → s23w069: 100.00% geometric footprint overlap and 100.00000% classified coverage in that footprint.

Both datasets use EPSG:4326 in the intersecting grids. WorldCover has 0.3″ area cells and NASADEM has 1″ points. Use separate grids until a target alignment is chosen.

## Interpretation and limitations

Figures show broad spatial patterns. Fixed-stride display samples can miss small patches. Area represents the ellipsoid surface rather than slope-adjusted terrain surface. The structural checks verify codes and coverage. Independent reference observations are required to validate local map accuracy.

[ESA Product User Manual](https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/docs/WorldCover_PUM_V2.0.pdf) · [WorldCover 2021 v200 citation](https://doi.org/10.5281/zenodo.7254221)

© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium
