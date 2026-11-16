// Hugo, small, living on the page. The page is his physics: every horizontal rule and every box top is a floor he can
// stand on, every line of text and every box is solid, and he never covers a word. He walks the rules, stops at text,
// turns around, sits when boxed in, and now and then drifts to another floor near you.
// Camera matches CSS pixels (1 unit = 1 px on the page plane), the same convention as the dove.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';   // the body is meshopt-compressed (1.43 MB -> 0.24 MB)
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// A second being can live in this same code: void3d.js loads it again as hugo3d.js?being=void (The Void's mascot). He brings his own body
// (ALT.body), his realm (ALT.realm(): the one element whose ledges are his, he is never outside it) and his own world (ALT.world: no
// dove, no bond, no back lane). The scan, the walk, the climbs and the kernel's repertoire are the same code. He alone loads seated.
// Hugo himself: WHO 'hugo', ALT null, ENV the window, O the page scroll, so nothing below changes for him.
const WHO = new URL(import.meta.url).searchParams.get('being') || 'hugo', ALT = WHO === 'hugo' ? null : window.__beings[WHO];
const ENV = ALT ? ALT.world : window;
const O = ALT ? { x: 0, y: 0 } : { get x() { return window.scrollX; }, get y() { return window.scrollY; } };   // page coords = client coords + O (ALT: his realm's own corner, so he scrolls with it wherever it is)
let host = null, ROOF = false;   // ALT: the realm he is in now; ROOF: its top edge is a ceiling (a section), not the ledge he lives on (a list row)
const docW = () => (ALT ? (host ? host.clientWidth : 0) : document.documentElement.clientWidth), docH = () => (ALT ? (host ? host.clientHeight : 0) : document.documentElement.scrollHeight);
const CFG = Object.assign({ size: 150, perspective: 900, glb: 'realms/hugo/hugo.glb', viewTilt: 6, speed: 34, stride: 46 }, ENV.HUGO_CONFIG || {});
const UP = CFG.size * (ALT && matchMedia('(max-width:760px)').matches ? 3.5 : 2.2);   // how high he leaps and climbs in one go (ALT on phones: the sheet's ledges stand further apart)
const K = CFG.size / 150;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;   // no bracing or glancing for visitors who asked for less motion   // px amplitudes scale with his size: the phone's 64 px reads like the desktop's 150
const reduced = /[?&]still/.test(location.search);   // walking is gentle motion; a reduce-motion setting no longer freezes him

const canvas = document.createElement('canvas');
canvas.setAttribute('aria-hidden', 'true');
// A small canvas that lives IN the page (position absolute, page coordinates) and travels with him. The browser scrolls
// it with the content, so he never lags or jumps a frame behind the page the way a full-screen fixed overlay did.
const BOX = Math.round(CFG.size * 2.6);
Object.assign(canvas.style, { position: 'absolute', left: 0, top: 0, width: BOX + 'px', height: BOX + 'px', pointerEvents: 'none', zIndex: 9998, willChange: 'transform', transition: 'opacity .2s' });
// Both agents draw inside one page-sized layer that clips them, so a canvas near the bottom never makes the page taller
// (it did: the page grew, the floor at the bottom moved down, and he kept falling).
const layer = ALT ? Object.assign(document.createElement('div'), { className: 'agent-ui' }) : document.getElementById('agent-layer') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'agent-layer' }));
Object.assign(layer.style, { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, overflow: ALT ? 'visible' : 'clip', pointerEvents: 'none', zIndex: 9998 });
layer.append(canvas);
// One code path for phones and desktop: the same births, floors, drop-ins, ground and lanes; only body size (CFG.size), the
// carousels and the frame scan differ. Read less is a one-screen room: its floor is the screen's bottom edge.
const phoneQ = matchMedia('(max-width:760px)');
const phone = () => phoneQ.matches;
const simple = () => document.body.classList.contains('simple');
const groundY = () => ALT ? docH() - 1 : (simple() ? Math.min(document.documentElement.scrollHeight, innerHeight) : document.documentElement.scrollHeight) - 24;
// a ledge in a side-scrolling row ends at the screen edge, so he never walks off into the part you cannot see
const fit = f => { f.x1 = Math.max(f.x1, 0); f.x2 = Math.min(f.x2, docW()); };
const inView = () => st.y > O.y + 30 && st.y - CFG.size < O.y + innerHeight - 10;   // any of him on screen
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
let dirty = true, pageW = docW();   // cached: a per-frame read after style writes forces a layout
resize(); addEventListener('resize', () => { resize(); dirty = true; pageW = docW(); });
const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-400, 600, 700);
const rim = new THREE.DirectionalLight(0x6a7cff, 4.0); rim.position.set(200, 500, -600);   // from behind and above: a cool edge on the dark page
scene.add(key, rim, new THREE.HemisphereLight(0xffffff, 0xf1ede4, 1.2));

// ---------- body ----------
const alt = ALT ? await ALT.body(THREE) : null;   // { model, B } on this file's bone conventions; pose(): his skinned parts follow, after the springs
const gltf = ALT ? null : await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(CFG.glb);
const model = ALT ? alt.model : gltf.scene;
const skin = new THREE.MeshPhysicalMaterial({ color: 0xd8d4c8, roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color(0xdfe5ff), envMapIntensity: 0.5 });   // a warm off-white: the key light models him, the rim edges him
if (!ALT) model.traverse(o => { if (o.isMesh) { o.material = skin; o.frustumCulled = false; } });
// The skin deforms on the Rigify DEF chain, which sits beside the ORG bones in this export, so pose DEF directly.
const bone = re => { let b = null; model.traverse(o => { if (!b && o.isBone && re.test(o.name)) b = o; }); return b; };
const B = ALT ? alt.B : {
  thighL: bone(/^DEF-thigh.?L_/), thighR: bone(/^DEF-thigh.?R_/), shinL: bone(/^DEF-shin.?L_/), shinR: bone(/^DEF-shin.?R_/),
  armL: bone(/^DEF-upper_arm.?L_/), armR: bone(/^DEF-upper_arm.?R_/), foreL: bone(/^DEF-forearm.?L_/), foreR: bone(/^DEF-forearm.?R_/),
  head: bone(/^DEF-spine.?00[456]_/), chest: bone(/^DEF-spine.?002_/), hips: bone(/^DEF-spine_/), handL: bone(/^DEF-hand.?L_/), handR: bone(/^DEF-hand.?R_/),
};   // hips: the spine root; the DEF chain above it is the torso and head skin, the legs hang from ORG-spine, so a pelvis roll never moves a foot
const rest = new Map(); for (const b of Object.values(B)) if (b) rest.set(b, b.quaternion.clone());
// Poses write targets; applyPose eases every joint toward them, so he flows between walking, sitting and gestures.
const tgt = new Map(), cur = new Map(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const rot = (b, x, y = 0, z = 0) => { if (b) tgt.set(b, [x, y, z]); };
const mix = (b, x, y, z, w) => { if (!b || w <= 0) return; const T = tgt.get(b) || [0, 0, 0]; tgt.set(b, [T[0] + (x - T[0]) * w, T[1] + (y - T[1]) * w, T[2] + (z - T[2]) * w]); };
// Overlap: every joint is a damped spring with its own rate (Juckett's closed form: exact at any dt, so a 4 fps frame never
// explodes). The head is loose (it lags the chest and overshoots), the chest firm, the legs stiff; held or airborne he is rigid.
function springK(w, z, dt) { z = Math.min(z, 0.999); const wz = w * z, al = w * Math.sqrt(1 - z * z), ex = Math.exp(-wz * dt), c = Math.cos(al * dt), s = Math.sin(al * dt), es = ex * s / al, ezs = ex * wz * s / al;
  return [ex * c + ezs, es, -es * al * al - wz * ezs, ex * c - ezs]; }   // [pos<-pos, pos<-vel, vel<-pos, vel<-vel]
const RATE = new Map([[B.head, [18, 0.35]], [B.chest, [22, 0.7]], [B.hips, [22, 0.7]], [B.thighL, [28, 0.8]], [B.thighR, [28, 0.8]], [B.shinL, [30, 0.8]], [B.shinR, [30, 0.8]]]);
function applyPose(dt, stiff) {
  for (const [b, T] of tgt) {
    let C = cur.get(b); if (!C) cur.set(b, C = [...T, 0, 0, 0]);   // angle x3, angular velocity x3
    const [w, z] = stiff ? [40, 1] : RATE.get(b) || [20, 0.7], [pp, pv, vp, vv] = springK(w, z, dt);
    for (let i = 0; i < 3; i++) { const p = C[i] - T[i], v = C[i + 3]; C[i] = p * pp + v * pv + T[i]; C[i + 3] = p * vp + v * vv; }
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
function applyArms(dt, stiff) {
  if (!BODY) return;
  const KU = springK(...(stiff ? [40, 1] : [14, 0.4]), dt), KF = springK(...(stiff ? [40, 1] : [12, 0.35]), dt);
  for (const side of ['L', 'R']) {
    const T = ARM[side], sx = side === 'L' ? 1 : -1;
    let C = armCur[side]; if (!C) C = armCur[side] = { u: T.u.slice(), f: T.f.slice(), vu: [0, 0, 0], vf: [0, 0, 0] };
    for (const key of ['u', 'f']) { const [pp, pv, vp, vv] = key === 'u' ? KU : KF, V = C['v' + key]; for (let i = 0; i < 3; i++) { const p = C[key][i] - T[key][i], v = V[i]; C[key][i] = p * pp + v * pv + T[key][i]; V[i] = p * vp + v * vv; } }
    const toModel = v => new THREE.Vector3().addScaledVector(BODY.left, v[0] * sx).addScaledVector(BODY.up, v[1]).addScaledVector(BODY.fwd, v[2]).normalize();
    const up = side === 'L' ? B.armL : B.armR, fo = side === 'L' ? B.foreL : B.foreR;
    if (up) { aimBone(up, toModel(C.u)); up.updateMatrixWorld(true); }
    if (fo) aimBone(fo, toModel(C.f));
  }
}
// How he carries himself on this walk: re-rolled every time he sets off, so no two walks look the same.
const sty = { arm: 0.35, hip: 0.38, cadence: 0.9, pockets: false, lean: 0, roll: 0 };
function restyle() { sty.asym = 0.85 + Math.random() * 0.3; sty.arm = 0.18 + Math.random() * 0.3; sty.hip = 0.4 + Math.random() * 0.1; sty.cadence = 0.78 + Math.random() * 0.3; sty.pockets = Math.random() < 0.18; sty.lean = (Math.random() - 0.4) * 0.12; }
// Gait geometry: one full cycle (two steps) covers 2 x step length, step length = 2 * leg * sin(hip swing). Moving the
// body by exactly that per cycle keeps the planted foot from sliding: what read as shuffling was the legs cycling ~3x
// faster than the body moved.
const LEG = CFG.size * 0.47;
const cycleLen = () => 4 * LEG * Math.sin(sty.hip);
const walkSpeed = () => cycleLen() * sty.cadence;   // px/s
const frac = x => x - Math.floor(x);
const bump = (p, c, w) => { const d = frac(p - c + 0.5) - 0.5; return Math.exp(-(d * d) / (2 * w * w)); };
const gait = a => a * a * (3 - 2 * a);   // stride amount -> speed share: he pushes off from a standstill and settles over two steps, never a step change
function poseStand(ph, amt) {          // ph: walk phase 0..1, amt: 0 still .. 1 full stride
  // Per leg, phase 0 = heel strike: hip flexed forward, then extends back through stance, swings forward from ~0.6.
  // Knee: a small give as the foot takes weight (~0.12), a big bend to clear the ground mid-swing (~0.72).
  const leg = p => [-sty.hip * Math.cos(2 * Math.PI * p) * amt, (0.06 + 0.2 * bump(p, 0.12, 0.07) + 1.05 * bump(p, 0.72, 0.1)) * amt + 0.04];
  const [hL, kL] = leg(ph), [hR, kR] = leg(ph + 0.5);
  rot(B.thighL, hL); rot(B.shinL, kL); rot(B.thighR, hR); rot(B.shinR, kR);
  // At rest he is never a mannequin: the weight sits on one leg (contrapposto), shifts to the other every 4-8 s, and sways a little between
  const w0 = 1 - Math.min(1, amt * 3), sd = st.stance || 0, ws = Math.sin(t * 0.9) * 0.5;
  sty.sway = -(sd * 0.04 + ws * 0.04) * w0;   // the chest's counter-roll, written with the chest in frame()
  if (w0 > 0) { const free = sd > 0 ? 'R' : 'L', k = Math.abs(sd) * w0; mix(B['thigh' + free], -0.12, 0, 0, k); mix(B['shin' + free], 0.25, 0, 0, k); }
  const s = -Math.cos(2 * Math.PI * ph) * amt;   // >0 while the left leg is back: the left arm swings forward
  sty.roll = Math.sin(2 * Math.PI * ph) * amt;   // the pelvis drops toward the swing leg and twists with the stride; the chest counters it (frame())
  rot(B.hips, 0, sty.roll * 0.06, sty.roll * 0.08 + (sd * 0.05 + ws * 0.05) * w0);   // standing: the weight on one hip, swaying a little
  const sw = sty.pockets ? 0.05 : sty.arm, tt = performance.now() / 1000, out = sty.pockets ? 0.05 : 0.13;
  // arms swing opposite the legs; a slow drift keeps them from ever looking pinned
  const asym = sty.asym || 1, o2 = out + 0.04 * Math.abs(s);   // the elbow bends as the arm comes forward (a rod no more); the right arm swings a little more or less than the left
  arm('L', [o2 + Math.sin(tt * 0.7) * 0.03, -1, s * sw + Math.sin(tt * 0.9) * 0.04], sty.pockets ? [-0.1, -0.7, 0.45] : [0.04, -1, 0.18 + Math.max(0, s) * sw * 1.6]);
  arm('R', [o2 + Math.sin(tt * 0.6 + 2) * 0.03, -1, -s * sw * asym + Math.sin(tt * 0.8 + 1) * 0.04], sty.pockets ? [-0.1, -0.7, 0.45] : [0.04, -1, 0.18 + Math.max(0, -s) * sw * 1.6 * asym]);
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
    if ((st.hangK || 1) > 1.5) rot(B.head, -0.45);   // a long hang: he looks up at where he is going
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
// Eyes: two dark beads on the front of the head (the glb's head is a featureless sphere, so every look was invisible). The head is
// the sphere from the neck top to the top of the box; the beads sit on its front, a little above centre, and blink from frame().
const skull = (ALT ? null : bone(/^DEF-spine.?006_/)) || B.head, eyes = [];
if (!ALT) { const hp = skull.getWorldPosition(new THREE.Vector3()), hr = (standBox.max.y - hp.y) / 2, hc = hp.clone().addScaledVector(BODY.up, hr), ws = skull.getWorldScale(new THREE.Vector3()).x || 1;
  const mat = new THREE.MeshBasicMaterial({ color: 0x141414 }), at = p => skull.worldToLocal(p.clone());
  for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.SphereGeometry(hr * 0.16 / ws, 10, 8), mat); m.frustumCulled = false; skull.add(m);
    m.position.copy(at(hc.clone().addScaledVector(BODY.fwd, hr * 0.88).addScaledVector(BODY.left, sx * hr * 0.4).addScaledVector(BODY.up, hr * 0.1)));
    m.userData.base = m.position.clone(); m.userData.left = at(hc.clone().add(BODY.left)).sub(at(hc)).multiplyScalar(hr * 0.1); eyes.push(m); } }
let blinkAt = 2, blinkT = 0;
poseSit(0); applyPose(1, true); applyArms(1, true); model.updateMatrixWorld(true);
const seatBox = new THREE.Box3().setFromObject(model, true);
const hipY = B.thighL ? B.thighL.getWorldPosition(new THREE.Vector3()).y : seatBox.min.y + (seatBox.max.y - seatBox.min.y) * 0.45;
const seat = new THREE.Vector3((seatBox.min.x + seatBox.max.x) / 2, hipY - (ALT ? alt.seatDrop : (seatBox.max.y - seatBox.min.y) * 0.06), 0);
const SIT_H = (seatBox.max.y - seat.y) * S, HALF_W = ALT ? Math.round(CFG.size * 0.18) : 26;   // ALT: his own half width
// Crawling, measured off his own skeleton: on hands and knees his thighs and arms hang straight down, so his hips sit
// one thigh above the floor, his shoulders one arm above it, and his back pitches forward until it spans the two.
const _w1 = new THREE.Vector3(), _w2 = new THREE.Vector3();
const blen = (a, b, d) => a && b ? a.getWorldPosition(_w1).distanceTo(b.getWorldPosition(_w2)) * S : d;
const THIGH = blen(B.thighL, B.shinL, CFG.size * 0.24), ARMLEN = blen(B.armL, B.foreL, CFG.size * 0.17) + blen(B.foreL, B.handL, CFG.size * 0.17);
const SPINE = B.thighL && B.armL ? Math.abs(B.armL.getWorldPosition(_w1).y - B.thighL.getWorldPosition(_w2).y) * S : CFG.size * 0.3;
const PITCH = Math.acos(Math.max(0.2, Math.min(0.95, (ARMLEN - THIGH) / SPINE)));   // back's tilt from upright
const hip = new THREE.Vector3(feet.x, hipY, 0);
const CRAWL_H = Math.max(ARMLEN, THIGH + SPINE * Math.cos(PITCH)) + CFG.size * 0.16;   // shoulders plus his head

// Dust: a hard landing (above half the usual fall speed) kicks 3-8 grey motes up from his feet for ~0.4 s (Celeste's landing gate). Points on his own canvas.
const DUST_N = 8, dustPos = new Float32Array(DUST_N * 3).fill(1e5), dust = Array.from({ length: DUST_N }, () => ({ life: 0, vx: 0, vy: 0 }));
const dustPts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(dustPos, 3)), new THREE.PointsMaterial({ color: 0xb4b4b4, size: Math.max(3, 4 * K), sizeAttenuation: false, transparent: true, opacity: 0.45, depthWrite: false }));
dustPts.frustumCulled = false;
function kickDust(x, y, n) { let k = 0; for (const d of dust) { if (d.life > 0 || k >= n) continue; const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.1, v = (60 + Math.random() * 80) * K; d.life = 0.3 + Math.random() * 0.2; d.vx = Math.cos(a) * v; d.vy = -Math.sin(a) * v; d.x = x + (Math.random() - 0.5) * 24 * K; d.y = y - 2; k++; } st.dustN = (st.dustN || 0) + k; }
function stepDust(dt) { let any = false; dust.forEach((d, i) => { if (d.life <= 0) { dustPos[i * 3 + 1] = 1e5; return; } any = true; d.life -= dt; d.vy += 500 * K * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= Math.max(0, 1 - 3 * dt);
  dustPos[i * 3] = d.x - O.x - innerWidth / 2; dustPos[i * 3 + 1] = innerHeight / 2 - (d.y - O.y); dustPos[i * 3 + 2] = 2; }); dustPts.geometry.attributes.position.needsUpdate = true; dustPts.visible = any; }
const view = new THREE.Group(), inner = new THREE.Group();
inner.add(model); inner.scale.setScalar(S); view.add(inner); scene.add(view, dustPts);
view.rotation.x = CFG.viewTilt * Math.PI / 180;

// ---------- the world: floors and solids, in page coordinates ----------
let floors = [], ink = [], textInk = [], seams = [], cards = [], scanAt = 0;   // textInk: lines of text; cards: boxes that hide what is behind them (depth.js)
// Overflow clips (phone carousels): every scanned rect keeps its raw x (u1, u2) and its scroller's box, and shows only the
// part inside it. A swipe shifts the raw x by the scroller's scrollLeft change at once; the next scan re-measures.
const scrollers = new Map();   // scroller element -> { l, r, t, b, sl } in page coords, sl = scrollLeft at the scan
const clipX = q => { const c = q.sc && scrollers.get(q.sc); if (!c) return q;
  const a = Math.max(q.u1, c.l), b = Math.min(q.u2, c.r);
  if ('y' in q) { q.x1 = a; q.x2 = b; } else if (b > a) { q.l = a; q.r = b; } else q.l = q.r = -1e9;   // ink scrolled out of its box is not there
  return q; };
const skipSel = '#scion-hud,#scion-say,#scion-ask,#scion-dove,#hugo-hit,#hugo-hud,#agent-layer,script,style,svg,canvas,nav:not(.mindex),.agent-ui' + (ALT ? '' : ',.msheet');   // .msheet: the phone sheet is invisible until opened; .mindex: the phone project list is content, not chrome (hidden on desktop)
// phones: faded-out layers (a view mid-switch, a panel at opacity 0) are not there for him
const hidden = e => (e.checkVisibility ? !e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : false) || covered(e);
// ...and so is anything another layer sits on top of (checked at its top edge and centre; off screen it cannot be judged, so it counts)
const covered = e => { const r = e.getBoundingClientRect(), d = e.ownerDocument, cx = (r.left + r.right) / 2;
  const hits = [d.elementFromPoint(cx, r.top + Math.min(4, r.height / 2)), d.elementFromPoint(cx, (r.top + r.bottom) / 2)].filter(h => h && !h.closest(skipSel));   // the agents' own layers (the dove's grab box on the name) cover nothing: with them the name's ledges vanished while the dove perched there and he was born off screen, seconds late
  return hits.length > 0 && !hits.some(h => e.contains(h)); };
function scan() {
  if (ALT && !host) return;
  floors = []; ink = []; textInk = []; seams = []; cards = []; scrollers.clear();
  const vh = innerHeight, near = r => r.bottom > -vh * 1.5 && r.top < vh * 2.5, memo = new Map();
  // Read less: the page is one frame (OS.dc.html), so its cards, monitor and words are his world, not a solid wall.
  const os = !ALT && simple() && document.querySelector('#os iframe');
  let od = null; try { od = os && os.contentDocument && os.contentDocument.body; } catch {}
  const pass = (root, fr) => {
    const fo = fr ? fr.getBoundingClientRect() : null, ox = O.x + (fo ? fo.left : 0), oy = O.y + (fo ? fo.top : 0), view = fr && fr.contentWindow;
    const clipFor = n => { const sc = ENV.DEPTH ? ENV.DEPTH.clipOf(n, memo) : null;
      if (sc && !scrollers.has(sc)) { const r = sc.getBoundingClientRect(); scrollers.set(sc, { l: r.left + ox, r: r.right + ox, t: r.top + oy, b: r.bottom + oy, sl: sc.scrollLeft }); }
      return sc; };
    const add = (arr, q, sc) => {   // only the part its scroller shows; vertically outside it: not there at all
      if (sc) { const c = scrollers.get(sc), fl = 'y' in q; if ((fl ? q.y : q.b) < c.t - 1 || (fl ? q.y : q.t) > c.b + 1) return null; q.sc = sc; q.u1 = fl ? q.x1 : q.l; q.u2 = fl ? q.x2 : q.r; clipX(q); }
      arr.push(q); return q; };
    for (const e of root.querySelectorAll('*')) {
      if (e.closest(skipSel)) continue;
      const r = e.getBoundingClientRect(); if (!near(fo ? { top: r.top + fo.top, bottom: r.bottom + fo.top } : r) || r.width < 160 || (fr && (r.top >= view.innerHeight || r.bottom <= 0))) continue;   // in the frame: only what its window shows
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || (phone() && hidden(e))) continue;
      const bt = parseFloat(cs.borderTopWidth), bb = parseFloat(cs.borderBottomWidth);
      const boxed = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || e.tagName === 'IMG' || e.tagName === 'IFRAME';
      const card = boxed || (bt > 0 && bb > 0 && parseFloat(cs.borderLeftWidth) > 0 && parseFloat(cs.borderRightWidth) > 0);   // a box, not a rule
      const wrapper = od && (fr ? r.width > view.innerWidth - 4 && r.height > view.innerHeight * 0.8 : e.contains(os));   // the frame and its page-sized wrappers: not walls, and their edge-to-edge tops are traps, not ledges
      const sc = clipFor(e);
      // A 1px rule with nothing behind it is a seam, not a shelf: no standing on it (support:false), food falls past it too.
      if ((bt > 0 || boxed) && !wrapper) { const sup = support({ card, bt }); add(sup ? floors : seams, { y: r.top + oy, x1: r.left + ox, x2: r.right + ox, el: e, fr, support: sup, box: boxed }, sc); }
      if (bb > 0 && !wrapper) { const sup = support({ card, bt: bb }); add(sup ? floors : seams, { y: r.bottom + oy, x1: r.left + ox, x2: r.right + ox, el: e, fr, support: sup }, sc); }
      if (!ALT && card && r.height > 30 && !wrapper && r.width < pageW * 0.9) add(cards, { l: r.left + ox, t: r.top + oy, r: r.right + ox, b: r.bottom + oy }, sc);   // what hides the back lane
      if (boxed && r.height > 30 && !wrapper) add(ink, { l: r.left + ox, t: r.top + oy, r: r.right + ox, b: (fr ? Math.min(r.bottom, view.innerHeight) : r.bottom) + oy }, sc);   // boxes are solid
    }
    const walk = (fr ? fr.contentDocument : document).createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n =>
      n.textContent.trim() && !n.parentElement.closest(skipSel) && !(phone() && hidden(n.parentElement)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    for (let n; (n = walk.nextNode());) {
      const range = n.ownerDocument.createRange(); range.selectNodeContents(n);
      const pe = n.parentElement, cap = !fr && ENV.DEPTH ? ENV.DEPTH.inkInset(pe, n.textContent) : 0, name = !fr && !!pe.closest('#mast h1');   // a text ledge is the tops of its letters, not the line box (depth.js inkInset)
      const sc = clipFor(n);
      // Only the big headings (h1/h2, 28px+ type) are ledges; body text, labels and captions are ink he walks in front of, never on
      const ledge = support({ text: true, heading: !!pe.closest('h1,h2'), fontSize: parseFloat(getComputedStyle(pe).fontSize) });
      const runsL = ledge && !fr && ENV.DEPTH && ENV.DEPTH.inkRuns ? ENV.DEPTH.inkRuns(pe, n) : null;   // the ledge's heightmap: per character ink tops, by client rect index
      for (const [li, r] of [...range.getClientRects()].entries()) if (r.width > 0 && near(fo ? { top: r.top + fo.top, bottom: r.bottom + fo.top } : r)) {
        const runs = runsL && runsL[li] ? runsL[li].map(u => ({ x1: r.left + ox + u.x1, x2: r.left + ox + u.x2, top: r.top + oy + u.top })) : null;
        const q = add(ink, { l: r.left + ox, t: r.top + oy + cap, r: r.right + ox, b: r.bottom + oy, runs, hd: ledge, soft: !!ALT && (ledge || parseFloat(getComputedStyle(pe).fontSize) <= 13) }, sc); if (!q) continue;
        textInk.push(q);
        if (ledge && (r.width > 120 || name)) add(floors, { y: r.top + oy + cap, x1: r.left + ox, x2: r.right + ox, el: pe, text: true, fr, name, support: true, runs, elTop: pe.getBoundingClientRect().top + oy }, sc);   // elTop now: set later, a shift in between was lost and the ledge sat px off its own line
      }
    }
  };
  pass(ALT ? ALT.root(host) : document.body, null);
  // The nav sits over the page on both renders (sticky/fixed at the top, above the agents' layer): a ceiling nothing stands under.
  // Its wall is kept in viewport space (frame() moves it with every scroll), never a stale page-coordinate snapshot.
  const bar = document.querySelector('nav[aria-label="Sections"]'); barInk = null;
  if (bar && !ALT) { const r = bar.getBoundingClientRect(); if (r.height) ink.push(barInk = { l: 0, t: O.y - 400, r: pageW, b: O.y + r.bottom, h: r.bottom, bar: true }); }
  if (od) pass(od, os);
  if (ALT) { const mine = f => f.el === host || host.contains(f.el); floors = floors.filter(mine); seams = seams.filter(mine);   // only his realm's own ledges exist for him
    if (ROOF && parseFloat(getComputedStyle(host).paddingBottom) >= CFG.size + 6) floors.push({ y: groundY(), x1: 0, x2: docW(), el: host, ground: true, support: true }); }   // and its bottom edge, where that has standing room
  else floors.push({ y: groundY(), x1: 0, x2: document.documentElement.scrollWidth, el: document.body, ground: true, support: true });   // the page bottom; Read less: the screen's bottom edge (a one-screen room has a solid floor)
  floors.forEach(fit); seams.forEach(fit);   // only ledges with standing room somewhere along them (no climbing into a gap and crawling there)
  floors = floors.filter(f => f.ground || f.name || f.x2 - f.x1 < 2 * HALF_W || [0, 1, 2, 3, 4, 5, 6, 7, 8].some(i => clear(f.x1 + HALF_W + (f.x2 - f.x1 - 2 * HALF_W) * i / 8, f.y, CFG.size + 4)));
  // The back lane's own floor: each section's bottom edge (support:false, so food never settles there)
  const secs = ENV.DEPTH ? ENV.DEPTH.sections : [];
  secs.forEach((sec, i) => { if (sec.top + sec.h < O.y - vh * 1.5 || sec.top + sec.h > O.y + vh * 2.5) return;
    const q = { y: sec.top + sec.h, x1: 0, x2: pageW, el: secs[i + 1] ? secs[i + 1].el : sec.el, support: false, section: true }; fit(q); seams.push(q); });   // el: the edge it is glued to (the next section's top)
  allFloors = floors.concat(seams);
  // A rescan makes new floor objects; he, his goal and his route stay on the ones they were on (same element, same edge), or a goal on
  // his own floor reads as a twin "below him" and he steps off it, and the route graph has no node for where he stands.
  const twin = f => (f && !f.screen && !f.ground && allFloors.find(q => q.el === f.el && Math.abs(q.y - f.y) < 6 && !!q.text === !!f.text && !!q.section === !!f.section)) || f;
  if (st.floor) st.floor = twin(st.floor); if (st.goal) st.goal.f = twin(st.goal.f); if (st.route) for (const n of st.route) n.f = twin(n.f);
  ENV.DEPTH?.publish({ cards, text: textInk, floors, seams });   // one measured scene for both agents (page coords)
  dirty = false; scanAt = performance.now();
}
let allFloors = [], barInk = null;
const support = q => ALT ? (q.text ? q.heading && q.fontSize >= 18 : true) : ENV.DEPTH ? ENV.DEPTH.support(q) : !!(q.card || q.bt >= 2);   // ALT: his realm's furniture is hairlines (the Tech rows), so every rule and box top holds him   // depth.js: boxes, 2px+ rules and big headings only
// Can he occupy this spot? Body box must be clear of every word and box above the floor (standing or sitting height).
// Lane-filtered (Fez rule: collision stays flat 2D, per lane): behind or in front of the content, words and boxes are scenery,
// not walls (only the phone's locked bar still is). z defaults to the lane he is in.
// A text ledge is a heightmap (depth.js inkRuns): under his body the floor is the highest letter top across his width (never one
// serif, never floating over the lowercase); a stretch with no ink under him (a space) has no top, the line's cap top stands in.
const runTop = (runs, x) => { let y = null; for (const u of runs) if (u.x2 > x - HALF_W && u.x1 < x + HALF_W && (y === null || u.top < y)) y = u.top; return y; };
const footY = (f, x) => (f.runs && runTop(f.runs, x)) ?? f.y;
// ALT sits with his shins over the edge: never over body text (a heading's own letters and a box's face are fine), never out of his realm's bottom
const legRoom = (x, y) => !(ROOF && y + CFG.size * 0.3 > docH()) && !textInk.some(q => !q.hd && q.r > x - HALF_W * 0.8 && q.l < x + HALF_W * 0.8 && q.b > y + 3 && q.t < y + CFG.size * 0.3);
const sitRoom = (x, y) => clear(x, y, SIT_H + 4) && (!ALT || legRoom(x, y));
// ALT: a heading or a small label over a ledge (the title over the phone's top, the kicker over the title) is no wall to WALK past: pass()
// lets him through, clear() still decides where he may stop, sit, land for good or be born, and an idle there walks on (stepBody).
let PASS = false;
const pass = (x, y, h, z) => { if (!ALT) return clear(x, y, h, z); PASS = true; try { return clear(x, y, h, z); } finally { PASS = false; } };
const idleSpot = f => { for (let k = 1; k < 200; k++) for (const x of [st.x + k * 6, st.x - k * 6]) if (onFloor(f, x) && clear(x, f.y, CFG.size + 4)) return x; return null; };
const clear = (x, y, h, z = st.z, bar = true) => !(ROOF && y - h < -2) && !ink.some(q => !(PASS && q.soft) && (z === 0 || q.bar) && (bar || !q.bar) && q.r > x - HALF_W && q.l < x + HALF_W && q.b > y - h && (q.runs ? runTop(q.runs, x) ?? q.b : q.t) < y - 2);
// Where he has been: coarse cells with the last time he was there. New places are more interesting than ones he just
// left, so he spreads out instead of wearing a groove into one corner.
const seenAt = new Map(), avoid = new Map();
const cell = (x, y) => `${Math.round(x / 140)}:${Math.round(y / 90)}`;
const novelty = (x, y) => { const l = seenAt.get(cell(x, y)); return l === undefined ? 1 : 1 - Math.exp(-(t - l) / 75); };
function pickFloor(furniture, z = st.z) {   // furniture: anywhere he can stand on purpose (box tops and big headings), never the page bottom; z: the lane it must be clear in
  const top = O.y + 40, bot = O.y + innerHeight - 40, c = [];
  for (const f of floors) {
    if (f.y < top || f.y > bot || f.x2 - f.x1 < 120 || (furniture && f.ground)) continue;
    // sample a few x along the rule; keep the floors that have standing room
    const xs = []; for (let i = 0; i < 9; i++) { const x = f.x1 + HALF_W + 8 + (f.x2 - f.x1 - 2 * HALF_W - 16) * i / 8; if (clear(x, f.y, CFG.size + 4, z)) xs.push(x); }
    if (xs.length) c.push({ f, xs });
  }
  if (!c.length) return null;
  // weighted by novelty: somewhere he has not been for a while is far more likely than where he just was
  const opts = [];
  for (const k of c) { if ((avoid.get(k.f) || 0) > t) continue; for (const x of k.xs) opts.push({ f: k.f, x, w: (0.05 + novelty(x, k.f.y) ** 2 + (Math.abs(x - st.x) + Math.abs(k.f.y - st.y)) / 900) * (Math.sign(x - st.x) === st.dir ? 1.6 : 1) * (k.f.y < st.y - UP ? 0.25 : k.f.y < st.y - 8 ? 1.7 : 1) }); }
  if (!opts.length) return null;
  let r = Math.random() * opts.reduce((a, o) => a + o.w, 0);
  for (const o of opts) if ((r -= o.w) <= 0) return o;
  return opts[opts.length - 1];
}

// Somewhere to stand on purpose: a support with room on the content (lane 0, his home). The back lane is never a place to stand:
// only a transit behind a card (a route's depth link, a wall of words) or a short peek, each with its exit planned.
const pickPlace = () => pickFloor(true, 0);
// ---------- the agent ----------
// He is his own being: he walks the floors, steps off ledges and falls to the next floor, turns at text, sits when boxed in.
// He never teleports and never follows the visitor. Off screen he keeps living; we just do not draw him.
const G = 1400;   // px/s2, page gravity
const st = { z: 0, zs: 0, w: 0.5, lanes: [0], par: 0, hopY: 0, floor: null, x: 0, y: 0, vx: 0, vy: 0, air: false, dir: 1, mode: 'walk', ph: 0, amt: 0, swing: 0, swingV: 0, idleUntil: 0, land: 0,
  ax: 0, held: false, hover: false, px: 0, py: 0, tilt: 0, spdK: 1, crouch: 0, headH: CFG.size, look: 0, gestName: null, vxw: 0, hand: null, hitsSeen: 0, relOrder: null };
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
const STAND = ['look', 'hips', 'scratch', 'cross', 'weight', 'tap', 'look', 'weight', 'curious', 'curious'];   // small texture only: the bigger acts are the kernel's repertoire (autonomy)
const SIT = ['lean', 'chin', 'kick', 'look', 'kick', 'hands', 'curious'];
const forced = new URLSearchParams(location.search).get('pose');
const pickOf = a => a[(Math.random() * a.length) | 0];
let gest = null, gestAt = 0, lastGest = null;
// Things worth a look: the dove, pictures, buttons and links within reach of his eyes.
function interestNear() {
  const d = ENV.__scion, R = CFG.size * 3, here = { x: st.x, y: st.y - CFG.size * 0.6 };
  if (d && Math.hypot(d.x - here.x, d.y - here.y) < R * 1.5 && Math.random() < 0.7) return { x: d.x, y: d.y - 10, what: 'dove' };
  const c = [];
  for (const el of document.querySelectorAll('img, a.ibtn, button, .phone, .monitor, .mrow .th')) {
    const r = el.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
    const x = r.left + r.width / 2 + O.x, y = r.top + r.height / 2 + O.y;
    if (Math.hypot(x - here.x, y - here.y) < R) c.push({ x, y, what: el.tagName.toLowerCase() });
  }
  return c.length ? pickOf(c) : null;
}
function gesture(dt, sitting, still) {
  if (!still) { gest = null; return; }
  if (forced && (!gest || t - gest.t0 > gest.dur)) gest = { name: forced, t0: t, dur: 6, side: 1, amp: 1 };
  const dv = ENV.__scion;
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
  if (!gest && st.pendGest && (sitting || st.pendGest.any)) { gest = { side: 1, amp: 1, f: 1, ...st.pendGest, t0: t }; st.pendGest = null; }   // the nap his mind wanted, once he is down
  if (!gest && t > gestAt && !(st.goal && st.goal.rel) && !st.crouch) {
    if (!inView() || Math.random() > 0.35) { gestAt = t + 0.8; return; }   // off camera nobody sees it (and nothing stale plays on re-entry); on camera a 35% roll per idle loop (Celeste)
    st.interest = interestNear();
    const list = (sitting ? SIT : STAND).filter(n => n !== lastGest);   // never the same act twice running
    gest = { name: list[(Math.random() * list.length) | 0], t0: t, dur: 2.5 + Math.random() * 4.5, side: Math.random() < 0.5 ? -1 : 1, amp: 0.7 + Math.random() * 0.5, f: 0.8 + Math.random() * 0.6 }; lastGest = gest.name;
    ENV.REL?.ev(WHO, 'gesture', null, 0, { name: gest.name });   // the dove may copy what he just did
  }
  if (!gest) return;
  const u = (t - gest.t0) / gest.dur;
  if (u >= 1) {
    if (gest.rel && st.relOrder && st.relOrder.id === gest.rel) { st.relOrder.gDone = true; relEnd('ok', { stayed: !!dv && Math.hypot(dv.x - st.x, dv.y - st.y) < CFG.size * 2 }); }
    gest = null; gestAt = t + 1; return;   // a second of plain standing (breathing, weight shifting) before the next variant may roll
  }
  const w = Math.min(1, u * 4, (1 - u) * 4), A = gest.amp, sd = gest.side, ph = (t - gest.t0) * (gest.f || 1);
  const S1 = sd > 0 ? 'R' : 'L';   // the arm on the gesture's side
  const T1 = (sd > 0) === (st.dir > 0) ? 'R' : 'L';   // the arm toward that side, whichever way he faces
  if (gest.food && !gest.bit && u > (gest.name === 'eat' ? 0.4 : 0.6)) { gest.bit = 1; foodBite(gest.food); }   // the bite lands on the apex of the move
  // Feeding is one causal chain (owner 2026-11-15): the seed bag out of the backpack, face the bird, shake it (backpack.js drops the real
  // food into REL from the bag's mouth), watch, the bag back in. The chain sets the pace, not a timer. No bag, no feeding: never an empty hand.
  if (gest.name === 'feed') { const P = ENV.__pack, g = gest; if (dv) st.dir = Math.sign(dv.x - st.x) || st.dir;
    if (!g.ph && !(P && P.busy) && !st.air && !st.held && st.mode !== 'climb' && st.mode !== 'lane' && (st.amt || 0) < 0.05) {   // a full stop on the ground first (the pack refuses a take while he walks or is in the air)
      g.ph = 'take'; g.start ??= t; if (!P) g.ph = 'fail'; else P.take('food').then(r => { if (g.ph !== 'take') return; if ((r === true || (r && r.ok)) && P.holding === 'food') g.ph = 'shake'; else if (!g.retried) { g.retried = true; g.why = r && r.why; g.ph = ''; } else g.ph = 'fail'; }, () => { g.ph = 'fail'; }); }   // refused (true without the bag, or {ok:false, why}): one retry once the pack is free again, then the feeding is off
    if (g.ph === 'shake' && !P.busy && P.shake()) { g.ph = 'watch'; g.dropAt = t; }
    else if (g.ph === 'watch' && t - g.dropAt > 2.2) { g.ph = 'stow'; Promise.resolve(P.stow()).then(() => { g.ph = 'done'; }); }
    if (g.ph === 'fail' || t - (g.start ??= t) > 14) { gest = null; gestAt = t + 1; if (st.relOrder && st.relOrder.id === g.rel) relEnd('interrupted'); return; }
    g.t0 = g.ph === 'done' ? t - g.dur : t - g.dur * 0.5; }
  switch (gest.name) {
    case 'look': lookGoal = sd * 0.8 * Math.sin(ph * 1.3) * A; break;
    case 'feed': { const d = ENV.__scion; lookGoal = d ? Math.max(-1, Math.min(1, (d.x - st.x) / 120)) : st.dir * 0.4; mix(B.head, gest.ph === 'watch' ? 0.25 : 0.12, 0, 0, w); break; }   // eyes on the bird; the bag arm is backpack.js's
    case 'hips': armMix('L', [0.75, -0.6, -0.2], [-0.85, -0.35, 0.15], w); armMix('R', [0.75, -0.6, -0.2], [-0.85, -0.35, 0.15], w); break;
    case 'scratch': armMix(S1, [0.55, 0.55, 0.35], [-0.55, 0.75 + Math.sin(ph * 14) * 0.08, -0.15], w); lookGoal = -sd * 0.3; mix(B.head, 0.12, 0, sd * 0.15, w); break;
    case 'cross': armMix('L', [0.3, -0.85, 0.42], [-0.95, 0.12, 0.3], w); armMix('R', [0.3, -0.85, 0.42], [-0.95, 0.2, 0.36], w); break;
    case 'stretch': { const e = Math.sin(Math.min(1, u * 1.6) * Math.PI) * A; armMix('L', [0.3, 1, 0.05], [0.12, 1, 0], w * e); armMix('R', [0.3, 1, 0.05], [0.12, 1, 0], w * e); mix(B.chest, -0.12, 0, 0, w * e); break; }
    case 'weight': mix(sd > 0 ? B.thighR : B.thighL, -0.12, 0, -sd * 0.06, w); mix(sd > 0 ? B.shinR : B.shinL, 0.35 * A, 0, 0, w); mix(B.chest, 0, 0, sd * 0.05, w); break;
    case 'tap': mix(sd > 0 ? B.thighR : B.thighL, -0.18, 0, 0, w); mix(sd > 0 ? B.shinR : B.shinL, 0.25 + Math.max(0, Math.sin(ph * 9)) * 0.3 * A, 0, 0, w); break;
    case 'behind': armMix('L', [0.18, -0.9, -0.38], [-0.8, -0.15, -0.45], w); armMix('R', [0.18, -0.9, -0.38], [-0.8, -0.1, -0.5], w); mix(B.chest, -0.05, 0, 0, w); break;
    case 'lean': armMix('L', [0.3, -0.6, -0.75], [0.12, -1, -0.25], w); armMix('R', [0.3, -0.6, -0.75], [0.12, -1, -0.25], w); mix(B.chest, -0.15, 0, 0, w); break;
    case 'eat': armMix(T1, [0.15, -0.55, 0.8], [-0.25, 1, 0.12], w); mix(B.head, 0.12 + Math.max(0, Math.sin(ph * 9)) * 0.08, 0, 0, w); break;   // hand to mouth, chewing
    case 'forage': {   // a beat of anticipation (a lean back), then down to it and one hand to the food; the apex is the bite
      const pre = u < 0.22, k = pre ? 0 : Math.min(1, (u - 0.22) * 3);
      if (pre) mix(B.chest, -0.08, 0, 0, w);
      mix(B.thighL, -0.85 * k, 0, 0, w); mix(B.thighR, -0.6 * k, 0, 0, w); mix(B.shinL, 1.35 * k, 0, 0, w); mix(B.shinR, 1.0 * k, 0, 0, w); mix(B.chest, 0.35 * k, 0, 0, w); mix(B.head, 0.4 * k, 0, 0, w);
      armMix(T1, [0.25, -0.75, 0.6 * k], [0.1, -0.85, 0.5 * k], w * k); lookGoal = sd * 0.6; break; }
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
    case 'greet': { const d = ENV.__scion; const dx = d ? d.x - st.x : sd * 60;   // the dove is right here: he crouches to its level and tilts his head at it (no hand held out: an empty hand reads as food that is not there)
      lookGoal = Math.max(-1, Math.min(1, dx / 90)); mix(B.head, 0.3, 0, sd * 0.28 * A, w); mix(B.chest, 0.3, 0, 0, w);
      mix(B.thighL, -0.85, 0, 0, w); mix(B.thighR, -0.6, 0, 0, w); mix(B.shinL, 1.35, 0, 0, w); mix(B.shinR, 1.0, 0, 0, w); break; }
    case 'pat': { const d = ENV.__scion; const dx = d ? d.x - st.x : sd * 60;   // greet's crouch, the hand patting the bird
      lookGoal = Math.max(-1, Math.min(1, dx / 90)); mix(B.head, 0.3, 0, 0, w); mix(B.chest, 0.3, 0, 0, w);
      mix(B.thighL, -0.85, 0, 0, w); mix(B.thighR, -0.6, 0, 0, w); mix(B.shinL, 1.35, 0, 0, w); mix(B.shinR, 1.0, 0, 0, w);
      armMix(sd > 0 ? 'R' : 'L', [0.25, -0.45, 0.85], [0.15, -0.35 + Math.sin(ph * 4) * 0.15, 0.95], w * A); break; }
    case 'swat': { const wu = Math.min(0.8, (gest.windup || 0.4) / gest.dur), soft = gest.soft ? 0.5 : 1;   // cocked high, then down and across at the bird
      lookGoal = sd * 0.8;
      mix(B.thighL, -0.85, 0, 0, w); mix(B.thighR, -0.6, 0, 0, w); mix(B.shinL, 1.35, 0, 0, w); mix(B.shinR, 1.0, 0, 0, w); mix(B.head, 0.3, 0, 0, w);   // down to its level, like greet
      if (u < wu) armMix(T1, [0.6, 0.5, -0.5], [0.4, 0.7, -0.4], w);
      else { armMix(T1, [0.4, -0.8, 0.7], [0.3, -0.9, 0.6], w * soft); mix(B.chest, 0.45 * soft, 0, 0, w); }
      if (!gest.fired && u > wu + 0.15 && st.hand) { gest.fired = 1; ENV.REL.ev(WHO, 'strikeApex', 'dove', 0, { x: st.hand.x, y: st.hand.y }); }
      break; }
    case 'scoop': {   // crouch to it and bring both hands in under it; the apex is the moment he tries to lift it
      const d = ENV.__scion, dx = d ? d.x - st.x : sd * 40; lookGoal = Math.max(-1, Math.min(1, dx / 80));
      mix(B.thighL, -0.95, 0, 0, w); mix(B.thighR, -0.75, 0, 0, w); mix(B.shinL, 1.45, 0, 0, w); mix(B.shinR, 1.15, 0, 0, w); mix(B.chest, 0.45, 0, 0, w); mix(B.head, 0.35, 0, 0, w);
      const r = Math.min(1, u * 1.8); armMix('L', [0.25, -0.55, 0.8 * r], [-0.35, -0.45, 0.85], w); armMix('R', [0.25, -0.55, 0.8 * r], [-0.35, -0.45, 0.85], w);
      if (!gest.fired && u > 0.55 && st.hand) { gest.fired = 1; ENV.REL?.ev(WHO, 'pickApex', 'dove', 0, { x: st.hand.x, y: st.hand.y }); }
      break; }
    case 'throw': {   // the bird drawn back over his shoulder, a step into it, and flung
      const wu = Math.min(0.75, (gest.windup || 0.5) / gest.dur), back = u < wu, k = back ? u / wu : 1;
      lookGoal = sd * 0.9;
      if (back) { armMix(T1, [0.35, 0.55 * k, -0.75 * k], [0.25, 0.85, -0.5 * k], w); mix(B.chest, -0.25 * k, 0, 0, w); mix(sd > 0 ? B.thighL : B.thighR, -0.25 * k, 0, 0, w); }
      else { armMix(T1, [0.3, 0.25, 0.95], [0.25, 0.1, 1], w); mix(B.chest, 0.4 * A, 0, 0, w); mix(sd > 0 ? B.thighR : B.thighL, -0.45, 0, 0, w); mix(sd > 0 ? B.shinR : B.shinL, 0.5, 0, 0, w); }
      if (!gest.fired && u > wu + 0.05) { gest.fired = 1; ENV.REL?.ev(WHO, 'throwApex', 'dove', 0); }
      break; }
    case 'lift': {   // the bird raised up out of his hands, arms all the way up, then they come down
      const k = Math.min(1, u / 0.6); armMix('L', [0.2, -0.3 + 1.3 * k, 0.6 - 0.35 * k], [-0.3 + 0.4 * k, 0.2 + 0.8 * k, 0.5 - 0.3 * k], w); armMix('R', [0.2, -0.3 + 1.3 * k, 0.6 - 0.35 * k], [-0.3 + 0.4 * k, 0.2 + 0.8 * k, 0.5 - 0.3 * k], w);
      mix(B.head, -0.3 * k, 0, 0, w); mix(B.chest, -0.1 * k, 0, 0, w); lookGoal = 0;
      if (!gest.fired && u > 0.6) { gest.fired = 1; ENV.REL?.ev(WHO, 'liftApex', 'dove', 0); }
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
    case 'shoo': { const d = ENV.__scion, dx = d ? d.x - st.x : sd * 60; lookGoal = Math.max(-1, Math.min(1, dx / 90));   // go on, get
      armMix(dx > 0 ? (st.dir > 0 ? 'R' : 'L') : (st.dir > 0 ? 'L' : 'R'), [0.55, -0.1, 0.7], [0.6 + Math.sin(ph * 7) * 0.6, 0.1, 0.6], w); mix(B.chest, -0.08, 0, 0, w); break; }
    case 'turnaway': { const d = ENV.__scion, dx = d ? d.x - st.x : sd * 60; lookGoal = -Math.sign(dx) * 0.9;   // pointedly looking elsewhere
      armMix('L', [0.3, -0.85, 0.42], [-0.95, 0.12, 0.3], w); armMix('R', [0.3, -0.85, 0.42], [-0.95, 0.2, 0.36], w); mix(B.head, -0.1, 0, 0, w); break; }
    case 'peer': mix(B.chest, 0.35, 0, 0, w); mix(B.head, 0.5, 0, 0, w); armMix('L', [0.3, -0.8, 0.35], [0.1, -0.9, 0.3], w); armMix('R', [0.3, -0.8, 0.35], [0.1, -0.9, 0.3], w); break;   // looking down over the edge
    case 'hands': armMix('L', [0.15, -0.8, 0.5], [-0.6, -0.2, 0.75], w); armMix('R', [0.15, -0.8, 0.5], [-0.6, -0.25, 0.7], w); break;
    case 'point': { const tg = st.interest || { x: st.x + sd * 100, y: st.y - CFG.size }, dx = tg.x - st.x, up = Math.max(-0.3, Math.min(0.6, (st.y - CFG.size * 0.75 - tg.y) / 250)), e = Math.sin(Math.min(1, u * 1.4) * Math.PI);   // there: the arm straight at it, eyes with it
      armMix(dx > 0 ? (st.dir > 0 ? 'R' : 'L') : (st.dir > 0 ? 'L' : 'R'), [0.2, 0.25 + up, 0.9], [0.1, 0.3 + up, 0.95], w * Math.min(1, e * 1.5)); lookGoal = Math.max(-1, Math.min(1, dx / 160)); mix(B.head, -0.25 * up, 0, 0, w); break; }
    case 'yawn': { const e = Math.sin(Math.min(1, u * 1.3) * Math.PI) * A; armMix(S1, [0.45, 0.35, 0.6], [-0.7, 0.75, 0.55], w * e); armMix(S1 === 'L' ? 'R' : 'L', [0.6, 0.7, -0.1], [0.3, 0.95, -0.1], w * e * 0.8); mix(B.head, -0.3 * e, 0, 0, w); mix(B.chest, -0.1 * e, 0, 0, w); break; }   // a hand to the mouth, the other arm up, head back
    case 'lie': { const e = Math.min(1, u * 2.5) * Math.min(1, (1 - u) * 2.5);   // lying back on the ledge, hands behind his head, legs out
      mix(B.chest, -0.85 * e, 0, 0, w); mix(B.head, -0.2 * e, 0, 0, w); mix(B.thighL, -0.35, 0, 0.08, w * e); mix(B.thighR, -0.3, 0, -0.08, w * e); mix(B.shinL, 0.2, 0, 0, w * e); mix(B.shinR, 0.25, 0, 0, w * e);
      armMix('L', [0.5, 0.6, -0.4], [-0.9, 0.5, -0.3], w * e); armMix('R', [0.5, 0.6, -0.4], [-0.9, 0.5, -0.3], w * e); break; }
    case 'lookup': mix(B.head, -0.45 * A, 0, sd * 0.1, w); mix(B.chest, -0.1, 0, 0, w); armMix(S1, [0.5, 0.75, 0.45], [-0.75, 0.55, 0.35], w); lookGoal = sd * 0.2; break;   // a hand over the eyes, looking up
    case 'wave': armMix(st.dir > 0 ? 'R' : 'L', [0.6, 0.85, 0.2], [0.15 + Math.sin(ph * 9) * 0.3, 0.95, 0.1], w); lookGoal = -0.25 * st.dir; mix(B.head, -0.05, 0, sd * 0.1, w); break;   // hello again: the hand nearer you, up and waving
  }
}

ENV.__hugo = st;   // read-only peek for debugging
ENV.__hugoFloors = () => allFloors;   // the ledges he scans are the food's colliders too (bond.js skips support:false seams)
if (/[?&]debug/.test(location.search)) ENV.__hugoDbg = { get inner() { return thoughts; }, get gph() { return gest && gest.ph; }, feed: () => { if (st.air || st.held || st.mode === 'climb' || st.mode === 'sit' || (st.sitK || 0) > 0.001) return false; if (st.beh) behEnd(false); st.goal = null; st.route = null; st.amt = 0; st.mode = 'idle'; st.idleUntil = t + 9; gest = { name: 'feed', t0: t, dur: 7, side: st.dir, amp: 1, f: 1 }; return true; }, get floors() { return floors; }, get t() { return t; }, get gest() { return gest && gest.name; }, miss: why => missed(why), clear: (x, y, h) => clear(x, y, h), get ink() { return ink; }, transits: () => { const g = graph(); return g ? g.transits : null; }, route: () => transitRoute(), graph: () => graph(), go: () => { const r = transitRoute(); if (r) { st.goal = null; st.route = r; nextLeg(); } return !!r; }, get sq() { return st.sq || 0; }, bones: () => { const o = {}; for (const [k, b] of Object.entries({ head: skull, chest: B.chest, hips: B.hips })) { b.getWorldPosition(_hv); o[k] = [+(_hv.x + innerWidth / 2 + O.x).toFixed(1), +(innerHeight / 2 - _hv.y + O.y).toFixed(1)]; } return o; }, get lid() { return eyes[0] ? eyes[0].scale.y : 1; }, get shade() { return shadeCss; }, get att() { return att; }, get brace() { return st.brace || 0; }, get why() { return pokeWhy; }, get intent() { return ENV.MORTAL && ENV.MORTAL.why ? ENV.MORTAL.why(WHO) : null; }, know: () => (ENV.MORTAL && ENV.MORTAL.beliefs ? ENV.MORTAL.beliefs(WHO) : []), get beh() { return st.beh ? { id: st.beh.id, kind: st.beh.kind, b: st.beh.p.b } : null; },
  walk: dx => { const f = st.floor; if (!f) return false; st.goal = { f, x: Math.max(f.x1 + HALF_W, Math.min(f.x2 - HALF_W, st.x + dx)), until: t + 20 }; st.route = null; if (st.mode !== 'walk') { st.mode = 'walk'; restyle(); } return true; }, park: s => { st.goal = null; st.route = null; if (st.mode === 'walk') st.mode = 'idle'; st.idleUntil = t + s; }, hop: v => hopUp(v) };   // scripted beats for the harness
st.dims = { THIGH, ARMLEN, SPINE, PITCH, CRAWL_H, size: CFG.size };
// Hit area follows him; the canvas itself never takes the pointer.
const hit = document.createElement('div'); hit.id = WHO + '-hit'; hit.setAttribute('aria-label', ALT ? ALT.label : 'Hugo. Press to pick him up, let go to drop him.');
Object.assign(hit.style, { position: 'fixed', left: 0, top: 0, width: HALF_W * 2 + 'px', height: CFG.size + 'px', zIndex: 9999, cursor: 'grab', touchAction: 'none' });
const hud = document.createElement('div'); hud.id = WHO + '-hud';
Object.assign(hud.style, { position: 'fixed', left: 0, top: 0, zIndex: 9999, pointerEvents: 'none', font: '10px/1.5 "IBM Plex Mono", ui-monospace, monospace', letterSpacing: '.04em',
  color: 'var(--muted, #777)', whiteSpace: 'pre', opacity: 0, transition: 'opacity .2s' });
document.body.append(hit, hud);
if (ALT) { hit.className = hud.className = 'agent-ui'; hit.style.zIndex = hud.style.zIndex = 10060; hit.style.display = 'none'; }   // over the phone sheet too; nothing to grab until he is there
let lastDown = 0, pointerId = null, pvx = 0, pvy = 0, ppx = 0, ppy = 0, ptime = 0, grabAt = 0, grabX = 0, grabY = 0, dragged = false;
hit.addEventListener('pointerenter', () => { st.hover = true; st.hoverAt = t + 0.15 + Math.random() * 0.15; ENV.MORTAL?.heard(WHO); });   // he notices you after a human beat, not on the same frame
hit.addEventListener('pointerleave', () => { if (!st.held) st.hover = false; });
hit.addEventListener('pointerdown', e => {
  const now = performance.now();
  if (st.held) return;
  {                                                // press: pick him up (release lets go)
    st.held = true; st.dropF = null; st.hop = false; st.goal = null; st.air = false; st.floor = null; st.mode = 'walk'; st.amt = 0; st.vx = st.vy = 0;
    pointerId = e.pointerId; hit.style.cursor = 'grabbing'; document.body.style.cursor = 'grabbing';
    // He is held where you took him: by the head, the chest, or the legs (then he hangs upside down from your hand).
    st.grip = Math.max(0.3, Math.min(1, (st.y - (e.clientY + O.y)) / CFG.size)); st.flip = false;   // held where you took him, always the right way up
    st.temper = 0.5 + Math.random() * 0.9; st.fearHigh = Math.random() * 0.35 - 0.1; st.fearFlip = Math.random() * 0.45;
    st.stress = (st.stress || 0) + (st.mode === 'walk' && st.amt > 0.3 ? 0.12 : st.mode === 'sit' ? 0 : 0.04) * Math.random(); st.react = null; st.reactUntil = 0;   // a surprise if you snatch him mid-stride
    relClear(); gest = null; st.pounce = null; st.food = null; ENV.REL?.ev('visitor', 'grabbed', WHO, st.stress); poke('the cursor picked me up'); ENV.MORTAL?.heard(WHO);
    st.px = e.clientX + O.x; st.py = e.clientY + O.y + (st.flip ? 0 : CFG.size * st.grip);
    ppx = st.px; ppy = st.py; ptime = now; pvx = pvy = 0; grabAt = now; grabX = e.clientX; grabY = e.clientY; dragged = false;
    e.preventDefault();
  }
  lastDown = now;
});
addEventListener('pointermove', e => {
  if (st.hover && !st.held) { st.px = e.clientX + O.x; }
  if (!st.held) return;
  if (Math.hypot(e.clientX - grabX, e.clientY - grabY) > 24) dragged = true;
  const now = performance.now(), dtp = Math.max(1, now - ptime) / 1000;
  st.px = e.clientX + O.x; st.py = e.clientY + O.y + (st.flip ? 0 : CFG.size * (st.grip ?? 0.55));
  pvx = pvx * 0.6 + ((st.px - ppx) / dtp) * 0.4; pvy = pvy * 0.6 + ((st.py - ppy) / dtp) * 0.4;   // smoothed hand velocity
  ppx = st.px; ppy = st.py; ptime = now;
});
const release = e => {
  if (!st.held) return;
  st.held = false; hit.style.cursor = 'grab'; document.body.style.cursor = ''; st.hover = false; st.flip = false; st.shaken = st.stress || 0;
  st.air = true; st.vx = Math.max(-1600, Math.min(1600, pvx)); st.vy = Math.max(-1800, Math.min(1800, pvy));   // a toss keeps the hand's speed
  st.dir = st.vx < 0 ? -1 : 1;
  const sp = Math.hypot(pvx, pvy); ENV.REL?.ev('visitor', sp > 600 ? 'tossed' : 'released', WHO, Math.min(1, sp / 1800), { stress: st.stress || 0 }); poke(sp > 600 ? 'the cursor threw me' : 'the cursor let me go');
};
addEventListener('pointerup', release); addEventListener('pointercancel', release);
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = performance.now(); return; }
  if (!hiddenAt || performance.now() - hiddenAt < 30000 || st.held || st.air || st.dead) return;   // asleep while the tab was away (no frames run): a stretch on waking
  gest = { name: 'stretch', t0: t, dur: 2.4, side: 1, amp: 1, f: 1 }; if (st.mode === 'walk') { st.mode = 'idle'; st.idleUntil = t + 2.6; st.amt = 0; }
});
// Reactions to the visitor: a human delay (N(220, 40) ms, 150-300), one deliberate reaction per 8-12 s, at most 3 of a kind per visit and
// each kind on its own 4-12 s cooldown (oneko's restraint): a glance and release, never a stare.
const att = { nextAt: 0, kinds: {}, log: [] };
function react(kind, fn) {
  const Kd = att.kinds[kind] || (att.kinds[kind] = { n: 0, at: 0 });
  if (calm || t < att.nextAt || t < Kd.at || Kd.n >= 3) return false;
  Kd.n++; Kd.at = t + 4 + Math.random() * 8; att.nextAt = t + 8 + Math.random() * 4;
  const delay = Math.max(150, Math.min(300, 220 + (Math.random() + Math.random() + Math.random() - 1.5) * 80)), trig = t;
  setTimeout(() => { fn(); att.log.push({ kind, trig, at: t, ms: Math.round(delay) }); }, delay); return true;
}
const glanceAt = (x, y) => { st.glance = { x, y, until: t + 0.8 + Math.random() * 1.2 }; };
addEventListener('pointerdown', e => { if (!st.held && e.target !== hit && !e.target.closest?.('#' + hit.id)) react('tap', () => glanceAt(e.clientX + O.x, e.clientY + O.y)); }, { passive: true });

// ---------- what his mind perceives, and what it can ask of his body ----------
// The cursor, seen from his size: a huge thing that roams the page, sometimes still, sometimes near, sometimes the hand
// that grabs him. Client coords are kept so a scroll moves the page under it, not the cursor.
const pointer = { cx: 0, cy: 0, in: false, movedAt: 0, at: 0, sp: 0, near: false };
addEventListener('pointermove', e => {
  const now = performance.now(), d = Math.hypot(e.clientX - pointer.cx, e.clientY - pointer.cy);
  pointer.sp = pointer.sp * 0.7 + (d / (Math.max(16, now - pointer.at) / 1000)) * 0.3; pointer.cx = e.clientX; pointer.cy = e.clientY; pointer.at = now; pointer.in = true;
  if (d > 2) pointer.movedAt = now;
  const near = Math.hypot(pointer.cx + O.x - st.x, pointer.cy + O.y - (st.y - CFG.size / 2)) < 160;
  if (near && !pointer.near && !st.held) { poke('the cursor came close'); notice('cursor_near', { x: pointer.cx + O.x, y: pointer.cy + O.y, what: 'cursor' }); }
  const close = Math.hypot(pointer.cx + O.x - st.x, pointer.cy + O.y - (st.y - CFG.size / 2)) < CFG.size * 3;   // within three of him: a glance (budgeted, delayed)
  if (close && !pointer.close && !st.held && !st.hover) react('glance', () => glanceAt(pointer.cx + O.x, pointer.cy + O.y)); pointer.close = close;
  if (near) ENV.MORTAL?.heard(WHO);   // the visitor's attention: no isolation while the cursor keeps him company
  pointer.near = near;
}, { passive: true });
document.documentElement.addEventListener('pointerleave', () => { pointer.in = false; });
const words = (s, n) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const labelOf = (el, n = 50) => el ? words(el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('alt') || el.getAttribute('title')) || el.textContent, n) : '';
function sectionOf(el) { const s = el && el.closest && el.closest('section,article,header,footer'); return s ? labelOf(s.querySelector('h1,h2,h3') || s, 40) : ''; }
function underFoot() {   // the very words under his feet, when he is on screen
  const f = st.floor; if (!f) return null;
  if (f.ground) return 'the very bottom of the page';
  const cx = st.x - O.x, cy = f.y - O.y + 5;
  if (f.text && cx > 0 && cy > 0 && cx < innerWidth && cy < innerHeight && document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(cx, cy), n = r && r.startContainer;
    if (n && n.nodeType === 3) return `the words "${words(n.textContent.slice(Math.max(0, r.startOffset - 24), r.startOffset + 24), 60)}"`;
  }
  const tag = f.el.tagName ? f.el.tagName.toLowerCase() : '';
  return f.text ? `the line "${labelOf(f.el, 60)}"` : `${tag === 'img' ? 'a picture' : tag === 'iframe' ? 'an app window' : 'the edge of a box'}${labelOf(f.el, 40) ? ` ("${labelOf(f.el, 40)}")` : ''}`;
}
let places = [];
const rel = (x, y) => ({ dx: Math.round(x - st.x), dy: Math.round((st.y - CFG.size / 2) - y) });   // +dx right of him, +dy above him
ENV.__hugoSense = () => {
  places = [];
  for (const el of document.querySelectorAll('h1,h2,h3,img,a.ibtn,button,.phone,.monitor,iframe')) {
    if (el.closest(skipSel) || el === hit) continue;
    const r = el.getBoundingClientRect(); if (r.width < 8 || r.bottom < 0 || r.top > innerHeight) continue;
    const x = r.left + r.width / 2 + O.x, y = r.top + r.height / 2 + O.y;
    const tag = el.tagName.toLowerCase(), kind = /^h[1-3]$/.test(tag) ? 'heading' : tag === 'img' ? 'picture' : tag === 'iframe' || el.matches('.phone,.monitor') ? 'app screen' : 'button';
    places.push({ el, x, y, d: Math.hypot(x - st.x, y - st.y), kind, label: labelOf(el, 45) });
  }
  places.sort((a, b) => a.d - b.d); places = places.slice(0, 8);
  const now = performance.now(), cp = { x: pointer.cx + O.x, y: pointer.cy + O.y }, still = (now - pointer.movedAt) / 1000;
  const over = pointer.in ? document.elementFromPoint(pointer.cx, pointer.cy) : null;
  const inView = st.y > O.y + 30 && st.y - CFG.size < O.y + innerHeight - 10;
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
ENV.__hugoAct = (act, target) => {
  if (!act || st.dead || st.held || st.air || st.relOrder || (gest && gest.name === 'mad') || ['climb', 'prep', 'crawl', 'lane'].includes(st.mode) || (st.crawlK || 0) > 0.05) return 'busy';
  const p = target && target !== 'cursor' ? places.find((q, i) => 'p' + (i + 1) === target) : null;
  const cp = { x: pointer.cx + O.x, y: pointer.cy + O.y };
  const stand = (name, dur) => { if (st.mode === 'sit') return; st.mode = 'idle'; st.amt = 0; st.idleUntil = t + dur; gest = { name, t0: t, dur, side: Math.random() < 0.5 ? -1 : 1, amp: 0.8 + Math.random() * 0.3, f: 0.8 + Math.random() * 0.5 }; };
  const goTo = (x, y, why) => { const g = floorNear(x, y); if (!g) return 'no way there'; st.goal = { f: g.f, x: g.x, until: t + 30, mind: why }; if (st.mode !== 'walk') { st.mode = 'walk'; restyle(); } return 'ok'; };
  switch (act) {
    case 'go': return p ? goTo(p.x, p.el.getBoundingClientRect().top + O.y, p.label) : 'no such place';
    case 'approach_cursor': return pointer.in ? goTo(cp.x, cp.y, 'cursor') : 'no cursor';
    case 'back_away': { const f = st.floor; if (!f) return 'no floor'; const away = pointer.in ? -(Math.sign(cp.x - st.x) || 1) : -st.dir;
      const x = Math.max(f.x1 + HALF_W + 4, Math.min(f.x2 - HALF_W - 4, st.x + away * 220));
      if (Math.abs(x - st.x) > 40) { st.goal = { f, x, until: t + 15, mind: 'away' }; st.mode = 'walk'; return 'ok'; }
      const g = pickFloor(true); if (g) { st.goal = { f: g.f, x: g.x, until: t + 30, mind: 'away' }; st.mode = 'walk'; return 'ok'; } return 'nowhere to go'; }
    case 'look': { const tg = target === 'cursor' ? (pointer.in ? { x: cp.x, y: cp.y, what: 'cursor' } : null) : p ? { x: p.x, y: p.y, what: p.kind } : null;
      if (!tg) return 'nothing there'; st.interest = tg; st.watch = target === 'cursor' ? t + 5 : 0; st.dir = Math.sign(tg.x - st.x) || st.dir; stand('curious', 3.5 + Math.random() * 2); return 'ok'; }
    case 'sit': if (!st.floor || !sitRoom(st.x, st.floor.y)) return 'no room to sit'; st.goal = null; st.mode = 'sit'; st.idleUntil = t + 12 + Math.random() * 15; return 'ok';
    case 'nap': if (!st.floor || !sitRoom(st.x, st.floor.y)) return 'no room to sit'; st.goal = null; st.mode = 'sit'; st.idleUntil = t + 20 + Math.random() * 15;
      st.pendGest = { name: 'nap', dur: 15 + Math.random() * 10 }; return 'ok';
    case 'dance': case 'stretch': stand(act, act === 'dance' ? 5 + Math.random() * 4 : 3 + Math.random() * 2); return 'ok';
    case 'look_around': stand('look', 3 + Math.random() * 3); return 'ok';
    case 'wander': { const g = pickFloor(true) || pickToward(Math.random() < 0.5 ? 1 : -1); if (!g) return 'nowhere new'; routeTo(g.f, g.x, {}); return 'ok'; }
    case 'behind': return laneHop(-1) ? 'ok' : 'no back lane here';
    case 'eat': { const R = ENV.REL, fs = R ? R.foods.filter(it => it.st !== 'gone' && (it.holder === WHO || (it.settled && it.ledge))) : [];   // the frame's food moves
      if (!fs.length) return 'no food'; const it = fs.reduce((a, b) => Math.hypot(b.x - st.x, b.y - st.y) < Math.hypot(a.x - st.x, a.y - st.y) ? b : a);
      st.food = { id: it.id, tries: 0, miss: 0, forced: true }; return 'ok'; }
    case 'feed': { const R = ENV.REL; if (!R || !R.foods.some(it => it.st === 'held')) return 'nothing in hand';
      R.ev(WHO, 'drop', 'dove', 0, { x: st.hand ? st.hand.x : st.x, y: st.y, hy: st.hand ? st.hand.y : st.y - CFG.size * 0.4, vx: st.dir * 30 }); return 'ok'; }
    default: return 'carry on';
  }
};
// The Mortal Agent Frame's life (bond.js): ENDED = the body goes limp where it is, the next BIRTH stands it up again.
ENV.__hugoLife = alive => { if (!alive === !!st.dead) return; st.dead = !alive; st.deadAt = t; gest = null; if (st.dead) { relEnd('interrupted'); st.prep = null; } else st.idleUntil = t + 0.6; };
// Contact shadow (depth cue): his own element in the agents' layer, never the page. Touching his feet it reads as standing;
// during a lane hop it stays on the floor and shrinks (lifted), and behind the content it slides up and back (receding).
const shade = layer.appendChild(document.createElement('div')); let shadeCss = '';
Object.assign(shade.style, { position: 'absolute', left: 0, top: 0, width: Math.round(CFG.size * 0.6) + 'px', height: Math.round(CFG.size * 0.1) + 'px', margin: `${-Math.round(CFG.size * 0.05)}px 0 0 ${-Math.round(CFG.size * 0.3)}px`, borderRadius: '50%', pointerEvents: 'none',
  background: 'radial-gradient(closest-side, rgba(0,0,0,.34), rgba(0,0,0,0))', opacity: 0 });
// Occluders in the renderer: a depth-only quad (no colour) just in front of the figure per card he is behind, so the GPU drops his
// fragments there. 1 unit = 1 css px at z 0; a quad at z ZP is scaled by (P - ZP) / P to cover the same screen rect. No clip-path on
// the canvas: a clipped composited WebGL layer rasterises as an opaque box on WebKit and some Android GPUs.
const ZP = CFG.size * 0.6, occMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true }), occPool = [];
function occlude(rects) {
  const k = (CFG.perspective - ZP) / CFG.perspective;
  for (let i = occPool.length; i < Math.min(rects.length, 6); i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), occMat); m.renderOrder = -1; scene.add(m); occPool.push(m); }
  occPool.forEach((m, i) => { const q = rects[i]; m.visible = !!q; if (!q) return;
    m.position.set(((q.l + q.r) / 2 - O.x - innerWidth / 2) * k, (innerHeight / 2 - ((q.t + q.b) / 2 - O.y)) * k, ZP); m.scale.set((q.r - q.l) * k, (q.b - q.t) * k, 1); });
}
// His life on the public page is the Mortal Agent kernel's being (mortal-kernel.js): a hidden lifespan of years and one
// energy pool. ENDED: he goes limp where he is; a while later a new being stands up in this body, nothing carried over.
// On localhost the frame (bond.js frameTick) owns his life instead, and the kernel stands aside.
if (ENV.MORTAL) {
  const M = ENV.MORTAL;
  M.ready.then(() => ENV.REL?.newBody(WHO, M.id(WHO)));
  M.on(WHO, type => {
    if (type !== 'ENDED') return;
    ENV.__hugoLife(false);
    setTimeout(async () => { const id = await M.newBeing(WHO); ENV.REL?.newBody(WHO, id); ENV.__hugoLife(true); }, 12000);
  });
}
const lifeLine = () => { const M = ENV.MORTAL, R = ENV.REL; if (!M || !R || !M.alive(WHO)) return '';   // desktop hover readout; never the lifespan
  const n = R.needs(WHO), p = M.pressure(WHO); return `\nδt ${M.being(WHO).dt.toFixed(0)}s · energy ${n.energy.toFixed(2)} · hunger ${n.hunger.toFixed(2)}\npressure ${p.toFixed(2)}${p >= M.ACT ? ' (acting)' : ''} · ${M.mood(WHO, { ...n, stress: st.stress || 0 })}`; };
ENV.__hugoSay = text => { text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 220); if (text) thoughts.push({ t: +t.toFixed(1), text }); if (thoughts.length > 40) thoughts.shift(); };   // what he would say stays inside him (owner 2026-11-15: no bubble on the page); __hugoDbg.thoughts reads it
const thoughts = [];
// Something happened to him: his mind (the frame, or hugo-mind, via bond.js) thinks again right away instead of at its next beat.
let pokes = 0, pokeWhy = '';
function poke(why) { pokes++; pokeWhy = why; }
// Failing at the same thing again and again gets to him: three misses in 25 s and he loses his temper for a moment, stomping
// and shaking his fists at it, then lets it go. Desktop and phones alike.
const misses = []; let madAt = -1e9;
function missed(why) {
  misses.push(t); while (misses.length && t - misses[0] > 25) misses.shift();
  if (misses.length < 3 || st.air || st.held || st.dead || st.mode === 'sit' || (gest && gest.rel) || !inView() || t - madAt < 60) return false;   // off camera: no tantrum nobody sees; and not twice a minute
  misses.length = 0; madAt = t; poke('fed up: ' + why); ENV.REL?.ev(WHO, 'gesture', null, 0, { name: 'mad' });
  st.goal = null; st.mode = 'idle'; st.amt = 0; st.idleUntil = t + 3.2;
  gest = { name: 'mad', t0: t, dur: 3, side: st.dir, amp: 1, f: 1 }; gestAt = t + 6; return true;
}
// A goal he cannot reach from here: struck off for a while; a miss only when someone (the bird, the visitor) wanted it, never a place
// he picked himself (a blocked point is rejected and another chosen, Animal Crossing's wander)
function giveUp(why) { const g = st.goal; st.goal = null; st.route = null; if (st.beh) st.beh.failed = 1; if (!g) return; if (g.rel) relEnd('fail'); else { avoid.set(g.f, t + 60 + Math.random() * 60); if (!g.auto) missed(why); } }
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
    if (q === f || q.y > f.y - 8 || q.y < f.y - UP || x0 < q.x1 || x0 > q.x2) continue;
    const ux = Math.max(q.x1 + HALF_W + 10, Math.min(q.x2 - HALF_W - 10, x0 + st.dir * (HALF_W + 24)));   // well onto the top, not on its lip
    if (onFloor(q, ux) && clear(ux, q.y, CFG.size + 4) && (!up || q.y > up.q.y)) up = { q, ux };   // the lowest top he can stand on
  }
  const wantsPast = st.goal && Math.sign(st.goal.x - st.x) === st.dir;
  if (st.z === 0 && !st.relBusy && wantsPast && !st.goal.rel) { const r = plan(st.goal.f, st.goal.x, 0); if (r && r.length) { st.route = r; if (nextLeg()) return; } }   // words in the way: a route past them (behind, with the way back out planned), when the graph has one
  if (st.z === 0 && !st.relBusy && !wantsPast && !f.screen && !f.ground && t > (st.peekAt || 0) && Math.random() < 0.4 && laneHop(-1)) { st.peek = true; return; }   // or a peek behind the page, back out where he stands
  if (up && (wantsPast || Math.random() < 0.6)) { const dh = f.y - up.q.y; st.mode = 'prep'; st.amt = 0; st.prep = { f: up.q, dh, until: t + 0.18 + Math.random() * 0.14, climb: dh > CFG.size * 1.2, over: up.ux }; return; }
  if (wantsPast) giveUp('no way past');   // no way past: not there, not now
  if (walls.some(w => w.f === f && w.dir === -st.dir && t - w.t < 30)) {   // walls both ways lately: hemmed in
    const g = pickToward(-1);
    if (g) { st.goal = { f: g.f, x: g.x, until: t + 20 }; return; }
    if (missed('hemmed in')) return;   // boxed in with no way out: it builds up like any other failure
    if (sitRoom(st.x, f.y)) { st.mode = 'sit'; st.idleUntil = t + 15 + Math.random() * 20; }
    else { st.mode = 'idle'; st.idleUntil = t + 4 + Math.random() * 4; gest = { name: 'look', t0: t, dur: 3.5, side: -st.dir, amp: 1, f: 1 }; }
    return;
  }
  st.dir = -st.dir; st.mode = 'idle'; st.idleUntil = t + 0.8 + Math.random() * 1.8;   // turns away from it, after a moment
}
// A lane change is an event, never a silent swap (DKC barrel, Fez rotation): a short hop with the scale easing over ~0.4 s,
// his other decisions paused, and he turns through profile on the way. Out to the content only where he fits on it.
function laneHop(to) {
  const f = st.floor;
  if (to === st.z || !f || st.air || st.held || st.dead || st.mode === 'climb' || st.mode === 'lane' || (st.sitK || 0) > 0.04 || (st.crawlK || 0) > 0.05) return false;
  if (to !== 0 && !st.lanes.includes(to)) return false;   // w: this section has no such lane right now
  if (to === 0 && (f.support === false || !clear(st.x, f.y, CFG.size + 4, 0))) return false;
  st.hopL = { from: st.zs, to, t0: t, dur: 0.38 + Math.random() * 0.12 }; st.mode = 'lane'; st.amt = 0; gest = null;
  ENV.DEPTH?.hop(WHO, st.z, to, st.x, st.y); poke(to < 0 ? 'stepped behind the page' : 'stepped back out onto the page');
  return true;
}
function backOut(f) {   // in the back lane with the lane closing (or time to come out): walk to the nearest spot he fits on the content
  if (f.support !== false) for (let k = 0; k < 40; k++) for (const s of [1, -1]) { const x = st.x + s * k * 16;
    if (x - HALF_W >= f.x1 && x + HALF_W <= f.x2 && clear(x, f.y, CFG.size + 4, 0)) { if (k) goTo(f, x, { exit: 1 }); return k === 0; } }
  const p = pickFloor(true, 0); if (p) goTo(p.f, p.x, { exit: 1, auto: 1 }); return false;   // somewhere with lane-0 room; none in view: he stays behind until the view moves on
}
// ---------- routes: a small graph (walk, fall, jump and depth links) and A* over it (depth.js) ----------
// Cheap to step behind a card, dear to walk a hairline, a little cost jitter per plan so the routes vary. Targets are floors
// (elements), not coordinates, so a reflow re-snaps the route instead of breaking it.
function graph(tf, tx, tz) {   // the route graph around him (floors, seams and cards within half a screen), him and an optional target seeded in
  const D = ENV.DEPTH, cur = st.floor; if (!D || !cur || st.air) return null;
  const near = q => q.y > O.y - innerHeight * 0.5 && q.y < O.y + innerHeight * 1.5, fl = floors.filter(near), sm = seams.filter(near);
  // the screen's bottom edge: a route can start there, and when a card in view is cut by it, it is the floor of a card transit (on this
  // page the only lane-0 floor that passes a card with room on both sides); a step-off toward it is caught by it (dropTo)
  const sy = O.y + innerHeight - 30;
  if (cur.screen) fl.push(cur);
  else if (cards.some(c => c.t < sy - 20 && c.b > sy - CFG.size && c.l - 3 * HALF_W > O.x && c.r + 3 * HALF_W < O.x + innerWidth)) fl.push({ y: sy, x1: O.x, x2: O.x + innerWidth, el: document.body, screen: true, support: true });
  if (!(fl.includes(cur) || sm.includes(cur)) || (tf && !fl.includes(tf))) return null;
  const seed = [[cur, st.x, st.z]]; if (tf) seed.push([tf, tx, tz]); if (cur.support !== false) seed.push([cur, st.x, st.z ? 0 : -1]);
  const gaps = []; if (ALT) for (const f of fl) for (const dir of [-1, 1]) { const q = gapHop(f, dir); if (q && fl.includes(q.f)) { gaps.push([f, dir, q]); seed.push([q.f, q.x, 0]); } }   // ALT: his gap hops are routes too
  const g = D.buildGraph(fl, sm, { half: HALF_W, reach: UP, vh: innerHeight, h: CFG.size + 4, seed, cards: cards.filter(c => c.b > O.y - innerHeight * 0.5 && c.t < O.y + innerHeight * 1.5),
    clear: (x, y, z) => pass(x, y, CFG.size + 4, z), lanes: y => D.at(y, { noFront: true }).lanes });
  for (const [f, dir, q] of gaps) g.edges.get(g.node(f, dir < 0 ? f.x1 + HALF_W : f.x2 - HALF_W, 0).id).push({ to: g.node(q.f, q.x, 0).id, c: 50, kind: 'jump' });
  g.me = g.node(cur, st.x, st.z); return g;
}
const toward = b => n => Math.abs(n.x - b.x) * 0.5 + Math.abs(n.y - b.y) * 0.3;
function legsOf(p) {   // a path to legs: a card transit unfolds into its back-lane route (in behind the card, across, out); straight runs on one floor are one leg
  const raw = [p[0]]; p.edges.forEach((e, i) => { if (e.via) raw.push(...e.via); raw.push(p[i + 1]); });
  const full = raw.filter((n, i) => !(i && raw[i + 1] && n.z === 0 && raw[i - 1].z === -1 && raw[i + 1].z === -1 && raw[i - 1].f === n.f && raw[i + 1].f === n.f));   // no hop out and straight back in at a transit's end
  const legs = full.filter((n, j) => j && !(full[j + 1] && full[j + 1].f === n.f && full[j + 1].z === n.z && full[j - 1].f === n.f && full[j - 1].z === n.z));   // a landing or a lane change stays a leg of its own
  st.routeKinds = p.kinds;
  return legs;
}
function plan(f, x, z = 0) {   // z: the lane to arrive in
  const g = graph(f, x, z); if (!g) return null;
  const b = g.node(f, x, z), p = ENV.DEPTH.astar(g, g.me, n => n === b, toward(b));
  return p ? legsOf(p) : null;
}
// A card transit in view as a move of its own (LittleBigPlanet): the route to the far end of the cheapest one whose ends are both on
// screen, through it. Null when no card here has room on both sides.
function transitRoute() {
  const g = graph(); if (!g || !g.transits.length) return null;
  const inV = n => n.y > O.y + 40 && n.y <= O.y + innerHeight - 30; let best = null;   // down to the screen's bottom edge
  for (const tr of g.transits) { if (!inV(tr.a) || !inV(tr.b)) continue; const far = Math.abs(tr.a.x - st.x) > Math.abs(tr.b.x - st.x) ? tr.a : tr.b;
    const p = ENV.DEPTH.astar(g, g.me, n => n === far, toward(far)); if (p && p.edges.some(e => e.via) && (!best || p.cost < best.cost)) best = p; }
  return best ? legsOf(best) : null;
}
function routeTo(f, x, extra, z = 0) {   // by the graph when it has a way (lanes included), else straight there the old way (a lane change first, when needed)
  const r = plan(f, x, z); if (r && r.length) { st.route = r; if (nextLeg()) return true; }
  st.route = null; goTo(f, x, extra);
  if (z !== st.z && !laneHop(z)) { st.goal = null; return false; }   // no such lane here right now
  return true;
}
function nextLeg() {
  const r = st.route; if (!r || !r.length) { st.route = null; return false; }
  const n = r.shift();
  if (n.z !== st.z) { if (laneHop(n.z)) { if (n.z < 0) st.transitAt = t; return true; } st.route = null; return false; }   // a route's hop behind: his last transit
  goTo(n.f, n.x, { auto: 1, leg: 1 }); return true;
}
// One step toward the visitor's view: dir 1 = the view is below him (any floor lower down, he will step off a ledge
// to reach it), dir -1 = above (the highest floor he can hop up to from here).
function pickToward(dir) {
  const c = [];
  for (const f of floors) {
    if (f === st.floor || f.x2 - f.x1 < 2 * HALF_W + 8) continue;
    const dy = st.y - f.y;
    if (dir < 0 ? (dy > 6 && dy < UP) : (dy < -10 && f.y < O.y + innerHeight - 40)) {
      const x = Math.max(f.x1 + HALF_W + 6, Math.min(f.x2 - HALF_W - 6, st.x));
      if (clear(x, f.y, CFG.size + 4)) c.push({ f, x, score: dir < 0 ? -f.y : -Math.abs(f.y - (O.y + innerHeight * 0.6)) });
    }
  }
  c.sort((a, b) => b.score - a.score);
  return c[0] || null;
}
const onFloor = (f, x) => x - HALF_W >= f.x1 && x + HALF_W <= f.x2;
// ALT: his realm's ledges are short and stand apart (the phone's top, the Tech rule beside it). At a ledge's end he hops the gap onto
// the next one at his height or a little below, within a body and a half, where he fits (the wind-up and hop are the ones above).
function gapHop(f, dir = st.dir) { const e = dir > 0 ? f.x2 : f.x1; let best = null;
  for (const q of floors) { if (q === f || q.ground || q.y < f.y - 8 || q.y > f.y + CFG.size * 1.2) continue;
    for (let d = HALF_W + 4; d <= CFG.size * 1.5; d += 6) { const x = e + dir * d; if (onFloor(q, x) && clear(x, q.y, CFG.size + 4)) { if (!best || d < best.d) best = { f: q, x, d }; break; } } }
  return best; }
// Stepping off a ledge: never a drop that ends a screen or more down at the page bottom (he vanished from view for good)
// Every screen: only onto a real ledge that ends inside the view (or above it, on the way back to it), and that ledge catches
// him (dropF), so he never falls past it to the page bottom.
const dropTo = (x, y) => dropTo0(x, y) || (ALT && phone() ? dropTo0(x + st.dir * HALF_W * 2, y) : null);   // ALT on phones: the ledge under a box's side starts a step past its edge (his push-off carries him there)
const dropTo0 = (x, y) => { const g = st.goal && st.goal.f, f = g && g.screen && g.y > y + 4 ? g : landingBelow(x, y), ok = f && (!f.screen || f === g) && !(f.ground && f.y - y > innerHeight * 0.8) && f.y <= O.y + innerHeight - 10; st.dropF = ok ? f : null; return ok ? f : null; };
function landingBelow(x, y, vis) {   // nearest floor under (x, y) within a screen and a half; vis: a drop, so it must be one you can see
  let best = null;
  const visBottom = O.y + innerHeight - 30, lim = vis && visBottom > y + 2 ? visBottom : Infinity;
  // The bottom of the page always catches him, words or not; otherwise he fell straight through it and out of the world.
  // Phones: not behind words (Read less: the monitor and its caption sit on it); past it he falls out of the world and is born again in view.
  for (const f of (st.z < 0 ? allFloors : floors)) if (f.y > y + 2 && f.y <= lim && (f.ground || f.y < y + innerHeight * 1.5) && onFloor(f, x) && (f.ground || pass(x, f.y, CFG.size + 4)) && (!best || f.y < best.y)) best = f;
  // Nothing visible to land on: the bottom edge of the screen catches him, so a drop never ends out of sight (both renders; once the
  // view moves on, refloor() lets go of it and he falls to a real ledge, Shimeji's fall-then-recover).
  if (!ALT && vis && lim !== Infinity && (!best || best.y > lim)) best = { y: lim, x1: 0, x2: pageW, el: document.body, screen: true, support: true };
  return best;
}
// ---------- him and the dove ----------
// REL (bond.js) holds what they feel about each other and what passed between them, and every ~0.75 s says what, if
// anything, he does about the bird. His body carries it out with the same walking, hopping and gestures as his own life;
// when REL has nothing for him, his own life runs.
const onMine = p => st.floor && Math.abs(st.floor.y - p.y) < 6 && p.x > st.floor.x1 && p.x < st.floor.x2;   // the floor he is on wins over a twin at the same height
const floorFor = p => (onMine(p) ? st.floor : null) || floors.find(q => Math.abs(q.y - p.y) < 6 && p.x > q.x1 && p.x < q.x2) || landingBelow(p.x, p.y - 1);
const TRACK = new Set(['approach', 'follow', 'chase', 'stalk', 'groom', 'comfort', 'reconcile', 'swat', 'displace', 'offer', 'sit_with', 'threat', 'display']);   // goals that move with the bird
const relLeft = o => Math.max(1, o.until - ENV.REL.t);   // seconds left on an order (engine clock)
const faceDove = () => { const d = ENV.__scion; if (d) st.dir = Math.sign(d.x - st.x) || st.dir; };
function relGoal(o, p) {
  const f = p && floorFor(p); if (!f || f.y < st.y - UP || f.y > O.y + innerHeight - 10) return false;   // no floor there, one too high to climb to, or one below the screen (the page bottom under a flying bird): he stays and faces it instead
  st.goal = { f, x: Math.max(f.x1 + HALF_W, Math.min(f.x2 - HALF_W, p.x)), until: t + relLeft(o), rel: o.id };
  return true;
}
function relClear() { if (st.goal && st.goal.rel) st.goal = null; st.relOrder = null; st.spdK = 1; st.crouch = 0; st.relBusy = false; st.relGap = null; }
function relEnd(result, data) { const o = st.relOrder; if (!o) return; relClear(); st.relAt = result === 'fail' ? t + 0.75 : 0; ENV.REL.done(WHO, o.id, result, data || {}); }
// Never a fall from the sky (owner, 2026-11-15): out of frame above the view he comes down a card's side hand over hand, in over the
// top edge as a climber you see, and lets go only for the last body height onto a ledge in view; out of frame below it he climbs up
// over the bottom edge (climbIn); with neither, he walks in from a side edge along a ledge in view; with no way at all he stays
// where he is, off-screen, until the visitor scrolls back or a way opens. Never a teleport into view, never a respawn.
const crossesCard = (x, y0, y1) => cards.some(q => q.r > x - HALF_W * 1.7 && q.l < x + HALF_W * 1.7 && q.b > y0 && q.t < y1 - 2);
function fallBehind(x, y0, y1) { if (st.z === 0 && crossesCard(x, y0, y1)) { st.z = -1; st.backUntil = t + 1.5 + Math.random() * 2; } }
function climbDown() {   // a ledge in view whose end is a card's side with a clear line down to it from the top edge
  if (ALT && O.y < 0) return false;   // the top of his realm is in view: nothing above it to come down from
  const c = [];
  for (const f of floors) if (!f.ground && !f.screen && f.y > O.y + CFG.size * 1.6 && f.y < O.y + innerHeight * 0.75 && f.x2 - f.x1 > 2 * HALF_W + 24)
    for (const x of [f.x1 + HALF_W, f.x2 - HALF_W]) if (x > O.x + HALF_W && x < O.x + innerWidth - HALF_W && onFloor(f, x) && clear(x, f.y, CFG.size + 4, 0) && !crossesCard(x, O.y - CFG.size, f.y - CFG.size * 1.1)) c.push({ f, x });
  if (!c.length) return false;
  const p = c[(Math.random() * c.length) | 0];
  st.goal = null; st.route = null; st.floor = null; st.air = false; st.hop = false; st.vx = 0; st.vy = 0; st.dropF = null; st.away = 0; st.z = st.zs = 0; st.peek = false; st.x = p.x; st.dir = p.x < O.x + innerWidth / 2 ? 1 : -1; st.lostN = (st.lostN || 0) + 1;
  st.mode = 'climb'; st.climb = { f: p.f, t0: t, down: true, y0: O.y - CFG.size * 0.2, yTo: p.f.y - CFG.size * 0.9, x0: p.x, xTo: null };   // feet first, in over the top edge
  return true;
}
function walkInSide() {   // a ledge in view that reaches the screen's side: in from that side, as at birth
  if (ALT && (O.x < -1 || O.x + innerWidth > docW() + 1)) return false;   // his realm does not reach the screen's sides
  const c = []; for (const f of floors) if (f.y > O.y + CFG.size && f.y < O.y + innerHeight - 10 && (f.x1 <= O.x + 40 || f.x2 >= O.x + innerWidth - 40) && f.x2 - f.x1 > 160)
    for (let i = 1; i < 12; i++) { const x = f.x1 + (f.x2 - f.x1) * i / 12; if (x > O.x + HALF_W && x < O.x + innerWidth - HALF_W && onFloor(f, x) && clear(x, f.y, CFG.size + 4)) c.push({ f, x }); }
  if (!c.length) return false;
  const tgt = c[(Math.random() * c.length) | 0], side = tgt.x < O.x + innerWidth / 2 ? -1 : 1, x0 = side < 0 ? O.x - HALF_W * 1.6 : O.x + innerWidth + HALF_W * 1.6;
  st.goal = null; st.route = null; st.air = false; st.hop = false; st.vx = 0; st.vy = 0; st.dropF = null; st.away = 0; st.z = st.zs = 0; st.peek = false; st.lostN = (st.lostN || 0) + 1;
  st.enter = { f: tgt.f, x: tgt.x, x0, t0: t, dur: 1.2 + Math.random() * 0.3, sit: false, again: true };   // a return, not a birth: no ENTERED cue for the dove
  st.floor = tgt.f; st.x = x0; st.y = footY(tgt.f, tgt.x); st.dir = -side; st.mode = 'walk'; st.amt = 0;
  return true;
}
// Back into the visitor's view like a game character (the viewport is the level): by the route graph when a support in view is
// reachable (walk, climb, drop), else the lost case below. Elizabeth's rule: relocate only while unseen, and always enter the frame.
function comeBack() {
  const p = pickPlace(); st.goal = null; st.route = null; st.toView = true;
  if (p) { const r = plan(p.f, p.x); if (r && r.length) { st.route = r; if (nextLeg()) return; } }
  st.route = null; if (st.away >= 4.5) lost();   // no route: a relocation only once he has been fully off camera for 4 s
}
// The lost case: in by the edge he is beyond. Below the view: a climb in over the bottom edge onto a support within reach of it.
function climbIn() {
  if (ALT && O.y + innerHeight > docH()) return false;   // the bottom of his realm is in view: nothing below it to climb in from
  const E = O.y + innerHeight - 30, c = [];
  for (const f of floors) if (!f.ground && f.y <= E - CFG.size * 1.2 && f.y >= E - CFG.size * (ALT ? 3.5 : 2.2) && f.x2 - f.x1 > 2 * HALF_W + 24) for (let i = 1; i < 8; i++) { const x = f.x1 + (f.x2 - f.x1) * i / 8; if (onFloor(f, x) && clear(x, f.y, CFG.size + 4, 0)) c.push({ f, x }); }
  if (!c.length) return false;
  const p = c[(Math.random() * c.length) | 0];
  st.goal = null; st.route = null; st.floor = null; st.air = false; st.hop = false; st.vx = 0; st.vy = 0; st.dropF = null; st.away = 0; st.z = st.zs = 0; st.peek = false; st.x = p.x; st.dir = p.x < O.x + innerWidth / 2 ? 1 : -1; st.lostN = (st.lostN || 0) + 1;
  st.mode = 'climb'; st.climb = { f: p.f, t0: t, y0: O.y + innerHeight + CFG.size + 10, x0: p.x, xTo: null, hang: 0.3 + Math.random() * 0.3, pull: 0.75 + Math.random() * 0.35 };
  return true;
}
const lost = () => (st.y > O.y + innerHeight ? climbIn() : climbDown()) || walkInSide();   // false: no way yet, he stays where he is
function hopUp(vy) { if (!st.floor || st.mode === 'sit' || (st.sitK || 0) > 0.04) return; st.dropF = st.floor; st.air = true; st.hop = true; st.floor = null; st.vx = 0; st.vy = -vy; st.mode = 'walk'; }   // a hop on the spot comes down on the ledge it left, never past it
function applyOrder(o) {
  if (st.beh) behEnd(false); ENV.MORTAL?.mark?.(WHO, 'rel:' + o.ex, 'bond'); st.relRun = (st.relRun || 0) + 1;   // the bond takes his body: the kernel's move stops, and the order goes on the record
  relClear(); st.relOrder = o; st.spdK = o.spdK || 1; st.crouch = o.crouch || 0;
  const d = ENV.__scion;
  st.relGap = o.goal && d && TRACK.has(o.ex) ? Math.abs(o.goal.x - d.x) : null;
  if (o.pounce) {   // crouch, wiggle, spring: the prep pose is the telegraph
    st.goal = null; st.dir = Math.sign(o.pounce.x - st.x) || st.dir; st.mode = 'prep'; st.amt = 0;
    st.prep = { pounce: o.pounce, t0: t, until: t + ((o.gesture && o.gesture.windup) || 0.3) }; return;
  }
  if (o.goal && relGoal(o, o.goal)) { if (st.mode !== 'walk') { st.mode = 'walk'; restyle(); } return; }
  st.goal = null;   // nowhere he can stand near it (or too high up): he stays put and faces it, with the gesture if there is one, until the order runs out
  if (o.ex === 'protect' && o.gesture) st.dir = o.gesture.side || st.dir;
  else if (!['flee', 'keepaway', 'ignore', 'sulk'].includes(o.ex)) faceDove();
  st.mode = (o.sit || (st.mode === 'sit' && !o.gesture)) && sitRoom(st.x, st.y) ? 'sit' : 'idle';
  st.idleUntil = t + (o.sit ? relLeft(o) : o.gesture ? (o.gesture.windup || 0) + o.gesture.dur + 0.3 : Math.min(relLeft(o), o.goal ? 8 : 4));   // cannot get there: he watches it a while
}
function relArrive(f) {   // got where the order wanted him
  const o = st.relOrder, d = ENV.__scion; if (!o) return;
  if (o.ex !== 'flee' && o.ex !== 'keepaway') faceDove();
  st.mode = o.sit && sitRoom(st.x, f.y) ? 'sit' : 'idle';
  st.idleUntil = t + (o.sit ? relLeft(o) : o.gesture ? (o.gesture.windup || 0) + o.gesture.dur + 0.3 : 0.6 + Math.random());
  const dd = d ? Math.hypot(d.x - st.x, d.y - st.y) : 1e9;
  if (!o.gesture && !o.sit) relEnd('ok', { won: o.ex === 'displace' && dd > 50, stayed: dd < CFG.size * 2 });
}
// Eating: the food's pull (REL.eat: hunger curve x advert x possession) against whatever REL has him doing, with a 1.3x
// commitment to the current one. He walks to food on a floor, leans in and takes 25-35% bites; food in his own hand he eats there.
const goTo = (f, x, extra) => { st.goal = { f, x: Math.max(f.x1 + HALF_W, Math.min(f.x2 - HALF_W, x)), until: t + 25, ...extra }; if (st.mode !== 'walk') { st.mode = 'walk'; restyle(); } };
function foodBite(id) {
  const R = ENV.REL, it = R && R.food(id), F = st.food; if (!it || !F) return;
  const reach = it.st === 'held' || (Math.abs(it.x - st.x) < HALF_W + CFG.size * 0.35 && Math.abs(it.y - st.y) < 10);
  if (reach) { R.bite(WHO, id, 0.25 + 0.1 * Math.random()); F.miss = 0; R.spend(WHO, 0.001); if (F.forced && !R.food(id)) st.food = null; }
  else if (++F.miss >= 3) { R.foodBlock(WHO, id, 20); st.food = null; }   // three misses: not that one, not now
}
function forage(f) {
  const R = ENV.REL, E = R.eat(WHO), F = st.food;
  if (F) {
    const it = R.food(F.id);
    if (!it || (!F.forced && (!E || (E.item.id !== F.id && !(gest && gest.food))))) { st.food = null; if (st.goal && st.goal.food) st.goal = null; return false; }   // full, or it is gone
    const unseen = st.y - O.y > innerHeight + 60 || st.y - O.y < -CFG.size - 40;   // off screen frame() skips his gestures: he still eats, just unanimated
    if (unseen && t > (F.at || 0)) { F.at = t + 1.4; if (it.st === 'held' || (Math.abs(it.x - st.x) < HALF_W + CFG.size * 0.35 && Math.abs(it.y - st.y) < 10)) { foodBite(F.id); return true; } }
    if (it.st === 'held') { if (!gest || !gest.food) { st.mode = 'idle'; st.idleUntil = t + 1.6; gest = { name: 'eat', t0: t, dur: 1.5, side: st.dir, amp: 1, f: 1, food: F.id }; } return true; }
    if (st.goal && st.goal.food) return true;   // on his way
    if (Math.abs(it.x - st.x) < HALF_W + CFG.size * 0.35 && Math.abs(it.y - st.y) < 10) {
      if (!gest || !gest.food) { st.dir = Math.sign(it.x - st.x) || st.dir; st.mode = 'idle'; st.idleUntil = t + 1.5; gest = { name: 'forage', t0: t, dur: 1.4, side: st.dir, amp: 1, f: 1, food: F.id }; }
      return true;
    }
    const g = floorNear(it.x, it.y - 1);
    if (!g || Math.abs(g.f.y - it.y) > 10 || ++F.tries > 3) { R.foodBlock(WHO, F.id, 20); st.food = null; return false; }   // retry up to three walks, then let it be
    goTo(g.f, it.x - (Math.sign(it.x - st.x) || 1) * HALF_W * 0.6, { food: F.id }); return true;
  }
  if (!E || st.held || st.air || st.relBusy || st.dead) return false;
  if (E.u < Math.max(0.12, 1.3 * (st.relOrder ? st.relOrder.u || 0 : 0))) return false;
  if (st.relOrder) relEnd('interrupted');
  st.food = { id: E.item.id, tries: 0, miss: 0 }; ENV.MORTAL?.done(WHO);
  return forage(f);
}
// ---------- his own life between orders (patch 5): a repertoire, chosen with memory by the Mortal Agent kernel ----------
// What he can do is registered once (id, category, utility, duration); the kernel picks with cooldowns, novelty, this visitor's
// persona, commitment and plans (2-4 steps with a purpose), and every execution gets its own speed, size, side and pauses (p).
// RUN[id](p, o, ctx) starts the move and says how it ends: 'goal' (his route/goal resolves), 'gest' (that gesture plays out),
// 'timer' (st.beh.until), or false (cannot, here and now). steps: more RUN-like functions to run in order after the first ends.
const RUN = {};
const gestOf = (name, dur, p, extra) => ({ name, t0: t, dur, side: p.side, amp: p.amp, f: 0.75 + 0.6 * (p.speed - 0.8) / 0.45, beh: 1, ...(extra || {}) });
const feedPull = () => { const R = ENV.REL, h = R && R.needs ? R.needs('dove').hunger : 0; return h > 0.3 && !(R.foods || []).some(it => it.main && it.st !== 'gone') ? 0.3 + 0.9 * h : 0; };   // the bird's hunger, with no meal on the page (REL takes one fresh item at a time)
const standGest = (name, dur, p, extra) => { if (st.mode === 'sit' && !(extra && extra.sit) && st.floor && !clear(st.x, st.floor.y, CFG.size + 4)) return false; if (st.mode === 'sit' && !(extra && extra.sit)) st.mode = 'idle'; if (st.mode !== 'sit') st.mode = 'idle'; st.amt = 0; st.goal = null; st.idleUntil = t + dur + 0.2; gest = gestOf(name, dur, p, extra); return 'gest'; };
const sitGest = (name, dur, p) => { if (!st.floor || !sitRoom(st.x, st.floor.y)) return false; st.goal = null; st.mode = 'sit'; st.idleUntil = t + dur + 0.5; st.pendGest = { ...gestOf(name, dur, p), any: false }; return 'gest'; };
const endX = (f, side) => (side > 0 ? f.x2 - HALF_W - 3 : f.x1 + HALF_W + 3);   // the end of his ledge on that side
const walkOn = (f, x, p, extra) => { if (!f || !pass(x, f.y, CFG.size + 4)) return false; st.spdK = p.speed * ((extra && extra.run) || 1); goTo(f, x, { auto: 1, ...(extra || {}) }); return 'goal'; };
const toPlace = (q, p, extra) => { if (!q) return false; let r = plan(q.f, q.x, q.z || 0); if (r && !r.length) r = null; st.spdK = p.speed * ((extra && extra.run) || 1); if (r) { st.route = r; nextLeg(); } else if (!routeTo(q.f, q.x, { auto: 1 }, q.z || 0)) return false; return 'goal'; };
const drawPlace = (n, pick) => { let p = null, r = null; for (let i = 0; i < n && !r; i++) { const q = pick(); if (!q) break; p = p || q; if ((r = plan(q.f, q.x, q.z || 0)) && !r.length) r = null; if (r) p = q; } return p; };   // up to n draws, the first the graph has a way to wins
const headingEl = title => title ? [...document.querySelectorAll('h1,h2,h3')].find(h => h.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) === title && h.getClientRects().length) : null;
const underEl = el => { if (!el) return null; const r = el.getBoundingClientRect(); return floorNear(r.left + O.x + Math.min(r.width, 300) / 2, r.top + O.y); };
const planPick = (o, ctx) => { if (o && o.plan && o.step === 0 && o.plan.pick) st.planTarget = o.plan.pick(ctx) || null; return o && o.plan ? st.planTarget : null; };
const cursorPt = () => (pointer.in ? { x: pointer.cx + O.x, y: pointer.cy + O.y, what: 'cursor' } : st.tapAt && t - st.tapAt.t < 20 ? { x: st.tapAt.x, y: st.tapAt.y, what: 'touch' } : { x: O.x + innerWidth / 2, y: O.y + innerHeight * 0.85, what: 'visitor' });
const lookAt = (pt, dur) => { if (!pt) return; st.interest = pt; st.glance = { x: pt.x, y: pt.y, until: t + dur }; st.dir = Math.sign(pt.x - st.x) || st.dir; };
const dovePt = () => { const d = ENV.__scion; return d ? { x: d.x, y: d.y - 10, what: 'dove' } : null; };
const REACH = () => CFG.size * 3.5;   // a leap from the screen's edge: up to 3.5 bodies (the climb tween carries him; the hang and pull-up sell it)
const ledgesAbove = () => floors.filter(q => q !== st.floor && !q.ground && !q.screen && q.y < st.y - 8 && q.y >= st.y - REACH() && q.y > O.y + 20 && q.x2 - q.x1 > 2 * HALF_W + 16);
const onLedgeX = q => Math.max(q.x1 + HALF_W + 6, Math.min(q.x2 - HALF_W - 6, st.x));
const overMe = () => ledgesAbove().filter(q => st.x > q.x1 + HALF_W - 1 && st.x < q.x2 - HALF_W + 1 && clear(onLedgeX(q), q.y, CFG.size + 4)).sort((a, b) => b.y - a.y)[0] || null;   // the lowest ledge passing right over him
const grab = (q, x, p) => { if (!q || !clear(x, q.y, CFG.size + 4)) return false; st.goal = null; st.route = null; st.dir = Math.sign(x - st.x) || st.dir; st.mode = 'prep'; st.amt = 0; st.prep = { f: q, dh: st.y - q.y, until: t + 0.12 + 0.12 * p.durK, climb: true, over: x }; return 'goal'; };
Object.assign(RUN, {
  // --- moves (where he goes comes from the kernel's plan or novelty; speed from p) ---
  walk_to: (p, o, ctx) => { const tg = planPick(o, ctx); if (tg) { const q = underEl(tg.el); if (q) return toPlace({ f: q.f, x: q.x + p.side * 18, z: 0 }, p); const r = tg.el.getBoundingClientRect(), k = toPlace(pickToward(Math.sign(r.top + O.y - st.y) || 1), p); if (k) return k; }   // nowhere to stand at it: a step toward it
    return toPlace(drawPlace(4, pickPlace) || pickToward(st.dir), p); },
  run_to: (p, o, ctx) => { const tg = planPick(o, ctx), q = tg ? underEl(tg.el) : null; return toPlace(q ? { f: q.f, x: q.x, z: 0 } : drawPlace(3, pickPlace), p, { run: 1.8 }); },
  sprint_across: p => { const f = st.floor; if (!f || f.x2 - f.x1 < 2 * HALF_W + 120) return false; const x = endX(f, Math.abs(f.x2 - st.x) > Math.abs(st.x - f.x1) ? 1 : -1); return Math.abs(x - st.x) > 100 ? walkOn(f, x, p, { run: 2.2 }) : false; },
  pace: p => { const f = st.floor, x0 = st.x; if (!f) return false; const x1 = Math.max(f.x1 + HALF_W + 4, Math.min(f.x2 - HALF_W - 4, x0 + p.side * (60 + 70 * p.amp))); if (Math.abs(x1 - x0) < 40 || !walkOn(f, x1, p)) return false;
    st.beh.steps = [() => walkOn(f, x0, p)]; return 'goal'; },
  back_away: (p, o, ctx) => { const f = st.floor; if (!f) return false; const from = ctx.dove && ctx.dove.dist < 260 ? ctx.dove : cursorPt(), away = -(Math.sign(from.x - st.x) || st.dir);
    const x = Math.max(f.x1 + HALF_W + 4, Math.min(f.x2 - HALF_W - 4, st.x + away * (120 + 100 * p.amp))); if (Math.abs(x - st.x) < 50) return false; const k = walkOn(f, x, p, { run: 0.8 }); if (k) lookAt(from, 2.5); return k; },
  follow_dove: (p, o, ctx) => { const d = ctx.dove; if (!d) return false; const q = floorNear(d.x - p.side * (60 + 40 * p.amp), d.y); if (!q || q.f.y > O.y + innerHeight - 10) return false; return toPlace({ f: q.f, x: q.x, z: 0 }, p); },
  step_down: p => toPlace(pickToward(1), p),
  climb_up: p => toPlace(pickToward(-1), p),
  hang_edge: p => { const q = pickToward(-1); if (!q || st.y - q.f.y < CFG.size * 1.2) return false; st.hangK = 2.5 + 2 * p.amp; st.beh.lookUp = 1; return toPlace(q, p); },   // the climb, with a long hang looking up
  hop: p => { if (!st.floor || st.mode === 'sit') return false; hopUp(200 + 110 * p.amp); st.beh.until = t + 1.3; return 'timer'; },
  trip_recover: p => { const f = st.floor; if (!f) return false; const x = endX(f, p.side); if (Math.abs(x - st.x) < 160 || !walkOn(f, x, p, { run: 2 })) return false; st.beh.tripAt = t + 0.5 + 0.5 * p.durK; return 'goal'; },
  transit: (p, o, ctx) => { if (!ctx.tr) return false; st.spdK = p.speed; st.route = ctx.tr; st.transitAt = t; return nextLeg() ? 'goal' : false; },
  peek_behind: (p, o, ctx) => { if (!ctx.lanesBack || !laneHop(-1)) return false; st.peek = true; st.beh.until = t + 2.5 + 2 * p.durK; return 'timer'; },
  // --- looking ---
  look_around: p => standGest('look', 2.5 + 2 * p.durK, p),
  read_up: p => { const M = ENV.MORTAL, P = ENV.__pack, dur = 2 + 2 * Math.min(1, Math.max(0, p.durK - 0.75) / 0.65);   // he reads it up: the book out of his backpack (backpack.js), 2-4 s, back in
    const said = b => { const s = M.line(WHO, b); if (s) ENV.__hugoSay(s); };   // what he learned is his next line (one per 45 s, never twice)
    if (P && P.take && !P.busy) { const read = M.lookup(WHO); st.mode = 'idle'; st.goal = null; st.amt = 0; st.beh.until = t + dur + 3;
      P.take('book').then(() => new Promise(r => setTimeout(r, dur * 1000))).then(() => P.stow()).catch(() => {}).then(() => read).then(said, () => {}); return 'timer'; }
    M.lookup(WHO).then(said, () => {}); return sitGest('chin', 2.5 + 1.5 * p.durK, p) || standGest('scratch', 2 + p.durK, p); },   // no backpack: chin in hand
  look_visitor: (p, o) => { const pt = (o && o.x) || cursorPt(); lookAt(pt, 3 * p.durK); st.watch = pointer.in ? t + 3 * p.durK : 0; return standGest('curious', 2.5 + 1.5 * p.durK, p); },
  glance_section: (p, o) => { const el = o && o.x && o.x.el, r = el && el.getBoundingClientRect(); lookAt(r ? { x: r.left + O.x + r.width / 2, y: r.top + O.y, what: 'heading' } : { x: st.x + p.side * 200, y: O.y + innerHeight / 2 }, 2); return standGest('look', 2 + p.durK, p); },
  look_scroll: (p, o) => { const up = (o && o.x && o.x.v || st.scrollV || 1) < 0; lookAt({ x: st.x + p.side * 40, y: st.y + (up ? -1 : 1) * CFG.size * 2, what: 'the page' }, 1.6); return standGest('peer', 1.2 + 0.6 * p.durK, p, up ? { name: 'look' } : {}); },
  stare_dove: (p, o, ctx) => (ctx.dove && ctx.dove.dist < CFG.size * 4 ? standGest('stare', 2 + p.durK, p) : false),
  point_project: (p, o, ctx) => { const el = (ctx.hover && ctx.hover.el) || (st.planTarget && st.planTarget.el); if (!el) return false; const r = el.getBoundingClientRect(); lookAt({ x: r.left + O.x + r.width / 2, y: r.top + O.y + Math.min(r.height, 200) / 2, what: 'project' }, 3); return standGest('point', 2.2 + p.durK, p); },
  // --- rest ---
  sit_edge: p => { const f = st.floor; if (!f || f.screen || f.ground) return false; const x = endX(f, p.side); if (!sitRoom(x, f.y)) return false;
    const sit = () => { st.dir = p.side; return sitGest('kick', 4 + 4 * p.durK, p); }; if (Math.abs(x - st.x) < 12) return sit(); if (!walkOn(f, x, p)) return false; st.beh.steps = [sit]; return 'goal'; },
  lie_down: p => sitGest('lie', 5 + 5 * p.durK, p),
  nap: p => sitGest('nap', 7 + 6 * p.durK, p),
  stand_up_slow: p => { if (st.mode !== 'sit') return false; st.mode = 'idle'; st.idleUntil = t + 1.2; st.pendGest = { ...gestOf('stretch', 2.5 + p.durK, p), any: true }; st.beh.until = t + 3 + p.durK; return 'timer'; },
  stretch: p => standGest('stretch', 2 + 1.5 * p.durK, p),
  yawn: p => standGest('yawn', 2 + p.durK, p, st.mode === 'sit' ? { sit: 1 } : {}),
  // --- fidgets and small business ---
  scratch: p => standGest('scratch', 1.8 + 1.2 * p.durK, p),
  hips: p => standGest('hips', 2 + 1.5 * p.durK, p),
  cross_arms: p => standGest('cross', 2.5 + 2 * p.durK, p),
  dance: p => standGest('dance', 3 + 2.5 * p.durK, p),
  wave: (p, o) => { lookAt((o && o.x) || cursorPt(), 2.5); return standGest('wave', 1.8 + p.durK, p); },
  test_ledge: p => { const f = st.floor; if (!f || f.screen || f.ground) return false; const x = endX(f, p.side); if (Math.abs(x - st.x) > 12 && !walkOn(f, x, p)) return false;
    const peer = () => { st.dir = p.side; return standGest('peer', 1.2 + 0.6 * p.durK, p); }, tap = () => standGest('tap', 1.4 + 0.8 * p.durK, p);
    if (Math.abs(x - st.x) <= 12) { st.beh.steps = [tap]; return peer(); } st.beh.steps = [peer, tap]; return 'goal'; },
  lean_letter: (p, o, ctx) => (ctx.textLedge || ctx.wallNear ? standGest('lean', 3 + 2 * p.durK, p) : false),
  balance_serif: (p, o, ctx) => (ctx.textLedge ? standGest('weight', 2.5 + p.durK, p, { amp: 1.3 * p.amp }) : false),
  kick_crumb: (p, o, ctx) => { const c = ctx.crumb; if (!c) return false; const f = st.floor; if (Math.abs(c.x - st.x) > 24) { if (!f || Math.abs(c.y - f.y) > 12 || !walkOn(f, c.x - (Math.sign(c.x - st.x) || 1) * 22, p)) return false; st.beh.steps = [() => standGest('tap', 1.4, p)]; return 'goal'; } return standGest('tap', 1.4, p); },
  // --- the dove ---
  feed_dove: (p, o, ctx) => (ctx.dove && ENV.__pack && feedPull() > 0 ? (lookAt(dovePt(), 2.5), standGest('feed', 7, p)) : false),   // the seed-bag chain (gesture 'feed'): his own choice, the bird hungry and near
  greet_dove: (p, o, ctx) => (ctx.dove ? (lookAt(dovePt(), 2.5), standGest('greet', 2.2 + p.durK, p)) : false),
  shoo_dove: (p, o, ctx) => (ctx.dove && ctx.dove.dist < CFG.size * 3.5 ? standGest('shoo', 1.8 + p.durK, p) : false),
  // --- the screen's bottom edge during a scroll: a catch, never a home. Each is a different way off it. ---
  edge_run_climb: p => { const f = st.floor, n = ledgesAbove().map(q => ({ q, x: onLedgeX(q) })).filter(o => clear(o.x, o.q.y, CFG.size + 4) && clear(o.x, f.y, CFG.size + 4)).sort((a, b) => Math.abs(a.x - st.x) - Math.abs(b.x - st.x))[0];
    if (n) { if (Math.abs(n.x - st.x) < CFG.size * 0.5) return grab(n.q, n.x, p); const k = walkOn(f, n.x, p, { run: 1.7 }); if (k) { st.beh.steps = [() => grab(n.q, onLedgeX(n.q), p)]; return k; } }   // run to under the nearest ledge in reach, leap for it
    let q = drawPlace(4, pickPlace); if (q) { const k = toPlace(q, p, { run: 1.6 }); if (k) return k; }   // else a way up by the graph (walk along the edge, climb, stepping stones)
    const L = O.x + HALF_W + 8, Rr = O.x + innerWidth - HALF_W - 8, c = cards.filter(c => c.b > O.y && c.t < O.y + innerHeight - 60).sort((a, b) => Math.abs((a.l + a.r) / 2 - st.x) - Math.abs((b.l + b.r) / 2 - st.x))[0];
    const xs = [c && (c.l + c.r) / 2 + p.side * 40, st.x < O.x + innerWidth / 2 ? Rr - 40 : L + 40, st.x < O.x + innerWidth / 2 ? L + 40 : Rr - 40].filter(x => x != null).map(x => Math.max(L, Math.min(Rr, x)));   // none: run along the edge to under the nearest card, else to the far side, looking up for a way
    for (const x of xs) if (Math.abs(x - st.x) >= 100 && clear(x, f.y, CFG.size + 4)) { lookAt({ x, y: O.y + innerHeight * 0.3, what: 'up there' }, 2); return walkOn(f, x, p, { run: 1.8 }); } return false; },
  edge_jump_grab: p => { const q = overMe(); if (!q) return false; st.hangK = 0.6; return grab(q, Math.max(q.x1 + HALF_W + 6, Math.min(q.x2 - HALF_W - 6, st.x + p.side * 10)), p); },   // a card or heading edge passing over him: a leap, a grab, up and over, quick
  edge_hang_look: p => { const q = overMe(); if (!q || st.y - q.y < CFG.size * 1.2) return false; st.hangK = 3 + 2 * p.amp; return grab(q, onLedgeX(q), p); },   // the same leap, then a long hang looking up at where he is going
  edge_hop_ledge: (p, o, ctx) => { if (ctx.edgeFor < 2) return false; if (!st.floor || st.mode === 'sit') return false; lookAt({ x: st.x + p.side * 30, y: O.y + innerHeight * 0.25, what: 'up there' }, 1.5); hopUp(220 + 90 * p.amp);   // two seconds here already: a hop, a look up, and onto whatever ledge is passing
    st.beh.until = t + 1.1; st.beh.steps = [() => { const q = overMe(); return q ? grab(q, onLedgeX(q), p) : (st.beh.until = t + 0.6, 'timer'); }]; return 'timer'; },
  edge_look_up: p => { lookAt({ x: st.x + p.side * 30, y: O.y + innerHeight * 0.2, what: 'up there' }, 2); return standGest('lookup', 1.2 + 0.8 * p.durK, p); },   // a hand over the eyes, scanning for a way up
  edge_shrug: p => { lookAt(cursorPt(), 2); return standGest('hips', 1.2 + 0.8 * p.durK, p); },   // "well?" to the visitor, hands on his hips
  edge_peer_down: p => { st.dir = p.side; lookAt({ x: st.x + p.side * 30, y: O.y + innerHeight + CFG.size, what: 'down there' }, 1.6); return standGest('peer', 1.1 + 0.7 * p.durK, p); },   // a look down over the bottom of the screen
  edge_wave: p => { lookAt(cursorPt(), 2.2); return standGest('wave', 1.4 + 0.8 * p.durK, p); },   // a wave up at the visitor from the edge
  edge_stretch: p => standGest('stretch', 1.6 + 0.9 * p.durK, p),   // waiting for the page to bring something: a stretch
  edge_tap: p => standGest('tap', 1.2 + 0.8 * p.durK, p),   // a foot tapping at the edge
});
// Utilities: needs x context (0..1); the kernel adds novelty, persona and memory. ctx comes from senseCtx() each decision.
const HUGO_REP = [
  { id: 'walk_to', cat: 'move', dur: 6, move: 1, u: c => 0.3 + 0.6 * c.mo.c },
  { id: 'run_to', cat: 'move', dur: 4, move: 1, u: c => 0.15 + 0.5 * c.mo.c + 0.3 * (c.n.energy > 0.6 ? 1 : 0) },
  { id: 'sprint_across', cat: 'move', dur: 3, move: 1, u: c => (c.longFloor && c.n.energy > 0.5 ? 0.45 : 0) },
  { id: 'pace', cat: 'move', dur: 5, move: 1, u: c => 0.2 + 0.5 * c.mo.e },
  { id: 'back_away', cat: 'move', dur: 3, move: 1, u: c => (c.near || (c.dove && c.dove.dist < 200) ? 0.5 : 0.1), on: ['cursor_near'] },
  { id: 'follow_dove', cat: 'social', dur: 6, move: 1, u: c => (c.dove ? 0.3 + 0.4 * c.mo.s : 0) },
  { id: 'step_down', cat: 'move', dur: 4, move: 1, u: c => (c.below ? 0.35 : 0) },
  { id: 'climb_up', cat: 'climb', dur: 5, move: 1, u: c => (c.above ? 0.4 + 0.3 * c.mo.c : 0) },
  { id: 'hang_edge', cat: 'climb', dur: 7, move: 1, u: c => (c.above ? 0.35 : 0) },
  { id: 'hop', cat: 'play', dur: 1.5, u: c => 0.15 + 0.4 * (c.n.energy > 0.6 ? 1 : 0) + 0.2 * (c.dove ? 1 : 0), on: ['dove_landed'] },
  { id: 'trip_recover', cat: 'move', dur: 4, move: 1, u: c => (c.longFloor ? 0.2 : 0) },
  { id: 'transit', cat: 'move', dur: 8, move: 1, u: c => (c.tr ? 0.9 : 0) },
  { id: 'peek_behind', cat: 'look', dur: 4, move: 1, words: ['~rain', '~snow', '~storm', '~cold'], u: c => (c.lanesBack && !c.edge ? 0.2 + 0.6 * c.mo.c : 0) },
  { id: 'look_around', cat: 'look', dur: 3.5, u: c => 0.3 + 0.3 * c.mo.c, on: ['scroll_stop', 'tab_back'] },
  { id: 'look_visitor', cat: 'look', dur: 3, u: c => 0.15 + 0.6 * c.mo.s, on: ['tap', 'cursor_near'] },
  { id: 'glance_section', cat: 'look', dur: 2.5, u: c => (c.freshEl ? 0.4 : 0.1), on: ['section', 'scroll_stop'] },
  { id: 'look_scroll', cat: 'look', dur: 1.6, u: 0.1, on: ['scroll_start'] },
  { id: 'stare_dove', cat: 'social', dur: 3, u: c => (c.dove && c.dove.dist < CFG.size * 4 ? 0.4 : 0), on: ['dove_landed'] },
  { id: 'point_project', cat: 'look', dur: 3, u: c => (c.hover ? 0.8 : 0) },
  { id: 'sit_edge', cat: 'rest', dur: 7, words: ['~sunny', '~warm', '~clear'], avoid: ['~rain', '~snow', '~storm'], u: c => 0.2 + 0.6 * c.fatigue + 0.2 * c.env.sleepy },
  { id: 'lie_down', cat: 'rest', dur: 8, words: ['~night'], u: c => (c.sitting ? 0.3 + 0.6 * c.fatigue : 0.1 + 0.4 * c.fatigue) },
  { id: 'nap', cat: 'rest', dur: 10, words: ['~night', '~dusk'], u: c => 0.6 * c.fatigue + 0.5 * c.env.sleepy },
  { id: 'stand_up_slow', cat: 'rest', dur: 3, u: c => (c.sitting ? 0.5 : 0) },
  { id: 'stretch', cat: 'rest', dur: 3, words: ['limb'], u: c => 0.2 + 0.3 * c.fatigue, on: ['tab_back'] },
  { id: 'yawn', cat: 'rest', dur: 2.5, words: ['~night', '~dusk'], u: c => 0.1 + 0.5 * c.fatigue + 0.3 * c.env.sleepy },
  { id: 'scratch', cat: 'fidget', dur: 2.5, u: 0.25 },
  { id: 'read_up', cat: 'learn', dur: 3, again: 25, u: c => (c.wonder ? 0.5 + 0.5 * c.wonder.s : 0) },   // patch 6: something it does not know about, looked up (the kernel's wonder())
  { id: 'hips', cat: 'fidget', dur: 3, u: 0.2 },
  { id: 'cross_arms', cat: 'fidget', dur: 3.5, u: c => 0.15 + 0.3 * c.mo.s },
  { id: 'dance', cat: 'play', dur: 4.5, words: ['animat', 'danc'], avoid: ['~night', '~cold'], u: c => 0.1 + 0.4 * (c.n.energy > 0.7 ? 1 : 0) },
  { id: 'wave', cat: 'social', dur: 2.5, u: c => 0.1 + 0.4 * c.mo.s, on: ['tab_back', 'tap'] },
  { id: 'test_ledge', cat: 'fidget', dur: 5, move: 1, words: ['physic', 'collision', 'contact'], u: c => (c.f && !c.f.screen && !c.f.ground ? 0.3 + 0.3 * c.mo.c : 0) },
  { id: 'lean_letter', cat: 'fidget', dur: 4, u: c => (c.textLedge || c.wallNear ? 0.45 : 0) },
  { id: 'balance_serif', cat: 'fidget', dur: 3, u: c => (c.textLedge ? 0.4 : 0) },
  { id: 'kick_crumb', cat: 'fidget', dur: 4, move: 1, u: c => (c.crumb ? 0.5 : 0), on: ['crumb'] },
  { id: 'feed_dove', cat: 'social', dur: 7, u: c => (c.dove ? feedPull() : 0), on: ['dove_landed'] },
  { id: 'greet_dove', cat: 'social', dur: 3, u: c => (c.dove ? 0.3 + 0.3 * c.mo.s : 0), on: ['dove_landed'] },
  { id: 'shoo_dove', cat: 'social', dur: 2.5, u: c => (c.dove && c.dove.dist < CFG.size * 3.5 ? 0.3 : 0), on: ['dove_landed'] },
  { id: 'edge_run_climb', cat: 'move', dur: 4, move: 1, edge: 1, u: 1 },
  { id: 'edge_jump_grab', cat: 'climb', dur: 3, move: 1, edge: 1, grab: 1, u: c => (c.over ? 1 : 0) },
  { id: 'edge_hang_look', cat: 'climb', dur: 5, move: 1, edge: 1, grab: 1, u: c => (c.over ? 0.8 : 0) },
  { id: 'edge_hop_ledge', cat: 'play', dur: 2.5, move: 1, edge: 1, u: c => (c.edgeFor >= 2 ? 0.8 : 0) },
  { id: 'edge_look_up', cat: 'look', dur: 2, edge: 1, u: 0.6 },
  { id: 'edge_shrug', cat: 'social', dur: 2, edge: 1, u: c => (c.edgeFor >= 1.5 ? 0.5 : 0) },
  { id: 'edge_peer_down', cat: 'look', dur: 1.8, edge: 1, u: 0.5 },
  { id: 'edge_wave', cat: 'social', dur: 2.2, edge: 1, u: c => (c.edgeFor >= 1.5 ? 0.45 : 0) },
  { id: 'edge_stretch', cat: 'rest', dur: 2.5, edge: 1, u: c => (c.edgeFor >= 2 ? 0.4 : 0) },
  { id: 'edge_tap', cat: 'fidget', dur: 2, edge: 1, u: c => (c.edgeFor >= 1 ? 0.4 : 0) },
];
const NOT = ALT ? new Set(['read_up', 'peek_behind', 'transit', 'follow_dove', 'stare_dove', 'feed_dove', 'greet_dove', 'shoo_dove', 'kick_crumb']) : null;   // ALT: no dove, no back lane, no lookups (the fetch budget is Hugo's and the dove's); and he is the restless one (moves weigh 1.8x): his realm is one section
const HUGO_PLANS = [   // purpose first: a trip has a payoff at its end (the research notes: "walk with no payoff does not exist in the table")
  { goal: 'explore', purpose: 'see what is new here', when: c => (c.freshEl ? 0.5 + 0.5 * c.mo.c : 0), pick: c => c.freshEl && { el: c.freshEl }, steps: ['walk_to', 'look_around', 'sit_edge', 'look_visitor'] },
  { goal: 'attention', purpose: 'show the visitor what they are looking at', when: c => (c.hover ? 0.9 : 0), pick: c => c.hover, steps: ['walk_to', 'point_project', 'look_visitor', 'back_away'] },
  { goal: 'rest', purpose: 'a rest on an edge', when: c => 0.4 * c.fatigue + 0.3 * c.env.sleepy, steps: ['walk_to', 'sit_edge', 'yawn', 'nap'] },
  { goal: 'feed', purpose: 'feed the hungry bird', when: c => (c.dove ? feedPull() : 0), steps: ['follow_dove', 'feed_dove'] },
  { goal: 'play', purpose: 'play with the dove', when: c => (c.dove ? 0.3 + 0.4 * (c.n.energy > 0.6 ? 1 : 0) : 0), steps: ['follow_dove', 'greet_dove', 'hop'] },
  { goal: 'inspect', purpose: 'inspect this ledge', when: c => (c.f && !c.f.screen && !c.f.ground ? 0.2 + 0.4 * c.mo.c : 0), steps: ['test_ledge', 'peek_behind', 'back_away'] },
  { goal: 'study', purpose: 'go and see the card he read about', when: c => (c.know && c.know.card && headingEl(c.know.card.title) ? 0.9 : 0), pick: c => c.know.card && { el: headingEl(c.know.card.title) }, cite: c => c.know.card && c.know.card.b, steps: ['walk_to', 'point_project', 'look_around'] },
  { goal: 'traverse', purpose: 'up, across and down again', when: c => (c.above && c.n.energy > 0.5 ? 0.35 : 0), steps: ['climb_up', 'sprint_across', 'step_down'] },
];
if (ENV.MORTAL && ENV.MORTAL.repertoire) ENV.MORTAL.ready.then(() => { ENV.MORTAL.repertoire(WHO, NOT ? HUGO_REP.filter(r => !NOT.has(r.id)).map(r => (r.move ? { ...r, u: c => 1.8 * (typeof r.u === 'function' ? r.u(c) : r.u) } : r)) : HUGO_REP); ENV.MORTAL.plans(WHO, NOT ? HUGO_PLANS.filter(p => !p.steps.some(s => NOT.has(s))) : HUGO_PLANS); });
// What the world did: noticed by the kernel (150-300 ms), budgeted, answered by the behaviours above that list the event.
const notice = (type, x) => ENV.MORTAL && ENV.MORTAL.notice && ENV.MORTAL.notice(WHO, type, x);
let scrollStopT = 0;
addEventListener('scroll', () => { const now = performance.now(); if (now - scrolledAt > 400) notice('scroll_start', { v: O.y - curSY }); clearTimeout(scrollStopT); scrollStopT = setTimeout(() => notice('scroll_stop'), 250); }, { passive: true });
addEventListener('pointerdown', e => { if (st.held || e.target === hit || e.target.closest?.('#' + hit.id)) return; st.tapAt = { x: e.clientX + O.x, y: e.clientY + O.y, t, el: e.target.closest && e.target.closest('.realm, .poster, .stage, .phone-wrap, .mrow') }; notice('tap', { x: st.tapAt.x, y: st.tapAt.y, what: 'touch' }); }, { passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) notice('tab_back'); });
function hoverCard() {   // the project the visitor is on: the card under the cursor (desktop), or the one tapped in the last 8 s (phone)
  let el = null;
  if (pointer.in && performance.now() - pointer.movedAt < 8000) { const o = document.elementFromPoint(pointer.cx, pointer.cy); el = o && o.closest && o.closest('.realm, .poster, .stage, .phone-wrap, .mrow'); }
  if (!el && st.tapAt && t - st.tapAt.t < 8) el = st.tapAt.el;
  if (!el || el.closest(skipSel)) return null;
  return { el: el.querySelector('h2, h3') || el, card: el };
}
function senseCtx(f) {
  const M = ENV.MORTAL, R = ENV.REL, n = R.needs(WHO), mo = M.mot(WHO), d = ENV.__scion, now = performance.now();
  const dove = d && d.mode === 'perch' && !d.held && Math.abs(d.y - (O.y + innerHeight / 2)) < innerHeight ? { x: d.x, y: d.y, dist: Math.hypot(d.x - st.x, d.y - st.y) } : null;
  if (d) { if (d.mode === 'perch' && st.doveMode === 'fly' && dove && dove.dist < 360) notice('dove_landed', dovePt()); st.doveMode = d.mode; }
  const foods = R.foods ? R.foods.filter(it => it.settled && it.st !== 'gone' && it.holder !== WHO) : [], crumb = foods.find(it => Math.abs(it.x - st.x) < 240 && Math.abs(it.y - st.y) < 14) || null;
  if (foods.length > (st.foodsN || 0) && crumb) notice('crumb', crumb); st.foodsN = foods.length;
  if (t > (st.secAt || 0) && now - scrolledAt > 300) { st.secAt = t + 1; const mid = O.y + innerHeight * 0.45; let best = null, bd = 1e9;   // the section the visitor is reading: the heading nearest the middle of the view
    for (const h of document.querySelectorAll('h1,h2')) { const r = h.getBoundingClientRect(); if (!r.height) continue; const dy = Math.abs(r.top + O.y - mid); if (dy < bd) { bd = dy; best = h; } }
    if (best && best !== st.secEl) { if (st.secEl) notice('section', { el: best }); st.secEl = best; } }
  const freshT = M.unvisitedInView(WHO)[0], freshEl = freshT ? headingEl(freshT) : null;
  const tr = st.z === 0 && !f.screen && t - (st.transitAt ?? -1e9) > 40 && !((st.transitTry || 0) > t) ? (st.transitTry = t + 5, transitRoute()) : null;   // a card to go through (dear to look for: every 5 s at most)
  return { f, edge: !!f.screen, edgeFor: f.screen ? t - (st.edgeSince ?? t) : 0, scrolling: now - scrolledAt < 400, sitting: st.mode === 'sit', near: pointer.near, hover: hoverCard(), dove, n, mo, env: M.env, fatigue: M.fatigue(n.energy), freshEl, crumb,
    textLedge: !!f.text, wallNear: walls.some(w => w.f === f && t - w.t < 8), lanesBack: st.z === 0 && st.lanes.includes(-1), above: !!pickToward(-1), over: !!(f.screen && overMe()), below: !f.screen && !!pickToward(1), longFloor: f.x2 - f.x1 > 2 * HALF_W + 220, tr };
}
function behEnd(ok) { const B = st.beh; if (!B) return; st.beh = null; st.spdK = 1; st.hangK = null; ENV.MORTAL.ended(WHO, ok); st.idleUntil = Math.max(st.idleUntil || 0, t + (ok ? B.p.after : 0.4)); }
const tryRun = fn => { try { return fn(); } catch (e) { if (!tryRun.warned) { tryRun.warned = 1; console.warn('hugo behaviour failed', st.beh && st.beh.id, e); } return false; } };   // one bad move never stalls the frame
function behFree() { return !st.goal && !(st.route && st.route.length) && !st.air && !['prep', 'climb', 'lane', 'crawl'].includes(st.mode) && !(st.mode === 'walk' && st.amt >= 0.05); }
function autonomy(f) {
  const M = ENV.MORTAL; if (!M || !M.next || !M.alive(WHO) || st.relOrder || st.food || st.held || st.dead || st.enter) return;
  if (f && f.screen) { st.edgeSince ??= t; } else st.edgeSince = null;
  // Off camera for a moment while the visitor is not scrolling: back into view (a reflex, not a choice); AI otherwise sleeps off camera
  if (st.away >= 1.5 && performance.now() - scrolledAt > 400 && !['prep', 'climb', 'lane', 'crawl'].includes(st.mode) && !(st.toView && (st.goal || (st.route && st.route.length)))) { if (st.beh) behEnd(false); comeBack(); return; }
  const B = st.beh;
  if (B) {   // something under way
    if (B.failed) return behEnd(false);
    if (!B.kind) { if (t < B.startAt) return; const k = tryRun(() => RUN[B.id](B.p, B.o, B.ctx)); if (!k) return behEnd(false); B.kind = k; return; }   // the pause before, then the move itself
    if (B.tripAt && t > B.tripAt && st.mode === 'walk' && !st.air) { B.tripAt = 0; st.goal = null; st.amt = 0; st.mode = 'idle'; st.squash = 0.55; st.sqAt = t; kickDust(st.x, st.y, 4); st.idleUntil = t + 2; gest = gestOf('dust', 1.8, B.p); B.kind = 'gest'; return; }   // a toe caught: a stumble, dust, brushing himself off
    if (B.lookUp && st.mode === 'climb' && st.climb) { lookGoal = st.dir * 0.3; st.glance = { x: st.x + st.dir * 60, y: st.climb.f.y - CFG.size, until: t + 0.3 }; }
    if (Math.abs(st.x - (B.lastX ?? st.x)) > 3 || st.air || st.mode === 'climb' || st.mode === 'prep') { B.lastX = st.x; B.movedAt = t; } else B.lastX ??= st.x;
    if (f && f.screen && B.kind === 'goal' && t - (B.movedAt ?? B.startAt) > 1.5) { st.goal = null; st.route = null; return behEnd(false); }   // on the edge a move that goes nowhere for 1.5 s is over: the next one takes it
    const over = B.kind === 'goal' ? behFree() : B.kind === 'gest' ? !(gest && gest.beh) && !(st.pendGest && st.pendGest.beh) : t > (B.until || 0);
    if (!over) { if (!(f && f.screen)) return; } else if (B.steps && B.steps.length) { const k = tryRun(B.steps.shift()); if (!k) return behEnd(false); B.kind = k; return; } else return behEnd(true);
  }
  if (!inView()) return;   // off camera he waits for the come-back
  if (f && f.screen ? t < (st.decideAt || 0) : (t < (st.decideAt || 0) || t < st.idleUntil || !behFree())) return;
  st.decideAt = t + (f && f.screen ? 0.25 : 0.4);
  const ctx = senseCtx(f), o = M.next(WHO, ctx); if (!o) return;
  if (st.beh) { st.goal = null; st.route = null; if (gest && gest.beh) gest = null; st.pendGest = null; st.spdK = 1; st.hangK = null; }   // the kernel cut in (an interrupt, the edge): what he was doing stops here
  st.beh = { id: o.id, p: o.p, o, ctx, kind: null, startAt: t + (o.ev || ctx.edge ? 0 : o.p.before) }; if (!ctx.edge) st.relRun = 0;
  if (o.belief && (!o.plan || o.id === 'point_project')) { const s = M.line(WHO, o.belief); if (s) ENV.__hugoSay(s); }   // a choice a belief made: he says the fact (one line per 45 s, never twice)
}
function relStep(f) {
  const R = ENV.REL; if (!R || t < (st.relAt || 0) || st.dead || st.dazed || st.mode === 'crawl' || (st.crawlK || 0) > 0.05) return;   // no standing up under a low ceiling for the bird
  if (st.enter) return;   // the entrance plays out first
  st.relAt = t + 0.75;
  if (forage(f)) return;
  if (st.z !== 0 && st.route && st.route.length) { if (!st.goal && st.mode !== 'lane') nextLeg(); return; }   // mid-transit behind the page: the bird's orders wait, he finishes the crossing (an order that stopped him here would leave him hidden)
  const d = ENV.__scion;
  const reach = !!d && d.mode === 'perch' && !d.held && d.y >= st.y - UP && floors.some(q => Math.abs(q.y - d.y) < 6 && d.x > q.x1 && d.x < q.x2);
  const o = R.want(WHO, { reach, floorY: f.y });
  if (!o || (st.away >= 1.5 && !o.goal && !o.pounce) || st.away >= 4.5) { if (st.relOrder) relEnd('interrupted'); autonomy(f); return; }   // fully off camera for 4.5 s: any order yields, nobody sees it   // out of view, an order that keeps him standing (a sulk, a stare) yields to getting back where he is seen
  if (!st.relOrder && (st.relRun || 0) >= 2) { if (!(st.relHold > 0)) st.relHold = t + 6 + Math.random() * 4; if (t < st.relHold) { autonomy(f); return; } st.relHold = 0; st.relRun = 0; }   // two bond orders without a move of his own between: his own life gets a turn (6-10 s) before the bird again
  if (o.id !== (st.relOrder && st.relOrder.id)) applyOrder(o);
  else if (st.relGap != null && st.goal && st.goal.rel === o.id && d && (d.mode === 'perch' || o.ex === 'chase')) relGoal(o, { x: d.x - (Math.sign(d.x - st.x) || 1) * st.relGap, y: d.y });   // the bird moved: after it
  if (f.screen && st.relOrder && !st.pounce && st.mode !== 'prep' && st.mode !== 'climb' && (!st.goal || st.goal.x <= O.x + HALF_W * 1.5 || st.goal.x >= O.x + innerWidth - HALF_W * 1.5)) { relEnd('interrupted'); st.relAt = t + 3; return; }   // on the screen's edge an order that leaves him standing (or walking into the screen's side) yields: off the edge first, the bird in 3 s
  const ph = R.phase; st.relBusy = !!(st.relOrder && ph && ph.stage !== 'resolve');
}
let returning = false; try { const ls = +localStorage.getItem(WHO + '.lastSeen') || 0; returning = ls > 0 && Date.now() - ls > 3600e3; localStorage.setItem(WHO + '.lastSeen', Date.now()); } catch {}   // he remembers you were here
let bornTries = 0, lastSY = 0, curSY = 0, jumpAt = -1e9;   // lastSY: the scroll before the latest jump, to keep him put on screen across a view switch
function born() {   // first appearance (patch 5, item 0): an entrance, never a pop-in. He walks in from the nearer side of the screen along his
  // target ledge's line and arrives within ~1.5 s: onto the hero name when it is in view (somewhere new along it each load), else onto a
  // ledge in view that reaches the screen's side; with none, a climb in over the bottom edge (never from the top).
  const spots = inView => { const c = [];
    for (const f of floors) if ((!inView || (f.y > O.y && f.y < O.y + innerHeight)) && f.x2 - f.x1 > 160 && (inView || !f.ground)) {
      const n = Math.ceil((f.x2 - f.x1) / 6);   // small clear gaps are often all there is, so look along the whole ledge
      for (let i = 1; i < n; i++) { const x = f.x1 + (f.x2 - f.x1) * i / n; if (onFloor(f, x) && clear(x, f.y, CFG.size + 4)) c.push({ f, x }); }
    }
    return c; };
  if (ALT) {   // he loads seated (the one thing he does not share with Hugo): on a ledge of the scan, in view, with room to sit and for his legs to hang
    const now = performance.now(); if (now - realm.at < 500) return false; if (scanAt < realm.at + 450) { dirty = true; return false; }   // a sheet slides in for a moment: he is seated once it has settled and been measured
    const c = []; for (const f of floors) if (!f.ground && f.y > O.y + SIT_H + 8 && f.y < O.y + innerHeight - CFG.size * 0.4) for (let x = f.x1 + HALF_W; x <= f.x2 - HALF_W; x += 6) if (x > O.x + HALF_W && x < O.x + innerWidth - HALF_W && sitRoom(x, f.y)) c.push({ f, x });
    if (!c.length) return false;
    const by = new Map(); for (const q of c) (by.get(q.f) || by.set(q.f, []).get(q.f)).push(q);   // a ledge first (the title's letters before a box top, a box top before a hairline), then a seat on it
    const fs = [...by.keys()], wt = f => (f.text ? 3 : f.box ? 2 : 1e-4); let r = Math.random() * fs.reduce((a, f) => a + wt(f), 0), pf = fs[0]; for (const f of fs) if ((r -= wt(f)) <= 0) { pf = f; break; }
    const p = by.get(pf)[(Math.random() * by.get(pf).length) | 0];
    st.floor = p.f; st.x = p.x; st.y = footY(p.f, p.x); st.dir = p.x < O.x + innerWidth / 2 ? 1 : -1; st.mode = 'sit'; st.sitK = 1; st.amt = 0; st.idleUntil = t + 2.5 + Math.random() * 3; st.bornOnce = true; st.yaw = null;
    return true;
  }
  let tgt = null, sit = false;
  if (!bornTries && !st.bornOnce) {
    const xs = []; for (const nm of floors) if (nm.name && nm.y > O.y && nm.y < O.y + innerHeight) for (let x = nm.x1 + HALF_W * 0.6; x <= nm.x2 - HALF_W * 0.6; x += 6) if (sitRoom(x, nm.y)) xs.push({ f: nm, x });   // both words, end to end: he sits on his name (standing there would put his head in the nav)
    if (xs.length) { tgt = xs[(Math.random() * xs.length) | 0]; sit = true; }
  }
  if (!tgt) {
    let c = spots(true).filter(p => p.f.x1 <= O.x + 40 || p.f.x2 >= O.x + innerWidth - 40);   // a ledge that reaches the screen's side: a walk-in
    if (!c.length && (bornTries = (bornTries || 0) + 1) > 90) c = spots(false);   // nothing for ~1.5 s: start anywhere he fits
    if (!c.length) { if (bornTries > 6 && climbIn()) { st.bornOnce = true; st.lostN = 0; ENV.MORTAL?.signal?.(WHO, 'BODY_READY', { x: st.x, y: st.y, side: 0, dur: 1.2 }); return true; } return false; }   // no ledge to walk in on: in over the bottom edge (enters the frame; not a loss); else he tries again next frame
    tgt = c[(Math.random() * c.length) | 0];
  }
  const side = tgt.x < O.x + innerWidth / 2 ? -1 : 1, x0 = side < 0 ? O.x - HALF_W * 1.6 : O.x + innerWidth + HALF_W * 1.6;   // from the nearer side, fully off-screen
  st.enter = { f: tgt.f, x: tgt.x, x0, t0: t, dur: 1.2 + Math.random() * 0.3, sit };
  st.floor = tgt.f; st.x = x0; st.y = footY(tgt.f, tgt.x); st.dir = -side; st.mode = 'walk'; st.amt = 0; st.ph = Math.random(); st.bornOnce = true;
  ENV.MORTAL?.signal?.(WHO, 'BODY_READY', { x: tgt.x, y: st.y, side, dur: st.enter.dur });   // the dove's cue: he is coming in from this side, on this line
  if (returning) st.pendGest = { name: 'wave', dur: 2.4, side: 1, amp: 1, any: true };
  return true;
}
function refloor(f) {   // the page reflows; keep the floor glued to its element
  if (f.screen) { const E = O.y + innerHeight - 30; return f.y - E > -40; }   // the screen's bottom edge where he stepped onto it: it never carries him up (a scroll up or the iOS toolbar coming back leaves him below the view; the come-back climb brings him in), and lets go when the view moves on down (he falls to the next ledge)
  if (f.fr && (!simple() || !f.fr.getClientRects().length)) return false;   // a ledge in the Read less frame is gone once the frame is
  if (f.ground) { f.y = groundY(); f.x2 = ALT ? docW() : document.documentElement.scrollWidth; fit(f); return true; }
  if (!f.el.isConnected || !f.el.getClientRects().length) return false;   // its element was hidden (a view switch): the floor is gone, he falls
  const fo = f.fr ? f.fr.getBoundingClientRect() : null, ox = O.x + (fo ? fo.left : 0), oy = O.y + (fo ? fo.top : 0);   // fo: a floor inside the Read less frame
  if (f.text) { const r = f.el.getBoundingClientRect(); const dy = (r.top + oy) - (f.elTop ?? (f.elTop = r.top + oy)); if (dy) { f.y += dy; f.elTop += dy; if (f.runs) for (const u of f.runs) u.top += dy; } return true; }
  const r = f.el.getBoundingClientRect(), top = r.top + oy, bottom = r.bottom + oy;
  f.x1 = f.u1 = r.left + ox; f.x2 = f.u2 = r.right + ox; clipX(f); fit(f); f.y = Math.abs(f.y - bottom) < Math.abs(f.y - top) ? bottom : top; return true;
}
function settle(f, dt) {   // arriving (or stopped for a sit): the stride winds down over ~0.4 s and the body keeps its momentum through it (feet in phase with the ground), never a dead stop
  if (st.amt > 0) { const d = st.slideDir || st.dir, go = gait(st.amt), nx = st.x + d * walkSpeed() * go * dt * (st.spdK || 1);
    if (onFloor(f, nx) && Math.abs(footY(f, nx) - st.y) <= 6 && pass(nx + d * 10, f.y, CFG.size + 4)) { st.x = nx; st.ph += dt * sty.cadence * go; } }
  st.amt = Math.max(0, st.amt - dt * 2.5);
}
function step(dt) {   // the body's own velocity and acceleration, measured from where he actually went (only on the ground: in the air and in your hand st.vx is the integrator's)
  const x0 = st.x, ground = !st.air && !st.held;
  stepBody(dt);
  if (ground && !st.air && !st.held) { const v = (st.x - x0) / dt; st.ax += ((v - st.vx) / dt - st.ax) * Math.min(1, dt * 10); st.vx = v; } else st.ax = 0;
}
function stepBody(dt) {
  if (st.held) {   // he hangs from the hand: a stiff spring to the pointer, so the body lags and swings a little
    const ax = (st.px - st.x) * 180 - st.vx * 22, ay = (st.py - st.y) * 180 - st.vy * 22;
    st.vx += ax * dt; st.vy += ay * dt; st.x += st.vx * dt; st.y += st.vy * dt;
    if (ALT) { st.x = Math.max(HALF_W, Math.min(docW() - HALF_W, st.x)); st.y = Math.max(ROOF ? CFG.size : -1e9, Math.min(docH(), st.y)); }   // in the hand too he stays in his realm
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
    if (ROOF && st.y < CFG.size && st.vy < 0) { st.y = CFG.size; st.vy = 0; }   // ALT: his realm's top is a ceiling
    const W = docW();
    if (st.x < HALF_W) { st.x = HALF_W; st.vx = Math.abs(st.vx) * 0.5; } else if (st.x > W - HALF_W) { st.x = W - HALF_W; st.vx = -Math.abs(st.vx) * 0.5; }
    swingLimbs(dt, (st.vx - lastVx) / dt, (st.vy - lastVy) / dt + G, 0.7); lastVx = st.vx; lastVy = st.vy;
    st.tilt += ((st.vx * 0.0005) - st.tilt) * Math.min(1, dt * 4);
    let f = landingBelow(st.x, py - 1, !st.hop && !st.pounce);
    if (st.dropF && (!f || f.y > st.dropF.y)) f = st.dropF;   // the ledge he chose to step down to catches him
    const E = O.y + innerHeight - 30;   // the screen's bottom edge catches him only when he falls through it from above: a view that moved up past him never snaps him up onto it
    if (!ALT && py <= E && st.y > E && (!f || f.y > E)) f = { y: E, x1: 0, x2: pageW, el: document.body, screen: true, support: true };
    st.landF = f;   // where his shadow falls while he is up
    const ly = f ? footY(f, st.x) : 0;   // where his feet land: the letter tops under him on a text ledge
    if (f && st.y >= ly && st.vy > 0) { if (f === st.dropF) st.x = Math.max(f.x1 + HALF_W, Math.min(f.x2 - HALF_W, st.x)); st.dropF = null; st.y = footY(f, st.x); st.floor = f; st.air = false; st.squash = Math.max(0.4, Math.min(1, st.vy / 600)); st.sqAt = t; if (st.vy > 420) kickDust(st.x, st.y, 3 + Math.round(5 * Math.min(1, (st.vy - 420) / 600))); st.vy = 0; st.vx = 0; st.land = 0.23; st.hop = false; st.mode = 'walk'; st.tilt = 0;   // land: a squash (x1.3, y0.7) recovering in ~0.23 s (Celeste's 1.75/s)
      if (st.pounce) { ENV.REL?.ev(WHO, 'pounceLand', 'dove', 0, { x: st.x, y: st.y }); st.pounce = null; relEnd('ok'); st.mode = 'idle'; st.idleUntil = t + 0.8; }
      else if (gest && gest.rel) st.mode = 'idle';
      if ((st.shaken || 0) > 0.35) { ENV.REL?.ev(WHO, 'fell', null, Math.min(0.8, st.shaken), { x: st.x, y: st.y }); poke('landed hard'); }
      if ((st.shaken || 0) > 0.35) { st.mode = 'idle'; st.idleUntil = t + 2.5 + st.shaken * 5; gest = { name: st.shaken > 0.65 ? 'breathe' : pickOf(['dust', 'breathe', 'look']), t0: t, dur: 2.5 + st.shaken * 5, side: Math.random() < 0.5 ? -1 : 1, amp: 0.7 + st.shaken * 0.5, f: 1 }; }
      st.shaken = 0; st.stress = (st.stress || 0) * 0.5; for (const L of Object.values(limbs)) { L[0] = 0; L[1] = 0; } }
    else if (st.y > docH() + (ALT ? CFG.size : 400)) { if (ALT) st.bornOnce = false; st.air = false; st.floor = null; st.pounce = null; relEnd('interrupted'); }   // fell off the world: born again
    return;
  }
  st.tilt += (0 - st.tilt) * Math.min(1, dt * 6);
  if (st.mode === 'climb') {   // jump, catch the edge, hang a moment, pull himself up and get a knee over
    const C = st.climb; if (!refloor(C.f)) { st.mode = 'walk'; st.air = true; st.climb = null; return; }
    const e = (a, b, u) => a + (b - a) * (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);   // ease in-out
    if (C.down) {   // hand over hand down a card's side (the hang pose, legs swinging), ~110 px/s, then let go above the ledge
      C.yTo = C.f.y - CFG.size * 0.9;   // the ledge as it is now (refloor above): a ledge that shifted mid-climb never leaves him hanging below it, to be snapped up on the drop
      const k = t - C.t0, dur = Math.max(0.6, Math.abs(C.yTo - C.y0) / 110); C.ph = 'hang'; C.u = Math.min(1, k / dur);
      st.y = C.y0 + (C.yTo - C.y0) * C.u; st.x = C.x0 + Math.sin(k * 6) * 1.5;
      if (C.u >= 1) { st.climb = null; st.mode = 'walk'; st.air = true; st.hop = false; st.vx = C.up ? Math.sign((C.f.x1 + C.f.x2) / 2 - st.x) * (HALF_W * 2 + 6) / Math.sqrt(2 * CFG.size * 0.9 / G) : 0; st.vy = 0; st.dropF = C.f; }   // the last body height: a drop he lands from
      return;
    }
    const T1 = 0.32, T2 = T1 + C.hang, T3 = T2 + C.pull, k = t - C.t0, hangY = C.f.y + CFG.size * 1.02;
    if (k < T1) { C.ph = 'reach'; C.u = k / T1; st.y = e(C.y0, hangY, C.u); }
    else if (k < T2) { C.ph = 'hang'; C.u = (k - T1) / C.hang; st.y = hangY + Math.sin(C.u * Math.PI) * 3; }
    else if (k < T3) { C.ph = 'pull'; C.u = (k - T2) / C.pull; st.y = e(hangY, C.f.y, C.u); if (C.xTo != null) st.x = e(C.x0, C.xTo, C.u); }   // up the face and over the top
    else { st.floor = C.f; if (C.xTo != null) st.x = C.xTo; st.y = footY(C.f, st.x); st.mode = 'walk'; st.land = 0.25; st.climb = null; }
    return;
  }
  const f = st.floor; if (!f) return;
  if (!refloor(f)) { poke('ledge gone'); st.floor = null; if (!f.screen && performance.now() - jumpAt < 800) st.y += O.y - lastSY; jumpAt = -1e9; st.air = true; st.hop = false; st.vx = 0; st.vy = 0; st.mode = 'walk'; return; }   // his ledge is gone (a view switch, the screen edge moved on): same spot on screen, then he drops to the next one
  st.y = footY(f, st.x);
  // the page shifted under him (an app loaded, a block grew): if his spot now runs through words, step off and fall to a clear floor
  const room = () => pass(st.x, f.y - 4, (st.mode === 'sit' ? SIT_H : st.mode === 'crawl' || (st.crawlK || 0) > 0.05 ? CRAWL_H : CFG.size) + 4);   // staying needs less than arriving: his own line settling a few px (fonts, the hero) is no reason to fall; the nav sliding over him is (he steps down out of it)
  if ((f.screen || f.ground) && st.z === 0 && st.mode !== 'lane' && !st.held && !room()) {   // the catch floor runs through words: never in front of them. Behind them (dimmed, out again where his whole body clears: backOut) while a support is found; with no back lane here, the nearest clear spot along the edge (he cannot walk out of a word he is already in: every step is a wall)
    if (laneHop(-1)) st.backUntil = t + 3;
    else { let x = null; for (let k = 1; k < 40 && x == null; k++) for (const q of [st.x + k * 20, st.x - k * 20]) if (q > O.x + HALF_W && q < O.x + innerWidth - HALF_W && clear(q, f.y, CFG.size + 4)) { x = q; break; } if (x != null) st.x = x; }
    st.catchTry = 0;
  }
  if (!f.ground && !f.screen && st.mode !== 'prep' && !st.enter && !room() && performance.now() - scrolledAt > 250 && !(performance.now() - scanAt > 100 && (scan(), room()))) { poke('no room: ' + st.mode); st.air = true; st.vx = 0; st.vy = 0; st.floor = null; st.mode = 'walk'; return; }   // a stale scan (the hero settling a few px) is no reason to fall; look again first (mid-scroll: neither a fall nor a rescan until it stops)
  if ((st.markAt || 0) < t) { seenAt.set(cell(st.x, st.y), t); st.markAt = t + 1; }
  if (!st.anchor || Math.hypot(st.x - st.anchor.x, st.y - st.anchor.y) > 160) st.anchor = { x: st.x, y: st.y, t };
  if (st.mode === 'lane') {   // mid-hop between lanes: nothing else happens until he lands in the new one
    const H = st.hopL, u = Math.min(1, (t - H.t0) / H.dur), e = u * u * (3 - 2 * u);
    st.zs = H.from + (H.to - H.from) * e; st.hopY = Math.sin(Math.PI * u) * CFG.size * 0.16;
    if (u >= 1) { st.z = H.to; st.zs = H.to; st.hopY = 0; st.hopL = null; st.mode = 'walk'; st.land = 0.12; st.backUntil = t + (st.peek ? 2 + Math.random() * 2 : 4 + Math.random() * 2);   // behind: a transit (<= 6 s) or a peek (<= 4 s)
      if (H.to === 0 && st.peek) { st.peek = false; st.peekAt = t + 20 + Math.random() * 10; }
      if (!(st.route && st.route.length && nextLeg()) && !st.goal) { st.mode = 'idle'; st.idleUntil = t + 0.6; } }
    return;
  }
  // in the back lane: out again once its time is up or the section's w closes the lane (where he fits on the content). Only an exit
  // goal may hold this off: a goal he cannot finish kept him behind the words for half a minute
  if (st.z !== 0 && !(st.route && st.route.length && (st.goal || st.mode === 'lane')) && (t > (st.backUntil || 0) || !st.lanes.includes(st.z)) && st.mode !== 'prep' && st.mode !== 'crawl' && (st.sitK || 0) < 0.04 && (!st.relBusy || t > (st.backUntil || 0) + 3)) {   // a bird order holds the way out for 3 s at most
    if (!laneHop(0) && !(st.goal && st.goal.exit) && (st.backTry || 0) < t) { st.backTry = t + 3; if (!backOut(f) && !st.goal && t > (st.backUntil || 0) + 3) { st.z = 0; st.peek = false; st.floor = null; st.air = true; st.vx = 0; st.vy = 0; st.mode = 'walk'; poke('dropped back out onto the page'); return; } }
  }
  if (f.screen && st.idleUntil > t + 1.2) st.idleUntil = t + 1.2;   // the screen's edge is no home: no dwell there (a sit, a sulk, a hemmed-in wait) outlives a second
  if (st.mode !== 'prep') { if (f.screen && !st.relOrder) autonomy(f); relStep(f); }   // and he decides every frame there, not at REL's beat
  if (st.dazed && st.mode === 'walk') { st.mode = 'idle'; st.idleUntil = t + 0.5; }   // seeing stars: he stands where he is
  if (st.mode === 'walk') {
    if (st.enter) {   // the entrance: in from the screen's side along the ledge's line, feet in step with the ground, slowing into the spot
      const E = st.enter, u = E.u = Math.min(1, (E.u || 0) + Math.min(dt, 0.05) / E.dur), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, nx = E.x0 + (E.x - E.x0) * e;   // in-out: a first step in from the edge, slowing into the spot   // progress per rendered frame (50 ms at most): the heavy first second renders few frames, and the walk must be seen
      st.ph += Math.abs(nx - st.x) / cycleLen(); st.x = nx; st.amt = u < 0.8 ? Math.min(1, st.amt + dt * 3) : Math.max(0.2, st.amt - dt * 3); st.brake = 1;
      (st.enterLog || (st.enterLog = [])).length < 400 && st.enterLog.push([Math.round(nx - O.x), Math.round(st.y - O.y)]);   // every rendered frame of the walk-in, viewport px (the harness's entrance check)
      if (u >= 1) {
        if (E.sit && !E.moved && !sitRoom(st.x, f.y)) {   // the letters moved under him since he set out (the web font landed): the nearest spot along the name with sitting room, a few more steps
          let nx = null; for (let k = 1; k < 25 && nx == null; k++) for (const q of [st.x + k * 6, st.x - k * 6]) if (q > f.x1 + HALF_W * 0.6 && q < f.x2 - HALF_W * 0.6 && sitRoom(q, f.y)) { nx = q; break; }
          if (nx != null) { E.moved = 1; E.x0 = st.x; E.x = nx; E.u = 0; E.dur = 0.3 + Math.abs(nx - st.x) / 160; return; }
        }
        st.enter = null; st.amt = 0; const sit = E.sit && sitRoom(st.x, f.y); if (E.sit && !sit) poke('no sitting room at arrival'); st.mode = sit ? 'sit' : 'idle'; st.idleUntil = t + (sit ? 5 + Math.random() * 6 : 0.8 + Math.random() * 0.8); if (!E.again) ENV.MORTAL?.signal?.(WHO, 'ENTERED', { x: st.x, y: st.y, sit }); }   // on the name he sits a while first; the dove hears he is in
      return; }
    if (st.land > 0) return;   // the landing's beat (st.land decays in frame())
    if ((st.sitK || 0) > 0.04 || (st.crawlK || 0) > 0.05) { st.amt = 0; return; }   // still getting up
    if (st.throwing) { st.amt = Math.max(0, st.amt - dt * 6); return; }   // he plants his feet to throw or lift the bird
    // Purpose: where he walks comes from his drives (autonomy(), via the Mortal Agent kernel) or from REL; with no goal he
    // does not wander off on a whim, he stands and the next beat decides. Being seen: back in view, he stops working his way there.
    if (inView() && st.toView) { st.toView = false; st.away = 0; if (st.goal?.toView) st.goal = null; }
    if (!st.goal) { st.mode = 'idle'; st.idleUntil = t + 0.75; return; }
    const d0 = st.dir; st.brake = 1;
    if (st.goal) {
      const g = st.goal;
      if (!refloor(g.f) || t > g.until) giveUp('never got there');   // could not get there: try elsewhere for a while
      else if (!g.rel && g.f !== f && !pass(g.x, g.f.y, CFG.size + 4)) giveUp('no room there now');   // the spot filled in since he chose it (the phone's bar slid over it): not a place to pace toward until the timeout
      else if (g.f === f) {
        if (Math.abs(g.x - st.x) < 8) {
          st.goal = null;
          if (g.leg && nextLeg()) return;   // a waypoint: on to the next leg
          if (g.rel) { relArrive(f); return; }
          if (g.food) { st.mode = 'idle'; st.idleUntil = t + 0.4; return; }   // the next beat leans in for the bite
          const M = ENV.MORTAL; if (M) { if (g.goalId) M.goalDone(WHO, g.goalId); if (g.auto || g.toView) M.done(WHO); }
          if (st.z !== 0) { if (!laneHop(0)) { st.mode = 'idle'; st.idleUntil = t + 0.5; } return; }   // behind the page is no place to dwell: out where he fits
          const n = ENV.REL ? ENV.REL.needs(WHO) : { energy: 1 };   // there he sits if he is tired (or it is night), else stands a while and looks (a trip ends in a dwell)
          if (g.auto) { st.mode = 'idle'; st.idleUntil = t + 0.6; }   // a move of his own: the repertoire (autonomy) decides what the arrival is for
          else if (inView() && sitRoom(st.x, f.y) && (n.energy < 0.6 || (M && M.env.night))) { st.mode = 'sit'; st.idleUntil = t + 10 + Math.random() * 20; }
          else { st.mode = 'idle'; st.idleUntil = t + 8 + Math.random() * 12; }
          return;
        }
        st.dir = Math.sign(g.x - st.x) || st.dir; st.brake = Math.abs(g.x - st.x) / (walkSpeed() * 0.6);   // the last 0.6 s of the way: shorter, slower steps into the stop
      } else if (g.f.y < f.y - 4) {   // above him
        const dh = f.y - g.f.y, under = st.x >= g.f.x1 + HALF_W - 1 && st.x <= g.f.x2 - HALF_W + 1 && pass(st.x, g.f.y, CFG.size + 4);   // a goal clamped to the ledge's end counts as under it (a strict test had him turning on the spot for 25 s)   // under it, and with room on top right here (else he walks to the spot he chose first)
        const side = ALT && phone() && dh > UP && g.f.box ? [g.f.x1 - HALF_W, g.f.x2 + HALF_W].filter(x => onFloor(f, x) && pass(x, f.y, CFG.size + 4)).sort((a, b) => Math.abs(a - st.x) - Math.abs(b - st.x))[0] : null;   // ALT on phones: a box too tall to leap (the phone mock) is climbed by its side, hand over hand, the way he comes down one
        if (side != null) { if (Math.abs(side - st.x) < 6) { st.mode = 'climb'; st.floor = null; st.amt = 0; st.climb = { f: g.f, t0: t, down: true, up: true, y0: st.y, x0: st.x, xTo: null }; return; } st.dir = Math.sign(side - st.x) || st.dir; }
        else if (dh > UP) {   // too high in one go: climb the highest thing he can reach from here, a stepping stone toward it
          const reach = UP; let q = null;
          for (const c of floors) if (c !== f && !c.ground && c.y < f.y - 8 && c.y >= f.y - reach && st.x > c.x1 + HALF_W && st.x < c.x2 - HALF_W && clear(st.x, c.y, CFG.size + 4) && (!q || c.y < q.y)) q = c;
          if (q) { st.mode = 'prep'; st.prep = { f: q, dh: f.y - q.y, until: t + 0.18 + Math.random() * 0.14, climb: f.y - q.y > CFG.size * 1.2 }; st.amt = 0; return; }
          let nb = null;   // none right above him: walk to the nearest one he could climb, then climb it
          for (const c of floors) if (c !== f && !c.ground && c.y < f.y - 8 && c.y >= f.y - reach && c.x2 - c.x1 > 2 * HALF_W + 24 && clear(Math.max(c.x1 + HALF_W + 10, Math.min(c.x2 - HALF_W - 10, st.x)), c.y, CFG.size + 4) && (!nb || Math.min(Math.abs(st.x - c.x1), Math.abs(st.x - c.x2)) < Math.min(Math.abs(st.x - nb.x1), Math.abs(st.x - nb.x2)))) nb = c;
          if (nb && !g.rel) { st.goal = { f: nb, x: Math.max(nb.x1 + HALF_W + 10, Math.min(nb.x2 - HALF_W - 10, st.x)), until: t + 30, mind: 'step up' }; return; }
          giveUp('too high');   // nothing to step up on
        }
        else if (under) { st.mode = 'prep'; st.prep = { f: g.f, dh, until: t + 0.18 + Math.random() * 0.14, climb: dh > CFG.size * 1.2 }; st.amt = 0; return; }   // wind up first
        else st.dir = Math.sign(g.x - st.x) || st.dir;   // toward the spot he chose on it, then up
      } else {   // below him: head for the edge of this floor nearest to it and step off
        const tx = g.x > f.x1 && g.x < f.x2 ? (g.x - f.x1 < f.x2 - g.x ? f.x1 - 20 : f.x2 + 20) : g.x;
        st.dir = Math.sign(tx - st.x) || st.dir;
      }
    }
    if (st.relOrder && st.relOrder.ex === 'stalk') { const d = ENV.__scion; if (d && d.face === Math.sign(st.x - d.x)) { st.amt = Math.max(0, st.amt - dt * 8); return; } }   // it is looking: freeze
    if (st.dir !== d0 && st.amt > 0.5) { st.skid = t + 0.3; st.skidV = d0 * walkSpeed() * gait(st.amt) * (st.spdK || 1); st.amt = 0; }   // reversing at speed: a skid with travel (0.3 s, sliding to a stop), then off the other way (at a walk he just turns)
    if (st.skid > t) { const nx = st.x + st.skidV * ((st.skid - t) / 0.3) * dt; if (onFloor(f, nx) && clear(nx + Math.sign(st.skidV) * 10, f.y, CFG.size + 4)) st.x = nx; return; }   // the skid: planted, sliding to a stop
    if (st.turn) return;   // a turn: planted on one foot, the legs do not cycle
    { const lim = st.dir > 0 ? Math.min(f.x2, O.x + innerWidth - HALF_W * 0.7) - HALF_W * 0.4 - st.x : st.x - Math.max(f.x1, O.x + HALF_W * 0.7) - HALF_W * 0.4;   // a ledge end or the screen's edge ahead: shorter steps into it, as into a goal
      if (lim < walkSpeed() * 0.6) st.brake = Math.min(st.brake, Math.max(0, lim) / (walkSpeed() * 0.6)); }
    const go = gait(st.amt);   // from a standstill: 0.4 s to full stride, leaning into it (frame()); the stop settles in idle below
    const k = (st.spdK || 1) * (ENV.REL ? ENV.REL.body(WHO).speedK : 1) * (st.carrying ? 0.7 : 1);   // a run, a creep, a sore leg, a bird in hand
    const nx = st.x + st.dir * walkSpeed() * go * dt * k;
    const past = st.dir > 0 ? nx + HALF_W * 0.4 > Math.min(f.x2, O.x + innerWidth - HALF_W * 0.7) : nx - HALF_W * 0.4 < Math.max(f.x1, O.x + HALF_W * 0.7);
    if (past) {   // a ledge (or the side of the screen): stand at the edge a moment and look down (Shimeji, Celeste's teeter), then step off onto the ledge below or turn back
      if (!(st.edgeAt > 0) && !(ALT && t - (st.edgeT ?? -9) < 4)) { st.edgeT = t; st.edgeAt = t + 0.3 + Math.random() * 0.3; st.mode = 'idle'; st.idleUntil = st.edgeAt; st.amt = 0; if (inView()) gest = { name: 'peer', t0: t, dur: 1, side: st.dir, amp: 1, f: 1 }; return; }
      st.edgeAt = 0;
      if (ALT && st.goal) { const q = gapHop(f); if (q && q.f === st.goal.f) { st.dropF = q.f; st.mode = 'prep'; st.prep = { f: q.f, dh: 0, until: t + 0.18 + Math.random() * 0.14, climb: false, over: q.x }; st.amt = 0; return; } }
      if (dropTo(nx, f.y)) { st.mode = 'prep'; st.prep = { f: st.dropF, until: t + 0.12, drop: true, nx }; st.amt = 0; return; }   // a crouch, then a small forward arc onto the ledge he looked at (prep below), not past it (behind a picture in the way)
      if (st.goal && st.goal.toView && st.away >= 4 && lost()) return;   // left off camera with no ledge he can step down to: the lost case
      if (st.goal) giveUp('no way down');   // nothing to step down to: that place is not reachable from here (no pacing to the edge and back)
      st.dir = -st.dir; st.mode = 'idle'; st.idleUntil = t + 0.8 + Math.random() * 1.5; return;
    }
    st.edgeAt = 0;
    if (f.runs && Math.abs(footY(f, nx) - st.y) > 6) {   // the next letter is taller or shorter than the one he is on: a small hop up / step down onto it (the walk itself takes the smaller steps)
      const ny = footY(f, nx); st.dropF = f; st.air = true; st.hop = true; st.floor = null; st.vy = -Math.sqrt(2 * G * (Math.max(0, st.y - ny) + 12)); st.vx = st.dir * Math.max(40, walkSpeed() * 0.8); st.amt = 0; return; }
    if (pass(nx + st.dir * 10, f.y, CFG.size + 4)) { st.x = nx; st.ph += dt * sty.cadence * go * k; st.amt = Math.min(1, st.amt + dt * 2.5, Math.max(0.25, st.brake)); st.slideDir = st.dir; }   // the walk phase advances with distance (one cycle per cycleLen), so feet never slide
    else if (!st.relBusy && inView() && pass(nx + st.dir * 10, f.y, CRAWL_H + 4) && pass(st.x, f.y, CRAWL_H + 4) && !walls.some(w => w.crawl && w.f === f && w.dir === st.dir && t - w.t < 30)) { st.mode = 'crawl'; st.crawlT = t; st.amt = 0; }   // too low to walk under, room to crawl (a gap you can see): down on his hands and knees
    else {
      st.amt = Math.max(0, st.amt - dt * 5);
      if (st.amt === 0) blocked(f);
    }
  } else if (st.mode === 'prep') {   // knees bend, arms swing back: the wind-up before a jump
    if ((st.sitK || 0) > 0.04) { st.prep.until += dt; if (st.prep.t0 != null) st.prep.t0 += dt; return; }   // on his feet first
    if (t > st.prep.until) {
      const P = st.prep;
      if (P.drop) { st.air = true; st.hop = true; st.vx = st.dir * 70 * K; st.vy = -120; st.x = P.nx; st.mode = 'walk'; fallBehind(P.nx, f.y, P.f.y); return; }   // the step-down's push-off
      if (P.pounce) { const dx = P.pounce.x - st.x; st.air = true; st.hop = true; st.pounce = P.pounce; st.floor = null; st.dir = Math.sign(dx) || st.dir; st.vx = Math.sign(dx) * Math.min(260, Math.abs(dx) * 1.9); st.vy = -380; st.mode = 'walk'; return; }
      // P.over: the top of the thing in front of him, not a ledge overhead: the hop carries him across onto it
      if (!P.climb) { st.air = true; st.hop = true; st.floor = null; st.vy = -Math.sqrt(2 * G * (P.dh + 26)); st.mode = 'walk';
        st.vx = P.over != null ? (P.over - st.x) / (Math.sqrt(2 * (P.dh + 26) / G) + Math.sqrt(52 / G)) : st.dir * 40; }
      else { st.mode = 'climb'; st.floor = null; st.climb = { f: P.f, t0: t, y0: st.y, x0: st.x, xTo: P.over, hang: (0.25 + Math.random() * 0.35) * (st.hangK || 1), pull: 0.75 + Math.random() * 0.35 }; }
    }
  } else if (st.mode === 'crawl') {   // on hands and knees under something too low to stand in, until there is room again
    if ((st.crawlK || 0) < 0.9) return;   // still getting down
    const k = (ENV.REL ? ENV.REL.body(WHO).speedK : 1), nx = st.x + st.dir * walkSpeed() * 0.3 * dt * k;
    if (pass(st.x, f.y, CFG.size + 4) && pass(st.x + st.dir * 14, f.y, CFG.size + 4) && t - st.crawlT > 0.6) { st.mode = 'walk'; return; }   // headroom here and ahead: out the other side, he stands up
    const past = st.dir > 0 ? nx + HALF_W * 0.4 > f.x2 : nx - HALF_W * 0.4 < f.x1;
    if (past) { if (dropTo(nx, f.y)) { st.air = true; st.hop = true; st.vx = st.dir * 60; st.vy = -60; st.x = nx; st.mode = 'walk'; } else st.dir = -st.dir; return; }
    if (pass(nx + st.dir * 10, f.y, CRAWL_H + 4)) { st.x = nx; st.ph += dt * 0.85 * k; }
    else { walls.push({ f, dir: st.dir, t, crawl: true }); st.dir = -st.dir; st.crawlT = t; poke('a dead end, even crawling'); missed('dead end'); }   // remembered, so he does not crawl straight back in   // too tight even on all fours: back out the way he came
  } else if (st.mode === 'idle') { if (ALT && !st.goal && st.amt < 0.05 && !clear(st.x, f.y, CFG.size + 4)) { const x = idleSpot(f); if (x != null) { if (Math.abs(x - st.x) < 9) st.x += Math.sign(x - st.x) * Math.min(Math.abs(x - st.x), 40 * dt); else { gest = null; goTo(f, x, { auto: 1 }); return; } } }   // stopped in front of a label or the title: he walks on to where he covers nothing
    settle(f, dt); if (t > st.idleUntil && st.goal) { st.mode = 'walk'; restyle(); } }
  else if (st.mode === 'sit') { settle(f, dt);
    st.swingV += (-st.swing * 9 - st.swingV * 1.6) * dt; st.swing += st.swingV * dt;
    if (!st.dead && Math.sin(t * 1.3) * Math.sin(t * 0.37) > 0.995) st.swingV += 2;   // now and then a kick of the legs (a slow beat, not dice)
    if (t > st.idleUntil && st.goal) st.mode = 'walk';   // he gets up when there is somewhere to go
  }
}
// ALT: his realm can change (a phone opens the project in a sheet, Read less hides it) and it moves with every scroll: his layer
// goes into it, O becomes its corner, and in a new realm he is born (seated) again. false: no realm on this view, or far off screen.
function realm() {
  const h = ALT.realm();
  if (h !== host) { host = h; ROOF = !!h && h.matches('section'); realm.at = performance.now();
    if (h) { if (getComputedStyle(h).position === 'static') h.style.position = 'relative'; h.append(layer); }
    if (st.beh) behEnd(false); gest = null; bornTries = 0; dirty = true; scanAt = 0; floors = []; seams = []; allFloors = []; ink = []; textInk = [];
    Object.assign(st, { floor: null, air: false, held: false, hop: false, goal: null, route: null, enter: null, climb: null, prep: null, mode: 'walk', amt: 0, vx: 0, vy: 0, bornOnce: false, sitK: 0, yaw: null });
    hit.style.pointerEvents = ROOF ? '' : 'none'; }   // on the list row a tap opens the project: he never takes it
  if (!h) return false;
  const r = h.getBoundingClientRect(); if (r.bottom < -innerHeight || r.top > innerHeight * 2) return false;
  const y = -(r.top + h.clientTop); if (!realm.seen) { realm.seen = 1; curSY = y; } O.x = -(r.left + h.clientLeft); O.y = y; pageW = h.clientWidth; return true;
}
function frame(now) {
  requestAnimationFrame(frame);
  // Real time, up to a quarter second per frame: on a slow page (a busy machine draws a few frames a second) he keeps
  // living at the right speed, and in step with REL's clock, instead of moving in slow motion. Physics runs in 50 ms slices.
  const dt = Math.min((now - last) / 1000, 0.25); last = now; t += dt;
  if (ALT && !realm()) { canvas.style.visibility = 'hidden'; hit.style.display = 'none'; hud.style.opacity = 0; if (shadeCss) { shade.style.opacity = 0; shadeCss = ''; } return; }
  // not on every scroll frame, and not mid-scroll at all (a full-page layout read then stutters the scroll), unless very stale
  if (simple() !== st.simple) { st.simple = simple(); scan(); }   // Scroll / Read less flipped: his world changed under him, look now (not after the scroll settles)
  else if (now - scrolledAt > 250 && ((dirty && now - scanAt > 400) || now - scanAt > 2500)) scan();   // never mid-scroll: once it stops
  if (barInk) { barInk.t = O.y - 400; barInk.b = O.y + barInk.h; }   // the nav's wall in viewport space, every frame
  if (inView()) { st.away = 0; st.awayT = t; } else st.away = t - (st.awayT ?? (st.awayT = t));   // the off-camera clock (seconds since any of him last showed) the come-back (1.5 s) and the lost case (4 s) wait on: time, not beats (a beat counter ran ahead whenever an order ended and the next beat came at once)
  if (!st.floor && !st.air && !st.held && st.mode !== 'climb') { if (st.bornOnce) { st.air = true; st.hop = false; st.vy = 0; } else if (!born()) { canvas.style.visibility = 'hidden'; return; } }   // born once; after that a lost floor is a fall from where he is (no relocation, no drop from the top), never a vanish
  if (ENV.REL) {   // H10: what REL's contact did to him; he animates it himself
    const hb = ENV.REL.body(WHO); st.dazed = hb.dazed > 0; st.carrying = ENV.REL.body('dove').heldBy === WHO;
    if (hb.hits !== st.hitsSeen) {
      st.hitsSeen = hb.hits; const s = hb.lastHit ? hb.lastHit.sev : 0.3, d = ENV.__scion;
      st.shaken = Math.max(st.shaken || 0, s); st.stress = Math.min(1, (st.stress || 0) + 0.3 * s);
      // A hit (a peck, a dive) is a flinch where he stands, never a fall off his ledge; whatever he was winding up for is off.
      // (The bird never pounces him: pounce is his move, so no hit here is one that should launch him.)
      if (st.floor && !st.held && st.mode !== 'climb') {
        relEnd('interrupted'); st.prep = null; st.goal = null; st.mode = 'idle'; st.amt = 0; st.land = 0.25; st.idleUntil = t + 1 + s * 2;
        gest = { name: s > 0.5 ? 'cover' : 'rub', t0: t, dur: 1 + s * 2, side: Math.sign((d ? d.x : st.x + st.dir) - st.x) || 1, amp: 1, f: 1 };
      }
    }
  }
  if (st.dead && st.floor && !st.held && !st.air && st.mode !== 'climb') { st.goal = null; st.amt = 0; st.idleUntil = t + 1; st.mode = sitRoom(st.x, st.floor.y) ? 'sit' : 'idle'; }   // he can still fall or be carried
  if (!reduced) { for (let r = dt; r > 1e-6; r -= 0.05) step(Math.min(0.05, r)); } else st.mode = 'idle';
  st.land = Math.max(0, (st.land || 0) - dt);
  if (st.air && !st.wasAir) st.airAt = t; if (!st.air && st.wasAir && st.floor) st.landT = 0.35; st.wasAir = st.air;   // takeoff and touchdown moments: the stretch and the follow-through hang off them
  if (t > (st.stanceAt || 0)) { st.stanceAt = t + 4 + Math.random() * 4; st.stanceGoal = st.stanceGoal ? -st.stanceGoal : (Math.random() < 0.5 ? -1 : 1); }
  st.stance = (st.stance || 0) + ((st.stanceGoal || 0) - (st.stance || 0)) * Math.min(1, dt * 3);   // the weight moves over, it does not snap
  { const goal = st.mode === 'sit' && !st.held && !st.air && st.amt < 0.05 ? 1 : 0;   // he sits once his stride has settled
    if (st.held || st.air || st.mode === 'climb') st.sitK = 0;
    else { const k0 = st.sitK || 0, rate = dt / (goal ? 0.8 : 0.7); st.sitK = goal > k0 ? Math.min(goal, k0 + rate) : Math.max(goal, k0 - rate); } }
  const sitE = (st.sitK || 0) * (st.sitK || 0) * (3 - 2 * (st.sitK || 0));
  { const goal = st.mode === 'crawl' && !st.held && !st.air ? 1 : 0;   // down onto his hands and knees, or back up
    if (st.held || st.air || st.mode === 'climb') st.crawlK = 0;
    else { const k0 = st.crawlK || 0, rate = dt / 0.45; st.crawlK = goal > k0 ? Math.min(goal, k0 + rate) : Math.max(goal, k0 - rate); } }
  const crawlE = (st.crawlK || 0) * (st.crawlK || 0) * (3 - 2 * (st.crawlK || 0));
  st.look = look; st.gestName = gest ? gest.name : null; st.headH = Math.min(CFG.size + (SIT_H - CFG.size) * sitE, CFG.size + (CRAWL_H - CFG.size) * crawlE);   // H1: what the dove and REL read off him
  st.vxw = st.mode === 'walk' && !st.air ? st.dir * walkSpeed() * gait(st.amt) * (st.spdK || 1) : st.vx;
  const sy = st.y - O.y;
  const DP = ENV.DEPTH, here = DP ? DP.at(st.y, { noFront: true }) : { w: 0.5, lanes: [0] };   // his section's phase w and the lanes it has now (no front lane: he would cover words)
  st.w = here.w; st.lanes = here.lanes;
  if (st.mode !== 'lane') st.zs += (st.z - st.zs) * Math.min(1, dt * 8);   // displayed depth eases to his lane (a hop drives it itself)
  st.par *= Math.exp(-dt * (free() ? 2.5 : 14));   // scroll parallax fades; standing on something he is glued to it
  if (sy < -CFG.size - 40 || sy > innerHeight + 60) { canvas.style.visibility = 'hidden'; hit.style.display = 'none'; hud.style.opacity = 0; if (shadeCss) { shade.style.opacity = 0; shadeCss = ''; } return; }   // alive, just not in view
  hit.style.display = '';
  hit.style.transform = `translate3d(${Math.round(st.x - O.x - HALF_W)}px,${Math.round(sy - CFG.size)}px,0)`;
  if ((st.hover || st.held) && !phone()) {   // phones: the readout covered the page and ran off the edge
    hud.style.opacity = 1; hud.style.transform = `translate(${Math.round(st.x - O.x + HALF_W + 10)}px,${Math.round(sy - CFG.size)}px)`;
    const spd = Math.hypot(st.vx, st.vy);
    hud.textContent = `${WHO} · ${st.held ? `held by the ${st.flip ? 'legs' : st.grip > 0.7 ? 'head' : 'body'} · ${(st.stress || 0) < 0.2 ? 'calm' : (st.stress || 0) < 0.45 ? 'uneasy' : (st.stress || 0) < 0.72 ? 'scared' : 'panicking'}` : st.air ? 'falling' : st.mode}\nv ${(spd / 100).toFixed(2)} m/s   tilt ${(st.tilt * 57.3).toFixed(0)}°\narm ${(limbs.armL[0] * 57.3).toFixed(0)}°/${(limbs.armR[0] * 57.3).toFixed(0)}°   leg ${(limbs.thighL[0] * 57.3).toFixed(0)}°/${(limbs.thighR[0] * 57.3).toFixed(0)}°${ENV.REL && !ALT ? '\nwith the dove: ' + ENV.REL.describe(WHO) : ''}${lifeLine()}\n${st.held ? 'let go to drop · flick to toss' : 'press to pick up'}`;
  } else hud.style.opacity = 0;
  if (Math.random() < dt / 4) lookGoal = (Math.random() - 0.5) * 1.1;
  if (st.relOrder && st.relOrder.look != null && !gest) lookGoal = st.relOrder.look;
  look += (lookGoal - look) * Math.min(1, dt * 2.5);
  if (st.held || (st.air && !st.hop)) { poseRag(); inner.position.copy(feet).multiplyScalar(-S); }   // in your hand: physics only, limbs swing with how you move him
  else if (st.air) { poseHop(st.vy); inner.position.copy(feet).multiplyScalar(-S); }   // his own jump: tucked, arms out for balance
  else if (st.mode === 'lane') { poseHop(st.hopL && t - st.hopL.t0 < st.hopL.dur / 2 ? -1 : 260); inner.position.copy(feet).multiplyScalar(-S); }   // a little hop into the other lane
  else if (st.mode === 'prep') { posePrep(st.prep.t0 != null ? (t - st.prep.t0) / (st.prep.until - st.prep.t0) : (t - (st.prep.until - 0.25)) / 0.25); inner.position.copy(feet).multiplyScalar(-S); }
  else if (st.mode === 'climb') { poseClimb(st.climb); inner.position.copy(feet).multiplyScalar(-S); }
  else if (st.skid > t) { posePrep(0.5); mix(B.chest, -0.3, 0, 0, 1); inner.position.copy(feet).multiplyScalar(-S); }   // the skid: low, leaning back against his own speed
  else if (sitE > 0.999) { poseLean = 0; poseSit(st.swing); inner.position.copy(seat).multiplyScalar(-S); }
  else if (sitE > 0.001) { poseSitting(sitE); inner.position.lerpVectors(feet, seat, sitE).multiplyScalar(-S); }   // on his way down or up
  else if (crawlE > 0.001) { poseLean = 0; poseCrawl(st.ph, crawlE); inner.position.lerpVectors(feet, hip, crawlE).multiplyScalar(-S); }   // on all fours, pivoting at the hips
  else { poseLean = 0; poseStand(st.ph, st.land > 0 ? 0 : st.amt);
    if (st.land > 0) { const kn = 0.5 + (st.squash || 0.5); rot(B.thighL, -0.45 * kn); rot(B.thighR, -0.45 * kn); rot(B.shinL, 0.8 * kn); rot(B.shinR, 0.8 * kn); }   // knees give with the impact
    if ((st.landT || 0) > 0) { const u = 1 - st.landT / 0.35, e = (1 - u) * (1 - u); mix(B.head, 0.3 * e * (st.squash || 0.5) * 2, 0, 0, 1); st.landT -= dt; }   // follow-through: the head keeps going down, then comes back (the arms overshoot on their own springs)
    if (st.turn && st.mode === 'walk') { const u = Math.min(1, (t - st.turn.t0) / st.turn.dur), e = Math.sin(u * Math.PI);   // the pivot: weight on one bent leg, arms counter-swing
      mix(B.thighR, -0.3, 0, 0, e); mix(B.shinR, 0.45, 0, 0, e); mix(B.thighL, 0.1, 0, 0, e); armMix('L', [0.2, -0.9, -0.35], [0.1, -0.9, -0.2], e); armMix('R', [0.2, -0.9, 0.35], [0.1, -0.9, 0.3], e); }
    if (st.crouch > 0) { mix(B.thighL, -0.45, 0, 0, st.crouch); mix(B.thighR, -0.45, 0, 0, st.crouch); mix(B.shinL, 0.8, 0, 0, st.crouch); mix(B.shinR, 0.8, 0, 0, st.crouch); mix(B.chest, 0.35, 0, 0, st.crouch); }   // low, creeping
    inner.position.copy(feet).multiplyScalar(-S); }
  // hovering: he looks at the pointer
  if (st.hover && !st.held && t >= (st.hoverAt || 0)) { const dx = (st.px || st.x) - st.x; lookGoal = Math.max(-0.9, Math.min(0.9, dx / 200)); }
  if (st.glance && t < st.glance.until && !st.held) lookGoal = Math.max(-0.9, Math.min(0.9, (st.glance.x - st.x) / 200));   // the glance: eyes and head to it, then released
  if ((st.watch || 0) > t && pointer.in && !st.held) { st.interest = { x: pointer.cx + O.x, y: pointer.cy + O.y, what: 'cursor' }; lookGoal = Math.max(-0.9, Math.min(0.9, (st.interest.x - st.x) / 200)); }   // his mind chose to watch it: his eyes follow it
  { const d = ENV.__scion; if (d && !st.held && Math.hypot(d.x - st.x, d.y - st.y) < CFG.size * 4 && Math.random() < dt * (st.amt > 0.5 ? 0.15 : 0.8)) lookGoal = Math.max(-1, Math.min(1, (d.x - st.x) / 200)); }   // glances at the dove
  // Lean: into acceleration and against braking (measured ax, capped at 16 deg), plus a little forward at speed; 60 % in the chest,
  // 40 % as a whole-body tilt about the feet (Sackboy leans from the ground up).
  const lean = st.air || st.held ? 0 : Math.max(-0.28, Math.min(0.28, (st.ax || 0) * st.dir * 0.0012)) + 0.06 * st.amt; st.lean = lean;
  const turnRem = st.turn ? Math.atan2(Math.sin(st.turn.to - st.yaw), Math.cos(st.turn.to - st.yaw)) : 0;   // through a turn the head leads the body
  rot(B.head, -0.05 + Math.sin(t * 0.7) * 0.04 + Math.sin(t * 1.9) * 0.02 - (lean - 0.06 * st.amt) * 0.8, look + Math.sin(t * 0.53) * 0.08 + Math.max(-0.6, Math.min(0.6, turnRem * 0.4)) + (st.mode === 'walk' && !st.air ? 0 : -0.2 * st.dir), 0);
  rot(B.chest, Math.sin(t * 1.6) * 0.045 + (st.mode === 'walk' ? sty.lean * st.amt : 0) + (sitE > 0.001 && sitE < 0.999 ? poseLean : 0) + lean * 0.6, -sty.roll * 0.05, -sty.roll * 0.04 + (sty.sway || 0));
  if (st.glance && t < st.glance.until && !st.held) mix(B.head, Math.max(-0.35, Math.min(0.3, (st.glance.y - (st.y - CFG.size * 0.8)) / 300)), 0, 0, 1);   // and a nod toward its height
  // The page moving under his feet: a slow scroll he leans against and watches, a fast one (> 600 px/s) he crouches and grabs through,
  // a violent one (> 2000 px/s) he hangs on to and looks up. Eases in over ~0.15 s, lets go over ~0.5 s.
  st.scrollV = (st.scrollV || 0) * Math.exp(-dt * 4); st.scrollS = (st.scrollS || 0) * Math.exp(-dt * 4);
  { const sv = st.scrollS, want = calm || st.air || st.held || sitE > 0.02 || crawlE > 0.02 || st.mode === 'climb' ? 0 : sv > 2000 ? 1 : sv > 600 ? 0.66 : sv > 120 ? 0.33 : 0, b0 = st.brace || 0;
    if (want > b0) st.braceSign = Math.sign(st.scrollV) || 1;
    const b = st.brace = b0 + (want - b0) * Math.min(1, dt * (want > b0 ? 9 : 2.5));
    if (b > 0.01) { const grab = Math.max(0, (b - 0.33) / 0.67), up = Math.max(0, (b - 0.66) / 0.34);
      mix(B.thighL, -0.5, 0, 0, b); mix(B.thighR, -0.4, 0, 0, b); mix(B.shinL, 0.85, 0, 0, b); mix(B.shinR, 0.7, 0, 0, b); mix(B.chest, 0.25, 0, 0, b);
      mix(B.head, -0.35 * st.braceSign - 0.3 * up, 0, 0, b);
      if (grab > 0) { const u = [0.8 - 0.5 * up, 0.05 + 0.85 * up, 0.15], f = [0.7 - 0.4 * up, 0.45 + 0.5 * up, 0.25]; armMix('L', u, f, grab); armMix('R', u, f, grab); } } }
  // Eyes: they lead the head (a saccade toward where he is about to look), and blink for 120 ms every 3-6 s.
  if (t > blinkAt) { blinkAt = t + 3 + Math.random() * 3; blinkT = 0.12; }
  { const lid = blinkT > 0 ? Math.max(0.08, Math.abs(blinkT - 0.06) / 0.06) : 1, sac = Math.max(-1, Math.min(1, lookGoal - look)); blinkT -= dt;
    for (const e of eyes) { e.scale.y = lid; e.position.copy(e.userData.base).addScaledVector(e.userData.left, sac); } }
  if (crawlE > 0.001) { mix(B.head, -PITCH * 0.8, 0, 0, crawlE); mix(B.chest, 0, 0, 0, crawlE); }   // on all fours he still looks where he is going
  const midSit = sitE > 0.02 && sitE < 0.97;   // no gestures while he is getting down or up
  // The hold is ending (REL decided lift or throw): that takes his arms at once, whatever he was doing with them.
  if (st.carrying && !st.held && !st.air && ENV.REL) { const rk = ENV.REL.body('dove').releasing;
    if (rk && (!gest || gest.name !== rk)) { const d = ENV.__scion; gest = { name: rk, t0: t, dur: 1.1, windup: rk === 'throw' ? 0.5 : 0, side: Math.sign((d ? d.x : st.x + st.dir) - st.x) || st.dir, amp: 1, f: 1 }; if (st.mode === 'walk') { st.mode = 'idle'; st.idleUntil = t + 1.2; } } }
  st.throwing = !!(gest && (gest.name === 'throw' || gest.name === 'lift'));   // letting the bird go: plays to the end, and he stands for it
  if (!st.held && !st.air) gesture(dt, st.mode === 'sit' && sitE > 0.97, st.throwing || (!midSit && (st.mode === 'idle' || st.mode === 'sit' || (st.mode === 'walk' && st.amt < 0.05))));
  if (st.carrying && !st.held && !st.air && !(gest && (gest.name === 'throw' || gest.name === 'lift'))) {   // H9: the bird in his hands
    const d = ENV.__scion, sd = Math.sign((d ? d.x : st.x + st.dir) - st.x) || st.dir, kind = ENV.REL ? ENV.REL.body('dove').holdKind : null;
    if (kind === 'cradle') { const b = Math.sin(t * 2.2) * 0.04; armMix('L', [0.15, -0.55, 0.7], [-0.75, 0.25 + b, 0.55], 1); armMix('R', [0.15, -0.55, 0.7], [-0.75, 0.25 - b, 0.55], 1); lookGoal = sd * 0.3; mix(B.head, 0.3, 0, 0, 1); }   // cradled, looking down at it
    else armMix((sd > 0) === (st.dir > 0) ? 'R' : 'L', [0.3, -0.1, 0.9], [0.2, 0.2, 1], 1);   // held out at arm's length
  }
  if (packPose) packPose(dt);   // backpack.js: swing the pack off, reach into the pocket, hold or read the item (after gestures, before the springs)
  applyPose(dt, st.held || st.air); applyArms(dt, st.held || st.air); if (ALT) alt.pose();
  const yawGoal = st.mode === 'lane' && st.hopL ? (st.hopL.to < 0 ? st.dir * (Math.PI / 2 + 0.7) : st.dir * (Math.PI / 2 - 0.9)) :   // into the page or out of it, through profile
    st.mode === 'climb' ? Math.PI : crawlE > 0.3 ? (st.dir > 0 ? Math.PI / 2 : -Math.PI / 2) :(st.mode === 'sit' || sitE > 0.5) && !st.air ? -0.35 : st.dir > 0 ? Math.PI / 2 - 0.45 : -Math.PI / 2 + 0.45;
  if (st.yaw == null) st.yaw = yawGoal;
  // A reversal is never a mirror flip: he turns through profile over 0.2 s (eased), the direction locked for the turn; small
  // changes of bearing ease in as before.
  if (Math.abs(Math.atan2(Math.sin(yawGoal - st.yaw), Math.cos(yawGoal - st.yaw))) > 0.6 && !(st.turn && st.turn.to === yawGoal)) { st.turn = { from: st.yaw, to: yawGoal, t0: t, dur: 0.22 }; if (st.mode === 'walk' && !st.air) st.amt = 0; }
  if (st.turn) { const u = Math.min(1, (t - st.turn.t0) / st.turn.dur), d = Math.atan2(Math.sin(st.turn.to - st.turn.from), Math.cos(st.turn.to - st.turn.from)); st.yaw = st.turn.from + d * u * u * (3 - 2 * u); if (u >= 1) st.turn = null; }
  else { let dyaw = yawGoal - st.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); st.yaw += dyaw * Math.min(1, dt * 7); }
  inner.rotation.y = st.yaw;
  const bob = !st.air && (st.mode === 'walk' || st.mode === 'idle') ? (1 - Math.cos(4 * Math.PI * st.ph)) * 0.5 * CFG.size * 0.04 * st.amt : 0;   // 4 % of his height: a walk you can see at 64 px
  const crouch = st.land > 0 ? -st.land * 20 * K : 0;
  view.rotation.z = st.held || st.air ? -st.tilt : -st.dir * PITCH * crawlE - lean * 0.4 * st.dir;   // leans into the motion; crawling, his back tips forward over his hands
  const vy = sy - (st.hopY || 0) + st.par, lsc = DP ? DP.scaleOf(st.zs) : 1;   // vy: drawn height (lane-hop arc, parallax); lsc: lane scale
  const squ = st.sqAt == null || st.air ? 1 : Math.min(1, (t - st.sqAt) / 0.23), sq = squ < 1 ? (st.squash || 0) * (1 - squ) * (1 - squ) : 0;   // landing squash: a 0.23 s envelope from the landing, eased out, exactly 1,1 after (never tied to a mode's recovery branch)
  st.sq = sq;
  const str = st.air && st.vy < 0 && t - (st.airAt || -1) < 0.12 ? 1 - (t - st.airAt) / 0.12 : 0;   // takeoff: a 0.12 s stretch up from the feet
  view.scale.set(lsc * (1 + 0.3 * sq - 0.12 * str), lsc * (1 - 0.3 * sq + 0.15 * str), lsc);
  renderer.toneMappingExposure = 1 - 0.22 * Math.max(0, -st.zs);   // the back lane sits in the page's haze: a little dimmer (Inside, Silksong)
  view.position.set(st.x - O.x - innerWidth / 2, innerHeight / 2 - vy + bob + crouch + THIGH * crawlE, 0);
  { const d = ENV.__scion; let best = null;   // H1: his hand (the one nearer the bird) in page coords
    for (const b of [B.handL || B.foreL, B.handR || B.foreR]) { if (!b) continue; b.getWorldPosition(_hv);
      const x = _hv.x + innerWidth / 2 + O.x, y = innerHeight / 2 - _hv.y + O.y;
      if (!best || (d && Math.abs(x - d.x) < Math.abs(best.x - d.x))) best = { x, y }; }
    st.hand = best; }
  // Render only the BOX around him: same camera, cropped with a view offset, and the canvas parked there in page coords.
  const W = pageW;
  const ox = ALT ? Math.round(st.x - O.x - BOX / 2) : Math.max(0, Math.min(W - BOX, Math.round(st.x - O.x - BOX / 2))), oy = Math.round(vy - CFG.size * 0.5 - BOX / 2);
  if (oy > innerHeight || oy + BOX < 0) { if (!canvas.style.visibility) canvas.style.visibility = 'hidden'; return; }   // off screen (a scroll left him below or above the view): no draw, no compositing
  camera.setViewOffset(innerWidth, innerHeight, ox, oy, BOX, BOX);
  canvas.style.transform = `translate3d(${ox + O.x}px,${oy + O.y}px,0)`; if (canvas.style.visibility) canvas.style.visibility = '';
  // Occlusion: behind the content (lane -1) the cards in front of him hide him, drawn as depth-only quads in his own renderer.
  // The page is not touched; only cards that overlap him count, and never text.
  { const behind = st.zs < -0.3, hh = (st.headH || CFG.size) * lsc, py = st.y - (st.hopY || 0) + st.par;
    const box = { l: st.x - HALF_W * 1.7 * lsc, r: st.x + HALF_W * 1.7 * lsc, t: py - hh - 18, b: py + 8 };
    const occ = behind && DP ? DP.occluders(box, -1) : [];
    occlude(occ);
    // contact shadow: on the floor under his feet, shrinking with his height above it (a hop, a fall)
    const lf = st.air ? st.landF : st.floor, fy = lf ? lf.y : st.y, lift = (st.hopY || 0) + (st.air ? Math.max(0, fy - st.y) : 0), k = Math.max(0.45, 1 - lift / (1.5 * CFG.size));   // the blob shrinks and fades with height: the cue that a fall has weight
    const sx = st.x - st.zs * 6, sy2 = fy + st.zs * 4 + st.par, hidden = st.held || (st.air && !lf) || (st.zs < -0.3 && occ.length > 0) || st.mode === 'climb';
    const css = hidden ? '' : `translate(${Math.round(sx)}px,${Math.round(sy2)}px) scale(${(lsc * k * (1 + 0.5 * sq)).toFixed(2)},${(lsc * k).toFixed(2)})|${Math.min(1, 0.85 * k * k + 0.35 * sq).toFixed(2)}`;   // impact: wider and darker for the squash's 0.23 s
    if (css !== shadeCss) { shadeCss = css; if (css) { const [tr, op] = css.split('|'); shade.style.transform = tr; shade.style.opacity = op; } else shade.style.opacity = 0; } }
  stepDust(dt);
  renderer.render(scene, camera);
}
let scrolledAt = 0;
// Scroll parallax (depth through motion): only while he is free (mid-hop, airborne, or on a back-lane section floor) does he
// lag the page by his lane; standing on something visible he stays glued to it. The lag fades out over time (dt-based, frame()).
const free = () => st.air || st.mode === 'lane' || (st.z < 0 && st.floor && st.floor.section);
addEventListener('scroll', () => { if (free() && st.zs) st.par += (O.y - curSY) * 0.12 * -st.zs; }, { passive: true });
addEventListener('scroll', () => { const now = performance.now(), gap = Math.max(16, Math.min(100, now - scrolledAt)); const v = (O.y - curSY) / gap * 1000, a = 1 - Math.exp(-gap / 150); st.scrollV = (st.scrollV || 0) + (v - (st.scrollV || 0)) * a; st.scrollS = (st.scrollS || 0) + (Math.abs(v) - (st.scrollS || 0)) * a;   // page speed under his feet, px/s (150 ms averages: signed for where he looks, unsigned for how hard he braces)
  if (Math.abs(O.y - curSY) > 120) { lastSY = curSY; jumpAt = performance.now(); } curSY = O.y; dirty = true; scrolledAt = now; }, { passive: true });
// Phone carousels scroll an element, not the window (element scroll events do not bubble: listen in the capture phase).
// The swiped cards' ledges and ink shift at once, he rides the card under him, and a full re-measure follows once it settles.
document.addEventListener('scroll', e => {
  const sc = e.target; if (sc === document || !sc.getBoundingClientRect) return;
  dirty = true; scrolledAt = performance.now();
  const c = scrollers.get(sc); if (!c) return;
  const d = sc.scrollLeft - c.sl; if (!d) return; c.sl += d;
  const f = st.floor, items = new Set([...floors, ...seams, ...ink, ...cards]); if (f) items.add(f);
  for (const q of items) if (q.sc === sc) { q.u1 -= d; q.u2 -= d; clipX(q); if ('y' in q) fit(q); }
  ENV.DEPTH?.publish({ cards, text: textInk, floors, seams });
  if (f && f.sc === sc && !st.air && !st.held && st.mode !== 'climb') {
    st.x -= d;
    if (!onFloor(f, st.x)) {   // his card is sliding out of view: onto the next card at the same height, else to its last visible stretch, else he hops off
      const tw = floors.find(q => q !== f && Math.abs(q.y - f.y) < 6 && onFloor(q, st.x));
      if (tw) st.floor = tw;
      else if (f.x2 - f.x1 >= 2 * HALF_W) st.x = Math.max(f.x1 + HALF_W, Math.min(f.x2 - HALF_W, st.x));
      else { st.air = true; st.hop = !!dropTo(st.x, f.y); st.floor = null; st.vx = 0; st.vy = -160; st.mode = 'walk'; }
    }
  }
}, { capture: true, passive: true });
// the agents rewrite their own transforms every frame: those mutations are not page changes and must not trigger a rescan
new MutationObserver(ms => { if (ms.some(m => m.target !== hit && m.target !== hud && !(m.target.closest && m.target.closest(skipSel)))) dirty = true; }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'open', 'style'] });
requestAnimationFrame(frame);
// The backpack (backpack.js, realms/hugo/pack): loaded after his first frame so it never delays him; it owns ENV.__pack.
let packPose = null; if (!ALT) requestAnimationFrame(() => setTimeout(() => import('./backpack.js?v=20261115p9').then(m => m.boot({ model, B, rest, st, armMix, mix, springK, body: () => BODY, glb: CFG.glb })).then(f => { packPose = f; }, e => console.warn('backpack', e)), 0));
