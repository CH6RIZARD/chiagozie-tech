// Self-test for depth.js (node depth.test.js). Asserts only; exits non-zero on the first failure.
const assert = require('assert');
const D = require('./depth.js');

// 1. w: the section's scroll phase, 0 as its top enters at the bottom of the screen, 1 as its bottom leaves at the top
const sec = { top: 1000, h: 800 }, vh = 600;
assert.strictEqual(D.phase(sec, 400, vh), 0, 'top just entering: w 0');
assert.strictEqual(D.phase(sec, 1800, vh), 1, 'bottom just leaving: w 1');
assert(Math.abs(D.phase(sec, 1100, vh) - 0.5) < 1e-9, 'halfway through its pass: w 0.5');
assert.strictEqual(D.phase(sec, 0, vh), 0, 'clamped below 0');
assert.strictEqual(D.phase(sec, 5000, vh), 1, 'clamped above 1');
// w per section: the same scroll puts two sections at different phases
const secs = [{ top: 0, h: 900 }, { top: 900, h: 1200 }, { top: 2100, h: 600 }];
assert.strictEqual(D.sectionAt(secs, 950), secs[1], 'y 950 is in the second section');
assert.strictEqual(D.sectionAt(secs, 5000), null, 'below the page: no section');
const ws = secs.map(s => D.phase(s, 1000, vh));
assert(ws[0] > ws[1] && ws[1] > ws[2], 'at one scroll, a section higher up is further through its pass: ' + ws.map(w => w.toFixed(2)));

// 2. lanes: lane 0 always; the back lane through most of a pass, the front lane mid-pass only; phones drop the front lane
assert.deepStrictEqual(D.lanesFor(0.05), [0], 'entering: only the content lane');
assert.deepStrictEqual(D.lanesFor(0.2), [-1, 0], 'early: back lane opens');
assert.deepStrictEqual(D.lanesFor(0.5), [-1, 0, 1], 'mid-pass: all three');
assert.deepStrictEqual(D.lanesFor(0.5, { noFront: true }), [-1, 0], 'no front lane when asked (phones)');
assert.deepStrictEqual(D.lanesFor(0.95), [0], 'leaving: only the content lane');
assert(D.scaleOf(-1) < 1 && D.scaleOf(1) > 1 && D.scaleOf(0) === 1 && D.scaleOf(-0.5) > D.scaleOf(-1), 'scale by lane, eased between');

// 3. occlusion: cards hide the back lane only, and only where they overlap; text lines merge into one slab
D.publish({ cards: [{ l: 100, t: 100, r: 300, b: 200 }], text: [{ l: 400, t: 100, r: 600, b: 118 }, { l: 400, t: 122, r: 580, b: 140 }], floors: [], seams: [] });
assert.strictEqual(D.scene.text.length, 1, 'two lines of one paragraph merge');
assert.strictEqual(D.occluders({ l: 120, t: 120, r: 160, b: 260 }, -1).length, 1, 'behind: the card hides him');
assert.strictEqual(D.occluders({ l: 120, t: 120, r: 160, b: 260 }, 0).length, 0, 'on the content: nothing hides him');
assert.strictEqual(D.occluders({ l: 120, t: 120, r: 160, b: 260 }, 1).length, 0, 'in front: nothing hides him');
assert.strictEqual(D.occluders({ l: 700, t: 120, r: 760, b: 260 }, -1).length, 0, 'behind, but clear of everything');
assert.strictEqual(D.occluders({ l: 420, t: 120, r: 460, b: 260 }, -1).length, 0, 'behind words: text never hides him (cards only)');
// 3b. supports: boxes, rules of 2px+, h1/h2 and 28px+ type carry him; body text, captions and hairlines are ink only
assert(D.support({ card: true }) && D.support({ bt: 2 }) && D.support({ text: true, heading: true }) && D.support({ text: true, fontSize: 30 }), 'card, 2px rule, heading, big type: supports');
assert(!D.support({ bt: 1 }) && !D.support({ text: true, fontSize: 15 }) && !D.support({ text: true, heading: false, fontSize: 22 }), 'hairline, body text, small heading: not supports');

// 4. A*: a card's words wall off lane 0; the route goes behind them (depth link), across, and back out
const floors = [{ x1: 0, x2: 1000, y: 500 }], seams = [{ x1: 0, x2: 1000, y: 300 }];
const wall = { l: 450, r: 550, t: 300, b: 500 };   // words standing on the floor, too tall to climb or crawl
const clear = (x, y, z) => z !== 0 || !(x + 26 > wall.l && x - 26 < wall.r && y > wall.t && y - 150 < wall.b);
let rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
const g = D.buildGraph(floors, seams, { half: 26, reach: 330, clear, lanes: () => [-1, 0], rnd });
const start = g.nodes.find(n => n.z === 0 && n.x < 100), goal = n => n.z === 0 && n.f === floors[0] && n.x > 800;
const p = D.astar(g, start, goal, n => Math.abs(n.x - 900) * 0.5);
assert(p, 'a route exists past the wall');
assert(p.kinds.filter(k => k === 'depth').length >= 2, 'it steps behind and back out: ' + p.kinds.join(','));
assert(p.every((n, i) => i === 0 || p[i - 1].z === n.z || p.kinds[i - 1] === 'depth'), 'lanes change only on depth links');
assert(p.some(n => n.z === -1 && n.x > wall.l - 26 && n.x < wall.r + 26) || p.some((n, i) => i && n.z === -1 && p[i - 1].z === -1 && Math.min(n.x, p[i - 1].x) < wall.l && Math.max(n.x, p[i - 1].x) > wall.r), 'the crossing happens in the back lane');
// 4b. a card on the floor with room on both sides: one authored transit edge between the lane-0 nodes just before and just past it,
// carrying the back-lane route behind it, and the router takes it over any way around
const cardG = D.buildGraph(floors, seams, { half: 26, reach: 330, clear, lanes: () => [-1, 0], rnd, cards: [wall] });
assert(cardG.transits.length >= 1, 'a transit exists for a card with room on both sides');
const tr = cardG.transits[0], te = cardG.edges.get(tr.a.id).find(e => e.kind === 'transit' && e.to === tr.b.id);
assert(tr.a.z === 0 && tr.b.z === 0 && tr.a.x < wall.l && tr.b.x > wall.r && te && te.via.every(n => n.z === -1), 'lane-0 ends either side of the card, the way between them behind it');
const tp = D.astar(cardG, cardG.nodes.find(n => n.z === 0 && n.x < 100), n => n.z === 0 && n.f === floors[0] && n.x > 800, n => Math.abs(n.x - 900) * 0.5);
assert(tp.kinds.includes('transit') && tp.cost < p.cost, 'the route goes through the card, cheaper than around: ' + tp.kinds.join(','));
// with no back lane in this phase (w out of range), there is no way past
const g0 = D.buildGraph(floors, seams, { half: 26, clear, lanes: () => [0], rnd });
assert.strictEqual(D.astar(g0, g0.nodes.find(n => n.x < 100), n => n.x > 800), null, 'no back lane: no route through the wall');
// costs: walking a seam is dearer than walking a support of the same length
const gs = D.buildGraph([{ x1: 0, x2: 400, y: 500 }], [{ x1: 0, x2: 400, y: 300 }], { half: 26, lanes: () => [-1, 0], jitter: 0 });
const walkC = seam => { const a = gs.nodes.filter(n => n.seam === seam && n.z === -1).sort((x, y) => x.x - y.x); return gs.edges.get(a[0].id).find(e => e.to === a[1].id).c / (a[1].x - a[0].x); };
assert(walkC(true) > walkC(false), 'a hairline walk costs more per px than a shelf');
// jitter: different seeds can give different costs, so routes vary
const c1 = D.buildGraph(floors, seams, { half: 26, clear, lanes: () => [-1, 0], rnd: () => 0.1 }), c2 = D.buildGraph(floors, seams, { half: 26, clear, lanes: () => [-1, 0], rnd: () => 0.9 });
assert(c1.edges.get(0)[0].c !== c2.edges.get(0)[0].c, 'cost jitter per plan');
console.log('depth.js self-test: all assertions passed');
