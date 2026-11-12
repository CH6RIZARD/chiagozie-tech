// SCION's body: the EZER dove, rigged in Blender, rendered live with three.js over the page.
// The camera matches CSS perspective (eye at CFG.perspective px), so 1 world unit = 1 css px on the page plane
// and anything at depth z scales by d / (d - z), exactly like the agent's depth model.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const CFG = window.SCION_CONFIG = Object.assign({
  size: 82,              // px: height of the perched dove on the page
  perspective: 900,      // px: the visitor's eye distance
  footX: 0.25,           // model units: where the feet are along the body (from the Blender export)
  blendRate: 9,          // 1/s: how fast one pose flows into the next
  viewTilt: 14,          // deg: we see it a little from above, so wings never read edge-on
}, window.SCION_CONFIG || {});

const canvas = document.createElement('canvas');
canvas.id = 'scion-gl'; canvas.setAttribute('aria-hidden', 'true');
// A small canvas in page coordinates that travels with the bird, so scrolling never leaves it a frame behind the page.
const BOX = 300;
Object.assign(canvas.style, { position: 'absolute', left: 0, top: 0, width: BOX + 'px', height: BOX + 'px', pointerEvents: 'none', zIndex: 9999, willChange: 'transform' });
// Both agents draw inside one page-sized layer that clips them, so a canvas near the bottom never makes the page taller
// (it did: the page grew, the floor at the bottom moved down, and he kept falling).
const layer = document.getElementById('agent-layer') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'agent-layer' }));
Object.assign(layer.style, { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, overflow: 'clip', pointerEvents: 'none', zIndex: 9998 });
layer.append(canvas);

let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' }); }
catch (e) { canvas.remove(); throw new Error('SCION needs WebGL (hardware acceleration is off in this browser); the page works without it.'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
{ const pm = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(); scene.environment = pm.fromScene(room, 0.04).texture; pm.dispose(); room.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }   // the bake is done: free its scratch
const camera = new THREE.PerspectiveCamera(30, 1, 10, 6000);
function resize() {
  renderer.setSize(BOX, BOX, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = 2 * Math.atan(innerHeight / 2 / CFG.perspective) * 180 / Math.PI;
  camera.position.set(0, 0, CFG.perspective); camera.updateProjectionMatrix();
}
let pageW = document.documentElement.clientWidth;   // cached: no per-frame layout read
resize(); addEventListener('resize', () => { resize(); pageW = document.documentElement.clientWidth; });

// Light: soft key from above-left in front, warm paper bounce from below, and a rim in the portfolio's accent blue.
const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-400, 600, 700);
const rim = new THREE.DirectionalLight(0x3550ff, 3.2); rim.position.set(300, 250, -700);
const front = new THREE.DirectionalLight(0xfffaf2, 0.9); front.position.set(0, -150, 900);   // from the viewer, lifts the underside
scene.add(key, rim, front, new THREE.HemisphereLight(0xffffff, 0xf1ede4, 1.3));

const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(window.SCION_GLB || 'dove.glb');
const model = gltf.scene;
// Porcelain feathers: matte white with a soft cloth-like sheen; glossy black eyes.
const body = new THREE.MeshPhysicalMaterial({ color: 0xf7f5f0, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color(0xdfe5ff),
  sheenRoughness: 0.45, clearcoat: 0.12, clearcoatRoughness: 0.6, envMapIntensity: 0.55, side: THREE.DoubleSide });   // wings are single sheets
const eye = new THREE.MeshPhysicalMaterial({ color: 0x050507, roughness: 0.04, clearcoat: 1, envMapIntensity: 1.4 });
model.traverse(o => { if (o.isMesh) { o.material = o.isSkinnedMesh ? body : eye; o.frustumCulled = false; } });

const mixer = new THREE.AnimationMixer(model), acts = {}, w = {};
for (const c of gltf.animations) { const a = acts[c.name] = mixer.clipAction(c); a.timeScale = 0; a.play(); w[c.name] = 0; }
function pose(name, t = 0) {   // snap to one pose (used for measuring)
  for (const k in acts) acts[k].setEffectiveWeight(k === name ? 1 : 0);
  acts[name].time = t; mixer.update(0); model.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(model, true);
}
// Measure the real body: perched height sets the scale; the glide pose gives the body centre for flight.
const perchBox = pose('look'), S = CFG.size / (perchBox.max.y - perchBox.min.y);
const foot = new THREE.Vector3(CFG.footX, perchBox.min.y, 0), center = pose('glide').getCenter(new THREE.Vector3());
w.look = 1;

const view = new THREE.Group(), group = new THREE.Group(), inner = new THREE.Group();
inner.add(model); inner.scale.setScalar(S); group.add(inner); view.add(group); scene.add(view);
group.rotation.order = 'YZX';   // heading, then pitch, then roll about the body's own axis

const st = { visible: true, mode: 'perch', x: 0, y: 0, z: 0, heading: -90, pitch: 0, roll: 0, row: 'look', walkPh: 0, flapPh: 0,
  glide: false, breath: 0, opacity: 1, clip: '', puff: 0 };   // puff 0..1: feathers fluffed (a threat, a display, ruffled after a hit)
const R = {
  bodyAbove: (center.y - foot.y) * S,   // px from the feet up to the body centre
  set(o) { Object.assign(st, o); },
};

const D2R = Math.PI / 180;
let last = performance.now(), shown = true, clip = '', op = '';
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (!st.visible) { if (shown) { canvas.style.visibility = 'hidden'; shown = false; } return; }
  if (!shown) canvas.style.visibility = '';
  shown = true;
  // Poses flow into each other (wings unfold on takeoff, fold on landing) instead of swapping frames.
  const want = st.mode === 'perch' ? st.row : st.glide ? 'glide' : 'flap';
  let sum = 0;
  for (const k in w) { w[k] += Math.max(-dt * CFG.blendRate, Math.min(dt * CFG.blendRate, (k === want ? 1 : 0) - w[k])); sum += w[k]; }
  for (const k in w) acts[k].setEffectiveWeight(w[k] / (sum || 1));
  acts.flap.time = (st.flapPh % 1) * acts.flap.getClip().duration;
  acts.walk.time = (st.walkPh % 1) * acts.walk.getClip().duration;
  mixer.update(0);

  // Anchor: perched it stands on its feet (rotations and breathing pivot there); flying it pivots on its body.
  const anc = st.mode === 'perch' ? foot : center;
  inner.position.copy(anc).multiplyScalar(-S);
  view.position.set(st.x - scrollX - innerWidth / 2, innerHeight / 2 - (st.y - scrollY), st.z);
  view.rotation.x = CFG.viewTilt * D2R;
  group.rotation.set(st.roll * D2R, st.heading * D2R, -st.pitch * D2R);
  group.scale.set((1 - st.breath * 0.4) * (1 + 0.12 * st.puff), 1 + st.breath, (1 - st.breath * 0.4) * (1 + 0.12 * st.puff));

  const W = pageW, sy = st.y - scrollY;
  const ox = Math.max(0, Math.min(W - BOX, Math.round(st.x - scrollX - BOX / 2))), oy = Math.round(sy - 20 - BOX / 2);
  camera.setViewOffset(innerWidth, innerHeight, ox, oy, BOX, BOX);
  canvas.style.transform = `translate3d(${ox + scrollX}px,${oy + scrollY}px,0)`;
  // Behind cards: st.clip lists the cards (viewport rects) it is flying behind; cut them out of this canvas.
  const c = st.clip && st.clip.length ? `path(evenodd, "M0 0H${BOX}V${BOX}H0Z${st.clip.map(q => `M${q.left - ox} ${q.top - oy}H${q.right - ox}V${q.bottom - oy}H${q.left - ox}Z`).join('')}")` : '';
  if (c !== clip) canvas.style.clipPath = clip = c;
  const o = String(st.opacity); if (o !== op) canvas.style.opacity = op = o;
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
window.SCION_BOOT(R);
