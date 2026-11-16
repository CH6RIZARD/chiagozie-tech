// Hugo's rope (owner 2026-11-16): when he comes back down into view with no edge under his hands (hugo3d climbDown), he comes down a
// rope out of his backpack instead of climbing on air. The rope drops in from the top edge of the view (its anchor is above the frame),
// he lowers himself hand over hand onto the ledge, tugs it free, it falls into his hand and the coil goes back into the pack (stow()).
// Loaded by backpack.js; the pack owns the item state (holding 'rope'), this file owns the line and the chain.
// The line is an SVG path under his canvas, not a mesh: his renderer only draws a box of 2.6 body heights round him, and a rope cut
// off 0.8 of a body above his head would hang from nothing.
import * as THREE from 'three';

const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const LEAD = 0.6, TUG = 0.55, REEL = 0.75;   // s: the rope falls in before he follows it; the tug; the fall into his hand

export function makeCoil(mat) {   // the rope coiled: three loops, as it lies in the pack and in his hand
  const g = new THREE.Group(), m = mat(0x9a7b56);
  for (const y of [-0.16, 0, 0.16]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.085, 5, 12), m); r.rotation.x = Math.PI / 2 + y; r.position.y = y; g.add(r); }
  return g;
}

export function bootRope({ st, armMix, handGrip, pack, hand, moving, setHolding, size, persp, canvas }) {
  const K = size / 150, calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), path = svg.appendChild(document.createElementNS(NS, 'path'));
  svg.setAttribute('aria-hidden', 'true');
  Object.assign(svg.style, { position: 'absolute', left: 0, top: 0, width: '1px', height: '1px', overflow: 'visible', pointerEvents: 'none', zIndex: 9997, display: 'none' });   // under his canvas: his hands and body cover it
  Object.assign(path.style, { fill: 'none', stroke: '#9a7b56', strokeWidth: Math.max(1.2, 1.8 * K) + 'px', strokeLinecap: 'round', strokeLinejoin: 'round' });
  canvas.parentNode.insertBefore(svg, canvas);
  const _v = new THREE.Vector3();
  const grip = side => { handGrip(side, _v); const f = persp / (persp - _v.z); return { x: _v.x * f + innerWidth / 2 + scrollX, y: innerHeight / 2 - _v.y * f + scrollY }; };   // his palm in page px (the camera's own projection)
  let R = null, tx = 0, dbg = null;
  const end = () => { R = null; dbg = null; svg.style.display = 'none'; };
  function finish() { const cb = R && R.cb; end(); if (cb) cb(); }
  function tick() {
    if (!R) return;
    requestAnimationFrame(tick);
    const now = performance.now() / 1000, k = now - R.t0, C = st.climb, top = scrollY - 12, drawn = canvas.style.visibility !== 'hidden';
    if (now - R.born > 40) { if (pack.holding === 'rope') pack.stow(); return finish(); }   // never a rope left hanging
    if ((R.ph === 'down' && !(C && C.rope)) || (R.ph !== 'down' && R.ph !== 'stow' && moving())) { R.ph = 'stow'; R.t0 = now; }   // the ledge went from under the climb, or he was picked up or sent off mid-tug: the coil still goes back into the pack
    if (R.ph === 'stow') {   // the coil is in his hand: into the pack, where it is seen
      svg.style.display = 'none';
      if (pack.holding !== 'rope' && !pack.busy) return finish();
      if (!drawn) { if (pack.holding === 'rope') pack.stow(); return finish(); }   // scrolled out of sight mid-stow: put away unseen, so he is free to come back (it waited here up to 40 s)
      if (drawn && !R.stowing) { R.stowing = true; pack.stow().then(() => { if (R && R.ph === 'stow') { if (pack.holding === 'rope') R.stowing = false; else finish(); } }); }
      return;
    }
    let d, hands = [];
    if (R.ph === 'down') {
      const e = Math.min(1, k / LEAD), endY = top + (C.f.y - 3 - top) * e * e, hs = drawn ? [grip('L'), grip('R')].sort((a, b) => a.y - b.y).filter(h => h.y > top + 4 && h.y < endY) : [];
      const lo = hs[hs.length - 1] || { x: C.x0, y: top }; tx += (lo.x - tx) * 0.08;   // the loose end lags his swing
      const ex = hs.length ? tx + (calm ? 0 : Math.sin(now * 3) * 1.5 * K) : C.x0 + (calm ? 0 : Math.sin(now * 9) * 3 * K * (1 - e));
      d = `M${C.x0} ${top}` + hs.map(h => `L${h.x} ${h.y}`).join('') + `Q${lo.x} ${(lo.y + endY) / 2} ${ex} ${endY}`; hands = hs;
    } else {
      const h = drawn ? grip(hand()) : { x: st.x, y: st.y - size * 0.6 }, fy = st.y - 3; hands = [h];
      if (R.ph === 'tug') {
        const w = calm ? 0 : Math.sin(k * 30) * 2.5 * K * sm((k - 0.3) / 0.1);   // the pull runs up the line
        d = `M${R.ax} ${top}Q${(R.ax + h.x) / 2 + w} ${(top + h.y) / 2} ${h.x} ${h.y}Q${h.x} ${fy} ${tx} ${fy}`;
        if (k >= TUG) { R.ph = 'reel'; R.t0 = now; }
      } else {   // free: the top end falls to his hand and the slack on the ground comes up into it
        const e = Math.min(1, k / REEL), g = e * e, ty = top + (h.y - top) * g, ax = R.ax + (h.x - R.ax) * g, w = calm ? 0 : Math.sin(k * 14) * 10 * K * (1 - e), s = sm(e);
        d = `M${ax} ${ty}Q${(ax + h.x) / 2 + w} ${(ty + h.y) / 2} ${h.x} ${h.y}Q${h.x} ${h.y + (fy - h.y) * (1 - s)} ${h.x + (tx - h.x) * (1 - s)} ${h.y + (fy - h.y) * (1 - s)}`;
        if (e >= 1) { R.ph = 'stow'; R.t0 = now; }
      }
    }
    path.setAttribute('d', d); svg.style.display = '';
    dbg = { ph: R.ph, d, hands, top, ax: R.ax };
  }
  const mixv = (a, b, w) => a.map((v, i) => v + (b[i] - v) * w);
  return {
    lead: LEAD,
    get out() { return !!R && R.ph !== 'stow'; },   // the rope is the line, not the coil
    get ph() { return R ? R.ph : null; }, get dbg() { return dbg; },
    // hugo3d climbDown: he is out of sight above the view, so the take is not seen; the rope falling in from the top edge is.
    start() {   // a book or the seed bag in hand goes back unseen, above the view, as the rope comes out (a coil still on its way into the pack comes out again)
      const now = performance.now() / 1000; setHolding('rope'); const had = !!R; R = { ph: 'down', t0: now, born: now, ax: st.x }; tx = st.x; if (!had) requestAnimationFrame(tick); return true; },
    landed(cb) { if (!R) return cb && cb(); R.ph = 'tug'; R.t0 = performance.now() / 1000; R.cb = cb; R.ax = st.x; },   // feet on the ledge: tug, reel, stow, then cb (his own life goes on)
    pose() {   // his arms, before the springs (called from the pack's pose hook)
      if (!R) return;
      if (R.ph === 'down') {   // hand over hand: one high on the rope, one at his chest, changing over with the height he has come down
        const a = 0.5 + 0.5 * Math.sin(st.y / (0.16 * size)), hi = [[0.0, 1, 0.3], [-0.08, 1, 0.2]], lo = [[0.02, 0.45, 0.75], [-0.1, 1, 0.25]];
        armMix('L', mixv(hi[0], lo[0], a), mixv(hi[1], lo[1], a), 1); armMix('R', mixv(hi[0], lo[0], 1 - a), mixv(hi[1], lo[1], 1 - a), 1);
      } else if (R.ph === 'tug' || R.ph === 'reel') {
        const k = performance.now() / 1000 - R.t0, y = R.ph === 'tug' ? sm((k - 0.22) / 0.12) - sm((k - 0.4) / 0.15) : 0, e = R.ph === 'reel' ? sm(k / REEL) : 0;   // y: the yank down
        armMix(hand(), mixv(mixv([0.15, 0.75, 0.55], [0.15, 0.25, 0.7], y), [0.15, -0.8, 0.4], e), mixv(mixv([0.0, 1, 0.3], [0.0, 0.7, 0.6], y), [0.1, 0.1, 1], e), 1);   // ends in the pack's own hold pose, where the coil appears
      }
    },
  };
}
