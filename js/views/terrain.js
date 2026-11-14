// 02 · Mars terrain: measured elevation and slope maps of the HiRISE patches, a Sun slider that
// switches between the pipeline's 24 shadow maps, and slope distributions compared as distributions.
// Everything shown here is read from data/mars_terrain.json (built from Mars_Processed/ by
// tools/build_site_data.py); nothing is computed from synthetic values.
import { html, render, raw, rampColor, clamp, $, $$ } from '../util.js';
import { slopeDist, azimuthLines } from '../charts.js';
import { histOverlap } from '../engine.js';
import { sectionHead, pageHead } from './common.js';

const URL = 'data/mars_terrain.json';
const K = 5;                          // canvas pixels per terrain cell
const SLOPE_SCALE = [0, 35];          // fixed colour scale, same for every patch
const COLORS = ['#d9673a', '#8f7fd6']; // patch identity (validated pair on the dark surface)
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const STATE = [
  { key: 'lit', label: 'Lit', rgb: [239, 227, 196] },
  { key: 'cast', label: 'Cast shadow', rgb: [22, 32, 66] },
  { key: 'self', label: 'Self shadow only', rgb: [70, 88, 150] },
  { key: 'unres', label: 'Unresolved', rgb: [52, 52, 50] },
];
const SLOPE_RAMP = [[14, 17, 24], [86, 38, 24], [217, 103, 58], [246, 220, 170]];

const local = { patch: 0, az: 135, alt: 1 };
let cache = null, loading = null;

const bytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const u16 = b64 => new Uint16Array(bytes(b64).buffer);

async function load() {
  if (cache) return cache;
  loading ||= fetch(URL, { cache: 'no-cache' }).then(r => {
    if (!r.ok) throw new Error(`Could not load ${URL} (HTTP ${r.status}).`);
    return r.json();
  }).then(doc => {
    for (const p of doc.patches) {
      p.elev = u16(p.elevation.data);
      p.slp = u16(p.slope.data);
      for (const s of p.scenarios) { s.st = bytes(s.state); s.ci = bytes(s.cos); }
    }
    doc.mola.grid = new Int16Array(bytes(doc.mola.data).buffer);
    return (cache = doc);
  });
  return loading;
}

function ramp(stops, t) {
  t = clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(t)), f = t - i;
  return stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
}
const rgbOf = css => css.match(/\d+/g).map(Number);
const css = c => `rgb(${c.join(',')})`;

/** Paint a w×h cell grid onto a canvas, K pixels per cell. colorOf(i) -> [r,g,b]; hatch(i) -> bool. */
function paint(canvas, w, h, colorOf, hatch) {
  canvas.width = w * K; canvas.height = h * K;
  const g = canvas.getContext('2d'), img = g.createImageData(w * K, h * K), d = img.data;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const i = r * w + c, col = colorOf(i), hz = hatch && hatch(i);
    for (let y = 0; y < K; y++) for (let x = 0; x < K; x++) {
      const o = ((r * K + y) * w * K + c * K + x) * 4;
      const line = hz && ((c * K + x + r * K + y) % 6 === 0);
      d[o] = line ? 110 : col[0]; d[o + 1] = line ? 106 : col[1]; d[o + 2] = line ? 96 : col[2]; d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

const fmtM = v => v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pc = (v, d = 1) => (v * 100).toFixed(d) + '%';
const scenario = (p, doc) => p.scenarios.find(s => s.alt === doc.sun.altitudes_deg[local.alt] && s.az === local.az);

export function render_(root, ctx) {
  if (!cache) {
    render(root, html`${sectionHead('§ TERRAIN', 'Mars terrain', 'Loading the measured terrain grids…')}<div class="boot" role="status"><span class="boot-ring"></span></div>`);
    load().then(() => { if (root.dataset.route === 'terrain') render_(root, ctx); })
      .catch(err => { if (root.dataset.route === 'terrain') render(root, html`<section class="panel error-panel"><h2>The Mars terrain data could not be loaded</h2><p class="mono">${err.message}</p></section>`); });
    return;
  }
  const doc = cache, P = doc.patches;
  local.patch = Math.min(local.patch, P.length - 1);
  const p = P[local.patch];
  const alts = doc.sun.altitudes_deg, azs = doc.sun.azimuths_deg;
  const overlap = P.length > 1 ? histOverlap(P[0].slope_distribution.counts, P[1].slope_distribution.counts) : null;
  const short = q => `Patch ${String.fromCharCode(65 + P.indexOf(q))}`;
  const inCatalog = id => ctx.engine.byId.has(id);
  const bar = html`<span class="scalebar" style="width:${(500 / (p.width * p.cell_m[0]) * 100).toFixed(2)}%">500 m</span>`;

  render(root, html`
  ${pageHead('Mars', 'The surface of Mars, up close', 'Two real patches of ground just east of Jezero crater, where the Perseverance rover explores. Each patch is about 2.4 × 3 km. Move the Sun to see where shadows fall.')}

  <div class="panel terr-ctrl">
    <div class="field"><span>Patch</span><div class="chips" role="radiogroup" aria-label="Terrain patch">
      ${P.map((q, i) => html`<button class="chip${i === local.patch ? ' on' : ''}" role="radio" aria-checked="${String(i === local.patch)}" data-patch="${i}"><i class="sw" style="background:${COLORS[i]}"></i>${short(q)} · ${i ? 'south' : 'north'}</button>`)}
    </div></div>
    <label class="field sun"><span>Sun azimuth · <output id="t-az-o" class="mono"></output></span>
      <input type="range" id="t-az" min="${azs[0]}" max="${azs.at(-1)}" step="${azs[1] - azs[0]}" value="${local.az}" aria-label="Sun azimuth in degrees clockwise from grid north"></label>
    <label class="field sun"><span>Sun elevation · <output id="t-alt-o" class="mono"></output></span>
      <input type="range" id="t-alt" min="0" max="${alts.length - 1}" step="1" value="${local.alt}" aria-label="Sun elevation above the horizon"></label>
    <div class="sun-dial" id="t-dial" aria-hidden="true"></div>
  </div>

  <div class="terr-maps">
    ${[['elev', 'Height', `${fmtM(p.elevation.min)} m`, `${fmtM(p.elevation.max)} m`, `linear-gradient(90deg,${[0, .25, .5, .75, 1].map(rampColor).join(',')})`, 'Dark = low ground, light = high ground'],
       ['slope', 'Steepness', `flat ${SLOPE_SCALE[0]}°`, `steep ${SLOPE_SCALE[1]}°+`, `linear-gradient(90deg,${SLOPE_RAMP.map(css).join(',')})`, 'Dark = flat, bright = steep']].map(([id, title, lo, hi, grad, note]) => html`
    <figure class="panel terr-fig">
      <figcaption><span class="cap-l">${title} <span class="pv pv-measured" data-tip="Measured · ${p.product}">M</span></span><span class="cap-r mono">${short(p)}</span></figcaption>
      <div class="map-box"><canvas id="t-${id}" role="img" aria-label="${title} map of ${p.name}"></canvas><i class="cell-mark"></i>${bar}</div>
      <div class="ramp-legend"><span class="mono dim">${lo}</span><i style="background:${grad}"></i><span class="mono dim">${hi}</span></div>
      <p class="small dim">${note}</p>
    </figure>`)}
    <figure class="panel terr-fig">
      <figcaption><span class="cap-l">Shadow map <span class="pv pv-measured" data-tip="Computed from the measured terrain. The Sun position is a hypothetical scenario, not a date or time.">M</span></span><span class="cap-r mono" id="t-sun-cap"></span></figcaption>
      <div class="map-box"><canvas id="t-shadow" role="img" aria-label="Shadow map of ${p.name}"></canvas><i class="cell-mark"></i>${bar}</div>
      <div class="map-legend terr-legend">${STATE.map(s => html`<span><i class="lg-sq${s.key === 'unres' ? ' hatch' : ''}" style="background-color:${css(s.rgb)}"></i>${s.label}</span>`)}</div>
      <p class="small dim">Dark blue = in shadow</p>
    </figure>
  </div>
  <div class="terr-foot">
    <span class="mono dim">grid north ↑ · ${p.size_km[0].toFixed(2)} × ${p.size_km[1].toFixed(2)} km · ${p.width} × ${p.height} cells of ${p.cell_m[0].toFixed(1)} × ${p.cell_m[1].toFixed(1)} m</span>
    <span class="mono readout" id="t-read" role="status">Point at a map to read the height, steepness and light at that spot.</span>
  </div>

  <section class="panel">
    <header class="block-head"><h2 class="block-title">How much ground is in shadow?</h2><p class="block-sub">Shadows matter for solar power, cold spots and what cameras can see.</p></header>
    <div id="t-stats"></div>
  </section>

  <div class="grid-2">
    <section class="panel">
      <header class="block-head"><h2 class="block-title">How steep is the ground?</h2><p class="block-sub">How much of each patch sits at each steepness. More area on the left = easier driving for a rover.</p></header>
      <div class="map-legend">${P.map((q, i) => html`<span><i class="lg-line${i ? ' dash' : ''}" style="--c:${COLORS[i]}"></i>${short(q)}</span>`)}</div>
      <div class="sc-wrap">${raw(slopeDist({ series: P.map((q, i) => ({ name: short(q), hist: q.slope_distribution.counts, color: COLORS[i], dash: i > 0 })), ariaLabel: 'Slope distributions of the measured Mars patches' }))}</div>
      ${overlap != null ? html`<p class="callout">The two patches have almost the same average steepness, but ${short(P[0])} has ${(P[0].slope_distribution.fraction_steeper_than['20deg'] / Math.max(P[1].slope_distribution.fraction_steeper_than['20deg'], 1e-9)).toFixed(1)}× as much very steep ground (over 20°). That is why TerraSync compares the whole spread, not just the average.</p>` : ''}
      <div class="table-wrap"><table class="data compact">
        <thead><tr><th>Patch</th><th class="num">Mean</th><th class="num">Median</th><th class="num">95th pct</th><th class="num">Max</th><th class="num">&gt; 10°</th><th class="num">&gt; 20°</th></tr></thead>
        <tbody>${P.map((q, i) => html`<tr><td><i class="sw" style="background:${COLORS[i]}"></i>${short(q)}</td><td class="num mono">${q.slope.mean.toFixed(1)}°</td><td class="num mono">${q.slope_distribution.percentiles_deg.p50.toFixed(1)}°</td><td class="num mono">${q.slope_distribution.percentiles_deg.p95.toFixed(1)}°</td><td class="num mono">${q.slope.max.toFixed(1)}°</td><td class="num mono">${pc(q.slope_distribution.fraction_steeper_than['10deg'])}</td><td class="num mono">${pc(q.slope_distribution.fraction_steeper_than['20deg'])}</td></tr>`)}</tbody>
      </table></div>
    </section>
    <section class="panel">
      <header class="block-head"><h2 class="block-title">Shadow for every Sun position</h2><p class="block-sub">${short(p)}. Each line is one Sun height; a low Sun casts long shadows. The ringed point is what the map shows.</p></header>
      <div id="t-azchart" class="sc-wrap"></div>
    </section>
  </div>

  <div class="grid-2">
    <details class="panel tech">
      <summary>Technical details: patch record</summary>
      <div class="table-wrap"><table class="data compact">
        <thead><tr><th>Quantity</th>${P.map((q, i) => html`<th><i class="sw" style="background:${COLORS[i]}"></i>${short(q)}</th>`)}</tr></thead>
        <tbody>
          ${[['HiRISE DTM product', q => q.source],
             ['Centre (planetocentric, east +)', q => `${q.center_lonlat[1].toFixed(3)}°N ${q.center_lonlat[0].toFixed(3)}°E`],
             ['Elevation range', q => `${fmtM(q.elevation.min)} to ${fmtM(q.elevation.max)} m`],
             ['Mean elevation', q => `${fmtM(q.elevation.mean)} m`],
             ['Local relief, 150 m window (mean)', q => `${q.relief_150m.mean.toFixed(1)} m`],
             ['Roughness, elevation σ in 150 m (mean)', q => `${q.roughness_std_150m.mean.toFixed(2)} m`],
             ['Prevailing downslope direction', q => `${COMPASS[Math.round(q.aspect.circular_mean / 45) % 8]} (${q.aspect.circular_mean.toFixed(0)}°)`],
             ['MOLA elevation at centre (context)', q => `${q.mola_at_center_m.toLocaleString('en-US')} m`],
            ].map(([label, fn]) => html`<tr><td>${label}</td>${P.map(q => html`<td class="mono">${fn(q)}</td>`)}</tr>`)}
        </tbody></table></div>
      <p class="small dim">Elevation datum: ${p.vertical_reference}. MOLA uses a different datum and is shown only as context.</p>
      <p>${P.filter(q => inCatalog(q.id)).map(q => html`<button class="btn small" data-action="open-site" data-id="${q.id}">${short(q)} catalogue record</button> `)}</p>
      <p class="small dim">Elevation, slope and shadows come from HiRISE stereo terrain models, averaged to ~30 m cells. The Sun positions (${alts.join('°, ')}° high, from eight directions) are “what if” scenarios, not real dates. Shadows from hills more than ${doc.sun.max_ray_m.toLocaleString('en-US')} m away, small rocks and the atmosphere are not modelled; cells whose shadow ray leaves the patch are marked unresolved.</p>
    </details>
    <figure class="panel terr-fig">
      <figcaption><span class="cap-l">Where the patches are <span class="pv pv-measured" data-tip="Measured · MOLA MEGDR ${doc.mola.pixels_per_degree} px/degree (${doc.mola.source})">M</span></span><span class="cap-r mono">${doc.mola.bounds_lonlat[0]}–${doc.mola.bounds_lonlat[2]}°E · ${doc.mola.bounds_lonlat[1]}–${doc.mola.bounds_lonlat[3]}°N</span></figcaption>
      <div class="map-box ctx"><canvas id="t-mola" role="img" aria-label="MOLA regional elevation with the two patch footprints"></canvas>
        ${P.map((q, i) => { const [W, S, E, N] = doc.mola.bounds_lonlat, [x0, y0, x1, y1] = q.bounds_lonlat; return html`<span class="ctx-mark" style="left:${((x0 - W) / (E - W) * 100).toFixed(2)}%;top:${((N - y1) / (N - S) * 100).toFixed(2)}%;width:${((x1 - x0) / (E - W) * 100).toFixed(2)}%;height:${((y1 - y0) / (N - S) * 100).toFixed(2)}%;--c:${COLORS[i]}"><b>${String.fromCharCode(65 + i)}</b></span>`; })}
      </div>
      <div class="ramp-legend"><span class="mono dim">${doc.mola.min.toLocaleString('en-US')} m</span><i style="background:linear-gradient(90deg,${[0, .25, .5, .75, 1].map(rampColor).join(',')})"></i><span class="mono dim">${doc.mola.max.toLocaleString('en-US')} m</span></div>
      <p class="small dim">A wider height map of the area from NASA's MOLA laser. The small squares A and B are the two patches, drawn at true size.</p>
    </figure>
  </div>`);

  // ---- static maps
  const n = p.width * p.height;
  const eRange = p.elevation.max - p.elevation.min;
  paint($('#t-elev', root), p.width, p.height, i => rgbOf(rampColor((p.elev[i] * p.elevation.scale) / eRange)));
  paint($('#t-slope', root), p.width, p.height, i => (p.slp[i] === p.slope.nodata ? [30, 30, 30] : ramp(SLOPE_RAMP, (p.slp[i] * p.slope.scale - SLOPE_SCALE[0]) / (SLOPE_SCALE[1] - SLOPE_SCALE[0]))), i => p.slp[i] === p.slope.nodata);
  const M = doc.mola, mc = $('#t-mola', root);
  mc.width = M.width; mc.height = M.height;
  const mg = mc.getContext('2d'), mi = mg.createImageData(M.width, M.height);
  for (let i = 0; i < M.grid.length; i++) { const c = rgbOf(rampColor((M.grid[i] - M.min) / (M.max - M.min))); mi.data.set([c[0], c[1], c[2], 255], i * 4); }
  mg.putImageData(mi, 0, 0);

  // ---- Sun-dependent parts
  const update = () => {
    const s = scenario(p, doc), alt = alts[local.alt];
    $('#t-az-o', root).textContent = `${local.az}° · from ${COMPASS[azs.indexOf(local.az)]}`;
    $('#t-alt-o', root).textContent = `${alt}° above horizon`;
    $('#t-sun-cap', root).textContent = `Sun ${alt}° high, from ${COMPASS[azs.indexOf(local.az)]}`;
    paint($('#t-shadow', root), p.width, p.height, i => {
      const st = s.st[i];
      if (st !== 0) return STATE[st].rgb;
      const b = 0.3 + 0.7 * clamp((s.ci[i] / 127 - 1) / 0.75, 0, 1);
      return STATE[0].rgb.map(v => Math.round(v * b));
    }, i => s.st[i] === 3);
    const a = (local.az - 90) * Math.PI / 180, rr = 30 * (1 - alt / 90);
    $('#t-dial', root).innerHTML = `<svg viewBox="-44 -44 88 88"><circle r="30" class="sd-ring"/><circle r="15" class="sd-ring in"/><path d="M0-34V-28M34 0H28M0 34V28M-34 0H-28" class="sd-tick"/><text y="-36" text-anchor="middle" class="sd-n">N</text><line x1="0" y1="0" x2="${Math.cos(a) * rr}" y2="${Math.sin(a) * rr}" class="sd-ray"/><circle cx="${Math.cos(a) * rr}" cy="${Math.sin(a) * rr}" r="5" class="sd-sun"/><circle r="2" class="sd-c"/></svg>`;
    const parts = [['lit', s.lit], ['cast', s.cast], ['self', s.self_only], ['unres', s.unresolved]];
    const resolved = n - s.unresolved;
    $('#t-stats', root).innerHTML = html`
      <div class="tiles">
        <div class="tile main"><dt>In shadow</dt><dd class="mono">${resolved ? pc((s.cast + s.self_only) / resolved) : '—'}</dd><small>of the ground we could check (${pc(resolved / n, 0)})</small></div>
        ${parts.map(([k, v]) => html`<div class="tile"><dt><i class="lg-sq${k === 'unres' ? ' hatch' : ''}" style="background-color:${css(STATE.find(x => x.key === k).rgb)}"></i>${STATE.find(x => x.key === k).label}</dt><dd class="mono">${pc(v / n)}</dd><small>${v.toLocaleString('en-US')} cells</small></div>`)}
      </div>
      <div class="stack" role="img" aria-label="Share of all cells by illumination state">${parts.map(([k, v]) => html`<i class="${k === 'unres' ? 'hatch' : ''}" style="flex:${v};background-color:${css(STATE.find(x => x.key === k).rgb)}" data-tip="${`<b>${STATE.find(x => x.key === k).label}</b><span class="mono">${pc(v / n)} of all cells</span>`}"></i>`)}</div>`.s;
    $('#t-azchart', root).innerHTML = azimuthLines({
      labels: azs.map((_, i) => COMPASS[i]),
      lines: alts.map((al, k) => ({ label: `${al}°`, color: ['#ebe6da', '#a69f8e', '#6e6a60'][k] || '#a69f8e', values: azs.map(z => p.scenarios.find(q => q.alt === al && q.az === z).shadowed_of_resolved) })),
      mark: { line: local.alt, index: azs.indexOf(local.az) }, yLabel: 'In shadow',
    });
  };
  update();

  // ---- events
  $$('[data-patch]', root).forEach(b => b.addEventListener('click', () => { local.patch = +b.dataset.patch; render_(root, ctx); }));
  $('#t-az', root).addEventListener('input', e => { local.az = +e.target.value; update(); });
  $('#t-alt', root).addEventListener('input', e => { local.alt = +e.target.value; update(); });

  const boxes = $$('.terr-maps .map-box', root), read = $('#t-read', root);
  const point = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const c = clamp(Math.floor((e.clientX - r.left) / r.width * p.width), 0, p.width - 1);
    const rw = clamp(Math.floor((e.clientY - r.top) / r.height * p.height), 0, p.height - 1);
    const i = rw * p.width + c, s = scenario(p, doc);
    for (const b of boxes) {
      const mk = b.querySelector('.cell-mark');
      mk.style.cssText = `display:block;left:${c / p.width * 100}%;top:${rw / p.height * 100}%;width:${100 / p.width}%;height:${100 / p.height}%`;
    }
    const slope = p.slp[i] === p.slope.nodata ? 'slope n/a (patch edge)' : `slope ${(p.slp[i] * p.slope.scale).toFixed(1)}°`;
    read.textContent = `${(c * p.cell_m[0]).toFixed(0)} m E, ${((p.height - 1 - rw) * p.cell_m[1]).toFixed(0)} m N of the SW corner · elevation ${fmtM(p.elevation.offset + p.elev[i] * p.elevation.scale)} m · ${slope} · ${STATE[s.st[i]].label.toLowerCase()}`;
  };
  for (const b of boxes) {
    b.addEventListener('pointermove', point);
    b.addEventListener('pointerdown', point);
    b.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { boxes.forEach(x => (x.querySelector('.cell-mark').style.display = 'none')); read.textContent = 'Point at a map to read a cell.'; } });
  }
}
export { render_ as render };
