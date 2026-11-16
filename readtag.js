// Hugo's read tag: while he reads for a real lookup (the kernel's 'mortal:lookup' start), "(web fetch)" sits beside his head;
// when the result lands with the belief service's LLM gist (2-5 words), that replaces it, holds ~3 s and rolls out. No gist: the
// tag just goes. Text only (no bubble, owner 2026-11-15), Hugo only (the dove reads silently, the Void mascot never looks things up).
// Style: ?tag=N or <html data-tag="N">, N = 1..6. A style is one function (el, text, phase 'in'|'out', k 0..1); only 1 is drawn yet.
(() => {
  const GLYPHS = 'abcdefghijklmnopqrstuvwxyz0123456789#%&*+=/<>_';
  const rnd = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];
  // A 1-2 px knockout halo in the page colour: legible over headings, the page and cards, with no box behind it.
  const SHADOW = ['1px 0', '-1px 0', '0 1px', '0 -1px', '1px 1px', '-1px -1px', '1px -1px', '-1px 1px'].map(o => o + ' 1px var(--paper)').join(', ') + ', 0 0 3px var(--paper), 0 0 6px var(--paper)';
  // 1: scramble-settle. Each character cycles random glyphs and settles left to right; an RGB split and a 1 px jitter on entry.
  function scramble(el, text, phase, k) {
    const n = text.length, out = phase === 'out';
    let s = '';
    for (let i = 0; i < n; i++) {
      const c = text[i], at = out ? (n - 1 - i) / n : i / n;   // in: settles left to right; out: unsettles right to left, then is gone
      if (c === ' ') { s += ' '; continue; }
      if (!out) s += k >= 0.15 + 0.85 * at ? c : rnd();
      else s += k < 0.7 * at ? c : k < 0.7 * at + 0.3 ? rnd() : ' ';
    }
    el.textContent = s.trimEnd();   // gone characters take no room, so the text keeps hugging his head on either side
    const e = out ? 0 : Math.max(0, 1 - k / 0.4);   // split and jitter fade out over the first 40 % of the entry
    el.style.textShadow = e ? `${-1.5 * e}px 0 rgba(255,0,80,${0.7 * e}), ${1.5 * e}px 0 rgba(0,200,255,${0.7 * e}), ${SHADOW}` : SHADOW;
    el.style.translate = e ? `${Math.round((Math.random() - 0.5) * 2 * e)}px 0` : '';
  }
  const STYLES = { 1: scramble };   // shortcut: 2-6 map to 1 until the owner picks; add STYLES[n] = fn to draw one
  const pick = +(new URLSearchParams(location.search).get('tag') || document.documentElement.dataset.tag || 1);
  const STYLE = STYLES[pick] || STYLES[1];
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const IN = 0.75, HOLD = 3, OUT = 0.55, MIN_TAG = 0.9;   // seconds

  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true'); el.id = 'hugo-readtag';
  Object.assign(el.style, { position: 'fixed', left: 0, top: 0, zIndex: 9999, pointerEvents: 'none', whiteSpace: 'pre', font: '400 11px/14px var(--mono)',
    letterSpacing: '.02em', textTransform: 'lowercase', color: 'var(--muted)', textShadow: SHADOW, opacity: 0, transition: 'opacity .2s', contain: 'layout style' });
  const mount = () => document.body.append(el);
  if (document.body) mount(); else addEventListener('DOMContentLoaded', mount);

  // state: null | { kind: 'tag', t0 } | { kind: 'sum', text, t0 }
  let cur = null, pend = null, raf = 0;
  const now = () => performance.now() / 1000;
  const valid = s => typeof s === 'string' && (s = s.trim().toLowerCase()) && s.length <= 40 && /^[\p{L}\p{N}-]+( [\p{L}\p{N}-]+){1,4}$/u.test(s) ? s : null;

  function place() {
    const h = window.__hugoHead && window.__hugoHead();
    if (!h || h.x < -20 || h.x > innerWidth + 20 || h.y < -20 || h.y > innerHeight + 20) { el.style.visibility = 'hidden'; return; }
    el.style.visibility = '';
    const w = el.offsetWidth, ht = 14, gap = h.r + 12, cy = h.y - h.r;   // the bone sits at the neck: his face is about r above it
    const right = innerWidth - h.x >= h.x;   // the side with more room
    let x = right ? h.x + gap : h.x - gap - w, y = cy - ht / 2;
    x = Math.max(8, Math.min(innerWidth - 8 - w, x));
    if (x < h.x + gap && x + w > h.x - gap) { x = Math.max(8, Math.min(innerWidth - 8 - w, h.x - w / 2)); y = cy - h.r - 6 - ht; }   // no room beside him: above, never over his face
    y = Math.max(8, Math.min(innerHeight - 8 - ht, y));
    el.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
  }
  function frame() {
    raf = 0; if (!cur) return;
    const t = now() - cur.t0;
    if (cur.kind === 'tag') {
      el.textContent = '(web fetch)'; el.style.opacity = 1;
      if (pend && t >= MIN_TAG) { const s = pend.summary; pend = null; if (s) cur = { kind: 'sum', text: s, t0: now() }; else { cur = null; el.style.opacity = 0; return; } }
    }
    if (cur.kind === 'sum') {
      if (still.matches) {   // reduced motion: a plain fade in, hold, fade out
        el.textContent = cur.text; el.style.textShadow = SHADOW; el.style.translate = '';
        el.style.opacity = t < IN + HOLD ? 1 : 0;
        if (t >= IN + HOLD + OUT) { cur = null; return; }
      } else if (t < IN) STYLE(el, cur.text, 'in', t / IN);
      else if (t < IN + HOLD) STYLE(el, cur.text, 'in', 1);
      else if (t < IN + HOLD + OUT) STYLE(el, cur.text, 'out', (t - IN - HOLD) / OUT);
      else { cur = null; el.style.opacity = 0; el.textContent = ''; return; }
    }
    place();
    raf = requestAnimationFrame(frame);
  }
  addEventListener('mortal:lookup', e => {
    const d = e.detail || {}; if (d.who !== 'hugo') return;
    if (d.phase === 'start') { cur = { kind: 'tag', t0: now() }; pend = null; el.style.transition = 'none'; el.style.opacity = 0; el.textContent = '(web fetch)'; place(); el.offsetWidth; el.style.transition = 'opacity .2s'; }
    else if (d.phase === 'end' && cur && cur.kind === 'tag') pend = { summary: valid(d.summary) };
    if (cur && !raf) raf = requestAnimationFrame(frame);
  });
})();
