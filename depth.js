// The agents' hidden depth (Fez-style): the page stays flat and untouched; Hugo and the dove carry a lane z the page never sees.
// Three lanes, LittleBigPlanet-style: -1 behind the content, 0 on it, +1 in front. Collision stays flat 2D; z only decides
// the agents' own draw order, occlusion, scale, shadow and scroll parallax. w is the scroll phase of the section an agent
// is in, and it decides which lanes exist there right now (depth shows up while you scroll through a part of the page).
// READ-ONLY on the page: this file may read the DOM, never write a style or attribute to a page element.
// Loaded as a classic script before the agents (window.DEPTH); node requires it for its self-test (depth.test.js).
(G => {
  const DOM = typeof document !== 'undefined';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Nearest ancestor that clips its content (overflow other than visible): a phone carousel, a scroll box. memo: Map per scan.
  function clipOf(node, memo) {
    const path = []; let p = node.parentElement, c = null;
    for (; p && p.tagName !== 'BODY' && p.tagName !== 'HTML'; p = p.parentElement) {
      if (memo.has(p)) { c = memo.get(p); break; }
      path.push(p);
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { c = p; break; }
    }
    for (const q of path) memo.set(q, c);
    return c;
  }

  // ---------------------------------------------------------------- lanes, scale, w
  const SCALE = { '-1': 0.85, 0: 1, 1: 1.15 };   // starting values from the report; no shipped game publishes its own
  const scaleOf = z => z < 0 ? 1 + (SCALE[-1] - 1) * -z : 1 + (SCALE[1] - 1) * z;   // z eases between lanes during a hop
  const W_RANGE = { '-1': [0.15, 0.85], 1: [0.3, 0.7] };   // a section's back lane exists through most of its pass, the front lane mid-pass only
  // w: how far the visitor has scrolled through this section, 0 (its top just entering at the bottom) .. 1 (its bottom leaving at the top)
  const phase = (sec, scrollY, vh) => clamp((scrollY + vh - sec.top) / (sec.h + vh), 0, 1);
  const lanesFor = (w, opts = {}) => [-1, 0, 1].filter(z => z === 0 || (!(z > 0 && opts.noFront) && w >= W_RANGE[z][0] && w <= W_RANGE[z][1]));
  const sectionAt = (secs, y) => { let s = null; for (const q of secs) if (y >= q.top && y < q.top + q.h) s = q; return s; };

  // ---------------------------------------------------------------- occlusion
  // Lines of text in one block merge into one slab (gaps under ~10px), so a figure behind a paragraph is hidden by the
  // paragraph, not sliced into strips between its lines.
  function merge(rects, gap = 10) {
    const out = [];
    for (const q of [...rects].sort((a, b) => a.t - b.t || a.l - b.l)) {
      const m = out.find(o => q.t <= o.b + gap && q.b >= o.t - gap && q.l < o.r + gap && q.r > o.l - gap);
      if (m) { m.l = Math.min(m.l, q.l); m.t = Math.min(m.t, q.t); m.r = Math.max(m.r, q.r); m.b = Math.max(m.b, q.b); }
      else out.push({ l: q.l, t: q.t, r: q.r, b: q.b });
    }
    return out;
  }
  // The rects in front of an agent at lane z whose box (page coords) they overlap. Cards and text are on the content plane
  // (z 0): they hide lane -1 only. Nothing hides lane +1 but the sticky nav, which already sits above the agents' layer.
  const overlaps = (q, box) => q.r > box.l && q.l < box.r && q.b > box.t && q.t < box.b;
  function occluders(box, z, scene = D.scene) {
    if (z >= -0.5 || !scene) return [];
    const out = [];
    for (const q of scene.cards) if (overlaps(q, box)) out.push(q);
    for (const q of scene.text) if (overlaps(q, box)) out.push(q);
    return out;
  }
  // even-odd clip-path for an agent canvas at page (ox, oy), size BOX: the canvas minus the rects in front of it
  const clipPath = (rects, ox, oy, W, H = W) => rects.length ? `path(evenodd, "M0 0H${W}V${H}H0Z${rects.map(q => `M${Math.round(q.l - ox)} ${Math.round(q.t - oy)}H${Math.round(q.r - ox)}V${Math.round(q.b - oy)}H${Math.round(q.l - ox)}Z`).join('')}")` : '';

  // ---------------------------------------------------------------- the graph (walk, fall, jump, depth links) and A*
  // Nodes sit at platform ends and along wide platforms, per lane. Lane 0 walks only on supports and collides with ink;
  // lane -1 walks supports and seams (the hairlines: where a back-lane floor meets the content plane) and ignores ink, because
  // there he is behind the words. Depth links step between lanes where both exist. The graph is never more permissive than his
  // body: every walk edge is sampled with the same clear() test the body uses.
  // opts: { half, reach, clear(x, y, z) -> bool, lanes(y) -> [z...], cost jitter rnd() in 0..1, jitter }
  function buildGraph(floors, seams, o) {
    const half = o.half || 26, reach = o.reach || 330, rnd = o.rnd || Math.random, J = o.jitter ?? 0.15;
    const nodes = [], byKey = new Map(), edges = new Map();
    const jit = () => 1 + J * (rnd() - 0.5) * 2;
    const node = (f, x, z) => { x = Math.round(clamp(x, f.x1 + half, f.x2 - half)); const k = `${z}:${floors.includes(f) ? 'f' + floors.indexOf(f) : 's' + seams.indexOf(f)}:${x}`;
      let n = byKey.get(k); if (!n) { n = { id: nodes.length, f, x, y: f.y, z, seam: !floors.includes(f) }; nodes.push(n); byKey.set(k, n); edges.set(n.id, []); } return n; };
    const link = (a, b, c, kind) => { if (a !== b) edges.get(a.id).push({ to: b.id, c: c * jit(), kind }); };
    const lanesAt = y => (o.lanes ? o.lanes(y) : [0]);
    const plat = [...floors.map(f => [f, false]), ...seams.map(f => [f, true])].filter(([f]) => f.x2 - f.x1 >= 2 * half + 4);
    for (const [f, seam] of plat) for (const z of lanesAt(f.y)) {
      if (z === 1 || (seam && z === 0)) continue;   // seams are back-lane floors only; Hugo's front lane is a depth state, not a route (it would cover words)
      const n = Math.max(1, Math.ceil((f.x2 - f.x1) / 160));
      for (let i = 0; i <= n; i++) node(f, f.x1 + half + (f.x2 - f.x1 - 2 * half) * i / n, z);
    }
    // fall and jump links from each end and each sample point, in the same lane
    for (const a of [...nodes]) {
      for (const [f] of plat) {
        if (f === a.f || a.x < f.x1 + half || a.x > f.x2 - half) continue;
        const seam = seams.includes(f); if (seam && a.z === 0) continue;
        if (!lanesAt(f.y).includes(a.z)) continue;
        const dy = f.y - a.y;
        if (dy > 4 && dy < 1.5 * (o.vh || 900)) link(a, node(f, a.x, a.z), 20 + dy * 0.3, 'fall');
        else if (dy < -4 && -dy <= reach) link(a, node(f, a.x, a.z), 40 + -dy * 1.5, 'jump');
      }
      // stepping off an end: the first platform below just past the edge
      for (const dir of [-1, 1]) {
        if (Math.abs(a.x - (dir < 0 ? a.f.x1 + half : a.f.x2 - half)) > 1) continue;
        const x = dir < 0 ? a.f.x1 - 6 : a.f.x2 + 6; let best = null;
        for (const [f] of plat) if (f !== a.f && f.y > a.y + 2 && x - half >= f.x1 && x + half <= f.x2 && !(seams.includes(f) && a.z === 0) && (!best || f.y < best.y)) best = f;
        if (best && lanesAt(best.y).includes(a.z)) link(a, node(best, x, a.z), 25 + (best.y - a.y) * 0.3, 'fall');
      }
    }
    // walk links between neighbours on one platform, sampled against his body; along a hairline they cost more
    const groups = new Map();
    for (const n of nodes) { const k = n.z + '|' + (n.seam ? 's' : 'f') + (n.seam ? seams : floors).indexOf(n.f); (groups.get(k) || groups.set(k, []).get(k)).push(n); }
    for (const g of groups.values()) {
      g.sort((a, b) => a.x - b.x);
      for (let i = 1; i < g.length; i++) {
        const a = g[i - 1], b = g[i]; let ok = true;
        if (o.clear) for (let x = a.x; x <= b.x && ok; x += 20) ok = o.clear(x, a.y, a.z);
        if (ok) { const c = (b.x - a.x) * (a.seam ? 2.5 : 1); link(a, b, c, 'walk'); link(b, a, c, 'walk'); }
      }
    }
    // depth links: lane 0 <-> -1 at the same spot. Cheap where the way ahead is blocked by a card or words (going behind it is
    // the point), dearer in open space; never on a seam (there is no lane-0 floor there).
    for (const a of nodes) if (a.z === 0) {
      const b = byKey.get(`-1:f${floors.indexOf(a.f)}:${a.x}`); if (!b) continue;
      const blocked = o.clear && (!o.clear(a.x + 2 * half, a.y, 0) || !o.clear(a.x - 2 * half, a.y, 0));
      const c = blocked ? 12 : 45; link(a, b, c, 'depth'); link(b, a, c, 'depth');
    }
    return { nodes, edges, node, byKey };
  }
  // A* over the graph: from a node to the first node goal(n) accepts. h = straight distance scaled under the cheapest edge rate.
  function astar(g, from, goal, h = () => 0) {
    const open = [from.id], cost = new Map([[from.id, 0]]), prev = new Map(), est = new Map([[from.id, h(from)]]), done = new Set();
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (est.get(open[i]) < est.get(open[bi])) bi = i;
      const id = open.splice(bi, 1)[0]; if (done.has(id)) continue; done.add(id);
      const n = g.nodes[id];
      if (goal(n)) { const path = [n]; for (let p = id; prev.has(p);) { p = prev.get(p).id; path.unshift(g.nodes[p]); }
        path.cost = cost.get(id); path.kinds = path.slice(1).map((m, i) => g.edges.get(path[i].id).find(e => e.to === m.id).kind); return path; }
      for (const e of g.edges.get(id)) {
        const c = cost.get(id) + e.c; if (c >= (cost.get(e.to) ?? Infinity)) continue;
        cost.set(e.to, c); prev.set(e.to, n); est.set(e.to, c + h(g.nodes[e.to])); open.push(e.to);
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- the shared scene (page coords), measured, never per frame
  const D = { clipOf, SCALE, scaleOf, W_RANGE, phase, lanesFor, sectionAt, merge, occluders, clipPath, buildGraph, astar,
    sections: [], scene: { cards: [], text: [], floors: [], seams: [], at: 0 },
    // Hugo's scan publishes what it measured; the dove reads the same cards and text instead of measuring its own each frame
    publish(s) { D.scene = { cards: s.cards, text: merge(s.text), floors: s.floors, seams: s.seams, at: Date.now() }; },
    // where an agent at page y stands in depth right now: its section, the section's phase w, and the lanes that exist
    at(y, opts) { const sec = sectionAt(D.sections, y); if (!sec || !DOM) return { sec: null, w: 0.5, lanes: [0] };
      const w = phase(sec, scrollY, innerHeight); return { sec, w, lanes: lanesFor(w, opts) }; },
    // a lane change is an event (a hop, never a silent swap): anyone on the page can hear it
    hop(who, from, to, x, y) { if (DOM) dispatchEvent(new CustomEvent('agent:lane', { detail: { who, from, to, x, y } })); G.REL?.ev?.(who, 'lane', null, 0, { from, to }); },
  };
  if (DOM) {
    // sections in page coords, re-measured only when something changes size (and not on an iPhone address-bar wobble)
    let lastW = 0, lastH = 0;
    const measure = () => {
      D.sections = [...document.querySelectorAll('section[id],header[id],footer[id]')].filter(e => !e.parentElement.closest('section[id],header[id],footer[id]'))
        .map(e => { const r = e.getBoundingClientRect(); return { el: e, id: e.id, top: r.top + scrollY, h: r.height }; }).filter(s => s.h > 0);
      lastW = innerWidth; lastH = innerHeight;
    };
    const touch = matchMedia('(pointer:coarse)').matches;
    const onResize = () => { if (touch && innerWidth === lastW && Math.abs(innerHeight - lastH) < 120) return; measure(); };
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', measure); else measure();
    addEventListener('load', measure); addEventListener('resize', onResize);
    if (G.ResizeObserver) new ResizeObserver(() => measure()).observe(document.body);   // a section grew or shrank: everything below moved
    D.measure = measure;
  }
  G.DEPTH = D;
  if (typeof module !== 'undefined') module.exports = D;
})(typeof window !== 'undefined' ? window : globalThis);
