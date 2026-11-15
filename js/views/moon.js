// 02 · Moon — "Lunar Light": find places on Earth whose light and shadow behave like the
// lunar south pole. Everything shown is read from data/moon_light.json and images/moon/,
// which tools/lunar_light/build.py computes offline from elevation models.
import { html, render, raw, esc, $, $$ } from '../util.js';
import { heroArt, tiltArt, shadowArt, cameraArt, pathsArt, skyArt, ICONS } from '../moon-art.js';
import { EARTH_LAND_PATH } from '../earth-land.js';

const SECTIONS = [
  ['problem', 'Problem'], ['idea', 'Idea'], ['science', 'Science'], ['data', 'Data'],
  ['method', 'Method'], ['results', 'Results'], ['scale', 'How this scales'], ['limits', 'Limits'],
];
const METRIC = {
  shadow_fraction: { label: 'Ground in shadow', fmt: v => `${Math.round(v * 100)}%`, what: 'how much of the ground is dark' },
  shadow_run_km: { label: 'Typical shadow length', fmt: v => `${v < 1 ? Math.round(v * 1000) + ' m' : v.toFixed(1) + ' km'}`, what: 'how far a shadow stretches along the Sun line' },
  patch_km2: { label: 'Typical dark patch', fmt: v => `${v < 1 ? v.toFixed(2) : v.toFixed(1)} km²`, what: 'the size of the dark area a rover would be in' },
  edge_km_per_km2: { label: 'Light/dark edges', fmt: v => `${v.toFixed(2)} km/km²`, what: 'how often the ground switches between light and dark' },
  always_dark_fraction: { label: 'Dark from every direction', fmt: v => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`, what: 'ground that stays dark wherever the Sun is' },
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const C = { shadow: '#3987e5', time: '#c98500' };

let DATA = null, loading = null, observer = null;
const bound = new WeakSet();
const ui = { earth: null, moon: null, alt: 1, sciAlt: 1 };

const loadData = () => (loading ||= fetch('data/moon_light.json').then(r => { if (!r.ok) throw new Error(`data/moon_light.json: HTTP ${r.status}`); return r.json(); }));

/* ------------------------------------------------------------------ helpers */
const pct100 = v => Math.round(v * 100);
const byId = (list, id) => list.find(s => s.id === id);
const pairOf = (e, m) => DATA.pairs.find(p => p.earth === e && p.moon === m);
const latTxt = lat => `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? 'N' : 'S'}`;
const fmtH = h => (h >= 48 ? `${(h / 24).toFixed(1)} days` : h >= 1 ? `${h.toFixed(h < 10 ? 1 : 0)} h` : `${Math.round(h * 60)} min`);
const dateTxt = iso => new Date(iso + 'Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const sectionHead = (n, id, kicker, title, lede) => html`
  <header class="ll-head"><p class="ll-kicker"><span>${n}</span>${kicker}</p><h2 id="${id}-t">${title}</h2>${lede ? html`<p class="ll-lede">${lede}</p>` : ''}</header>`;

/* ------------------------------------------------------------------ view */
export function render_(root) {
  observer?.disconnect();
  render(root, html`
  <div class="ll">
    ${hero()}
    <nav class="ll-nav" aria-label="Sections of this page">
      <span class="ll-nav-brand">Lunar Light</span>
      ${SECTIONS.map(([id, label], i) => html`<button type="button" data-goto="${id}"><i>0${i + 1}</i>${label}</button>`)}
    </nav>
    ${problem()}
    ${idea()}
    ${science()}
    <div id="ll-live"><section class="ll-sec"><div class="ll-loading"><span class="boot-ring"></span>Loading results…</div></section></div>
  </div>`);
  bindStatic(root);
  loadData().then(d => {
    DATA = d;
    if (!document.body.contains(root) || root.dataset.route !== 'moon') return;
    ui.earth ||= DATA.earth[0].id;
    ui.moon ||= DATA.earth[0].best_moon;
    render($('#ll-live', root), html`${dataPart()}${method()}${results()}${scaling()}${limits()}`);
    $('#ll-proof', root) && render($('#ll-proof', root), proofPair());
    $('#ll-lat-chart', root) && render($('#ll-lat-chart', root), latChart());
    fillHeroStats(root);
    bindLive(root);
    watchSections(root);
  }).catch(err => {
    console.error(err);
    render($('#ll-live', root), html`<section class="ll-sec"><p class="ll-error">The results file could not be loaded: ${err.message}</p></section>`);
    watchSections(root);
  });
}

/* ------------------------------------------------------------------ hero */
function hero() {
  return html`<section class="ll-hero" aria-labelledby="ll-title">
    <div class="ll-hero-copy">
      <p class="ll-kicker"><span>02</span>Moon · NASA Space Apps 2026</p>
      <h1 id="ll-title" class="ll-title">Lunar <em>Light</em></h1>
      <p class="ll-hero-lede">At the Moon's south pole the Sun never climbs more than a few degrees. Shadows run for kilometres and hide what is inside them. We search Earth for places where light and shadow behave the same way, so rovers, cameras and crews can practise there first.</p>
      <dl class="ll-hero-stats" id="ll-hero-stats">
        <div><dt>Moon places</dt><dd>—</dd></div><div><dt>Earth places</dt><dd>—</dd></div><div><dt>Sun positions each</dt><dd>—</dd></div>
      </dl>
      <div class="ll-cta"><button type="button" class="btn primary" data-goto="results">See the best Earth sites <b aria-hidden="true">→</b></button><button type="button" class="btn" data-goto="science">Why light matters</button></div>
    </div>
    <div class="ll-hero-visual">${raw(heroArt())}</div>
  </section>`;
}

function fillHeroStats(root) {
  const S = DATA.settings;
  const el = $('#ll-hero-stats', root); if (!el) return;
  render(el, html`
    <div><dt>Moon places</dt><dd>${DATA.moon.length}</dd></div>
    <div><dt>Earth places</dt><dd>${DATA.earth.length}</dd></div>
    <div><dt>Sun positions each</dt><dd>${S.sun_altitudes_deg.length * S.sun_azimuths_deg.length}</dd></div>`);
}

/* ------------------------------------------------------------------ 01 problem */
function problem() {
  return html`<section class="ll-sec" id="problem" aria-labelledby="problem-t">
    ${sectionHead('01', 'problem', 'The problem', 'At the south pole, the light is the hazard', 'The next astronauts are going to the Moon\'s south pole, where there is water ice and sunlight for power. The lighting there is like nowhere humans have worked before.')}
    <div class="ll-cards3">
      <article class="ll-card"><p class="ll-card-n">A</p><h3>The Sun stays on the horizon</h3><p>At the pole the Sun circles the sky just above the horizon, about once a month. It never climbs high.</p></article>
      <article class="ll-card"><p class="ll-card-n">B</p><h3>Shadows hide the ground</h3><p>A low Sun throws shadows dozens of times longer than the hill that casts them. Craters, rocks and holes disappear into black.</p></article>
      <article class="ll-card"><p class="ll-card-n">C</p><h3>Machines and people misread it</h3><p>Rover cameras cannot tell a dark hole from a dark shadow. Without haze or familiar objects, astronauts misjudge distances and sizes.</p></article>
    </div>
  </section>`;
}

/* ------------------------------------------------------------------ 02 idea */
function idea() {
  return html`<section class="ll-sec" id="idea" aria-labelledby="idea-t">
    ${sectionHead('02', 'idea', 'The idea', 'Match the light, not the rocks', null)}
    <div class="ll-split">
      <div class="ll-vs">
        <div class="ll-vs-col muted"><p class="ll-vs-h">Usual analog search</p><p>"Which places on Earth have rocks and soil like the Moon?"</p><ul><li>Lava fields</li><li>Volcanic ash</li><li>Impact craters</li></ul></div>
        <div class="ll-vs-col on"><p class="ll-vs-h">Lunar Light</p><p>"Which places on Earth have <b>light and shadow</b> like the lunar south pole?"</p><ul><li>Long shadows from a low Sun</li><li>Patchy light and dark ground</li><li>Many hours with the Sun near the horizon</li></ul></div>
      </div>
      <p class="ll-prose">We put a simulated Sun just above the horizon of real elevation maps of the Moon and of Earth, and compare the shadows they cast. Then we add how many hours a year each Earth site actually has a low Sun. A good match is a place where NASA could test rover navigation, camera exposure and crew operations in south-pole lighting before flying.</p>
    </div>
    <figure class="ll-proof" id="ll-proof"><div class="ll-loading"><span class="boot-ring"></span>Rendering shadows…</div></figure>
  </section>`;
}

function proofPair() {
  const e = DATA.earth[0], m = byId(DATA.moon, e.best_moon), p = pairOf(e.id, m.id);
  return html`
    <div class="ll-pair">
      ${shadowImg(m, 1, 'Moon')}
      ${shadowImg(e, 1, 'Earth')}
    </div>
    <figcaption>Same Sun, two worlds: the Sun is <b>1°</b> above the horizon in both views, shining from the upper left. Black is shadow. Left: ${m.name}, Moon. Right: ${e.name}, ${e.place}. Each view is 12.8 km across. Their shadow patterns match <b>${pct100(p.shadow)}%</b>.</figcaption>`;
}

function shadowImg(site, alt, body) {
  const src = site.images[String(alt)];
  return html`<div class="ll-shot ${body.toLowerCase()}">
    <img src="${src}" alt="Computed shadows at ${site.name} with the Sun ${alt}° above the horizon" loading="lazy" decoding="async" width="320" height="320">
    <span class="ll-shot-tag">${body} · ${site.name}</span>
    <span class="ll-scale" aria-hidden="true"><span style="margin-right:12px">3.2 km</span><i></i></span>
  </div>`;
}

/* ------------------------------------------------------------------ 03 science */
function science() {
  const rows = [1, 3, 5, 7].map(a => [a, 1 / Math.tan((a * Math.PI) / 180)]);
  return html`<section class="ll-sec" id="science" aria-labelledby="science-t">
    ${sectionHead('03', 'science', 'The science', 'Five facts behind the idea', null)}
    <div class="ll-sci">
      <article class="ll-sci-item">
        <div class="ll-sci-txt"><p class="ll-sci-n">3.1</p><h3>Why the Sun stays low at the lunar south pole</h3>
          <p>Earth's axis is tilted 23.4°, so over a year the Sun climbs high in summer and drops low in winter. The Moon's axis is tilted only about <b>1.5°</b>. At the pole the Sun never rises more than about 1.5° above the horizon. It just circles the horizon once every lunar day, about 29.5 Earth days.</p></div>
        <figure class="ll-fig">${raw(tiltArt())}</figure>
      </article>
      <article class="ll-sci-item">
        <div class="ll-sci-txt"><p class="ll-sci-n">3.2</p><h3>Why a low Sun means long shadows</h3>
          <p>Shadow length = height ÷ tan(Sun elevation). At 1° that is <b>57 times</b> the height: a 10 m boulder throws a shadow more than half a kilometre long.</p>
          <label class="ll-range"><span>Sun elevation <b id="ll-sci-alt">1°</b></span><input type="range" min="1" max="30" step="1" value="1" id="ll-sci-slider" aria-label="Sun elevation in degrees"></label>
          <table class="ll-mini"><thead><tr><th>Sun</th>${rows.map(([a]) => html`<th>${a}°</th>`)}</tr></thead><tbody><tr><td>Shadow ÷ height</td>${rows.map(([, r]) => html`<td>${r.toFixed(1)}×</td>`)}</tr></tbody></table></div>
        <figure class="ll-fig" id="ll-sci-fig">${raw(shadowArt(1))}</figure>
      </article>
      <article class="ll-sci-item">
        <div class="ll-sci-txt"><p class="ll-sci-n">3.3</p><h3>Why this is dangerous</h3>
          <p><b>Rover cameras:</b> a camera set for bright, sunlit ground sees shadows as pure black, so a crater and a shadow on flat ground look the same. If the camera is set for the shadows, the sunlit ground washes out. Hazard detection and navigation lose the cues they rely on.</p>
          <p><b>Astronauts:</b> Apollo crews reported that distances and sizes were hard to judge on the Moon, because there is no haze and nothing of a known size, like a tree or a house. Long shadows make it worse.</p></div>
        <figure class="ll-fig">${raw(cameraArt())}</figure>
      </article>
      <article class="ll-sci-item">
        <div class="ll-sci-txt"><p class="ll-sci-n">3.4</p><h3>Why high latitudes get hours of low Sun</h3>
          <p>Near the equator the Sun rises almost straight up, so it passes through the low 0–7° band in about half an hour. Near the poles its path is shallow and it skims along the horizon for hours, and at the very highest latitudes for days.</p>
          <p class="ll-note">The chart below is computed from a solar-position formula, every 10 minutes through a full year. Dots are our Earth sites.</p></div>
        <figure class="ll-fig">${raw(pathsArt())}<div id="ll-lat-chart" class="ll-chart"></div></figure>
      </article>
      <article class="ll-sci-item">
        <div class="ll-sci-txt"><p class="ll-sci-n">3.5</p><h3>Geometry analogs, not brightness analogs</h3>
          <p>Earth's air scatters sunlight across the whole sky, so blue sky light always leaks into shadows and they are never fully black. On the airless Moon, a shadow is lit only by light bouncing off nearby ground. Earth sites can copy <b>where</b> shadows fall and <b>how long</b> they are, not how dark they are. In our Earth images, shadows are drawn slightly lighter for this reason.</p></div>
        <figure class="ll-fig">${raw(skyArt())}</figure>
      </article>
    </div>
  </section>`;
}

/* ------------------------------------------------------------------ latitude chart (data) */
function latChart() {
  const pts = DATA.lat_curve, W = 560, H = 230, L = 46, R = 14, T = 16, B = 34;
  const ymax = Math.ceil(Math.max(...pts.map(p => p.hours)) / 250) * 250;
  const x = lat => L + ((lat + 90) / 180) * (W - L - R), y = h => T + (1 - h / ymax) * (H - T - B);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.lat).toFixed(1)} ${y(p.hours).toFixed(1)}`).join('');
  const ticks = [0, ymax / 2, ymax];
  const sites = DATA.earth.map(e => ({ e, x: x(e.lat), y: y(e.budget.hours) }));
  return html`<svg viewBox="0 0 ${W} ${H}" class="ll-lat" role="img" aria-label="Hours per year with the Sun between 0 and 7 degrees, by latitude">
    ${ticks.map(t => raw(`<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="ll-grid"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end" class="ll-ax">${t}</text>`))}
    ${[-90, -60, -30, 0, 30, 60, 90].map(l => raw(`<text x="${x(l)}" y="${H - 12}" text-anchor="middle" class="ll-ax">${l === 0 ? '0°' : Math.abs(l) + '°' + (l > 0 ? 'N' : 'S')}</text>`))}
    <text x="${L}" y="11" class="ll-ax">hours per year with the Sun 0–7° up</text>
    <path d="${d}" fill="none" stroke="${C.time}" stroke-width="2"/>
    ${sites.map(s => raw(`<circle cx="${s.x}" cy="${s.y}" r="4.5" fill="${C.time}" stroke="#0e1117" stroke-width="2"/>`))}
    <line class="ll-cross" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>
    <rect class="ll-hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" data-l="${L}" data-w="${W - L - R}"/>
  </svg>`;
}

function bindLatHover(root) {
  const svg = $('.ll-lat', root); if (!svg) return;
  const hit = $('.ll-hit', svg), cross = $('.ll-cross', svg), tipEl = ensureTip();
  const L = +hit.dataset.l, Wd = +hit.dataset.w;
  hit.addEventListener('mousemove', ev => {
    const r = svg.getBoundingClientRect(), sx = 560 / r.width;
    const px = (ev.clientX - r.left) * sx;
    const lat = Math.max(-90, Math.min(90, ((px - L) / Wd) * 180 - 90));
    const p = DATA.lat_curve.reduce((a, b) => (Math.abs(b.lat - lat) < Math.abs(a.lat - lat) ? b : a));
    const cx = L + ((p.lat + 90) / 180) * Wd;
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    const near = DATA.earth.filter(e => Math.abs(e.lat - p.lat) <= 2).map(e => e.name);
    showTip(tipEl, ev, `<b>${latTxt(p.lat)}</b><br>${Math.round(p.hours)} h a year with the Sun 0–7° up<br>longest stretch ${fmtH(p.longest_h)}${near.length ? `<br><i>${near.map(esc).join(', ')}</i>` : ''}`);
  });
  hit.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); tipEl.classList.remove('on'); });
}

/* ------------------------------------------------------------------ 04 data */
function dataPart() {
  const f = DATA.files, S = DATA.settings;
  const tiles = [...new Set(DATA.earth.flatMap(e => e.sources))];
  return html`<section class="ll-sec" id="data" aria-labelledby="data-t">
    ${sectionHead('04', 'data', 'The data', 'Real elevation, on both worlds', 'Every shadow on this page is cast by a computer Sun over a measured elevation map. Both worlds use the same 80 m grid.')}
    <div class="ll-data">
      <article class="ll-data-card moon"><p class="ll-data-body">Moon</p><h3>LOLA south-pole elevation model</h3>
        <dl class="ll-dl"><div><dt>File</dt><dd class="mono">${f.moon_dem.path.split('/').pop()}</dd></div><div><dt>Instrument</dt><dd>Lunar Orbiter Laser Altimeter (LOLA), Lunar Reconnaissance Orbiter</dd></div>
        <div><dt>Coverage</dt><dd>${f.moon_dem.extent_km} × ${f.moon_dem.extent_km} km around the south pole (80° S to the pole)</dd></div><div><dt>Pixel size</dt><dd>${f.moon_dem.pixel_m} m · ${f.moon_dem.size_px.join(' × ')} pixels</dd></div><div><dt>Projection</dt><dd>${f.moon_dem.crs}</dd></div></dl></article>
      <article class="ll-data-card earth"><p class="ll-data-body">Earth</p><h3>Copernicus GLO-30 elevation model</h3>
        <dl class="ll-dl"><div><dt>Product</dt><dd>${f.earth_dem.product} (ESA / Airbus, TanDEM-X mission)</dd></div><div><dt>Native pixel</dt><dd>${f.earth_dem.native}, averaged to ${f.earth_dem.resampled_m} m in each site's UTM zone</dd></div>
        <div><dt>Tiles used</dt><dd>${tiles.length} one-degree tiles for ${DATA.earth.length} sites</dd></div><div><dt>Source</dt><dd><a href="${f.earth_dem.url}" target="_blank" rel="noopener">copernicus-dem-30m (AWS open data)</a></dd></div></dl></article>
    </div>
    <details class="ll-details"><summary>Every Earth tile used</summary>
      <table class="ll-table compact"><thead><tr><th>Site</th><th>Copernicus tiles</th><th>Grid</th></tr></thead><tbody>
      ${DATA.earth.map(e => html`<tr><td>${e.name}</td><td class="mono">${e.sources.map(s => s.replace('Copernicus_DSM_COG_10_', '').replace('_DEM', '')).join(', ')}</td><td class="mono">EPSG:${e.epsg}</td></tr>`)}
      </tbody></table></details>
    <p class="ll-note">Each place is a ${(S.core_px * S.pixel_m / 1000).toFixed(1)} km square, read with a ${S.shadow_cap_m / 1000} km border on every side so shadows from distant hills are included.</p>
  </section>`;
}

/* ------------------------------------------------------------------ 05 method */
function method() {
  const S = DATA.settings;
  const steps = [
    ['dem', 'Elevation maps', `Cut a ${(S.core_px * S.pixel_m / 1000).toFixed(1)} km square around each Moon and Earth place from real elevation data.`],
    ['grid', 'Same grid', `Both worlds on ${S.pixel_m} m pixels, each with its own curvature (Moon radius 1,737 km, Earth 6,371 km).`],
    ['sun', 'Simulated Sun', `Sun at ${S.sun_altitudes_deg.join('°, ')}° from ${S.sun_azimuths_deg.length} directions. Each pixel looks ${S.shadow_cap_m / 1000} km toward the Sun: blocked means shadow.`],
    ['print', 'Shadow fingerprint', 'Each shadow map becomes five numbers: shadow share, shadow length, dark-patch size, light/dark edges, and ground dark from every direction.'],
    ['compare', 'Compare', 'Each Earth fingerprint against each Moon fingerprint, only at Sun heights that place on the Moon really gets.'],
    ['clock', 'Low-Sun time', `Hours a year with the Sun ${S.low_sun_band_deg[0]}–${S.low_sun_band_deg[1]}° up at each Earth site, and the longest unbroken stretch.`],
    ['score', 'Score', `${Math.round(S.weights.shadow * 100)}% shadow similarity + ${Math.round(S.weights.time * 100)}% low-Sun time, both shown.`],
  ];
  return html`<section class="ll-sec" id="method" aria-labelledby="method-t">
    ${sectionHead('05', 'method', 'The method', 'From elevation to a score in seven steps', null)}
    <ol class="ll-steps">${steps.map(([ic, t, d], i) => html`<li class="ll-step"><svg viewBox="0 0 32 32" aria-hidden="true">${raw(ICONS[ic])}</svg><span class="ll-step-n">${i + 1}</span><h3>${t}</h3><p>${d}</p></li>`)}</ol>
    <div class="ll-fp-legend">${Object.entries(METRIC).map(([k, m]) => html`<div><b>${m.label}</b><span>${m.what}</span></div>`)}</div>
  </section>`;
}

/* ------------------------------------------------------------------ 06 results */
function results() {
  return html`<section class="ll-sec" id="results" aria-labelledby="results-t">
    ${sectionHead('06', 'results', 'The results', 'Where Earth\'s light looks most like the lunar south pole', 'Each Earth place is scored against all the Moon places. The bar shows the two parts of the score: shadow similarity (60%) and low-Sun time (40%).')}
    ${ranking()}
    <h3 class="ll-sub">Where on Earth the low Sun lingers</h3>
    ${worldMap()}
    <div class="ll-explore">
      <div class="ll-map-wrap">${moonMap()}</div>
      <div class="ll-viewer" id="ll-viewer">${viewer()}</div>
    </div>
    <h3 class="ll-sub">Every Earth place against every Moon place</h3>
    ${heatmap()}
    <h3 class="ll-sub">Site cards</h3>
    <div class="ll-site-cards">${DATA.earth.map(siteCard)}</div>
  </section>`;
}

function ranking() {
  const W = DATA.settings.weights;
  return html`<div class="ll-rank" role="table" aria-label="Earth sites ranked by score">
    <div class="ll-rank-legend" aria-hidden="true"><span><i style="background:${C.shadow}"></i>Shadow similarity × ${W.shadow}</span><span><i style="background:${C.time}"></i>Low-Sun time × ${W.time}</span></div>
    ${DATA.earth.map((e, i) => {
      const a = W.shadow * e.shadow_mean, b = W.time * e.budget.score, m = byId(DATA.moon, e.best_moon);
      return html`<button type="button" class="ll-rank-row${e.id === ui.earth ? ' on' : ''}" data-earth="${e.id}" role="row"
        data-tip="${`<b>${esc(e.name)}</b><br>Score ${pct100(e.score)} = shadow ${pct100(a)} + time ${pct100(b)}<br>Shadow similarity ${pct100(e.shadow_mean)}% · low Sun ${Math.round(e.budget.hours)} h/yr`}">
        <span class="ll-rank-n" role="cell">${String(i + 1).padStart(2, '0')}</span>
        <span class="ll-rank-name" role="cell"><b>${e.name}</b><small>${e.place} · ${latTxt(e.lat)}</small></span>
        <span class="ll-rank-bar" role="cell"><i style="width:${a * 100}%;background:${C.shadow}"></i><i style="width:${b * 100}%;background:${C.time}"></i></span>
        <span class="ll-rank-score" role="cell">${pct100(e.score)}</span>
        <span class="ll-rank-best" role="cell">best twin: ${m.name}</span>
      </button>`;
    })}
  </div>`;
}

function worldMap() {
  const pts = DATA.lat_curve, hmax = Math.max(...pts.map(p => p.hours));
  const ramp = t => { const a = [22, 18, 10], b = [255, 205, 112]; return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`; };
  const bands = pts.map(p => {
    const y0 = Math.max(0, 90 - p.lat - 1), y1 = Math.min(180, 90 - p.lat + 1);
    return `<rect x="0" y="${y0}" width="360" height="${y1 - y0}" fill="${ramp(p.hours / hmax)}" data-lat="${p.lat}"/>`;
  }).join('');
  const dots = DATA.earth.map((e, i) => `<g class="ll-wm-site" tabindex="0" data-tip="${esc(`<b>${esc(e.name)}</b>, ${esc(e.place)}<br>${Math.round(e.budget.hours)} h a year with the Sun 0–7° up<br>longest stretch ${fmtH(e.budget.longest_h)}`)}">
      <circle cx="${e.lon + 180}" cy="${90 - e.lat}" r="3.2" fill="#0e1117"/><circle cx="${e.lon + 180}" cy="${90 - e.lat}" r="2" fill="#f4f1ea"/>
      <text x="${e.lon + 180 + 4}" y="${90 - e.lat + 1.4}" class="ll-wm-n">${i + 1}</text></g>`).join('');
  const ticks = [60, 30, 0, -30, -60].map(l => `<line x1="0" x2="360" y1="${90 - l}" y2="${90 - l}" class="ll-wm-grid"/><text x="2" y="${90 - l - 1.2}" class="ll-wm-ax">${l === 0 ? '0°' : Math.abs(l) + '°' + (l > 0 ? 'N' : 'S')}</text>`).join('');
  return html`<figure class="ll-world">
    <svg viewBox="0 0 360 180" class="ll-wm" role="img" aria-label="World map: hours per year with the Sun between 0 and 7 degrees, by latitude, with our Earth sites">
      <g class="ll-wm-bands">${raw(bands)}</g>
      <path d="${EARTH_LAND_PATH}" class="ll-wm-land"/>
      ${raw(ticks)}${raw(dots)}
    </svg>
    <div class="ll-wm-legend"><span>0 h</span><i style="background:linear-gradient(90deg, ${ramp(0)}, ${ramp(0.5)}, ${ramp(1)})"></i><span>${Math.round(hmax)} h a year with the Sun 0–7° up</span></div>
    <figcaption>Low-Sun hours depend only on latitude, so this map covers the whole Earth. They peak near the polar circles (about 66°), where the Sun skims the horizon for much of the year. Numbers match the ranking above. Hover a band or a site.</figcaption>
  </figure>`;
}

function bindWorldMap(root) {
  const svg = $('.ll-wm', root); if (!svg) return;
  const tipEl = ensureTip(), bands = $('.ll-wm-bands', svg);
  bands.addEventListener('mousemove', ev => {
    const lat = +ev.target.dataset.lat; if (Number.isNaN(lat)) return;
    const p = DATA.lat_curve.find(c => c.lat === lat);
    showTip(tipEl, ev, `<b>${latTxt(lat)}</b><br>${Math.round(p.hours)} h a year with the Sun 0–7° up<br>longest stretch ${fmtH(p.longest_h)}`);
  });
  bands.addEventListener('mouseleave', () => tipEl.classList.remove('on'));
}

function moonMap() {
  const ov = DATA.overview;
  if (!ov) return '';
  return html`<figure class="ll-map">
    <div class="ll-map-img"><img src="${ov.image}" alt="The lunar south pole, shadows cast with the Sun 1° above the horizon" loading="lazy">
      ${ov.marks.map(mk => { const m = byId(DATA.moon, mk.id); return html`<button type="button" class="ll-pin${mk.id === ui.moon ? ' on' : ''}" data-moon="${mk.id}" style="left:${mk.fx * 100}%;top:${mk.fy * 100}%" aria-label="${m.name}"><span>${m.name}</span></button>`; })}
      <span class="ll-pole" aria-hidden="true" style="left:50%;top:50%">+</span>
    </div>
    <figcaption>The lunar south pole, ${ov.half_km * 2} km across, with shadows cast from LOLA elevation with the Sun 1° up. The + marks the pole. Pick a Moon place.</figcaption>
  </figure>`;
}

function viewer() {
  const e = byId(DATA.earth, ui.earth), m = byId(DATA.moon, ui.moon), p = pairOf(e.id, m.id);
  const alts = DATA.settings.sun_altitudes_deg;
  const reach = m.max_sun_deg >= ui.alt;
  const fe = e.fingerprint[ui.alt], fm = m.fingerprint[ui.alt];
  return html`
    <div class="ll-v-pick">
      <label>Earth<select id="ll-pick-earth">${DATA.earth.map(s => html`<option value="${s.id}"${s.id === e.id ? raw(' selected') : ''}>${s.name}</option>`)}</select></label>
      <label>Moon<select id="ll-pick-moon">${DATA.moon.map(s => html`<option value="${s.id}"${s.id === m.id ? raw(' selected') : ''}>${s.name}</option>`)}</select></label>
    </div>
    <div class="ll-v-sun">
      <span>Sun height</span>
      <div class="ll-seg" role="radiogroup" aria-label="Sun height">${alts.map(a => html`<button type="button" role="radio" aria-checked="${String(a === ui.alt)}" class="${a === ui.alt ? 'on' : ''}" data-alt="${a}">${a}°</button>`)}</div>
    </div>
    <div class="ll-pair">${shadowImg(m, ui.alt, 'Moon')}${shadowImg(e, ui.alt, 'Earth')}</div>
    <p class="ll-v-note">${reach
      ? html`The Sun reaches ${ui.alt}° at ${m.name} (up to about ${m.max_sun_deg.toFixed(1)}°).`
      : html`<b>Note:</b> at ${m.name} the Sun never gets above about ${m.max_sun_deg.toFixed(1)}°. This view shows the terrain's shadows if it did. The score uses only Sun heights this place really gets.`}</p>
    <div class="ll-v-score"><span class="ll-big">${pct100(p.total)}</span><span>pair score<br><small>shadow ${pct100(p.shadow)}% · time ${pct100(p.time)}%</small></span></div>
    <div class="ll-dumb" aria-label="Fingerprint at ${ui.alt} degrees">
      <div class="ll-dumb-legend" aria-hidden="true"><span><i style="background:${C.shadow}"></i>Earth</span><span><i style="background:${C.time}"></i>Moon</span></div>
      ${DATA.metrics.map(k => dumbbell(k, fe[k], fm[k]))}
    </div>`;
}

function dumbbell(k, a, b) {
  const sc = DATA.settings.metric_scales[k];
  const pos = v => {
    if (v == null) return null;
    let lo = sc.lo, hi = sc.hi, t = Math.min(Math.max(v, lo), hi);
    if (sc.kind === 'log') { lo = Math.log10(lo); hi = Math.log10(hi); t = Math.log10(t); }
    return ((t - lo) / (hi - lo)) * 100;
  };
  const pa = pos(a), pb = pos(b);
  return html`<div class="ll-db-row" data-tip="${`<b>${METRIC[k].label}</b><br>Earth ${a == null ? '—' : METRIC[k].fmt(a)} · Moon ${b == null ? '—' : METRIC[k].fmt(b)}`}">
    <span class="ll-db-lab">${METRIC[k].label}</span>
    <span class="ll-db-track">${pa != null && pb != null ? raw(`<i class="ll-db-link" style="left:${Math.min(pa, pb)}%;width:${Math.abs(pa - pb)}%"></i>`) : ''}
      ${pa != null ? raw(`<i class="ll-db-dot" style="left:${pa}%;background:${C.shadow}"></i>`) : ''}${pb != null ? raw(`<i class="ll-db-dot" style="left:${pb}%;background:${C.time}"></i>`) : ''}</span>
    <span class="ll-db-val">${a == null ? '—' : METRIC[k].fmt(a)} <i>vs</i> ${b == null ? '—' : METRIC[k].fmt(b)}</span>
  </div>`;
}

function heatmap() {
  const moons = DATA.moon, ramp = t => {
    const a = [19, 35, 58], b = [156, 195, 245];
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  };
  const vals = DATA.pairs.map(p => p.total), lo = Math.min(...vals), hi = Math.max(...vals);
  return html`<div class="ll-heat-wrap"><table class="ll-heat">
    <thead><tr><th></th>${moons.map(m => html`<th scope="col"><span>${m.name}</span></th>`)}</tr></thead>
    <tbody>${DATA.earth.map(e => html`<tr><th scope="row">${e.name}</th>${moons.map(m => {
      const p = pairOf(e.id, m.id), t = (p.total - lo) / (hi - lo || 1);
      return html`<td><button type="button" class="ll-cell" data-earth="${e.id}" data-moon="${m.id}" style="background:${ramp(t)};color:${t > 0.55 ? '#0b1220' : '#dfe6f2'}"
        data-tip="${`<b>${esc(e.name)} × ${esc(m.name)}</b><br>score ${pct100(p.total)} · shadow ${pct100(p.shadow)}% · time ${pct100(p.time)}%<br>compared at ${p.altitudes.join('°, ')}°`}">${pct100(p.total)}</button></td>`;
    })}</tr>`)}</tbody></table>
    <p class="ll-note">Pair score out of 100. Lighter means a closer match. Click a cell to open that pair above.</p></div>`;
}

function siteCard(e) {
  const m = byId(DATA.moon, e.best_moon), p = pairOf(e.id, m.id), W = DATA.settings.weights;
  const alt = String(p.altitudes[0]);
  const ranked = Object.entries(p.per_metric).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
  const fe = e.fingerprint[alt], fm = m.fingerprint[alt];
  const say = k => html`<li><b>${METRIC[k].label}</b>: ${METRIC[k].fmt(fe[k])} here, ${METRIC[k].fmt(fm[k])} at ${m.name}</li>`;
  const b = e.budget, bestMonth = b.hours_by_month.indexOf(Math.max(...b.hours_by_month));
  const maxM = Math.max(...b.hours_by_month);
  return html`<article class="ll-site" id="site-${e.id}">
    <header><p class="ll-site-place">${e.place} · ${latTxt(e.lat)}</p><h4>${e.name}</h4><p class="ll-site-blurb">${e.blurb}</p></header>
    <div class="ll-site-score">
      <span class="ll-big">${pct100(e.score)}</span>
      <div class="ll-split-bars">
        <div><span>Shadow similarity</span><b>${pct100(e.shadow_mean)}%</b><i><em style="width:${e.shadow_mean * 100}%;background:${C.shadow}"></em></i></div>
        <div><span>Low-Sun time</span><b>${pct100(b.score)}%</b><i><em style="width:${b.score * 100}%;background:${C.time}"></em></i></div>
      </div>
    </div>
    <p class="ll-site-twin">Closest Moon twin: <b>${m.name}</b> (pair score ${pct100(p.total)})</p>
    <div class="ll-site-cols">
      <div><h5>What matches</h5><ul>${ranked.slice(0, 2).map(([k]) => say(k))}</ul></div>
      <div><h5>What differs</h5><ul>${ranked.slice(-2).reverse().map(([k]) => say(k))}</ul></div>
    </div>
    <div class="ll-site-cols">
      <div><h5>Best test window</h5>
        <p>${Math.round(b.hours)} h a year with the Sun 0–7° up. Longest stretch: <b>${fmtH(b.longest_h)}</b>${b.longest_window ? html`, ${dateTxt(b.longest_window.start)}${b.longest_h >= 24 ? html` to ${dateTxt(b.longest_window.end)}` : ''}` : ''}. Most low-Sun hours in <b>${MONTHS[bestMonth]}</b>.</p>
        <div class="ll-months" aria-label="Low-Sun hours by month">${b.hours_by_month.map((h, i) => html`<span data-tip="${`${MONTHS[i]}: ${Math.round(h)} h`}"><i style="height:${maxM ? (h / maxM) * 100 : 0}%"></i><small>${MONTHS[i][0]}</small></span>`)}</div></div>
      <div><h5>What to test here</h5><ul>${testIdeas(e, fe, fm, p).map(t => html`<li>${t}</li>`)}</ul></div>
    </div>
  </article>`;
}

function testIdeas(e, fe, fm, p) {
  // One test per strong match: the two fingerprint measures this site shares best with its Moon twin.
  const IDEAS = {
    shadow_fraction: () => `Camera exposure control when most of the view is dark (${METRIC.shadow_fraction.fmt(fe.shadow_fraction)} of the ground in shadow at a 1° Sun).`,
    shadow_run_km: () => `Judging distance and size across shadows about ${METRIC.shadow_run_km.fmt(fe.shadow_run_km)} long.`,
    patch_km2: () => `Navigating through large dark areas (a typical dark patch is ${METRIC.patch_km2.fmt(fe.patch_km2)}), where cameras see little.`,
    edge_km_per_km2: () => `Hazard detection where sunlit and shadowed ground alternate (${METRIC.edge_km_per_km2.fmt(fe.edge_km_per_km2)} of light/dark edge).`,
    always_dark_fraction: () => `Driving into ground that stays dark from every Sun direction (${METRIC.always_dark_fraction.fmt(fe.always_dark_fraction)} here): headlights, thermal cameras, lidar.`,
  };
  const best = Object.entries(p.per_metric).filter(([k, v]) => v != null && fe[k] != null).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const out = best.map(([k]) => IDEAS[k]());
  out.push(e.budget.longest_h >= 6
    ? `Crew walks and rover drives in hours of unbroken low Sun (up to ${fmtH(e.budget.longest_h)} at a time).`
    : `Short sessions at sunrise and sunset, when the Sun spends about ${fmtH(e.budget.longest_h)} in the low band.`);
  return out;
}

/* ------------------------------------------------------------------ 07 how this scales */
function scaling() {
  const S = DATA.settings;
  const rows = (DATA.moon.length + DATA.earth.length) * S.sun_altitudes_deg.length;
  const flow = [
    ['sites.json', 'Places: name and coordinates'], ['settings.json', 'Sun angles, directions, tile size, weights'],
    ['build.py', 'Shadows and fingerprints from elevation'], ['moon_fingerprints.csv', `${rows} fingerprints in one table`],
    ['rerank.py', 'Scores from the table in seconds'], ['moon_light.json', 'What this page reads'],
  ];
  const cards = [
    ['A new Moon target', 'Add its name and coordinates and run one command. Only the new place is fingerprinted, then everything is re-ranked against the stored Earth fingerprints. No Earth data is reprocessed.', 'build.py --moon <id>'],
    ["A new Earth site", "Copernicus elevation covers all of Earth's land, so any place can be added by coordinates. Its tiles are downloaded once and cached.", 'sites.json → build.py'],
    ['Different questions', `Sun heights (${S.sun_altitudes_deg.join(', ')}°), ${S.sun_azimuths_deg.length} directions, the ${S.shadow_cap_m / 1000} km shadow reach and the ${Math.round(S.weights.shadow * 100)}/${Math.round(S.weights.time * 100)} weights all live in one settings file. Change the weights and re-rank without casting any new shadows.`, 'rerank.py'],
    ['The whole planet', 'Low-Sun time needs only latitude, so it already covers every place on Earth (see the world map). Shadow fingerprints can run tile by tile across all land to find analogs nobody has named yet.', 'same code, more tiles'],
    ["Other worlds", "The method needs an elevation map, a planet radius and the Sun's path. Mars polar regions or other lunar sites need a new elevation file and settings, not new code.", 'settings.json'],
  ];
  return html`<section class="ll-sec" id="scale" aria-labelledby="scale-t">
    ${sectionHead('07', 'scale', 'How this scales', 'From nine sites to the whole planet', 'Every result on this page comes from one pipeline that runs offline. The page only reads its output files, so it can show any number of places.')}
    <ol class="ll-flow">${flow.map(([f, d]) => html`<li><code>${f}</code><span>${d}</span></li>`)}</ol>
    <div class="ll-scale-cards">${cards.map(([t, d, c]) => html`<article><h3>${t}</h3><p>${d}</p><code>${c}</code></article>`)}</div>
  </section>`;
}

/* ------------------------------------------------------------------ 08 limits */
function limits() {
  const unres = Math.max(...DATA.earth.map(e => e.fingerprint['1'].unresolved_fraction));
  const trunc = DATA.moon.map(m => m.fingerprint['1'].runs_truncated_fraction).filter(v => v != null);
  const truncMean = trunc.reduce((a, b) => a + b, 0) / (trunc.length || 1);
  const wet = DATA.earth.filter(e => e.terrain.water_fraction > 0.005);
  const top = DATA.earth[0], bottom = DATA.earth[DATA.earth.length - 1];
  const items = [
    ['Light, not darkness', 'Earth shadows are lit by the sky and lunar shadows are not, so the Earth sites match the shape and length of shadows, not their darkness.'],
    ['80 m pixels', 'The elevation maps are 80 m per pixel, so boulders and small craters that matter to a rover are not in the shadows. Higher-resolution maps of the best sites are the next step.'],
    ['Shadows longer than the view', `At a 1° Sun, about ${pct100(truncMean)}% of the shadows measured on the Moon run past the edge of the 12.8 km square, so the Moon's real typical shadow length is longer than shown.`],
    ['Ice and snow count as ground', 'Copernicus measures the top surface, so ice and snow are treated as terrain at the polar Earth sites.'],
    ['Sun directions', 'We test every Sun direction at every place. At a real Earth site the low Sun comes from a narrower range of directions on any given day, so the shadow match shows what the terrain can do rather than a particular date.'],
    ['Edge of the data', `Up to ${(unres * 100).toFixed(1)}% of an Earth square has rays that run off the available data at a 1° Sun. Those pixels are left out of the numbers.${wet.length ? ` Water is left out too (${wet.map(e => `${e.name} ${pct100(e.terrain.water_fraction)}%`).join(', ')}).` : ''}`],
    ['Score spread', `Scores range from ${pct100(bottom.score)} (${bottom.name}) to ${pct100(top.score)} (${top.name}). The weights (60/40) and fingerprint scales are fixed in one settings file and change the ranking only when edited there.`],
  ];
  return html`<section class="ll-sec" id="limits" aria-labelledby="limits-t">
    ${sectionHead('08', 'limits', 'Limits', 'What this does not yet show', null)}
    <div class="ll-limits">${items.map(([t, d]) => html`<article><h3>${t}</h3><p>${d}</p></article>`)}</div>
    <p class="ll-foot-note">Computed ${new Date(DATA.generated).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} by tools/lunar_light/build.py.</p>
  </section>`;
}

/* ------------------------------------------------------------------ behaviour */
function scrollToSec(root, id) {
  const el = $('#' + id, root); if (!el) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

function bindStatic(root) {
  if (!bound.has(root)) { root.addEventListener('click', onClick); bound.add(root); }
  const s = $('#ll-sci-slider', root);
  s?.addEventListener('input', () => {
    const a = +s.value;
    $('#ll-sci-alt', root).textContent = `${a}°`;
    $('#ll-sci-fig', root).innerHTML = shadowArt(a);
  });
}

function onClick(ev) {
  const root = ev.currentTarget;
  if (root.dataset.route !== 'moon') return;
  const go = ev.target.closest('[data-goto]');
  if (go) { scrollToSec(root, go.dataset.goto); return; }
  if (!DATA) return;
  const alt = ev.target.closest('[data-alt]');
  if (alt) { ui.alt = +alt.dataset.alt; redrawViewer(root); return; }
  const pin = ev.target.closest('[data-moon]');
  const er = ev.target.closest('[data-earth]');
  if (pin || er) {
    if (er) ui.earth = er.dataset.earth;
    if (pin) ui.moon = pin.dataset.moon;
    else if (er && !er.dataset.moon) ui.moon = byId(DATA.earth, ui.earth).best_moon;
    redrawViewer(root);
    if (ev.target.closest('.ll-rank-row, .ll-cell')) $('#ll-viewer', root)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function redrawViewer(root) {
  render($('#ll-viewer', root), viewer());
  $$('.ll-pin', root).forEach(b => b.classList.toggle('on', b.dataset.moon === ui.moon));
  $$('.ll-rank-row', root).forEach(b => b.classList.toggle('on', b.dataset.earth === ui.earth));
  bindPickers(root);
  preloadPair();
}

function bindPickers(root) {
  $('#ll-pick-earth', root)?.addEventListener('change', e => { ui.earth = e.target.value; redrawViewer(root); });
  $('#ll-pick-moon', root)?.addEventListener('change', e => { ui.moon = e.target.value; redrawViewer(root); });
}

function bindLive(root) {
  bindPickers(root);
  bindLatHover(root);
  bindWorldMap(root);
  preloadPair();
}

/** Warm the cache for every Sun height of the pair in view, so the slider swaps instantly. */
function preloadPair() {
  const e = byId(DATA.earth, ui.earth), m = byId(DATA.moon, ui.moon);
  for (const site of [e, m]) for (const src of Object.values(site.images)) { const im = new Image(); im.decoding = 'async'; im.src = src; }
}

function watchSections(root) {
  const btns = $$('.ll-nav [data-goto]', root);
  const vis = new Map();
  observer = new IntersectionObserver(entries => {
    for (const en of entries) vis.set(en.target.id, en.isIntersecting ? en.intersectionRatio : 0);
    let best = null, top = Infinity;
    for (const [id] of SECTIONS) {
      const el = document.getElementById(id); if (!el || !vis.get(id)) continue;
      const t = Math.abs(el.getBoundingClientRect().top);
      if (t < top) { top = t; best = id; }
    }
    if (!best) return;
    btns.forEach(b => b.classList.toggle('on', b.dataset.goto === best));
    const nav = $('.ll-nav', root), on = btns.find(b => b.dataset.goto === best);
    if (nav && on && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: on.offsetLeft - 24, behavior: 'smooth' });
  }, { rootMargin: '-120px 0px -45% 0px', threshold: [0, 0.01, 0.25] });
  SECTIONS.forEach(([id]) => { const el = $('#' + id, root); if (el) observer.observe(el); });
}

let tipNode;
function ensureTip() {
  if (!tipNode) { tipNode = document.createElement('div'); tipNode.className = 'tip'; document.body.appendChild(tipNode); }
  return tipNode;
}
function showTip(el, ev, htmlStr) {
  el.innerHTML = htmlStr; el.classList.add('on');
  const r = el.getBoundingClientRect(); let x = ev.clientX + 14, y = ev.clientY + 14;
  if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
  if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
  el.style.transform = `translate(${x}px, ${y}px)`;
}

export { render_ as render };
