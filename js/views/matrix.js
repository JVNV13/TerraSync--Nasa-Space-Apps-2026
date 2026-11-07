// 05 · Analog matrix: every Earth site against every target, overall or per dimension.
import { html, render, raw, pct, rampColor, esc, $ } from '../util.js';
import { heatmap } from '../charts.js';
import { DIMENSIONS } from '../engine.js';
import { sectionHead, shortName, profileChips, bindProfileChips, dataNotice } from './common.js';

const local = { dim: 'overall', sort: 'mean' };

export function render_(root, ctx) {
  const w = ctx.weights();
  const rows0 = ctx.candidates(), cols = ctx.targets;
  const M = ctx.engine.matrix(rows0, cols, w);
  const val = res => (local.dim === 'overall' ? res.score : res.dims.find(d => d.key === local.dim).score);

  const rowStats = rows0.map((r, i) => {
    const vals = M[i].map(val).filter(v => v != null);
    return { r, i, mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : -1, max: vals.length ? Math.max(...vals) : -1 };
  });
  rowStats.sort((a, b) => local.sort === 'name' ? a.r.name.localeCompare(b.r.name) : local.sort === 'max' ? b.max - a.max : b.mean - a.mean);
  const rows = rowStats.map(s => s.r);
  const colBest = cols.map((c, j) => {
    let best = -1, id = null;
    rows0.forEach((r, i) => { const v = val(M[i][j]); if (!r.is_control && v != null && v > best) { best = v; id = r.id; } });
    return id;
  });
  const dimLabel = local.dim === 'overall' ? 'Overall analog score' : DIMENSIONS.find(d => d.key === local.dim).label;

  const allVals = M.flat().map(val).filter(v => v != null);
  const domain = [Math.floor(Math.min(...allVals) * 20) / 20, Math.ceil(Math.max(...allVals) * 20) / 20];
  const svg = heatmap({
    rows, cols, domain,
    rowLabel: r => shortName(r).split(' (')[0] + (r.is_control ? ' (control)' : ''),
    colLabel: c => shortName(c).replace(/\s*\(.*?\)/, '').slice(0, 26),
    cell: (r, c) => {
      const res = M[rows0.indexOf(r)][cols.indexOf(c)];
      const v = val(res);
      const best = colBest[cols.indexOf(c)] === r.id;
      return { value: v, best, tipHtml: `<b>${esc(r.name)}</b><span>vs ${esc(c.name)}</span><span class="mono">${esc(dimLabel)}: ${v == null ? 'n/a' : pct(v)}</span>${best ? '<span>Best Earth match for this target</span>' : ''}<em>Click to compare</em>` };
    },
  });

  render(root, html`
  ${sectionHead('§ MATRIX', 'Analog matrix', 'Each cell scores one Earth site (row) against one target (column). The outlined cell is the best Earth match in each column. Select a cell to open that pair.')}
  <div class="panel matrix-ctrl">
    <label class="field"><span>Show</span><select id="m-dim"><option value="overall">Overall analog score</option>${DIMENSIONS.map(d => html`<option value="${d.key}" ${local.dim === d.key ? 'selected' : ''}>${d.label}</option>`)}</select></label>
    <label class="field"><span>Sort rows by</span><select id="m-sort">${[['mean', 'Mean across targets'], ['max', 'Best single match'], ['name', 'Name']].map(([k, l]) => html`<option value="${k}" ${local.sort === k ? 'selected' : ''}>${l}</option>`)}</select></label>
    <div class="field"><span>Profile (overall score)</span>${profileChips(ctx)}</div>
  </div>
  <section class="panel">
    <div class="ramp-legend"><span class="mono dim">${pct(domain[0])}</span><i style="background:linear-gradient(90deg,${[0, .25, .5, .75, 1].map(rampColor).join(',')})"></i><span class="mono dim">${pct(domain[1])}</span><span class="dim small">${dimLabel}. Colour spans the observed range so differences stay visible. A dash means no overlapping data.</span></div>
    <div class="heat-wrap" tabindex="0" aria-label="Scrollable matrix">${raw(svg)}</div>
  </section>
  ${dataNotice(ctx)}`);

  $('#m-dim', root).value = local.dim;
  $('#m-dim', root).addEventListener('change', e => { local.dim = e.target.value; render_(root, ctx); });
  $('#m-sort', root).addEventListener('change', e => { local.sort = e.target.value; render_(root, ctx); });
  bindProfileChips(root, ctx);
}
export { render_ as render };
