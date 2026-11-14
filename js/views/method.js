// 08 · Method & data: how scores are computed, data-quality report, limitations, and loading a new CSV.
import { html, render, pct, $ } from '../util.js';
import { DIMENSIONS, PROFILES, GRAVITY } from '../engine.js';
import { FIELDS, GROUP_ORDER } from '../data.js';
import { sectionHead, pageHead } from './common.js';

const KIND = { num: 'distance on a fixed scale', dist: 'distribution overlap', set: 'set overlap (Jaccard)', words: 'term overlap', bool: 'match / no match', class: 'class match (+ secondary)' };

export function render_(root, ctx) {
  const q = ctx.data.quality;
  const groupFill = GROUP_ORDER.map(g => {
    const keys = Object.keys(FIELDS).filter(k => FIELDS[k].group === g);
    return { g, fill: keys.reduce((a, k) => a + (q.fill[k] || 0), 0) / keys.length, n: keys.length };
  });

  render(root, html`
  ${pageHead('About', 'About the data', 'Where every number on this site comes from, in plain words.')}

  <div class="data-cards">
    <article class="panel data-card mars">
      <p class="eyebrow"><span class="code">01</span>Mars · real data</p>
      <h2 class="block-title">HiRISE terrain models</h2>
      <p>A camera on NASA’s Mars Reconnaissance Orbiter photographed the same ground from two angles. From the pair, scientists built 3D height maps. We use two patches near Jezero crater for height, steepness and shadows.</p>
      <button class="btn small" data-action="go" data-route="terrain">Mars surface →</button>
    </article>
    <article class="panel data-card earth">
      <p class="eyebrow"><span class="code">02</span>Earth · real data</p>
      <h2 class="block-title">ESA WorldCover 2021</h2>
      <p>European Sentinel satellites sorted every 10 × 10 m of land into 11 types: trees, grass, bare ground, water and so on. We use three dry regions: the Canary Islands coast, Death Valley and the Atacama Desert.</p>
      <button class="btn small" data-action="go" data-route="earth">Earth land →</button>
    </article>
    <article class="panel data-card demo">
      <p class="eyebrow"><span class="code">03</span>Demo values</p>
      <h2 class="block-title">Placeholder catalogue</h2>
      <p>Facts like rock types, temperatures and dust for ${ctx.earth.length} Earth and ${ctx.targets.length} Mars places are placeholders for now. They show how the method works and are marked <span class="pv pv-synthetic">S</span>. Real values are marked <span class="pv pv-measured">M</span>.</p>
    </article>
  </div>

  <section class="panel">
    <header class="block-head"><h2 class="block-title">How the match score works</h2></header>
    <ol class="how-steps">
      <li><b>Line up the facts</b><p>Both places are described with the same facts: rocks, slopes, temperature, wind and dust, water and ice, signs of life, caves, and how easy it is to work there.</p></li>
      <li><b>Compare each fact</b><p>Each fact gets a similarity from 0 to 100. Facts that only one place has are skipped, never guessed.</p></li>
      <li><b>Add it up</b><p>The facts are grouped into nine topics and averaged into one score. “What matters most” changes how much each topic counts.</p></li>
    </ol>
    <p class="small dim">Rating: <span class="band band-strong">Strong 60+</span> <span class="band band-good">Useful 50+</span> <span class="band band-partial">Partial 40+</span> <span class="band band-weak">Weak under 40</span>. Air pressure, radiation and gravity are always shown as differences, because no place on Earth can copy them.</p>
  </section>

  <details class="panel tech">
  <summary>Technical details: method, data quality and loading your own data</summary>
  <div class="grid-2">
    <section class="panel prose">
      ${sectionHead('1', 'Scoring pipeline')}
      <ol class="steps">
        <li><b>Parse and validate.</b> Each row is typed against a field dictionary. Blank, non-numeric or out-of-range cells become <i>not recorded</i> and are listed in the quality report. Values are never filled in.</li>
        <li><b>Label every field.</b> Each filled field of each record is marked measured or synthetic. A record is "mixed" when it has both.</li>
        <li><b>Feature similarity (0–1).</b> Numeric fields: <span class="mono">1 − |a − b| / (hi − lo)</span>, where <span class="mono">lo</span> and <span class="mono">hi</span> are a fixed physical scale for that field (table 4). The scale does not depend on which records are loaded, so adding a site never changes another pair's score. Heavy-tailed fields are compared on a log scale. Slopes are compared as whole distributions: the score is the share of the two slope histograms that coincides. Lists (minerals, rock types) use Jaccard overlap. Tags and features use overlap of exact terms and their root words.</li>
        <li><b>Dimension score.</b> A weighted mean of the features that <i>both</i> sites report. Coverage records how much of the dimension was actually available. Caves and subsurface are scored only when the target has a cave or lava tube. If a site has no slope distribution, its mean and maximum slope stand in for it.</li>
        <li><b>Analog score.</b> A weighted mean of the dimension scores, using the mission profile's weights or your own. Dimensions with no data drop out instead of counting as zero. A pair that shares fewer than a third of the dimensions is shown as "Limited data" and is not rated.</li>
        <li><b>Explain.</b> Fields at 75 or above are reported as where the analogy holds, fields at 35 or below as where it breaks. Pressure, radiation and gravity are shown separately, because Earth cannot reproduce them.</li>
      </ol>
      <p class="dim">Rating bands: <span class="band band-strong">Strong ≥ 60</span> <span class="band band-good">Useful ≥ 50</span> <span class="band band-partial">Partial ≥ 40</span> <span class="band band-weak">Weak &lt; 40</span></p>
    </section>

    <section class="panel">
      ${sectionHead('2', 'Data quality report', `Source file: ${q.source}`)}
      <dl class="qgrid">
        <div><dt>Rows read</dt><dd class="mono">${q.rows}</dd></div>
        <div><dt>Accepted</dt><dd class="mono">${q.accepted}</dd></div>
        <div><dt>Rejected</dt><dd class="mono">${q.rejected.length}</dd></div>
        <div><dt>Cell issues</dt><dd class="mono">${q.issues.length}</dd></div>
        <div><dt>By body</dt><dd class="mono">${Object.entries(q.bodies).map(([b, n]) => `${b} ${n}`).join(' · ')}</dd></div>
        <div><dt>Records</dt><dd class="mono">${['measured', 'mixed', 'synthetic'].filter(k => q.records[k]).map(k => `${q.records[k]} ${k}`).join(' · ')}</dd></div>
        <div><dt>Measured values</dt><dd class="mono">${q.values.measured.toLocaleString('en-US')}</dd></div>
        <div><dt>Synthetic values</dt><dd class="mono">${q.values.synthetic.toLocaleString('en-US')}</dd></div>
        <div><dt>Files</dt><dd class="mono">${q.files.map(f => `${f.name} (${f.accepted})`).join(' · ')}</dd></div>
      </dl>
      <h4 class="sub">Measured and synthetic values by field group</h4>
      <ul class="fill prov">${GROUP_ORDER.filter(g => q.byGroup[g]).map(g => { const v = q.byGroup[g], t = v.measured + v.synthetic; return html`<li><span>${g}</span><span class="fill-bar split" data-tip="${`<b>${g}</b><span class="mono">${v.measured} measured · ${v.synthetic} synthetic</span>`}"><i class="m" style="width:${(v.measured / t * 100).toFixed(1)}%"></i></span><span class="mono">${v.measured} M · ${v.synthetic} S</span></li>`; })}</ul>
      <h4 class="sub">Field completeness by group</h4>
      <ul class="fill">${groupFill.map(f => html`<li><span>${f.g}</span><span class="fill-bar"><i style="width:${(f.fill * 100).toFixed(1)}%"></i></span><span class="mono">${pct(f.fill)}%</span></li>`)}</ul>
      ${q.emptyColumns.length ? html`<p class="small"><b>Columns with no values (ignored):</b> <span class="mono">${q.emptyColumns.join(', ')}</span></p>` : ''}
      ${q.unknownColumns.length ? html`<p class="small"><b>Unrecognised columns (kept out of scoring):</b> <span class="mono">${q.unknownColumns.join(', ')}</span></p>` : ''}
      ${q.missingColumns.length ? html`<p class="small"><b>Expected columns not in file:</b> <span class="mono">${q.missingColumns.join(', ')}</span></p>` : ''}
      ${q.rejected.length ? html`<details><summary>Rejected rows (${q.rejected.length})</summary><ul class="small mono">${q.rejected.map(r => html`<li>line ${r.line}: ${r.reason}</li>`)}</ul></details>` : ''}
      ${q.issues.length ? html`<details><summary>Cell issues (${q.issues.length})</summary><ul class="small mono">${q.issues.slice(0, 200).map(i => html`<li>line ${i.line} · ${i.id} · ${i.field}: ${i.msg}</li>`)}</ul></details>` : html`<p class="small dim">No invalid cells found.</p>`}
      <p class="small dim">Several fields exist for only one world. NDVI, soil moisture and access difficulty are Earth-only, and landing suitability and past habitability are target-only. They show in records but cannot contribute to a pair score.</p>
    </section>
  </div>

  <section class="panel">
    ${sectionHead('3', 'Dimensions and features', 'The fields each dimension uses and their weights within it.')}
    <div class="table-wrap"><table class="data">
      <thead><tr><th>Dimension</th><th>Features (weight · comparison)</th></tr></thead>
      <tbody>${DIMENSIONS.map(d => html`<tr><td><b>${d.label}</b><br><span class="dim small">${d.blurb}</span></td>
        <td>${d.features.map(f => html`<span class="feat">${FIELDS[f.key]?.label || f.key} <span class="mono dim">${f.w.toFixed(2)} · ${KIND[f.kind]}${f.log ? ', log' : ''}${f.fallbackFor ? ' · only when no distribution' : ''}</span></span>`)}</td></tr>`)}</tbody>
    </table></div>
  </section>

  <section class="panel">
    ${sectionHead('4', 'Fixed scoring scales', 'Every numeric field is scored against the same physical range, whatever is loaded. Values outside a range are clamped to it.')}
    <div class="table-wrap"><table class="data compact">
      <thead><tr><th>Field</th><th>Dimension</th><th class="num">From</th><th class="num">To</th><th>Scale</th><th>Why this range</th></tr></thead>
      <tbody>${DIMENSIONS.flatMap(d => d.features.filter(f => f.kind === 'num').map(f => html`<tr><td>${FIELDS[f.key]?.label || f.key}</td><td class="dim">${d.label}</td><td class="num mono">${f.scale[0].toLocaleString('en-US')}</td><td class="num mono">${f.scale[1].toLocaleString('en-US')}${FIELDS[f.key]?.unit ? ' ' + FIELDS[f.key].unit : ''}</td><td class="mono dim">${f.log ? 'log' : 'linear'}</td><td class="dim">${f.why}</td></tr>`))}
        <tr><td>Slope distribution</td><td class="dim">Terrain &amp; topography</td><td class="num mono">0</td><td class="num mono">90 °</td><td class="mono dim">1° bins</td><td class="dim">overlap of two histograms is bounded 0–1 by construction</td></tr></tbody>
    </table></div>
  </section>

  <section class="panel">
    ${sectionHead('5', 'Mission profiles', 'Weight presets for different mission goals. They change emphasis, not the data.')}
    <div class="table-wrap"><table class="data compact profiles">
      <thead><tr><th>Profile</th>${DIMENSIONS.map(d => html`<th class="num" title="${d.label}">${d.short}</th>`)}</tr></thead>
      <tbody>${Object.values(PROFILES).map(p => html`<tr><td><b>${p.label}</b><br><span class="dim small">${p.desc}</span></td>${DIMENSIONS.map(d => html`<td class="num mono" style="--w:${p.w[d.key] / 3}"><span class="wcell">${p.w[d.key].toFixed(1)}</span></td>`)}</tr>`)}</tbody>
    </table></div>
  </section>

  <div class="grid-2">
    <section class="panel prose">
      ${sectionHead('6', 'Limits of an Earth analog')}
      <ul>
        <li><b>Gravity.</b> ${GRAVITY.Earth} m/s² on Earth, against ${GRAVITY.Mars} on Mars and ${GRAVITY.Moon} on the Moon. These are reference constants, not CSV values. Regolith mechanics, dust settling and human movement all differ.</li>
        <li><b>Atmosphere.</b> The pressures in the CSV are barometric approximations. Earth sites sit at roughly 60–103 kPa, Mars sites under 1.2 kPa, and the Moon is effectively a vacuum.</li>
        <li><b>Radiation.</b> Earth's magnetosphere and air keep surface doses about two orders of magnitude below the Mars values in this file.</li>
        <li><b>Scale and averaging.</b> Each record is one representative site. Real analogs vary across a valley or crater, so sub-site data would sharpen the matches.</li>
        <li><b>Synthetic inputs.</b> Measured values: the two HiRISE terrain patches (Mars) and ESA WorldCover land cover (Earth vegetation cover for places inside the three mapped regions). Everything else is a synthetic placeholder, so rankings demonstrate the method until more measured data replace them.</li>
        <li><b>Terrain scale.</b> The measured slopes use a ~60 m baseline on ~30 m cells. Slope depends on baseline, so compare only with terrain processed the same way.</li>
      </ul>
    </section>

    <section class="panel prose">
      ${sectionHead('7', 'Load your own dataset')}
      <p>Swap in measured data, for example from MODIS, SMAP or SRTM for Earth, MOLA, CRISM or THEMIS for Mars, and LOLA or Diviner for the Moon. Use the same column names (dotted headers, <span class="mono">|</span>-separated lists). To mark provenance, set <span class="mono">is_synthetic = false</span> for a fully measured row, or list the measured columns in <span class="mono">measured_fields</span> (for example <span class="mono">terrain.*|geographic.elevation_m</span>) for a mixed row. A slope distribution goes in <span class="mono">terrain.slope_hist_1deg</span> as counts per 1° bin from 0°. Rows with <span class="mono">planet = Moon</span> become lunar targets automatically. The file stays in your browser.</p>
      <label class="btn primary"><input type="file" accept=".csv,text/csv" id="m-file" hidden>Load CSV…</label>
      <button class="btn" id="m-reset">Restore bundled dataset</button>
      <p id="m-msg" class="mono small" role="status"></p>
      <h4 class="sub">Required columns</h4>
      <p class="mono small">id, name, planet, geographic.latitude, geographic.longitude</p>
      <p class="small dim">Every other column is optional. Missing values only lower a pair's coverage.</p>
    </section>
  </div>
  </details>`);

  $('#m-file', root).addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    const msg = $('#m-msg', root);
    msg.textContent = 'Reading ' + f.name + '…';
    try { const ds = await ctx.loadFile(f); $('#m-msg', root).textContent = `Loaded ${ds.quality.accepted} records from ${f.name}.`; }
    catch (err) { msg.textContent = 'Could not load: ' + err.message; }
  });
  $('#m-reset', root).addEventListener('click', async () => {
    const { loadDefaultDataset } = await import('../data.js');
    try { ctx.useDataset(await loadDefaultDataset()); ctx.go('method'); } catch (err) { $('#m-msg', root).textContent = err.message; }
  });
}
export { render_ as render };
