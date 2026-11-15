// The Void's mascot (rigged in the void-character repo). He exists only with the Void project:
//   desktop: sits next to the "THE VOID" title; awake while on screen (turns to the cursor, swings his legs, hops between
//            perches, can be dragged) and hard-locked inside the #void section, he never leaves it.
//   phones:  sits fixed on the top edge of the Void row in the project index (body moves, seat does not); opening the
//            Void project pops him into its sheet, next to the title; closing it puts him back on the row.
// The page works without him (no WebGL or no model: nothing is added).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const section = document.getElementById('void');
if (section) boot().catch(() => {});

async function boot() {
  const PHONE = matchMedia('(max-width:760px)'), CALM = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const sheet = document.querySelector('.msheet'), row = document.querySelector('.mrow[data-open="void"]');
  const V = 4, SEAT = 0.675;   // world units the canvas shows top to bottom; his seat sits this far down the canvas

  const canvas = document.createElement('canvas'); canvas.className = 'voidchar'; canvas.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.03).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(2, 4, 3); scene.add(key, new THREE.AmbientLight(0xffffff, 0.35));
  const cam = new THREE.OrthographicCamera(-V / 2, V / 2, 1, -1, 0.1, 50); cam.position.z = 10;

  const BASE = 'realms/void/void-character.glb';
  const url = await fetch(BASE, { method: 'HEAD' }).then(r => r.ok ? BASE : BASE + '.wasm', () => BASE + '.wasm');
  const root = (await new GLTFLoader().loadAsync(url)).scene;
  const bone = n => root.getObjectByName(n), thigh = [bone('thigh_l'), bone('thigh_r')], calf = [bone('calf_l'), bone('calf_r')], spine = bone('spine_01');
  const rest = new Map([...thigh, ...calf, spine].map(b => [b, b.rotation.clone()]));
  // sit: 0 standing (held, mid-hop) .. 1 seated (thighs forward, shins hanging); swing: the idle leg swing
  const pose = (sit, swing) => { for (let i = 0; i < 2; i++) { thigh[i].rotation.x = rest.get(thigh[i]).x - 1.5 * sit; calf[i].rotation.x = rest.get(calf[i]).x + 1.5 * sit + swing * (i ? -1 : 1); } };
  pose(1, 0); root.updateMatrixWorld(true);
  const hip = thigh[0].getWorldPosition(new THREE.Vector3()).add(thigh[1].getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
  const pivot = new THREE.Group(); root.position.set(-hip.x, 0, -hip.z); pivot.add(root); scene.add(pivot);   // he turns around his own hips
  const seatY = hip.y - 0.19;   // underside of the thighs
  cam.top = seatY + V * SEAT; cam.bottom = seatY - V * (1 - SEAT); cam.updateProjectionMatrix();

  let mode = '', host = null, S = 150, seat = { x: 0, y: 0 }, sit = 1, yaw = 0.5, hop = null, drag = null, awake = false, popAt = 0, nextHop = 0, mx = innerWidth / 2;
  const rel = (r, h) => ({ x: r.left - h.left, y: r.top - h.top, w: r.width, h: r.height });
  const home = () => {   // his default seat, in host coordinates
    if (mode === 'row') return { x: S * 0.2 + 2, y: 0 };   // on the row's top edge, left end (the hint text above is centered to leave him room)
    const h2 = section.querySelector('h2'), rg = document.createRange(); rg.selectNodeContents(h2);
    const sr = section.getBoundingClientRect(), t = rel(rg.getBoundingClientRect(), sr), fs = parseFloat(getComputedStyle(h2).fontSize);
    return { x: Math.min(t.x + t.w + S * 0.34, sr.width - S / 2), y: t.y + t.h - fs * 0.18 };   // beside the title, on its baseline
  };
  const perches = () => { const sr = section.getBoundingClientRect(), on = (el, fx) => { const r = el && el.getBoundingClientRect(); return r && r.width ? { x: r.left - sr.left + r.width * fx, y: r.top - sr.top } : null; };
    return [home(), on(section.querySelector('.phone'), 0.5), on(section.querySelector('.spec'), 0.85)].filter(Boolean); };
  const clamp = p => { const w = host.clientWidth, h = host.clientHeight; return { x: Math.max(S / 2, Math.min(w - S / 2, p.x)), y: Math.max(SEAT * S, Math.min(h - (1 - SEAT) * S, p.y)) }; };   // the lock: never outside his host
  const place = lift => { canvas.style.transform = `translate3d(${(seat.x - S / 2).toFixed(1)}px,${(seat.y - SEAT * S - lift).toFixed(1)}px,0)`; };

  const sync = () => {
    const m = !PHONE.matches ? 'desk' : sheet && sheet.classList.contains('on') && sheet.contains(section) ? 'sheet' : row ? 'row' : '';
    if (!m) { canvas.remove(); mode = ''; return; }
    if (m !== mode) {
      mode = m; host = m === 'row' ? row : section; S = m === 'desk' ? 150 : m === 'sheet' ? 88 : 64; hop = drag = null;
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
      renderer.setSize(S, S, false); canvas.style.width = canvas.style.height = S + 'px';
      canvas.style.pointerEvents = m === 'desk' ? 'auto' : 'none';
      host.append(canvas); popAt = performance.now(); nextHop = popAt + 9000;
    }
    seat = mode === 'row' ? home() : clamp(home()); place(0);   // on the row he sits ON its top edge, so his body is above the row
  };
  PHONE.addEventListener('change', sync); addEventListener('resize', sync);
  if (sheet) new MutationObserver(sync).observe(sheet, { attributes: true, attributeFilter: ['class'] });
  sync();

  new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && !awake) popAt = performance.now(); awake = e.isIntersecting; })).observe(canvas);   // wakes when seen, sleeps (no rendering) when not
  addEventListener('pointermove', e => { mx = e.clientX; }, { passive: true });

  // Desktop: drag him anywhere in the section; a click without a drag makes him jump.
  canvas.addEventListener('pointerdown', e => { if (mode !== 'desk') return; canvas.setPointerCapture(e.pointerId); const hr = host.getBoundingClientRect(); drag = { dx: e.clientX - hr.left - seat.x, dy: e.clientY - hr.top - seat.y, moved: false }; hop = null; e.preventDefault(); });
  canvas.addEventListener('pointermove', e => { if (!drag) return; const hr = host.getBoundingClientRect(); seat = clamp({ x: e.clientX - hr.left - drag.dx, y: e.clientY - hr.top - drag.dy }); drag.moved = true; });
  const drop = () => { if (!drag) return; const t = performance.now(); if (!drag.moved) hop = { from: seat, to: seat, t0: t, dur: 550, arc: 46 }; drag = null; nextHop = t + 12000; };
  canvas.addEventListener('pointerup', drop); canvas.addEventListener('pointercancel', drop);

  const tick = t => {
    requestAnimationFrame(tick);
    if (!mode || !awake) return;
    let lift = 0, want = drag ? 0 : 1;
    if (hop) { const k = Math.min(1, (t - hop.t0) / hop.dur), a = Math.sin(Math.PI * k);
      seat = { x: hop.from.x + (hop.to.x - hop.from.x) * k, y: hop.from.y + (hop.to.y - hop.from.y) * k }; lift = hop.arc * a; want = 1 - a; if (k >= 1) hop = null; }
    else if (mode === 'desk' && !drag && !CALM && t > nextHop) {   // now and then he moves to another perch, always inside the section
      const far = perches().map(clamp).filter(p => Math.hypot(p.x - seat.x, p.y - seat.y) > 30);
      if (far.length) { const to = far[Math.floor(Math.random() * far.length)]; hop = { from: seat, to, t0: t, dur: 800, arc: 70 }; }
      nextHop = t + 9000 + Math.random() * 8000;
    }
    sit += (want - sit) * 0.18;
    const s = t / 1000, r = canvas.getBoundingClientRect();
    const look = mode === 'desk' ? Math.max(-0.9, Math.min(0.9, (mx - (r.left + S / 2)) / 420)) : 0.45 + 0.4 * Math.sin(s * 0.5);   // desktop: he faces the cursor
    yaw += (look - yaw) * 0.08; pivot.rotation.y = yaw;
    pose(sit, CALM ? 0 : 0.28 * Math.sin(s * 2.2) * sit);
    spine.rotation.z = rest.get(spine).z + (CALM ? 0 : 0.035 * Math.sin(s * 1.3));
    const p = Math.min(1, (t - popAt) / 420), c = 2.2; pivot.scale.setScalar(p < 1 ? 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2 : 1);   // pops in (ease-out-back)
    place(lift); renderer.render(scene, cam);
  };
  requestAnimationFrame(tick);
}
