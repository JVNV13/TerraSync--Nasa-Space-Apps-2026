// 07 · Site catalog: searchable record browser, parameter-space scatter plot and full record drawer.
import { html, render, fmtCoord, $ } from '../util.js';
import { scatter } from '../charts.js';
import { FIELDS, GROUP_ORDER, formatValue, humanize } from '../data.js';
import { sectionHead, bodyMark, featureValue, band, dataNotice, provBadge, provTag, provLegend, byScore } from './common.js';

const NUMERIC = Object.keys(FIELDS).filter(k => FIELDS[k].type === 'num');
const LOG_DEFAULT = new Set(['terrain.crater_density_gt1km_per_1e6km2', 'environment.radiation_dose_mgy_per_day', 'environment.annual_liquid_precipitation_mm', 'water_resources.regolith_water_equivalent_wt_pct', 'environment.atmospheric_pressure_kpa', 'environment.dust_storms_per_earth_year']);
const local = { q: '', body: 'all', prov: '', terrain: '', tag: '', x: 'environment.temperature_c.mean', y: 'environment.dust_activity_index', xLog: false, yLog: false };

export function render_(root, ctx) {
  const sites = ctx.data.sites;
  const bodies = [...new Set(sites.map(s => s.body))];
  const terrains = [...new Set(sites.map(s => s['terrain.classification']).filter(Boolean))].sort();
  const tags = [...new Set(sites.flatMap(s => s.analog_tags || []))].sort();
  const usable = NUMERIC.filter(k => sites.filter(s => s[k] != null).length >= 3);

  render(root, html`
  ${sectionHead('§ CATALOG', 'Site catalog', 'Every record in the dataset. Search, filter, plot any two numeric fields, and open the full record.')}
  <div class="panel cat-filters">
    <input type="search" id="k-q" placeholder="Search names, regions, minerals, tags…" value="${local.q}" aria-label="Search sites">
    <select id="k-body" aria-label="Body"><option value="all">All bodies</option>${bodies.map(b => html`<option value="${b}" ${local.body === b ? 'selected' : ''}>${b}</option>`)}</select>
    <select id="k-prov" aria-label="Data provenance"><option value="">Measured and synthetic</option>${['measured', 'mixed', 'synthetic'].filter(v => sites.some(s => s.provenance === v)).map(v => html`<option value="${v}" ${local.prov === v ? 'selected' : ''}>${v[0].toUpperCase() + v.slice(1)} records</option>`)}</select>
    <select id="k-terrain" aria-label="Terrain"><option value="">All terrain</option>${terrains.map(t => html`<option value="${t}" ${local.terrain === t ? 'selected' : ''}>${humanize(t)}</option>`)}</select>
    <select id="k-tag" aria-label="Analog tag"><option value="">All tags</option>${tags.map(t => html`<option value="${t}" ${local.tag === t ? 'selected' : ''}>${humanize(t)}</option>`)}</select>
    <span id="k-count" class="mono dim"></span>
  </div>

  <section class="panel">
    ${sectionHead('A', 'Parameter space', 'Each mark is a site: circles are Earth, diamonds are targets. Filters above apply. Select a mark to open its record.')}
    <div class="sc-ctrl">
      <label class="field"><span>X axis</span><select id="k-x">${usable.map(k => html`<option value="${k}" ${local.x === k ? 'selected' : ''}>${FIELDS[k].label}${FIELDS[k].unit ? ` (${FIELDS[k].unit})` : ''}</option>`)}</select></label>
      <label class="toggle"><input type="checkbox" id="k-xlog" ${local.xLog ? 'checked' : ''}> log X</label>
      <label class="field"><span>Y axis</span><select id="k-y">${usable.map(k => html`<option value="${k}" ${local.y === k ? 'selected' : ''}>${FIELDS[k].label}${FIELDS[k].unit ? ` (${FIELDS[k].unit})` : ''}</option>`)}</select></label>
      <label class="toggle"><input type="checkbox" id="k-ylog" ${local.yLog ? 'checked' : ''}> log Y</label>
      <div class="map-legend"><span><i class="lg-earth"></i>Earth</span><span><i class="lg-mars"></i>Mars</span><span><i class="lg-ctrl"></i>Control</span></div>
    </div>
    <div id="k-scatter" class="sc-wrap"></div>
    <p id="k-missing" class="dim small"></p>
  </section>

  <div id="k-grid" class="cat-grid"></div>
  ${dataNotice(ctx)}`);

  const filtered = () => {
    const q = local.q.trim().toLowerCase();
    return sites.filter(s => {
      if (local.body !== 'all' && s.body !== local.body) return false;
      if (local.prov && s.provenance !== local.prov) return false;
      if (local.terrain && s['terrain.classification'] !== local.terrain) return false;
      if (local.tag && !(s.analog_tags || []).includes(local.tag)) return false;
      if (q) {
        const hay = [s.name, s['geographic.region'], s.summary, s['geology.surface_material'], ...(s['geology.minerals'] || []), ...(s.analog_tags || [])].join(' ').toLowerCase().replace(/_/g, ' ');
        if (!q.split(/\s+/).every(t => hay.includes(t))) return false;
      }
      return true;
    });
  };

  const draw = () => {
    const list = filtered();
    $('#k-count', root).textContent = `${list.length} of ${sites.length} records`;
    const pts = list.filter(s => s[local.x] != null && s[local.y] != null).map(s => ({ id: s.id, name: s.name, body: s.body, ctrl: s.is_control, x: s[local.x], y: s[local.y], xs: `${formatValue(s[local.x], local.x)} (${s._prov[local.x]})`, ys: `${formatValue(s[local.y], local.y)} (${s._prov[local.y]})` }));
    const xLog = local.xLog && pts.every(p => p.x >= 0), yLog = local.yLog && pts.every(p => p.y >= 0);
    $('#k-scatter', root).innerHTML = scatter({ points: pts, xLabel: FIELDS[local.x].label, yLabel: FIELDS[local.y].label, xLog, yLog });
    const miss = list.length - pts.length;
    $('#k-missing', root).textContent = miss ? `${miss} filtered record${miss > 1 ? 's' : ''} not plotted because one of the two fields is not recorded.` : '';
    $('#k-grid', root).innerHTML = list.length ? list.map(siteCard).join('') : `<div class="panel empty"><b>No sites match.</b><p>Try a broader search or clear a filter.</p></div>`;
  };
  draw();

  const on = (id, ev, fn) => $(id, root).addEventListener(ev, fn);
  on('#k-q', 'input', e => { local.q = e.target.value; draw(); });
  on('#k-body', 'change', e => { local.body = e.target.value; draw(); });
  on('#k-prov', 'change', e => { local.prov = e.target.value; draw(); });
  on('#k-terrain', 'change', e => { local.terrain = e.target.value; draw(); });
  on('#k-tag', 'change', e => { local.tag = e.target.value; draw(); });
  on('#k-x', 'change', e => { local.x = e.target.value; local.xLog = LOG_DEFAULT.has(local.x); $('#k-xlog', root).checked = local.xLog; draw(); });
  on('#k-y', 'change', e => { local.y = e.target.value; local.yLog = LOG_DEFAULT.has(local.y); $('#k-ylog', root).checked = local.yLog; draw(); });
  on('#k-xlog', 'change', e => { local.xLog = e.target.checked; draw(); });
  on('#k-ylog', 'change', e => { local.yLog = e.target.checked; draw(); });

}

function siteCard(s) {
  return html`<article class="site-card ${s.body.toLowerCase()}${s.is_control ? ' ctrl' : ''}" tabindex="0" data-action="open-site" data-id="${s.id}">
    <p class="eyebrow">${bodyMark(s.body)}<span class="mono">${s.id}</span> · ${humanize(s['terrain.classification'] || 'unclassified')}</p>
    <h3>${s.name}</h3>
    <p class="mono dim">${fmtCoord(s.lat, s.lon)}</p>
    <p class="sc-sum">${s.summary}</p>
    <p class="tags">${(s.analog_tags || []).slice(0, 3).map(t => html`<span class="tag">${humanize(t)}</span>`)}${s.is_control ? html`<span class="tag warn">control</span>` : ''}${provTag(s)}</p>
  </article>`.s;
}

/** Full-record drawer. */
export function openSite(ctx, id) {
  const s = ctx.engine.byId.get(id); if (!s) return;
  closeSite();
  const best = s.body === 'Earth'
    ? ctx.targets.map(t => ctx.engine.compare(s.id, t.id, ctx.weights())).sort(byScore).slice(0, 3)
    : ctx.engine.rank(s.id, ctx.earth.filter(e => !e.is_control), ctx.weights()).slice(0, 3);
  const el = document.createElement('div');
  el.className = 'drawer-wrap';
  el.innerHTML = html`<div class="drawer-scrim" data-close></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-label="${s.name}">
    <header><p class="eyebrow">${bodyMark(s.body)}<span class="mono">${s.id}</span> · ${s.body} · ${provTag(s)}${s.is_control ? html` <span class="tag warn">negative control</span>` : ''}</p>
      <h2>${s.name}</h2><p class="mono dim">${fmtCoord(s.lat, s.lon)} · ${s['geographic.coordinate_system'] || ''}</p>
      <button class="btn ghost close" data-close aria-label="Close">Close ✕</button></header>
    <p>${s.summary}</p>
    ${s.data_source ? html`<p class="small dim">Source: ${s.data_source}</p>` : ''}
    ${provLegend()}
    <section><h4 class="sub">${s.body === 'Earth' ? 'Best target matches' : 'Best Earth analogs'}</h4>
      <ul class="drawer-best">${best.map(r => { const o = s.body === 'Earth' ? r.target : r.candidate; return html`<li class="rowlink" tabindex="0" data-action="open-pair" data-a="${r.candidate.id}" data-b="${r.target.id}"><span>${bodyMark(o.body)}${o.name}</span><span class="mono">${Math.round(r.score * 100)}</span>${band(r.score, r.coverage)}</li>`; })}</ul></section>
    ${GROUP_ORDER.map(g => html`<section><h4 class="sub">${g}</h4><dl class="kv">${Object.keys(FIELDS).filter(k => FIELDS[k].group === g).map(k => html`<div><dt>${FIELDS[k].label}</dt><dd>${provBadge(s, k)} ${featureValue(s[k], k)}</dd></div>`)}</dl></section>`)}
  </aside>`.s;
  document.body.appendChild(el);
  document.body.classList.add('locked');
  el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeSite));
  el.querySelector('.close').focus();
}
export function closeSite() {
  const d = document.querySelector('.drawer-wrap');
  if (d) { d.remove(); document.body.classList.remove('locked'); }
}
export { render_ as render };
