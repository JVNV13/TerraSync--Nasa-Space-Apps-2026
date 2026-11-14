// Small DOM + formatting helpers shared by every view.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ESC[c]);

/** Tagged template that escapes interpolations unless wrapped with raw(). */
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) {
      const v = vals[i];
      if (v == null || v === false) return;
      if (Array.isArray(v)) out += v.map(x => (x && x.__raw ? x.s : esc(x))).join('');
      else out += v && v.__raw ? v.s : esc(v);
    }
  });
  return { __raw: true, s: out };
}
export const raw = s => ({ __raw: true, s: String(s) });
export const render = (el, tpl) => { el.innerHTML = tpl.__raw ? tpl.s : esc(tpl); };

export const pct = (v, d = 0) => (v == null ? '—' : (v * 100).toFixed(d));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function fmtCoord(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S', ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`;
}

// Sequential "bone" ramp for magnitudes (one hue, dark→light).
const RAMP = [[20, 25, 34], [58, 60, 62], [110, 104, 92], [170, 158, 130], [239, 227, 196]];
export function rampColor(t) {
  t = clamp(t, 0, 1) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(t)), f = t - i;
  const c = RAMP[i].map((v, k) => Math.round(v + (RAMP[i + 1][k] - v) * f));
  return `rgb(${c.join(',')})`;
}

// Shared tooltip
let tipEl;
export function tip(evt, content) {
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
  if (content == null) { tipEl.classList.remove('on'); return; }
  tipEl.innerHTML = content.__raw ? content.s : esc(content);
  tipEl.classList.add('on');
  const pad = 14, r = tipEl.getBoundingClientRect();
  let x = evt.clientX + pad, y = evt.clientY + pad;
  if (x + r.width > innerWidth - 8) x = evt.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = evt.clientY - r.height - pad;
  tipEl.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
}
export const hideTip = () => tip(null, null);

/** Copy text with graceful fallback (downloads are blocked in the host frame). */
export async function copyText(text, btn) {
  const label = btn?.textContent;
  try {
    await navigator.clipboard.writeText(text);
    if (btn) btn.textContent = 'Copied ✓';
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
    if (btn) btn.textContent = ok ? 'Copied ✓' : 'Copy blocked — select text below';
    if (!ok) return false;
  }
  if (btn) setTimeout(() => (btn.textContent = label), 1800);
  return true;
}

export const store = {
  get(k, d) { try { const v = localStorage.getItem('ts:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ts:' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
