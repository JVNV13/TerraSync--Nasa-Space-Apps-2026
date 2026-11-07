// 02 · Atlas: target world map (pick a site) linked to an Earth map where every candidate is sized by its analog score.
import { html, render, pct, fmtCoord, raw } from '../util.js';
import { siteMap } from '../charts.js';
import { sectionHead, band, targetOptions, profileChips, bindProfileChips, shortName, bodyMark, dataNotice } from './common.js';
import { humanize } from '../data.js';

export function render_(root, ctx) {
  const target = ctx.target();
  const w = ctx.weights();
  const ranked = ctx.engine.rank(target.id, ctx.candidates(), w);
  const byId = new Map(ranked.map((r, i) => [r.candidate.id, { r, rank: i + 1 }]));
  const cand = ctx.engine.byId.get(ctx.state.candId);
  const candRes = cand && byId.get(cand.id);
  const targetSites = ctx.targets.filter(t => t.body === target.body);

  render(root, html`
  ${sectionHead('§ ATLAS', 'Orbital atlas', 'Pick a target on the upper map. Earth candidates below are sized by how closely they match it; numbers mark the top five.')}
  <div class="atlas">
    <div class="atlas-maps">
      <figure class="panel map-panel">
        <figcaption><span class="cap-l">${bodyMark(target.body)} ${target.body} · target sites</span><span class="cap-r mono">${target.body === 'Mars' ? 'planetocentric, east-positive' : ''} · positions only, no basemap</span></figcaption>
        ${raw(siteMap({ body: target.body, sites: targetSites, selectedId: target.id, labels: true, ariaLabel: `${target.body} target sites` }))}
      </figure>
      <figure class="panel map-panel">
        <figcaption><span class="cap-l">${bodyMark('Earth')} Earth · candidates vs. <b>${shortName(target)}</b></span><span class="cap-r mono">WGS84 · Natural Earth coastlines</span></figcaption>
        ${raw(siteMap({ body: 'Earth', sites: ctx.candidates(), selectedId: cand?.id, scoreOf: s => byId.get(s.id)?.r.score ?? null, rankOf: s => byId.get(s.id)?.rank, ariaLabel: 'Earth candidate sites sized by analog score' }))}
        <div class="map-legend"><span><i class="lg-earth"></i>Earth site (size = score)</span><span><i class="lg-ctrl"></i>Negative control</span><span><i class="${target.body === 'Moon' ? 'lg-moon' : 'lg-mars'}"></i>${target.body} target</span></div>
      </figure>
    </div>

    <aside class="atlas-side">
      <section class="panel target-card">
        <p class="eyebrow"><span class="code">TGT</span>Selected target</p>
        <label class="field"><span>Target site</span><select id="atlas-target">${targetOptions(ctx, target.id)}</select></label>
        <h2>${target.name}</h2>
        <p class="mono coord">${fmtCoord(target.lat, target.lon)} · ${target['geographic.elevation_m'] != null ? target['geographic.elevation_m'].toLocaleString('en-US') + ' m' : 'elevation not recorded'}</p>
        <p>${target.summary}</p>
        <p class="tags">${(target.analog_tags || []).map(t => html`<span class="tag">${humanize(t)}</span>`)}</p>
        ${target['exploration.mission_history']?.length ? html`<p class="mission-hist"><span class="eyebrow">Mission history</span>${target['exploration.mission_history'].join(' · ')}</p>` : ''}
      </section>

      <section class="panel">
        <p class="eyebrow"><span class="code">PRF</span>Mission profile</p>
        ${profileChips(ctx)}
      </section>

      ${candRes ? html`<section class="panel sel-cand">
        <p class="eyebrow"><span class="code">SEL</span>Selected Earth site · rank #${candRes.rank}</p>
        <h3>${cand.name}</h3><p class="mono dim">${fmtCoord(cand.lat, cand.lon)}</p>
        <p class="big-score"><span class="mono">${pct(candRes.r.score)}</span>${band(candRes.r.score)}</p>
        <button class="btn primary" data-action="open-pair" data-a="${cand.id}" data-b="${target.id}">Full comparison →</button>
      </section>` : ''}

      <section class="panel">
        <p class="eyebrow"><span class="code">RNK</span>Top Earth analogs</p>
        <ol class="rank-list">${ranked.slice(0, 8).map((r, i) => html`
          <li class="rowlink${r.candidate.id === cand?.id ? ' on' : ''}" tabindex="0" data-action="select-site" data-id="${r.candidate.id}">
            <span class="rk mono">${String(i + 1).padStart(2, '0')}</span>
            <span class="rk-name">${r.candidate.name}${r.candidate.is_control ? html` <span class="tag warn">control</span>` : ''}</span>
            <span class="rk-bar"><i style="width:${(r.score * 100).toFixed(1)}%"></i></span>
            <span class="rk-v mono">${pct(r.score)}</span>
          </li>`)}</ol>
        <button class="btn ghost" data-action="go" data-route="finder">See the full ranking →</button>
      </section>
    </aside>
  </div>
  ${dataNotice(ctx)}`);

  root.querySelector('#atlas-target').addEventListener('change', e => ctx.set({ targetId: e.target.value }));
  bindProfileChips(root, ctx);
}
export { render_ as render };
