# TerraSync – Global Planetary Analog Finder

## Project Documentation Report


## 1. Project Overview

TerraSync is a browser-based tool that ranks Earth sites as analogs for candidate Mars landing and base sites. For every Earth–Mars pair it reports where the analogy holds and where it breaks, and what the Earth site could be used to test. It was built for the NASA Space Apps Challenge 2026 challenge on terrestrial analogs for Moon and Mars exploration.

### 1.1 The problem

The challenge brief states that mission teams already test equipment and methods at Earth analogs such as the Atacama Desert, Haughton Crater and Death Valley, but that "such terrestrial analog sites are not entirely well characterized." It asks participants to identify and characterize analogs across deserts, polar regions, volcanic and arid terrains and caves, and to present the findings "as a map, visualization, or other tool."

The brief also stresses that:

- no Earth site reproduces another planet completely, so an analog must be judged dimension by dimension;
- visual similarity is not enough, and the analogy must be explained with data;
- teams should look beyond well-known sites;
- Earth's limits (gravity, the thin Martian atmosphere, the lunar vacuum, radiation) must be recognized.

### 1.2 Objectives

| Objective | How TerraSync addresses it |
| --- | --- |
| Identify analog locations | Ranks every Earth site against every Mars target (15 × 14 = 210 real pairs, plus 14 control pairs) |
| Characterize what is similar and what is not | Scores nine dimensions separately and lists the individual fields that match (similarity ≥ 75) or diverge (≤ 35) |
| Think beyond visual similarity | Combines geology, terrain, climate, dust, water, habitability, caves, processes and operations |
| Look beyond well-known sites | Highlights high-scoring Earth sites whose `analog_maturity` is `emerging` or `under_studied` |
| Connect the analog to exploration | Maps each strong dimension to a concrete use (e.g. water/ice → ice-prospecting radar and ISRU drilling) |
| Recognize Earth's limits | Reports surface pressure, radiation dose and gravity separately and never counts them as similarity |
| Present findings as a map or tool | A seven-view interactive website with maps, a ranking tool, a heatmap, a radar chart and a scatter plot |

### 1.3 Motivation and expected outcomes

Analog fieldwork is expensive, and choosing where to go is usually based on experience and reputation. A transparent, data-driven ranking lets a team justify a site choice, spot less-studied alternatives, and see in advance which parts of a mission rehearsal an Earth site cannot represent. The expected outcome is a reusable method and interface: once measured data replace the bundled synthetic records, the same tool produces evidence-based rankings without code changes.

### 1.4 Target audience and applications

| Audience | Typical use |
| --- | --- |
| Mission planners and analog-campaign organizers | Shortlist field sites for a rehearsal with a given goal (rover traverse, ice prospecting, life detection) |
| Planetary scientists | Compare a target's mineralogy, climate and terrain with Earth candidates; find under-studied sites |
| Instrument and engineering teams | Pick test sites that match the conditions an instrument must survive (dust, slopes, cold) |
| Educators and the public | Explore why some Earth places resemble Mars and why none of them is a perfect match |
| Hackathon judges and reviewers | Inspect the method, data quality and limitations directly in the tool |

> **Important:** every record in the bundled dataset is flagged `is_synthetic = true`. All rankings in this report demonstrate the method; they are not scientific findings (see Section 8).

## 2. Project Concept and Methodology

TerraSync treats "is this Earth site a good analog?" as a measurable similarity question, answered separately for each aspect of a site and then combined with weights that reflect the mission's goal. Everything runs in the browser from one CSV file.

&#91;embedded content: TerraSync data pipeline · 6 stages + user weights\]

The CSV is parsed and validated once. The engine then scores any Earth–target pair on request, and the views call it with the current target, candidate and weights.

### 2.1 Workflow from data to results

1. **Load.** The browser fetches `data/terratwin.csv`, or reads a CSV the user selects on the Method page. Nothing is sent to a server.
2. **Parse and validate.** Each cell is typed against a field dictionary of 68 columns (number, boolean, `|`-separated list, or text). Blank, `n/a`, non-numeric or out-of-range cells become `null` and are logged. Rows with the wrong field count, a duplicate `id`, or no valid coordinates are rejected.
3. **Normalize.** For each numeric feature, the engine records its range across all loaded records. Heavy-tailed features are compared on a `log10(x + 1)` scale.
4. **Score features.** Each feature shared by both sites gets a similarity between 0 and 1.
5. **Score dimensions.** Features are grouped into nine dimensions. A dimension score is the weighted mean of the features that both sites actually report.
6. **Combine.** The analog score is the weighted mean of the available dimension scores, using the selected mission profile or custom slider weights.
7. **Explain.** Fields with similarity ≥ 0.75 are listed as where the analogy holds, and fields ≤ 0.35 as where it breaks. Pressure, radiation and gravity are reported as Earth's limits and never scored.
8. **Present.** Results feed maps, rankings, a radar chart, a heatmap, tables and a plain-text field brief.

### 2.2 Feature similarity

Five comparison types are used, chosen to match each field's data type:

| Type | Used for | Similarity |
| --- | --- | --- |
| Numeric distance | temperatures, slopes, indices, wind, irradiance | 1 − \|a − b\| / range, floored at 0 |
| Numeric distance (log) | crater density, precipitation, regolith water content | same, after log10(x + 1) |
| Set overlap (Jaccard) | minerals, mineral groups, rock types, hydrated mineral types | shared items ÷ all distinct items |
| Term overlap | analog tags, geological features, erosion indicators | 0.5 × exact-item Jaccard + 0.5 × root-word Jaccard |
| Match / class match | impact structure, caves, lava tubes, hydrated minerals; terrain class | 1 if equal, else 0; terrain class gives 0.6 or 0.3 partial credit via secondary classes |

For numeric features:

```latex
s_f(a,b) = \max\left(0,\; 1 - \frac{|a - b|}{\max_i x_i - \min_i x_i}\right)
```

The range in the denominator comes from all records of both planets. A difference is therefore judged against the full spread of Earth and Mars conditions in the dataset.

### 2.3 Dimension and analog scores

```latex
D_k = \frac{\sum_{f \in k,\ \text{both present}} w_f\, s_f}{\sum_{f \in k,\ \text{both present}} w_f}
\qquad
S = \frac{\sum_{k:\ D_k \text{ defined}} W_k\, D_k}{\sum_{k:\ D_k \text{ defined}} W_k}
```

w\_f are fixed feature weights inside a dimension (Section 6.3). W\_k are the mission-profile or slider weights. Two rules keep missing data from distorting results:

- A missing value is skipped, not treated as zero, and the share of each dimension actually available is shown as coverage.
- The caves and subsurface dimension is scored only when the target has a recorded cave or lava tube. Otherwise it is marked n/a and drops out, so two cave-less sites do not get credit for "matching" on absent caves.

### 2.4 Rating bands and validation

Scores are shown out of 100 with four bands: Strong ≥ 60, Useful ≥ 50, Partial ≥ 40, Weak < 40. The dataset includes a negative control (EA-016, Central Amazon rainforest). The Mission view checks that it stays in the bottom half of the ranking for every target. If it does not, the method is flagged as needing review.

## 3. Data Visualization

TerraSync has ten hand-built SVG visualizations, each answering a different question about the analog pairs. All are drawn from the parsed CSV and the engine's live output; none uses a charting library. Screenshots of the running website follow each description.

### 3.1 Summary

| Visualization | View | Question it answers | Chart type and why |
| --- | --- | --- | --- |
| Target-site map (Mars) | Atlas | Where are the candidate sites, and which one is selected? | Equirectangular point map; site position is the natural selector |
| Candidate map (Earth) | Atlas | Where on Earth are the best matches for this target? | Point map with marker size = score; geography and rank at once |
| Ranked list with score bars | Atlas, Finder | Which Earth sites rank highest? | Sorted list + bar; exact order and magnitude |
| Dimension mini-bars | Finder | On which dimensions does each candidate hold up? | Nine-bar sparkline per result; a profile at a glance |
| Score dial | Compare | How good is this pair overall? | Single-value gauge for the headline number |
| Radar chart | Compare | What is the pair's similarity profile across nine dimensions? | Radar; shows the shape of strengths and gaps; supports an overlay |
| Dimension breakdown bars | Compare | Exact score, coverage and weight per dimension | Horizontal bars with values; precise reading the radar cannot give |
| Analog matrix heatmap | Matrix | How do all Earth sites compare with all targets? | Heatmap; 16 × 14 cells in one screen |
| Parameter-space scatter | Catalog | How do sites spread on any two measured fields? | Scatter; relationships and clusters between two variables |
| Data-completeness bars | Method | How complete is each group of fields? | Bars per field group; data-quality check |

### 3.2 Visual encoding rules

- **Earth vs Mars:** teal `#2f9fbf` vs rust `#d9673a`, a pair checked with a colour-vision-deficiency validator against the dark background. Shape is a second cue: Earth = circle, Mars = diamond (Moon = square), so the planet is never shown by colour alone.
- **Magnitude:** one "bone" ramp from near-black to ivory for scores (heatmap, similarity pills), with no rainbow scale.
- **Negative control:** dashed, unfilled amber outline wherever it appears.
- **Interaction:** every data mark has a tooltip on hover or keyboard focus, and clickable marks are focusable (`tabindex=0`) and respond to Enter or Space.

### 3.3 Orbital atlas: target map and candidate map

Two linked equirectangular maps (viewBox 360 × 180, so x = longitude + 180 and y = 90 − latitude).

- **Attributes:** `geographic.latitude`, `geographic.longitude`, `name`, `geographic.region`, `is_control`. On the Earth map, marker radius = 1.6 + 4.2 × analog score against the selected target, and the top five are numbered by rank.
- **Basemap:** Earth coastlines from Natural Earth 1:110m (public domain), pre-projected into one SVG path at build time. The Mars map has no basemap, only a graticule and labeled sites, because no Mars topography layer is bundled. The map caption says so ("positions only, no basemap").
- **Why:** analog selection is spatial. Seeing that the best matches for Medusae Fossae cluster in North African and Central Asian deserts is an insight a table hides.
- **Interaction:** clicking a Mars site sets the target, and every Earth marker resizes and re-ranks. Clicking an Earth site selects it and shows its score with a "Full comparison" button. The selected site has a pulsing ring.

&#91;image: Atlas view with Arsia Mons selected and La Corona lava tube ranked first\]

*Figure 3.1 — Atlas: Arsia Mons cave skylights selected on the Mars map. Earth markers are sized by score, with La Corona lava tube ranked #1 (64, Strong).*

### 3.4 Ranked results and dimension mini-bars

The Finder lists every Earth candidate as a card: rank, name, region and terrain class; the two strongest and the weakest dimension; a nine-bar mini chart (bar height = dimension score, flat grey bar = n/a); data coverage; and the score with its band.

- **Attributes:** engine output, plus `geographic.region`, `terrain.classification`, `exploration.analog_maturity` (shown as an "under studied" or "emerging" tag).
- **Interaction:** the list re-sorts as weight sliders move. Search, terrain filter, maturity checkboxes and a control toggle filter it. "Copy ranking (CSV)" copies the visible ranking with all dimension scores.

&#91;image: Finder view with controls and ranked result cards\]

*Figure 3.2 — Finder: target selector, mission profiles, weight sliders and filters (left); ranked cards with dimension mini-bars (right).*

### 3.5 Pair analysis: dial, radar and breakdown

- **Score dial:** a circular gauge of the overall score, with rank among Earth sites and dimension coverage beside it.
- **Radar chart:** nine axes (GEO, TER, THM, AEO, H₂O, BIO, SUB, PRC, OPS). Axes with no data are labeled n/a and plotted at zero. An optional second Earth site is drawn as a dashed outline to compare two candidates for the same target. A radar fits here because the reader wants the shape of the profile: a site strong on terrain and operations but weak on geology looks very different from the reverse.
- **Breakdown bars:** the exact score per dimension, its coverage, its current weight and a one-line description. A marker shows the overlay site's score.
- **Holds / breaks tables:** the individual fields with similarity ≥ 75 and ≤ 35, each with both sites' values, e.g. "Minerals — dolomite, calcite, gypsum… vs olivine, pyroxene…".

&#91;image: Compare view: score dial, site summaries, radar and dimension breakdown\]

*Figure 3.3 — Compare: La Corona lava tube vs Arsia Mons cave skylights. Score dial (64), site summaries, radar and dimension breakdown.*

&#91;image: Where the analogy holds and where it breaks down\]

*Figure 3.4 — Field-level explanation: matching fields (left); diverging fields and Earth's limits, i.e. pressure, radiation and gravity (right).*

### 3.6 Analog matrix heatmap

Rows are Earth sites and columns are targets. Each cell is the overall score or, via a selector, any single dimension. The colour ramp is stretched to the observed range (e.g. 30–65 for overall scores) so differences stay visible, and the legend states the range. The best Earth match in each column is outlined. Rows can be sorted by mean score, best single match or name, and clicking a cell opens that pair. The control row stands out as a uniformly dark band (scores 30–38), which is the visual form of the method self-check.

&#91;image: Analog matrix heatmap of 16 Earth sites by 14 Mars targets\]

*Figure 3.5 — Matrix: overall scores with best-per-column outlines. The control row (bottom) is uniformly dark.*

### 3.7 Parameter-space scatter

The user picks any two numeric fields with at least three recorded values as X and Y. Fields are listed with units, and an optional log scale is switched on automatically for heavy-tailed fields such as precipitation and crater density. Earth and Mars sites appear as circles and diamonds. Records missing either value are left out, and the count is stated under the chart. The default view, mean temperature vs dust activity index, shows the two planets as separate clusters. This makes it clear why thermal similarity is limited even for the best analogs.

&#91;image: Scatter of mean temperature vs dust activity index\]

*Figure 3.6 — Catalog scatter: mean temperature vs dust activity. Mars diamonds sit at −105 to −50 °C, Earth circles at −23 to 35 °C, and the control (dashed) has the lowest dust activity.*

### 3.8 Data-completeness bars

On the Method page, one bar per field group shows the share of filled cells. For example, Subsurface is 43% and Exploration 54%, mostly because some fields are recorded for only one planet.

&#91;image: Method view: scoring pipeline and data quality report\]

*Figure 3.7 — Method: scoring pipeline (left) and data-quality report with completeness bars (right).*

## 4. Website Features and User Interface

The website is a single page with seven views, switched by URL hash (`#mission`, `#atlas`, `#finder`, `#compare`, `#matrix`, `#catalog`, `#method`). A shared state holds the selected target, candidate, mission profile, weights and control toggle, so a choice made in one view carries into the others.

### 4.1 Pages and features

| # | View | Purpose | Main components and functions |
| --- | --- | --- | --- |
| 01 | Mission | Orient the user and give the headline results | Hero with live counts (15 Earth sites + 1 control, 14 Mars targets, 224 pairs scored, top match); synthetic-data notice; "Best Earth twin for each target" table with strongest/weakest dimension; "Overlooked analogs" list; method self-check (negative control) and "no lunar records" notice |
| 02 | Atlas | Spatial exploration | Linked Mars and Earth maps; target selector; target card (coordinates, elevation, summary, tags, mission history); mission-profile chips; selected-site card; top-8 ranking |
| 03 | Finder | Tunable ranking | Target selector; 6 mission-profile presets; 9 weight sliders (0–3, step 0.1) with reset; search; terrain-class filter; maturity checkboxes; control toggle; ranked result cards; copy ranking as CSV |
| 04 | Compare | Explain one pair | Earth and target selectors; optional overlay site; score dial and rank; site summaries; radar; dimension breakdown; holds/breaks tables; Earth's limits; exploration uses; copyable plain-text field brief; collapsible side-by-side record of all 68 fields |
| 05 | Matrix | Overview of all pairs | Dimension selector (overall or any of 9); row sort; profile chips; heatmap with best-per-column outline |
| 06 | Catalog | Browse raw records | Free-text search (names, regions, minerals, tags); body, terrain and tag filters; parameter-space scatter; site cards; full-record drawer with best matches |
| 07 | Method | Transparency and data control | Scoring pipeline; data-quality report (rows read/accepted/rejected, cell issues, completeness by group, empty or unknown columns); dimension and profile tables; limits of an Earth analog; load-your-own-CSV and restore buttons |

&#91;image: Mission overview page\]

*Figure 4.1 — Mission view: headline counts, the synthetic-data notice and the top of the best-twin table.*

&#91;image: Catalog with full-record drawer open\]

*Figure 4.2 — Catalog: site cards with the full-record drawer for La Corona lava tube, showing its best target matches and grouped fields.*

### 4.2 Mission profiles

Profiles are named weight presets over the nine dimensions. They change emphasis, not data.

| Profile | Highest weights | Lowest weights |
| --- | --- | --- |
| Balanced survey | all 1.0 | all 1.0 |
| Life detection | habitability 2.2, water 1.4, processes 1.4 | operations 0.3, terrain 0.4, aeolian 0.4 |
| Resource prospecting | water 2.4, geology 1.3 | habitability 0.3, aeolian 0.4 |
| Rover & landing ops | terrain 2.2, operations 2.2, aeolian 1.4 | habitability 0.1, water 0.3 |
| Field geology training | geology 2.2, processes 1.8, terrain 1.3 | thermal 0.3, operations 0.4 |
| Subsurface habitat | subsurface 2.8, processes 1.4 | aeolian 0.3, habitability 0.4 |

### 4.3 User journey

1. **Arrive at Mission.** See what the tool does, the headline numbers, and that the data is synthetic. Pick a row in "Best Earth twin" or click "Open the atlas".
2. **Choose a target in Atlas.** Click a Mars site and the Earth map shows where its analogs are. Switch the mission profile and the ranking changes.
3. **Refine in Finder.** Adjust weights, filter to under-studied sites, or hide the control, then copy the ranking for a report.
4. **Explain in Compare.** Open a pair to see why it scores as it does, where it breaks, and what it could test. Copy the field brief.
5. **Survey in Matrix.** Compare all pairs, or a single dimension such as water and ice, and jump to any pair.
6. **Check the data in Catalog and Method.** Inspect raw records and the quality report, or load a new CSV, which updates every view.

### 4.4 Design choices

The brief asked for a space-mission look that avoids generic dashboard styling. The interface is modeled on a mission-operations console and a scientific journal:

- **Palette:** deep-space near-black (`#07090d`), bone-white type (`#ebe6da`), one amber signal colour (`#e8c77d`) for selection and focus, and Earth teal and Mars rust for data.
- **Typography:** *Instrument Serif* for headings and big numbers, *IBM Plex Sans* for body text, *IBM Plex Mono* for codes, coordinates and readouts. All three are loaded from Google Fonts with system fallbacks.
- **Panels:** square hairline frames with registration marks at two corners instead of rounded glass cards. Section labels use mission-style codes ("§ FINDER", "TGT", "RNK").
- **Atmosphere:** a canvas starfield with slow twinkle, a stylized Mars limb in the hero, and subtle orange and teal glows. Motion is disabled under `prefers-reduced-motion`.
- **Chrome:** a fixed top status bar (dataset file name, record count, a SYNTHETIC/MEASURED flag, live UTC clock) and a left rail with numbered mission phases, which becomes a bottom tab bar on phones.
- **Responsiveness:** layouts collapse at 1180 px, 900 px and 560 px. Tested at 1440 × 900 and 390 × 844.
- **Accessibility:** skip link, focus outlines, keyboard-operable marks, `role="img"` with labels on charts, shape as well as colour for planet identity.
- **Honesty in the UI:** the synthetic-data notice appears on every view, missing values show as "not recorded", and the Mars map states that it has no basemap.

&#91;image: Compare view on a phone\]

*Figure 4.3 — Compare view at 390 × 844 (phone): stacked layout with the bottom tab bar.*

## 5. System Architecture and Technologies

TerraSync is a static, client-only web application: plain HTML, CSS and JavaScript ES modules, with no backend, no framework and no runtime libraries. The only external resources loaded at runtime are three Google Fonts.

### 5.1 Technologies

| Technology | Where | Role | Why it was chosen |
| --- | --- | --- | --- |
| HTML5 | `index.html` | Page shell: top bar, navigation rail, `<main>` view container, footer | Minimal shell; each view renders into one container |
| CSS3 (custom properties, grid, flexbox, media queries, `color-mix`) | `css/style.css` (\~500 lines) | Design system, layout, responsive breakpoints, animations | One stylesheet with design tokens; no preprocessor needed |
| JavaScript (ES2022 modules, no framework) | `js/` (15 modules, \~1,600 lines excluding generated map data) | Parsing, scoring, rendering, interaction | Runs anywhere with no build step; the app is small enough not to need a framework |
| SVG (generated as strings) | `js/charts.js` | Maps, radar, heatmap, scatter, dial, bars | Crisp at any size, styleable with CSS, and each mark can carry tooltip and click data |
| Canvas 2D API | `js/app.js` | Animated starfield background | Hundreds of points redraw cheaply; decorative only |
| Fetch API | `js/data.js` | Loads `data/terratwin.csv` | Standard browser API |
| File API (`File.text()`) | `js/app.js`, Method view | Reads a user-supplied CSV locally | Lets users swap datasets without uploading anything |
| Clipboard API (with `execCommand` fallback) | `js/util.js` | "Copy ranking (CSV)" and "Copy brief" | The hosting frame blocks file downloads, so copying is the export path |
| `localStorage` | `js/util.js` | Remembers target, candidate, profile, weights, control toggle | Light per-viewer convenience, wrapped in try/catch |
| Google Fonts: Instrument Serif, IBM Plex Sans, IBM Plex Mono | `index.html` | Typography | Distinctive editorial-scientific look; system fallbacks if blocked |
| Natural Earth 1:110m land (via npm `world-atlas`) | build time | Earth coastline geometry | Public-domain, small, standard |
| Node.js + npm `topojson-client`, `d3-geo` | build time only | Convert TopoJSON to one pre-projected SVG path with antimeridian clipping | Done once; nothing ships to the browser except the path string |
| Python `http.server`, Playwright + headless Google Chrome | testing only | Local serving, screenshots at two viewports, scripted interaction tests, console-error checks | Automated end-to-end verification |
| claude.ai artifact hosting (multi-file) | deployment | Serves the 18 site files at a private URL | Static hosting with relative file paths |

### 5.2 Architecture

&#91;embedded content: TerraSync module architecture · dashed = build-time only\]

The shell owns state and routing. Views read and write that state and call the engine. The engine depends only on parsed records, and charts depend only on the data handed to them. There is no backend: "frontend vs backend" here means presentation (views, charts) vs domain logic (data, engine), both in the browser.

### 5.3 Data flow at runtime

1. `index.html` loads `js/app.js` as a module. `app.js` starts the starfield and clock, then calls `loadDefaultDataset()`.
2. `data.js` fetches the CSV, `csv.js` splits it into header and records, and `buildDataset()` types every cell and returns `{ sites, quality }`.
3. `ctx.useDataset()` builds an `Engine`, which precomputes numeric ranges and splits sites into Earth candidates and non-Earth targets.
4. On every `hashchange`, `renderRoute()` calls the matching view's `render(root, ctx)`. The view asks the engine for `rank()`, `compare()` or `matrix()` results and turns them into HTML/SVG strings.
5. Clicks anywhere are caught by one delegated listener that reads `data-action` attributes (`select-site`, `open-pair`, `open-site`, `pick-target`, `go`). The listener updates `ctx.state`, saves it to `localStorage` and re-renders.
6. Loading a new CSV repeats steps 2–4 with the user's file and refreshes the status bar.

If the CSV cannot be fetched, the boot screen is replaced by an error panel with a "Load CSV" button. If a view throws, the error is caught and shown with a link back to Mission instead of a blank page.

## 6. Implementation Details

The code is split so that domain logic (parsing, scoring) knows nothing about the page, and rendering knows nothing about how scores are computed. The excerpts below are taken from the source, shortened only where marked.

### 6.1 Modules and responsibilities

| File | Responsibility | Key exports |
| --- | --- | --- |
| `js/csv.js` | RFC 4180 CSV parsing: quoted fields, escaped quotes, CRLF, BOM | `parseCSV(text)` |
| `js/data.js` | 68-field dictionary (type, label, unit, group, valid range); typing; validation; quality report; display formatting | `FIELDS`, `buildDataset()`, `loadDefaultDataset()`, `formatValue()` |
| `js/engine.js` | Dimensions, feature weights, mission profiles, similarity functions, ranking, Earth's-limits calculation, result cache | `DIMENSIONS`, `PROFILES`, `Engine`, `scoreBand()` |
| `js/charts.js` | SVG generators for maps, radar, heatmap, scatter, dial, mini-bars | `siteMap()`, `radar()`, `heatmap()`, `scatter()`, `dial()`, `miniBars()` |
| `js/earth-land.js` | Generated Natural Earth coastline path (\~53 KB) | `EARTH_LAND_PATH` |
| `js/util.js` | Escaping `html` template tag, tooltip, clipboard, colour ramp, coordinates, `localStorage` wrapper | `html`, `raw`, `tip()`, `copyText()`, `rampColor()`, `store` |
| `js/app.js` | Shared context and state, hash router, delegated events, boot and error handling, starfield, clock | `ctx` |
| `js/views/*.js` | One module per page, each exporting `render(root, ctx)`; `common.js` holds shared pieces (bands, selectors, profile chips, exploration-use text, data notice) | `render` |

### 6.2 Typing and validation

Every cell passes through one function driven by the field dictionary. Invalid values become `null` with a logged reason, never a guess:

```javascript
function coerce(raw, spec) {
  const s = (raw ?? '').trim();
  if (s === '' || /^(na|n\/a|nan|null|none)$/i.test(s)) return { value: null, blank: true };
  switch (spec.type) {
    case 'num': {
      const n = Number(s);
      if (!Number.isFinite(n)) return { value: null, error: `"${s}" is not a number` };
      if (spec.range && (n < spec.range[0] || n > spec.range[1]))
        return { value: null, error: `${n} outside valid range [${spec.range[0]}, ${spec.range[1]}]` };
      return { value: n };
    }
    case 'bool': { /* true/false/yes/no/1/0, else error */ }
    case 'list': return { value: s.split('|').map(x => x.trim()).filter(Boolean) };
    default:     return { value: s };
  }
}
```

Example from the dataset. Row EA-001 has `geology.minerals = gypsum|anhydrite|halite|nitratine|perchlorate|plagioclase|quartz`, which becomes a 7-item array. `environment.diurnal_range_c` is blank, so it becomes `null`. Because it is blank in all 30 rows, the quality report lists it under "Columns with no values (ignored)". Longitudes above 180 would be wrapped to the −180…180 range for mapping.

This was tested with a deliberately broken file (30 original rows plus a Moon row with `terrain.slope_mean_deg = abc`, a duplicate `EA-001` and a two-field row). The report showed 33 rows read, 31 accepted, 2 rejected, 1 cell issue, and the Moon row appeared as a new target.

### 6.3 Dimensions and feature weights

| Dimension | Features (weight within the dimension) |
| --- | --- |
| Geology & minerals | mineral groups 0.5, minerals 0.3, rock types 0.2 (all Jaccard) |
| Terrain & topography | terrain class 0.25, mean slope 0.2, max slope 0.1, roughness 0.2, crater density 0.15 (log), impact structure 0.1 |
| Thermal & light | mean temperature 0.3, min temperature 0.25, max temperature 0.15, surface irradiance 0.15, UV index 0.15 |
| Dust & wind | dust activity 0.3, dust storms/yr 0.2, mean wind 0.15, max gust 0.15, erosion indicators 0.2 (terms) |
| Water & ice | water availability 0.2, surface ice 0.15, subsurface ice 0.2, hydrated minerals present 0.1, hydrated mineral types 0.15, regolith water-equivalent 0.2 (log) |
| Habitability & biosignatures | vegetation cover 0.3, liquid precipitation 0.3 (log), biosignature preservation 0.4 |
| Caves & subsurface | lava tube present 0.6, cave present 0.4 (only when the target has either) |
| Processes & themes | analog tags 0.6, geological features 0.4 (terms) |
| Surface operations | trafficability 0.6, landing suitability 0.4 |

These weights are design choices made for this prototype, not values taken from the literature. Each dimension's weights sum to 1.0.

### 6.4 Feature similarity

```javascript
featureSim(f, a, b) {
  const va = a[f.key], vb = b[f.key];
  if (va == null || vb == null) return null;          // missing → skipped, not zero
  switch (f.kind) {
    case 'num': {
      const span = this.spans[f.key];                    // max − min over all records (log10(x+1) if f.log)
      if (!span) return null;
      return Math.max(0, 1 - Math.abs(transform(f, va) - transform(f, vb)) / span);
    }
    case 'bool':  return va === vb ? 1 : 0;
    case 'set':   return jaccard(new Set(va), new Set(vb));
    case 'words': return 0.5 * jaccard(new Set(va), new Set(vb)) + 0.5 * jaccard(words(va), words(vb));
    case 'class': {
      if (va === vb) return 1;
      const secA = a['terrain.secondary_classes'] || [], secB = b['terrain.secondary_classes'] || [];
      if (secA.includes(vb) || secB.includes(va)) return 0.6;
      return secA.some(x => secB.includes(x)) ? 0.3 : 0;
    }
  }
}
```

`words()` splits items on spaces, underscores and hyphens, drops words shorter than three letters and a short stop list, and removes a trailing "s". So `aeolian_erosion` and `aeolian sand transport` share the root "aeolian".

Worked example: mean temperature for Yungay (EA-001, 16.5 °C) vs Meridiani Planum (MA-006, −60 °C). The dataset range is −105 to 34.5 °C (139.5 °C), so similarity = 1 − 76.5 / 139.5 = 0.45.

### 6.5 Dimension aggregation and the result object

```javascript
const dims = DIMENSIONS.map(d => {
  if (d.onlyIfTarget && !d.onlyIfTarget(b))
    return { key: d.key, score: null, coverage: 0, na: 'Target has no recorded caves or lava tubes', features: [] };
  let num = 0, den = 0, possible = 0;
  const features = d.features.map(f => {
    possible += f.w;
    const sim = this.featureSim(f, a, b);
    if (sim != null) { num += sim * f.w; den += f.w; }
    return { key: f.key, sim, a: a[f.key], b: b[f.key] };
  });
  return { key: d.key, score: den ? num / den : null, coverage: den / possible, features };
});
// overall: weighted mean over dimensions with a score, using profile/slider weights
```

`compare()` returns the score, the nine dimension objects, overall coverage, `strengths` (fields ≥ 0.75), `gaps` (fields ≤ 0.35) and `limits`. Results are cached per (candidate, target, weights) key, so moving between views does not recompute pairs. The full 16 × 14 matrix is 224 comparisons and computes instantly.

### 6.6 Earth's limits

`limits()` reports three ratios and never feeds them into the score. Pressure and radiation come from the CSV. Gravity uses reference constants (9.81, 3.72 and 1.62 m/s²), and the UI labels them "Reference constant (not in CSV)". A target with zero pressure, such as a Moon row, is described as a vacuum.

### 6.7 Rendering and updates

Views build markup with an escaping tagged template, so CSV text can never inject HTML:

```javascript
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) {
      const v = vals[i];
      if (v == null || v === false) return;
      if (Array.isArray(v)) out += v.map(x => (x && x.__raw ? x.s : esc(x))).join('');
      else out += v && v.__raw ? v.s : esc(v);
    }
  });
  return { __raw: true, s: out };
}
```

Charts are functions from data to an SVG string. A map marker carries its tooltip and action as attributes:

```javascript
return `<g class="mk-g" tabindex="0" role="button" data-action="select-site" data-id="${esc(s.id)}"
          data-tip="${attrTip(tipHtml)}">${ring}<circle … class="hit"/>${shape}${rankLabel}${nameLabel}</g>`;
```

One delegated listener in `app.js` handles every chart and list. Hover or focus on any `[data-tip]` shows the shared tooltip, and click or Enter on any `[data-action]` dispatches:

```javascript
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el) { e.preventDefault(); act(el); }   // select-site, open-pair, open-site, pick-target, go
});
```

Update strategy: a state change re-renders the current view (`ctx.set(patch)` → `renderRoute()`). The Finder is the exception. Its weight sliders update state without a full re-render and redraw only the results list and profile chips, so the slider keeps focus while dragging.

### 6.8 Other custom logic

- **Heatmap scaling:** cell colour = `rampColor((v − min) / (max − min))` with min/max rounded to 0.05 from the visible values, and a printed legend range.
- **Scatter ticks:** "nice" steps (1, 2, 2.5, 5, 10 × 10ⁿ) computed from the data range. Log axes are refused if any plotted value is negative.
- **Coastline generation:** `d3-geo`'s equirectangular projection (scale 180/π, translate \[180, 90\]) clips rings at the antimeridian. An earlier hand-written projection drew stray horizontal lines across Russia and Antarctica.
- **Overlooked analogs:** Earth sites with maturity `emerging` or `under_studied`, ranked by their best score against any target.
- **Control self-check:** passes if the control's best rank across all targets is below half the number of Earth sites.

## 7. Results and Insights

On the bundled synthetic dataset, every one of the 14 Mars targets has an Earth analog rated Useful or better except Melas Chasma (49). The negative control never scores above 38. All figures below were produced by running the TerraSync engine on the bundled CSV. They show what the method finds in that data and are not scientific claims about the real sites.

### 7.1 Best Earth twin for each target

&#91;embedded content: terratwin\_synthetic\_dataset.csv · engine output, balanced profile · 14 Mars targets\]

The top four pairs pass the Strong threshold (60). Each is driven by one dominant match: an accessible lava tube for cave skylights, wind-carved yardangs for the Medusae Fossae Formation, and hyperarid sulfate soils for Meridiani and Utopia. The weakest best match is the steep canyon of Melas Chasma. No Earth record combines its 15° mean slope, sulfate layers and very low trafficability.

### 7.2 Overall distribution

| Measure | Value |
| --- | --- |
| Real Earth–Mars pairs scored | 210 (15 Earth × 14 Mars) |
| Score range | 32.4 – 64.0 |
| Median score | 48.2 |
| Strong / Useful / Partial / Weak | 4 / 73 / 110 / 23 pairs |
| Negative control (Amazon) score range | 30.2 – 38.4 across all 14 targets |

The control's best score (38.4) is below the median real pair and in the Weak band for every target, so the scoring separates analogs from a non-analog.

### 7.3 Which aspects Earth reproduces

&#91;embedded content: terratwin\_synthetic\_dataset.csv · engine output, 210 real Earth–Mars pairs\]

This is the most useful structural insight from the data:

- **High: habitability (71), water (68), operations (67).** Most Earth sites in the file are deserts or polar sites with no vegetation, little rain and few hydrated minerals, as Mars is. The habitability score here measures shared barrenness and preservation potential, not life.
- **Middle: dust and wind (60), terrain (51), temperature and light (47).** Earth sites are far warmer than Mars. Even the coldest Earth record (University Valley, mean −23 °C) is 27–82 °C warmer than the Mars targets.
- **Low: geology (21), caves (7), processes (2).** Exact mineral lists rarely overlap (e.g. Earth's "dolomite, calcite" vs Mars's "olivine, Fe/Mg smectite"), and only one Earth site has a lava tube. The analog-tag vocabularies of Earth and Mars rows barely overlap, so the processes dimension rarely scores above zero. Section 8 treats this as a limitation of the tag field, not a finding about the planets.

### 7.4 Mission profile changes the answer

| Target | Profile | Top Earth analog (score) | Observation |
| --- | --- | --- | --- |
| Arsia Mons cave skylights | Subsurface habitat | La Corona lava tube (68) | Next best is Holuhraun at 35: only one Earth record has a cave or lava tube |
| Elysium Planitia (InSight) | Rover & landing ops | Yungay, Atacama (69) | Flat, trafficable plains dominate when mobility is weighted |
| Arcadia Planitia ice | Resource prospecting | University Valley, McMurdo (60) | Ice-cemented ground: about 12 points ahead of Haughton and Lonar (48) |
| Meridiani Planum | Field geology training | Yungay, Atacama (47) | Rio Tinto (44), the acid-sulfate/jarosite analog named in its own summary, enters the top three. Under the Balanced profile the top three are Yungay, Badwater and Kharga |
| Jezero Crater | Life detection | Yungay, Atacama (52) | Scores bunch closely (51–52 for the top three), so no single life-detection analog stands out in this data |

### 7.5 A worked pair: La Corona lava tube → Arsia Mons cave skylights

| Dimension | Score | Why (from the record) |
| --- | --- | --- |
| Caves & subsurface | 100 | Both have a cave and a lava tube |
| Water & ice | 91 | Both lack hydrated minerals; similar ice probabilities and regolith water content |
| Terrain & topography | 81 | Both classed volcanic with "cave" secondary class; max slope 70° vs 80° |
| Habitability | 73 | Vegetation 8% vs 0%; biosignature preservation 0.6 vs 0.5 |
| Dust & wind | 73 | Dust activity 0.30 vs 0.35; same max gust (25 m/s) |
| Surface operations | 57 | Trafficability 0.6 vs 0.3; landing suitability exists only for Mars (60% coverage) |
| Geology & minerals | 42 | Shared basaltic minerals (olivine, pyroxene, plagioclase); calcite and basalt glass only on Earth, nanophase iron oxide only on Mars |
| Thermal & light | 36 | Mean 20 °C vs −80 °C |
| Processes & themes | 23 | Shared tag "lava\_tube"; other tags differ |

Overall 64/100, rank 1 of 16. Earth's limits for this pair: surface pressure 100.7 kPa vs 0.30 kPa (339×), radiation 0.0012 vs 0.27 mGy/day (225× more on Mars), gravity 2.6×. The tool suggests using it to rehearse cave mapping, robotic access, communications dead-zones and shielding concepts, but not for thermal or radiation testing.

### 7.6 Overlooked and versatile analogs

Four of the seven Earth sites marked `under_studied` or `emerging` reach a score of 50 or more against seven or more Mars targets: Dalangtan Playa (8 targets), Kharga Depression, Kamil Crater and La Corona (7 each). Kharga is the best match for Medusae Fossae (63) and Kamil for Elysium Planitia's runner-up slot (56). This matches the challenge's call to look beyond well-known analogs. Among well-studied sites, University Valley and Mauna Kea are the most versatile (8 targets each).

### 7.7 What users can learn and how the objectives are met

A user can see, for any Mars site, which Earth places resemble it, on which dimensions, by how much, and where Earth falls short. The tool meets the brief's objectives (Section 1.2) as a working, data-driven map and ranking tool, with the dimension-by-dimension explanation the brief asked for. The objective it cannot yet meet is producing real findings, because the input is synthetic (Section 8).

## 8. Challenges and Limitations

The biggest limitation is the data. Every record is synthetic, so TerraSync shows a working method rather than real analog findings. The other limitations are design choices in the scoring or gaps in the dataset's fields.

### 8.1 Synthetic data

| Aspect | Bundled dataset | Real-world data would be |
| --- | --- | --- |
| Origin | Hand-assembled values, every row flagged `is_synthetic = true` | Derived from missions and surveys (e.g. orbital spectrometers, DEMs, climate reanalysis) |
| Values | Plausible single numbers per site, broadly consistent with published descriptions | Measured distributions with uncertainty and spatial variation |
| Pressure | "barometric approximation from elevation" for all 30 rows | Measured or modeled surface pressure |
| Indices (roughness, dust activity, trafficability…) | 0–1 scores with no stated derivation | Computed from defined algorithms on raw data |
| Provenance | No per-field source citations | Traceable to datasets and versions |

The website never hides this. Every view shows a synthetic-data notice, the status bar shows a SYNTHETIC flag, and the copied field brief ends with "SYNTHETIC demonstration data, not observations". The data loader is format-driven, so measured data in the same columns can replace the file without code changes.

### 8.2 Dataset gaps

- **No lunar records.** The challenge covers Moon bases, but the CSV has only Earth (16) and Mars (14) rows. Moon support exists and was tested with an added row, but no lunar results can be reported.
- **Planet-specific fields.** NDVI, soil moisture, extremophile fields and access difficulty exist only for Earth. Landing suitability and past habitability exist only for Mars. They are displayed but cannot contribute to a pair score, so the operations dimension uses trafficability alone (60% coverage).
- **One empty column.** `environment.diurnal_range_c` is blank in all rows and is ignored.
- **Sparse caves.** Only one Earth site (La Corona) and one Mars site (Arsia Mons) record caves, so the subsurface dimension is decisive for that one target and n/a for all others.
- **Small sample.** With 15 candidates per target, rankings are sensitive to individual values. The top three often differ by one or two points (e.g. Gale: 56.6 vs 56.5).

### 8.3 Method limitations

- **Exact-term matching.** Minerals and tags are compared as exact strings, with a root-word split for tags. "Jarosite" matches "jarosite", but "basalt\_glass" and "nanophase\_iron\_oxide" do not relate to broader mineral families. Earth and Mars tag vocabularies barely overlap, which explains the near-zero processes scores (Section 7.3).
- **Hand-set weights.** Feature weights, profile weights, partial credit for terrain classes and rating-band thresholds are prototype choices, not calibrated against expert judgments.
- **Range-based normalization.** Similarity depends on the spread of the loaded data. Adding or removing extreme records changes every numeric similarity.
- **One point per site.** Each site is a single representative record, while real analogs vary across a valley or crater.
- **Thermal and radiation are partly structural.** Earth cannot match Mars temperature or radiation, so these dimensions compress all scores toward the middle. The tool reports pressure, radiation and gravity separately for that reason.

### 8.4 Technical challenges met during development

| Challenge | Resolution |
| --- | --- |
| Coastline polygons crossing the antimeridian drew lines across the map | Re-projected with `d3-geo` at build time, which clips at ±180° |
| Hosting frame blocks file downloads | Export via the Clipboard API with an `execCommand` fallback ("Copy ranking", "Copy brief") |
| Weight sliders lost focus when the whole view re-rendered | Slider input redraws only the results list and profile chips |
| Heatmap colours were washed out because scores cluster at 30–65 | Colour ramp stretched to the observed range, with the range printed in the legend |
| A CSS selector also matched Mars map markers and hid them | Selector removed after visual testing |
| Map labels at the right edge were cut off | Labels flip to the left of markers east of 105°E |
| Cave-less pairs gained credit for "both have no cave" | Subsurface scored only when the target has a cave or lava tube |
| No server-side processing | All parsing and scoring done client-side; 224 comparisons are cached and compute instantly |

### 8.5 Suggested improvements

- Replace synthetic values with measured ones and add a `source` column per field group.
- Map minerals to families (e.g. olivine, pyroxene → mafic silicates) and use a shared, controlled vocabulary for tags so processes can be compared fairly.
- Calibrate weights with input from analog-field scientists, or learn them from expert-rated pairs.
- Show score uncertainty (e.g. by perturbing inputs) so near-ties are not read as rankings.
- Add Mars and Moon basemaps (e.g. shaded relief) so target positions have context.

## 9. Future Enhancements

The next step is to replace the synthetic records with measured data. The engine and views already accept any CSV in the same format, so this needs no code changes. Further steps can then grow TerraSync from a ranking of predefined sites into a global search for new analogs.

### 9.1 Additional data sources (proposed, not yet integrated)

| Body | Candidate open datasets | Fields they could fill |
| --- | --- | --- |
| Earth | SRTM / Copernicus DEM; MODIS (land-surface temperature, NDVI); SMAP (soil moisture); ASTER (surface minerals); MERRA-2 (wind, aerosols) | Elevation, slope, roughness; temperature; vegetation; moisture; mineral indices; dust |
| Mars | MOLA and HRSC DEMs; CRISM and OMEGA mineral maps; THEMIS thermal inertia; TES; Mars Climate Database | Topography and slopes; hydrated minerals; surface materials; temperature, pressure, dust |
| Moon | LOLA topography; LRO Diviner temperatures; LRO LAMP and LEND (hydrogen/ice); Mini-RF; Kaguya and Chandrayaan-1 M3 mineral data | Slopes, illumination, ice probability, regolith composition for south-pole base candidates |

### 9.2 Analytical capabilities

- **Grid-based discovery:** score every Earth grid cell, not just predefined sites, to find previously unrecognized analogs. This is the brief's "systematically searching Earth" idea.
- **Uncertainty and sensitivity:** Monte Carlo perturbation of inputs and weights to show confidence bands and how stable each ranking is.
- **Learned weights:** fit feature or dimension weights to expert-rated analog pairs, or train a metric-learning model on spectra and terrain patches.
- **Mineral-family ontology:** compare minerals by family and formation environment, not only exact names.
- **Process analogs:** time-series data (dust storms, freeze–thaw cycles, sublimation) to compare active processes, not just static conditions.
- **Lunar profiles:** Moon-specific dimensions such as illumination at the poles, permanently shadowed regions and regolith geotechnics.

### 9.3 Visualizations and interface

- Mars and Moon shaded-relief basemaps and zoomable maps with satellite imagery.
- A global Earth "similarity surface" heatmap for a chosen target.
- Side-by-side image panels (orbital view of both sites).
- Sortable data tables and downloadable reports (PDF, CSV) where hosting allows downloads.
- Shareable deep links that encode target, candidate and weights.
- Localization and a guided tour for public outreach.

### 9.4 Toward a larger system

To serve many users and real data volumes, the client-only design could gain a small backend: a data service that ingests and versions remote-sensing products, a tiling or raster service for grid-based scoring, and an API exposing `compare` and `rank`. The current engine is self-contained JavaScript with no DOM dependency, so it could run unchanged in Node.js on such a server or in a Web Worker for larger client-side datasets.

## 10. Conclusion

TerraSync turns the challenge's question, "which places on Earth can teach us about the Moon and Mars?", into a transparent, interactive tool. It scores 224 Earth–Mars pairs across nine dimensions and explains each result field by field. It separates what Earth can reproduce from what it cannot.

Main achievements:

- **A complete working website.** Seven linked views with maps, rankings, a radar, a heatmap and a scatter plot, all drawn from the CSV with no runtime libraries. Tested at desktop and phone sizes with no console errors.
- **An explainable method.** Every score traces to named fields and values. Missing data lowers coverage instead of inventing values, and Earth's physical limits are reported, not hidden.
- **Built-in validation.** A negative control stays in the Weak band (≤ 38) for every target, while every target has at least a Partial match (49–64).
- **Actionable output.** Mission profiles, "overlooked analog" highlighting (e.g. Kharga Depression for Medusae Fossae), exploration-use suggestions and copyable field briefs.
- **Honest about its data.** The synthetic status of the dataset is shown everywhere, and the tool is ready for measured data, including lunar targets, without code changes.

With real NASA and partner-agency data in place of the synthetic records, the same tool could help mission planners choose and justify field-test sites. It could also point scientists to under-used analogs, and show students why no place on Earth is quite like another world.
