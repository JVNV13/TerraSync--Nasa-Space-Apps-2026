// 04 · Analog finder: weighted, filterable ranking of Earth candidates for one target.
import { html, render, raw, pct, copyText, $ } from '../util.js';
import { DIMENSIONS } from '../engine.js';
import { miniBars } from '../charts.js';
import { humanize } from '../data.js';
import { pageHead, band, targetOptions, profileChips, bindProfileChips, bodyMark, dataNotice } from './common.js';

const local = { q: '', maturity: new Set(['well_studied', 'emerging', 'under_studied', 'none']), terrain: '' };

export function render_(root, ctx) {
  const target = ctx.target();
  const w = ctx.weights();
  const terrains = [...new Set(ctx.earth.map(s => s['terrain.classification']).filter(Boolean))].sort();

  render(root, html`
  ${pageHead('Find a twin', 'Find an Earth twin for Mars', 'Pick a place on Mars. The list shows the places on Earth that are most like it, best match first. Click any result to see why.')}
  <div class="finder">
    <aside class="panel controls">
      <label class="field"><span>1 · Pick a Mars place</span><select id="f-target">${targetOptions(ctx, target.id)}</select></label>
      <p class="dim small">${target.summary}</p>
      <div class="field"><span>2 · What matters most for your mission?</span><div id="f-chips">${profileChips(ctx)}</div></div>
      <details class="weights">
        <summary>Fine-tune the weights (advanced) <button class="link" id="f-reset" type="button">reset</button></summary>
        ${DIMENSIONS.map(d => html`<label class="slider">
          <span class="sl-name" title="${d.blurb}">${d.label}</span>
          <input type="range" min="0" max="3" step="0.1" value="${String(w[d.key] ?? 1)}" data-dim="${d.key}" aria-label="${d.label} weight">
          <output class="mono" id="o-${d.key}">${(w[d.key] ?? 1).toFixed(1)}</output></label>`)}
      </details>
      <details class="weights"><summary>Filter the list</summary><fieldset class="field">
        <input type="search" id="f-q" placeholder="Search name, region, tag…" value="${local.q}" aria-label="Search candidates">
        <select id="f-terrain" aria-label="Terrain class"><option value="">All terrain classes</option>${terrains.map(t => html`<option value="${t}" ${t === local.terrain ? 'selected' : ''}>${humanize(t)}</option>`)}</select>
        <div class="checks">${[['well_studied', 'Well studied'], ['emerging', 'Emerging'], ['under_studied', 'Under-studied'], ['none', 'Not rated']].map(([k, l]) => html`
          <label><input type="checkbox" data-mat="${k}" ${local.maturity.has(k) ? 'checked' : ''}> ${l}</label>`)}</div>
        <label class="toggle"><input type="checkbox" id="f-ctrl" ${ctx.state.includeControl ? 'checked' : ''}> Show the “not like Mars” test site</label>
      </fieldset></details>
    </aside>
    <section class="results" aria-live="polite">
      <div class="res-head"><p id="res-count" class="mono dim"></p><button class="btn small ghost" id="f-copy">Copy list</button></div>
      <div id="results"></div>
    </section>
  </div>
  ${dataNotice(ctx)}`);

  const results = $('#results', root);
  const draw = () => {
    const ranked = ctx.engine.rank(target.id, ctx.candidates(), ctx.weights());
    const q = local.q.trim().toLowerCase();
    const list = ranked.map((r, i) => ({ r, rank: i + 1 })).filter(({ r }) => {
      const s = r.candidate;
      const mat = s['exploration.analog_maturity'] || 'none';
      if (!s.is_control && !local.maturity.has(mat)) return false;
      if (local.terrain && s['terrain.classification'] !== local.terrain) return false;
      if (q && ![s.name, s['geographic.region'], ...(s.analog_tags || []), s.summary].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
    $('#res-count', root).textContent = `${list.length} Earth places, best match for ${target.name} first`;
    results.innerHTML = list.length ? list.map(({ r, rank }) => card(r, rank)).join('') :
      `<div class="empty panel"><b>No candidates match these filters.</b><p>Clear the search or re-enable a maturity level.</p></div>`;
    results._ranked = list;
  };

  function card(r, rank) {
    const s = r.candidate;
    const strengths = r.dims.filter(d => d.score != null).sort((a, b) => b.score - a.score).slice(0, 2).map(d => d.label);
    const weakest = r.dims.filter(d => d.score != null).sort((a, b) => a.score - b.score)[0];
    return html`<article class="res-card${s.is_control ? ' ctrl' : ''}" tabindex="0" data-action="open-pair" data-a="${s.id}" data-b="${target.id}">
      <div class="res-rank mono">${String(rank).padStart(2, '0')}</div>
      <div class="res-main">
        <h3>${bodyMark('Earth')}${s.name}${s.is_control ? html` <span class="tag warn">test site: not like Mars</span>` : ''}${['under_studied', 'emerging'].includes(s['exploration.analog_maturity']) ? html` <span class="tag new">${humanize(s['exploration.analog_maturity'])}</span>` : ''}</h3>
        <p class="dim">${s['geographic.region']} · ${humanize(s['terrain.classification'] || '')}</p>
        <p class="res-why"><span>Alike in</span> ${strengths.join(', ') || 'no shared data'}${strengths.length > 1 ? html` <span>· different in</span> ${weakest.label}` : ''}</p>
      </div>
      <div class="res-dims">${raw2(miniBars(r.dims))}<span class="mono dim small">${r.dims.filter(d => d.score != null).length} of ${r.dims.length} dimensions</span></div>
      <div class="res-score"><span class="mono">${pct(r.score)}</span>${band(r.score, r.coverage)}</div>
    </article>`.s;
  }

  draw();

  root.querySelector('#f-target').addEventListener('change', e => ctx.set({ targetId: e.target.value }));
  bindProfileChips(root, ctx);
  root.querySelectorAll('input[data-dim]').forEach(inp => inp.addEventListener('input', () => {
    const weights = { ...ctx.weights(), [inp.dataset.dim]: +inp.value };
    $('#o-' + inp.dataset.dim, root).textContent = (+inp.value).toFixed(1);
    ctx.set({ weights }, { rerender: false });
    $('#f-chips', root).innerHTML = profileChips(ctx).s;
    bindProfileChips(root, ctx);
    draw();
  }));
  $('#f-reset', root).addEventListener('click', e => { e.preventDefault(); ctx.set({ weights: null }); });
  $('#f-q', root).addEventListener('input', e => { local.q = e.target.value; draw(); });
  $('#f-terrain', root).addEventListener('change', e => { local.terrain = e.target.value; draw(); });
  root.querySelectorAll('[data-mat]').forEach(c => c.addEventListener('change', () => { c.checked ? local.maturity.add(c.dataset.mat) : local.maturity.delete(c.dataset.mat); draw(); }));
  $('#f-ctrl', root).addEventListener('change', e => ctx.set({ includeControl: e.target.checked }));
  $('#f-copy', root).addEventListener('click', e => {
    const rows = [['rank', 'earth_id', 'earth_site', 'target_id', 'target_site', 'score', ...DIMENSIONS.map(d => d.key), 'coverage']];
    for (const { r, rank } of results._ranked) rows.push([rank, r.candidate.id, r.candidate.name, target.id, target.name, r.score.toFixed(3), ...r.dims.map(d => (d.score == null ? '' : d.score.toFixed(3))), r.coverage.toFixed(2)]);
    const csv = rows.map(row => row.map(v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(',')).join('\n');
    copyText(csv, e.currentTarget);
  });
}
const raw2 = s => ({ __raw: true, s });
export { render_ as render };
