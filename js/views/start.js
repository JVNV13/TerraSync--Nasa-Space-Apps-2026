// 00 · Start: choose a destination (Mars, Moon or Education). Full-screen, space themed.
// Mars opens the analog explorer, Moon opens Lunar Light, Education opens the lesson page.
import { html, render, raw } from '../util.js';
import { globe } from './common.js';

// Ringed planet with orbiting moon: the Education emblem (procedural SVG, no image files).
const LEARN = raw(`<svg class="globe start-learn" viewBox="0 0 600 600" aria-hidden="true">
  <defs>
    <radialGradient id="lnb" cx="38%" cy="34%" r="72%"><stop offset="0" stop-color="#b7a8ff"/><stop offset=".55" stop-color="#5b4bc4"/><stop offset="1" stop-color="#1a1240"/></radialGradient>
    <radialGradient id="lng" cx="50%" cy="50%" r="50%"><stop offset=".62" stop-color="#8f7dff" stop-opacity=".45"/><stop offset="1" stop-color="#8f7dff" stop-opacity="0"/></radialGradient>
    <linearGradient id="lnr" x1="0" x2="1"><stop offset="0" stop-color="#e9e3ff" stop-opacity="0"/><stop offset=".25" stop-color="#e9e3ff" stop-opacity=".85"/><stop offset=".75" stop-color="#c9bcff" stop-opacity=".85"/><stop offset="1" stop-color="#c9bcff" stop-opacity="0"/></linearGradient>
    <clipPath id="lnc"><rect x="-100" y="0" width="800" height="300"/></clipPath>
    <clipPath id="lnf"><rect x="-100" y="300" width="800" height="300"/></clipPath>
    <clipPath id="lnp"><circle cx="300" cy="300" r="170"/></clipPath>
  </defs>
  <circle cx="300" cy="300" r="270" fill="url(#lng)"/>
  <g transform="rotate(-18 300 300)">
    <ellipse cx="300" cy="300" rx="265" ry="62" fill="none" stroke="url(#lnr)" stroke-width="14" clip-path="url(#lnc)" opacity=".55"/>
    <circle cx="300" cy="300" r="170" fill="url(#lnb)"/>
    <g clip-path="url(#lnp)"><path d="M120 250c70 22 290 22 360 0M120 330c80 24 280 24 360 0" fill="none" stroke="#fff" stroke-opacity=".1" stroke-width="12"/></g>
    <ellipse cx="300" cy="300" rx="265" ry="62" fill="none" stroke="url(#lnr)" stroke-width="14" clip-path="url(#lnf)"/>
  </g>
  <g class="learn-orbit"><circle cx="300" cy="44" r="16" fill="#f1ecff"/></g>
</svg>`);

const DESTINATIONS = [
  { key: 'mars', n: '01', title: 'Mars', text: 'Find the places on Earth that look and feel most like the Red Planet.', visual: globe('mars', 'start-globe'), href: '#mission' },
  { key: 'moon', n: '02', title: 'Moon', text: 'Find places on Earth with the light and shadow of the lunar south pole.', visual: globe('moon', 'start-globe'), href: '#moon' },
  { key: 'edu', n: '03', title: 'Education', text: 'Learn about planets, missions and exploring space.', visual: LEARN, href: '#edu' },
];

export function render_(root) {
  render(root, html`
  <section class="start" aria-labelledby="start-title">
    <div class="start-nebula" aria-hidden="true"><i class="nb nb-1"></i><i class="nb nb-2"></i><i class="nb nb-3"></i></div>
    <svg class="start-orbits" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <ellipse cx="800" cy="980" rx="1100" ry="420"/><ellipse cx="800" cy="980" rx="1400" ry="560"/><ellipse cx="800" cy="980" rx="800" ry="300"/>
    </svg>

    <header class="start-head">
      <p class="start-brand">
        <svg viewBox="0 0 40 24" class="brand-mark" aria-hidden="true"><circle cx="12" cy="12" r="9" class="bm-earth"/><circle cx="29" cy="12" r="6.5" class="bm-mars"/></svg>
        <span>TerraSync</span>
      </p>
      <p class="start-kicker">NASA Space Apps Challenge 2026</p>
      <h1 id="start-title" class="start-title">Where do you want<br>to explore?</h1>
      <p class="start-sub">Choose a destination to begin your journey.</p>
    </header>

    <ul class="start-grid" role="list">
      ${DESTINATIONS.map(d => html`<li class="start-item">
        ${d.soon
          ? html`<div class="start-card soon" aria-disabled="true" data-key="${d.key}">${raw(card(d))}</div>`
          : html`<a class="start-card" href="${d.href}" data-key="${d.key}">${raw(card(d))}</a>`}
      </li>`)}
    </ul>

    <p class="start-foot">Earth · Mars · Moon · and beyond</p>
  </section>`);
}

function card(d) {
  return html`
    <span class="sc-visual" aria-hidden="true">${d.visual}</span>
    <span class="sc-num">${d.n}</span>
    <span class="sc-title">${d.title}</span>
    <span class="sc-text">${d.text}</span>
    ${d.soon
      ? html`<span class="sc-cta soon-tag">Coming soon</span>`
      : html`<span class="sc-cta">Start exploring <b aria-hidden="true">→</b></span>`}`.s;
}
export { render_ as render };
