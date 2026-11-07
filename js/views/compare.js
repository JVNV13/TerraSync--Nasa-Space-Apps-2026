// 04 · Pair comparison: the scientific explanation of one Earth-vs-target analog.
import { html, render, pct, raw, fmtCoord, copyText, esc, $ } from '../util.js';
import { radar, dial } from '../charts.js';
import { FIELDS, GROUP_ORDER, formatValue } from '../data.js';
import { sectionHead, band, targetOptions, earthOptions, DIM, USES, featureLabel, featureValue, shared, bodyMark, shortName, dataNotice } from './common.js';

const local = { overlay: '' };

export function render_(root, ctx) {
  const target = ctx.target();
  const w = ctx.weights();
  let cand = ctx.engine.byId.get(ctx.state.candId);
  if (!cand) cand = ctx.engine.rank(target.id, ctx.earth.filter(s => !s.is_control), w)[0].candidate;
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
  ${sectionHead('§ COMPARE', 'Pair analysis', 'How closely one Earth site reproduces one target, and where it does not.')}
  <div class="panel pair-pick">
    <label class="field"><span>${bodyMark('Earth')} Earth candidate</span><select id="c-cand">${earthOptions(ctx, cand.id)}</select></label>
    <span class="pair-arrow" aria-hidden="true">⟶</span>
    <label class="field"><span>${bodyMark(target.body)} ${target.body} target</span><select id="c-target">${targetOptions(ctx, target.id)}</select></label>
    <label class="field"><span>Overlay a second Earth site</span><select id="c-overlay"><option value="">None</option>${earthOptions(ctx, local.overlay)}</select></label>
  </div>

  <div class="pair-hero">
    <section class="panel score-panel">
      ${raw(dial(r.score, 'Analog score'))}
      <div>${band(r.score)}<p class="mono dim">Rank ${rank} of ${ctx.earth.length} Earth sites for this target</p><p class="mono dim">Data coverage ${pct(r.coverage)}% of dimensions</p></div>
    </section>
    <section class="panel site-duo">
      <div class="duo earth-side"><p class="eyebrow">${bodyMark('Earth')}Earth analog</p><h2>${cand.name}</h2><p class="mono dim">${fmtCoord(cand.lat, cand.lon)}</p><p>${cand.summary}</p></div>
      <div class="duo mars-side"><p class="eyebrow">${bodyMark(target.body)}${target.body} target</p><h2>${target.name}</h2><p class="mono dim">${fmtCoord(target.lat, target.lon)}</p><p>${target.summary}</p></div>
    </section>
  </div>

  <div class="grid-2">
    <section class="panel">
      ${sectionHead('A', 'Similarity by dimension', overlay ? `Solid: ${shortName(cand)} · dashed: ${shortName(overlay.candidate)} (${pct(overlay.score)})` : 'Scores out of 100. "n/a" means there is no overlapping data.')}
      <div class="radar-wrap">${raw(radar(radarDims, { compare: overlay?.dims }))}</div>
    </section>
    <section class="panel">
      ${sectionHead('B', 'Dimension breakdown', 'Coverage shows how much of each dimension both records actually report.')}
      <ul class="dimlist">${r.dims.map(d => html`<li class="${d.score == null ? 'na' : ''}">
        <span class="dl-name">${d.label}<small>${DIM[d.key].blurb}</small></span>
        <span class="dl-bar"><i style="width:${d.score == null ? 0 : (d.score * 100).toFixed(1)}%"></i>${overlay && overlay.dims.find(o => o.key === d.key).score != null ? html`<b style="left:${(overlay.dims.find(o => o.key === d.key).score * 100).toFixed(1)}%" title="Overlay"></b>` : ''}</span>
        <span class="dl-v mono">${d.score == null ? 'n/a' : pct(d.score)}</span>
        <span class="dl-c mono dim">${d.na ? d.na : 'cov ' + pct(d.coverage) + '%'} · w ${(w[d.key] ?? 1).toFixed(1)}</span></li>`)}</ul>
    </section>
  </div>

  <div class="grid-2">
    <section class="panel verdict good">
      ${sectionHead('C', 'Where the analogy holds', 'Fields with a similarity of 75 or more.')}
      ${r.strengths.length ? html`<table class="data compact"><tbody>${r.strengths.slice(0, 8).map(f => html`<tr><td>${featureLabel(f.key)}</td><td class="dim">${explain(f)}</td><td class="num mono">${pct(f.sim)}</td></tr>`)}</tbody></table>` : html`<p class="empty">No field reaches a similarity of 75.</p>`}
    </section>
    <section class="panel verdict bad">
      ${sectionHead('D', 'Where it breaks down', 'Fields with a similarity of 35 or less, plus conditions Earth cannot reproduce.')}
      ${r.gaps.length ? html`<table class="data compact"><tbody>${r.gaps.slice(0, 8).map(f => html`<tr><td>${featureLabel(f.key)}</td><td class="dim">${explain(f)}</td><td class="num mono">${pct(f.sim)}</td></tr>`)}</tbody></table>` : html`<p class="empty">No field scores 35 or lower.</p>`}
      <h4 class="sub">Beyond Earth's reach (not scored)</h4>
      <ul class="limits">${r.limits.map(l => html`<li><b>${l.label}</b><span class="mono">${fmtNum(l.a)} vs ${fmtNum(l.b)} ${l.unit}</span><span>${limitText(l, cand, target)}</span><small>${l.source}</small></li>`)}</ul>
    </section>
  </div>

  <section class="panel">
    ${sectionHead('E', 'How this analog helps exploration', 'Derived from the dimensions that score 60 or more.')}
    ${goodDims.length ? html`<ul class="uses">${goodDims.map(d => html`<li><span class="mono">${pct(d.score)}</span><b>${d.label}</b><p>${USES[d.key]}</p></li>`)}</ul>`
      : html`<p class="empty">No dimension reaches 60. This pair is better used as a contrast case than as a test site.</p>`}
    <div class="brief"><div class="brief-head"><p class="eyebrow">Field brief (plain text)</p><button class="btn small" id="c-copy">Copy brief</button></div><pre id="brief-text">${brief}</pre></div>
  </section>

  <section class="panel">
    ${sectionHead('F', 'Side-by-side record', 'All CSV fields for both sites. Scored fields show their similarity.')}
    ${raw(sideBySide(r, cand, target))}
  </section>
  ${dataNotice(ctx)}`);

  $('#c-cand', root).addEventListener('change', e => ctx.set({ candId: e.target.value }));
  $('#c-target', root).addEventListener('change', e => ctx.set({ targetId: e.target.value }));
  $('#c-overlay', root).addEventListener('change', e => { local.overlay = e.target.value; render_(root, ctx); });
  $('#c-copy', root).addEventListener('click', e => copyText($('#brief-text', root).textContent, e.currentTarget));
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
    `TERRATWIN FIELD BRIEF`,
    `Earth analog : ${a.name} (${a['geographic.region'] || 'region not recorded'})`,
    `Target       : ${b.name} (${b.body})`,
    `Analog score : ${pct(r.score)}/100 · rank ${rank} of ${n} · coverage ${pct(r.coverage)}%`,
    ``,
    `Holds on     : ${good.map(d => `${d.label} (${pct(d.score)})`).join('; ') || 'no dimension at 60+'}`,
    `Breaks on    : ${weak.map(d => `${d.label} (${pct(d.score)})`).join('; ') || 'no dimension below 40'}`,
    `Not on Earth : ${r.limits.map(l => l.label.toLowerCase()).join(', ')}`,
    ``,
    `Use it for:`,
    ...(good.length ? good.map(d => `  - ${USES[d.key]}`) : ['  - Contrast case only']),
    ``,
    `Source: ${a.is_synthetic || b.is_synthetic ? 'SYNTHETIC demonstration data, not observations' : 'dataset records'}.`,
  ];
  return lines.join('\n');
}

function sideBySide(r, a, b) {
  const simByKey = {};
  for (const d of r.dims) for (const f of d.features) if (f.sim != null) simByKey[f.key] = f.sim;
  let out = '<div class="sbs">';
  for (const g of GROUP_ORDER) {
    const keys = Object.keys(FIELDS).filter(k => FIELDS[k].group === g);
    out += `<details ${g === 'Geology' || g === 'Environment' ? 'open' : ''}><summary>${g}</summary><table class="data compact"><thead><tr><th>Field</th><th>${esc(shortName(a))}</th><th>${esc(shortName(b))}</th><th class="num">Sim.</th></tr></thead><tbody>`;
    for (const k of keys) {
      const va = featureValue(a[k], k), vb = featureValue(b[k], k);
      const s = simByKey[k];
      out += `<tr><td>${esc(FIELDS[k].label)}</td><td>${va.__raw ? va.s : esc(va)}</td><td>${vb.__raw ? vb.s : esc(vb)}</td><td class="num mono">${s == null ? '' : `<span class="simpill" style="--v:${s}">${pct(s)}</span>`}</td></tr>`;
    }
    out += '</tbody></table></details>';
  }
  return out + '</div>';
}
export { render_ as render };
