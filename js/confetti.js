// Tiny confetti burst: one short-lived canvas, no dependencies, no library.
// Silently does nothing when the visitor asked for reduced motion.

const COLORS = ['#8f7dff', '#b7a8ff', '#5b4bc4', '#4ba3c7', '#ece7df'];

/**
 * Fire a burst from a point in viewport coordinates.
 * @param {number} x
 * @param {number} y
 * @param {{count?: number, spread?: number, power?: number}} [opts]
 */
export function burst(x, y, { count = 90, spread = Math.PI, power = 9 } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const c = document.createElement('canvas');
  c.className = 'confetti-layer';
  c.setAttribute('aria-hidden', 'true');
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  c.style.cssText = `position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:70`;
  document.body.appendChild(c);
  const g = c.getContext('2d');
  if (!g) { c.remove(); return; }   // no 2D context: skip the flourish, never break the page
  g.scale(dpr, dpr);

  const bits = Array.from({ length: count }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * spread;
    const v = power * (0.45 + Math.random() * 0.75);
    return {
      x, y,
      vx: Math.cos(a) * v + (Math.random() - 0.5) * 1.6,
      vy: Math.sin(a) * v,
      w: 4 + Math.random() * 5,
      h: 7 + Math.random() * 7,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      col: COLORS[(Math.random() * COLORS.length) | 0],
      life: 0,
    };
  });

  const TTL = 95; // frames
  let frame = 0, raf = 0;
  const tick = () => {
    frame++;
    g.clearRect(0, 0, innerWidth, innerHeight);
    let alive = 0;
    for (const b of bits) {
      b.life++;
      b.vy += 0.26;            // gravity
      b.vx *= 0.99;            // drag
      b.x += b.vx; b.y += b.vy; b.r += b.vr;
      if (b.y - 20 > innerHeight) continue;
      alive++;
      g.save();
      g.globalAlpha = Math.max(0, 1 - b.life / TTL);
      g.translate(b.x, b.y); g.rotate(b.r);
      g.fillStyle = b.col;
      g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      g.restore();
    }
    if (alive && frame < TTL) raf = requestAnimationFrame(tick);
    else { cancelAnimationFrame(raf); c.remove(); }
  };
  raf = requestAnimationFrame(tick);
}

/** Convenience: burst from the centre of an element. */
export function burstFrom(el, opts) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height * 0.42, opts);
}
