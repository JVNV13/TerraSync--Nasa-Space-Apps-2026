// TerraSync application shell: data loading, shared state, hash routing,
// delegated events (tooltips, selection) and the starfield backdrop.
import { loadDefaultDataset, buildDataset } from './data.js';
import { Engine, PROFILES, DIMENSIONS } from './engine.js';
import { $, $$, tip, hideTip, store, esc } from './util.js';
import * as mission from './views/mission.js';
import * as atlas from './views/atlas.js';
import * as terrain from './views/terrain.js';
import * as finder from './views/finder.js';
import * as compare from './views/compare.js';
import * as matrix from './views/matrix.js';
import * as catalog from './views/catalog.js';
import * as method from './views/method.js';
import * as earth from './views/earth.js';

const ROUTES = { mission, terrain, earth, atlas, finder, compare, matrix, catalog, method };
const DEFAULT_ROUTE = 'mission';

const ctx = {
  data: null, engine: null, earth: [], targets: [],
  state: {
    profile: store.get('profile', 'balanced'),
    weights: store.get('weights', null),
    targetId: store.get('targetId', null),
    candId: store.get('candId', null),
    includeControl: store.get('includeControl', true),
  },
  /** Effective dimension weights (custom sliders override profile). */
  weights() { return this.state.weights || PROFILES[this.state.profile]?.w || PROFILES.balanced.w; },
  candidates() { return this.earth.filter(s => this.state.includeControl || !s.is_control); },
  target() { return this.engine.byId.get(this.state.targetId) || this.targets[0]; },
  cand() { return this.engine.byId.get(this.state.candId) || this.earth[0]; },
  set(patch, { rerender = true } = {}) {
    Object.assign(this.state, patch);
    for (const k of Object.keys(patch)) store.set(k, this.state[k]);
    if (rerender) renderRoute();
  },
  go(route) { if (location.hash.slice(1) === route) renderRoute(); else location.hash = route; },
  useDataset(ds) {
    this.data = ds;
    this.engine = new Engine(ds.sites);
    this.earth = ds.sites.filter(s => s.body === 'Earth');
    this.targets = ds.sites.filter(s => s.body !== 'Earth');
    if (!this.engine.byId.has(this.state.targetId) || this.engine.byId.get(this.state.targetId).body === 'Earth') this.state.targetId = (this.targets.find(t => t.provenance === 'synthetic') || this.targets[0])?.id ?? null;
    if (!this.engine.byId.has(this.state.candId) || this.engine.byId.get(this.state.candId).body !== 'Earth') this.state.candId = null;
    updateStatus();
  },
  async loadFile(file) {
    const text = await file.text();
    const ds = buildDataset([{ text, name: file.name }]);
    if (!ds.sites.some(s => s.body === 'Earth')) throw new Error('The file has no Earth records to rank.');
    if (!ds.sites.some(s => s.body !== 'Earth')) throw new Error('The file has no Mars or Moon target records.');
    this.useDataset(ds);
    renderRoute();
    return ds;
  },
};

function currentRoute() {
  const h = location.hash.slice(1);
  return ROUTES[h] ? h : DEFAULT_ROUTE;
}

function renderRoute() {
  hideTip();
  const route = currentRoute();
  const root = $('#view');
  $$('.nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + route));
  if (!ctx.engine) return;
  try {
    root.dataset.route = route;
    ROUTES[route].render(root, ctx);
    root.classList.remove('enter'); void root.offsetWidth; root.classList.add('enter');
  } catch (err) {
    console.error(err);
    root.innerHTML = `<section class="panel error-panel"><h2>Something went wrong rendering this view</h2><p class="mono">${esc(err.message)}</p><button class="btn" onclick="location.hash='mission'">Return to mission overview</button></section>`;
  }
}

function updateStatus() {
  const { measured, synthetic } = ctx.data.quality.values;
  const flag = $('#ds-flag');
  flag.textContent = !synthetic ? 'All data measured' : `${measured.toLocaleString('en-US')} measured · ${synthetic.toLocaleString('en-US')} demo values`;
  flag.className = 'flag ' + (synthetic ? 'flag-syn' : 'flag-real');
  flag.title = 'Measured values come from HiRISE (Mars) and ESA WorldCover (Earth). Demo values are placeholders that show how the method works.';
}
/* ----------------------------------------------------------- delegated events */
document.addEventListener('mouseover', e => {
  const t = e.target.closest('[data-tip]');
  if (t) tip(e, { __raw: true, s: t.getAttribute('data-tip') });
});
document.addEventListener('mousemove', e => {
  const t = e.target.closest('[data-tip]');
  if (t) tip(e, { __raw: true, s: t.getAttribute('data-tip') }); else hideTip();
});
document.addEventListener('focusin', e => {
  const t = e.target.closest('[data-tip]');
  if (t) { const r = t.getBoundingClientRect(); tip({ clientX: r.right, clientY: r.bottom }, { __raw: true, s: t.getAttribute('data-tip') }); }
});
document.addEventListener('focusout', hideTip);
addEventListener('scroll', hideTip, { passive: true });

function act(el) {
  const { action, id, a, b } = el.dataset;
  const site = id && ctx.engine.byId.get(id);
  switch (action) {
    case 'select-site':
      if (!site) return;
      if (site.body === 'Earth') ctx.set({ candId: id });
      else ctx.set({ targetId: id });
      break;
    case 'pick-target': ctx.set({ targetId: id }, { rerender: false }); ctx.go('finder'); break;
    case 'pick-candidate': catalog.openSite(ctx, id); break;
    case 'open-pair': catalog.closeSite(); ctx.set({ candId: a, targetId: b }, { rerender: false }); ctx.go('compare'); break;
    case 'open-site': catalog.openSite(ctx, id); break;
    case 'go': ctx.go(el.dataset.route); break;
  }
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el) { e.preventDefault(); act(el); }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-action][tabindex]')) { e.preventDefault(); act(e.target); }
  if (e.key === 'Escape') { hideTip(); catalog.closeSite(); }
});

/* ----------------------------------------------------------- starfield */
function starfield() {
  const c = $('#stars'); if (!c) return;
  const g = c.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let stars = [], w, h, dpr;
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    w = c.width = innerWidth * dpr; h = c.height = innerHeight * dpr;
    c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px';
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const n = Math.round((innerWidth * innerHeight) / 5200);
    stars = Array.from({ length: n }, () => ({ x: rnd() * w, y: rnd() * h, r: (rnd() ** 3 * 1.3 + 0.25) * dpr, a: 0.15 + rnd() * 0.6, p: rnd() * 6.28, s: 0.3 + rnd() }));
  }
  function frame(t) {
    g.clearRect(0, 0, w, h);
    for (const s of stars) {
      const a = reduce ? s.a : s.a * (0.75 + 0.25 * Math.sin(t / 1000 * s.s + s.p));
      g.globalAlpha = a * 0.6; g.fillStyle = s.r > 1.2 * dpr ? '#f1dcc0' : '#cfcac2';
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.283); g.fill();
    }
    if (!reduce) requestAnimationFrame(frame);
  }
  resize(); addEventListener('resize', () => { resize(); if (reduce) frame(0); });
  requestAnimationFrame(frame);
}

function clock() {
  const el = $('#utc'); if (!el) return;
  const tick = () => { el.textContent = new Date().toISOString().slice(11, 19) + ' UTC'; };
  tick(); setInterval(tick, 1000);
}

/* ----------------------------------------------------------- boot */
async function boot() {
  starfield(); clock();
  addEventListener('hashchange', renderRoute);
  const root = $('#view');
  try {
    ctx.useDataset(await loadDefaultDataset());
    if (!ctx.targets.length) throw new Error('Dataset loaded, but it has no Mars or Moon target records.');
    $('#boot').remove();
    renderRoute();
  } catch (err) {
    console.error(err);
    $('#boot')?.remove();
    root.innerHTML = `<section class="panel error-panel"><p class="eyebrow">Telemetry lost</p><h2>The survey dataset could not be loaded</h2><p>${esc(err.message)}</p>
      <p>You can load a TerraSync-format CSV from your computer instead.</p>
      <label class="btn"><input type="file" accept=".csv,text/csv" id="boot-file" hidden>Load CSV…</label><p class="mono" id="boot-msg"></p></section>`;
    $('#boot-file').addEventListener('change', async e => {
      try { await ctx.loadFile(e.target.files[0]); } catch (er) { $('#boot-msg').textContent = er.message; }
    });
  }
}
export { ctx, DIMENSIONS };
boot();
