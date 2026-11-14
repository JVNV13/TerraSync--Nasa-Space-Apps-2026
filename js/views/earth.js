// 03 · Earth land: measured land cover (ESA WorldCover 2021, 10 m) for three dry regions.
// Everything shown is read from data/earth_landcover.json, built from ESA_WorldCover_Processed/
// by tools/build_earth_data.py. Mars has no plants and no liquid water, so the share of bare
// ground is used as a plain-language "how Mars-like does it look" measure.
import { html, render, raw, clamp, fmtCoord, $, $$ } from '../util.js';
import { loadLandcover } from '../data.js';
import { pageHead, hint, factRow, rated, byScore, shortName } from './common.js';

const local = { tile: 0 };
let doc = null, failed = null;

const bytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const NODATA_RGB = [20, 21, 24];
const fmtKm = v => Math.round(v).toLocaleString('en-US');
const p1 = v => (v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(1) : v.toFixed(2)) + '%';

// Plain-language names for the official classes.
const PLAIN = {
  10: 'Trees', 20: 'Shrubs', 30: 'Grass', 40: 'Farmland', 50: 'Towns & roads', 60: 'Bare ground',
  70: 'Snow & ice', 80: 'Water', 90: 'Wetland', 95: 'Mangroves', 100: 'Moss & lichen',
};

export function render_(root, ctx) {
  if (!doc) {
    if (failed) { render(root, html`<section class="panel error-panel"><h2>The Earth land-cover data could not be loaded</h2><p class="mono">${failed}</p></section>`); return; }
    render(root, html`${pageHead('Earth', 'Earth land, seen from space')}<div class="boot" role="status"><span class="boot-ring"></span></div>`);
    loadLandcover().then(d => {
      doc = d;
      for (const t of d.tiles) t.grid = bytes(t.map.data);
    }).catch(err => { failed = err.message; }).finally(() => { if (root.dataset.route === 'earth') render_(root, ctx); });
    return;
  }
  const T = doc.tiles;
  local.tile = Math.min(local.tile, T.length - 1);
  const t = T[local.tile];
  const cls = Object.fromEntries(doc.classes.map(c => [c.code, c]));
  const shown = t.classes.filter(c => c.pct >= 0.05).sort((a, b) => b.pct - a.pct);
  const [W, S, E, N] = t.bounds;
  const sites = t.sites.map(s => ctx.engine.byId.get(s.id)).filter(Boolean);
  const bestFor = s => ctx.targets.map(m => ctx.engine.compare(s.id, m.id, ctx.weights())).filter(rated).sort(byScore)[0];
  // Catalogue sites that are near, but outside, this region.
  const near = ctx.earth.filter(s => !s.is_control && !t.sites.some(x => x.id === s.id) && s.lon > W - 1.5 && s.lon < E + 1.5 && s.lat > S - 1.5 && s.lat < N + 1.5);

  render(root, html`
  ${pageHead('Earth', 'Earth land, seen from space', 'European satellites sorted every 10 m of these three dry regions into land types. Mars has no plants and no liquid water, so the more bare ground a place has, the more Mars-like it looks.')}

  <div class="region-tabs" role="tablist" aria-label="Region">
    ${T.map((r, i) => html`<button class="region-tab${i === local.tile ? ' on' : ''}" role="tab" aria-selected="${String(i === local.tile)}" data-tile="${i}">
      <span class="rt-n">0${i + 1}</span><span class="rt-name">${r.name}</span>
      <span class="rt-meter"><i style="width:${r.bare_pct_of_land.toFixed(1)}%"></i></span>
      <span class="rt-v"><b>${r.bare_pct_of_land.toFixed(0)}%</b> bare ground</span>
    </button>`)}
  </div>

  <div class="earth-main">
    <figure class="panel lc-fig">
      <figcaption><span class="cap-l">${t.name}</span><span class="cap-r mono">${t.place}</span></figcaption>
      ${hint('Each colour is a type of land. Grey is bare rock and sand, the most Mars-like ground. Point at the map to read it.')}
      <div class="lc-box" id="lc-box">
        <canvas id="lc-map" role="img" aria-label="Land-cover map of ${t.name}"></canvas>
        ${sites.map(s => html`<button class="lc-pin" style="left:${((s.lon - W) / (E - W) * 100).toFixed(2)}%;top:${((N - s.lat) / (N - S) * 100).toFixed(2)}%" data-action="open-site" data-id="${s.id}" aria-label="${s.name}"><span>${shortName(s)}</span></button>`)}
        <span class="lc-n" aria-hidden="true">N ↑</span>
      </div>
      <p class="mono readout" id="lc-read" role="status">${fmtCoord(N, W)} to ${fmtCoord(S, E)} · about ${fmtKm(t.valid_km2)} km² mapped</p>
    </figure>

    <aside class="earth-side">
      <section class="panel">
        <p class="eyebrow"><span class="code">01</span>How Mars-like is the ground?</p>
        <div class="mars-meter" role="img" aria-label="${t.bare_pct_of_land.toFixed(0)} percent of the land is bare ground; Mars is 100 percent">
          <div class="mm-track"><i style="width:${t.bare_pct_of_land.toFixed(1)}%"></i><b class="mm-mars" style="left:100%"><span>Mars</span></b></div>
          <p class="mm-big"><span>${t.bare_pct_of_land.toFixed(0)}<small>%</small></span> of the land is bare rock or sand</p>
        </div>
      </section>
      <section class="panel">
        <p class="eyebrow"><span class="code">02</span>Region facts</p>
        <ul class="facts">
          ${factRow('Land area', `${fmtKm(t.land_km2)} km²`)}
          ${factRow('Bare ground', p1(t.bare_pct_of_land) + ' of land')}
          ${factRow('Plants (any kind)', p1(t.veg_pct_of_land) + ' of land')}
          ${factRow('Water', p1(t.water_pct) + ' of map')}
          ${factRow('Towns & roads', p1(t.built_pct) + ' of map')}
          ${t.valid_pct < 99 ? factRow('Open sea (not mapped)', p1(100 - t.valid_pct) + ' of tile') : ''}
        </ul>
      </section>
      <section class="panel">
        <p class="eyebrow"><span class="code">03</span>What covers the map</p>
        <ul class="lc-bars">${shown.map(c => html`<li><span class="lb-name"><i class="sw" style="background:${cls[c.code].color}"></i>${PLAIN[c.code]}</span><span class="lb-bar"><i style="width:${Math.max(0.6, c.pct).toFixed(2)}%;background:${cls[c.code].color}"></i></span><span class="lb-v mono">${p1(c.pct)}</span></li>`)}</ul>
      </section>
    </aside>
  </div>

  ${sites.length || near.length ? html`<section class="panel">
    <p class="eyebrow"><span class="code">04</span>Our Earth places in this region</p>
    <div class="site-cards">
      ${sites.map(s => { const v = s._landcover, b = bestFor(s); return html`<article class="site-card">
        <h3>${s.name}</h3>
        <p class="dim">${s.summary}</p>
        <ul class="facts">
          ${factRow(html`Plants within ${v.radius_km} km <span class="pv pv-measured" data-tip="Measured · ESA WorldCover 2021">M</span>`, `${v.fields['habitability.vegetation_cover_pct']}% of land`)}
          ${factRow('Bare ground within ' + v.radius_km + ' km', `${v.bare_pct_of_land}% of land`)}
          ${v.water_pct > 0.5 ? factRow('Sea or lakes within ' + v.radius_km + ' km', `${v.water_pct}%`) : ''}
          ${b ? factRow('Closest Mars match', html`${shortName(b.target)} · ${Math.round(b.score * 100)}`) : ''}
        </ul>
        ${b ? html`<button class="btn primary small" data-action="open-pair" data-a="${s.id}" data-b="${b.target.id}">Compare with Mars →</button>` : ''}
      </article>`; })}
      ${near.map(s => html`<article class="site-card muted">
        <h3>${s.name}</h3>
        <p class="dim">Just outside this map (${fmtCoord(s.lat, s.lon)}), so its land cover is not measured here yet.</p>
        <button class="btn small" data-action="open-site" data-id="${s.id}">View record</button>
      </article>`)}
    </div>
    <p class="small dim">The measured plant cover replaces the old placeholder value for these places, so their Mars match scores now use real Earth data.</p>
  </section>` : ''}

  <section class="panel">
    <p class="eyebrow"><span class="code">05</span>The three regions side by side</p>
    ${hint('Longer grey bar = more bare ground = more Mars-like.')}
    <ul class="region-compare">${T.map(r => {
      const land = 100 - r.water_pct;
      const parts = [['Bare ground', r.bare_pct_of_land * land / 100, '#b4b4b4'], ['Plants', r.veg_pct_of_land * land / 100, '#6f9a4a'], ['Water', r.water_pct, '#0064c8']];
      return html`<li><span class="rc-name">${r.name}</span><span class="rc-bar">${parts.map(([n, v, c]) => html`<i style="flex:${v.toFixed(3)};background:${c}" data-tip="${`<b>${n}</b><span class="mono">${p1(v)} of the mapped area</span>`}"></i>`)}</span><span class="rc-v mono">${r.bare_pct_of_land.toFixed(0)}% bare</span></li>`;
    })}</ul>
    <div class="map-legend"><span><i class="lg-sq" style="background:#b4b4b4"></i>Bare ground</span><span><i class="lg-sq" style="background:#6f9a4a"></i>Plants</span><span><i class="lg-sq" style="background:#0064c8"></i>Water</span></div>
  </section>

  <details class="panel tech">
    <summary>Technical details</summary>
    <ul class="facts">
      ${factRow('Product', doc.product)}
      ${factRow('Native resolution', '10 m (0.3 arc-second), year 2021')}
      ${factRow('Class shares', 'Exact count of every native pixel')}
      ${factRow('Map on this page', `Every 24th pixel (~220 m), shown at ${t.map.width} × ${t.map.height} cells`)}
      ${factRow('Site values', 'Share of land within 5 km, from the same ~220 m samples')}
      ${factRow('Tile', `${t.id} · ${W}° to ${E}° lon, ${S}° to ${N}° lat`)}
      ${factRow('Licence', doc.license)}
    </ul>
    <p class="small dim">Satellite classes are not field-checked. For example, thin lichen and grass on young lava (Lanzarote) is classed as grassland or shrubs. Areas are on the ellipsoid, not slope-corrected. ${doc.credit}. Citation: ${doc.citation}.</p>
  </details>`);

  // ---- map
  const cv = $('#lc-map', root), w = t.map.width, h = t.map.height;
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), img = g.createImageData(w, h);
  const pal = [NODATA_RGB, ...doc.classes.map(c => hex(c.color))];
  for (let i = 0; i < t.grid.length; i++) img.data.set([...pal[t.grid[i]], 255], i * 4);
  g.putImageData(img, 0, 0);

  const read = $('#lc-read', root), box = $('#lc-box', root);
  box.addEventListener('pointermove', e => {
    if (e.target.closest('.lc-pin')) return;
    const r = cv.getBoundingClientRect();
    const c = clamp(Math.floor((e.clientX - r.left) / r.width * w), 0, w - 1);
    const rw = clamp(Math.floor((e.clientY - r.top) / r.height * h), 0, h - 1);
    const k = t.grid[rw * w + c];
    const lat = N - (rw + 0.5) / h * (N - S), lon = W + (c + 0.5) / w * (E - W);
    read.textContent = `${fmtCoord(lat, lon)} · ${k ? PLAIN[doc.classes[k - 1].code] : 'open sea (no data)'}`;
  });
  $$('[data-tile]', root).forEach(b => b.addEventListener('click', () => { local.tile = +b.dataset.tile; render_(root, ctx); }));
}
export { render_ as render };
