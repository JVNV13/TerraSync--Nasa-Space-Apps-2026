// Lunar Light · procedural SVG diagrams for the Moon page (no image files).
// Every diagram is geometry from the text beside it; none of them carries data.

const deg = d => (d * Math.PI) / 180;

/** Hero: a lunar plain seen from low down, a Sun on the horizon, and shadows many times longer
 *  than the hills that cast them, stretching across the ground toward the viewer's left. */
export function heroArt() {
  const H = 228; // horizon line
  // hills: [x, base y, half width, height]; shadow runs left, ~ height / tan(Sun) squeezed for the page
  const hills = [[640, 252, 46, 34], [470, 286, 70, 52], [760, 318, 40, 26], [300, 340, 90, 64], [610, 378, 54, 30]];
  const hill = ([x, y, w, h]) => {
    const len = h * 9.5, dy = (y - H) * 0.22;
    return `<path class="ll-shadow" d="M${x - w} ${y} L${x + w * 0.15} ${y} L${x - w - len} ${y + dy + 10} L${x - w - len * 0.98} ${y + dy - 2}Z" fill="#020203" opacity=".93"/>
      <path d="M${x - w} ${y} Q${x - w * 0.35} ${y - h * 1.05} ${x} ${y - h} Q${x + w * 0.5} ${y - h * 0.9} ${x + w} ${y}Z" fill="url(#llLit)"/>
      <path d="M${x - w} ${y} Q${x - w * 0.35} ${y - h * 1.05} ${x} ${y - h} L${x - w * 0.05} ${y}Z" fill="#141416" opacity=".9"/>`;
  };
  return `<svg class="ll-hero-art" viewBox="0 0 900 440" role="img" aria-label="A low Sun on the lunar horizon casting very long shadows across the ground">
  <defs>
    <radialGradient id="llSun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6dc"/><stop offset=".2" stop-color="#ffe2a0" stop-opacity=".9"/><stop offset="1" stop-color="#ffcf70" stop-opacity="0"/></radialGradient>
    <linearGradient id="llGround" x1="1" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#b9b2a4"/><stop offset=".45" stop-color="#77726a"/><stop offset="1" stop-color="#2b2a28"/></linearGradient>
    <linearGradient id="llLit" x1="1" x2="0"><stop offset="0" stop-color="#fff1d2"/><stop offset=".6" stop-color="#c9c0ae"/><stop offset="1" stop-color="#6f6a62"/></linearGradient>
    <linearGradient id="llGlow" x1="1" x2="0"><stop offset="0" stop-color="#ffdc8f" stop-opacity=".35"/><stop offset=".5" stop-color="#ffdc8f" stop-opacity="0"/></linearGradient>
  </defs>
  <g class="ll-stars" fill="#fff">${[[60, 40], [140, 92], [230, 30], [330, 120], [420, 54], [505, 140], [610, 36], [700, 96], [40, 160], [260, 180], [470, 196], [160, 200]]
    .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1.1 : 1.7}" opacity="${0.35 + (i % 4) * 0.12}"/>`).join('')}</g>
  <g class="ll-sun"><circle cx="840" cy="${H - 6}" r="150" fill="url(#llSun)" opacity=".7"/><circle cx="840" cy="${H - 6}" r="15" fill="#fff4d6"/></g>
  <path d="M0 ${H} L900 ${H} L900 440 L0 440Z" fill="url(#llGround)"/>
  <path d="M0 ${H} L900 ${H} L900 ${H + 60} L0 ${H + 20}Z" fill="url(#llGlow)"/>
  ${[[720, 270, 18, 5], [380, 312, 26, 7], [180, 268, 16, 4], [820, 360, 22, 6], [120, 400, 34, 9], [520, 418, 28, 7]]
    .map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#1a1918" opacity=".75"/><path d="M${x - rx} ${y} A${rx} ${ry} 0 0 0 ${x + rx} ${y}" fill="none" stroke="#e9dfc8" stroke-opacity=".55" stroke-width="1.5"/>`).join('')}
  ${hills.map(hill).join('')}
  <g class="ll-rover" transform="translate(200 300)"><g transform="scale(1.2)">
    <rect x="-16" y="-10" width="32" height="10" rx="2" fill="#e6e1d6"/><rect x="-6" y="-20" width="4" height="10" fill="#e6e1d6"/><rect x="-10" y="-25" width="12" height="5" rx="1" fill="#e6e1d6"/>
    <circle cx="-10" cy="2" r="4.5" fill="#3b3b3f"/><circle cx="10" cy="2" r="4.5" fill="#3b3b3f"/>
    <path d="M-16 0 L-120 5 L-120 1Z" fill="#020203" opacity=".9"/>
  </g></g>
</svg>`;
}

/** Axis tilt: Earth 23.4° vs Moon 1.5°, with sunlight arriving from the side. */
export function tiltArt() {
  const body = (cx, r, tilt, fill, label, sub) => {
    const a = deg(tilt), dx = Math.sin(a) * (r + 26), dy = Math.cos(a) * (r + 26);
    return `<g>
      <circle cx="${cx}" cy="130" r="${r}" fill="${fill}"/>
      <path d="M${cx} ${130 - r} A${r} ${r} 0 0 1 ${cx} ${130 + r}Z" fill="#000" opacity=".5"/>
      <line x1="${cx - dx}" y1="${130 + dy}" x2="${cx + dx}" y2="${130 - dy}" stroke="#f2d48a" stroke-width="2.4" stroke-linecap="round"/>
      <line x1="${cx}" y1="${130 + r + 30}" x2="${cx}" y2="${130 - r - 30}" stroke="#ffffff" stroke-opacity=".25" stroke-dasharray="4 5"/>
      <text x="${cx}" y="${130 + r + 52}" text-anchor="middle" class="ll-svg-t">${label}</text>
      <text x="${cx}" y="${130 + r + 72}" text-anchor="middle" class="ll-svg-s">${sub}</text>
    </g>`;
  };
  return `<svg viewBox="0 0 560 300" role="img" aria-label="Earth's axis is tilted 23.4 degrees, the Moon's only about 1.5 degrees">
    <g class="ll-rays" stroke="#ffd98a" stroke-opacity=".35" stroke-width="1.5">${[60, 95, 130, 165, 200].map(y => `<line x1="0" y1="${y}" x2="60" y2="${y}"/>`).join('')}</g>
    <text x="8" y="40" class="ll-svg-s">sunlight</text>
    ${body(190, 66, 23.4, '#3d7fb0', 'Earth: 23.4°', 'seasons swing the Sun up and down')}
    ${body(420, 46, 1.54, '#bdb8ad', 'Moon: about 1.5°', 'at the pole the Sun just circles the horizon')}
  </svg>`;
}

/** Shadow length = height / tan(Sun elevation). The post keeps one size; at low Sun the shadow
 *  runs off the left edge, which is the point. */
export function shadowArt(alt) {
  const x0 = 470, base = 170, hs = 64;
  const ratio = 1 / Math.tan(deg(alt));
  const L = hs * ratio;
  const off = L > x0 - 20;
  const tip = off ? 20 : x0 - L;
  const lab = `shadow = ${ratio.toFixed(1)} × height${off ? `  (${Math.round(L / (x0 - 20) * 10) / 10}× wider than this picture)` : ''}`;
  return `<svg viewBox="0 0 560 230" role="img" aria-label="At ${alt} degrees the shadow is ${ratio.toFixed(0)} times the height">
    <defs><linearGradient id="llFade" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="${off ? 0 : 0.85}"/><stop offset=".25" stop-color="#000" stop-opacity=".85"/></linearGradient></defs>
    <rect x="0" y="${base}" width="560" height="60" fill="#3a3834"/>
    <polygon points="${tip},${base} ${x0},${base} ${x0},${base + 0.5} ${tip},${base + 14}" fill="url(#llFade)"/>
    <rect x="${tip}" y="${base}" width="${x0 - tip}" height="14" fill="url(#llFade)"/>
    <rect x="${x0}" y="${base - hs}" width="12" height="${hs}" fill="#d9d5cc"/>
    <line x1="${x0 + 6}" y1="${base - hs}" x2="${x0 + 6 + 90}" y2="${base - hs - 90 * Math.tan(deg(alt))}" stroke="#f2d48a" stroke-width="1.6" stroke-dasharray="5 5"/>
    <line x1="${x0 + 6}" y1="${base - hs}" x2="${Math.max(tip, x0 - 420)}" y2="${base - hs + Math.min(L, 420) * Math.tan(deg(alt))}" stroke="#f2d48a" stroke-width="1.6" stroke-dasharray="5 5" opacity=".7"/>
    ${off ? `<text x="24" y="${base + 10}" class="ll-svg-s" fill="#bbb">◀ continues</text>` : ''}
    <line x1="${tip}" y1="${base + 26}" x2="${x0}" y2="${base + 26}" stroke="#7fa7e0" stroke-width="2"/>
    <text x="${(tip + x0) / 2}" y="${base + 48}" text-anchor="middle" class="ll-svg-t">${lab}</text>
    <text x="${x0 + 22}" y="${base - hs / 2}" class="ll-svg-s">height</text>
    <text x="10" y="28" class="ll-svg-s">Sun ${alt}° above the horizon →</text>
  </svg>`;
}

/** Camera problem: a crater and a shadow look identical as black patches. */
export function cameraArt() {
  return `<svg viewBox="0 0 560 230" role="img" aria-label="To a camera, a hole and a shadow are both just black">
    <g transform="translate(20 20)">
      <rect width="240" height="150" rx="10" fill="#8f8b83"/>
      <ellipse cx="120" cy="80" rx="62" ry="30" fill="#050505"/>
      <ellipse cx="120" cy="73" rx="62" ry="24" fill="none" stroke="#c9c4ba" stroke-width="3" stroke-dasharray="0 400 120"/>
      <text x="120" y="182" text-anchor="middle" class="ll-svg-t">A crater, 4 m deep</text>
    </g>
    <g transform="translate(300 20)">
      <rect width="240" height="150" rx="10" fill="#8f8b83"/>
      <ellipse cx="120" cy="80" rx="62" ry="30" fill="#050505"/>
      <rect x="196" y="58" width="10" height="20" fill="#d9d5cc"/>
      <text x="120" y="182" text-anchor="middle" class="ll-svg-t">A shadow on flat ground</text>
    </g>
    <text x="280" y="222" text-anchor="middle" class="ll-svg-s">With no light inside, both are the same black pixels.</text>
  </svg>`;
}

/** Sun paths: steep at the equator (minutes of low Sun), shallow near the poles (hours). */
export function pathsArt() {
  const arc = (cx, tilt, col, label, sub) => {
    const r = 92;
    const a = deg(tilt);
    const ex = Math.cos(a) * r;
    return `<g>
      <line x1="${cx - 120}" y1="170" x2="${cx + 120}" y2="170" stroke="#ffffff" stroke-opacity=".3"/>
      <rect x="${cx - 120}" y="${170 - 7 * 2.4}" width="240" height="${7 * 2.4}" fill="#f2d48a" opacity=".12"/>
      <path d="M${cx - ex} 170 Q ${cx} ${170 - 2 * r * Math.sin(a)} ${cx + ex} 170" fill="none" stroke="${col}" stroke-width="2.4"/>
      <text x="${cx}" y="200" text-anchor="middle" class="ll-svg-t">${label}</text>
      <text x="${cx}" y="220" text-anchor="middle" class="ll-svg-s">${sub}</text>
    </g>`;
  };
  return `<svg viewBox="0 0 560 240" role="img" aria-label="The Sun's daily path is steep near the equator and shallow near the poles">
    ${arc(140, 80, '#ffd98a', 'Near the equator', 'climbs straight through the low band')}
    ${arc(420, 14, '#ffd98a', 'Near the poles', 'skims along the low band')}
    <text x="12" y="${170 - 7 * 2.4 - 6}" class="ll-svg-s">0–7° band</text>
  </svg>`;
}

/** Air: Earth's sky fills shadows with blue light; the Moon's shadows stay black. */
export function skyArt() {
  return `<svg viewBox="0 0 560 230" role="img" aria-label="Earth's sky lights shadows, the airless Moon does not">
    <g transform="translate(20 10)">
      <rect width="240" height="170" rx="10" fill="#4f7fae"/>
      <rect y="110" width="240" height="60" fill="#8b8274"/>
      <polygon points="40,110 90,70 140,110" fill="#b4a998"/>
      <polygon points="140,110 90,70 120,110 230,124 230,116" fill="#2f3646" opacity=".9"/>
      ${[30, 80, 130, 180].map(x => `<line x1="${x}" y1="18" x2="${x + 30}" y2="100" stroke="#cfe3ff" stroke-opacity=".55" stroke-dasharray="3 4"/>`).join('')}
      <text x="120" y="198" text-anchor="middle" class="ll-svg-t">Earth: sky light fills the shadow</text>
    </g>
    <g transform="translate(300 10)">
      <rect width="240" height="170" rx="10" fill="#020203"/>
      <rect y="110" width="240" height="60" fill="#77736b"/>
      <polygon points="40,110 90,70 140,110" fill="#cbc6bb"/>
      <polygon points="140,110 90,70 120,110 230,124 230,116" fill="#000"/>
      <text x="120" y="198" text-anchor="middle" class="ll-svg-t">Moon: no air, the shadow is black</text>
    </g>
  </svg>`;
}

/** Method pipeline icons (tiny glyphs, 32×32). */
export const ICONS = {
  dem: '<path d="M3 24l7-9 5 6 4-5 10 8z"/><path d="M3 27h26"/>',
  grid: '<rect x="5" y="5" width="22" height="22"/><path d="M5 12h22M5 19h22M12 5v22M19 5v22"/>',
  sun: '<circle cx="24" cy="10" r="4"/><path d="M3 26h26M6 26l14-6"/>',
  print: '<path d="M8 26c0-10 4-16 8-16s8 6 8 16"/><path d="M12 26c0-6 2-10 4-10s4 4 4 10"/>',
  compare: '<circle cx="11" cy="16" r="7"/><circle cx="21" cy="16" r="7"/>',
  clock: '<circle cx="16" cy="16" r="11"/><path d="M16 9v7l5 3"/>',
  score: '<path d="M5 26V16M12 26V10M19 26V14M26 26V6"/>',
};
