# TerraSync – Global Planetary Analog Finder

NASA Space Apps Challenge 2026 entry. TerraSync ranks Earth sites as analogs for Mars (and Moon) landing and base sites. For every pair it explains where the analogy holds, where it breaks, and what the Earth site could be used to test. It also shows measured Mars terrain: elevation, slope and shadow maps from HiRISE stereo terrain models.

## Run locally
The site is plain HTML/CSS/ES modules with no build step and no dependencies.

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

(Opening `index.html` straight from disk will not work, because browsers block `fetch()` of the data files over `file://`.)

## Pages
| # | Page | What it shows |
|---|------|---------------|
| 01 | Home | One-line intro, where to start, best Earth twin for each Mars place |
| 02 | Mars | Measured Mars height, steepness and shadow maps (HiRISE), Sun sliders |
| 03 | Earth | Measured Earth land cover (ESA WorldCover 2021, 10 m) for three dry regions, how Mars-like the ground is |
| 04 | Find a twin | Pick a Mars place, get Earth places ranked; weights and filters are under "advanced" |
| 05 | Compare | One Earth place vs one Mars place: score, topics, matches, differences; full record under "details" |
| 06 | Map | Mars and Earth maps linked by match score |
| 07 | About | Where the data comes from in plain words; method and data-quality report under "technical details" |

The Matrix (`#matrix`) and Catalog (`#catalog`) views still work by URL but are no longer in the menu.
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
| `data/earth_landcover.json` | Land-cover maps and class shares for 3 WorldCover tiles, and plant cover within 5 km of catalogue sites inside them | measured |
| `data/synthetic_sites.csv` | 16 Earth records (one control) and 14 Mars records | synthetic placeholders (vegetation cover replaced by measured values for Badwater Basin and La Corona) |

Provenance is tracked **per field**. A row is fully measured with `is_synthetic = false`; a mixed row lists its measured columns in `measured_fields`. The Mars files are generated from `Mars_Processed/` by `tools/build_site_data.py`; the Earth file from `ESA_WorldCover_Processed/` by `tools/build_earth_data.py` (needs numpy). See `docs/MARS_DATA_INTEGRATION.md` for the data audit, fixes and limits.

Earth coastlines: Natural Earth 1:110m (public domain), via `world-atlas`.

## Structure
```
index.html            shell, nav, status bar
css/style.css         base design system
css/mec.css           exploration-centre theme (loaded after style.css)
data/                 site tables and Mars terrain grids
tools/build_site_data.py   Mars_Processed/ -> data/
tools/build_earth_data.py  ESA_WorldCover_Processed/ -> data/earth_landcover.json
Mars_Processed/       Mars pipeline, rasters, reports
js/csv.js             RFC-4180 CSV parser
js/data.js            field dictionary, typing, validation, field provenance, quality report
js/engine.js          similarity engine, fixed scales, dimensions, profiles
js/charts.js          SVG maps, radar, heatmap, scatter, dial, slope distributions
js/util.js            DOM/format helpers, tooltip, clipboard
js/app.js             state, hash router, delegated events, starfield
js/views/*.js         one module per view
```
