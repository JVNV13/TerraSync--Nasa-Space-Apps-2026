# TerraSync – Global Planetary Analog Finder

NASA Space Apps Challenge 2026 entry. TerraTwin ranks Earth sites as analogs for Mars (and Moon) landing and base sites. For every pair it explains where the analogy holds, where it breaks, and what the Earth site could be used to test.

## Run locally
The site is plain HTML/CSS/ES modules with no build step and no dependencies.

```bash
python3 -m http.server 8000 
# open http://localhost:8000
```

(Opening `index.html` straight from disk will not work, because browsers block `fetch()` of the CSV over `file://`.)

## Views
| # | View | What it does |
|---|------|--------------|
| 01 | Mission | Headline numbers, best Earth twin per target, overlooked (less-studied) analogs, negative-control self-check |
| 02 | Atlas | Linked Mars and Earth maps: pick a target, and Earth sites are sized by score |
| 03 | Finder | Mission-profile presets, nine weight sliders, filters, ranked results, copy ranking as CSV |
| 04 | Compare | Score dial, radar, dimension breakdown, holds/breaks tables, Earth's limits (pressure, radiation, gravity), exploration uses, copyable field brief, full side-by-side record |
| 05 | Matrix | Earth × target heatmap, overall or per dimension |
| 06 | Catalog | Search and filter all records, parameter-space scatter of any two fields, full-record drawer |
| 07 | Method | Scoring pipeline, data-quality report, dimension/profile tables, limitations, load your own CSV |

## Scoring (js/engine.js)
- Feature similarity is 0–1. Numeric fields use `1 − |a−b| / range`, with a log scale for heavy-tailed fields. Lists use Jaccard overlap. Tags use exact-term plus root-word overlap.
- Nine dimensions: geology, terrain, thermal, dust/wind, water/ice, habitability, subsurface, processes, operations. Each dimension uses only the features that both records report, and coverage is tracked.
- The analog score is a weighted mean of the dimensions. Mission profiles are weight presets.
- Pressure, radiation and gravity are reported as limits of the analogy and are not scored.
- A negative control (Amazon rainforest) checks that the method separates analogs from non-analogs.

## Data
`data/terratwin.csv`: 16 Earth records (one is a control) and 14 Mars records. **All records are flagged `is_synthetic = true`**, and the UI says so on every view. To use measured data, replace the file or load a CSV on the Method page. Rows with `planet = Moon` become lunar targets automatically.

Earth coastlines: Natural Earth 1:110m (public domain), via `world-atlas`.

## Structure
```
index.html            shell, nav, status bar
css/style.css         design system
js/csv.js             RFC-4180 CSV parser
js/data.js            field dictionary, typing, validation, quality report
js/engine.js          similarity engine, dimensions, profiles
js/charts.js          SVG maps, radar, heatmap, scatter, dial
js/util.js            DOM/format helpers, tooltip, clipboard
js/app.js             state, hash router, delegated events, starfield
js/views/*.js         one module per view
```
