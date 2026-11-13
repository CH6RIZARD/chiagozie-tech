// Hugo, small, living on the page. The page is his physics: every horizontal rule and every box top is a floor he can
// stand on, every line of text and every box is solid, and he never covers a word. He walks the rules, stops at text,
// turns around, sits when boxed in, and now and then drifts to another floor near you.
// Camera matches CSS pixels (1 unit = 1 px on the page plane), the same convention as the dove.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const CFG = Object.assign({ size: 150, perspective: 900, glb: 'realms/hugo/hugo.glb', viewTilt: 6, speed: 34, stride: 46 }, window.HUGO_CONFIG || {});
const reduced = /[?&]still/.test(location.search);   // walking is gentle motion; a reduce-motion setting no longer freezes him

const canvas = document.createElement('canvas');
canvas.setAttribute('aria-hidden', 'true');
// A small canvas that lives IN the page (position absolute, page coordinates) and travels with him. The browser scrolls
// it with the content, so he never lags or jumps a frame behind the page the way a full-screen fixed overlay did.
const BOX = Math.round(CFG.size * 2.6);
Object.assign(canvas.style, { position: 'absolute', left: 0, top: 0, width: BOX + 'px', height: BOX + 'px', pointerEvents: 'none', zIndex: 9998, willChange: 'transform', transition: 'opacity .2s' });
// Both agents draw inside one page-sized layer that clips them, so a canvas near the bottom never makes the page taller
// (it did: the page grew, the floor at the bottom moved down, and he kept falling).
const layer = document.getElementById('agent-layer') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'agent-layer' }));
Object.assign(layer.style, { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, overflow: 'clip', pointerEvents: 'none', zIndex: 9998 });
layer.append(canvas);
// Phones (Scroll and Read less): same life and physics as desktop, minus the two cheats that left him over the content (landing in
// front of words, the invisible floor at the screen bottom); he fades out whenever a jump or fall carries him across text.
const phoneQ = matchMedia('(max-width:760px)');
const phone = () => phoneQ.matches;
const groundY = () => document.documentElement.scrollHeight - 24;
// phones: a ledge in a side-scrolling row ends at the screen edge, so he never walks off into the part you cannot see
const fit = f => { f.x1 = Math.max(f.x1, 0); f.x2 = Math.min(f.x2, document.documentElement.clientWidth); };
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' }); }
catch { canvas.remove(); throw new Error('Hugo needs WebGL; the page works without him.'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
{ const pm = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(); scene.environment = pm.fromScene(room, 0.04).texture; pm.dispose(); room.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }   // the bake is done: free its scratch
const camera = new THREE.PerspectiveCamera(30, 1, 10, 6000);
function resize() {
  renderer.setSize(BOX, BOX, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = 2 * Math.atan(innerHeight / 2 / CFG.perspective) * 180 / Math.PI;
  camera.position.set(0, 0, CFG.perspective); camera.updateProjectionMatrix();
}
let pageW = document.documentElement.clientWidth;   // cached: a per-frame read after style writes forces a layout
resize(); addEventListener('resize', () => { resize(); dirty = true; pageW = document.documentElement.clientWidth; });
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-400, 600, 700);
const rim = new THREE.DirectionalLight(0x3550ff, 2.4); rim.position.set(300, 250, -700);
scene.add(key, rim, new THREE.HemisphereLight(0xffffff, 0xf1ede4, 1.2));

// ---------- body ----------
const gltf = await new GLTFLoader().loadAsync(CFG.glb);
const model = gltf.scene;
const skin = new THREE.MeshPhysicalMaterial({ color: 0xe8e6df, roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0xdfe5ff), envMapIntensity: 0.5 });
model.traverse(o => { if (o.isMesh) { o.material = skin; o.frustumCulled = false; } });
// The skin deforms on the Rigify DEF chain, which sits beside the ORG bones in this export, so pose DEF directly.
const bone = re => { let b = null; model.traverse(o => { if (!b && o.isBone && re.test(o.name)) b = o; }); return b; };
const B = {
  thighL: bone(/^DEF-thigh.?L_/), thighR: bone(/^DEF-thigh.?R_/), shinL: bone(/^DEF-shin.?L_/), shinR: bone(/^DEF-shin.?R_/),
  armL: bone(/^DEF-upper_arm.?L_/), armR: bone(/^DEF-upper_arm.?R_/), foreL: bone(/^DEF-forearm.?L_/), foreR: bone(/^DEF-forearm.?R_/),
  head: bone(/^DEF-spine.?00[456]_/), chest: bone(/^DEF-spine.?002_/), handL: bone(/^DEF-hand.?L_/), handR: bone(/^DEF-hand.?R_/),
};
const rest = new Map(); for (const b of Object.values(B)) if (b) rest.set(b, b.quaternion.clone());
// Poses write targets; applyPose eases every joint toward them, so he flows between walking, sitting and gestures.
const tgt = new Map(), cur = new Map(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const rot = (b, x, y = 0, z = 0) => { if (b) tgt.set(b, [x, y, z]); };
const mix = (b, x, y, z, w) => { if (!b || w <= 0) return; const T = tgt.get(b) || [0, 0, 0]; tgt.set(b, [T[0] + (x - T[0]) * w, T[1] + (y - T[1]) * w, T[2] + (z - T[2]) * w]); };
function applyPose(dt, k) {
  const a = Math.min(1, dt * k);
  for (const [b, T] of tgt) {
    let C = cur.get(b); if (!C) cur.set(b, C = T.slice());
    for (let i = 0; i < 3; i++) C[i] += (T[i] - C[i]) * a;
    b.quaternion.copy(rest.get(b)).multiply(_q.setFromEuler(_e.set(C[0], C[1], C[2])));
  }
}
// Arms are posed by DIRECTION in his body frame (out, up, forward), not by Euler angles: this rig's arm axes are not
// what they seem, and directions read the same whatever the rig. Each arm: upper-arm and forearm directions, eased.
const ARM = { L: { u: [0.12, -1, 0.05], f: [0.05, -1, 0.15] }, R: { u: [0.12, -1, 0.05], f: [0.05, -1, 0.15] } };
const armCur = { L: null, R: null };
const arm = (side, u, f) => { ARM[side] = { u, f }; };
const armMix = (side, u, f, w) => { if (w <= 0) return; const A = ARM[side], m = (a, b) => a.map((v, i) => v + (b[i] - v) * w); ARM[side] = { u: m(A.u, u), f: m(A.f, f) }; };
let BODY = null;   // his left / up / forward in model space, measured from the rest pose
const _d = new THREE.Vector3(), _ax = new THREE.Vector3(), _pq = new THREE.Quaternion(), _mq = new THREE.Quaternion(), _r = new THREE.Quaternion();
function aimBone(b, dirModel) {   // turn bone b so its +Y points along dirModel (model space)
  b.parent.updateWorldMatrix(true, false);
  model.getWorldQuaternion(_mq); b.parent.getWorldQuaternion(_pq);
  _d.copy(dirModel).applyQuaternion(_mq).applyQuaternion(_pq.invert()).normalize();   // into the parent's space
  const r = rest.get(b); _ax.set(0, 1, 0).applyQuaternion(r);
  b.quaternion.copy(_r.setFromUnitVectors(_ax, _d)).multiply(r);
}
function applyArms(dt, k) {
  if (!BODY) return;
  const a = Math.min(1, dt * k);
  for (const side of ['L', 'R']) {
    const T = ARM[side], sx = side === 'L' ? 1 : -1;
    let C = armCur[side]; if (!C) C = armCur[side] = { u: T.u.slice(), f: T.f.slice() };
    for (const key of ['u', 'f']) for (let i = 0; i < 3; i++) C[key][i] += (T[key][i] - C[key][i]) * a;
    const toModel = v => new THREE.Vector3().addScaledVector(BODY.left, v[0] * sx).addScaledVector(BODY.up, v[1]).addScaledVector(BODY.fwd, v[2]).normalize();
    const up = side === 'L' ? B.armL : B.armR, fo = side === 'L' ? B.foreL : B.foreR;
    if (up) { aimBone(up, toModel(C.u)); up.updateMatrixWorld(true); }
    if (fo) aimBone(fo, toModel(C.f));
  }
}
// How he carries himself on this walk: re-rolled every time he sets off, so no two walks look the same.
const sty = { arm: 0.35, hip: 0.38, cadence: 0.9, pockets: false, lean: 0 };
function restyle() { sty.arm = 0.18 + Math.random() * 0.3; sty.hip = 0.3 + Math.random() * 0.16; sty.cadence = 0.78 + Math.random() * 0.3; sty.pockets = Math.random() < 0.18; sty.lean = (Math.random() - 0.4) * 0.12; }
// Gait geometry: one full cycle (two steps) covers 2 x step length, step length = 2 * leg * sin(hip swing). Moving the
// body by exactly that per cycle keeps the planted foot from sliding: what read as shuffling was the legs cycling ~3x
// faster than the body moved.
const LEG = CFG.size * 0.47;
const cycleLen = () => 4 * LEG * Math.sin(sty.hip);
const walkSpeed = () => cycleLen() * sty.cadence;   // px/s
const frac = x => x - Math.floor(x);
const bump = (p, c, w) => { const d = frac(p - c + 0.5) - 0.5; return Math.exp(-(d * d) / (2 * w * w)); };
function poseStand(ph, amt) {          // ph: walk phase 0..1, amt: 0 still .. 1 full stride
  // Per leg, phase 0 = heel strike: hip flexed forward, then extends back through stance, swings forward from ~0.6.
  // Knee: a small give as the foot takes weight (~0.12), a big bend to clear the ground mid-swing (~0.72).
  const leg = p => [-sty.hip * Math.cos(2 * Math.PI * p) * amt, (0.06 + 0.2 * bump(p, 0.12, 0.07) + 1.05 * bump(p, 0.72, 0.1)) * amt + 0.04];
  const [hL, kL] = leg(ph), [hR, kR] = leg(ph + 0.5);
  rot(B.thighL, hL); rot(B.shinL, kL); rot(B.thighR, hR); rot(B.shinR, kR);
  const s = -Math.cos(2 * Math.PI * ph) * amt;   // >0 while the left leg is back: the left arm swings forward
  const sw = sty.pockets ? 0.05 : sty.arm, tt = performance.now() / 1000, out = sty.pockets ? 0.05 : 0.13;
  // arms swing opposite the legs; a slow drift keeps them from ever looking pinned
  arm('L', [out + Math.sin(tt * 0.7) * 0.03, -1, s * sw + Math.sin(tt * 0.9) * 0.04], sty.pockets ? [-0.1, -0.7, 0.45] : [0.04, -1, 0.18 + s * sw * 1.2]);
  arm('R', [out + Math.sin(tt * 0.6 + 2) * 0.03, -1, -s * sw + Math.sin(tt * 0.8 + 1) * 0.04], sty.pockets ? [-0.1, -0.7, 0.45] : [0.04, -1, 0.18 - s * sw * 1.2]);
}
function poseHop(vy) {   // rising: knees tucked; falling: legs reach for the floor
  const up = vy < 0 ? 1 : Math.max(0, 1 - vy / 500);
  rot(B.thighL, -0.7 * up - 0.1); rot(B.thighR, -0.5 * up - 0.1); rot(B.shinL, 1.1 * up + 0.1); rot(B.shinR, 0.9 * up + 0.1);
  arm('L', [0.8, 0.05, 0.15], [0.7, 0.45, 0.25]); arm('R', [0.8, 0.05, 0.15], [0.7, 0.45, 0.25]);   // arms out for balance
}
function posePrep(u) {   // u 0..1 through the wind-up
  const c = Math.sin(Math.min(1, u) * Math.PI * 0.5);
  rot(B.thighL, -0.55 * c); rot(B.thighR, -0.5 * c); rot(B.shinL, 1.0 * c); rot(B.shinR, 0.95 * c); rot(B.chest, 0.3 * c);
  arm('L', [0.15, -0.8, -0.55 * c], [0.05, -0.9, -0.3 * c]); arm('R', [0.15, -0.8, -0.55 * c], [0.05, -0.9, -0.3 * c]);   // arms swing back, ready to throw them up
}
function poseClimb(C) {
  const u = C.u || 0;
  if (C.ph === 'reach') {   // arms thrown up at the ledge, legs trailing
    arm('L', [0.25, 1, 0.25], [0.15, 1, 0.2]); arm('R', [0.25, 1, 0.25], [0.15, 1, 0.2]);
    rot(B.thighL, 0.1); rot(B.thighR, -0.2); rot(B.shinL, 0.4); rot(B.shinR, 0.6); rot(B.chest, -0.05);
  } else if (C.ph === 'hang') {   // hanging by his hands, legs swinging a little
    arm('L', [0.22, 1, 0.3], [0.12, 1, 0.25]); arm('R', [0.22, 1, 0.3], [0.12, 1, 0.25]);
    const sw = Math.sin(t * 4) * 0.15; rot(B.thighL, sw); rot(B.thighR, -sw); rot(B.shinL, 0.25); rot(B.shinR, 0.3);
  } else {   // pulling up: hands stay on the edge while the body rises past them, one knee comes up and over
    const a = Math.min(1, u * 1.3), ua = [0.22, 1 - 1.9 * a, 0.3 + 0.35 * a], fa = [0.12, 1 - 2 * a, 0.25 + 0.5 * a];
    arm('L', ua, fa); arm('R', ua, fa);
    const knee = Math.sin(Math.min(1, u * 1.2) * Math.PI);
    rot(B.thighL, -1.3 * knee); rot(B.shinL, 1.6 * knee); rot(B.thighR, -0.3 * knee); rot(B.shinR, 0.5 * knee); rot(B.chest, 0.35 * Math.sin(u * Math.PI));
  }
}
// Between standing and sitting: knees bend a little ahead of the hips, the chest comes forward over the feet and the
// arms reach out for balance through the middle of the move, then settle on the knees (and the reverse to stand up).
let poseLean = 0;
function poseSitting(e) {   // e: 0 standing .. 1 seated (already eased)
  const hip = (-Math.PI / 2 + 0.05) * e, knee = (Math.PI / 2 - 0.15) * Math.min(1, e * 1.3), mid = Math.sin(Math.PI * e);
  rot(B.thighL, hip, 0.08 * e); rot(B.thighR, hip, -0.08 * e); rot(B.shinL, knee); rot(B.shinR, knee * 0.95);
  poseLean = 0.45 * mid;
  const L = (a, b) => a.map((v, i) => v + (b[i] - v) * e);
  const u = L([0.12, -1, 0.05], [0.18, -0.75, 0.55]), f = L([0.05, -1, 0.15], [0.02, -0.45, 0.9]);
  u[1] += 0.3 * mid; u[2] += 0.35 * mid; f[1] += 0.3 * mid; f[2] += 0.3 * mid;
  arm('L', u, f); arm('R', u, f);
}
function poseSit(swing) {
  rot(B.thighL, -Math.PI / 2 + 0.05, 0.08); rot(B.thighR, -Math.PI / 2 + 0.05, -0.08);
  rot(B.shinL, Math.PI / 2 - 0.2 + swing * 0.35); rot(B.shinR, Math.PI / 2 - 0.1 - swing * 0.25);
  arm('L', [0.18, -0.75, 0.55], [0.02, -0.45, 0.9]); arm('R', [0.18, -0.75, 0.55], [0.02, -0.45, 0.9]);   // hands resting on his knees
}
// Hands and knees (e: 0 standing .. 1 down). With his back pitched forward by PITCH, thighs flexed by PITCH and arms
// reaching body-forward by PITCH both point straight down at the floor; shins lie back along it. Diagonal pairs move
// together, the way people crawl: left hand with the right knee.
function poseCrawl(ph, e) {
  poseStand(0, 0);
  const s = Math.sin(2 * Math.PI * ph), c = Math.cos(2 * Math.PI * ph);
  mix(B.thighL, -PITCH + 0.28 * s, 0, 0, e); mix(B.thighR, -PITCH - 0.28 * s, 0, 0, e);
  mix(B.shinL, Math.PI / 2 - 0.1 + 0.3 * Math.max(0, c), 0, 0, e); mix(B.shinR, Math.PI / 2 - 0.1 + 0.3 * Math.max(0, -c), 0, 0, e);   // the knee coming forward lifts
  const down = d => [0.14, -Math.cos(PITCH + d), Math.sin(PITCH + d)];
  armMix('L', down(-0.28 * s), down(-0.28 * s), e); armMix('R', down(0.28 * s), down(0.28 * s), e);
}
model.updateMatrixWorld(true);
const standBox = new THREE.Box3().setFromObject(model, true);
const S = CFG.size / (standBox.max.y - standBox.min.y);
const feet = new THREE.Vector3((standBox.min.x + standBox.max.x) / 2, standBox.min.y, 0);
model.updateMatrixWorld(true);
{ const wl = B.armL.getWorldPosition(new THREE.Vector3()), wr = B.armR.getWorldPosition(new THREE.Vector3()), inv = model.getWorldQuaternion(new THREE.Quaternion()).invert();
  const left = wl.sub(wr).applyQuaternion(inv); left.y = 0; left.normalize(); const up = new THREE.Vector3(0, 1, 0);
  BODY = { left, up, fwd: new THREE.Vector3().crossVectors(left, up).normalize() }; }
poseSit(0); applyPose(1, 1e9); applyArms(1, 1e9); model.updateMatrixWorld(true);
const seatBox = new THREE.Box3().setFromObject(model, true);
const hipY = B.thighL ? B.thighL.getWorldPosition(new THREE.Vector3()).y : seatBox.min.y + (seatBox.max.y - seatBox.min.y) * 0.45;
const seat = new THREE.Vector3((seatBox.min.x + seatBox.max.x) / 2, hipY - (seatBox.max.y - seatBox.min.y) * 0.06, 0);
const SIT_H = (seatBox.max.y - seat.y) * S, HALF_W = 26;
// Crawling, measured off his own skeleton: on hands and knees his thighs and arms hang straight down, so his hips sit
// one thigh above the floor, his shoulders one arm above it, and his back pitches forward until it spans the two.
const _w1 = new THREE.Vector3(), _w2 = new THREE.Vector3();
const blen = (a, b, d) => a && b ? a.getWorldPosition(_w1).distanceTo(b.getWorldPosition(_w2)) * S : d;
const THIGH = blen(B.thighL, B.shinL, CFG.size * 0.24), ARMLEN = blen(B.armL, B.foreL, CFG.size * 0.17) + blen(B.foreL, B.handL, CFG.size * 0.17);
const SPINE = B.thighL && B.armL ? Math.abs(B.armL.getWorldPosition(_w1).y - B.thighL.getWorldPosition(_w2).y) * S : CFG.size * 0.3;
const PITCH = Math.acos(Math.max(0.2, Math.min(0.95, (ARMLEN - THIGH) / SPINE)));   // back's tilt from upright
const hip = new THREE.Vector3(feet.x, hipY, 0);
const CRAWL_H = Math.max(ARMLEN, THIGH + SPINE * Math.cos(PITCH)) + CFG.size * 0.16;   // shoulders plus his head

const view = new THREE.Group(), inner = new THREE.Group();
inner.add(model); inner.scale.setScalar(S); view.add(inner); scene.add(view);
view.rotation.x = CFG.viewTilt * Math.PI / 180;

// ---------- the world: floors and solids, in page coordinates ----------
let floors = [], ink = [], textInk = [], dirty = true, scanAt = 0;
const skipSel = '#scion-hud,#scion-say,#scion-ask,#scion-dove,#agent-layer,script,style,svg,canvas,nav:not(.mindex),.msheet';   // .msheet: the phone sheet is invisible until opened; .mindex: the phone project list is content, not chrome (hidden on desktop)
// phones: faded-out layers (a view mid-switch, a panel at opacity 0) are not there for him
const hidden = e => (e.checkVisibility ? !e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : false) || covered(e);
// ...and so is anything another layer sits on top of (checked at its top edge and centre; off screen it cannot be judged, so it counts)
const covered = e => { const r = e.getBoundingClientRect(), d = e.ownerDocument, cx = (r.left + r.right) / 2;
  const hits = [d.elementFromPoint(cx, r.top + Math.min(4, r.height / 2)), d.elementFromPoint(cx, (r.top + r.bottom) / 2)].filter(Boolean);
  return hits.length > 0 && !hits.some(h => e.contains(h)); };
// Distance from the top of a text box to the top of its capitals (the hero name only; 0 elsewhere).
let capEl = null, capPx = 0;
function capInset(el) {
  const h = el.closest('#mast h1'); if (!h) return 0;
  if (capEl !== h) { const cs = getComputedStyle(h), c = document.createElement('canvas').getContext('2d'); c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = c.measureText('ChiagozieOliver'); capPx = Math.max(0, (m.fontBoundingBoxAscent || 0) - (m.actualBoundingBoxAscent || 0)); capEl = h; }
  return capPx;
}
function scan() {
  floors = []; ink = []; textInk = [];
  const vh = innerHeight, near = r => r.bottom > -vh * 1.5 && r.top < vh * 2.5;
  // Phones in Read less: the page is one frame (OS.dc.html), so its cards, monitor and words are his world, not a solid wall.
  const os = phone() && document.body.classList.contains('simple') && document.querySelector('#os iframe');
  let od = null; try { od = os && os.contentDocument && os.contentDocument.body; } catch {}
  const pass = (root, fr) => {
    const fo = fr ? fr.getBoundingClientRect() : null, ox = scrollX + (fo ? fo.left : 0), oy = scrollY + (fo ? fo.top : 0), view = fr && fr.contentWindow;
    for (const e of root.querySelectorAll('*')) {
      if (e.closest(skipSel)) continue;
      const r = e.getBoundingClientRect(); if (!near(fo ? { top: r.top + fo.top, bottom: r.bottom + fo.top } : r) || r.width < 160 || (fr && (r.top >= view.innerHeight || r.bottom <= 0))) continue;   // in the frame: only what its window shows
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || (phone() && hidden(e))) continue;
      const boxed = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || e.tagName === 'IMG' || e.tagName === 'IFRAME';
      const wrapper = od && (fr ? r.width > view.innerWidth - 4 && r.height > view.innerHeight * 0.8 : e.contains(os));   // the frame and its page-sized wrappers: not walls, and their edge-to-edge tops are traps, not ledges
      if ((parseFloat(cs.borderTopWidth) > 0 || boxed) && !wrapper) floors.push({ y: r.top + oy, x1: r.left + ox, x2: r.right + ox, el: e, fr });
      if (parseFloat(cs.borderBottomWidth) > 0 && !wrapper) floors.push({ y: r.bottom + oy, x1: r.left + ox, x2: r.right + ox, el: e, fr });
      if (boxed && r.height > 30 && !wrapper) ink.push({ l: r.left + ox, t: r.top + oy, r: r.right + ox, b: (fr ? Math.min(r.bottom, view.innerHeight) : r.bottom) + oy });   // boxes are solid
    }
    const walk = (fr ? fr.contentDocument : document).createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n =>
      n.textContent.trim() && !n.parentElement.closest(skipSel) && !(phone() && hidden(n.parentElement)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    for (let n; (n = walk.nextNode());) {
      const range = n.ownerDocument.createRange(); range.selectNodeContents(n);
      const cap = phone() && !fr ? capInset(n.parentElement) : 0;   // phones, the hero name: its ledge is the tops of the letters, not the line box
      for (const r of range.getClientRects()) if (r.width > 0 && near(fo ? { top: r.top + fo.top, bottom: r.bottom + fo.top } : r)) {
        const q = { l: r.left + ox, t: r.top + oy + cap, r: r.right + ox, b: r.bottom + oy };
        ink.push(q); if (phone()) textInk.push(q);
        if (r.width > 120 || cap > 0) floors.push({ y: r.top + oy + cap, x1: r.left + ox, x2: r.right + ox, el: n.parentElement, text: true, fr, name: cap > 0 });
      }
    }
  };
  pass(document.body, null);
  const bar = phone() && document.querySelector('nav[aria-label="Sections"]');   // phones: the bar is locked over the page; nothing stands under it
  if (bar) { const r = bar.getBoundingClientRect(); ink.push({ l: r.left + scrollX, t: r.top + scrollY - 400, r: r.right + scrollX, b: r.bottom + scrollY }); }
  if (od) pass(od, os);
  if (!od) floors.push({ y: groundY(), x1: 0, x2: document.documentElement.scrollWidth, el: document.body, ground: true });   // phones, Read less: the page bottom is under the monitor and its caption, not a floor
  if (phone()) { floors.forEach(fit);   // phones: only ledges with standing room somewhere along them (no climbing into a gap and crawling there)
    floors = floors.filter(f => f.ground || f.x2 - f.x1 < 2 * HALF_W || [0, 1, 2, 3, 4, 5, 6, 7, 8].some(i => clear(f.x1 + HALF_W + (f.x2 - f.x1 - 2 * HALF_W) * i / 8, f.y, CFG.size + 4))); }
  dirty = false; scanAt = performance.now();
}
// Can he occupy this spot? Body box must be clear of every word and box above the floor (standing or sitting height).
const clear = (x, y, h) => !ink.some(q => q.r > x - HALF_W && q.l < x + HALF_W && q.b > y - h && q.t < y - 2);
// Where he has been: coarse cells with the last time he was there. New places are more interesting than ones he just
// left, so he spreads out instead of wearing a groove into one corner.
const seenAt = new Map(), avoid = new Map();
const cell = (x, y) => `${Math.round(x / 140)}:${Math.round(y / 90)}`;
const novelty = (x, y) => { const l = seenAt.get(cell(x, y)); return l === undefined ? 1 : 1 - Math.exp(-(t - l) / 75); };
function pickFloor(furniture) {   // furniture: dividers and box tops only, the places he goes on purpose
  const top = scrollY + 40, bot = scrollY + innerHeight - 40, c = [];
  for (const f of floors) {
    if (f.y < top || f.y > bot || f.x2 - f.x1 < 120 || (furniture && (f.text || f.ground))) continue;
    // sample a few x along the rule; keep the floors that have standing room
    const xs = []; for (let i = 0; i < 9; i++) { const x = f.x1 + HALF_W + 8 + (f.x2 - f.x1 - 2 * HALF_W - 16) * i / 8; if (clear(x, f.y, CFG.size + 4)) xs.push(x); }
    if (xs.length) c.push({ f, xs });
  }
  if (!c.length) return null;
  // weighted by novelty: somewhere he has not been for a while is far more likely than where he just was
  const opts = [];
  for (const k of c) { if ((avoid.get(k.f) || 0) > t) continue; for (const x of k.xs) opts.push({ f: k.f, x, w: (0.05 + novelty(x, k.f.y) ** 2 + (Math.abs(x - st.x) + Math.abs(k.f.y - st.y)) / 4000) * (k.f.y < st.y - CFG.size * 2.2 ? 0.25 : k.f.y < st.y - 8 ? 1.7 : 1) }); }
  if (!opts.length) return null;
  let r = Math.random() * opts.reduce((a, o) => a + o.w, 0);
  for (const o of opts) if ((r -= o.w) <= 0) return o;
  return opts[opts.length - 1];
}

// ---------- the agent ----------
// He is his own being: he walks the floors, steps off ledges and falls to the next floor, turns at text, sits when boxed in.
// He never teleports and never follows the visitor. Off screen he keeps living; we just do not draw him.
const G = 1400;   // px/s2, page gravity
const st = { floor: null, x: 0, y: 0, vx: 0, vy: 0, air: false, dir: 1, mode: 'walk', ph: 0, amt: 0, swing: 0, swingV: 0, idleUntil: 0, land: 0,
  held: false, hover: false, px: 0, py: 0, tilt: 0, spdK: 1, crouch: 0, headH: CFG.size, look: 0, gestName: null, vxw: 0, hand: null, hitsSeen: 0, relOrder: null };
// Limbs as damped pendulums: each has an angle and angular velocity and is driven by the body's acceleration.
const limbs = { thighL: [0, 0], thighR: [0, 0], shinL: [0, 0], shinR: [0, 0], armL: [0, 0], armR: [0, 0], foreL: [0, 0], foreR: [0, 0] };
let lastVx = 0, lastVy = 0;
function swingLimbs(dt, ax, ay, k) {   // ax, ay: body acceleration (px/s²); k: how much the limbs feel it
  for (const [name, L] of Object.entries(limbs)) {
    const hang = /thigh|shin/.test(name) ? 0 : 0.15;            // arms hang a little forward, legs straight down
    const drive = (-ax * 0.0009 + (name.endsWith('R') ? 1 : -1) * ay * 0.0002) * k;
    const acc = (hang + drive - L[0]) * 60 - L[1] * 7;           // spring 60, damping 7
    L[1] += acc * dt; L[0] += L[1] * dt; L[0] = Math.max(-1.6, Math.min(1.6, L[0]));
  }
}
function poseRag() {
  rot(B.thighL, limbs.thighL[0], 0, 0.06); rot(B.thighR, limbs.thighR[0], 0, -0.06);
  rot(B.shinL, Math.max(0, limbs.shinL[0]) + 0.1); rot(B.shinR, Math.max(0, limbs.shinR[0]) + 0.1);
  arm('L', [0.45, -0.85 + limbs.armL[0] * 0.5, limbs.armL[0]], [0.3, -0.8 + limbs.foreL[0] * 0.4, limbs.foreL[0] + 0.2]);
  arm('R', [0.45, -0.85 + limbs.armR[0] * 0.5, limbs.armR[0]], [0.3, -0.8 + limbs.foreR[0] * 0.4, limbs.foreR[0] + 0.2]);
}
let t = 0, last = performance.now(), look = 0, lookGoal = 0;
const _hv = new THREE.Vector3();

// ---------- body language ----------
// When he is not walking he does something: each gesture has its own timing, side and size, drawn fresh every time.
// ?pose=name forces one (for checking the poses).
const STAND = ['look', 'hips', 'scratch', 'cross', 'stretch', 'weight', 'tap', 'behind', 'look', 'weight', 'dance', 'curious', 'curious'];
const SIT = ['lean', 'chin', 'kick', 'look', 'kick', 'hands', 'nap', 'curious'];
const forced = new URLSearchParams(location.search).get('pose');
const pickOf = a => a[(Math.random() * a.length) | 0];
let gest = null, gestAt = 0;
// Things worth a look: the dove, pictures, buttons and links within reach of his eyes.
function interestNear() {
  const d = window.__scion, R = CFG.size * 3, here = { x: st.x, y: st.y - CFG.size * 0.6 };
  if (d && Math.hypot(d.x - here.x, d.y - here.y) < R * 1.5 && Math.random() < 0.7) return { x: d.x, y: d.y - 10, what: 'dove' };
  const c = [];
  for (const el of document.querySelectorAll('img, a.ibtn, button, .phone, .monitor, .mrow .th')) {
    const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
    const x = r.left + r.width / 2 + scrollX, y = r.top + r.height / 2 + scrollY;
    if (Math.hypot(x - here.x, y - here.y) < R) c.push({ x, y, what: el.tagName.toLowerCase() });
  }
  return c.length ? pickOf(c) : null;
}
function gesture(dt, sitting, still) {
  if (!still) { gest = null; return; }
  if (forced && (!gest || t - gest.t0 > gest.dur)) gest = { name: forced, t0: t, dur: 6, side: 1, amp: 1 };
  const dv = window.__scion;
  // Knocked dizzy: hands on his knees until his head clears.
  if (st.dead) gest = { name: 'dead', t0: Math.max(st.deadAt, t - 2), dur: 4, side: 1, amp: 1, f: 1 };   // held at the middle of the pose: slumped until the next BIRTH
  else if (st.dazed) { if (!gest || gest.name !== 'breathe') gest = { name: 'breathe', t0: t, dur: 2, side: 1, amp: 1, f: 1 }; }
  else {   // what passes between him and the dove is REL's call: its order's gesture replaces whatever he was doing
    const o = st.relOrder;
    if (o && o.gesture && !o.gDone && (!gest || gest.rel !== o.id) && !(gest && (gest.name === 'throw' || gest.name === 'lift' || gest.name === 'mad'))) {   // a tantrum plays out first
      const g = o.gesture, live = Math.sign((dv ? dv.x : st.x + st.dir) - st.x) || 1;
      gest = { ...g, t0: t, f: 1, amp: g.amp || 1, rel: o.id, side: o.ex === 'protect' || o.ex === 'keepaway' ? g.side || live : live };
      if (g.name === 'curious' && dv) st.interest = { x: dv.x, y: dv.y - 10, what: 'dove' };
    }
  }
  if (!gest && st.pendGest && sitting) { gest = { side: 1, amp: 1, f: 1, ...st.pendGest, t0: t }; st.pendGest = null; }   // the nap his mind wanted, once he is down
  if (!gest && t > gestAt && !(st.goal && st.goal.rel) && !st.crouch) {
    st.interest = interestNear();
    const list = sitting ? SIT : STAND;
    gest = { name: list[(Math.random() * list.length) | 0], t0: t, dur: 2.5 + Math.random() * 4.5, side: Math.random() < 0.5 ? -1 : 1, amp: 0.7 + Math.random() * 0.5, f: 0.8 + Math.random() * 0.6 };
    window.REL?.ev('hugo', 'gesture', null, 0, { name: gest.name });   // the dove may copy what he just did
  }
  if (!gest) return;
  const u = (t - gest.t0) / gest.dur;
  if (u >= 1) {
    if (gest.rel && st.relOrder && st.relOrder.id === gest.rel) { st.relOrder.gDone = true; relEnd('ok', { stayed: !!dv && Math.hypot(dv.x - st.x, dv.y - st.y) < CFG.size * 2 }); }
    gest = null; gestAt = t + 1.5 + Math.random() * 5; return;
  }
  const w = Math.min(1, u * 4, (1 - u) * 4), A = gest.amp, sd = gest.side, ph = (t - gest.t0) * (gest.f || 1);
  const S1 = sd > 0 ? 'R' : 'L';   // the arm on the gesture's side
  const T1 = (sd > 0) === (st.dir > 0) ? 'R' : 'L';   // the arm toward that side, whichever way he faces
  // an offer: halfway through crouching to it, a crumb appears by his hand
  if (gest.rel && st.relOrder && st.relOrder.drop && !st.relOrder.dropped && u > 0.5 && st.floor) { st.relOrder.dropped = true; const food = { x: st.x + sd * 24, y: st.y, t: performance.now() }; window.REL.ev('hugo', 'drop', 'dove', 0, food);
    window.__hugoFood = food; dispatchEvent(new CustomEvent('hugo:food', { detail: food })); }   // the crumb, page coordinates: anything (the bird) can find it
  switch (gest.name) {
    case 'look': lookGoal = sd * 0.8 * Math.sin(ph * 1.3) * A; break;
    case 'hips': armMix('L', [0.75, -0.6, -0.2], [-0.85, -0.35, 0.15], w); armMix('R', [0.75, -0.6, -0.2], [-0.85, -0.35, 0.15], w); break;
    case 'scratch': armMix(S1, [0.55, 0.55, 0.35], [-0.55, 0.75 + Math.sin(ph * 14) * 0.08, -0.15], w); lookGoal = -sd * 0.3; mix(B.head, 0.12, 0, sd * 0.15, w); break;
    case 'cross': armMix('L', [0.3, -0.85, 0.42], [-0.95, 0.12, 0.3], w); armMix('R', [0.3, -0.85, 0.42], [-0.95, 0.2, 0.36], w); break;
    case 'stretch': { const e = Math.sin(Math.min(1, u * 1.6) * Math.PI) * A; armMix('L', [0.3, 1, 0.05], [0.12, 1, 0], w * e); armMix('R', [0.3, 1, 0.05], [0.12, 1, 0], w * e); mix(B.chest, -0.12, 0, 0, w * e); break; }
    case 'weight': mix(sd > 0 ? B.thighR : B.thighL, -0.12, 0, -sd * 0.06, w); mix(sd > 0 ? B.shinR : B.shinL, 0.35 * A, 0, 0, w); mix(B.chest, 0, 0, sd * 0.05, w); break;
    case 'tap': mix(sd > 0 ? B.thighR : B.thighL, -0.18, 0, 0, w); mix(sd > 0 ? B.shinR : B.shinL, 0.25 + Math.max(0, Math.sin(ph * 9)) * 0.3 * A, 0, 0, w); break;
    case 'behind': armMix('L', [0.18, -0.9, -0.38], [-0.8, -0.15, -0.45], w); armMix('R', [0.18, -0.9, -0.38], [-0.8, -0.1, -0.5], w); mix(B.chest, -0.05, 0, 0, w); break;
    case 'lean': armMix('L', [0.3, -0.6, -0.75], [0.12, -1, -0.25], w); armMix('R', [0.3, -0.6, -0.75], [0.12, -1, -0.25], w); mix(B.chest, -0.15, 0, 0, w); break;
    case 'chin': armMix(S1, [0.15, -0.55, 0.8], [-0.25, 1, 0.12], w); mix(B.head, 0.18, 0, 0, w); mix(B.chest, 0.1, 0, 0, w); break;
    case 'kick': mix(B.shinL, Math.PI / 2 - 0.2 + Math.sin(ph * 4) * 0.5 * A, 0, 0, w); mix(B.shinR, Math.PI / 2 - 0.2 + Math.sin(ph * 4 + 2.4) * 0.5 * A, 0, 0, w); break;
    case 'breathe': { const b = Math.sin(t * (6 + A * 3)) * 0.06; mix(B.chest, 0.4 + b, 0, 0, w); armMix('L', [0.12, -0.75, 0.62], [0.02, -0.95, 0.25], w); armMix('R', [0.12, -0.75, 0.62], [0.02, -0.95, 0.25], w);
      mix(B.thighL, -0.35, 0, 0, w); mix(B.thighR, -0.35, 0, 0, w); mix(B.shinL, 0.55, 0, 0, w); mix(B.shinR, 0.55, 0, 0, w); break; }   // hands on knees, catching his breath
    case 'dust': armMix(S1, [0.2, -0.7, 0.55], [-0.6 + Math.sin(ph * 16) * 0.35, -0.6, 0.4], w); mix(B.chest, 0.2, 0, 0, w); lookGoal = -sd * 0.2; break;   // brushing himself off
    case 'dance': { const b = Math.sin(ph * 5.2), c = Math.sin(ph * 2.6);   // a little dance, his own rhythm each time
      mix(B.chest, 0.04, c * 0.12, b * 0.08 * A, w); mix(B.thighL, -0.15 - Math.max(0, b) * 0.25, 0, 0, w); mix(B.thighR, -0.15 - Math.max(0, -b) * 0.25, 0, 0, w);
      mix(B.shinL, 0.2 + Math.max(0, b) * 0.4, 0, 0, w); mix(B.shinR, 0.2 + Math.max(0, -b) * 0.4, 0, 0, w);
      armMix('L', [0.5, 0.1 + c * 0.4, 0.4], [0.2, 0.6 + b * 0.3, 0.3], w); armMix('R', [0.5, 0.1 - c * 0.4, 0.4], [0.2, 0.6 - b * 0.3, 0.3], w); lookGoal = c * 0.3; break; }
    case 'nap': case 'dead': { const br = gest.name === 'dead' ? -0.1 : Math.sin(t * 1.6) * 0.03;   // dead: the same slump, deeper, no breath mix(B.chest, -0.22 + br, 0, 0, w); mix(B.head, 0.42, 0, sd * 0.2, w); lookGoal = 0;   // dozing where he sits
      armMix('L', [0.25, -0.75, -0.55], [0.1, -1, -0.2], w); armMix('R', [0.25, -0.75, -0.55], [0.1, -1, -0.2], w); break; }
    case 'curious': { const tg = st.interest;   // something caught his eye: he leans toward it, looks, and reaches out to it
      const dx = tg ? tg.x - st.x : sd * 60, dy = tg ? (st.y - CFG.size * 0.6) - tg.y : 0;
      lookGoal = Math.max(-1, Math.min(1, dx / 160)); mix(B.head, Math.max(-0.35, Math.min(0.45, -dy / 300)), 0, 0, w);
      mix(B.chest, 0.18 * A, 0, 0, w); const reach = Math.max(0, Math.sin(Math.min(1, u * 1.4) * Math.PI));
      armMix(dx > 0 ? (st.dir > 0 ? 'R' : 'L') : (st.dir > 0 ? 'L' : 'R'), [0.3, -0.2 + (dy > 0 ? -0.3 : 0.3), 0.9], [0.2, -0.1 + (dy > 0 ? -0.4 : 0.4), 1], w * reach * 0.9); break; }
    case 'pat':   // greet's crouch, with the hand patting
    case 'greet': { const d = window.__scion; const dx = d ? d.x - st.x : sd * 60;   // the dove is right here: he crouches to its level and offers a hand
      lookGoal = Math.max(-1, Math.min(1, dx / 90)); mix(B.head, 0.3, 0, 0, w); mix(B.chest, 0.3, 0, 0, w);
      mix(B.thighL, -0.85, 0, 0, w); mix(B.thighR, -0.6, 0, 0, w); mix(B.shinL, 1.35, 0, 0, w); mix(B.shinR, 1.0, 0, 0, w);
      armMix(sd > 0 ? 'R' : 'L', [0.25, -0.45, 0.85], [0.15, -0.35 + (gest.name === 'pat' ? Math.sin(ph * 4) * 0.15 : 0), 0.95], w * A); break; }
    case 'swat': { const wu = Math.min(0.8, (gest.windup || 0.4) / gest.dur), soft = gest.soft ? 0.5 : 1;   // cocked high, then down and across at the bird
      lookGoal = sd * 0.8;
      mix(B.thighL, -0.85, 0, 0, w); mix(B.thighR, -0.6, 0, 0, w); mix(B.shinL, 1.35, 0, 0, w); mix(B.shinR, 1.0, 0, 0, w); mix(B.head, 0.3, 0, 0, w);   // down to its level, like greet
      if (u < wu) armMix(T1, [0.6, 0.5, -0.5], [0.4, 0.7, -0.4], w);
      else { armMix(T1, [0.4, -0.8, 0.7], [0.3, -0.9, 0.6], w * soft); mix(B.chest, 0.45 * soft, 0, 0, w); }
      if (!gest.fired && u > wu + 0.15 && st.hand) { gest.fired = 1; window.REL.ev('hugo', 'strikeApex', 'dove', 0, { x: st.hand.x, y: st.hand.y }); }
      break; }
    case 'scoop': {   // crouch to it and bring both hands in under it; the apex is the moment he tries to lift it
      const d = window.__scion, dx = d ? d.x - st.x : sd * 40; lookGoal = Math.max(-1, Math.min(1, dx / 80));
      mix(B.thighL, -0.95, 0, 0, w); mix(B.thighR, -0.75, 0, 0, w); mix(B.shinL, 1.45, 0, 0, w); mix(B.shinR, 1.15, 0, 0, w); mix(B.chest, 0.45, 0, 0, w); mix(B.head, 0.35, 0, 0, w);
      const r = Math.min(1, u * 1.8); armMix('L', [0.25, -0.55, 0.8 * r], [-0.35, -0.45, 0.85], w); armMix('R', [0.25, -0.55, 0.8 * r], [-0.35, -0.45, 0.85], w);
      if (!gest.fired && u > 0.55 && st.hand) { gest.fired = 1; window.REL?.ev('hugo', 'pickApex', 'dove', 0, { x: st.hand.x, y: st.hand.y }); }
      break; }
    case 'throw': {   // the bird drawn back over his shoulder, a step into it, and flung
      const wu = Math.min(0.75, (gest.windup || 0.5) / gest.dur), back = u < wu, k = back ? u / wu : 1;
      lookGoal = sd * 0.9;
      if (back) { armMix(T1, [0.35, 0.55 * k, -0.75 * k], [0.25, 0.85, -0.5 * k], w); mix(B.chest, -0.25 * k, 0, 0, w); mix(sd > 0 ? B.thighL : B.thighR, -0.25 * k, 0, 0, w); }
      else { armMix(T1, [0.3, 0.25, 0.95], [0.25, 0.1, 1], w); mix(B.chest, 0.4 * A, 0, 0, w); mix(sd > 0 ? B.thighR : B.thighL, -0.45, 0, 0, w); mix(sd > 0 ? B.shinR : B.shinL, 0.5, 0, 0, w); }
      if (!gest.fired && u > wu + 0.05) { gest.fired = 1; window.REL?.ev('hugo', 'throwApex', 'dove', 0); }
      break; }
    case 'lift': {   // the bird raised up out of his hands, arms all the way up, then they come down
      const k = Math.min(1, u / 0.6); armMix('L', [0.2, -0.3 + 1.3 * k, 0.6 - 0.35 * k], [-0.3 + 0.4 * k, 0.2 + 0.8 * k, 0.5 - 0.3 * k], w); armMix('R', [0.2, -0.3 + 1.3 * k, 0.6 - 0.35 * k], [-0.3 + 0.4 * k, 0.2 + 0.8 * k, 0.5 - 0.3 * k], w);
      mix(B.head, -0.3 * k, 0, 0, w); mix(B.chest, -0.1 * k, 0, 0, w); lookGoal = 0;
      if (!gest.fired && u > 0.6) { gest.fired = 1; window.REL?.ev('hugo', 'liftApex', 'dove', 0); }
      break; }
    case 'bow': mix(B.chest, 0.6 * A, 0, 0, w); mix(B.head, 0.3, 0, 0, w); armMix('L', [0.2, -0.6, 0.7], [0.1, -0.7, 0.8], w); armMix('R', [0.2, -0.6, 0.7], [0.1, -0.7, 0.8], w);
      mix(B.thighL, -0.4, 0, 0, w); mix(B.thighR, -0.4, 0, 0, w); mix(B.shinL, 0.6, 0, 0, w); mix(B.shinR, 0.6, 0, 0, w); break;
    case 'fist': armMix(T1, [0.4, 0.1, 0.5], [0.2, 0.9 + Math.sin(ph * 14) * 0.1, 0.3], w); lookGoal = sd * 0.8;
      if (st.relOrder && st.relOrder.ex === 'protect') mix(B.head, -0.35, 0, 0, w); break;   // shaken up at the hand that has the bird
    case 'cover': armMix('L', [0.3, 1, 0.2], [-0.6, 0.4, 0.4], w); armMix('R', [0.3, 1, 0.2], [-0.6, 0.4, 0.4], w); mix(B.chest, 0.3, 0, 0, w);   // ducks, hands over his head
      mix(B.thighL, -0.3, 0, 0, w); mix(B.thighR, -0.3, 0, 0, w); mix(B.shinL, 0.5, 0, 0, w); mix(B.shinR, 0.5, 0, 0, w); break;
    case 'rub': armMix(S1, [0.55, 0.55, 0.35], [-0.55, 0.75 + Math.sin(ph * 10) * 0.2, -0.15], w); mix(B.head, 0.15, 0, sd * 0.15, w); lookGoal = -sd * 0.3; break;   // rubbing the sore spot
    case 'mimicBob': { const b = Math.max(0, Math.sin(ph * 6)); mix(B.chest, 0.05 + 0.12 * b, 0, 0, w); mix(B.head, 0.15 * b, 0, 0, w); lookGoal = sd * 0.7; break; }   // nodding like the bird
    case 'mad': { const b = Math.sin(ph * 9), s = Math.max(0, Math.sin(ph * 6)), s2 = Math.max(0, -Math.sin(ph * 6));   // stomping in place, fists up and shaking, head down and shaking
      mix(B.thighL, -0.4 * s, 0, 0, w); mix(B.shinL, 0.6 * s, 0, 0, w); mix(B.thighR, -0.4 * s2, 0, 0, w); mix(B.shinR, 0.6 * s2, 0, 0, w);
      armMix('L', [0.35, 0.2, 0.55], [0.15, 0.95 + b * 0.18, 0.35], w); armMix('R', [0.35, 0.2, 0.55], [0.15, 0.95 - b * 0.18, 0.35], w);
      mix(B.chest, 0.22, 0, 0, w); mix(B.head, 0.2, Math.sin(ph * 11) * 0.25, 0, w); lookGoal = sd * 0.5; break; }
    case 'stomp': { const s = Math.max(0, Math.sin(ph * 5)); mix(sd > 0 ? B.thighR : B.thighL, -0.35 * s, 0, 0, w); mix(sd > 0 ? B.shinR : B.shinL, 0.5 * s, 0, 0, w);
      armMix('L', [0.75, -0.6, -0.2], [-0.85, -0.35, 0.15], w); armMix('R', [0.75, -0.6, -0.2], [-0.85, -0.35, 0.15], w); lookGoal = sd * 0.8; break; }
    case 'stare': mix(B.head, -0.4, 0, 0, w); lookGoal = dv ? Math.max(-1, Math.min(1, (dv.x - st.x) / 120)) : sd * 0.8;   // up at the bird he cannot reach, and a jump or two at it
      if ((u > 0.35 && !gest.fired) || (u > 0.7 && gest.fired === 1)) { gest.fired = (gest.fired || 0) + 1; hopUp(300); } break;
    case 'hop': if (!gest.fired) { gest.fired = 1; hopUp(240); } break;
    case 'shoo': { const d = window.__scion, dx = d ? d.x - st.x : sd * 60; lookGoal = Math.max(-1, Math.min(1, dx / 90));   // go on, get
      armMix(dx > 0 ? (st.dir > 0 ? 'R' : 'L') : (st.dir > 0 ? 'L' : 'R'), [0.55, -0.1, 0.7], [0.6 + Math.sin(ph * 7) * 0.6, 0.1, 0.6], w); mix(B.chest, -0.08, 0, 0, w); break; }
    case 'turnaway': { const d = window.__scion, dx = d ? d.x - st.x : sd * 60; lookGoal = -Math.sign(dx) * 0.9;   // pointedly looking elsewhere
      armMix('L', [0.3, -0.85, 0.42], [-0.95, 0.12, 0.3], w); armMix('R', [0.3, -0.85, 0.42], [-0.95, 0.2, 0.36], w); mix(B.head, -0.1, 0, 0, w); break; }
    case 'peer': mix(B.chest, 0.35, 0, 0, w); mix(B.head, 0.5, 0, 0, w); armMix('L', [0.3, -0.8, 0.35], [0.1, -0.9, 0.3], w); armMix('R', [0.3, -0.8, 0.35], [0.1, -0.9, 0.3], w); break;   // looking down over the edge
    case 'hands': armMix('L', [0.15, -0.8, 0.5], [-0.6, -0.2, 0.75], w); armMix('R', [0.15, -0.8, 0.5], [-0.6, -0.25, 0.7], w); break;
  }
}

window.__hugo = st;   // read-only peek for debugging
if (/[?&]debug/.test(location.search)) window.__hugoDbg = { get floors() { return floors; }, get t() { return t; }, get gest() { return gest && gest.name; }, miss: why => missed(why), clear: (x, y, h) => clear(x, y, h), get ink() { return ink; } };
st.dims = { THIGH, ARMLEN, SPINE, PITCH, CRAWL_H, size: CFG.size };
// Hit area follows him; the canvas itself never takes the pointer.
const hit = document.createElement('div'); hit.id = 'hugo-hit'; hit.setAttribute('aria-label', 'Hugo. Press to pick him up, let go to drop him.');
Object.assign(hit.style, { position: 'fixed', left: 0, top: 0, width: HALF_W * 2 + 'px', height: CFG.size + 'px', zIndex: 9999, cursor: 'grab', touchAction: 'none' });
const hud = document.createElement('div'); hud.id = 'hugo-hud';
Object.assign(hud.style, { position: 'fixed', left: 0, top: 0, zIndex: 9999, pointerEvents: 'none', font: '10px/1.5 "IBM Plex Mono", ui-monospace, monospace', letterSpacing: '.04em',
  color: 'var(--muted, #777)', whiteSpace: 'pre', opacity: 0, transition: 'opacity .2s' });
document.body.append(hit, hud);
let lastDown = 0, pointerId = null, pvx = 0, pvy = 0, ppx = 0, ppy = 0, ptime = 0, grabAt = 0, grabX = 0, grabY = 0, dragged = false;
hit.addEventListener('pointerenter', () => { st.hover = true; });
hit.addEventListener('pointerleave', () => { if (!st.held) st.hover = false; });
hit.addEventListener('pointerdown', e => {
  const now = performance.now();
  if (st.held) return;
  {                                                // press: pick him up (release lets go)
    st.held = true; st.dropF = null; st.hop = false; st.goal = null; st.air = false; st.floor = null; st.mode = 'walk'; st.amt = 0; st.vx = st.vy = 0;
    pointerId = e.pointerId; hit.style.cursor = 'grabbing'; document.body.style.cursor = 'grabbing';
    // He is held where you took him: by the head, the chest, or the legs (then he hangs upside down from your hand).
    st.grip = Math.max(0.3, Math.min(1, (st.y - (e.clientY + scrollY)) / CFG.size)); st.flip = false;   // held where you took him, always the right way up
    st.temper = 0.5 + Math.random() * 0.9; st.fearHigh = Math.random() * 0.35 - 0.1; st.fearFlip = Math.random() * 0.45;
    st.stress = (st.stress || 0) + (st.mode === 'walk' && st.amt > 0.3 ? 0.12 : st.mode === 'sit' ? 0 : 0.04) * Math.random(); st.react = null; st.reactUntil = 0;   // a surprise if you snatch him mid-stride
    relClear(); gest = null; st.pounce = null; window.REL?.ev('visitor', 'grabbed', 'hugo', st.stress); poke('the cursor picked me up');
    st.px = e.clientX + scrollX; st.py = e.clientY + scrollY + (st.flip ? 0 : CFG.size * st.grip);
    ppx = st.px; ppy = st.py; ptime = now; pvx = pvy = 0; grabAt = now; grabX = e.clientX; grabY = e.clientY; dragged = false;
    e.preventDefault();
  }
  lastDown = now;
});
addEventListener('pointermove', e => {
  if (st.hover && !st.held) { st.px = e.clientX + scrollX; }
  if (!st.held) return;
  if (Math.hypot(e.clientX - grabX, e.clientY - grabY) > 24) dragged = true;
  const now = performance.now(), dtp = Math.max(1, now - ptime) / 1000;
  st.px = e.clientX + scrollX; st.py = e.clientY + scrollY + (st.flip ? 0 : CFG.size * (st.grip ?? 0.55));
  pvx = pvx * 0.6 + ((st.px - ppx) / dtp) * 0.4; pvy = pvy * 0.6 + ((st.py - ppy) / dtp) * 0.4;   // smoothed hand velocity
  ppx = st.px; ppy = st.py; ptime = now;
});
const release = e => {
  if (!st.held) return;
  st.held = false; hit.style.cursor = 'grab'; document.body.style.cursor = ''; st.hover = false; st.flip = false; st.shaken = st.stress || 0;
  st.air = true; st.vx = Math.max(-1600, Math.min(1600, pvx)); st.vy = Math.max(-1800, Math.min(1800, pvy));   // a toss keeps the hand's speed
  st.dir = st.vx < 0 ? -1 : 1;
  const sp = Math.hypot(pvx, pvy); window.REL?.ev('visitor', sp > 600 ? 'tossed' : 'released', 'hugo', Math.min(1, sp / 1800), { stress: st.stress || 0 }); poke(sp > 600 ? 'the cursor threw me' : 'the cursor let me go');
};
addEventListener('pointerup', release); addEventListener('pointercancel', release);

// ---------- what his mind perceives, and what it can ask of his body ----------
// The cursor, seen from his size: a huge thing that roams the page, sometimes still, sometimes near, sometimes the hand
// that grabs him. Client coords are kept so a scroll moves the page under it, not the cursor.
const pointer = { cx: 0, cy: 0, in: false, movedAt: 0, at: 0, sp: 0, near: false };
addEventListener('pointermove', e => {
  const now = performance.now(), d = Math.hypot(e.clientX - pointer.cx, e.clientY - pointer.cy);
  pointer.sp = pointer.sp * 0.7 + (d / (Math.max(16, now - pointer.at) / 1000)) * 0.3; pointer.cx = e.clientX; pointer.cy = e.clientY; pointer.at = now; pointer.in = true;
  if (d > 2) pointer.movedAt = now;
  const near = Math.hypot(pointer.cx + scrollX - st.x, pointer.cy + scrollY - (st.y - CFG.size / 2)) < 160;
  if (near && !pointer.near && !st.held) poke('the cursor came close');
  pointer.near = near;
}, { passive: true });
document.documentElement.addEventListener('pointerleave', () => { pointer.in = false; });
const words = (s, n) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const labelOf = (el, n = 50) => el ? words(el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('alt') || el.getAttribute('title')) || el.textContent, n) : '';
function sectionOf(el) { const s = el && el.closest && el.closest('section,article,header,footer'); return s ? labelOf(s.querySelector('h1,h2,h3') || s, 40) : ''; }
function underFoot() {   // the very words under his feet, when he is on screen
  const f = st.floor; if (!f) return null;
  if (f.ground) return 'the very bottom of the page';
  const cx = st.x - scrollX, cy = f.y - scrollY + 5;
  if (f.text && cx > 0 && cy > 0 && cx < innerWidth && cy < innerHeight && document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(cx, cy), n = r && r.startContainer;
    if (n && n.nodeType === 3) return `the words "${words(n.textContent.slice(Math.max(0, r.startOffset - 24), r.startOffset + 24), 60)}"`;
  }
  const tag = f.el.tagName ? f.el.tagName.toLowerCase() : '';
  return f.text ? `the line "${labelOf(f.el, 60)}"` : `${tag === 'img' ? 'a picture' : tag === 'iframe' ? 'an app window' : 'the edge of a box'}${labelOf(f.el, 40) ? ` ("${labelOf(f.el, 40)}")` : ''}`;
}
let places = [];
const rel = (x, y) => ({ dx: Math.round(x - st.x), dy: Math.round((st.y - CFG.size / 2) - y) });   // +dx right of him, +dy above him
window.__hugoSense = () => {
  places = [];
  for (const el of document.querySelectorAll('h1,h2,h3,img,a.ibtn,button,.phone,.monitor,iframe')) {
    if (el.closest(skipSel) || el === hit) continue;
    const r = el.getBoundingClientRect(); if (r.width < 8 || r.bottom < 0 || r.top > innerHeight) continue;
    const x = r.left + r.width / 2 + scrollX, y = r.top + r.height / 2 + scrollY;
    const tag = el.tagName.toLowerCase(), kind = /^h[1-3]$/.test(tag) ? 'heading' : tag === 'img' ? 'picture' : tag === 'iframe' || el.matches('.phone,.monitor') ? 'app screen' : 'button';
    places.push({ el, x, y, d: Math.hypot(x - st.x, y - st.y), kind, label: labelOf(el, 45) });
  }
  places.sort((a, b) => a.d - b.d); places = places.slice(0, 8);
  const now = performance.now(), cp = { x: pointer.cx + scrollX, y: pointer.cy + scrollY }, still = (now - pointer.movedAt) / 1000;
  const over = pointer.in ? document.elementFromPoint(pointer.cx, pointer.cy) : null;
  const inView = st.y > scrollY + 30 && st.y - CFG.size < scrollY + innerHeight - 10;
  return {
    me: { doing: st.held ? 'being held by the cursor' : st.air ? 'in the air' : st.mode === 'crawl' ? 'crawling through a low gap' : st.mode === 'climb' ? 'climbing' : st.mode === 'idle' ? 'standing' : st.mode,
      gesture: st.gestName, on: underFoot(), section: st.floor ? sectionOf(st.floor.el) : '', seen_by_visitor: inView, stress: +(st.stress || 0).toFixed(2), dazed: !!st.dazed,
      walls: walls.filter(w => t - w.t < 40).map(w => `${Math.round(t - w.t)}s ago, on my ${w.dir > 0 ? 'right' : 'left'}`) },
    around: places.map((p, i) => ({ id: 'p' + (i + 1), kind: p.kind, label: p.label, ...rel(p.x, p.y) })),
    cursor: pointer.in ? { ...rel(cp.x, cp.y), dist: Math.round(Math.hypot(cp.x - st.x, cp.y - (st.y - CFG.size / 2))), moving: still > 1.5 ? 'still' : pointer.sp > 900 ? 'fast' : 'slowly',
      still_s: Math.round(still), over: over && over !== hit ? labelOf(over, 40) : over === hit ? 'me' : '', touching_me: !!st.hover, holding_me: !!st.held } : 'off the page',
    poke: pokes, poke_why: pokeWhy,
  };
};
function floorNear(x, y) {   // somewhere he can stand at or just under (x, y), and the standing spot nearest x
  let best = null;
  for (const q of floors) {
    if (q.y < y - 30 || q.y > y + CFG.size * 1.5 || q.x2 - q.x1 < 2 * HALF_W + 8) continue;
    const xs = []; for (let i = 0; i < 9; i++) { const sx = q.x1 + HALF_W + 4 + (q.x2 - q.x1 - 2 * HALF_W - 8) * i / 8; if (clear(sx, q.y, CFG.size + 4)) xs.push(sx); }
    if (!xs.length) continue;
    const sx = xs.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a), score = Math.abs(q.y - y) + Math.abs(sx - x) * 0.5;
    if (!best || score < best.score) best = { f: q, x: sx, score };
  }
  return best;
}
// The mind's wish, carried out with his own body. Never while he is held, airborne, climbing, crawling, mid-jump or busy
// with the dove (REL leads there); a wish he cannot carry out is just dropped.
window.__hugoAct = (act, target) => {
  if (!act || st.dead || st.held || st.air || st.relOrder || (gest && gest.name === 'mad') || ['climb', 'prep', 'crawl'].includes(st.mode) || (st.crawlK || 0) > 0.05) return 'busy';
  const p = target && target !== 'cursor' ? places.find((q, i) => 'p' + (i + 1) === target) : null;
  const cp = { x: pointer.cx + scrollX, y: pointer.cy + scrollY };
  const stand = (name, dur) => { if (st.mode === 'sit') return; st.mode = 'idle'; st.amt = 0; st.idleUntil = t + dur; gest = { name, t0: t, dur, side: Math.random() < 0.5 ? -1 : 1, amp: 0.8 + Math.random() * 0.3, f: 0.8 + Math.random() * 0.5 }; };
  const goTo = (x, y, why) => { const g = floorNear(x, y); if (!g) return 'no way there'; st.goal = { f: g.f, x: g.x, until: t + 30, mind: why }; if (st.mode !== 'walk') { st.mode = 'walk'; restyle(); } return 'ok'; };
  switch (act) {
    case 'go': return p ? goTo(p.x, p.el.getBoundingClientRect().top + scrollY, p.label) : 'no such place';
    case 'approach_cursor': return pointer.in ? goTo(cp.x, cp.y, 'cursor') : 'no cursor';
    case 'back_away': { const f = st.floor; if (!f) return 'no floor'; const away = pointer.in ? -(Math.sign(cp.x - st.x) || 1) : -st.dir;
      const x = Math.max(f.x1 + HALF_W + 4, Math.min(f.x2 - HALF_W - 4, st.x + away * 220));
      if (Math.abs(x - st.x) > 40) { st.goal = { f, x, until: t + 15, mind: 'away' }; st.mode = 'walk'; return 'ok'; }
      const g = pickFloor(true); if (g) { st.goal = { f: g.f, x: g.x, until: t + 30, mind: 'away' }; st.mode = 'walk'; return 'ok'; } return 'nowhere to go'; }
    case 'look': { const tg = target === 'cursor' ? (pointer.in ? { x: cp.x, y: cp.y, what: 'cursor' } : null) : p ? { x: p.x, y: p.y, what: p.kind } : null;
      if (!tg) return 'nothing there'; st.interest = tg; st.watch = target === 'cursor' ? t + 5 : 0; st.dir = Math.sign(tg.x - st.x) || st.dir; stand('curious', 3.5 + Math.random() * 2); return 'ok'; }
    case 'sit': if (!st.floor || !clear(st.x, st.floor.y, SIT_H + 4)) return 'no room to sit'; st.goal = null; st.mode = 'sit'; st.idleUntil = t + 12 + Math.random() * 15; return 'ok';
    case 'nap': if (!st.floor || !clear(st.x, st.floor.y, SIT_H + 4)) return 'no room to sit'; st.goal = null; st.mode = 'sit'; st.idleUntil = t + 20 + Math.random() * 15;
      st.pendGest = { name: 'nap', dur: 15 + Math.random() * 10 }; return 'ok';
    case 'dance': case 'stretch': stand(act, act === 'dance' ? 5 + Math.random() * 4 : 3 + Math.random() * 2); return 'ok';
    case 'look_around': stand('look', 3 + Math.random() * 3); return 'ok';
    case 'wander': { const g = pickFloor(true) || pickToward(Math.random() < 0.5 ? 1 : -1); if (!g) return 'nowhere new'; st.goal = { f: g.f, x: g.x, until: t + 30 }; st.mode = 'walk'; return 'ok'; }
    default: return 'carry on';
  }
};
// The Mortal Agent Frame's life (bond.js): ENDED = the body goes limp where it is, the next BIRTH stands it up again.
window.__hugoLife = alive => { if (!alive === !!st.dead) return; st.dead = !alive; st.deadAt = t; gest = null; if (st.dead) { relEnd('interrupted'); st.prep = null; } else st.idleUntil = t + 0.6; };
// What he says aloud (the frame's "say", or its reply to the visitor). The bubble lives in the agent layer, so nobody stands on it.
const say = layer.appendChild(document.createElement('div')); let sayTimer;
Object.assign(say.style, { position: 'absolute', left: 0, top: 0, maxWidth: '240px', padding: '9px 12px', font: '13px/1.4 system-ui,sans-serif', color: '#15171C', background: '#fff',
  border: '1px solid #D8D8D2', borderRadius: '14px', boxShadow: '0 8px 24px rgba(21,23,28,.16)', opacity: 0, transition: 'opacity .35s' });   // the dove's bubble (#scion-say), same look
window.__hugoSay = text => { text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 220); if (!text) return; say.textContent = text; say.style.opacity = 1; clearTimeout(sayTimer); sayTimer = setTimeout(() => { say.style.opacity = 0; }, 2500 + text.length * 50); };
// Something happened to him: his mind (the frame, or hugo-mind, via bond.js) thinks again right away instead of at its next beat.
let pokes = 0, pokeWhy = '';
function poke(why) { pokes++; pokeWhy = why; }
// Failing at the same thing again and again gets to him: three misses in 25 s and he loses his temper for a moment, stomping
// and shaking his fists at it, then lets it go. Desktop and phones alike.
const misses = [];
function missed(why) {
  misses.push(t); while (misses.length && t - misses[0] > 25) misses.shift();
  if (misses.length < 3 || st.air || st.held || st.dead || st.mode === 'sit' || (gest && gest.rel)) return false;
  misses.length = 0; poke('fed up: ' + why); window.REL?.ev('hugo', 'gesture', null, 0, { name: 'mad' });
  st.goal = null; st.mode = 'idle'; st.amt = 0; st.idleUntil = t + 3.2;
  gest = { name: 'mad', t0: t, dur: 3, side: st.dir, amp: 1, f: 1 }; gestAt = t + 6; return true;
}
// A wall ahead (words or a box he cannot walk or crawl under). A person does not walk into it over and over: he gets on
// top of it if he can, lets go of a goal that lies past it, and remembers it; boxed in on both sides, he climbs out or
// sits it out instead of pacing.
const walls = [];
function blocked(f) {
  walls.push({ f, dir: st.dir, t }); if (walls.length > 12) walls.shift();
  poke('walked into a wall');
  const x0 = st.x + st.dir * (HALF_W + 14);   // where the thing in his way stands
  let up = null;
  for (const q of floors) {
    if (q === f || q.y > f.y - 8 || q.y < f.y - CFG.size * 2.2 || x0 < q.x1 || x0 > q.x2) continue;
    const ux = Math.max(q.x1 + HALF_W + 10, Math.min(q.x2 - HALF_W - 10, x0 + st.dir * (HALF_W + 24)));   // well onto the top, not on its lip
    if (onFloor(q, ux) && clear(ux, q.y, CFG.size + 4) && (!up || q.y > up.q.y)) up = { q, ux };   // the lowest top he can stand on
  }
  const wantsPast = st.goal && Math.sign(st.goal.x - st.x) === st.dir;
  if (up && (wantsPast || Math.random() < 0.6)) { const dh = f.y - up.q.y; st.mode = 'prep'; st.amt = 0; st.prep = { f: up.q, dh, until: t + 0.18 + Math.random() * 0.14, climb: dh > CFG.size * 1.2, over: up.ux }; return; }
  if (wantsPast) { const g = st.goal; st.goal = null; if (g.rel) relEnd('fail'); else avoid.set(g.f, t + 60 + Math.random() * 60); missed('no way past'); }   // no way past: not there, not now
  if (walls.some(w => w.f === f && w.dir === -st.dir && t - w.t < 30)) {   // walls both ways lately: hemmed in
    const g = pickToward(-1);
    if (g) { st.goal = { f: g.f, x: g.x, until: t + 20 }; return; }
    if (missed('hemmed in')) return;   // boxed in with no way out: it builds up like any other failure
    if (clear(st.x, f.y, SIT_H + 4)) { st.mode = 'sit'; st.idleUntil = t + 15 + Math.random() * 20; }
    else { st.mode = 'idle'; st.idleUntil = t + 4 + Math.random() * 4; gest = { name: 'look', t0: t, dur: 3.5, side: -st.dir, amp: 1, f: 1 }; }
    return;
  }
  st.dir = -st.dir; st.mode = 'idle'; st.idleUntil = t + 0.8 + Math.random() * 1.8;   // turns away from it, after a moment
}
// One step toward the visitor's view: dir 1 = the view is below him (any floor lower down, he will step off a ledge
// to reach it), dir -1 = above (the highest floor he can hop up to from here).
function pickToward(dir) {
  const c = [];
  for (const f of floors) {
    if (f === st.floor || f.x2 - f.x1 < 2 * HALF_W + 8) continue;
    const dy = st.y - f.y;
    if (dir < 0 ? (dy > 6 && dy < CFG.size * 2.2) : (dy < -10 && f.y < scrollY + innerHeight)) {
      const x = Math.max(f.x1 + HALF_W + 6, Math.min(f.x2 - HALF_W - 6, st.x));
      if (clear(x, f.y, CFG.size + 4)) c.push({ f, x, score: dir < 0 ? -f.y : -Math.abs(f.y - (scrollY + innerHeight * 0.6)) });
    }
  }
  c.sort((a, b) => b.score - a.score);
  return c[0] || null;
}
const onFloor = (f, x) => x - HALF_W >= f.x1 && x + HALF_W <= f.x2;
// Stepping off a ledge: phones never take a drop that ends a screen or more down at the page bottom (he vanished from view for good)
const dropTo = (x, y) => { const f = landingBelow(x, y), ok = f && !(phone() && f.ground && f.y - y > innerHeight * 0.8); st.dropF = ok && phone() ? f : null; return ok ? f : null; };
function landingBelow(x, y, vis) {   // nearest floor under (x, y) within a screen and a half; vis: a drop, so it must be one you can see
  let best = null;
  const visBottom = scrollY + innerHeight - 30, lim = vis && visBottom > y + 2 ? visBottom : Infinity;
  // The bottom of the page always catches him, words or not; otherwise he fell straight through it and out of the world.
  // Phones: not behind words (Read less: the monitor and its caption sit on it); past it he falls out of the world and is born again in view.
  for (const f of floors) if (f.y > y + 2 && f.y <= lim && (f.ground || f.y < y + innerHeight * 1.5) && onFloor(f, x) && ((f.ground && !phone()) || clear(x, f.y, CFG.size + 4)) && (!best || f.y < best.y)) best = f;
  // Dropped over a dense page, almost no ledge has a body-sized gap above it. If the strict search found nothing near, he lands on
  // the nearest ledge below him anyway, standing in front of the words, as a small figure on a page would.
  if (!phone() && (!best || (best.ground && best.y > y + innerHeight * 0.9))) {   // phones: never in front of words
    let near = null;
    for (const f of floors) if (!f.ground && f.y > y + 2 && f.y <= Math.min(lim, y + innerHeight * 0.9) && f.x2 - f.x1 > HALF_W * 1.4 && x > f.x1 + 4 && x < f.x2 - 4 && (!near || f.y < near.y)) near = f;
    if (near) best = near;
  }
  // Nothing visible to land on: the bottom edge of the screen catches him, so a drop never ends out of sight.
  // Phones: no invisible floor; once scrolled it left him standing on air in the middle of the page. He falls to a real one.
  if (vis && lim !== Infinity && (!best || best.y > lim) && !phone()) best = { y: lim, x1: 0, x2: document.documentElement.scrollWidth, el: document.body, screen: true };
  return best;
}
// ---------- him and the dove ----------
// REL (bond.js) holds what they feel about each other and what passed between them, and every ~0.75 s says what, if
// anything, he does about the bird. His body carries it out with the same walking, hopping and gestures as his own life;
// when REL has nothing for him, his own life runs.
const onMine = p => st.floor && Math.abs(st.floor.y - p.y) < 6 && p.x > st.floor.x1 && p.x < st.floor.x2;   // the floor he is on wins over a twin at the same height
const floorFor = p => (onMine(p) ? st.floor : null) || floors.find(q => Math.abs(q.y - p.y) < 6 && p.x > q.x1 && p.x < q.x2) || landingBelow(p.x, p.y - 1);
const TRACK = new Set(['approach', 'follow', 'chase', 'stalk', 'groom', 'comfort', 'reconcile', 'swat', 'displace', 'offer', 'sit_with', 'threat', 'display']);   // goals that move with the bird
const relLeft = o => Math.max(1, o.until - window.REL.t);   // seconds left on an order (engine clock)
const faceDove = () => { const d = window.__scion; if (d) st.dir = Math.sign(d.x - st.x) || st.dir; };
function relGoal(o, p) {
  const f = p && floorFor(p); if (!f || f.y < st.y - CFG.size * 2.2) return false;   // no floor there, or one too high to climb to
  st.goal = { f, x: Math.max(f.x1 + HALF_W, Math.min(f.x2 - HALF_W, p.x)), until: t + relLeft(o), rel: o.id };
  return true;
}
function relClear() { if (st.goal && st.goal.rel) st.goal = null; st.relOrder = null; st.spdK = 1; st.crouch = 0; st.relBusy = false; st.relGap = null; }
function relEnd(result, data) { const o = st.relOrder; if (!o) return; relClear(); st.relAt = result === 'fail' ? t + 0.75 : 0; window.REL.done('hugo', o.id, result, data || {}); }
function hopUp(vy) { if (!st.floor || st.mode === 'sit' || (st.sitK || 0) > 0.04) return; st.air = true; st.hop = true; st.floor = null; st.vx = 0; st.vy = -vy; st.mode = 'walk'; }
function applyOrder(o) {
  relClear(); st.relOrder = o; st.spdK = o.spdK || 1; st.crouch = o.crouch || 0;
  const d = window.__scion;
  st.relGap = o.goal && d && TRACK.has(o.ex) ? Math.abs(o.goal.x - d.x) : null;
  if (o.pounce) {   // crouch, wiggle, spring: the prep pose is the telegraph
    st.goal = null; st.dir = Math.sign(o.pounce.x - st.x) || st.dir; st.mode = 'prep'; st.amt = 0;
    st.prep = { pounce: o.pounce, t0: t, until: t + ((o.gesture && o.gesture.windup) || 0.3) }; return;
  }
  if (o.goal && relGoal(o, o.goal)) { if (st.mode !== 'walk') { st.mode = 'walk'; restyle(); } return; }
  st.goal = null;   // nowhere he can stand near it (or too high up): he stays put and faces it, with the gesture if there is one, until the order runs out
  if (o.ex === 'protect' && o.gesture) st.dir = o.gesture.side || st.dir;
  else if (!['flee', 'keepaway', 'ignore', 'sulk'].includes(o.ex)) faceDove();
  st.mode = (o.sit || (st.mode === 'sit' && !o.gesture)) && clear(st.x, st.y, SIT_H + 4) ? 'sit' : 'idle';
  st.idleUntil = t + (o.sit ? relLeft(o) : o.gesture ? (o.gesture.windup || 0) + o.gesture.dur + 0.3 : Math.min(relLeft(o), o.goal ? 8 : 4));   // cannot get there: he watches it a while
}
function relArrive(f) {   // got where the order wanted him
  const o = st.relOrder, d = window.__scion; if (!o) return;
  if (o.ex !== 'flee' && o.ex !== 'keepaway') faceDove();
  st.mode = o.sit && clear(st.x, f.y, SIT_H + 4) ? 'sit' : 'idle';
  st.idleUntil = t + (o.sit ? relLeft(o) : o.gesture ? (o.gesture.windup || 0) + o.gesture.dur + 0.3 : 0.6 + Math.random());
  const dd = d ? Math.hypot(d.x - st.x, d.y - st.y) : 1e9;
  if (!o.gesture && !o.sit) relEnd('ok', { won: o.ex === 'displace' && dd > 50, stayed: dd < CFG.size * 2 });
}
function relStep(f) {
  const R = window.REL; if (!R || t < (st.relAt || 0) || st.dead || st.dazed || st.mode === 'crawl' || (st.crawlK || 0) > 0.05) return;   // no standing up under a low ceiling for the bird
  st.relAt = t + 0.75;
  const d = window.__scion;
  const reach = !!d && d.mode === 'perch' && !d.held && d.y >= st.y - CFG.size * 2.2 && floors.some(q => Math.abs(q.y - d.y) < 6 && d.x > q.x1 && d.x < q.x2);
  const o = R.want('hugo', { reach, floorY: f.y });
  if (!o) { if (st.relOrder) relClear(); return; }
  if (o.id !== (st.relOrder && st.relOrder.id)) applyOrder(o);
  else if (st.relGap != null && st.goal && st.goal.rel === o.id && d && (d.mode === 'perch' || o.ex === 'chase')) relGoal(o, { x: d.x - (Math.sign(d.x - st.x) || 1) * st.relGap, y: d.y });   // the bird moved: after it
  const ph = R.phase; st.relBusy = !!(st.relOrder && ph && ph.stage !== 'resolve');
}
let bornTries = 0, lastSY = 0, curSY = 0, jumpAt = -1e9;   // lastSY: the scroll before the latest jump, to keep him put on screen across a view switch
function born() {   // first appearance: a floor in view with standing room
  const spots = inView => { const c = [];
    for (const f of floors) if ((!inView || (f.y > scrollY && f.y < scrollY + innerHeight)) && f.x2 - f.x1 > 160 && (inView || !f.ground)) {
      const n = phone() ? Math.ceil((f.x2 - f.x1) / 6) : 8;   // phones: small clear gaps are often all there is, so look along the whole ledge
      for (let i = 1; i < n; i++) { const x = f.x1 + (f.x2 - f.x1) * i / n; if (onFloor(f, x) && clear(x, f.y, CFG.size + 4)) c.push({ f, x }); }
    }
    return c; };
  // First appearance on a wide screen: sitting on the end of the hero's grey divider, legs over the edge.
  const ledge = floors.find(f => !f.text && f.el.matches && f.el.matches('#mast .facts') && f.y > scrollY && f.y < scrollY + Math.max(innerHeight, 900));
  if (ledge && !bornTries) {
    for (let x = ledge.x2 - HALF_W * 0.4 - 2; x > ledge.x1 + HALF_W; x -= 8)   // the clear spot nearest the end
      if (clear(x, ledge.y, SIT_H + 4)) { st.floor = ledge; st.x = x; st.y = ledge.y; st.dir = -1; st.mode = 'sit'; st.sitK = 1; st.idleUntil = t + 14 + Math.random() * 10; return true; }
  }
  // Phones, first appearance: sitting on top of the hero name, somewhere new along it each load, in one of his sitting poses.
  if (phone() && !bornTries && !st.bornOnce) {
    const xs = []; for (const nm of floors) if (nm.name && nm.y > scrollY && nm.y < scrollY + innerHeight) for (let x = nm.x1 + HALF_W * 0.6; x <= nm.x2 - HALF_W * 0.6; x += 6) if (clear(x, nm.y, SIT_H + 4)) xs.push({ nm, x });   // both words, end to end
    if (xs.length) { const { nm, x } = xs[(Math.random() * xs.length) | 0]; st.bornOnce = true; st.floor = nm; st.x = x; st.y = nm.y; st.dir = Math.random() < 0.5 ? -1 : 1; st.mode = 'sit'; st.sitK = 1;
      st.idleUntil = t + 8 + Math.random() * 10; st.pendGest = { name: SIT[(Math.random() * SIT.length) | 0], dur: 3 + Math.random() * 4, side: Math.random() < 0.5 ? -1 : 1, amp: 0.7 + Math.random() * 0.5 }; return true; }
  }
  let c = spots(true);
  if (!c.length && (bornTries = (bornTries || 0) + 1) > 90) c = spots(false);   // nothing in view for ~1.5 s: start anywhere he fits
  if (!c.length) return false;
  const p = c[(Math.random() * c.length) | 0]; st.floor = p.f; st.x = p.x; st.y = p.f.y; st.dir = Math.random() < 0.5 ? -1 : 1; return true;
}
function refloor(f) {   // the page reflows; keep the floor glued to its element
  if (f.screen) return true;
  if (f.fr && (!document.body.classList.contains('simple') || !f.fr.getClientRects().length)) return false;   // a ledge in the Read less frame is gone once the frame is
  if (f.ground) { if (phone() && document.body.classList.contains('simple')) return false; f.y = groundY(); f.x2 = document.documentElement.scrollWidth; if (phone()) fit(f); return true; }
  if (!f.el.isConnected || (phone() && !f.el.getClientRects().length)) return false;   // phones: its element was hidden (a view switch): the floor is gone, he falls
  const fo = f.fr ? f.fr.getBoundingClientRect() : null, ox = scrollX + (fo ? fo.left : 0), oy = scrollY + (fo ? fo.top : 0);   // fo: a floor inside the Read less frame
  if (f.text) { const r = f.el.getBoundingClientRect(); const dy = (r.top + oy) - (f.elTop ?? (f.elTop = r.top + oy)); if (dy) { f.y += dy; f.elTop += dy; } return true; }
  const r = f.el.getBoundingClientRect(), top = r.top + oy, bottom = r.bottom + oy;
  f.x1 = r.left + ox; f.x2 = r.right + ox; if (phone()) fit(f); f.y = Math.abs(f.y - bottom) < Math.abs(f.y - top) ? bottom : top; return true;
}
function step(dt) {
  if (st.held) {   // he hangs from the hand: a stiff spring to the pointer, so the body lags and swings a little
    const ax = (st.px - st.x) * 180 - st.vx * 22, ay = (st.py - st.y) * 180 - st.vy * 22;
    st.vx += ax * dt; st.vy += ay * dt; st.x += st.vx * dt; st.y += st.vy * dt;
    swingLimbs(dt, (st.vx - lastVx) / dt, (st.vy - lastVy) / dt + G, 1); lastVx = st.vx; lastVy = st.vy;
    st.tilt += ((st.flip ? Math.PI : 0) + (st.vx * 0.0006) - st.tilt) * Math.min(1, dt * 6);
    // How it feels: a fast hand, being high above any floor, hanging upside down and being shaken all frighten him;
    // a still, low, gentle hold lets him calm down. Each grab has its own temper, so the same hold lands differently.
    const sp = Math.hypot(pvx, pvy), below = landingBelow(st.x, st.y), high = below ? Math.min(1, (below.y - st.y) / 700) : 1;
    const jerk = Math.abs(sp - (st.lastSp || 0)) / Math.max(dt, 1e-3); st.lastSp = sp;
    const rise = (sp / 2600 + high * st.fearHigh + (st.flip ? st.fearFlip : 0) + Math.min(1, jerk / 40000) * 0.6) * st.temper;   // nothing is scary by rule; it depends on him this time
    st.stress = Math.max(0, Math.min(1, st.stress + (rise - (sp < 150 ? 0.3 : 0.08)) * dt * 0.8));
    pvx *= Math.max(0, 1 - dt * 4); pvy *= Math.max(0, 1 - dt * 4);   // a hand that stops moving reads as still
    return;
  }
  if (st.air) {
    st.vy += G * dt; const py = st.y; st.y += st.vy * dt; st.x += st.vx * dt;
    st.vx *= Math.max(0, 1 - 0.3 * dt);   // a little air drag
    const W = phone() ? document.documentElement.clientWidth : document.documentElement.scrollWidth;
    if (st.x < HALF_W) { st.x = HALF_W; st.vx = Math.abs(st.vx) * 0.5; } else if (st.x > W - HALF_W) { st.x = W - HALF_W; st.vx = -Math.abs(st.vx) * 0.5; }
    swingLimbs(dt, (st.vx - lastVx) / dt, (st.vy - lastVy) / dt + G, 0.7); lastVx = st.vx; lastVy = st.vy;
    st.tilt += ((st.vx * 0.0005) - st.tilt) * Math.min(1, dt * 4);
    let f = landingBelow(st.x, py - 1, !st.hop && !st.pounce);
    if (st.dropF && (!f || f.y > st.dropF.y)) f = st.dropF;   // phones: the ledge he chose to step down to catches him
    if (f && st.y >= f.y && st.vy > 0) { if (f === st.dropF) st.x = Math.max(f.x1 + HALF_W, Math.min(f.x2 - HALF_W, st.x)); st.dropF = null; st.y = f.y; st.floor = f; st.air = false; st.vy = 0; st.vx = 0; st.land = st.hop ? 0.2 : 0.35; st.hop = false; st.mode = 'walk'; st.tilt = 0;
      if (st.pounce) { window.REL?.ev('hugo', 'pounceLand', 'dove', 0, { x: st.x, y: st.y }); st.pounce = null; relEnd('ok'); st.mode = 'idle'; st.idleUntil = t + 0.8; }
      else if (gest && gest.rel) st.mode = 'idle';
      if ((st.shaken || 0) > 0.35) { window.REL?.ev('hugo', 'fell', null, Math.min(0.8, st.shaken), { x: st.x, y: st.y }); poke('landed hard'); }
      if ((st.shaken || 0) > 0.35) { st.mode = 'idle'; st.idleUntil = t + 2.5 + st.shaken * 5; gest = { name: st.shaken > 0.65 ? 'breathe' : pickOf(['dust', 'breathe', 'look']), t0: t, dur: 2.5 + st.shaken * 5, side: Math.random() < 0.5 ? -1 : 1, amp: 0.7 + st.shaken * 0.5, f: 1 }; }
      st.shaken = 0; st.stress = (st.stress || 0) * 0.5; for (const L of Object.values(limbs)) { L[0] = 0; L[1] = 0; } }
    else if (phone() && !st.hop && !st.pounce && st.y > scrollY + innerHeight + CFG.size) { st.air = false; st.floor = null; }   // phones: a drop with nothing in view to catch it: he comes back in view rather than falling for pages
    else if (st.y > document.documentElement.scrollHeight + 400) { st.air = false; st.floor = null; st.pounce = null; relEnd('interrupted'); }   // fell off the world: born again
    return;
  }
  st.tilt += (0 - st.tilt) * Math.min(1, dt * 6);
  if (st.mode === 'climb') {   // jump, catch the edge, hang a moment, pull himself up and get a knee over
    const C = st.climb; if (!refloor(C.f)) { st.mode = 'walk'; st.air = true; st.climb = null; return; }
    const e = (a, b, u) => a + (b - a) * (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);   // ease in-out
    const T1 = 0.32, T2 = T1 + C.hang, T3 = T2 + C.pull, k = t - C.t0, hangY = C.f.y + CFG.size * 1.02;
    if (k < T1) { C.ph = 'reach'; C.u = k / T1; st.y = e(C.y0, hangY, C.u); }
    else if (k < T2) { C.ph = 'hang'; C.u = (k - T1) / C.hang; st.y = hangY + Math.sin(C.u * Math.PI) * 3; }
    else if (k < T3) { C.ph = 'pull'; C.u = (k - T2) / C.pull; st.y = e(hangY, C.f.y, C.u); if (C.xTo != null) st.x = e(C.x0, C.xTo, C.u); }   // up the face and over the top
    else { st.floor = C.f; st.y = C.f.y; if (C.xTo != null) st.x = C.xTo; st.mode = 'walk'; st.land = 0.25; st.climb = null; }
    return;
  }
  const f = st.floor; if (!f) return;
  if (!refloor(f)) { st.floor = null; if (phone()) { if (performance.now() - jumpAt < 800) st.y += scrollY - lastSY; jumpAt = -1e9; st.air = true; st.hop = false; st.vx = 0; st.vy = 0; st.mode = 'walk'; } return; }   // phones (a view switch): same spot on screen, then he drops into the new page
  st.y = f.y;
  // the page shifted under him (an app loaded, a block grew): if his spot now runs through words, step off and fall to a clear floor
  const room = () => clear(st.x, f.y, (st.mode === 'sit' ? SIT_H : st.mode === 'crawl' || (st.crawlK || 0) > 0.05 ? CRAWL_H : CFG.size) + 4);
  if (!f.ground && st.mode !== 'prep' && !room() && !(phone() && performance.now() - scanAt > 100 && (scan(), room()))) { st.air = true; st.vx = 0; st.vy = 0; st.floor = null; st.mode = 'walk'; return; }   // phones: a stale scan (the hero settling a few px) is no reason to fall; look again first
  if ((st.markAt || 0) < t) { seenAt.set(cell(st.x, st.y), t); st.markAt = t + 1; }
  if (!st.anchor || Math.hypot(st.x - st.anchor.x, st.y - st.anchor.y) > 160) st.anchor = { x: st.x, y: st.y, t };
  const bored = t - st.anchor.t > (st.boredAfter ??= 35 + Math.random() * 40) && st.mode !== 'sit';
  if (st.mode !== 'prep') relStep(f);
  if (st.dazed && st.mode === 'walk') { st.mode = 'idle'; st.idleUntil = t + 0.5; }   // seeing stars: he stands where he is
  if (st.mode === 'walk') {
    if (st.land > 0) { st.land -= dt; return; }
    if ((st.sitK || 0) > 0.04 || (st.crawlK || 0) > 0.05) { st.amt = 0; return; }   // still getting up
    if (st.throwing) { st.amt = Math.max(0, st.amt - dt * 6); return; }   // he plants his feet to throw or lift the bird
    if (bored && !st.relBusy && (!st.goal || st.goal.f === f)) {   // seen enough of this spot: somewhere new, in view or beyond it
      const g = pickFloor(true) || pickToward(Math.random() < 0.5 ? 1 : -1);
      if (g) { st.goal = { f: g.f, x: g.x, until: t + 30 }; st.anchor = { x: st.x, y: st.y, t }; st.boredAfter = 35 + Math.random() * 40; }
    }
    // Purpose: the page is his home. Now and then he picks a divider or a box top he can see and goes there: along the
    // floor, off a ledge to get down, a hop to get up when the next level is within reach. There he sits or looks around.
    // Being seen. Off screen for a while (how long depends on him today) he wants back into the visitor's view and
    // works his way there: down off ledges, or up a level at a time when it is within a hop. In view, he shies away
    // from the very edges of the screen. Nothing forces it; it is a want that grows and that he can fail at.
    const inView = st.y > scrollY + 30 && st.y - CFG.size < scrollY + innerHeight - 10;
    st.away = inView ? 0 : (st.away || 0) + dt;
    if (st.patience === undefined) st.patience = 2 + Math.random() * 10;
    if (f.ground && !inView) st.away += dt * 2;   // stuck at the bottom with nobody around: he wants out
    if (st.away > st.patience && (!st.goal || !st.goal.toView)) {
      const g = pickToward(st.y < scrollY + 30 ? 1 : -1);
      if (g) st.goal = { f: g.f, x: g.x, until: t + 15, toView: true }; else st.patience += 4 + Math.random() * 8;   // no way there from here; try again later
    }
    if (inView && st.goal?.toView) { st.goal = null; st.patience = 2 + Math.random() * 10; }
    if (inView && !st.goal) {
      const sx = st.x - scrollX;
      if ((sx < 56 && st.dir < 0) || (sx > innerWidth - 56 && st.dir > 0)) st.dir = -st.dir;   // too close to the edge of the screen
    }
    if (!st.goal && !st.relBusy && Math.random() < dt / 5) { const g = pickFloor(true); if (g) st.goal = { f: g.f, x: g.x, until: t + 30 }; }
    if (st.goal) {
      const g = st.goal;
      if (!refloor(g.f) || t > g.until) { if (t > g.until && !g.rel) { avoid.set(g.f, t + 45 + Math.random() * 45); missed('never got there'); } st.goal = null; if (g.rel) relEnd('fail'); }   // could not get there: try elsewhere for a while
      else if (g.f === f) {
        if (Math.abs(g.x - st.x) < 8) {
          st.goal = null;
          if (g.rel) { relArrive(f); return; }
          if (clear(st.x, f.y, SIT_H + 4) && Math.random() < 0.7) { st.mode = 'sit'; st.idleUntil = t + 10 + Math.random() * 20; }
          else { st.mode = 'idle'; st.idleUntil = t + 2 + Math.random() * 3; }
          return;
        }
        st.dir = Math.sign(g.x - st.x) || st.dir;
      } else if (g.f.y < f.y - 4) {   // above him
        const dh = f.y - g.f.y, under = st.x > g.f.x1 + HALF_W && st.x < g.f.x2 - HALF_W;
        if (dh > CFG.size * 2.2) {   // too high in one go: climb the highest thing he can reach from here, a stepping stone toward it
          const reach = CFG.size * 2.2; let q = null;
          for (const c of floors) if (c !== f && !c.ground && c.y < f.y - 8 && c.y >= f.y - reach && st.x > c.x1 + HALF_W && st.x < c.x2 - HALF_W && (!q || c.y < q.y)) q = c;
          if (q) { st.mode = 'prep'; st.prep = { f: q, dh: f.y - q.y, until: t + 0.18 + Math.random() * 0.14, climb: f.y - q.y > CFG.size * 1.2 }; st.amt = 0; return; }
          let nb = null;   // none right above him: walk to the nearest one he could climb, then climb it
          for (const c of floors) if (c !== f && !c.ground && c.y < f.y - 8 && c.y >= f.y - reach && c.x2 - c.x1 > 2 * HALF_W + 24 && (!nb || Math.min(Math.abs(st.x - c.x1), Math.abs(st.x - c.x2)) < Math.min(Math.abs(st.x - nb.x1), Math.abs(st.x - nb.x2)))) nb = c;
          if (nb && !g.rel) { st.goal = { f: nb, x: Math.max(nb.x1 + HALF_W + 10, Math.min(nb.x2 - HALF_W - 10, st.x)), until: t + 30, mind: 'step up' }; return; }
          st.goal = null; if (g.rel) relEnd('fail'); missed('too high');   // nothing to step up on
        }
        else if (under) { st.mode = 'prep'; st.prep = { f: g.f, dh, until: t + 0.18 + Math.random() * 0.14, climb: dh > CFG.size * 1.2 }; st.amt = 0; return; }   // wind up first
        else st.dir = Math.sign(Math.max(g.f.x1 + HALF_W + 6, Math.min(g.f.x2 - HALF_W - 6, st.x)) - st.x) || st.dir;
      } else {   // below him: head for the edge of this floor nearest to it and step off
        const tx = g.x > f.x1 && g.x < f.x2 ? (g.x - f.x1 < f.x2 - g.x ? f.x1 - 20 : f.x2 + 20) : g.x;
        st.dir = Math.sign(tx - st.x) || st.dir;
      }
    }
    if (!st.goal && !st.relBusy && st.amt > 0.5 && Math.random() < dt / 7) { st.mode = 'idle'; st.idleUntil = t + 2 + Math.random() * 6; return; }   // stops for no reason at all
    if (st.relOrder && st.relOrder.ex === 'stalk') { const d = window.__scion; if (d && d.face === Math.sign(st.x - d.x)) { st.amt = Math.max(0, st.amt - dt * 8); return; } }   // it is looking: freeze
    const go = 0.35 + 0.65 * st.amt;   // he eases into and out of his stride
    const k = (st.spdK || 1) * (window.REL ? window.REL.body('hugo').speedK : 1) * (st.carrying ? 0.7 : 1);   // a run, a creep, a sore leg, a bird in hand
    const nx = st.x + st.dir * walkSpeed() * go * dt * k;
    const past = st.dir > 0 ? nx + HALF_W * 0.4 > f.x2 : nx - HALF_W * 0.4 < f.x1;
    if (past) {   // a ledge: sit on it with his legs over, peer down, step off, or turn back
      const r = Math.random();
      if (!st.goal && !st.relBusy && r < 0.3 && clear(st.x, f.y, SIT_H + 4)) { st.mode = 'sit'; st.idleUntil = t + 6 + Math.random() * 14; return; }
      if (!st.goal && !st.relBusy && r < 0.5) { st.mode = 'idle'; st.idleUntil = t + 2 + Math.random() * 2; gest = { name: 'peer', t0: t, dur: 2 + Math.random() * 2, side: st.dir, amp: 1, f: 1 }; st.dir = -st.dir; return; }
      if (dropTo(nx, f.y)) { st.air = true; st.hop = true; st.vx = st.dir * (phone() ? 20 : walkSpeed() * 0.8); st.vy = -160; st.x = nx; return; }   // phones: nearly straight down, onto the ledge he looked at, not past it
      st.dir = -st.dir; st.mode = 'idle'; st.idleUntil = t + 0.8 + Math.random() * 1.5; return;
    }
    if (clear(nx + st.dir * 10, f.y, CFG.size + 4)) { st.x = nx; st.ph += dt * sty.cadence * go * k; st.amt = Math.min(1, st.amt + dt * 2.2); }   // legs keep pace, so feet never slide
    else if (!st.relBusy && clear(nx + st.dir * 10, f.y, CRAWL_H + 4) && clear(st.x, f.y, CRAWL_H + 4) && !walls.some(w => w.crawl && w.f === f && w.dir === st.dir && t - w.t < 30)) { st.mode = 'crawl'; st.crawlT = t; st.amt = 0; }   // too low to walk under, room to crawl: down on his hands and knees
    else {
      st.amt = Math.max(0, st.amt - dt * 4);
      if (st.amt === 0) blocked(f);
    }
  } else if (st.mode === 'prep') {   // knees bend, arms swing back: the wind-up before a jump
    if ((st.sitK || 0) > 0.04) { st.prep.until += dt; if (st.prep.t0 != null) st.prep.t0 += dt; return; }   // on his feet first
    if (t > st.prep.until) {
      const P = st.prep;
      if (P.pounce) { const dx = P.pounce.x - st.x; st.air = true; st.hop = true; st.pounce = P.pounce; st.floor = null; st.dir = Math.sign(dx) || st.dir; st.vx = Math.sign(dx) * Math.min(260, Math.abs(dx) * 1.9); st.vy = -380; st.mode = 'walk'; return; }
      // P.over: the top of the thing in front of him, not a ledge overhead: the hop carries him across onto it
      if (!P.climb) { st.air = true; st.hop = true; st.floor = null; st.vy = -Math.sqrt(2 * G * (P.dh + 26)); st.mode = 'walk';
        st.vx = P.over != null ? (P.over - st.x) / (Math.sqrt(2 * (P.dh + 26) / G) + Math.sqrt(52 / G)) : st.dir * 40; }
      else { st.mode = 'climb'; st.floor = null; st.climb = { f: P.f, t0: t, y0: st.y, x0: st.x, xTo: P.over, hang: 0.25 + Math.random() * 0.35, pull: 0.75 + Math.random() * 0.35 }; }
    }
  } else if (st.mode === 'crawl') {   // on hands and knees under something too low to stand in, until there is room again
    if ((st.crawlK || 0) < 0.9) return;   // still getting down
    const k = (window.REL ? window.REL.body('hugo').speedK : 1), nx = st.x + st.dir * walkSpeed() * 0.3 * dt * k;
    if (clear(st.x, f.y, CFG.size + 4) && clear(st.x + st.dir * 14, f.y, CFG.size + 4) && t - st.crawlT > 0.6) { st.mode = 'walk'; return; }   // headroom here and ahead: out the other side, he stands up
    const past = st.dir > 0 ? nx + HALF_W * 0.4 > f.x2 : nx - HALF_W * 0.4 < f.x1;
    if (past) { if (dropTo(nx, f.y)) { st.air = true; st.hop = true; st.vx = st.dir * 60; st.vy = -60; st.x = nx; st.mode = 'walk'; } else st.dir = -st.dir; return; }
    if (clear(nx + st.dir * 10, f.y, CRAWL_H + 4)) { st.x = nx; st.ph += dt * 0.85 * k; }
    else { walls.push({ f, dir: st.dir, t, crawl: true }); st.dir = -st.dir; st.crawlT = t; poke('a dead end, even crawling'); missed('dead end'); }   // remembered, so he does not crawl straight back in   // too tight even on all fours: back out the way he came
  } else if (st.mode === 'idle') { st.amt = Math.max(0, st.amt - dt * 4); if (t > st.idleUntil) { st.mode = 'walk'; restyle(); } }
  else if (st.mode === 'sit') {
    st.swingV += (-st.swing * 9 - st.swingV * 1.6) * dt; st.swing += st.swingV * dt;
    if (!st.dead && Math.random() < dt / 6) st.swingV += 2;
    if (t > st.idleUntil) { st.mode = 'walk'; if (Math.random() < 0.5) st.dir = -st.dir; }
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  // Real time, up to a quarter second per frame: on a slow page (a busy machine draws a few frames a second) he keeps
  // living at the right speed, and in step with REL's clock, instead of moving in slow motion. Physics runs in 50 ms slices.
  const dt = Math.min((now - last) / 1000, 0.25); last = now; t += dt;
  // not on every scroll frame, and not mid-scroll at all (a full-page layout read then stutters the scroll), unless very stale
  if ((now - scrolledAt > 250 && ((dirty && now - scanAt > 400) || now - scanAt > 2500)) || now - scanAt > 6000) scan();
  if (!st.floor && !st.air && !st.held && st.mode !== 'climb') { if (!born()) { canvas.style.visibility = 'hidden'; return; } }
  if (window.REL) {   // H10: what REL's contact did to him; he animates it himself
    const hb = window.REL.body('hugo'); st.dazed = hb.dazed > 0; st.carrying = window.REL.body('dove').heldBy === 'hugo';
    if (hb.hits !== st.hitsSeen) {
      st.hitsSeen = hb.hits; const s = hb.lastHit ? hb.lastHit.sev : 0.3, d = window.__scion;
      st.shaken = Math.max(st.shaken || 0, s); st.stress = Math.min(1, (st.stress || 0) + 0.3 * s);
      if (phone() && st.floor && !st.held && st.mode !== 'climb') {   // phones: his ledges are narrow; a hit is a flinch where he stands, never a fall off it
        relEnd('interrupted'); st.prep = null; st.goal = null; st.mode = 'idle'; st.amt = 0; st.land = 0.25; st.idleUntil = t + 1 + s * 2;
        gest = { name: s > 0.5 ? 'cover' : 'rub', t0: t, dur: 1 + s * 2, side: Math.sign((d ? d.x : st.x + st.dir) - st.x) || 1, amp: 1, f: 1 };
      } else if (st.floor && !st.held && st.mode !== 'climb') {   // knocked back a step, off his feet if it was a hard one; whatever he was winding up for is off
        relEnd('interrupted'); st.prep = null; st.air = true; st.hop = s < 0.4; st.floor = null; st.mode = 'walk'; st.vx = -(Math.sign((d ? d.x : st.x + st.dir) - st.x) || 1) * 80 * s; st.vy = -150;
      }
    }
  }
  if (st.dead && st.floor && !st.held && !st.air && st.mode !== 'climb') { st.goal = null; st.amt = 0; st.idleUntil = t + 1; st.mode = clear(st.x, st.floor.y, SIT_H + 4) ? 'sit' : 'idle'; }   // he can still fall or be carried
  if (!reduced) { for (let r = dt; r > 1e-6; r -= 0.05) step(Math.min(0.05, r)); } else st.mode = 'idle';
  { const goal = st.mode === 'sit' && !st.held && !st.air ? 1 : 0;
    if (st.held || st.air || st.mode === 'climb') st.sitK = 0;
    else { const k0 = st.sitK || 0, rate = dt / (goal ? 0.8 : 0.7); st.sitK = goal > k0 ? Math.min(goal, k0 + rate) : Math.max(goal, k0 - rate); } }
  const sitE = (st.sitK || 0) * (st.sitK || 0) * (3 - 2 * (st.sitK || 0));
  { const goal = st.mode === 'crawl' && !st.held && !st.air ? 1 : 0;   // down onto his hands and knees, or back up
    if (st.held || st.air || st.mode === 'climb') st.crawlK = 0;
    else { const k0 = st.crawlK || 0, rate = dt / 0.45; st.crawlK = goal > k0 ? Math.min(goal, k0 + rate) : Math.max(goal, k0 - rate); } }
  const crawlE = (st.crawlK || 0) * (st.crawlK || 0) * (3 - 2 * (st.crawlK || 0));
  st.look = look; st.gestName = gest ? gest.name : null; st.headH = Math.min(CFG.size + (SIT_H - CFG.size) * sitE, CFG.size + (CRAWL_H - CFG.size) * crawlE);   // H1: what the dove and REL read off him
  st.vxw = st.mode === 'walk' && !st.air ? (st.amt < 0.05 ? 0 : 1) * st.dir * walkSpeed() * (0.35 + 0.65 * st.amt) * (st.spdK || 1) : st.vx;
  const sy = st.y - scrollY;
  if (sy < -CFG.size - 40 || sy > innerHeight + 60) { canvas.style.visibility = 'hidden'; hit.style.display = 'none'; hud.style.opacity = 0; return; }   // alive, just not in view
  // phones: a jump or fall across words fades him out, so he never covers text or takes its taps
  const over = phone() && !st.held && textInk.some(q => q.r > st.x - HALF_W && q.l < st.x + HALF_W && q.b > st.y - (st.air ? CFG.size : st.mode === 'sit' ? SIT_H : st.mode === 'crawl' ? CRAWL_H : CFG.size) && q.t < st.y - 2);   // his body as it is now: sitting or crawling he is shorter
  st.overN = over ? Math.min(6, (st.overN || 0) + 1) : Math.max(0, (st.overN || 0) - 1);   // a few frames either way before he fades, so a word grazing his edge does not leave him flickering half-seen
  const overText = over ? st.overN >= 4 || !!st.faded : st.overN > 2 && !!st.faded; st.faded = overText;
  canvas.style.opacity = overText ? '0' : '';
  if (overText) { hit.style.display = 'none'; hud.style.opacity = 0; } else hit.style.display = '';
  hit.style.transform = `translate3d(${Math.round(st.x - scrollX - HALF_W)}px,${Math.round(sy - CFG.size)}px,0)`;
  if ((st.hover || st.held) && !phone()) {   // phones: the readout covered the page and ran off the edge
    hud.style.opacity = 1; hud.style.transform = `translate(${Math.round(st.x - scrollX + HALF_W + 10)}px,${Math.round(sy - CFG.size)}px)`;
    const spd = Math.hypot(st.vx, st.vy);
    hud.textContent = `hugo · ${st.held ? `held by the ${st.flip ? 'legs' : st.grip > 0.7 ? 'head' : 'body'} · ${(st.stress || 0) < 0.2 ? 'calm' : (st.stress || 0) < 0.45 ? 'uneasy' : (st.stress || 0) < 0.72 ? 'scared' : 'panicking'}` : st.air ? 'falling' : st.mode}\nv ${(spd / 100).toFixed(2)} m/s   tilt ${(st.tilt * 57.3).toFixed(0)}°\narm ${(limbs.armL[0] * 57.3).toFixed(0)}°/${(limbs.armR[0] * 57.3).toFixed(0)}°   leg ${(limbs.thighL[0] * 57.3).toFixed(0)}°/${(limbs.thighR[0] * 57.3).toFixed(0)}°${window.REL ? '\nwith the dove: ' + window.REL.describe('hugo') : ''}\n${st.held ? 'let go to drop · flick to toss' : 'press to pick up'}`;
  } else hud.style.opacity = 0;
  if (Math.random() < dt / 4) lookGoal = (Math.random() - 0.5) * 1.1;
  if (st.relOrder && st.relOrder.look != null && !gest) lookGoal = st.relOrder.look;
  look += (lookGoal - look) * Math.min(1, dt * 2.5);
  if (st.held || (st.air && !st.hop)) { poseRag(); inner.position.copy(feet).multiplyScalar(-S); }   // in your hand: physics only, limbs swing with how you move him
  else if (st.air) { poseHop(st.vy); inner.position.copy(feet).multiplyScalar(-S); }   // his own jump: tucked, arms out for balance
  else if (st.mode === 'prep') { posePrep(st.prep.t0 != null ? (t - st.prep.t0) / (st.prep.until - st.prep.t0) : (t - (st.prep.until - 0.25)) / 0.25); inner.position.copy(feet).multiplyScalar(-S); }
  else if (st.mode === 'climb') { poseClimb(st.climb); inner.position.copy(feet).multiplyScalar(-S); }
  else if (sitE > 0.999) { poseLean = 0; poseSit(st.swing); inner.position.copy(seat).multiplyScalar(-S); }
  else if (sitE > 0.001) { poseSitting(sitE); inner.position.lerpVectors(feet, seat, sitE).multiplyScalar(-S); }   // on his way down or up
  else if (crawlE > 0.001) { poseLean = 0; poseCrawl(st.ph, crawlE); inner.position.lerpVectors(feet, hip, crawlE).multiplyScalar(-S); }   // on all fours, pivoting at the hips
  else { poseLean = 0; poseStand(st.ph, st.land > 0 ? 0 : st.amt); if (st.land > 0) { rot(B.thighL, -0.45); rot(B.thighR, -0.45); rot(B.shinL, 0.8); rot(B.shinR, 0.8); }
    if (st.crouch > 0) { mix(B.thighL, -0.45, 0, 0, st.crouch); mix(B.thighR, -0.45, 0, 0, st.crouch); mix(B.shinL, 0.8, 0, 0, st.crouch); mix(B.shinR, 0.8, 0, 0, st.crouch); mix(B.chest, 0.35, 0, 0, st.crouch); }   // low, creeping
    inner.position.copy(feet).multiplyScalar(-S); }
  // hovering: he looks at the pointer
  if (st.hover && !st.held) { const dx = (st.px || st.x) - st.x; lookGoal = Math.max(-0.9, Math.min(0.9, dx / 200)); }
  if ((st.watch || 0) > t && pointer.in && !st.held) { st.interest = { x: pointer.cx + scrollX, y: pointer.cy + scrollY, what: 'cursor' }; lookGoal = Math.max(-0.9, Math.min(0.9, (st.interest.x - st.x) / 200)); }   // his mind chose to watch it: his eyes follow it
  { const d = window.__scion; if (d && !st.held && Math.hypot(d.x - st.x, d.y - st.y) < CFG.size * 4 && Math.random() < dt * 0.8) lookGoal = Math.max(-1, Math.min(1, (d.x - st.x) / 200)); }   // glances at the dove
  rot(B.head, -0.05 + Math.sin(t * 0.7) * 0.03, look + (st.mode === 'walk' && !st.air ? 0 : -0.2 * st.dir), 0);
  rot(B.chest, Math.sin(t * 1.6) * 0.015 + (st.mode === 'walk' ? sty.lean * st.amt : 0) + (sitE > 0.001 && sitE < 0.999 ? poseLean : 0));
  if (crawlE > 0.001) { mix(B.head, -PITCH * 0.8, 0, 0, crawlE); mix(B.chest, 0, 0, 0, crawlE); }   // on all fours he still looks where he is going
  const midSit = sitE > 0.02 && sitE < 0.97;   // no gestures while he is getting down or up
  // The hold is ending (REL decided lift or throw): that takes his arms at once, whatever he was doing with them.
  if (st.carrying && !st.held && !st.air && window.REL) { const rk = window.REL.body('dove').releasing;
    if (rk && (!gest || gest.name !== rk)) { const d = window.__scion; gest = { name: rk, t0: t, dur: 1.1, windup: rk === 'throw' ? 0.5 : 0, side: Math.sign((d ? d.x : st.x + st.dir) - st.x) || st.dir, amp: 1, f: 1 }; if (st.mode === 'walk') { st.mode = 'idle'; st.idleUntil = t + 1.2; } } }
  st.throwing = !!(gest && (gest.name === 'throw' || gest.name === 'lift'));   // letting the bird go: plays to the end, and he stands for it
  if (!st.held && !st.air) gesture(dt, st.mode === 'sit' && sitE > 0.97, st.throwing || (!midSit && (st.mode === 'idle' || st.mode === 'sit' || (st.mode === 'walk' && st.amt < 0.05))));
  if (st.carrying && !st.held && !st.air && !(gest && (gest.name === 'throw' || gest.name === 'lift'))) {   // H9: the bird in his hands
    const d = window.__scion, sd = Math.sign((d ? d.x : st.x + st.dir) - st.x) || st.dir, kind = window.REL ? window.REL.body('dove').holdKind : null;
    if (kind === 'cradle') { const b = Math.sin(t * 2.2) * 0.04; armMix('L', [0.15, -0.55, 0.7], [-0.75, 0.25 + b, 0.55], 1); armMix('R', [0.15, -0.55, 0.7], [-0.75, 0.25 - b, 0.55], 1); lookGoal = sd * 0.3; mix(B.head, 0.3, 0, 0, 1); }   // cradled, looking down at it
    else armMix((sd > 0) === (st.dir > 0) ? 'R' : 'L', [0.3, -0.1, 0.9], [0.2, 0.2, 1], 1);   // held out at arm's length
  }
  applyPose(dt, st.held || st.air ? 30 : 12); applyArms(dt, st.held || st.air ? 30 : 10);
  const yawGoal = st.mode === 'climb' ? Math.PI : crawlE > 0.3 ? (st.dir > 0 ? Math.PI / 2 : -Math.PI / 2) :(st.mode === 'sit' || sitE > 0.5) && !st.air ? -0.35 : st.dir > 0 ? Math.PI / 2 - 0.45 : -Math.PI / 2 + 0.45;
  let dyaw = yawGoal - (st.yaw ?? yawGoal); dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
  st.yaw = (st.yaw ?? yawGoal) + dyaw * Math.min(1, dt * 7); inner.rotation.y = st.yaw;   // turns take a moment, like a person turning
  const bob = st.mode === 'walk' && !st.air ? (1 - Math.cos(4 * Math.PI * st.ph)) * 0.5 * CFG.size * 0.022 * st.amt : 0;
  const crouch = st.land > 0 ? -st.land * 20 : 0;
  view.rotation.z = st.held || st.air ? -st.tilt : -st.dir * PITCH * crawlE;   // leans into the motion; crawling, his back tips forward over his hands
  view.position.set(st.x - scrollX - innerWidth / 2, innerHeight / 2 - sy + bob + crouch + THIGH * crawlE, 0);
  { const d = window.__scion; let best = null;   // H1: his hand (the one nearer the bird) in page coords
    for (const b of [B.handL || B.foreL, B.handR || B.foreR]) { if (!b) continue; b.getWorldPosition(_hv);
      const x = _hv.x + innerWidth / 2 + scrollX, y = innerHeight / 2 - _hv.y + scrollY;
      if (!best || (d && Math.abs(x - d.x) < Math.abs(best.x - d.x))) best = { x, y }; }
    st.hand = best; }
  // Render only the BOX around him: same camera, cropped with a view offset, and the canvas parked there in page coords.
  const W = pageW;
  const ox = Math.max(0, Math.min(W - BOX, Math.round(st.x - scrollX - BOX / 2))), oy = Math.round(sy - CFG.size * 0.5 - BOX / 2);
  camera.setViewOffset(innerWidth, innerHeight, ox, oy, BOX, BOX);
  canvas.style.transform = `translate3d(${ox + scrollX}px,${oy + scrollY}px,0)`; if (canvas.style.visibility) canvas.style.visibility = '';
  if (say.style.opacity === '1') say.style.transform = `translate(${Math.max(scrollX + 8, Math.min(scrollX + W - 250, st.x - 30))}px,${Math.max(scrollY + 4, st.y - CFG.size - say.offsetHeight - 6)}px)`;   // over his head, kept on screen
  renderer.render(scene, camera);
}
let scrolledAt = 0;
addEventListener('scroll', () => { if (Math.abs(scrollY - curSY) > 120) { lastSY = curSY; jumpAt = performance.now(); } curSY = scrollY; dirty = true; scrolledAt = performance.now(); }, { passive: true });
// the agents rewrite their own transforms every frame: those mutations are not page changes and must not trigger a rescan
new MutationObserver(ms => { if (ms.some(m => m.target !== hit && m.target !== hud && !(m.target.closest && m.target.closest(skipSel)))) dirty = true; }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'open', 'style'] });
requestAnimationFrame(frame);
