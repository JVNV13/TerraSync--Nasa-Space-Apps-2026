// 05 · Pair comparison: the scientific explanation of one Earth-vs-target analog.
import { html, render, pct, raw, fmtCoord, copyText, esc, $ } from '../util.js';
import { radar, dial, slopeDist } from '../charts.js';
import { histSummary, histOverlap } from '../engine.js';
import { FIELDS, GROUP_ORDER, formatValue } from '../data.js';
import { sectionHead, pageHead, band, targetOptions, earthOptions, DIM, USES, featureLabel, featureValue, shared, bodyMark, shortName, dataNotice, provBadge, provTag, provLegend, rated } from './common.js';

const HIST = 'terrain.slope_hist_1deg';
const C_EARTH = '#2f9fbf', C_TARGET = '#d9673a';

const local = { overlay: '' };

export function render_(root, ctx) {
  const target = ctx.target();
  const w = ctx.weights();
  let cand = ctx.engine.byId.get(ctx.state.candId);
  if (!cand) cand = ctx.engine.rank(target.id, ctx.earth.filter(s => !s.is_control), w)[0].candidate;
  const pv = f => html`<span class="pv-pair">${provBadge(cand, f.key)}${provBadge(target, f.key)}</span>`;
  const r = ctx.engine.compare(cand.id, target.id, w);
  const overlay = local.overlay && local.overlay !== cand.id ? ctx.engine.compare(local.overlay, target.id, w) : null;
  const rank = ctx.engine.rank(target.id, ctx.earth, w).findIndex(x => x.candidate.id === cand.id) + 1;

  const radarDims = r.dims.map(d => ({ ...d, short: DIM[d.key].short }));
  const goodDims = r.dims.filter(d => d.score != null && d.score >= 0.6).sort((a, b) => b.score - a.score);
  const weakDims = r.dims.filter(d => d.score != null && d.score < 0.4).sort((a, b) => a.score - b.score);

  const explain = f => {
    const sh = shared(f.a, f.b);
    if (sh.length) return `shared: ${sh.slice(0, 4).join(', ')}`;
    if (typeof f.a === 'number') return `${formatValue(f.a, f.key)} vs ${formatValue(f.b, f.key)}`;
    return `${formatValue(f.a, f.key) ?? '—'} vs ${formatValue(f.b, f.key) ?? '—'}`;
  };

  const brief = buildBrief(r, rank, ctx.earth.length, goodDims, weakDims);

  render(root, html`
  ${pageHead('Compare', 'Earth vs Mars, side by side', 'How well one place on Earth stands in for one place on Mars: what matches, and what does not.')}
  <div class="panel pair-pick">
    <label class="field"><span>${bodyMark('Earth')} Earth place</span><select id="c-cand">${earthOptions(ctx, cand.id)}</select></label>
    <span class="pair-arrow" aria-hidden="true">⟶</span>
    <label class="field"><span>${bodyMark(target.body)} ${target.body} place</span><select id="c-target">${targetOptions(ctx, target.id)}</select></label>
    <label class="field"><span>Also show on the chart (optional)</span><select id="c-overlay"><option value="">Nothing</option>${earthOptions(ctx, local.overlay)}</select></label>
  </div>

  <div class="pair-hero">
    <section class="panel score-panel">
      <div class="${rated(r) ? '' : 'dial-off'}">${raw(dial(r.score, 'Match score'))}</div>
      <div>${band(r.score, r.coverage)}<p class="score-say">${rated(r) ? html`Number <b>${rank}</b> of ${ctx.earth.length} Earth places for this Mars place.` : 'Too little shared data to give a fair score.'}</p>
      <p class="small dim">Based on ${r.dims.filter(d => d.score != null).length} of ${r.dims.length} topics that both places have data for.</p></div>
    </section>
    <section class="panel site-duo">
      <div class="duo earth-side"><p class="eyebrow">${bodyMark('Earth')}Earth analog</p><h2>${cand.name}</h2><p class="mono dim">${fmtCoord(cand.lat, cand.lon)}</p><p>${provTag(cand)}</p><p>${cand.summary}</p></div>
      <div class="duo mars-side"><p class="eyebrow">${bodyMark(target.body)}${target.body} target</p><h2>${target.name}</h2><p class="mono dim">${fmtCoord(target.lat, target.lon)}</p><p>${provTag(target)}</p><p>${target.summary}</p></div>
    </section>
  </div>

  <div class="grid-2">
    <section class="panel">
      <header class="block-head"><h2 class="block-title">Match by topic</h2><p class="block-sub">${overlay ? `Solid: ${shortName(cand)} · dashed: ${shortName(overlay.candidate)} (${pct(overlay.score)})` : 'The further out the shape reaches, the more alike the two places are.'}</p></header>
      <div class="radar-wrap">${raw(radar(radarDims, { compare: overlay?.dims }))}</div>
    </section>
    <section class="panel">
      <header class="block-head"><h2 class="block-title">Score for each topic</h2><p class="block-sub">Out of 100. “n/a” means one of the places has no data on it yet.</p></header>
      <ul class="dimlist">${r.dims.map(d => html`<li class="${d.score == null ? 'na' : ''}">
        <span class="dl-name">${d.label}<small>${DIM[d.key].blurb}</small></span>
        <span class="dl-bar"><i style="width:${d.score == null ? 0 : (d.score * 100).toFixed(1)}%"></i>${overlay && overlay.dims.find(o => o.key === d.key).score != null ? html`<b style="left:${(overlay.dims.find(o => o.key === d.key).score * 100).toFixed(1)}%" title="Overlay"></b>` : ''}</span>
        <span class="dl-v mono">${d.score == null ? 'n/a' : pct(d.score)}</span>
        </li>`)}</ul>
    </section>
  </div>

  ${cand._landcover ? raw(landPanel(cand)) : ''}

  <div class="grid-2">
    <section class="panel verdict good">
      <header class="block-head"><h2 class="block-title">Where they match</h2><p class="block-sub">Things that are very alike (75 or more out of 100).</p></header>
      ${r.strengths.length ? html`<table class="data compact"><tbody>${r.strengths.slice(0, 8).map(f => html`<tr><td>${featureLabel(f.key)}</td><td class="dim">${explain(f)}</td><td>${pv(f)}</td><td class="num mono">${pct(f.sim)}</td></tr>`)}</tbody></table>` : html`<p class="empty">No field reaches a similarity of 75.</p>`}
    </section>
    <section class="panel verdict bad">
      <header class="block-head"><h2 class="block-title">Where they differ</h2><p class="block-sub">Things that are very different (35 or less out of 100).</p></header>
      ${r.gaps.length ? html`<table class="data compact"><tbody>${r.gaps.slice(0, 8).map(f => html`<tr><td>${featureLabel(f.key)}</td><td class="dim">${explain(f)}</td><td>${pv(f)}</td><td class="num mono">${pct(f.sim)}</td></tr>`)}</tbody></table>` : html`<p class="empty">No field scores 35 or lower.</p>`}
      <h4 class="sub">What Earth can never copy</h4>
      <ul class="limits">${r.limits.map(l => html`<li><b>${l.label}</b><span class="mono">${fmtNum(l.a)} vs ${fmtNum(l.b)} ${l.unit}</span><span>${limitText(l, cand, target)}</span><small>${l.source}</small></li>`)}</ul>
    </section>
  </div>

  <section class="panel">
    <header class="block-head"><h2 class="block-title">What could you practise here?</h2><p class="block-sub">Ideas based on the topics that score 60 or more.</p></header>
    ${goodDims.length ? html`<ul class="uses">${goodDims.map(d => html`<li><span class="mono">${pct(d.score)}</span><b>${d.label}</b><p>${USES[d.key]}</p></li>`)}</ul>`
      : html`<p class="empty">No topic reaches 60, so this pair is more useful as a contrast than as a practice site.</p>`}
  </section>

  ${dataNotice(ctx)}

  <details class="panel tech">
    <summary>All the details (for scientists)</summary>
    ${raw(slopePanel(r, cand, target))}
    <div class="brief"><div class="brief-head"><p class="eyebrow">Field brief (plain text)</p><button class="btn small" id="c-copy">Copy brief</button></div><pre id="brief-text">${brief}</pre></div>
    <p class="small dim">${r.scoredFields} values compared: ${r.basis.measured} real vs real · ${r.basis.mixed} real vs demo · ${r.basis.synthetic} demo vs demo.</p>
    ${provLegend()}
    ${raw(sideBySide(r, cand, target))}
  </details>`);

  $('#c-cand', root).addEventListener('change', e => ctx.set({ candId: e.target.value }));
  $('#c-target', root).addEventListener('change', e => ctx.set({ targetId: e.target.value }));
  $('#c-overlay', root).addEventListener('change', e => { local.overlay = e.target.value; render_(root, ctx); });
  $('#c-copy', root).addEventListener('click', e => copyText($('#brief-text', root).textContent, e.currentTarget));
}

/** Measured land cover around an Earth place (ESA WorldCover), shown when the place lies inside a mapped region. */
function landPanel(s) {
  const v = s._landcover, veg = v.fields['habitability.vegetation_cover_pct'];
  return html`<section class="panel land-panel">
    <div><p class="eyebrow"><span class="code">ESA</span>Measured from space <span class="pv pv-measured" data-tip="Measured · ESA WorldCover 2021, 10 m">M</span></p>
    <h3>Ground within ${v.radius_km} km of ${shortName(s)}</h3>
    <p class="dim small">Mars has no plants, so less plant cover means a closer match. This real value is used in the score.</p>
    <button class="btn small" data-action="go" data-route="earth">See the land map →</button></div>
    <div class="land-bars">
      <p><span>Bare ground</span><i style="--v:${v.bare_pct_of_land}%;--c:#b4b4b4"></i><b class="mono">${v.bare_pct_of_land}%</b></p>
      <p><span>Plants</span><i style="--v:${veg}%;--c:#6f9a4a"></i><b class="mono">${veg}%</b></p>
      <p><span>Mars</span><i style="--v:100%;--c:var(--mars)"></i><b class="mono">100% bare</b></p>
    </div>
  </section>`.s;
}

const fmtNum = v => (v === 0 ? 0 : Math.abs(v) < 0.01 ? v.toPrecision(2) : +v.toFixed(2));

function limitText(l, a, b) {
  if (l.key === 'pressure' && !Number.isFinite(l.ratio)) return `${b.name.split(',')[0]} is effectively in vacuum. Earth cannot reproduce that outdoors, so thermal-vacuum chambers are still needed.`;
  if (l.key === 'pressure') return `${a.body} air is about ${Math.round(l.ratio).toLocaleString('en-US')}× denser at this site. Convection, dust lofting and boiling points all behave differently.`;
  if (l.key === 'radiation') return `${b.name.split(',')[0]} receives about ${Math.round(l.ratio).toLocaleString('en-US')}× the surface dose. Earth's magnetic field and atmosphere shield this site.`;
  if (l.key === 'gravity') return `Earth gravity is ${l.ratio.toFixed(1)}× ${b.body}'s, which changes regolith mechanics, mobility and how crews move.`;
  return '';
}

function buildBrief(r, rank, n, good, weak) {
  const a = r.candidate, b = r.target;
  const lines = [
    `TERRASYNC FIELD BRIEF`,
    `Earth analog : ${a.name} (${a['geographic.region'] || 'region not recorded'})`,
    `Target       : ${b.name} (${b.body})`,
    `Analog score : ${pct(r.score)}/100${rated(r) ? '' : ' (not rated: limited shared data)'} · rank ${rank} of ${n} · ${r.dims.filter(d => d.score != null).length} of ${r.dims.length} dimensions`,
    ``,
    `Holds on     : ${good.map(d => `${d.label} (${pct(d.score)})`).join('; ') || 'no dimension at 60+'}`,
    `Breaks on    : ${weak.map(d => `${d.label} (${pct(d.score)})`).join('; ') || 'no dimension below 40'}`,
    `Not on Earth : ${r.limits.map(l => l.label.toLowerCase()).join(', ')}`,
    ``,
    `Use it for:`,
    ...(good.length ? good.map(d => `  - ${USES[d.key]}`) : ['  - Contrast case only']),
    ``,
    `Data basis   : ${r.scoredFields} fields scored · ${r.basis.measured} measured vs measured · ${r.basis.mixed} measured vs synthetic · ${r.basis.synthetic} synthetic vs synthetic`,
    r.basis.mixed + r.basis.synthetic ? `Synthetic values are placeholders, not observations; this score demonstrates the method.` : `All scored values are measured.`,
  ];
  return lines.join('\n');
}

/** Slope panel: distributions where a site has one, and a plain statement of what the score used. */
function slopePanel(r, a, b) {
  const ha = a[HIST], hb = b[HIST];
  if (!ha && !hb) return '';
  const series = [], refs = [];
  const add = (site, h, color, dash) => {
    if (h) series.push({ name: shortName(site), hist: h, color, dash });
    else if (site['terrain.slope_mean_deg'] != null) refs.push({ name: shortName(site), color, mean: site['terrain.slope_mean_deg'] });
  };
  add(a, ha, C_EARTH, false); add(b, hb, C_TARGET, !!ha);
  const both = ha && hb;
  const row = (site, h, color) => {
    const m = site['terrain.slope_mean_deg'], mx = site['terrain.slope_max_deg'];
    const q = h ? histSummary(h) : null;
    const cell = (v, key) => (v == null ? '<td class="num dim">not recorded</td>' : `<td class="num mono">${provBadge(site, key).s || ''} ${v}</td>`);
    return `<tr><td><i class="sw" style="background:${color}"></i>${esc(shortName(site))}</td>${cell(m == null ? null : m.toFixed(1) + '°', 'terrain.slope_mean_deg')}${cell(q ? q.p50.toFixed(1) + '°' : null, HIST)}${cell(q ? q.p95.toFixed(1) + '°' : null, HIST)}${cell(mx == null ? null : mx.toFixed(1) + '°', 'terrain.slope_max_deg')}${cell(q ? (q.above[10] * 100).toFixed(1) + '%' : null, HIST)}${cell(q ? (q.above[20] * 100).toFixed(1) + '%' : null, HIST)}</tr>`;
  };
  const lacking = !ha ? a : b;
  const note = both
    ? `Both sites have a slope distribution. The terrain score uses their overlap, <b class="mono">${pct(histOverlap(ha, hb))}%</b>, and ignores the means.`
    : `<b>${esc(shortName(lacking))}</b> has no slope distribution, only a ${lacking._prov?.['terrain.slope_mean_deg'] || 'recorded'} mean and maximum. The terrain score falls back to comparing those two numbers, which can hide large differences in how slopes are spread. A measured elevation model for this site would allow a distribution comparison.`;
  return html`<section class="panel">
    ${sectionHead('·', 'Slope distributions', 'Share of ground at each slope. Two sites can share a mean slope and still differ in how much steep ground they have.')}
    <div class="grid-2 flush">
      <div><div class="map-legend">${series.map(s => html`<span><i class="lg-line${s.dash ? ' dash' : ''}" style="--c:${s.color}"></i>${s.name}</span>`)}${refs.map(x => html`<span><i class="lg-line dot" style="--c:${x.color}"></i>${x.name} (mean only)</span>`)}</div>
      <div class="sc-wrap">${raw(slopeDist({ series, refs }))}</div></div>
      <div><p class="callout">${raw(note)}</p>
      <div class="table-wrap"><table class="data compact"><thead><tr><th>Site</th><th class="num">Mean</th><th class="num">Median</th><th class="num">95th pct</th><th class="num">Max</th><th class="num">&gt; 10°</th><th class="num">&gt; 20°</th></tr></thead>
      <tbody>${raw(row(a, ha, C_EARTH) + row(b, hb, C_TARGET))}</tbody></table></div></div>
    </div></section>`.s;
}

function sideBySide(r, a, b) {
  const simByKey = {};
  for (const d of r.dims) for (const f of d.features) if (f.sim != null) simByKey[f.key] = f.sim;
  let out = '<div class="sbs">';
  for (const g of GROUP_ORDER) {
    const keys = Object.keys(FIELDS).filter(k => FIELDS[k].group === g);
    out += `<details ${g === 'Geology' || g === 'Environment' || g === 'Terrain' ? 'open' : ''}><summary>${g}</summary><table class="data compact"><thead><tr><th>Field</th><th>${esc(shortName(a))}</th><th>${esc(shortName(b))}</th><th class="num">Sim.</th></tr></thead><tbody>`;
    for (const k of keys) {
      const va = featureValue(a[k], k), vb = featureValue(b[k], k);
      const ba = provBadge(a, k), bb = provBadge(b, k);
      const s = simByKey[k];
      out += `<tr><td>${esc(FIELDS[k].label)}</td><td>${ba ? ba.s + ' ' : ''}${va.__raw ? va.s : esc(va)}</td><td>${bb ? bb.s + ' ' : ''}${vb.__raw ? vb.s : esc(vb)}</td><td class="num mono">${s == null ? '' : `<span class="simpill" style="--v:${s}">${pct(s)}</span>`}</td></tr>`;
    }
    out += '</tbody></table></details>';
  }
  return out + '</div>';
}
export { render_ as render };
