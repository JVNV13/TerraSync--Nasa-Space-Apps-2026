// 01 · Mission overview: what the tool does, headline numbers, best twins, overlooked analogs, control check.
import { html, render, pct } from '../util.js';
import { PROFILES } from '../engine.js';
import { humanize } from '../data.js';
import { sectionHead, band, shortName, bodyMark, dataNotice } from './common.js';

export function render_(root, ctx) {
  const w = ctx.weights();
  const E = ctx.engine;
  const realEarth = ctx.earth.filter(s => !s.is_control);
  const controls = ctx.earth.filter(s => s.is_control);
  const bodies = [...new Set(ctx.targets.map(t => t.body))];

  // Best twin for each target.
  const best = ctx.targets.map(t => E.rank(t.id, realEarth, w)[0]).filter(Boolean);
  const pairs = ctx.targets.length * ctx.earth.length;
  const top = [...best].sort((a, b) => b.score - a.score)[0];

  // Overlooked analogs: less-studied Earth sites ranked by their best match anywhere.
  const overlooked = realEarth
    .filter(s => ['under_studied', 'emerging'].includes(s['exploration.analog_maturity']))
    .map(s => {
      const r = ctx.targets.map(t => E.compare(s.id, t.id, w)).sort((a, b) => b.score - a.score)[0];
      return r;
    })
    .filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 4);

  // Negative-control validation: the control should never be anyone's best match.
  const ctrlChecks = controls.map(c => {
    const scores = ctx.targets.map(t => {
      const ranked = E.rank(t.id, ctx.earth, w);
      return { rank: ranked.findIndex(r => r.candidate.id === c.id) + 1, score: ranked.find(r => r.candidate.id === c.id).score, of: ranked.length };
    });
    const worstRank = Math.min(...scores.map(s => s.rank));
    const maxScore = Math.max(...scores.map(s => s.score));
    return { site: c, worstRank, maxScore, n: ctx.earth.length, pass: worstRank > Math.ceil(ctx.earth.length / 2) };
  });

  const moonMissing = !bodies.includes('Moon');

  render(root, html`
  <section class="hero">
    <div class="hero-planet" aria-hidden="true"><div class="limb"></div></div>
    <div class="hero-copy">
      <p class="eyebrow"><span class="code">TT-01</span>Global planetary analog finder</p>
      <h1>Earth's stand-ins for ${bodies.join(' & ') || 'other worlds'}, ranked by data.</h1>
      <p class="lede">TerraTwin compares every Earth site in the survey with every candidate landing or base site on ${bodies.join(' and ')} across nine dimensions, from mineralogy and slopes to dust and ice. For each pair it shows where the analogy holds and where it breaks, and what the site could be used to test.</p>
      <div class="hero-cta">
        <button class="btn primary" data-action="go" data-route="atlas">Open the atlas</button>
        <button class="btn" data-action="go" data-route="finder">Run the analog finder</button>
      </div>
    </div>
    <dl class="telemetry">
      <div><dt>Earth sites</dt><dd>${realEarth.length}<small>+${controls.length} control</small></dd></div>
      <div><dt>${bodies.join(' / ')} targets</dt><dd>${ctx.targets.length}</dd></div>
      <div><dt>Pairs scored</dt><dd>${pairs}</dd></div>
      <div><dt>Top match</dt><dd>${top ? pct(top.score) : '—'}<small>${top ? shortName(top.candidate) + ' → ' + shortName(top.target) : ''}</small></dd></div>
    </dl>
  </section>

  ${dataNotice(ctx)}

  <section class="panel">
    ${sectionHead('§1', 'Best Earth twin for each target', `Profile: ${ctx.state.weights ? 'custom weights' : PROFILES[ctx.state.profile].label}. Select a row to open the full comparison.`)}
    <div class="table-wrap"><table class="data twins">
      <thead><tr><th>Target</th><th>Best Earth analog</th><th class="num">Score</th><th>Rating</th><th>Strongest dimension</th><th>Weakest dimension</th></tr></thead>
      <tbody>${best.sort((a, b) => b.score - a.score).map(r => {
        const scored = r.dims.filter(d => d.score != null).sort((a, b) => b.score - a.score);
        return html`<tr class="rowlink" tabindex="0" data-action="open-pair" data-a="${r.candidate.id}" data-b="${r.target.id}">
          <td>${bodyMark(r.target.body)}${r.target.name}</td><td>${bodyMark('Earth')}${r.candidate.name}</td>
          <td class="num mono">${pct(r.score)}</td><td>${band(r.score)}</td>
          <td>${scored[0]?.label} <span class="mono dim">${pct(scored[0]?.score)}</span></td>
          <td>${scored.at(-1)?.label} <span class="mono dim">${pct(scored.at(-1)?.score)}</span></td></tr>`;
      })}</tbody></table></div>
  </section>

  <div class="grid-2">
    <section class="panel">
      ${sectionHead('§2', 'Overlooked analogs', 'Less-studied Earth sites (maturity: emerging or under-studied) that score well. These are candidates for new fieldwork, not just familiar analog sites.')}
      ${overlooked.length ? html`<ol class="overlooked">${overlooked.map(r => html`
        <li tabindex="0" class="rowlink" data-action="open-pair" data-a="${r.candidate.id}" data-b="${r.target.id}">
          <span class="ov-score mono">${pct(r.score)}</span>
          <span class="ov-body"><b>${r.candidate.name}</b><small>${humanize(r.candidate['exploration.analog_maturity'])} · best match: ${r.target.name}</small><small class="ov-sum">${r.candidate.summary}</small></span>
        </li>`)}</ol>` : html`<p class="empty">No Earth records carry an "emerging" or "under-studied" maturity flag.</p>`}
    </section>

    <section class="panel">
      ${sectionHead('§3', 'Method self-check', 'The dataset includes a negative control, a site that should not resemble any target. If it ranks high, the scoring is broken.')}
      ${ctrlChecks.length ? ctrlChecks.map(c => html`
        <div class="check ${c.pass ? 'pass' : 'fail'}">
          <span class="check-ico" aria-hidden="true">${c.pass ? '✓' : '!'}</span>
          <div><b>${c.pass ? 'Passed' : 'Attention'}: ${c.site.name}</b>
          <p>Best placement across all ${ctx.targets.length} targets: rank <span class="mono">${c.worstRank} of ${c.n}</span>. Highest score: <span class="mono">${pct(c.maxScore)}</span>. ${c.pass ? 'The control stays in the bottom half everywhere, so the scoring separates analogs from non-analogs.' : 'The control reaches the top half for at least one target. Review the weights.'}</p></div>
        </div>`) : html`<p class="empty">No record is flagged <span class="mono">is_control</span>, so the self-check cannot run.</p>`}
      ${moonMissing ? html`<div class="check info"><span class="check-ico" aria-hidden="true">i</span><div><b>No lunar records yet</b><p>This CSV contains Earth and Mars sites only, so Moon-base matching is ready but has no targets. Add rows with <span class="mono">planet = Moon</span> and they appear as targets in every view.</p></div></div>` : ''}
    </section>
  </div>`);
}
export { render_ as render };
