// 07 · Method & data: how scores are computed, data-quality report, limitations, and loading a new CSV.
import { html, render, pct, $ } from '../util.js';
import { DIMENSIONS, PROFILES, GRAVITY } from '../engine.js';
import { FIELDS, GROUP_ORDER } from '../data.js';
import { sectionHead } from './common.js';

const KIND = { num: 'numeric distance', set: 'set overlap (Jaccard)', words: 'term overlap', bool: 'match / no match', class: 'class match (+ secondary)' };

export function render_(root, ctx) {
  const q = ctx.data.quality;
  const groupFill = GROUP_ORDER.map(g => {
    const keys = Object.keys(FIELDS).filter(k => FIELDS[k].group === g);
    return { g, fill: keys.reduce((a, k) => a + (q.fill[k] || 0), 0) / keys.length, n: keys.length };
  });

  render(root, html`
  ${sectionHead('§ METHOD', 'Method & data', 'How TerraTwin turns CSV records into analog scores, and what the scores can and cannot tell you.')}

  <div class="grid-2">
    <section class="panel prose">
      ${sectionHead('1', 'Scoring pipeline')}
      <ol class="steps">
        <li><b>Parse and validate.</b> Each row is typed against a field dictionary. Blank, non-numeric or out-of-range cells become <i>not recorded</i> and are listed in the quality report. Values are never filled in.</li>
        <li><b>Feature similarity (0–1).</b> Numeric fields: <span class="mono">1 − |a − b| / range</span>, where the range comes from all loaded records. Heavy-tailed fields (crater density, rainfall, water content) are compared on a log scale. Lists (minerals, rock types) use Jaccard overlap. Tags and features use overlap of exact terms and their root words.</li>
        <li><b>Dimension score.</b> A weighted mean of the features that <i>both</i> sites report. Coverage records how much of the dimension was actually available. Caves and subsurface are scored only when the target has a cave or lava tube.</li>
        <li><b>Analog score.</b> A weighted mean of the dimension scores, using the mission profile's weights or your own. Dimensions with no data drop out instead of counting as zero.</li>
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
        <div><dt>Synthetic</dt><dd class="mono">${q.synthetic} / ${q.accepted}</dd></div>
      </dl>
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
        <td>${d.features.map(f => html`<span class="feat">${FIELDS[f.key]?.label || f.key} <span class="mono dim">${f.w.toFixed(2)} · ${KIND[f.kind]}${f.log ? ', log' : ''}</span></span>`)}</td></tr>`)}</tbody>
    </table></div>
  </section>

  <section class="panel">
    ${sectionHead('4', 'Mission profiles', 'Weight presets for different mission goals. They change emphasis, not the data.')}
    <div class="table-wrap"><table class="data compact profiles">
      <thead><tr><th>Profile</th>${DIMENSIONS.map(d => html`<th class="num" title="${d.label}">${d.short}</th>`)}</tr></thead>
      <tbody>${Object.values(PROFILES).map(p => html`<tr><td><b>${p.label}</b><br><span class="dim small">${p.desc}</span></td>${DIMENSIONS.map(d => html`<td class="num mono" style="--w:${p.w[d.key] / 3}"><span class="wcell">${p.w[d.key].toFixed(1)}</span></td>`)}</tr>`)}</tbody>
    </table></div>
  </section>

  <div class="grid-2">
    <section class="panel prose">
      ${sectionHead('5', 'Limits of an Earth analog')}
      <ul>
        <li><b>Gravity.</b> ${GRAVITY.Earth} m/s² on Earth, against ${GRAVITY.Mars} on Mars and ${GRAVITY.Moon} on the Moon. These are reference constants, not CSV values. Regolith mechanics, dust settling and human movement all differ.</li>
        <li><b>Atmosphere.</b> The pressures in the CSV are barometric approximations. Earth sites sit at roughly 60–103 kPa, Mars sites under 1.2 kPa, and the Moon is effectively a vacuum.</li>
        <li><b>Radiation.</b> Earth's magnetosphere and air keep surface doses about two orders of magnitude below the Mars values in this file.</li>
        <li><b>Scale and averaging.</b> Each record is one representative site. Real analogs vary across a valley or crater, so sub-site data would sharpen the matches.</li>
        <li><b>Synthetic inputs.</b> Every record in the bundled file is flagged synthetic. Treat rankings as a demonstration of the method until measured data replace them.</li>
      </ul>
    </section>

    <section class="panel prose">
      ${sectionHead('6', 'Load your own dataset')}
      <p>Swap in measured data, for example from MODIS, SMAP or SRTM for Earth, MOLA, CRISM or THEMIS for Mars, and LOLA or Diviner for the Moon. Use the same column names (dotted headers, <span class="mono">|</span>-separated lists). Rows with <span class="mono">planet = Moon</span> become lunar targets automatically. The file stays in your browser.</p>
      <label class="btn primary"><input type="file" accept=".csv,text/csv" id="m-file" hidden>Load CSV…</label>
      <button class="btn" id="m-reset">Restore bundled dataset</button>
      <p id="m-msg" class="mono small" role="status"></p>
      <h4 class="sub">Required columns</h4>
      <p class="mono small">id, name, planet, geographic.latitude, geographic.longitude</p>
      <p class="small dim">Every other column is optional. Missing values only lower a pair's coverage.</p>
    </section>
  </div>`);

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
