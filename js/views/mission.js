// 01 · Home: what TerraSync is in one sentence, where to go next, and the best Earth twins.
import { html, render } from '../util.js';
import { loadLandcover } from '../data.js';
import { band, shortName, rated, byScore, globe } from './common.js';

const MENU = [
  { route: 'terrain', title: 'Mars surface', text: 'Height, slope and shadows of two real patches of Mars, measured by NASA’s HiRISE camera.', tag: 'Real data', icon: '<circle cx="16" cy="16" r="11"/><path d="M7 19c4-3 7 1 11-2s5-1 7 0"/><circle cx="12" cy="11" r="1.6"/><circle cx="20" cy="22" r="1.2"/>' },
  { route: 'earth', title: 'Earth land', text: 'What covers the ground in three of Earth’s driest regions, mapped every 10 m by ESA satellites.', tag: 'Real data', icon: '<circle cx="16" cy="16" r="11"/><path d="M8 11c3 1 4 4 7 3s3-5 7-4M7 20c3 0 4 3 8 2s4-3 9-1"/>' },
  { route: 'finder', title: 'Find a twin', text: 'Pick a place on Mars and see which places on Earth are most like it.', tag: 'Tool', icon: '<circle cx="14" cy="14" r="8"/><path d="M20 20l7 7"/>' },
  { route: 'compare', title: 'Compare', text: 'Put one Earth place and one Mars place side by side: where they match, and where they don’t.', tag: 'Tool', icon: '<circle cx="10" cy="16" r="6"/><circle cx="22" cy="16" r="6"/>' },
];

export function render_(root, ctx) {
  const w = ctx.weights(), E = ctx.engine;
  const realEarth = ctx.earth.filter(s => !s.is_control);
  const best = ctx.targets.map(t => E.rank(t.id, realEarth, w)[0]).filter(r => r && rated(r)).sort(byScore).slice(0, 6);
  const measuredMars = ctx.targets.filter(t => t.provenance !== 'synthetic').length;

  render(root, html`
  <section class="home-hero">
    <div class="home-copy">
      <p class="crumb"><b>Home</b></p>
      <p class="kicker">NASA Space Apps 2026</p>
      <h1 class="mega">Find Mars<br>on Earth</h1>
      <p class="lede">Before people go to Mars, they practise in places on Earth that look and feel like it. TerraSync uses real data from both planets to find those places, and shows how alike they really are.</p>
      <div class="hero-cta">
        <button class="btn primary" data-action="go" data-route="finder">Find an Earth twin</button>
        <button class="btn" data-action="go" data-route="terrain">Explore Mars</button>
      </div>
    </div>
    <div class="home-planet">
      ${globe('mars', 'hero-globe')}
      <span class="callout-pin cp-1"><i></i><b>Jezero crater</b><small>2 measured terrain patches</small></span>
      <span class="callout-pin cp-2"><i></i><b>${ctx.targets.length} Mars places</b><small>compared with ${realEarth.length} on Earth</small></span>
    </div>
  </section>

  <nav class="home-menu" aria-label="Start here">
    ${MENU.map((m, i) => html`<a class="hm-row" href="#${m.route}">
      <svg class="hm-ico" viewBox="0 0 32 32" aria-hidden="true">${{ __raw: true, s: m.icon }}</svg>
      <span class="hm-num">0${i + 1}.</span>
      <span class="hm-title">${m.title}</span>
      <span class="hm-text">${m.text}</span>
      <span class="hm-tag${m.tag === 'Real data' ? ' real' : ''}">${m.tag}</span>
      <span class="hm-go" aria-hidden="true">→</span>
    </a>`)}
  </nav>

  <dl class="stat-strip">
    <div><dt>Mars terrain</dt><dd>${measuredMars}<small>real patches, ~30 m detail</small></dd></div>
    <div><dt>Earth land mapped</dt><dd id="home-km">3<small>regions</small></dd></div>
    <div><dt>Places compared</dt><dd>${realEarth.length} × ${ctx.targets.length}<small>Earth × Mars</small></dd></div>
    <div><dt>Things compared</dt><dd>9<small>rocks, slopes, cold, dust, water…</small></dd></div>
  </dl>

  <section class="panel">
    <header class="block-head"><h2 class="block-title">Best Earth twins</h2><p class="block-sub">For each Mars place, the Earth place that matches it best. Score out of 100. Click one to see why.</p></header>
    <div class="twin-grid">${best.map(r => html`
      <article class="twin rowlink" tabindex="0" data-action="open-pair" data-a="${r.candidate.id}" data-b="${r.target.id}">
        <p class="tw-mars"><i class="glyph mars"></i>${shortName(r.target)}</p>
        <p class="tw-arrow" aria-hidden="true">matches</p>
        <p class="tw-earth"><i class="glyph earth"></i>${shortName(r.candidate)}</p>
        <p class="tw-score"><span>${Math.round(r.score * 100)}</span>${band(r.score, r.coverage)}</p>
      </article>`)}</div>
    <button class="btn ghost" data-action="go" data-route="finder">See every match →</button>
  </section>

  <section class="how">
    <header class="block-head"><h2 class="block-title">How it works</h2></header>
    <ol class="how-steps">
      <li><b>Measure</b><p>Spacecraft and satellites map the ground: HiRISE for Mars, ESA WorldCover for Earth.</p></li>
      <li><b>Compare</b><p>Each Earth place is checked against each Mars place on nine things, like rocks, slopes, cold, dust and water.</p></li>
      <li><b>Score</b><p>You get a score out of 100, plus a plain list of what matches and what doesn’t (Earth can never copy Mars’ thin air or low gravity).</p></li>
    </ol>
  </section>`);

  loadLandcover().then(d => {
    const el = root.querySelector('#home-km');
    if (!el) return;
    const km = d.tiles.reduce((a, t) => a + t.valid_km2, 0);
    el.innerHTML = `${Math.round(km / 1000).toLocaleString('en-US')}k<small>km² in ${d.tiles.length} regions, 10 m detail</small>`;
  }).catch(() => {});
}
export { render_ as render };
