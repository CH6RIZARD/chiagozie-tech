// The Void mascot, rigged in Blender (void-character repo), shown as a real-time 3D figure in the #void section.
// Self-contained: its own canvas in #void-stage, slow auto-orbit + a gentle falling-in-place bob, drag to turn.
// Paused when off-screen. The page works without it (no WebGL -> the mount just stays empty).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const mount = document.getElementById('void-stage');
if (mount) {
  const BASE = 'realms/void/void-character.glb';

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
  catch { throw new Error('The Void figure needs WebGL; the page works without it.'); }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.append(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(2, 4, 3); scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false; controls.enableZoom = false;
  controls.autoRotate = true; controls.autoRotateSpeed = 1.2;
  controls.enableDamping = true; controls.minPolarAngle = 1.0; controls.maxPolarAngle = 1.9;

  const sz = () => Math.max(220, Math.min(mount.clientWidth || 300, 360));
  const resize = () => { const d = sz(); renderer.setSize(d, d, false); renderer.domElement.style.width = d + 'px'; renderer.domElement.style.height = d + 'px'; camera.aspect = 1; camera.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();

  let root = null, baseY = 0;
  const pick = async () => { try { const r = await fetch(BASE, { method: 'HEAD' }); return r.ok ? BASE : BASE + '.wasm'; } catch { return BASE + '.wasm'; } };
  pick().then(url => new GLTFLoader().loadAsync(url)).then(g => {
    root = g.scene;
    const box = new THREE.Box3().setFromObject(root), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    root.position.sub(c);                                   // center at origin
    const h = Math.max(s.x, s.y, s.z);
    camera.position.set(0, h * 0.12, h / (2 * Math.tan(camera.fov * Math.PI / 360)) * 1.35);
    controls.target.set(0, 0, 0);
    baseY = root.position.y;
    scene.add(root);
  }).catch(() => { renderer.domElement.remove(); });        // asset missing -> leave the mount empty, page is fine

  let run = true;
  new IntersectionObserver(es => es.forEach(e => { run = e.isIntersecting; }), { rootMargin: '200px' }).observe(mount);

  const t0 = performance.now();
  const tick = () => {
    requestAnimationFrame(tick);
    if (!run) return;
    controls.update();
    if (root) { const t = (performance.now() - t0) / 1000; root.position.y = baseY + Math.sin(t * 1.1) * 0.05 * (root.scale.y || 1); root.rotation.z = Math.sin(t * 0.8) * 0.03; }  // falling-in-place: slow bob + tiny sway
    renderer.render(scene, camera);
  };
  tick();
}
