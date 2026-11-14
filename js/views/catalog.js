// Site drawer: the full record of one place, opened from any list or card.
import { html, fmtCoord } from '../util.js';
import { FIELDS, GROUP_ORDER } from '../data.js';
import { bodyMark, featureValue, band, byScore } from './common.js';

/** Full-record drawer. */
export function openSite(ctx, id) {
  const s = ctx.engine.byId.get(id); if (!s) return;
  closeSite();
  const best = s.body === 'Earth'
    ? ctx.targets.map(t => ctx.engine.compare(s.id, t.id, ctx.weights())).sort(byScore).slice(0, 3)
    : ctx.engine.rank(s.id, ctx.earth.filter(e => !e.is_control), ctx.weights()).slice(0, 3);
  const el = document.createElement('div');
  el.className = 'drawer-wrap';
  el.innerHTML = html`<div class="drawer-scrim" data-close></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-label="${s.name}">
    <header><p class="eyebrow">${bodyMark(s.body)}<span class="mono">${s.id}</span> · ${s.body}${s.is_control ? html` <span class="tag warn">negative control</span>` : ''}</p>
      <h2>${s.name}</h2><p class="mono dim">${fmtCoord(s.lat, s.lon)} · ${s['geographic.coordinate_system'] || ''}</p>
      <button class="btn ghost close" data-close aria-label="Close">Close ✕</button></header>
    <p>${s.summary}</p>
    ${s.data_source ? html`<p class="small dim">Source: ${s.data_source}</p>` : ''}
    <section><h4 class="sub">${s.body === 'Earth' ? 'Best target matches' : 'Best Earth analogs'}</h4>
      <ul class="drawer-best">${best.map(r => { const o = s.body === 'Earth' ? r.target : r.candidate; return html`<li class="rowlink" tabindex="0" data-action="open-pair" data-a="${r.candidate.id}" data-b="${r.target.id}"><span>${bodyMark(o.body)}${o.name}</span><span class="mono">${Math.round(r.score * 100)}</span>${band(r.score, r.coverage)}</li>`; })}</ul></section>
    ${GROUP_ORDER.map(g => html`<section><h4 class="sub">${g}</h4><dl class="kv">${Object.keys(FIELDS).filter(k => FIELDS[k].group === g).map(k => html`<div><dt>${FIELDS[k].label}</dt><dd>${featureValue(s[k], k)}</dd></div>`)}</dl></section>`)}
  </aside>`.s;
  document.body.appendChild(el);
  document.body.classList.add('locked');
  el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeSite));
  el.querySelector('.close').focus();
}
export function closeSite() {
  const d = document.querySelector('.drawer-wrap');
  if (d) { d.remove(); document.body.classList.remove('locked'); }
}
