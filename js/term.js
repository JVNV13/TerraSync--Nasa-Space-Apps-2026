// Reusable glossary term component, fed from the single glossary in js/edu-content.js.
//
// Term('regolith')            -> dotted-underline word with a one-sentence definition
// Term('lava tube', 'tubes')  -> same definition, different visible wording
// rich('text with [[regolith]] in it') -> expands every [[key]] / [[key|label]] marker
//
// Definitions appear ONLY here, as tooltips. There is no glossary list on the page.
// The definition shows on hover, on keyboard focus and on tap: it rides the site's own
// delegated [data-tip] tooltip (see js/app.js), which already listens for mouseover and
// focusin. A <button> is used so that a tap focuses it on touch devices, and so the word
// is reachable with Tab. aria-describedby is not available for a shared tooltip node, so
// the definition is also exposed to assistive tech through the accessible name.
import { raw, esc } from './util.js';
import { GLOSSARY } from './edu-content.js';

/** One glossary term. Unknown keys fall through as plain text, so copy never breaks. */
export function Term(key, label) {
  const k = String(key).toLowerCase();
  const entry = GLOSSARY[k];
  const text = label || entry?.term?.toLowerCase() || key;
  if (!entry) return raw(esc(text));
  const tip = `<b>${esc(entry.term)}</b><span>${esc(entry.def)}</span>`;
  return raw(
    `<button type="button" class="term" data-tip="${esc(tip)}" ` +
    `aria-label="${esc(entry.term)}: ${esc(entry.def)}">${esc(text)}</button>`
  );
}

const MARKER = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/** Escape a string, then expand [[term]] markers into Term components. */
export function rich(text) {
  let out = '', last = 0;
  for (const m of String(text ?? '').matchAll(MARKER)) {
    out += esc(text.slice(last, m.index));
    out += Term(m[1].trim(), m[2]?.trim()).s;
    last = m.index + m[0].length;
  }
  return raw(out + esc(String(text ?? '').slice(last)));
}
