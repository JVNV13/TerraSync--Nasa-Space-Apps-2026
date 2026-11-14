# TerraSync – Global Planetary Analog Finder

NASA Space Apps Challenge 2026 entry. TerraSync ranks Earth sites as analogs for Mars (and Moon) landing and base sites. For every pair it explains where the analogy holds, where it breaks, and what the Earth site could be used to test. It also shows measured Mars terrain: elevation, slope and shadow maps from HiRISE stereo terrain models.

## Run locally
The site is plain HTML/CSS/ES modules with no build step and no dependencies.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

(Opening `index.html` straight from disk will not work, because browsers block `fetch()` of the data files over `file://`.)

## Views
| # | View | What it does |
|---|------|--------------|
| 01 | Mission | Headline numbers, best Earth twin per target, overlooked analogs, negative-control self-check |
| 02 | Terrain | Measured Mars elevation and slope maps, Sun sliders over 24 shadow maps, slope distributions, regional context |
| 03 | Atlas | Linked Mars and Earth maps: pick a target, and Earth sites are sized by score |
| 04 | Finder | Mission-profile presets, nine weight sliders, filters, ranked results, copy ranking as CSV |
| 05 | Compare | Score dial, radar, dimension breakdown, slope distributions, holds/breaks tables, Earth's limits, field brief, side-by-side record with a measured/synthetic label on every field |
| 06 | Matrix | Earth × target heatmap, overall or per dimension |
| 07 | Catalog | Search and filter all records, parameter-space scatter, full-record drawer |
| 08 | Method | Scoring pipeline, data-quality report, fixed scoring scales, limitations, load your own CSV |

## Scoring (js/engine.js)
- Feature similarity is 0–1. Numeric fields use `1 − |a−b| / (hi − lo)` on a **fixed physical scale** per field, so a pair's score does not change when records are added or removed. Heavy-tailed fields use a log scale.
- Slopes are compared as **distributions**: the overlap of two 1° slope histograms. Mean and max slope are used only when a site has no histogram.
- Lists use Jaccard overlap. Tags use exact-term plus root-word overlap.
- Nine dimensions: geology, terrain, thermal, dust/wind, water/ice, habitability, subsurface, processes, operations. Each uses only the features both records report. A pair sharing fewer than a third of the dimensions is shown as "Limited data" and is not rated.
- Pressure, radiation and gravity are reported as limits of the analogy and are not scored.
- A negative control (Amazon rainforest) checks that the method separates analogs from non-analogs.

## Data
| File | Content | Provenance |
|---|---|---|
| `data/mars_measured.csv` | 2 Mars terrain patches from HiRISE DTMs | measured |
| `data/mars_terrain.json` | Elevation, slope and 24 Sun-scenario grids for those patches, MOLA context | measured |
| `data/synthetic_sites.csv` | 16 Earth records (one control) and 14 Mars records | synthetic placeholders |

Provenance is tracked **per field**. A row is fully measured with `is_synthetic = false`; a mixed row lists its measured columns in `measured_fields`. The two measured files are generated from `Mars_Processed/` by `tools/build_site_data.py`. See `docs/MARS_DATA_INTEGRATION.md` for the data audit, fixes and limits.

Earth coastlines: Natural Earth 1:110m (public domain), via `world-atlas`.

## Structure
```
index.html            shell, nav, status bar
css/style.css         design system
data/                 site tables and Mars terrain grids
tools/build_site_data.py   Mars_Processed/ -> data/
Mars_Processed/       Mars pipeline, rasters, reports
js/csv.js             RFC-4180 CSV parser
js/data.js            field dictionary, typing, validation, field provenance, quality report
js/engine.js          similarity engine, fixed scales, dimensions, profiles
js/charts.js          SVG maps, radar, heatmap, scatter, dial, slope distributions
js/util.js            DOM/format helpers, tooltip, clipboard
js/app.js             state, hash router, delegated events, starfield
js/views/*.js         one module per view
```
