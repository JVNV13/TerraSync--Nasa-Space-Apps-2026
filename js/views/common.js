// Pieces reused across views.
import { html, raw, esc } from '../util.js';
import { PROFILES, DIMENSIONS, scoreBand } from '../engine.js';
import { FIELDS, formatValue, humanize, provOf } from '../data.js';

export const shortName = s => s.name.replace(/\s*\(control\)/i, '').split(',')[0];

export function bodyMark(body) {
  return raw(body === 'Mars' ? '<i class="glyph mars" aria-hidden="true"></i>' : body === 'Earth' ? '<i class="glyph earth" aria-hidden="true"></i>' : '<i class="glyph moon" aria-hidden="true"></i>');
}

// A pair that shares fewer than a third of the dimensions is not rated: its score rests on too little.
export const MIN_COVERAGE = 1 / 3;
export const rated = r => r.coverage >= MIN_COVERAGE;
/** Sort results: rated pairs first, then by score. */
export const byScore = (x, y) => (rated(y) - rated(x)) || (y.score - x.score);

export function band(score, coverage = 1) {
  if (coverage < MIN_COVERAGE) return html`<span class="band band-low" data-tip="Fewer than a third of the dimensions have data on both sides, so this pair is not rated.">Limited data</span>`;
  const b = scoreBand(score);
  return html`<span class="band band-${b.key}">${b.label}</span>`;
}

/** M / S badge for one field of one record (nothing for blank fields). */
export function provBadge(site, key) {
  const p = provOf(site, key);
  if (!p) return '';
  const tipText = p === 'measured' ? `Measured${site.data_source ? ' · ' + site.data_source : ''}` : 'Synthetic placeholder, not an observation';
  return html`<span class="pv pv-${p}" data-tip="${esc(tipText)}" aria-label="${p}">${p === 'measured' ? 'M' : 'S'}</span>`;
}

/** Record-level tag, derived from the record's fields. */
export function provTag(site) {
  const n = Object.values(site._prov || {});
  const m = n.filter(v => v === 'measured').length;
  const label = site.provenance === 'mixed' ? `mixed · ${m}/${n.length} fields measured` : site.provenance;
  return html`<span class="tag ${site.provenance === 'measured' ? 'real' : 'warn'}">${label}</span>`;
}

export const provLegend = () => html`<p class="pv-legend small dim"><span class="pv pv-measured">M</span> measured value <span class="pv pv-synthetic">S</span> synthetic placeholder · labelled per field, blank fields carry no label</p>`;

export function sectionHead(code, title, sub) {
  return html`<header class="sec-head"><p class="eyebrow"><span class="code">${code}</span>${title}</p>${sub ? html`<p class="sec-sub">${sub}</p>` : ''}</header>`;
}

export function targetOptions(ctx, selectedId) {
  const groups = {};
  for (const t of ctx.targets) (groups[`${t.body} · ${t.provenance}`] ||= []).push(t);
  return raw(Object.entries(groups).map(([body, list]) => `<optgroup label="${esc(body)} targets">${list.map(t => `<option value="${esc(t.id)}"${t.id === selectedId ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</optgroup>`).join(''));
}

export function earthOptions(ctx, selectedId) {
  return raw(ctx.earth.map(s => `<option value="${esc(s.id)}"${s.id === selectedId ? ' selected' : ''}>${esc(s.name)}${s.is_control ? ' — control' : ''}</option>`).join(''));
}

export function profileChips(ctx) {
  const custom = !!ctx.state.weights;
  return html`<div class="chips" role="radiogroup" aria-label="Mission profile">
    ${Object.entries(PROFILES).map(([k, p]) => html`<button class="chip${!custom && ctx.state.profile === k ? ' on' : ''}" role="radio" aria-checked="${String(!custom && ctx.state.profile === k)}" data-profile="${k}" title="${p.desc}">${p.label}</button>`)}
    ${custom ? html`<span class="chip on custom" title="Weights edited by hand">Custom weights</span>` : ''}
  </div>`;
}

export function bindProfileChips(root, ctx) {
  root.querySelectorAll('[data-profile]').forEach(b => b.addEventListener('click', () => ctx.set({ profile: b.dataset.profile, weights: null })));
}

export const DIM = Object.fromEntries(DIMENSIONS.map(d => [d.key, d]));

// How a strong match on each dimension can be used to prepare a mission.
export const USES = {
  geology: 'Field-geology training and sample-selection drills; calibrate spectrometers on shared minerals',
  terrain: 'Rehearse rover traverse planning, hazard avoidance and navigation on comparable slopes and roughness',
  thermal: 'Cold/hot cycling and illumination tests of hardware (vacuum and pressure effects excluded)',
  aeolian: 'Dust-mitigation tests: seals, abrasion, solar-panel and optics fouling under real wind regimes',
  water: 'Field-test ice-prospecting radar, neutron spectroscopy and ISRU drilling/extraction',
  habitability: 'Validate life-detection instruments near the dry/cold limits of life and study biosignature preservation',
  subsurface: 'Rehearse cave mapping, robotic access, comms dead-zones and habitat shielding concepts',
  processes: 'Observe the same active processes on the ground to interpret orbital and rover data',
  operations: 'Simulate EVA timing, landing-zone survey and logistics on similarly trafficable ground',
};

export function featureLabel(key) { return FIELDS[key]?.label || key; }

export function featureValue(v, key) {
  const f = formatValue(v, key);
  return f == null ? html`<span class="nr">not recorded</span>` : f;
}

/** Shared items for set-like features (shown in explanations). */
export function shared(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return [];
  return a.filter(x => b.includes(x)).map(humanize);
}

export function dataNotice(ctx) {
  const q = ctx.data.quality;
  const { measured, synthetic } = q.values;
  if (!synthetic) return '';
  const n = v => v.toLocaleString('en-US');
  if (!measured) return html`<aside class="notice" role="note"><b>Synthetic dataset.</b> All ${n(synthetic)} field values in <span class="mono">${q.source}</span> are synthetic placeholders. Rankings demonstrate the method; they are not scientific findings.</aside>`;
  return html`<aside class="notice" role="note"><b>Measured and synthetic data are mixed.</b> ${n(measured)} field values are measured (${q.records.measured || 0} fully measured record${q.records.measured === 1 ? '' : 's'}${q.records.mixed ? `, ${q.records.mixed} mixed` : ''}) and ${n(synthetic)} are synthetic placeholders. Every field is labelled <span class="pv pv-measured">M</span> or <span class="pv pv-synthetic">S</span> where it is shown. A score that uses any synthetic value demonstrates the method and is not a scientific finding. Measured Mars elevation, slope and shadow maps are under <a href="#terrain">Terrain</a>.</aside>`;
}
