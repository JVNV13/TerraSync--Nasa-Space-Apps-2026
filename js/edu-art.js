// Animated illustrations for the Learn deck. All inline SVG, no image files, no library.
// Every moving part carries a class whose @keyframes live in css/edu.css, so the
// prefers-reduced-motion block there can stop all of them in one place.
// Colours come from the page's own custom properties, so these follow the site theme.
import { raw } from './util.js';

const svg = (vb, body, cls = '') =>
  raw(`<svg class="art ${cls}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${body}</svg>`);

/* Shared bits ------------------------------------------------------------- */
const ground = (y = 196, cls = 'a-ground') => `<path class="${cls}" d="M8 ${y}h384"/>`;
const rocks = (y = 196) => `
  <path class="a-rock" d="M70 ${y}c3-9 9-13 16-13s13 5 15 13Z"/>
  <path class="a-rock" d="M300 ${y}c4-12 12-17 21-17s17 6 20 17Z"/>
  <path class="a-rock" d="M196 ${y}c2-6 6-9 11-9s9 3 10 9Z"/>`;
// Rookie: a small rover, seen from the side. Used on more than one card.
const rookie = (x = 0, y = 0, s = 1) => `
  <g class="a-rookie" transform="translate(${x} ${y}) scale(${s})">
    <g class="a-bob">
      <path class="a-body" d="M-34-16h54l10 13v15h-64Z"/>
      <path class="a-panel" d="M-30-34h40l-6 16h-40Z"/>
      <path class="a-mast" d="M14-16v-18h12"/>
      <circle class="a-eye" cx="30" cy="-34" r="5"/>
      <circle class="a-eye-dot" cx="31.5" cy="-34" r="1.8"/>
      <g class="a-wheel"><circle cx="-22" cy="16" r="9"/><path d="M-22 7v18M-31 16h18"/></g>
      <g class="a-wheel a-wheel-2"><circle cx="4" cy="16" r="9"/><path d="M4 7v18M-5 16h18"/></g>
      <g class="a-wheel a-wheel-3"><circle cx="26" cy="16" r="7"/><path d="M26 9v14M19 16h14"/></g>
    </g>
  </g>`;

/* 1 · Rookie's first day — Rookie bumps along over rocks, Mars waiting on the right. */
const rover = () => svg('0 0 400 240', `
  <circle class="a-planet a-mars" cx="336" cy="62" r="30"/>
  <path class="a-planet-line" d="M312 50c14 7 34 7 48 0M310 74c16 8 36 8 52 0"/>
  <g class="a-twinkle"><path class="a-spark" d="M60 44v12M54 50h12"/></g>
  <g class="a-twinkle a-twinkle-2"><path class="a-spark" d="M248 30v9M243.5 34.5h9"/></g>
  ${ground()}
  ${rocks()}
  <g class="a-drive">${rookie(96, 180, 1)}</g>
  <path class="a-dust" d="M46 196c-6-4-14-4-20 0M28 188c-5-3-11-3-15 0"/>
`, 'art-rover');

/* 2 · The beach mistake — two worlds side by side, and a question mark between them. */
const twins = () => svg('0 0 400 240', `
  <g class="a-world">
    <circle class="a-planet a-earth" cx="112" cy="120" r="52"/>
    <path class="a-planet-line" d="M64 104c30 12 66 12 96 0M62 136c32 12 68 12 100 0"/>
    <path class="a-wave" d="M78 150c10-6 20-6 30 0s20 6 30 0"/>
  </g>
  <g class="a-world a-world-2">
    <circle class="a-planet a-mars" cx="288" cy="120" r="52"/>
    <path class="a-planet-line" d="M240 104c30 12 66 12 96 0M238 136c32 12 68 12 100 0"/>
    <circle class="a-crater-dot" cx="272" cy="112" r="7"/>
    <circle class="a-crater-dot" cx="302" cy="138" r="5"/>
  </g>
  <g class="a-ask"><text class="a-q" x="200" y="132">=?</text></g>
  <g class="a-twinkle"><path class="a-spark" d="M196 46v12M190 52h12"/></g>
  <g class="a-twinkle a-twinkle-2"><path class="a-spark" d="M40 190v9M35.5 194.5h9"/></g>
  <g class="a-twinkle a-twinkle-3"><path class="a-spark" d="M364 186v9M359.5 190.5h9"/></g>
`, 'art-twins');

/* 3 · The checklist — six boxes, ticked one after another, for ever. */
const checklist = () => {
  const rowsY = [52, 80, 108, 136, 164, 192];
  const rows = rowsY.map((y, i) => `
    <g class="a-row" style="--i:${i}">
      <rect class="a-box" x="118" y="${y - 10}" width="20" height="20" rx="3"/>
      <path class="a-tick" d="M122 ${y}l5 6 10-13"/>
      <path class="a-line" d="M150 ${y}h${[108, 86, 120, 74, 100, 92][i]}"/>
    </g>`).join('');
  return svg('0 0 400 240', `
    <rect class="a-pad" x="96" y="24" width="208" height="192" rx="8"/>
    <rect class="a-clip" x="178" y="14" width="44" height="18" rx="5"/>
    ${rows}
    <g class="a-twinkle"><path class="a-spark" d="M46 70v10M41 75h10"/></g>
    <g class="a-twinkle a-twinkle-2"><path class="a-spark" d="M352 150v10M347 155h10"/></g>
  `, 'art-checklist');
};

/* 4 · Nobody's perfect — six feature scores, deliberately uneven. */
const bars = () => {
  const vals = [0.86, 0.34, 0.71, 0.52, 0.93, 0.28];
  const labels = ['ROCK', 'TEMP', 'DUST', 'ICE', 'LAND', 'AIR'];
  const b = vals.map((v, i) => {
    const h = Math.round(v * 132), x = 56 + i * 50;
    return `<g class="a-bar" style="--i:${i};--h:${h}px">
      <rect class="a-bar-track" x="${x}" y="48" width="26" height="132" rx="3"/>
      <rect class="a-bar-fill" x="${x}" y="${180 - h}" width="26" height="${h}" rx="3"/>
      <text class="a-bar-t" x="${x + 13}" y="198">${labels[i]}</text>
      <text class="a-bar-v" x="${x + 13}" y="${172 - h}">${Math.round(v * 100)}</text>
    </g>`;
  }).join('');
  return svg('0 0 400 240', `
    <path class="a-axis" d="M44 180h320"/>
    ${b}
    <text class="a-cap" x="200" y="34">SIMILARITY PER FEATURE</text>
    <g class="a-twinkle"><path class="a-spark" d="M370 60v10M365 65h10"/></g>
  `, 'art-bars');
};

/* 5 · The land of long shadows — a low Sun sweeps a very long shadow off a crater rim. */
const shadow = () => svg('0 0 400 240', `
  ${ground(190)}
  <g class="a-sunlow"><circle class="a-sun" cx="52" cy="168" r="17"/>
    <path class="a-ray" d="M52 140v-12M52 208v10M24 168H12M92 168h-12M31 147l-8-8M73 189l8 8M73 147l8-8M31 189l-8 8"/></g>
  <g class="a-longshadow"><path class="a-shade" d="M214 190h150l-18 14H214Z"/></g>
  <path class="a-rim" d="M196 190c6-26 18-38 34-38s28 12 34 38Z"/>
  <ellipse class="a-hole" cx="230" cy="190" rx="34" ry="8"/>
  <text class="a-cap a-cap-s" x="230" y="222">NEVER LIT</text>
  <g class="a-twinkle"><path class="a-spark" d="M330 56v12M324 62h12"/></g>
  <g class="a-twinkle a-twinkle-2"><path class="a-spark" d="M150 40v9M145.5 44.5h9"/></g>
  <g class="a-twinkle a-twinkle-3"><path class="a-spark" d="M264 76v9M259.5 80.5h9"/></g>
`, 'art-shadow');

/* 6 · What Earth can't fake — Rookie jumps, Earth pulls, Rookie lands. */
const jump = () => svg('0 0 400 240', `
  ${ground(200)}
  <g class="a-jump">${rookie(200, 184, 1.05)}</g>
  <g class="a-thud"><path class="a-dust" d="M138 200c-8-6-18-6-26 0M262 200c8-6 18-6 26 0"/>
    <path class="a-dust" d="M152 188c-6-5-13-5-18 0M248 188c6-5 13-5 18 0"/></g>
  <g class="a-pull"><path class="a-arrow" d="M330 60v70m0 0-9-11m9 11 9-11"/>
    <text class="a-cap a-cap-s" x="330" y="152">1 g</text></g>
  <g class="a-twinkle"><path class="a-spark" d="M66 60v12M60 66h12"/></g>
  <g class="a-twinkle a-twinkle-2"><path class="a-spark" d="M120 36v9M115.5 40.5h9"/></g>
`, 'art-jump');

/* ---------------------------------------------------------------- game round art */
const desert = () => svg('0 0 400 180', `
  <circle class="a-sun a-sun-hot" cx="310" cy="54" r="24"/>
  <path class="a-ray a-shimmer" d="M310 16v-10M310 102v10M268 54h-10M362 54h-10"/>
  <path class="a-dune" d="M8 150c48-28 92 10 140-10s96-24 144 6 100 4 100 4v20H8Z"/>
  <path class="a-dune a-dune-2" d="M8 164c60-16 104 6 158-4s110-14 226 4v16H8Z"/>
  <path class="a-crack" d="M80 172h40M160 176h30M240 172h36"/>
`, 'art-desert');

const tube = () => svg('0 0 400 180', `
  <path class="a-roof" d="M20 160V112c0-50 40-84 90-84s90 34 90 84v48"/>
  <path class="a-roof a-roof-2" d="M200 160v-48c0-50 40-84 90-84s90 34 90 84v48"/>
  <path class="a-floor" d="M8 160h384"/>
  <g class="a-glow"><circle class="a-light" cx="110" cy="130" r="9"/></g>
  <path class="a-drip" d="M110 46v14M268 52v12"/>
  <text class="a-cap a-cap-s" x="200" y="176">LAVA TUBE</text>
`, 'art-tube');

const beach = () => svg('0 0 400 180', `
  <circle class="a-sun" cx="320" cy="44" r="18"/>
  <path class="a-trunk" d="M96 158c-4-36 2-62 14-80"/>
  <g class="a-fronds"><path class="a-frond" d="M110 78c-20-10-34-6-42 6M110 78c20-12 34-10 42 2M110 78c-6-20-2-32 8-40M110 78c12-14 26-16 36-10"/></g>
  <path class="a-sea" d="M8 150h384"/>
  <path class="a-wave a-wave-1" d="M180 158c14-8 28-8 42 0s28 8 42 0"/>
  <path class="a-wave a-wave-2" d="M240 170c14-8 28-8 42 0s28 8 42 0"/>
  <path class="a-dune" d="M8 160c40-10 90 2 130-2v22H8Z"/>
`, 'art-beach');

const crater = () => svg('0 0 400 180', `
  <ellipse class="a-ring" cx="200" cy="112" rx="150" ry="46"/>
  <ellipse class="a-ring a-ring-2" cx="200" cy="112" rx="104" ry="31"/>
  <ellipse class="a-hole" cx="200" cy="112" rx="58" ry="17"/>
  <path class="a-rim" d="M50 112c8-34 30-50 60-54M350 112c-8-34-30-50-60-54"/>
  <g class="a-flake"><path class="a-spark" d="M86 44v22M75 55h22M78 47l16 16M94 47 78 63"/></g>
  <g class="a-flake a-flake-2"><path class="a-spark" d="M318 40v16M310 48h16"/></g>
`, 'art-crater');

const valley = () => svg('0 0 400 180', `
  <path class="a-peak" d="M8 146 86 54l54 60 40-40 70 72H8Z"/>
  <path class="a-snow" d="M86 54l22 24c-14 6-30 6-44 0ZM180 74l16 16c-10 5-22 5-32 0Z"/>
  <path class="a-floor" d="M8 146h384"/>
  <path class="a-crack" d="M60 158h58M150 166h44M232 158h50M300 168h40"/>
  <g class="a-flake"><path class="a-spark" d="M330 48v18M321 57h18"/></g>
`, 'art-valley');

const gravity = () => svg('0 0 400 180', `
  <circle class="a-planet a-mars" cx="110" cy="96" r="44"/>
  <path class="a-planet-line" d="M70 82c24 10 56 10 80 0M68 112c26 10 58 10 84 0"/>
  <circle class="a-planet a-earth" cx="290" cy="96" r="44"/>
  <path class="a-planet-line" d="M250 82c24 10 56 10 80 0M248 112c26 10 58 10 84 0"/>
  <g class="a-weigh"><path class="a-arrow" d="M110 150v18m0 0-7-9m7 9 7-9"/></g>
  <g class="a-weigh a-weigh-2"><path class="a-arrow" d="M290 150v30m0 0-7-9m7 9 7-9"/></g>
  <text class="a-cap a-cap-s" x="110" y="34">38%</text>
  <text class="a-cap a-cap-s" x="290" y="34">100%</text>
`, 'art-gravity');

export const ART = {
  rover, twins, checklist, bars, shadow, jump,
  desert, tube, beach, crater, valley, gravity,
};

/** Illustration for a key; falls back to the rover so a typo never blanks a card. */
export const art = key => (ART[key] || ART.rover)();
