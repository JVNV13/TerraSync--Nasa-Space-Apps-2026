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
  // Measured sites are drawn last (on top). A name label is dropped when it would sit on an earlier one.
  const ordered = [...sites].sort((p, q) => (p.provenance === 'measured') - (q.provenance === 'measured') || (p.id === selectedId) - (q.id === selectedId));
  const labelled = [];
  const marks = ordered.map(s => {
    const x = s.lon + 180, y = Math.min(176, Math.max(4, 90 - s.lat));
    const score = scoreOf ? scoreOf(s) : null;
    const rank = rankOf ? rankOf(s) : null;
    const sel = s.id === selectedId;
    const r = score != null ? 1.6 + score * 4.2 : 2.6;
    const tipHtml = `<b>${esc(s.name)}</b><span>${esc(s['geographic.region'] || '')}</span><span class="mono">${fmtCoord(s.lat, s.lon)}</span>` +
      (score != null ? `<span class="mono">Analog score ${(score * 100).toFixed(0)}${rank ? ` · rank #${rank}` : ''}</span>` : '') +
      (s.is_control ? '<span class="warn">Negative control</span>' : '') + `<span class="mono">${esc(s.provenance || '')} record</span>` + '<em>Click to select</em>';
    const shape = isEarth
      ? `<circle cx="${x}" cy="${y}" r="${r}" class="mk earth${s.is_control ? ' ctrl' : ''}"/>`
      : `<rect x="${x - r * 0.8}" y="${y - r * 0.8}" width="${r * 1.6}" height="${r * 1.6}" transform="rotate(45 ${x} ${y})" class="mk ${body === 'Moon' ? 'moon' : 'mars'}"/>`;
    const ring = sel ? `<circle cx="${x}" cy="${y}" r="${r + 3}" class="mk-sel"/><circle cx="${x}" cy="${y}" r="${r + 3}" class="mk-pulse"/>` : '';
    const right = x > 285;
    const clash = labelled.some(([lx, ly]) => Math.abs(lx - x) < 30 && Math.abs(ly - y) < 4);
    const showName = labels && (sel || !clash);
    if (showName) labelled.push([x, y]);
    const nameLabel = showName ? `<text x="${right ? x - r - 2 : x + r + 2}" y="${y + 1.3}" text-anchor="${right ? 'end' : 'start'}" class="mk-name${sel ? ' sel' : ''}">${esc(s.name.split(/[,(]/)[0].trim())}</text>` : '';
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

/* ---------------------------------------------------------------- slope distributions */
/**
 * Overlaid slope distributions (share of cells per 1° bin).
 * series: [{ name, hist, color, dash }]   refs: [{ name, color, mean }] for sites that only report a mean.
 */
export function slopeDist({ series, refs = [], ariaLabel = 'Slope distributions' }) {
  const W = 640, H = 300, m = { l: 52, r: 16, t: 14, b: 44 };
  const norm = series.map(s => { const n = s.hist.reduce((a, b) => a + b, 0); return s.hist.map(c => c / n); });
  const lastBin = Math.max(...series.map(s => s.hist.length), ...refs.map(r => Math.ceil(r.mean) + 1), 10);
  const xMax = Math.min(90, Math.ceil((lastBin + 1) / 5) * 5);
  const peak = Math.max(...norm.flat());
  const yStep = peak > 0.2 ? 0.05 : peak > 0.08 ? 0.02 : 0.01;
  const yMax = Math.ceil(peak / yStep + 0.3) * yStep;
  const X = v => m.l + (v / xMax) * (W - m.l - m.r), Y = v => H - m.b - (v / yMax) * (H - m.t - m.b);
  let g = '';
  for (let v = 0; v <= yMax + 1e-9; v += yStep) g += `<line class="sc-grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="sc-tk" x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${(v * 100).toFixed(0)}%</text>`;
  for (let v = 0; v <= xMax; v += 5) g += `<text class="sc-tk" x="${X(v)}" y="${H - m.b + 16}" text-anchor="middle">${v}°</text>`;
  const paths = series.map((s, k) => {
    let d = `M${X(0)} ${Y(0)}`;
    for (let i = 0; i < xMax; i++) d += `V${Y(norm[k][i] || 0)}H${X(i + 1)}`;
    return `<path d="${d}V${Y(0)}Z" fill="${s.color}" fill-opacity="0.12"/><path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"${s.dash ? ' stroke-dasharray="5 3"' : ''}/>`;
  }).join('');
  const refLines = refs.map((r, k) => `<line x1="${X(r.mean)}" x2="${X(r.mean)}" y1="${m.t}" y2="${Y(0)}" stroke="${r.color}" stroke-width="2" stroke-dasharray="2 4"/><text class="sc-tk" x="${X(r.mean) + 6}" y="${m.t + 10 + k * 14}">${esc(r.name)}: mean ${r.mean.toFixed(1)}° only</text>`).join('');
  let hits = '';
  for (let i = 0; i < xMax; i++) {
    const rows = series.map((s, k) => `<span class="mono"><i class="sw" style="background:${s.color}"></i>${esc(s.name)}: ${((norm[k][i] || 0) * 100).toFixed(1)}%</span>`).join('');
    hits += `<rect class="sd-hit" x="${X(i)}" y="${m.t}" width="${X(i + 1) - X(i)}" height="${H - m.t - m.b}" data-tip="${attrTip(`<b>Slope ${i}–${i + 1}°</b>${rows}`)}"/>`;
  }
  return `<svg class="scatter slope-dist" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ariaLabel)}">${g}
    <line class="sc-axis" x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}"/>
    ${paths}${refLines}${hits}
    <text class="sc-lbl" x="${(W + m.l) / 2}" y="${H - 8}" text-anchor="middle">Slope (1° bins)</text>
    <text class="sc-lbl" transform="translate(14 ${(H - m.b + m.t) / 2}) rotate(-90)" text-anchor="middle">Share of cells</text></svg>`;
}

/* ---------------------------------------------------------------- shadow share by Sun azimuth */
/** lines: [{ label, color, values:[0..1|null] }] over categorical x labels; mark: { line, index } is ringed. */
export function azimuthLines({ labels, lines, mark, yLabel }) {
  const W = 640, H = 260, m = { l: 52, r: 44, t: 14, b: 44 };
  const X = i => m.l + (i / (labels.length - 1)) * (W - m.l - m.r), Y = v => H - m.b - v * (H - m.t - m.b);
  let g = '';
  for (let v = 0; v <= 1.001; v += 0.25) g += `<line class="sc-grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="sc-tk" x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${v * 100}%</text>`;
  labels.forEach((l, i) => { g += `<text class="sc-tk" x="${X(i)}" y="${H - m.b + 16}" text-anchor="middle">${esc(l)}</text>`; });
  const body = lines.map((ln, k) => {
    const pts = ln.values.map((v, i) => (v == null ? null : [X(i), Y(v)]));
    const d = pts.map((p, i) => (p ? `${i && pts[i - 1] ? 'L' : 'M'}${p[0]} ${p[1]}` : '')).join('');
    const dots = pts.map((p, i) => p ? `<g data-tip="${attrTip(`<b>Sun ${esc(ln.label)} above horizon, from ${esc(labels[i])}</b><span class="mono">${(ln.values[i] * 100).toFixed(1)}% of resolved cells in shadow</span>`)}"><circle cx="${p[0]}" cy="${p[1]}" r="10" class="hit"/><circle cx="${p[0]}" cy="${p[1]}" r="${mark && mark.line === k && mark.index === i ? 5 : 3}" fill="${ln.color}" stroke="#0c1017" stroke-width="2"/>${mark && mark.line === k && mark.index === i ? `<circle cx="${p[0]}" cy="${p[1]}" r="9" class="mk-sel"/>` : ''}</g>` : '').join('');
    const last = pts.filter(Boolean).at(-1);
    return `<path d="${d}" fill="none" stroke="${ln.color}" stroke-width="2"/>${dots}${last ? `<text class="sc-tk" x="${last[0] + 10}" y="${last[1] + 4}">${esc(ln.label)}</text>` : ''}`;
  }).join('');
  return `<svg class="scatter" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(yLabel)} by Sun azimuth">${g}<line class="sc-axis" x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}"/>${body}
    <text class="sc-lbl" x="${(W + m.l) / 2}" y="${H - 8}" text-anchor="middle">Sun azimuth (direction the light comes from, grid north = N)</text>
    <text class="sc-lbl" transform="translate(14 ${(H - m.b + m.t) / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text></svg>`;
}
