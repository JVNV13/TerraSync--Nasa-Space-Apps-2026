// 03 · Learn: a full-page card deck. Six story cards that flip, then the six-round game.
// Copy lives in js/edu-content.js, illustrations in js/edu-art.js, tooltips in js/term.js.
// All state is module-local: no backend, no login, nothing stored.
import { html, render, raw, esc, $, $$ } from '../util.js';
import { rich } from '../term.js';
import { art } from '../edu-art.js';
import { burstFrom } from '../confetti.js';
import { HERO, DECK, CARDS, GAME } from '../edu-content.js';

/* ------------------------------------------------------------------ state */
// slides: the six story cards, then one slide per game round, then the end card.
const ROUNDS = GAME.rounds.length;
const LAST_STORY = CARDS.length - 1;
const END = CARDS.length + ROUNDS;

const S = {
  i: 0,                 // slide index
  flipped: new Set(),   // ids of story cards whose back has been seen
  face: 'front',        // current slide's visible face
  score: 0,
  picked: null,         // the answer given on the current round, or null
  photos: new Map(),    // src -> true once a photo is known to exist
};

const kind = i => (i <= LAST_STORY ? 'story' : i < END ? 'game' : 'end');
const roundAt = i => GAME.rounds[i - CARDS.length];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const rankFor = s => GAME.ranks.filter(r => s >= r.min).pop() || GAME.ranks[0];

/* ------------------------------------------------------------------ pieces */

/** Art area: the animated SVG, plus a photo on top once we know the file is there. */
function artBox(key, photo, tall) {
  const has = photo && S.photos.get(photo);
  return html`<div class="cf-art${tall ? ' tall' : ''}${has ? ' has-photo' : ''}"${photo ? raw(` data-photo="${esc(photo)}"`) : ''}>
    ${art(key)}
    ${has ? html`<img class="cf-photo" src="${photo}" alt="">` : ''}
  </div>`;
}

function storyCard(c) {
  return html`<article class="cf-card" data-id="${c.id}" data-kind="story">
    <div class="cf-tilt">
      <div class="cf-inner">
        <button type="button" class="cf-face cf-front" aria-label="${c.title}. ${c.teaser} Flip the card to read it.">
          ${artBox(c.art, c.photo, true)}
          <div class="cf-front-txt">
            <p class="cf-n">${DECK.cardLabel} ${String(c.n).padStart(2, '0')} <i>/</i> ${CARDS.length}</p>
            <h3 class="cf-title">${c.title}</h3>
            <p class="cf-teaser">${c.teaser}</p>
            <span class="cf-hint">${DECK.flipHint}<b aria-hidden="true">↻</b></span>
          </div>
        </button>
        <div class="cf-face cf-back">
          <div class="cf-back-head">
            <p class="cf-n">${DECK.cardLabel} ${String(c.n).padStart(2, '0')}</p>
            <h3 class="cf-title cf-title-sm">${c.title}</h3>
            <button type="button" class="cf-flipback" data-act="unflip">${DECK.flipBack}<b aria-hidden="true">↺</b></button>
          </div>
          <div class="cf-story"><p>${rich(c.story)}</p></div>
          <div class="cf-back-foot">
            <p class="cf-badge"><span aria-hidden="true">★</span>${c.badge}</p>
            ${c.cta ? html`<a class="btn primary cf-cta" href="${c.cta.href}"${c.cta.external ? raw(' target="_blank" rel="noopener"') : ''}>${c.cta.label}<b aria-hidden="true">${c.cta.external ? '↗' : '→'}</b></a>` : ''}
          </div>
        </div>
      </div>
    </div>
  </article>`;
}

function gameCard(i) {
  const q = roundAt(i), n = i - CARDS.length + 1;
  const answered = S.picked !== null;
  const right = answered && S.picked === q.answer;
  const last = n === ROUNDS;
  return html`<article class="cf-card" data-kind="game">
    <div class="cf-tilt">
      <div class="cf-inner">
        <div class="cf-face cf-front">
          ${artBox(q.art, q.photo, false)}
          <div class="cf-front-txt">
            <p class="cf-n">${GAME.roundLabel} ${n} <i>/</i> ${ROUNDS}</p>
            <h3 class="cf-title cf-title-sm">${q.place}</h3>
            <p class="cf-claim">${rich(q.claim)}</p>
            <div class="cf-answers">
              <button type="button" class="btn cf-no" data-act="no">${GAME.no}</button>
              <button type="button" class="btn primary cf-yes" data-act="yes">${GAME.yes}</button>
            </div>
            <p class="cf-swipe-tip">${GAME.intro}</p>
          </div>
          <span class="cf-stamp cf-stamp-yes" aria-hidden="true">${GAME.swipeYes}</span>
          <span class="cf-stamp cf-stamp-no" aria-hidden="true">${GAME.swipeNo}</span>
        </div>
        <div class="cf-face cf-back cf-verdict ${right ? 'good' : 'bad'}">
          <p class="cf-vmark" aria-hidden="true">${right ? '✓' : '✕'}</p>
          <h3 class="cf-title cf-title-sm">${right ? GAME.rightLabel : GAME.wrongLabel}</h3>
          <p class="cf-reason">${rich(q.reason)}</p>
          <p class="cf-react"><span>${GAME.reactionLabel}</span>${rich(q.reaction)}</p>
          <button type="button" class="btn primary" data-act="advance">${last ? GAME.finish : GAME.next}<b aria-hidden="true">→</b></button>
        </div>
      </div>
    </div>
  </article>`;
}

function endCard() {
  const r = rankFor(S.score);
  return html`<article class="cf-card" data-kind="end">
    <div class="cf-tilt">
      <div class="cf-inner">
        <div class="cf-face cf-front cf-end">
          <p class="cf-n">${GAME.title}</p>
          <p class="cf-score"><b>${S.score}</b><span>${GAME.scoreLabel} ${ROUNDS}</span></p>
          <h3 class="cf-rank">${r.name}</h3>
          <p class="cf-rank-note">${r.note}</p>
          <div class="cf-answers">
            <button type="button" class="btn" data-act="replay">${GAME.again}</button>
            <a class="btn primary" href="${GAME.toolHref}">${GAME.toTool}<b aria-hidden="true">→</b></a>
          </div>
        </div>
      </div>
    </div>
  </article>`;
}

const slide = i => (kind(i) === 'story' ? storyCard(CARDS[i]) : kind(i) === 'game' ? gameCard(i) : endCard());

/** Dots for the story cards, plus round pips once the game starts. */
function footHTML() {
  const k = kind(S.i);
  if (k === 'story') {
    return html`<div class="deck-dots" role="tablist" aria-label="Cards">
      ${CARDS.map((c, n) => html`<button type="button" role="tab" class="dot${S.flipped.has(c.id) ? ' done' : ''}${n === S.i ? ' now' : ''}"
        aria-selected="${String(n === S.i)}" aria-label="${DECK.dotLabel} ${n + 1}${S.flipped.has(c.id) ? ', ' + DECK.readLabel : ''}" data-go="${n}"></button>`)}
    </div>`;
  }
  if (k === 'game') {
    const n = S.i - CARDS.length;
    return html`<div class="deck-dots pips" aria-hidden="true">
      ${GAME.rounds.map((_, j) => html`<i class="pip${j < n ? ' done' : j === n ? ' now' : ''}"></i>`)}
    </div>`;
  }
  return html`<div class="deck-dots"></div>`;
}

/** Prev arrow, progress dots and next arrow on one row, below the card. Laid out in
    normal flow so an arrow can never be pushed off the side of the screen. */
function barHTML() {
  const k = kind(S.i);
  const showPrev = k === 'story' && S.i > 0;
  const nextLabel = S.i === LAST_STORY ? DECK.toGame : DECK.next;
  return html`
    <button type="button" class="deck-arrow prev${showPrev ? '' : ' hide'}" data-act="prev" aria-label="${DECK.prev}"${showPrev ? '' : raw(' tabindex="-1" aria-hidden="true"')}><span aria-hidden="true">←</span></button>
    ${footHTML()}
    <button type="button" class="deck-arrow next${k === 'story' ? '' : ' hide'}" data-act="next" aria-label="${nextLabel}" title="${nextLabel}"${k === 'story' ? '' : raw(' tabindex="-1" aria-hidden="true"')}><span aria-hidden="true">→</span></button>`;
}

/* ------------------------------------------------------------------ page */
export function render_(root) {
  render(root, html`
  <section class="learn" aria-labelledby="learn-h">
    <div class="learn-glow" aria-hidden="true"><i></i><i></i></div>
    <header class="learn-head">
      <p class="crumb"><a href="#start">Start</a><span>/</span><b>${HERO.crumb}</b></p>
      <h1 class="learn-title" id="learn-h">${HERO.title}</h1>
      <p class="learn-sub">${HERO.sub}</p>
    </header>

    <div class="deck" role="group" aria-roledescription="card deck" aria-label="${HERO.title}">
      <div class="deck-stage" id="deck-stage">${slide(S.i)}</div>
      <div class="deck-bar" id="deck-bar">${barHTML()}</div>
      <p class="edu-sr" aria-live="polite" id="deck-say"></p>
    </div>
  </section>`);

  const stage = $('#deck-stage', root);
  const bar = $('#deck-bar', root);
  const say = $('#deck-say', root);

  const card = () => stage.querySelector('.cf-card:not(.leaving)');
  const announce = () => {
    const k = kind(S.i);
    say.textContent = k === 'story'
      ? `${DECK.cardLabel} ${S.i + 1} ${DECK.of} ${CARDS.length}: ${CARDS[S.i].title}`
      : k === 'game' ? `${GAME.roundLabel} ${S.i - CARDS.length + 1} ${DECK.of} ${ROUNDS}: ${roundAt(S.i).place}`
      : `${GAME.title}: ${S.score} ${GAME.scoreLabel} ${ROUNDS}`;
  };

  /* ---- faces: keep the hidden one out of the tab order and the a11y tree */
  function syncFaces(el = card()) {
    if (!el) return;
    const flipped = el.classList.contains('flipped');
    const front = $('.cf-front', el), back = $('.cf-back', el);
    for (const [face, hidden] of [[front, flipped], [back, !flipped]]) {
      if (!face) continue;
      face.inert = hidden;
      face.setAttribute('aria-hidden', String(hidden));
    }
  }

  function flip(to) {
    const el = card(); if (!el) return;
    const want = to ?? !el.classList.contains('flipped');
    el.classList.toggle('flipped', want);
    S.face = want ? 'back' : 'front';
    syncFaces(el);
    if (want && el.dataset.id) {
      S.flipped.add(el.dataset.id);
      paintBar();
      // Move focus onto the revealed side so keyboard reading continues there.
      ($('.cf-flipback', el) || el).focus({ preventScroll: true });
    } else if (!want) {
      $('.cf-front', el)?.focus({ preventScroll: true });
    }
  }

  const paintBar = () => { bar.innerHTML = barHTML().s; };

  /** Swap slides with a slide-out / slide-in pair. */
  function go(next, dir = next > S.i ? 1 : -1) {
    if (next < 0 || next > END || next === S.i) return;
    const old = card();
    // Clicking through quickly must not stack half-faded cards on the stage.
    stage.querySelectorAll('.cf-card.leaving').forEach(el => el.remove());
    S.i = next; S.face = 'front'; S.picked = null;

    const incoming = document.createElement('div');
    incoming.innerHTML = slide(S.i).s;
    const fresh = incoming.firstElementChild;

    if (old) {
      old.classList.add('leaving', dir > 0 ? 'out-left' : 'out-right');
      old.inert = true;
      const drop = () => old.remove();
      old.addEventListener('animationend', drop, { once: true });
      setTimeout(drop, 700);
    }
    const inClass = dir > 0 ? 'in-right' : 'in-left';
    fresh.classList.add(inClass);
    stage.appendChild(fresh);
    // Belt and braces: if animationend never arrives the class must still go, or the
    // card would sit stranded off-centre.
    const settle = () => fresh.classList.remove('in-right', 'in-left');
    fresh.addEventListener('animationend', settle, { once: true });
    setTimeout(settle, 700);

    syncFaces(fresh);
    paintBar(); announce(); loadPhotos();
    (kind(S.i) === 'story' ? $('.cf-front', fresh) : fresh.querySelector('[data-act], a, button'))?.focus({ preventScroll: true });
  }

  /* ---- game */
  function answer(pick) {
    if (kind(S.i) !== 'game' || S.picked !== null) return;
    const el = card(); if (!el) return;
    const q = roundAt(S.i);
    S.picked = pick;
    const right = pick === q.answer;
    if (right) S.score++;

    // Re-render the back with the verdict for this answer, then flip to it.
    const holder = document.createElement('div');
    holder.innerHTML = gameCard(S.i).s;
    el.querySelector('.cf-back').replaceWith(holder.querySelector('.cf-back'));

    el.classList.add('flipped');
    S.face = 'back';
    syncFaces(el);
    if (right) burstFrom(el);
    else {
      el.classList.add('shake');
      el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
    }
    el.querySelector('.cf-back [data-act="advance"]')?.focus({ preventScroll: true });
    say.textContent = `${right ? GAME.rightLabel : GAME.wrongLabel}. ${q.reason.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, k, l) => l || k)}`;
  }

  function replay() {
    S.score = 0; S.picked = null;
    go(CARDS.length, 1);
  }

  /* ---- one click handler for the whole deck */
  stage.addEventListener('click', e => {
    const el = card(); if (!el) return;
    const hit = e.target.closest('[data-act]');
    if (hit && stage.contains(hit)) {
      switch (hit.dataset.act) {
        case 'unflip': flip(false); return;
        case 'yes': answer(true); return;
        case 'no': answer(false); return;
        case 'advance': go(S.i + 1, 1); return;
        case 'replay': replay(); return;
      }
    }
    // Clicking the front of a story card flips it; clicking its back flips it home,
    // unless the click landed on a link, a button or a glossary word.
    if (el.dataset.kind !== 'story') return;
    if (e.target.closest('a, button, .term')) {
      if (e.target.closest('.cf-front')) flip(true);
      return;
    }
    if (el.classList.contains('flipped')) flip(false);
  });

  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-act], [data-go]'); if (!b) return;
    if (b.dataset.act === 'next') go(S.i + 1, 1);
    else if (b.dataset.act === 'prev') go(S.i - 1, -1);
    else if (b.dataset.go !== undefined) go(+b.dataset.go);
  });

  /* ---- keyboard: arrows move the deck, and answer during the game */
  function onKey(e) {
    if (!root.isConnected || !root.contains(stage)) return;
    // With nothing focused the target can be the document, which has no element methods.
    const tgt = e.target;
    if (tgt?.matches?.('input, select, textarea')) return;
    const k = kind(S.i), el = card();
    if (e.key === 'ArrowRight') {
      if (k === 'game' && S.picked === null) { e.preventDefault(); answer(true); }
      else if (k === 'game' && S.picked !== null) { e.preventDefault(); go(S.i + 1, 1); }
      else if (k === 'story') { e.preventDefault(); go(S.i + 1, 1); }
    } else if (e.key === 'ArrowLeft') {
      if (k === 'game' && S.picked === null) { e.preventDefault(); answer(false); }
      else if (k === 'story') { e.preventDefault(); go(S.i - 1, -1); }
    } else if ((e.key === ' ' || e.key === 'Enter') && k === 'story' && el && !tgt?.closest?.('a, button')) {
      e.preventDefault(); flip();
    }
  }
  document.addEventListener('keydown', onKey);
  // Replaced when the route re-renders; drop the old listener so it cannot pile up.
  root._eduCleanup?.();
  root._eduCleanup = () => document.removeEventListener('keydown', onKey);

  /* ---- pointer: swipe story cards, drag-to-answer in the game */
  let drag = null;
  stage.addEventListener('pointerdown', e => {
    const el = card();
    if (!el || e.button !== 0 || e.target.closest('a, button, .term')) return;
    if (el.classList.contains('flipped') && el.dataset.kind === 'story') return;
    if (kind(S.i) === 'end') return;
    drag = { x: e.clientX, y: e.clientY, el, moved: false, game: kind(S.i) === 'game' };
    el.setPointerCapture?.(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) < 8) return;
    if (!drag.moved && Math.abs(dy) > Math.abs(dx)) { drag = null; return; } // let the page scroll
    drag.moved = true;
    drag.dx = dx;
    drag.el.classList.add('dragging');
    drag.el.style.setProperty('--dx', dx + 'px');
    drag.el.style.setProperty('--rot', (dx / 26).toFixed(2) + 'deg');
    if (drag.game) drag.el.style.setProperty('--stamp', String(Math.min(1, Math.abs(dx) / 110)));
    drag.el.classList.toggle('to-yes', drag.game && dx > 40);
    drag.el.classList.toggle('to-no', drag.game && dx < -40);
  });
  function endDrag() {
    if (!drag) return;
    const { el, dx = 0, game, moved } = drag;
    drag = null;
    el.classList.remove('dragging', 'to-yes', 'to-no');
    el.style.removeProperty('--dx'); el.style.removeProperty('--rot'); el.style.removeProperty('--stamp');
    if (!moved) return;
    const far = Math.abs(dx) > 90;
    if (!far) return;
    if (game) answer(dx > 0);
    else go(dx < 0 ? S.i + 1 : S.i - 1, dx < 0 ? 1 : -1);
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  /* ---- hover tilt (pointer devices only; harmless if it never fires) */
  stage.addEventListener('pointermove', e => {
    if (drag || reduced() || e.pointerType === 'touch') return;
    const el = card(); if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--tx', (-py * 5).toFixed(2) + 'deg');
    el.style.setProperty('--ty', (px * 6).toFixed(2) + 'deg');
  });
  stage.addEventListener('pointerleave', () => {
    const el = card(); if (!el) return;
    el.style.setProperty('--tx', '0deg'); el.style.setProperty('--ty', '0deg');
  });

  /* ---- optional photos: show one only once we know the file is really there */
  function loadPhotos() {
    $$('.cf-art[data-photo]', stage).forEach(box => {
      const src = box.dataset.photo;
      if (S.photos.get(src) === false) return;
      if (S.photos.get(src)) { showPhoto(box, src); return; }
      const probe = new Image();
      probe.onload = () => { S.photos.set(src, true); showPhoto(box, src); };
      probe.onerror = () => S.photos.set(src, false);   // keep the SVG, no console noise
      probe.src = src;
    });
  }
  function showPhoto(box, src) {
    if (box.querySelector('.cf-photo')) return;
    const img = new Image();
    img.className = 'cf-photo'; img.alt = ''; img.src = src;
    box.appendChild(img);
    box.classList.add('has-photo');
  }

  syncFaces(); announce(); loadPhotos();
}
export { render_ as render };
