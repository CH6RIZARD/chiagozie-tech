// Hugo's backpack: a CC0 rucksack (Quaternius, poly.pizza/m/vF7TuXCPDH) on his back whose front lid is cut free and opens on its
// hinge onto a real mouth. the leather pack is the default; ?pack=quaternius swaps in the rucksack (realms/hugo/pack/CREDITS.txt); only the
// chosen one is fetched. Every pack file has the same nodes: pack, flap, hinge (extras.open), mouth, hole. He swings it off one shoulder, opens a pocket, pulls the book or the bird's seed bag into his hand, and puts it back.
// Loaded by hugo3d.js after his first frame; boot() returns the per-frame pose hook it calls before the joint springs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _p = new THREE.Vector3(), _p2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _s2 = new THREE.Vector3(), _v = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _g = new THREE.Vector3();
const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, envMapIntensity: 0.5, flatShading: true });

function makeBook() {   // two halves hinged on the spine (local y); closed they lie face to face, open they make a V toward him
  const g = new THREE.Group(), cover = mat(0x8a5a44), paper = mat(0xefe8d8), halves = [];
  for (const s of [1, -1]) { const h = new THREE.Group(), c = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1, 0.05), cover), pg = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.92, 0.07), paper);
    c.position.set(0.36, 0, s * 0.085); pg.position.set(0.35, 0, s * 0.035); h.add(c, pg); h.userData.s = s; g.add(h); halves.push(h); }
  g.userData.open = t => { for (const h of halves) h.rotation.y = h.userData.s * t * 1.15; };
  return g;
}
function makeSeedBag() {   // a little burlap sack tied at the neck
  const g = new THREE.Group(), pts = [[0, -0.5], [0.3, -0.48], [0.42, -0.3], [0.44, 0], [0.36, 0.22], [0.16, 0.34], [0.13, 0.4], [0.22, 0.5], [0.05, 0.52]].map(([r, y]) => new THREE.Vector2(r, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 9), mat(0xa77b4f)));
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 5, 10), mat(0x6f5a45)); tie.rotation.x = Math.PI / 2; tie.position.y = 0.37; g.add(tie);
  return g;
}

export async function boot({ model, B, rest, st, armMix, mix, springK, body, glb }) {
  const BODY = body(); if (!BODY || !B.chest || !B.handR) return null;
  const pick = new URLSearchParams(location.search).get('pack'), file = pick === 'quaternius' ? 'pack' : 'leather';
  const url = new URL(`realms/hugo/pack/${file}.meshopt.glb` + (/\.wasm$/.test(glb || '') ? '.wasm' : ''), document.baseURI).href;
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  let scene = model; while (scene.parent) scene = scene.parent;
  const pack = gltf.scene.getObjectByName('pack'), hinge = pack.getObjectByName('hinge'), mouth = pack.getObjectByName('mouth'), hole = pack.getObjectByName('hole'), lid = new THREE.Group(), OPEN = hinge.userData.open || -1.9;
  lid.position.copy(hinge.position); pack.add(lid); pack.updateMatrixWorld(true); lid.attach(pack.getObjectByName('flap'));   // re-pivot on the hinge (meshopt quantizing moves node origins)
  const lidOf = o => { for (let q = o; q; q = q.parent) if (q === lid) return true; return false; };
  pack.traverse(o => { if (o.isMesh) { if (!o.material.map) o.material = mat(o.material.color); else if (!o.material.userData.lit) { o.material.userData.lit = 1; o.material.envMapIntensity = 0.8; o.material.color.multiplyScalar(1.5); } o.frustumCulled = false; } });   // a textured pack (leather) keeps its own PBR maps
  pack.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.side = lidOf(o) ? THREE.DoubleSide : THREE.FrontSide; o.material.transparent = false; o.material.depthWrite = true; } });
  // the model's own shoulder straps are rigid loops that cut through him: they come off, and straps built on his skin replace them
  const strapMeshes = []; pack.traverse(o => { if (o.isMesh && /^(String2?|attac[lr])_low/.test(o.name)) strapMeshes.push(o); }); strapMeshes.forEach(o => o.parent.remove(o));
  const box = new THREE.Box3().setFromObject(pack, true);   // the closed pack in its own units (1 tall); box.min.z is the side against him
  const STRAPS = /leather/.test(file);
  // the inside: dark under the lid, so the open pack reads as a hole, not as more canvas
  if (hole) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12), new THREE.MeshBasicMaterial({ color: 0x2a2520, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); d.scale.set(hole.scale.x, hole.scale.z, 1); d.rotation.x = -Math.PI / 2; d.position.copy(hole.position).y += 0.012; pack.add(d); }
  const root = new THREE.Group(), swing = new THREE.Group();   // root: placed every frame in world space; swing: the follow-through, pivoted at the pack's top
  root.matrixAutoUpdate = false; swing.position.y = 1; pack.position.y = -1; swing.add(pack); root.add(swing); scene.add(root);

  // Measure him in model space with the spine at rest: pack height ~ his torso, hung behind the chest.
  const save = [B.hips, B.chest].map(b => b && b.quaternion.clone());
  [B.hips, B.chest].forEach(b => b && b.quaternion.copy(rest.get(b))); model.updateMatrixWorld(true);
  const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert(), mp = b => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(toModel);
  const chestM = mp(B.chest), torso = mp(B.head).distanceTo(mp(B.hips)), H = torso * 0.72, D = torso * 0.25;
  const backModel = new THREE.Matrix4().makeBasis(_x.copy(BODY.left).negate(), _y.copy(BODY.up), _z.copy(BODY.fwd).negate())   // pocket side faces back (right-handed: his right, up, back)
    .scale(_s.setScalar(H)).setPosition(chestM.clone().addScaledVector(BODY.fwd, -D).addScaledVector(BODY.up, -H * 0.42));
  const chestModel = new THREE.Matrix4().copy(B.chest.matrixWorld).premultiply(toModel), backLocal = chestModel.invert().multiply(backModel);   // the pack in the chest's frame
  // His real surface: torso skin vertices (the ones the spine bones carry), sampled at rest; each frame their skinned positions
  // push the pack out until its near face clears them by 1.2 % of his height (flat on his back, no see-through gap), whatever he is doing (leaning, sitting, climbing).
  const skins = []; model.traverse(o => { if (o.isSkinnedMesh) skins.push(o); });
  const torsoV = [], samples = [], up0 = BODY.up.clone(), hipsM = mp(B.hips), headM = mp(B.head); let hMin = 1e9, hMax = -1e9;
  for (const sk of skins) { const sw = sk.geometry.attributes.skinWeight, si = sk.geometry.attributes.skinIndex, bones = sk.skeleton.bones, n = sk.geometry.attributes.position.count, w = new THREE.Vector3();
    const toM = new THREE.Matrix4().multiplyMatrices(toModel, sk.matrixWorld), cand = [];
    for (let i = 0; i < n; i++) { sk.getVertexPosition(i, w).applyMatrix4(toM); const h = w.dot(up0); hMin = Math.min(hMin, h); hMax = Math.max(hMax, h);
      let best = 0, bi = 0; for (let k = 0; k < 4; k++) { const x = sw.getComponent(i, k); if (x > best) { best = x; bi = si.getComponent(i, k); } }
      if (/spine(?!.?00[456])/i.test(bones[bi].name)) { cand.push(i); torsoV.push([sk, i, w.clone()]); } }
    const stride = Math.max(1, Math.floor(cand.length / 96)); for (let k = 0; k < cand.length; k += stride) samples.push([sk, cand[k]]); }
  const CLEAR = 0.012 * (hMax - hMin) / H;   // clearance in pack units
  let capR = 0; { const ab = headM.clone().sub(hipsM), w = new THREE.Vector3();
    for (const [sk, i] of samples) { sk.getVertexPosition(i, w).applyMatrix4(new THREE.Matrix4().multiplyMatrices(toModel, sk.matrixWorld)); const t = Math.max(0, Math.min(1, w.clone().sub(hipsM).dot(ab) / ab.lengthSq())); capR = Math.max(capR, w.distanceTo(hipsM.clone().addScaledVector(ab, t))); } }
  // Straps: each runs pack top -> back of the shoulder -> over it -> down his chest -> under the arm -> pack bottom. The body points are
  // his own torso vertices (nearest to where a strap lies), so the strap is skinned to his spine bones and moves with his skin.
  const nearest = q => { let b = null, d = 1e9; for (const v of torsoV) { const e = v[2].distanceToSquared(q); if (e < d) { d = e; b = v; } } return [b[0], b[1]]; };
  const STRAP = STRAPS ? ['L', 'R'].map(k => { const sd = k === 'L' ? 1 : -1, side = BODY.left.clone().multiplyScalar(sd), a = mp(k === 'L' ? B.armL : B.armR), t = torso, U = BODY.up, Fw = BODY.fwd;
    const at = (o, s2, u2, f2) => nearest(a.clone().addScaledVector(side, s2 * t).addScaledVector(U, u2 * t).addScaledVector(Fw, f2 * t));
    return { k, sd, body: [at(0, -0.1, 0.06, -0.14), at(0, -0.1, 0.12, 0), at(0, -0.06, -0.12, 0.16), at(0, 0.0, -0.36, 0.12), at(0, 0.02, -0.46, -0.08)] }; }) : [];
  save.forEach((q, i) => q && [B.hips, B.chest][i].quaternion.copy(q)); model.updateMatrixWorld(true);
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.75, metalness: 0, envMapIntensity: 0.6, side: THREE.DoubleSide }), SN = 30;
  for (const S of STRAP) { const g = new THREE.BufferGeometry(), idx = []; g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SN * 2 * 3), 3));
    for (let i = 0; i < SN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
    S.mesh = new THREE.Mesh(g, strapMat); S.mesh.frustumCulled = false; scene.add(S.mesh); }

  const items = { book: makeBook(), food: makeSeedBag() }, ITEM_H = { book: 0.5, food: 0.46 };
  for (const it of Object.values(items)) { it.visible = false; it.traverse(o => { if (o.isMesh) o.frustumCulled = false; }); scene.add(it); }
  // crumbs: a few seeds that fall from the bag's mouth when he shakes it (the food system gets one real drop per shake)
  const CN = 10, cpos = new Float32Array(CN * 3).fill(1e5), crumbs = Array.from({ length: CN }, () => ({ life: 0, v: new THREE.Vector3(), p: new THREE.Vector3() }));
  const cpts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(cpos, 3)), new THREE.PointsMaterial({ color: 0xe0cf98, size: 3, sizeAttenuation: false }));
  cpts.frustumCulled = false; scene.add(cpts);

  let hand = 'R', job = null, holding = null, dropped = false, shakeT = 0, reading = 0, sway = [0, 0, 0, 0], lastC = null, lastV = new THREE.Vector3(), packW = 0, pushS = 0, maxPen = 0;
  // take: the hand on the camera's side holds the item, so it shows
  const run = (kind, item, fast) => new Promise(res => { if (kind === 'take') hand = B.handL.getWorldPosition(_v).z > B.handR.getWorldPosition(_p).z ? 'L' : 'R'; job = { kind, item, u: 0, dur: fast ? 0.55 : 1.7, res }; });
  const moving = () => st.air || st.held || st.dead || st.mode === 'climb' || st.mode === 'lane' || (st.mode === 'walk' && st.amt > 0.15);
  const movingWhy = () => st.dead ? 'dead' : st.held ? 'being held' : st.air ? 'in the air' : st.mode === 'climb' ? 'climbing' : st.mode === 'lane' ? 'changing lane' : 'walking';
  let lastWhy = null, lastPose = performance.now();
  // Every take/stow resolves { ok, item, why }: ok:false says why (refused, interrupted, paused), never a silent no-op.
  const no = why => (lastWhy = why, Promise.resolve({ ok: false, item: holding, why }));
  setInterval(() => { if (job && performance.now() - lastPose > 1500) { const j = job; job = null; lastWhy = 'paused: he is not being drawn'; j.res({ ok: false, item: holding, why: lastWhy }); } }, 500);   // off-screen or a hidden tab: no frames, so no hang
  const api = {
    get busy() { return !!job; }, get holding() { return holding; }, get pack() { return file === 'pack' ? 'quaternius' : file; }, get rig() { return rig; }, get clearance() { return { pen: +(maxPen * packW).toFixed(2), push: +(pushS * packW).toFixed(2), shoulderGap: +gapS.toFixed(2) }; },
    take(item) { if (!items[item]) return Promise.reject(new Error('take: book or food'));
      if (job) return no('busy: ' + job.kind + ' ' + job.item);
      if (moving()) return no('refused: ' + movingWhy());
      if (holding === item) return Promise.resolve({ ok: true, item, why: 'already holding it' });
      return holding ? api.stow().then(() => api.take(item)) : run('take', item); },   // busy at once, so a caller's next check sees it
    get why() { return lastWhy; },
    stow() { if (!holding && !job) return Promise.resolve({ ok: true, item: null, why: 'nothing in hand' }); if (job) return new Promise(r => { const j = job, f = j.res; j.res = v => { f(v); r(api.stow()); }; }); return run('stow', holding); },
    shake() { if (holding !== 'food' || job) return false; shakeT = 1.1; return true; },
  };
  window.__pack = api;

  // world placement of things
  const handGrip = (side, out) => { const h = side === 'L' ? B.handL : B.handR, f = side === 'L' ? B.foreL : B.foreR; h.getWorldPosition(out); f.getWorldPosition(_g); return out.addScaledVector(_g.sub(out).negate(), 0.55); };   // a little past the wrist, into the palm
  function place(u, it) {   // u: 0 on his back .. 1 swung round in front of him, the pocket toward the camera
    const C = B.chest.matrixWorld; _m.multiplyMatrices(C, backLocal).decompose(_p, _q, _s);
    if (u > 0) {
      model.getWorldQuaternion(_q2); const up = _y.copy(BODY.up).applyQuaternion(_q2).normalize(), fw = _z.copy(BODY.fwd).applyQuaternion(_q2).normalize();
      const face = _v.copy(fw).multiplyScalar(0.55).add(_x.set(0, 0, 1)).normalize(), side = new THREE.Vector3().crossVectors(up, face).normalize();
      _m2.makeBasis(side, up, face); _q2.setFromRotationMatrix(_m2);
      B.chest.getWorldPosition(_p2); _p2.addScaledVector(fw, packW * 0.5).addScaledVector(up, -packW * 0.7).add(_x.set(0, 0, packW * 0.45));   // in front at his belly, a little toward us
      const a = sm(u); _p.lerp(_p2, a).add(_x.set(0, 0, Math.sin(a * Math.PI) * packW * 0.6)); _q.slerp(_q2, a);   // arcs out past his side, never through him
    }
    packW = _s.x;
    if (u > 0 && u < 1) {   // mid-swing: keep the pack's centre outside his body capsule (hips to head, radius from his skin)
      const ms = model.getWorldScale(_v).x; B.hips.getWorldPosition(_x); B.head.getWorldPosition(_y); const ab = _y.sub(_x), t = Math.max(0, Math.min(1, _g.copy(_p).sub(_x).dot(ab) / ab.lengthSq()));
      const c = _x.addScaledVector(ab, t), d = _g.copy(_p).sub(c), need = capR * ms + packW * (box.max.z - box.min.z) * 0.5, len = d.length();
      if (len < need) _p.addScaledVector(len > 1e-3 ? d.divideScalar(len) : _g.set(0, 0, 1), (need - len) * Math.sin(Math.PI * u));
    }
    root.matrix.compose(_p, _q, _s); root.matrixWorldNeedsUpdate = true;
  }
  const _w = new THREE.Vector3(), _inv = new THREE.Matrix4(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _t = new THREE.Vector3();
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: 7 }, () => new THREE.Vector3()), false, 'centripetal'), rad = new Float32Array(7), spts = Array.from({ length: SN }, () => new THREE.Vector3());
  function axisPoint(p, out) { B.hips.getWorldPosition(_a); B.head.getWorldPosition(_b); _b.sub(_a); const t = Math.max(0, Math.min(1, _c.copy(p).sub(_a).dot(_b) / _b.lengthSq())); return out.copy(_a).addScaledVector(_b, t); }
  function buildStraps(swingU, offW) {   // offW: the arm-side strap slipped off; swingU: the pack hangs round the front from the other shoulder
    if (!STRAP.length) return;
    const ms = model.getWorldScale(_v).x, th = torso * ms * 0.02, wid = torso * ms * 0.07;
    for (const S of STRAP) {
      const off = S.k === hand ? offW : 0, stay = S.k === hand ? 0 : swingU, P = curve.points;
      const xs = -S.sd * 0.2, z0 = box.min.z + 0.02;
      P[0].set(xs, 0.8, z0).applyMatrix4(pack.matrixWorld); P[6].set(xs * 1.2, 0.1, z0).applyMatrix4(pack.matrixWorld);
      S.body.forEach(([sk, i], j) => { const p = P[j + 1]; sk.getVertexPosition(i, p).applyMatrix4(sk.matrixWorld); axisPoint(p, _n); rad[j + 1] = p.distanceTo(_n) + th; _n.subVectors(p, _n).normalize(); p.addScaledVector(_n, th); });
      // round the front: past the shoulder the strap runs straight down to the pack, hanging; slipped off: a loose loop off the pack
      for (let j = 3; j <= 5; j++) { _a.lerpVectors(P[2], P[6], (j - 2) / 4); P[j].lerp(_a, sm(stay * 1.4)); }
      if (off > 0) { _t.set(0, 0, -1).transformDirection(pack.matrixWorld); for (let j = 1; j <= 5; j++) { _a.lerpVectors(P[0], P[6], j / 6).addScaledVector(_t, packW * 0.12 * Math.sin(Math.PI * j / 6)); P[j].lerp(_a, off); } }
      const hug = (1 - off) * (1 - sm(stay * 1.4));   // how much of the strap is still wrapped on him
      for (let i = 0; i < SN; i++) { const u = i / (SN - 1), p = curve.getPoint(u, spts[i]);
        const f = u * 6, j = Math.min(5, Math.floor(f)), r = j >= 1 && j <= 4 ? rad[j] + (rad[j + 1] - rad[j]) * (f - j) : 0;
        if (r > 0 && hug > 0) { axisPoint(p, _n); const d = p.distanceTo(_n); if (d < r) p.lerp(_n.addScaledVector(_c.subVectors(p, _n).normalize(), r), hug); } }   // wrap round him, never a chord through him
      const pos = S.mesh.geometry.attributes.position;
      for (let i = 0; i < SN; i++) { const p = spts[i]; _t.subVectors(spts[Math.min(SN - 1, i + 1)], spts[Math.max(0, i - 1)]).normalize(); axisPoint(p, _n); _n.subVectors(p, _n).normalize(); _b.crossVectors(_t, _n).normalize().multiplyScalar(wid / 2);
        pos.setXYZ(i * 2, p.x + _b.x, p.y + _b.y, p.z + _b.z); pos.setXYZ(i * 2 + 1, p.x - _b.x, p.y - _b.y, p.z - _b.z); }
      let len = 0; for (let i = 1; i < SN; i++) len += spts[i].distanceTo(spts[i - 1]); rig.strap[S.k === 'L' ? 0 : 1] = len / (torso * ms);
      pos.needsUpdate = true; S.mesh.geometry.computeVertexNormals(); S.mesh.geometry.computeBoundingSphere();
    }
  }
  let gapS = 0;
  const rig = { gap: 0, lat: 0, strap: [0, 0], swing: 0 };   // self-check numbers, in torso lengths: pack's near face to the chest bone, its sideways offset, each strap's length
  function belowShoulder() {   // the pack's centre never rises above the carrying shoulder (the swing arcs round it, not over it)
    const sh = (hand === 'R' ? B.armL : B.armR).getWorldPosition(_a).y, c = _b.set(0, 0.5, 0).applyMatrix4(pack.matrixWorld), lim = sh - packW * 0.12;
    if (c.y > lim) { _m.makeTranslation(0, lim - c.y, 0); root.matrix.premultiply(_m); root.matrixWorldNeedsUpdate = true; root.updateMatrixWorld(true); c.y = lim; }
    gapS = sh - c.y;
  }
  let tiltS = 0;
  function scan() {   // how far his skin stands behind the pack's near face (+z is behind him), for the pack's top half and bottom half
    root.updateMatrixWorld(true); _inv.copy(pack.matrixWorld).invert(); let top = -1e9, bot = -1e9;
    for (const [sk, i] of samples) { sk.getVertexPosition(i, _w).applyMatrix4(sk.matrixWorld).applyMatrix4(_inv);
      if (_w.x < box.min.x - CLEAR || _w.x > box.max.x + CLEAR || _w.y < box.min.y || _w.y > box.max.y) continue;
      const d = _w.z - (box.min.z - CLEAR); if (_w.y > 0.5) top = Math.max(top, d); else bot = Math.max(bot, d); }   // (it was measured from his front, so the pack hung a body's depth off him)
    return [top, bot];
  }
  function clearBody(dt, hug) {   // lay the pack's near face along his back (tilt), then push it out along its own +z until it clears his skin (measured every frame)
    const [top, bot] = scan(), tilt = top > -1e8 && bot > -1e8 ? Math.max(-0.3, Math.min(0.3, Math.atan((top - bot) / 0.5))) * hug : 0;   // his back is an egg: flat against it means leaning with it
    tiltS += (tilt - tiltS) * Math.min(1, dt * 10);
    if (Math.abs(tiltS) > 1e-3) { root.matrix.multiply(_m.makeTranslation(0, 0.5, box.min.z)).multiply(_m.makeRotationX(tiltS)).multiply(_m.makeTranslation(0, -0.5, -box.min.z)); root.matrixWorldNeedsUpdate = true; }
    const pen = Math.max(...scan()); maxPen = pen; const need = Math.max(0, pen) * hug;   // the push this frame needs; only on his back (swung round to the front it is clear of him already)
    pushS = need >= pushS ? need : pushS + (need - pushS) * Math.min(1, dt * 10);   // out at once, back in over ~0.2 s (no jitter, no pack left hanging off his back)
    if (pushS > 0) { _g.set(0, 0, 1).transformDirection(pack.matrixWorld); _m.makeTranslation(_g.x * pushS * packW, _g.y * pushS * packW, _g.z * pushS * packW); root.matrix.premultiply(_m); root.matrixWorldNeedsUpdate = true; root.updateMatrixWorld(true); }
  }
  function placeItem(name, t) {   // t: 0 at the pocket mouth .. 1 in his hand
    const it = items[name]; it.visible = t > 0; if (!t) return;
    root.updateMatrixWorld(true); mouth.getWorldPosition(_p); handGrip(hand, _p2);
    if (name === 'book' && reading > 0) { handGrip(hand === 'R' ? 'L' : 'R', _v); _p2.lerp(_v, 0.5 * reading); _p2.z = Math.max(_p2.z, _v.z) + packW * 0.35 * reading; }   // held open in front of him, never behind his near arm
    it.position.lerpVectors(_p, _p2, sm(t)); it.scale.setScalar(packW * ITEM_H[name]);
    it.quaternion.identity(); if (name === 'book') { it.rotation.set(-0.25 * reading, 0, 0.12 * (1 - reading)); it.userData.open(reading); }
  }
  function crumbsStep(dt, bagAt) {
    let any = false;
    crumbs.forEach((c, i) => { if (c.life <= 0) { cpos[i * 3 + 1] = 1e5; return; } any = true; c.life -= dt; c.v.y -= 900 * dt; c.p.addScaledVector(c.v, dt); cpos[i * 3] = c.p.x; cpos[i * 3 + 1] = c.p.y; cpos[i * 3 + 2] = c.p.z; });
    if (bagAt) for (const c of crumbs) if (c.life <= 0) { c.life = 0.5 + Math.random() * 0.3; c.p.copy(bagAt); c.v.set((Math.random() - 0.5) * 60, 20 + Math.random() * 40, 0); break; }
    cpts.geometry.attributes.position.needsUpdate = true; cpts.visible = any || !!bagAt;
  }

  let F = null;
  const pose = dt => {
    dt = Math.min(dt, 0.1);
    lastPose = performance.now();
    if (moving() && (holding || job) && !(job && job.kind === 'stow')) {
      const why = 'interrupted: ' + movingWhy();
      if (job) { const j = job; lastWhy = why; job = { kind: 'stow', item: j.item, u: 1 - j.u, dur: 0.55, res: () => {} }; j.res({ ok: false, item: null, why }); }   // reversed from where it was
      else { lastWhy = 'stowed: ' + movingWhy(); run('stow', holding, true); } }
    // the take timeline (stow plays it backwards): swing off, flap open, item out into the hand, flap shut, swing back
    let u = 1, swingU = 0, flapU = 0, itemU = holding ? 1 : 0, itemName = holding, wShoulder = 0, wPocket = 0, wHold = holding ? 1 : 0, wPack = 0;
    if (job) {
      job.u = Math.min(1, job.u + dt / job.dur); u = job.kind === 'take' ? job.u : 1 - job.u; itemName = job.item;
      swingU = Math.min(sm(u / 0.3), 1 - sm((u - 0.82) / 0.18)); flapU = Math.min(sm((u - 0.26) / 0.14), 1 - sm((u - 0.72) / 0.12));
      itemU = u < 0.42 ? 0 : sm((u - 0.45) / 0.25) * 0.98 + 0.02;
      wShoulder = Math.sin(Math.PI * Math.min(1, u / 0.32)); wPocket = Math.min(sm((u - 0.3) / 0.12), 1 - sm((u - 0.5) / 0.2)); wHold = sm((u - 0.55) / 0.2); wPack = swingU;
      if (job.u >= 1) { const j = job; job = null; holding = j.kind === 'take' ? j.item : null; j.res({ ok: true, item: holding, why: j.kind === 'take' ? 'taken' : 'stowed' }); }
    }
    // arms: right reaches to the left strap, the left holds the swung pack, the right goes into the pocket, then holds the item
    if (wShoulder > 0) armMix(hand, [-0.15, 0.25, 0.55], [-0.75, 0.55, -0.1], wShoulder);
    if (wPack > 0) armMix(hand === 'R' ? 'L' : 'R', [0.25, -0.75, 0.5], [-0.15, -0.1, 1], wPack);
    if (wPocket > 0) armMix(hand, [0.0, -0.45, 0.85], [-0.3, -0.85, 0.45], wPocket);
    const idle = !moving() && (st.mode === 'idle' || st.mode === 'sit');
    reading += ((holding === 'book' && !job && idle ? 1 : 0) - reading) * Math.min(1, dt * 3);
    shakeT = Math.max(0, shakeT - dt);
    if (wHold > 0 && itemName) {
      if (reading > 0.01) { armMix('L', [0.12, -0.75, 0.55], [-0.4, 0.45, 0.85], reading); armMix('R', [0.12, -0.75, 0.55], [-0.4, 0.45, 0.85], reading); mix(B.head, 0.32, 0, 0, reading); }
      if (reading < 0.99) armMix(hand, [0.15, -0.8, 0.4], [0.1, shakeT > 0 ? 0.35 + Math.sin(shakeT * 28) * 0.45 : 0.1, 1], wHold * (1 - reading));
    }
    const offW = job ? Math.min(sm(u / 0.12), 1 - sm((u - 0.88) / 0.12)) : 0;   // the arm slips out first and back in last
    F = { dt, swingU, flapU, itemU, itemName, offW };
  };
  // Placement runs inside render(), after his bones have their final matrices for this frame (the pose hook runs before them).
  const prevBR = scene.onBeforeRender;
  scene.onBeforeRender = (...a) => { prevBR.apply(scene, a); if (F) placeAll(F); };
  function placeAll({ dt, swingU, flapU, itemU, itemName, offW }) {
    // the pack: follow-through on a spring driven by the chest's acceleration (it lags a start, swings past a stop)
    B.chest.getWorldPosition(_p); _p.x += scrollX; _p.y -= scrollY;   // page space: a scroll is not a jolt
    if (lastC) { const v = _v.copy(_p).sub(lastC).divideScalar(Math.max(dt, 1e-3)), acc = _x.copy(v).sub(lastV).divideScalar(Math.max(dt, 1e-3)); lastV.copy(v);
      const fw = _z.copy(BODY.fwd).applyQuaternion(model.getWorldQuaternion(_q2)), T = Math.max(-0.1, Math.min(0.1, acc.dot(fw) * 0.0005 - acc.y * 0.0002)) * (1 - swingU);
      const [pp, pv, vp, vv] = springK(9, 0.3, dt), p = sway[0] - T, v0 = sway[1]; sway[0] = p * pp + v0 * pv + T; sway[1] = p * vp + v0 * vv; }
    lastC = (lastC || new THREE.Vector3()).copy(_p);
    sway[0] = Math.max(-0.12, sway[0]);   // a few degrees at most: it rides his back, it never hangs off it
    if (sway[0] > 0) { sway[0] = 0; sway[1] = Math.min(0, sway[1]); }   // the follow-through swings out from his back, never in past it
    swing.rotation.x = sway[0];
    place(swingU); clearBody(dt, 1 - swingU); belowShoulder(); buildStraps(swingU, offW);
    { const T = torso * model.getWorldScale(_v).x; B.chest.getWorldPosition(_a); _b.set(0, 0.5, box.min.z).applyMatrix4(pack.matrixWorld).sub(_a); rig.gap = _b.length() / T; rig.lat = _b.dot(_c.copy(BODY.left).transformDirection(B.chest.matrixWorld)) / T; rig.swing = swingU; }
    lid.rotation.x = OPEN * flapU;
    for (const n of Object.keys(items)) if (n !== itemName) items[n].visible = false;
    if (itemName) placeItem(itemName, itemU);
    let bagAt = null;
    if (holding === 'food' && shakeT > 0) {
      bagAt = items.food.getWorldPosition(new THREE.Vector3()).addScaledVector(_y.set(0, -1, 0), packW * 0.12);
      if (shakeT < 0.6 && !dropped) { dropped = true;
        const food = { x: bagAt.x + innerWidth / 2 + scrollX, y: st.y, hy: innerHeight / 2 - bagAt.y + scrollY, vx: 0, t: performance.now() };
        window.REL?.ev('hugo', 'drop', 'dove', 0, food); window.__hugoFood = food; dispatchEvent(new CustomEvent('hugo:food', { detail: food })); dispatchEvent(new CustomEvent('pack:shake', { detail: food })); }
    } else dropped = false;
    crumbsStep(dt, bagAt);
    root.updateMatrixWorld(true); for (const it of Object.values(items)) it.updateMatrixWorld(true); cpts.updateMatrixWorld(true);
  }
  return pose;
}
