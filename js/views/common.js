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

/** Page header in the exploration-centre style: breadcrumb, big title, one plain sentence. */
export function pageHead(crumb, title, sub) {
  return html`<header class="page-head">
    <p class="crumb"><a href="#mission">Home</a><span>/</span><b>${crumb}</b></p>
    <h1 class="page-title">${title}</h1>
    ${sub ? html`<p class="page-sub">${sub}</p>` : ''}
  </header>`;
}

/** A short "how to read this" hint shown above a chart or map. */
export const hint = text => html`<p class="hint"><i aria-hidden="true">?</i>${text}</p>`;

/**
 * Procedural planet globe (SVG, no image files). kind: 'mars' | 'earth'.
 * The surface texture slides behind a shaded sphere, which reads as slow rotation.
 */
export function globe(kind = 'mars', cls = '') {
  const id = 'g' + Math.random().toString(36).slice(2, 7);
  const P = kind === 'earth'
    ? { base: ['#3d7fb0', '#1b4f7c', '#0b2440'], dark: '0.18 0.36 0.16', light: '0.78 0.70 0.52', glow: '#5aa9e6', cap: 0.55, f: 0.010 }
    : { base: ['#e08a55', '#b5532c', '#5a1f0f'], dark: '0.24 0.08 0.04', light: '0.86 0.52 0.32', glow: '#e0703a', cap: 0.38, f: 0.012 };
  const [dr, dg, db] = P.dark.split(' '), [lr, lg, lb] = P.light.split(' ');
  return raw(`<svg class="globe globe-${kind} ${cls}" viewBox="0 0 600 600" aria-hidden="true">
  <defs>
    <radialGradient id="${id}b" cx="38%" cy="36%" r="70%"><stop offset="0" stop-color="${P.base[0]}"/><stop offset=".6" stop-color="${P.base[1]}"/><stop offset="1" stop-color="${P.base[2]}"/></radialGradient>
    <radialGradient id="${id}s" cx="30%" cy="28%" r="85%"><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset=".78" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity=".92"/></radialGradient>
    <radialGradient id="${id}g" cx="50%" cy="50%" r="50%"><stop offset=".86" stop-color="${P.glow}" stop-opacity=".55"/><stop offset="1" stop-color="${P.glow}" stop-opacity="0"/></radialGradient>
    <clipPath id="${id}c"><circle cx="300" cy="300" r="250"/></clipPath>
    <filter id="${id}d" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${P.f}" numOctaves="5" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 ${dr} 0 0 0 0 ${dg} 0 0 0 0 ${db} 3.6 0 0 0 -1.55"/></filter>
    <filter id="${id}l" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${P.f * 2.2}" numOctaves="4" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 ${lr} 0 0 0 0 ${lg} 0 0 0 0 ${lb} 0 3 0 0 -1.65"/></filter>
    <filter id="${id}bl"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>
  <circle cx="300" cy="300" r="292" fill="url(#${id}g)"/>
  <g clip-path="url(#${id}c)">
    <circle cx="300" cy="300" r="250" fill="url(#${id}b)"/>
    <g class="globe-spin"><rect x="0" y="40" width="1500" height="520" filter="url(#${id}d)"/><rect x="0" y="40" width="1500" height="520" filter="url(#${id}l)" opacity=".42"/></g>
    <ellipse cx="300" cy="62" rx="120" ry="34" fill="#fff" opacity="${P.cap}" filter="url(#${id}bl)"/>
    <circle cx="300" cy="300" r="250" fill="url(#${id}s)"/>
  </g>
  <circle cx="300" cy="300" r="250" fill="none" stroke="${P.glow}" stroke-opacity=".35" stroke-width="1.5"/>
</svg>`);
}

/** One label ........ value row (encyclopedia-style data list). */
export const factRow = (label, value, tipText) => html`<li class="fact"${tipText ? raw(` data-tip="${esc(tipText)}"`) : ''}><span>${label}</span><i></i><b>${value}</b></li>`;

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
  const { measured, synthetic } = ctx.data.quality.values;
  if (!synthetic) return '';
  return html`<aside class="notice" role="note"><b>Good to know:</b> ${measured ? html`values marked <span class="pv pv-measured">M</span> are real measurements; ` : ''}values marked <span class="pv pv-synthetic">S</span> are demo placeholders, so these match scores show how the method works rather than final science. Real data: <a href="#terrain">Mars surface</a> · <a href="#earth">Earth land</a>.</aside>`;
}
