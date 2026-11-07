// Hand-built SVG charts. Each returns markup; interactivity is wired through
// data-tip (tooltip HTML) and data-action/data-id attributes handled by app.js.
import { esc, rampColor, fmtCoord } from './util.js';
import { EARTH_LAND_PATH } from './earth-land.js';

const attrTip = s => esc(s); // tooltip HTML stored escaped inside an attribute

/* ---------------------------------------------------------------- maps */
function graticule(step = 30) {
  let d = '';
  for (let lon = -180 + step; lon < 180; lon += step) d += `M${lon + 180} 0V180`;
  for (let lat = -90 + step; lat < 90; lat += step) d += `M0 ${90 - lat}H360`;
  return `<path class="grat" d="${d}"/><path class="grat eq" d="M0 90H360"/>`;
}

function axisLabels() {
  let s = '';
  for (let lon = -120; lon <= 120; lon += 60) s += `<text class="map-ax" x="${lon + 180}" y="177" text-anchor="middle">${Math.abs(lon)}°${lon < 0 ? 'W' : lon > 0 ? 'E' : ''}</text>`;
  for (let lat = -60; lat <= 60; lat += 30) s += `<text class="map-ax" x="2.5" y="${90 - lat - 1.2}">${Math.abs(lat)}°${lat < 0 ? 'S' : lat > 0 ? 'N' : ''}</text>`;
  return s;
}

/**
 * Equirectangular site map.
 * opts: { body, sites, selectedId, scoreOf(site)->0..1|null, rankOf(site)->n|null, label }
 */
export function siteMap({ body, sites, selectedId, scoreOf, rankOf, ariaLabel, labels = false }) {
  const isEarth = body === 'Earth';
  const marks = sites.map(s => {
    const x = s.lon + 180, y = Math.min(176, Math.max(4, 90 - s.lat));
    const score = scoreOf ? scoreOf(s) : null;
    const rank = rankOf ? rankOf(s) : null;
    const sel = s.id === selectedId;
    const r = score != null ? 1.6 + score * 4.2 : 2.6;
    const tipHtml = `<b>${esc(s.name)}</b><span>${esc(s['geographic.region'] || '')}</span><span class="mono">${fmtCoord(s.lat, s.lon)}</span>` +
      (score != null ? `<span class="mono">Analog score ${(score * 100).toFixed(0)}${rank ? ` · rank #${rank}` : ''}</span>` : '') +
      (s.is_control ? '<span class="warn">Negative control</span>' : '') + '<em>Click to select</em>';
    const shape = isEarth
      ? `<circle cx="${x}" cy="${y}" r="${r}" class="mk earth${s.is_control ? ' ctrl' : ''}"/>`
      : `<rect x="${x - r * 0.8}" y="${y - r * 0.8}" width="${r * 1.6}" height="${r * 1.6}" transform="rotate(45 ${x} ${y})" class="mk ${body === 'Moon' ? 'moon' : 'mars'}"/>`;
    const ring = sel ? `<circle cx="${x}" cy="${y}" r="${r + 3}" class="mk-sel"/><circle cx="${x}" cy="${y}" r="${r + 3}" class="mk-pulse"/>` : '';
    const right = x > 285;
    const nameLabel = labels ? `<text x="${right ? x - r - 2 : x + r + 2}" y="${y + 1.3}" text-anchor="${right ? 'end' : 'start'}" class="mk-name${sel ? ' sel' : ''}">${esc(s.name.split(/[,(]/)[0].trim())}</text>` : '';
    const rankLabel = rank && rank <= 5 ? `<text x="${x + r + 1.6}" y="${y + 1.3}" class="mk-rank">${rank}</text>` : '';
    return `<g class="mk-g${sel ? ' sel' : ''}" tabindex="0" role="button" aria-label="${esc(s.name)}" data-action="select-site" data-id="${esc(s.id)}" data-tip="${attrTip(tipHtml)}">${ring}<circle cx="${x}" cy="${y}" r="${Math.max(r + 2.5, 6)}" class="hit"/>${shape}${rankLabel}${nameLabel}</g>`;
  }).join('');
  return `<svg class="map map-${body.toLowerCase()}" viewBox="0 0 360 180" role="img" aria-label="${esc(ariaLabel || body + ' site map')}" preserveAspectRatio="xMidYMid meet">
    <defs>
      <radialGradient id="g-${body}" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${isEarth ? '#0f1c26' : body === 'Moon' ? '#1a1b1d' : '#24140e'}"/><stop offset="1" stop-color="#0a0d12"/></radialGradient>
    </defs>
    <rect width="360" height="180" fill="url(#g-${body})"/>
    ${isEarth ? `<path class="land" d="${EARTH_LAND_PATH}"/>` : ''}
    ${graticule()}${axisLabels()}
    ${marks}
  </svg>`;
}

/* ---------------------------------------------------------------- radar */
export function radar(dims, { size = 320, compare } = {}) {
  const n = dims.length, cx = size / 2, cy = size / 2, R = size / 2 - 52;
  const ang = i => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, v) => [cx + Math.cos(ang(i)) * R * v, cy + Math.sin(ang(i)) * R * v];
  let rings = '';
  for (const v of [0.25, 0.5, 0.75, 1]) rings += `<polygon class="rd-ring" points="${dims.map((_, i) => pt(i, v).join(',')).join(' ')}"/>`;
  const spokes = dims.map((d, i) => { const [x, y] = pt(i, 1); return `<line class="rd-spoke" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`; }).join('');
  const poly = (list, cls) => {
    const pts = list.map((d, i) => pt(i, d.score ?? 0).join(',')).join(' ');
    return `<polygon class="${cls}" points="${pts}"/>`;
  };
  const dots = dims.map((d, i) => {
    if (d.score == null) return '';
    const [x, y] = pt(i, d.score);
    const t = `<b>${esc(d.label)}</b><span class="mono">${(d.score * 100).toFixed(0)} / 100 · coverage ${(d.coverage * 100).toFixed(0)}%</span>`;
    return `<g data-tip="${attrTip(t)}" tabindex="0"><circle cx="${x}" cy="${y}" r="10" class="hit"/><circle cx="${x}" cy="${y}" r="4" class="rd-dot"/></g>`;
  }).join('');
  const labels = dims.map((d, i) => {
    const [x, y] = pt(i, 1.2);
    const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end';
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="rd-lbl${d.score == null ? ' na' : ''}"><tspan x="${x}" dy="0">${esc(d.short || d.label)}</tspan><tspan x="${x}" dy="12" class="rd-val">${d.score == null ? 'n/a' : (d.score * 100).toFixed(0)}</tspan></text>`;
  }).join('');
  return `<svg class="radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="Similarity by dimension">${rings}${spokes}${compare ? poly(compare, 'rd-poly2') : ''}${poly(dims, 'rd-poly')}${dots}${labels}</svg>`;
}

/* ---------------------------------------------------------------- heatmap */
export function heatmap({ rows, cols, cell, rowLabel, colLabel, domain = [0, 1] }) {
  const cw = 34, ch = 24, left = 200, top = 140;
  const norm = v => (v - domain[0]) / (domain[1] - domain[0] || 1);
  const W = left + cols.length * cw + 90, H = top + rows.length * ch + 4;
  let s = `<svg class="heat" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Analog score matrix">`;
  cols.forEach((c, j) => {
    const x = left + j * cw + cw / 2;
    s += `<g transform="translate(${x},${top - 8}) rotate(-55)"><text class="hm-col" data-action="pick-target" data-id="${esc(c.id)}">${esc(colLabel(c))}</text></g>`;
  });
  rows.forEach((r, i) => {
    const y = top + i * ch;
    s += `<text class="hm-row${r.is_control ? ' ctrl' : ''}" x="${left - 10}" y="${y + ch / 2 + 4}" text-anchor="end" data-action="pick-candidate" data-id="${esc(r.id)}">${esc(rowLabel(r))}</text>`;
    cols.forEach((c, j) => {
      const { value, tipHtml, best } = cell(r, c, i, j);
      const x = left + j * cw;
      const fill = value == null ? 'transparent' : rampColor(norm(value));
      s += `<g class="hm-cell" data-action="open-pair" data-a="${esc(r.id)}" data-b="${esc(c.id)}" data-tip="${attrTip(tipHtml)}" tabindex="0">
        <rect x="${x + 1}" y="${y + 1}" width="${cw - 2}" height="${ch - 2}" fill="${fill}" class="${value == null ? 'na' : ''}"/>
        ${best ? `<rect x="${x + 2.5}" y="${y + 2.5}" width="${cw - 5}" height="${ch - 5}" class="hm-best"/>` : ''}
        <text x="${x + cw / 2}" y="${y + ch / 2 + 3.5}" text-anchor="middle" class="hm-v" fill="${value != null && norm(value) > 0.55 ? '#0a0d12' : '#cfc9ba'}">${value == null ? '–' : Math.round(value * 100)}</text></g>`;
    });
  });
  return s + '</svg>';
}

/* ---------------------------------------------------------------- scatter */
export function scatter({ points, xLabel, yLabel, xLog, yLog, selectedId }) {
  const W = 640, H = 400, m = { l: 64, r: 18, t: 18, b: 48 };
  const tx = v => (xLog ? Math.log10(v + 1) : v), ty = v => (yLog ? Math.log10(v + 1) : v);
  const xs = points.map(p => tx(p.x)), ys = points.map(p => ty(p.y));
  if (!points.length) return `<div class="empty">No records have both values.</div>`;
  let [x0, x1] = [Math.min(...xs), Math.max(...xs)], [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  if (x0 === x1) { x0 -= 1; x1 += 1; } if (y0 === y1) { y0 -= 1; y1 += 1; }
  const px = (x1 - x0) * 0.06, py = (y1 - y0) * 0.08; x0 -= px; x1 += px; y0 -= py; y1 += py;
  const X = v => m.l + ((tx(v) - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = v => H - m.b - ((ty(v) - y0) / (y1 - y0)) * (H - m.t - m.b);
  const ticks = (a, b, n = 5) => {
    const raw = (b - a) / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(k => k * mag).find(st => st >= raw) || raw;
    const out = [];
    for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  };
  const inv = (v, log) => (log ? Math.pow(10, v) - 1 : v);
  const f = v => { const a = Math.abs(v); return a >= 1000 ? Math.round(v).toLocaleString('en-US') : a >= 10 ? v.toFixed(0) : a >= 1 ? v.toFixed(1) : v.toPrecision(2); };
  let g = '';
  for (const t of ticks(x0, x1)) { const xv = m.l + ((t - x0) / (x1 - x0)) * (W - m.l - m.r); g += `<line class="sc-grid" x1="${xv}" x2="${xv}" y1="${m.t}" y2="${H - m.b}"/><text class="sc-tk" x="${xv}" y="${H - m.b + 16}" text-anchor="middle">${f(inv(t, xLog))}</text>`; }
  for (const t of ticks(y0, y1)) { const yv = H - m.b - ((t - y0) / (y1 - y0)) * (H - m.t - m.b); g += `<line class="sc-grid" x1="${m.l}" x2="${W - m.r}" y1="${yv}" y2="${yv}"/><text class="sc-tk" x="${m.l - 8}" y="${yv + 4}" text-anchor="end">${f(inv(t, yLog))}</text>`; }
  const dots = points.map(p => {
    const x = X(p.x), y = Y(p.y), sel = p.id === selectedId;
    const t = `<b>${esc(p.name)}</b><span class="mono">${esc(xLabel)}: ${esc(p.xs)}</span><span class="mono">${esc(yLabel)}: ${esc(p.ys)}</span>`;
    const mk = p.body === 'Mars'
      ? `<rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" transform="rotate(45 ${x} ${y})" class="mk mars"/>`
      : p.body === 'Earth' ? `<circle cx="${x}" cy="${y}" r="5" class="mk earth${p.ctrl ? ' ctrl' : ''}"/>` : `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" class="mk moon"/>`;
    return `<g class="mk-g${sel ? ' sel' : ''}" data-action="open-site" data-id="${esc(p.id)}" data-tip="${attrTip(t)}" tabindex="0"><circle cx="${x}" cy="${y}" r="11" class="hit"/>${sel ? `<circle cx="${x}" cy="${y}" r="9" class="mk-sel"/>` : ''}${mk}</g>`;
  }).join('');
  return `<svg class="scatter" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(yLabel)} versus ${esc(xLabel)}">${g}
    <line class="sc-axis" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/><line class="sc-axis" x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${H - m.b}"/>
    <text class="sc-lbl" x="${(W + m.l) / 2}" y="${H - 8}" text-anchor="middle">${esc(xLabel)}${xLog ? ' (log)' : ''}</text>
    <text class="sc-lbl" transform="translate(16 ${(H - m.b + m.t) / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}${yLog ? ' (log)' : ''}</text>
    ${dots}</svg>`;
}

/* ---------------------------------------------------------------- score dial */
export function dial(score, label) {
  const r = 54, c = 2 * Math.PI * r, frac = Math.max(0, Math.min(1, score));
  let ticks = '';
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * 2 * Math.PI - Math.PI / 2, r1 = 66, r2 = i % 5 ? 70 : 74;
    ticks += `<line x1="${70 + Math.cos(a) * r1}" y1="${70 + Math.sin(a) * r1}" x2="${70 + Math.cos(a) * r2}" y2="${70 + Math.sin(a) * r2}" class="dl-tick"/>`;
  }
  return `<svg class="dial" viewBox="0 0 140 140" role="img" aria-label="${esc(label)} ${(score * 100).toFixed(0)} of 100">
    ${ticks}<circle cx="70" cy="70" r="${r}" class="dl-track"/>
    <circle cx="70" cy="70" r="${r}" class="dl-val" stroke-dasharray="${c * frac} ${c}" transform="rotate(-90 70 70)"/>
    <text x="70" y="76" text-anchor="middle" class="dl-num">${(score * 100).toFixed(0)}</text>
    <text x="70" y="94" text-anchor="middle" class="dl-cap">/ 100</text></svg>`;
}

/* ---------------------------------------------------------------- bars */
export function miniBars(dims) {
  return `<span class="minibars" aria-hidden="true">${dims.map(d => `<i title="${esc(d.label)}" style="--v:${d.score == null ? 0 : d.score}" class="${d.score == null ? 'na' : ''}"></i>`).join('')}</span>`;
}
