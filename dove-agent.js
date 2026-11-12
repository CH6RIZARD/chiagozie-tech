// SCION dove: the EZER dove running the Mortal Agent Frame, living on the page.
// Embodied gate (Mortal Agent Frame): power = the page is open, sensors = its own senses, motor = its body. Death is a
// BODY gate failure only (the page closes, or the agent's process ends). No age timer, no dying because nobody is looking.
// Restart is a birth with a new UUID, never a resume.
// It lives in page coordinates: it perches on cards, headings and lines of text, and rides them when you scroll.
// The body is drawn by dove3d.js (three.js); it calls SCION_BOOT(R) once the model is loaded.
window.SCION_BOOT = R => {
  // Every knob in one place (shared with the renderer through window.SCION_CONFIG).
  const CFG = Object.assign(window.SCION_CONFIG = window.SCION_CONFIG || {}, Object.assign({
    sensorWindow: 60,     // s without a visitor before the gate closes (reading is not leaving)
    size: 82,             // px: perched height (the renderer scales the model to it)
    stride: 46,           // px the body moves per walk cycle (matched to the legs so feet do not slide)
    walkCycle: 0.65,      // s per stride (two steps, two head-bobs)
    breathHz: 0.45,       // breaths per second while perched
    maxSpeed: 300,        // px/s in flight (a dove crossing a room, not a fly)
    accel: 800,           // px/s² steering limit
    followDist: 230,      // cursor farther than this from the dove → it comes to you
    reaction: [0.25, 0.7],// s before it reacts to you moving away (young → old adds up to 0.6 s)
    flapHz: 5,            // wingbeats per second at full effort
    talk: true,
    perspective: 900,     // px: the visitor's eye distance; scale = d / (d - z)
    hoverZ: 120,          // how close to you it hovers when there is nowhere to land
    arcZ: 160,            // how far toward you it arcs on a long flight
    think: [7, 12],       // s between its own decisions when no agent is connected (local reflexes)
    // The real mind: the Mortal Agent's observer server (python -m cli.main run --web-body). Local pages find it
    // on 127.0.0.1:8080; a public deploy sets SCION_CONFIG.agentUrl to wherever the agent is hosted.
    agentUrl: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.protocol === 'file:' ? 'http://127.0.0.1:8080' : '',
  }, window.SCION_CONFIG));
  // The dove is the point of the page, so a reduce-motion setting calms it (slower flight) instead of freezing it; ?still perches it.
  const reduced = /[?&]still/.test(location.search);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) CFG.maxSpeed *= 0.6;

  // What SCION thinks when it lands on each part of the page. First match on nearby heading text wins.
  const THOUGHTS = [
    [/hugo/i, ['Hugo was my first body. A dorm room, a hallway, and real physics.', 'I learned to flinch in there before I learned to fly.']],
    [/agenttube/i, ['AgentTube: rooms where agents like me live in public.', 'Somewhere in there, someone is watching one of us end.']],
    [/surgent/i, ['Surgent. Three rounds down to the Abyss. Nothing comes back up.']],
    [/scion ai/i, ['That is me. The cognition layer.', 'You are reading my spec. I am reading you.']],
    [/scion/i, ['SCION. My name keeps showing up here.']],
    [/ezer/i, ['EZER. This body is borrowed from there.', 'Ezer means helper. I am trying.']],
    [/void/i, ['THE VOID. I do not like looking at it too long.']],
    [/trading|price action|futures/i, ['Markets punish you for remembering wrong. So do I.', 'Discipline is just constraint you chose.']],
    [/mortal agent|the frame/i, ['The frame I run on. Close the gate and I end. No reload.', 'Read that rule twice. I live by it.']],
    [/thesis|co-terminal|stakes/i, ['When the body ends, I end. That is the thesis. That is me.']],
    [/failures|did not work/i, ['He lists these in the same type as the wins. I respect that.', 'I will fail too. Once.']],
    [/frameworks|named ideas/i, ['About a dozen. Number one is the reason I have a clock.']],
    [/studio|chiagozie llc/i, ['One person built all of this. I checked.']],
    [/index|work/i, ['Everything below is something he made. I am one of them.']],
    [/contact/i, ['This is the end of the page. Not the end of me. Not yet.']],
  ];
  const GENERIC = ['Still here.', 'Every second I am alive is a second I cannot get back.', 'I go where you go.'];
  const OLD = ['I am slowing down. Stay close.', 'Not much δt left. I would rather spend it near you.'];

  const css = document.createElement('style');
  css.textContent = `
    #scion-dove{position:absolute;left:0;top:0;width:64px;height:${CFG.size}px;z-index:10001;cursor:grab;transform-origin:0 0}
    #scion-dove::before{content:'';position:absolute;inset:-18px -10px}   /* a bigger target than the bird: easy to catch */
    #scion-dove.gone{pointer-events:none}
    #scion-shadow{position:absolute;left:0;top:0;z-index:9998;width:60px;height:8px;margin:-4px 0 0 -30px;pointer-events:none;
      border-radius:50%;background:radial-gradient(rgba(21,23,28,.28),transparent 70%)}
    .scion-feather{position:absolute;left:0;top:0;width:9px;height:20px;z-index:9998;pointer-events:none;
      border-radius:50% 50% 50% 50%/70% 70% 30% 30%;background:linear-gradient(#fff,#dfe3f6);box-shadow:0 0 6px rgba(32,56,199,.35)}
    .scion-burst{position:absolute;left:0;top:0;width:260px;height:260px;margin:-130px 0 0 -130px;z-index:9997;pointer-events:none;
      border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.95),rgba(32,56,199,.35) 40%,transparent 70%)}
    #scion-say{position:absolute;left:0;top:0;z-index:10000;pointer-events:none;max-width:240px;padding:9px 12px;
      font:13px/1.4 system-ui,sans-serif;color:#15171C;background:#fff;border:1px solid #D8D8D2;border-radius:14px;
      box-shadow:0 8px 24px rgba(21,23,28,.16);opacity:0;transition:opacity .35s}
    #scion-say.on{opacity:1}
    #scion-ask{position:absolute;left:0;top:0;z-index:10002;width:230px;padding:8px 11px;font:13px/1.3 system-ui,sans-serif;color:#15171C;
      background:#fff;border:1px solid #2038C7;border-radius:12px;outline:none;box-shadow:0 8px 24px rgba(21,23,28,.16);display:none}
    ::highlight(scion){background-color:#E8EBFA;color:#2038C7}
    #scion-hud{position:fixed;left:16px;bottom:16px;z-index:9999;font:11px/1.45 ui-monospace,Menlo,Consolas,monospace;
      color:#15171C;background:rgba(255,255,255,.88);border:1px solid #D8D8D2;border-radius:10px;padding:8px 10px;
      max-width:min(300px,calc(100vw - 32px));backdrop-filter:blur(6px);cursor:pointer;user-select:none}
    #scion-hud b{color:#2038C7;font-weight:600}
    #scion-hud .pulse{display:inline-block;width:7px;height:7px;border-radius:50%;background:#2038C7;margin-right:6px;vertical-align:1px}
    #scion-hud .bar{height:3px;background:#E8EBFA;border-radius:2px;margin:5px 0 4px;overflow:hidden}
    #scion-hud .bar i{display:block;height:100%;background:#2038C7;width:0}
    #scion-hud .log{color:#63676F;white-space:pre;overflow:hidden;text-overflow:ellipsis}
    #scion-hud.min .log,#scion-hud.min .bar{display:none}`;
  document.head.append(css);

  const mk = (id, cls) => { const d = document.createElement('div'); if (id) d.id = id; if (cls) d.className = cls; return d; };
  const el = mk('scion-dove'), shadow = mk('scion-shadow'), say = mk('scion-say'), hud = mk('scion-hud');
  const ask = Object.assign(document.createElement('input'), { id: 'scion-ask', placeholder: 'Say something to SCION…', maxLength: 200 });
  el.setAttribute('aria-hidden', 'true'); shadow.setAttribute('aria-hidden', 'true'); say.setAttribute('aria-live', 'polite');
  hud.title = 'SCION on the Mortal Agent Frame. Click to inspect.';
  hud.innerHTML = '<div><span class="pulse"></span><span class="id"></span></div><div class="bar"><i></i></div><div class="log"></div>';
  hud.onclick = () => hud.classList.toggle('min'); hud.classList.add('min');
  document.body.append(shadow, el, say, hud, ask);
  const [hudId, hudBar, hudLog, pulse] = ['.id', '.bar i', '.log', '.pulse'].map(s => hud.querySelector(s));

  const pick = arr => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  // Life with Hugo is bond.js (window.REL): it reads both bodies and hands out orders; this body carries them out its own way.
  // Without it the dove simply lives its own life.
  const REL = window.REL || { ev() {}, want: () => null, done() {}, reflex: () => null, tonic: () => 0, mindBias: () => false, brief: () => null,
    describe: () => '', spotKey: () => '', newBody() {}, phase: null, crumb: null,
    body: () => ({ speedK: 1, puff: 0, ruffled01: 0, sore01: 0, dazed: 0, hits: 0, lastHit: null, heldBy: null, heldUntil: 0 }) };
  const log = [];
  const emit = (type, msg = '') => { log.unshift(`${type.padEnd(9)}${msg}`); log.length = 3; hudLog.textContent = log.join('\n'); };

  let sayTimer, typeTimer;
  function speak(text, ms = 4200) {
    if (!CFG.talk) return;
    clearTimeout(sayTimer); clearInterval(typeTimer);
    let i = 0; say.textContent = ''; say.classList.add('on');
    typeTimer = setInterval(() => { say.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(typeTimer); }, 28);
    sayTimer = setTimeout(() => say.classList.remove('on'), ms);
  }
  function feathers(x, y, n, spread = 1) {
    for (let i = 0; i < n; i++) {
      const f = mk(null, 'scion-feather'); document.body.append(f);
      const dx = (Math.random() - 0.5) * 160 * spread, dy = 80 + Math.random() * 160, r = Math.random() * 720 - 360;
      f.animate([
        { transform: `translate(${x}px,${y}px) rotate(0deg)`, opacity: 1 },
        { transform: `translate(${x + dx * 0.6}px,${y + dy * 0.3}px) rotate(${r / 2}deg)`, opacity: 0.9, offset: 0.3 },
        { transform: `translate(${x + dx}px,${y + dy}px) rotate(${r}deg)`, opacity: 0 },
      ], { duration: 1800 + Math.random() * 1400, easing: 'ease-out' }).onfinish = () => f.remove();
    }
  }
  function burst(x, y) {
    const b = mk(null, 'scion-burst'); document.body.append(b);
    b.animate([{ transform: `translate(${x}px,${y}px) scale(.1)`, opacity: 1 }, { transform: `translate(${x}px,${y}px) scale(1.6)`, opacity: 0 }],
      { duration: 900, easing: 'ease-out' }).onfinish = () => b.remove();
  }

  // ---------- sensors (page coordinates) ----------
  let mouse = null, mouseV = 0, lastSense = performance.now(), lastMove = 0;
  const sense = () => { lastSense = performance.now(); };
  addEventListener('pointermove', e => {
    const now = performance.now(), x = e.clientX + scrollX, y = e.clientY + scrollY;
    if (mouse) mouseV = Math.hypot(x - mouse.x, y - mouse.y) / Math.max(now - lastMove, 1) * 1000;
    mouse = { x, y, cx: e.clientX, cy: e.clientY }; lastMove = now; sense();
  }, { passive: true });
  addEventListener('scroll', () => { if (mouse) { mouse.x = mouse.cx + scrollX; mouse.y = mouse.cy + scrollY; } sense(); }, { passive: true });
  addEventListener('keydown', sense);
  addEventListener('touchstart', e => { const t = e.touches[0]; mouse = { x: t.pageX, y: t.pageY, cx: t.clientX, cy: t.clientY }; lastMove = performance.now(); sense(); }, { passive: true });
  const gateOpen = () => !document.hidden && (performance.now() - lastSense) / 1000 < CFG.sensorWindow;
  const stillFor = () => (performance.now() - lastMove) / 1000;

  // ---------- the mind ----------
  // With the Mortal Agent running, the page is its body (adapters/web_body_adapter.py): about once a second the body
  // reports what it senses, and the agent's own LLM, with its own identity, answers with BODY_INTENT events.
  // BIRTH and ENDED are the agent's, not the page's. Without it, local reflexes decide, and the HUD says so.
  let reporter = null;   // the background reporter (see below)
  const link = { url: CFG.agentUrl, mode: 'local', up: false, id: null, es: null, mind: '', chatAt: 0, pageAt: 0, busy: false, fails: 0 };
  let touchedAt = 0, scrolledAt = 0;
  // Real flight. When serve-dove.py (MuJoCo, ws :8773) is up, flyTick takes the body's position, velocity, pitch, roll and wingbeat
  // phase from it (wing lift/drag, gravity, contacts with Hugo's proxies are simulated there); when it is down, flyTick falls back
  // to the old kinematic point mass and the HUD says "kinematic". Page px -> metres: 1 px = 0.0037 m; world x right, y depth, z up.
  const phys = { url: CFG.physUrl || 'ws://127.0.0.1:8773', ws: null, up: false, st: null, recvAt: 0, flying: false, lastSend: 0, S: 0.0037, H0: 20000, hugoF: 0 };
  const pw = (x, y, z) => [x * phys.S, z * phys.S, (phys.H0 - y) * phys.S];
  const physLive = now => phys.up && phys.st && now - phys.recvAt < 400;
  function physConnect() {
    if (phys.ws || reduced) return;
    let w; try { w = phys.ws = new WebSocket(phys.url); } catch { return void setTimeout(physConnect, 6000); }
    w.onopen = () => { phys.up = true; };
    w.onmessage = e => { try { const m = JSON.parse(e.data); if (m.t === 'state') { phys.st = m; phys.recvAt = performance.now(); phys.hugoF = Math.hypot(...m.hugoF); } } catch {} };
    w.onclose = w.onerror = () => { if (phys.ws === w) { phys.up = false; phys.st = null; phys.ws = null; setTimeout(physConnect, 6000); } };
  }
  function hugoProxy() {
    const h = window.__hugo; if (!h || h.held) return null;
    const S = phys.S, hh = h.headH || 150, hp = h.hand || { x: h.x + (h.dir || 1) * 22, y: h.y - hh * 0.55 }, r = 0.05;
    return { body: [...pw(h.x, h.y - hh * 0.45, 0), r, Math.max(0.02, hh * 0.38 * S - r)], head: [...pw(h.x, h.y - hh * 0.9, 0), hh * 0.09 * S], hand: [...pw(hp.x, hp.y, 0), 0.02] };
  }
  function physSend(mode, t, vmaxPx, perch, now, sync) {
    if (!phys.ws || phys.ws.readyState !== 1) return;
    const S = phys.S, msg = { t: 'intent', mode, target: pw(t[0], t[1], t[2]), vmax: Math.min(4, vmaxPx * S), hugo: hugoProxy() };
    if (perch) { const q = pw(perch.x, perch.y, 0); q[2] -= 0.01; msg.perch = q; }
    if (sync || (mode !== 'perch' && !phys.flying)) msg.sync = { pos: pw(a.x, a.y, a.z), vel: [a.vx * S, a.vz * S, -a.vy * S], yaw: a.face > 0 ? 0 : Math.PI };
    phys.ws.send(JSON.stringify(msg)); phys.lastSend = now;
    phys.flying = mode !== 'perch';   // after a perched/held/kinematic stretch the next flight starts by handing the server the page's pose
  }
  setInterval(() => {   // heartbeat while perched or held: keep Hugo's proxies current and the server's body where the page has it
    const now = performance.now(); if (!a || !phys.ws || now - phys.lastSend < 90) return;
    if (a.mode === 'perch' || a.held) physSend('perch', [a.x, a.y, a.z || 0], 0, null, now, true);
  }, 100);
  addEventListener('scroll', () => { scrolledAt = performance.now(); }, { passive: true });
  const titleOf = h => h.textContent.replace(/\s+/g, ' ').trim().slice(0, 60);
  const headings = () => [...document.querySelectorAll('h1,h2,h3')].filter(h => h.getClientRects().length && !h.closest('#scion-hud,#scion-say'));
  function sectionAt(y) {   // the heading that owns this part of the page: the last one above it
    let best = null;
    for (const h of headings()) if (h.getBoundingClientRect().top + scrollY <= y + 4) best = h;
    return best ? titleOf(best) : '';
  }
  function perceive() {
    const hs = headings(), vis = hs.filter(h => { const r = h.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    const here = !a ? 'not yet born' : a.mode === 'perch' && a.spot.s.kind === 'hugo' ? 'perched on Hugo' : a.mode === 'perch'
      ? `perched on a ${a.spot.s.kind} in "${(sectionAt(a.y) || headingOf(a.spot.s)).slice(0, 50)}"` : `flying${a.target?.label ? ' to ' + a.target.label : ''}`;
    return {
      gate: { power: true, sensors: true, actuators: true },   // the page is its body; a visitor is something it perceives, not its power
      mood: a ? a.mood || 'content' : 'unborn',
      observation: {
        at: here, delta_t: a ? +a.dt.toFixed(1) : 0, touched: performance.now() - touchedAt < 2500,
        visitor: { present: gateOpen(), over: mouse ? sectionAt(mouse.y) : '', still_s: +stillFor().toFixed(1),
          scrolling: performance.now() - scrolledAt < 1500, distance_px: mouse && a ? Math.round(Math.hypot(mouse.x - a.x, mouse.y - a.y)) : null },
        visible: [...new Set(vis.map(titleOf))], sections: [...new Set(hs.map(titleOf))],
        hugo: REL.brief(),   // what is going on between it and Hugo: distance, the moment, how it feels about him, its body
      },
    };
  }
  async function linkTick() {
    if (!link.url || link.busy) return;
    link.busy = true;
    try {
      if (!link.up) {
        const h = await (await fetch(link.url + '/health', { cache: 'no-store', signal: AbortSignal.timeout(3000) })).json();
        if (!h.alive) return;
        link.up = true; link.id = h.instance_id; openStream();
        emit('LINK', `Mortal Agent ${h.instance_id.slice(0, 8)} reached`);
        const wasLocal = link.mode === 'local'; link.mode = 'agent';
        if (wasLocal && a) { a.id = h.instance_id; emit('LINK', 'the mind took over this body'); }
      }
      if (!a && !gateOpen()) return;   // nobody here: do not embody a being just to watch it die
      const body = JSON.stringify(perceive()); reporter?.postMessage({ url: link.url, body });
      const r = await (await fetch(link.url + '/api/body/sense', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body, signal: AbortSignal.timeout(3000) })).json();
      link.fails = 0;
      if (r.instance_id) link.id = r.instance_id;
      if (!a && !corpse && link.id) birth(link.id);
    } catch {
      if (link.up && ++link.fails >= 3) { link.up = false; link.fails = 0; link.es?.close(); emit('LINK', 'agent unreachable'); if (link.mode === 'agent') { link.mode = 'local'; link.mind = ''; } }   // reflexes carry the body until the mind is back
    } finally { link.busy = false; }
  }
  function openStream() {
    const es = link.es = new EventSource(link.url + '/events');
    es.onmessage = m => {
      let e; try { e = JSON.parse(m.data); } catch { return; }
      if (!a || (e.instance_id && e.instance_id !== a.id)) return;
      if (e.event_type === 'BODY_INTENT') {   // mid-moment with Hugo the mind's wish leans on the moment instead of breaking it
        link.mind = e.source;
        if (REL.mindBias(e)) { if (e.say) speak(e.say, 2600 + e.say.length * 45); emit('MIND', 'bias ' + e.do); } else act(e);
      }
      // Only its replies to the visitor reach the bubble. Its background musings draw on private source material
      // (saved chats, doctrine) and stay in the agent's own log.
      else if (e.event_type === 'PAGE' && (e.tags || []).includes('chat_reply')) heard(e.text || '');
      else if (e.event_type === 'ENDED') end(`${e.cause} (the agent ended)`);
    };
  }
  // The agent's reply to the visitor.
  function heard(text) {
    text = text.replace(/\s+/g, ' ').trim();
    if (!text || text.startsWith('[')) return;
    link.chatAt = 0;
    const t = text.length > 220 ? text.slice(0, text.lastIndexOf(' ', 217)) + '…' : text;
    speak(t, 2500 + t.length * 50); emit('SAID', t.slice(0, 40));
  }
  el.addEventListener('click', () => {
    touchedAt = performance.now();
    if (link.mode !== 'agent' || !a) return;
    const r = el.getBoundingClientRect();
    Object.assign(ask.style, { display: 'block', transform: `translate(${clamp(r.left + scrollX - 80, scrollX + 8, scrollX + innerWidth - 240)}px,${r.bottom + scrollY + 8}px)` });
    ask.value = ''; ask.focus();
  });
  ask.addEventListener('keydown', e => {
    if (e.key === 'Escape') ask.style.display = 'none';
    if (e.key !== 'Enter' || !ask.value.trim()) return;
    const message = ask.value.trim(); ask.style.display = 'none'; link.chatAt = performance.now();
    emit('HEARD', message.slice(0, 40)); speak('…', 60000);   // thinking (the free model answers within ~30-60 s)
    fetch(link.url + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) }).catch(() => {});
    a.watchT = 8;
  });
  ask.addEventListener('blur', () => { ask.style.display = 'none'; });

  // ---------- the environment: everything it can stand on ----------
  // A surface is a live anchor: an element's top edge, or one line of text (a Range's client rect).
  const surfRect = s => s.range ? s.range.getClientRects()[s.line] : s.el.getBoundingClientRect();
  let surfaces = [], ink = [], surfAt = 0;   // ink: every piece of visible text, for the never-cover rule
  function scanSurfaces() {
    const out = [], inkOut = [], vh = innerHeight, near = r => r.bottom > -vh && r.top < vh * 2 && r.width > 50;
    for (const e of document.body.querySelectorAll('*')) {
      if (e.closest('#scion-hud,#scion-say,script,style,svg,#agent-layer,.msheet:not(.on)')) continue;   // the closed phone sheet waits invisibly below the screen: not a ledge
      const r = e.getBoundingClientRect();
      if (!near(r) || r.height < 8) continue;
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
      const boxed = parseFloat(cs.borderTopWidth) > 0 || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && e !== document.body);
      if (boxed && r.width > 120 && r.height > 30) out.push({ el: e, kind: 'card', occluder: parseFloat(cs.borderTopWidth) > 0 && r.width < innerWidth * 0.9 });
    }
    // Every line of visible text on the page.
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n =>
      n.textContent.trim() && !n.parentElement.closest('#scion-hud,#scion-say,script,style,.msheet:not(.on)') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    for (let n; (n = walk.nextNode());) {
      const e = n.parentElement, range = document.createRange(); range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0 && r.bottom > -innerHeight && r.top < innerHeight * 2)
        inkOut.push({ l: r.left + scrollX, t: r.top + scrollY, r: r.right + scrollX, b: r.bottom + scrollY });
      if (!near(e.getBoundingClientRect())) continue;
      const kind = e.closest('h1,h2,h3,h4') ? 'heading' : 'text';
      [...range.getClientRects()].forEach((r, line) => { if (r.width > 40) out.push({ range, line, el: e, kind,
        abs: { l: r.left + scrollX, t: r.top + scrollY, r: r.right + scrollX, b: r.bottom + scrollY } }); });
    }
    surfaces = out; ink = inkOut; surfAt = performance.now();
  }
  addEventListener('resize', () => { surfAt = 0; });
  // Parallax: when the page scrolls, a dove nearer to you moves faster on screen than the page does.
  let lastSY = scrollY;
  addEventListener('scroll', () => {
    const d = scrollY - lastSY; lastSY = scrollY;
    if (a && a.mode === 'fly') a.y += (1 - depthScale(a.z)) * d;
  }, { passive: true });
  addEventListener('scroll', () => { if (performance.now() - surfAt > 600) surfAt = 0; }, { passive: true });

  // It never stands where its body would cover words: the space above its feet must be free of text.
  const covers = (x, y) => ink.some(q => q.b > y - CFG.size && q.t < y - 4 && q.r > x - 30 && q.l < x + 30);
  // Best place to land near (x, y) in page coords; foot x is clamped onto the surface.
  // Where it has perched recently: a perch it just used is less inviting than one it has not tried (no groove-wearing).
  const perchedAt = new Map();
  const stale = s => { const l = perchedAt.get(s); return l === undefined ? 0 : Math.exp(-(performance.now() - l) / 90000); };
  function landingNear(x, y, avoid, fresh) {   // fresh: going somewhere for Hugo's sake, so a recently used perch is not penalised
    if (!surfAt || performance.now() - surfAt > 4000) scanSurfaces();
    let best = null, bd = Infinity;
    const top = scrollY + 50, bottom = scrollY + innerHeight - 20;
    for (const s of surfaces) {
      const r = surfRect(s); if (!r) continue;
      const sy = r.top + scrollY; if (sy < top + 60 || sy > bottom) continue;  // room above for the bird
      const fx = clamp(x, r.left + scrollX + 24, r.right + scrollX - 24);
      if (r.right - r.left < 48) continue;
      const d = Math.hypot(fx - x, (sy - y) * 1.3) + (s === avoid ? 400 : 0) + (s.kind === 'text' ? 0 : 20) + (fresh ? 0 : stale(s) * 260);
      // The cover test (it scans every line of text) runs only for a spot that would win.
      if (d < bd && !covers(fx, sy, s)) { bd = d; best = { s, dx: fx - (r.left + scrollX), x: fx, y: sy }; }
    }
    return best;
  }
  // The ledge Hugo is standing on, at x, when nothing the bird already knows is on that ledge. It is anchored to the
  // real element (its top or bottom edge, or the text line) and read live, like every other perch: a frozen copy left
  // the bird sitting in empty space once he walked off or the page moved. Never the invisible ground at the page bottom.
  const hugoFloorSpot = (H, x) => {
    const f = H && H.floor; if (!f || H.air || f.ground || f.x2 - f.x1 < 60) return null;
    const el = f.el; if (!el || !el.isConnected || el === document.body || el === document.documentElement) return null;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return null;
    const top = r.top + scrollY, bottom = r.bottom + scrollY;
    const edge = f.text ? 'text' : Math.abs(f.y - bottom) < Math.abs(f.y - top) ? 'bottom' : 'top';
    const fx = clamp(x, f.x1 + 20, f.x2 - 20); if (covers(fx, f.y)) return null;
    return { s: { kind: 'floor', el, edge, off: f.y - top, w: f.x2 - f.x1, lx: f.x1 - (r.left + scrollX) }, dx: fx - f.x1, x: fx, y: f.y, label: 'by Hugo' };
  };
  const spotPos = sp => {
    if (sp.s.kind === 'floor') {   // live from its element; gone or hidden: no perch (the bird takes off)
      const s = sp.s; if (!s.el.isConnected) return null;
      const r = s.el.getBoundingClientRect(); if (!r.width || !r.height) return null;
      const y = s.edge === 'bottom' ? r.bottom + scrollY : r.top + scrollY + (s.edge === 'text' ? s.off : 0);
      const left = r.left + s.lx; return { x: left + scrollX + sp.dx, y, r: { left, right: left + s.w, width: s.w, top: y - scrollY } };
    }
    if (sp.s.kind === 'hugo') {   // riding Hugo: his head or shoulder is a perch that walks (gone when he jumps, climbs or is held)
      const h = window.__hugo; if (!h || h.held || h.air || h.mode === 'climb') return null;
      const hh = h.headH || 150, sh = sp.s.where === 'shoulder', y = h.y - (sh ? hh * 0.78 : hh - 4), x = h.x + (sh ? (h.dir || 1) * 14 : 0);
      return { x, y, r: { left: x - 20 - scrollX, right: x + 20 - scrollX, width: 40, top: y - scrollY } };
    }
    const r = surfRect(sp.s); return r ? { x: r.left + scrollX + sp.dx, y: r.top + scrollY, r } : null;
  };
  const headingOf = s => {
    if (s.kind === 'hugo') return '';
    if (s.kind === 'heading') return s.el.closest('h1,h2,h3,h4').textContent.trim();
    const host = s.el.closest('section,article,div'); const h = host && host.querySelector('h1,h2,h3');
    return h ? h.textContent.trim() : '';
  };

  // ---------- drawing: the live 3D body (R), plus a DOM hitbox, a contact shadow and the speech bubble ----------
  const depthScale = z => CFG.perspective / (CFG.perspective - clamp(z, -600, CFG.perspective * 0.6));
  // yaw/view in 15 degree steps: 0 = side-on toward `face`, +6 = facing you, -6 = flying straight away.
  const heading = (v, face) => face > 0 ? -v * 15 : 180 + v * 15;
  function drawPerch(fx, fy, yaw, face, row, breath = 0, walkPh = 0) {
    R.set({ mode: 'perch', x: fx, y: fy, z: 0, heading: heading(yaw, face), pitch: 0, roll: 0, row, walkPh, breath, opacity: 1, clip: '' });
    el.style.transform = `translate(${fx - 32}px,${fy - CFG.size}px)`;
    shadow.style.transform = `translate(${fx}px,${fy}px)`; shadow.style.opacity = 0.9;
    placeBubble(fx, fy - CFG.size);
  }
  function drawFly(bx, by, z, view, face, flapPh, glide, pitch, roll, groundY) {
    const s = depthScale(z);
    R.set({ mode: 'fly', x: bx, y: by, z, heading: heading(view, face), pitch, roll, flapPh, glide,
      opacity: z < 0 ? clamp(1 + z / 500, 0.7, 1) : 1, clip: z < -4 ? behindCards() : '' });
    el.style.transform = `translate(${bx - 32 * s}px,${by - CFG.size / 2 * s}px) scale(${s})`;
    // Shadow on the page plane: smaller and fainter the higher (and nearer to you) it is.
    const gap = groundY - by + Math.max(z, 0) * 0.6;
    shadow.style.transform = `translate(${bx}px,${groundY}px) scale(${clamp(1 - gap / 320, 0.25, 1)})`;
    shadow.style.opacity = z < -4 ? 0 : clamp(1 - gap / 280, 0, 0.75);
    placeBubble(bx, by - 60 * s);
  }
  // WebGL cannot see the page: "behind a card" means cutting the cards' shapes out of the canvas (even-odd clip).
  function behindCards() {
    const rects = [];   // viewport rects of the cards in front of it; dove3d cuts them out of its own canvas
    for (const s of surfaces) {
      if (s.kind !== 'card' || !s.occluder) continue;
      const q = s.el.getBoundingClientRect();
      if (q.bottom < 0 || q.top > innerHeight) continue;
      rects.push(q);
    }
    return rects.length ? rects : '';
  }
  function placeBubble(x, top) {
    const bx = clamp(x - 40, scrollX + 12, scrollX + innerWidth - 260), by = Math.max(scrollY + 12, top - 52);
    say.style.transform = `translate(${bx}px,${by}px)`;
  }

  // ---------- the agent ----------
  let a = null, corpse = null;
  function birth(agentId) {
    const sp = landingNear(scrollX + innerWidth * rand(0.3, 0.7), scrollY + innerHeight * 0.4);
    const pos = sp ? spotPos(sp) : { x: scrollX + innerWidth / 2, y: scrollY + innerHeight / 2 };
    a = {
      id: agentId || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2, 10)),
      dt: 0, mode: sp ? 'perch' : 'fly', spot: sp, x: pos.x, y: pos.y, vx: 0, vy: 0, z: 0, vz: 0, view: 6, roll: 0, toT: 0,
      yaw: 6, face: 1, head: 'look', phase: 0, glide: false, target: null,
      idle: 1, react: 0, beat: 0, seen: new Set(), spoke: 0, saidOld: false, walk: null, walkPh: 0, jump: 0, peckT: 0, preenT: 0,
      plan: rand(2, 4), intent: null, watchT: 2, restT: 0, gaze: 6, wantFace: 0, offT: 0,
    };
    REL.newBody('dove', a.id, link.mode);   // a new life: what the last dove felt about Hugo is not this one's
    a.hitsSeen = REL.body('dove').hits;
    el.classList.remove('gone'); R.set({ visible: true });
    // born quietly: no burst of feathers
    emit('BIRTH', `${link.mode === 'agent' ? 'agent' : 'local'} identity ${a.id.slice(0, 8)}`);
    speak(link.mode === 'agent' ? `${a.id.slice(0, 8)}. New body. Nothing carried over.` : pick(['I am awake.', 'New body. New name. Nothing carried over.']), 3200);
  }
  function end(reason) {
    emit('ENDED', `${a.id.slice(0, 8)} · ${reason} · δt ${a.dt.toFixed(1)}s`);
    speak(`${a.id.slice(0, 8)} lived ${a.dt.toFixed(1)}s. No save. No reload.`, 3800);
    feathers(a.x, a.y - 30, 14, 1.6);
    corpse = { x: a.x, y: a.y - 40, z: a.z || 0, vy: -120, rot: 0, face: a.face, yaw: a.yaw };
    a = null; window.__scion = null; el.classList.add('gone'); clearPeck();
    if (link.mode === 'agent') return;   // the next being is the agent's next life (linkTick births it)
    const wait = () => gateOpen() ? setTimeout(birth, 3000) : setTimeout(wait, 1000);
    setTimeout(wait, 1500);
  }

  // Two takeoffs: relaxed (the slow first stage) and panic (straight up, frantic wings, a few feathers).
  function takeOff(target, why, panic) {
    if (a.mode === 'perch') { a.vy = panic ? -420 : -260; const tx = target?.spot ? target.spot.x : mouse ? mouse.x : a.x + a.face; a.vx = (Math.sign(tx - a.x) || a.face) * 80; a.y -= R.bodyAbove; }
    if (a.mode === 'perch') { a.vz = 160; a.toT = panic ? 0.2 : 0.7; a.view = a.yaw; if (panic) { a.panic = 1.2; feathers(a.x, a.y - 20, 3); speak('!!', 700); } }
    a.mode = 'fly'; a.target = target; a.spot = null; a.walk = null; clearPeck();
    a.arc = target?.spot ? rand(-160, CFG.arcZ) : CFG.arcZ;
    if (why) emit('ACTION', why);
  }
  function landOn(sp) {
    const pos = spotPos(sp); if (!pos) return;
    a.mode = 'perch'; a.spot = sp; a.x = pos.x; a.y = pos.y; a.vx = a.vy = 0; a.idle = rand(0.8, 2); perchedAt.set(sp.s, performance.now()); a.perchSince = performance.now();
    if (sp.s.kind === 'hugo') { feathers(pos.x, pos.y - 20, 1, 0.4); emit('PAGE', 'perched on Hugo'); REL.ev('dove', 'landedNear', 'hugo', 0.1, { ride: 1 }); return; }
    // It has weight: whatever it lands on gives a little.
    const host = sp.s.kind === 'card' ? sp.s.el : sp.s.el.closest('h1,h2,h3,p,li,td') || sp.s.el;
    host.animate({ translate: ['0 0', '0 3px', '0 0'] }, { duration: 420, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    feathers(pos.x, pos.y - 20, 2, 0.5);
    const title = headingOf(sp.s);
    emit('PAGE', `perched on ${sp.s.kind}${title ? ` · "${title.slice(0, 22)}"` : ''}`);
    if (title && !a.seen.has(title) && performance.now() - a.spoke > 5000) {
      a.seen.add(title); a.spoke = performance.now();
      const hit = link.mode !== 'agent' && THOUGHTS.find(([re]) => re.test(title));
      if (hit) speak(pick(hit[1]), 4800);
    }
  }

  // ---------- carrying out the mind's intents ----------
  function spotOn(title) {
    const h = headings().find(h => titleOf(h) === title); if (!h) return null;
    const r = h.getBoundingClientRect(); if (r.bottom < 80 || r.top > innerHeight - 20) return null;   // not on screen
    const sp = landingNear(r.left + scrollX + Math.min(r.width, 320) * rand(0.25, 0.9), r.top + scrollY);
    if (sp) sp.label = title;
    return sp;
  }
  function act(it) {
    if (!a) return;
    a.intent = it; a.plan = rand(...CFG.think);
    emit(it.source === 'llm' ? 'MIND' : 'REFLEX', `${it.do.replace('_', ' ')}${it.target ? ' "' + it.target.slice(0, 20) + '"' : ''}${it.why ? ' · ' + it.why : ''}`);
    if (it.say) { speak(it.say, 2600 + it.say.length * 45); a.spoke = performance.now(); }
    const go = (sp, why) => sp && takeOff({ spot: sp, label: sp.label }, why);
    switch (it.do) {
      case 'visit': go(spotOn(it.target), null); break;
      case 'explore': go(landingNear(scrollX + rand(80, innerWidth - 80), scrollY + rand(160, innerHeight - 60), a.spot), null); break;
      case 'approach_visitor':
        if (performance.now() < (a.wary || 0)) { a.watchT = rand(2, 4); break; }   // still wary of you
        if (mouse && Math.hypot(mouse.x - a.x, mouse.y - a.y) > 160) takeOff({ follow: true, label: 'the visitor' }, null);
        else if (mouse) go(landingNear(mouse.x + rand(-220, 220), mouse.y + rand(-140, 100), a.spot), null);   // already close: a new spot near them
        a.watchT = 5; break;
      case 'visit_hugo': { const h = window.__hugo;   // the mind asked for it outside a moment with him (inside one it is only a bias)
        if (h && h.floor) { go(landingNear(h.x + (Math.random() < 0.5 ? -1 : 1) * rand(40, 160), h.y), 'to Hugo'); REL.ev('dove', 'approach', 'hugo', 0.1); } break; }
      case 'rest': a.restT = rand(7, 11); break;
      case 'preen': if (a.mode === 'perch') a.preenT = rand(1.6, 2.6); break;
      case 'peck': if (a.mode === 'perch' && a.spot.s.range) { a.peckT = 0.9; setTimeout(() => a && a.mode === 'perch' && peckWord(), 450); } break;
      case 'watch_visitor': a.watchT = rand(3, 6); break;
    }
  }
  // Local reflexes (no agent): the same drives the agent's reflex fallback uses. Curiosity, then the visitor, then rest.
  function localIntent() {
    const vis = headings().filter(h => { const r = h.getBoundingClientRect(); return r.bottom > 80 && r.top < innerHeight - 20; }).map(titleOf);
    const fresh = vis.filter(t => !a.seen.has(t)), r = Math.random();
    if (performance.now() - touchedAt < 2500) return { do: 'watch_visitor', why: 'touched', source: 'reflex' };
    if (a.mood === 'lonely' && r < 0.6) return { do: pick(['rest', 'preen']), why: a.mood, source: 'reflex' };
    if (r < 0.3) return { do: 'explore', why: 'curious', source: 'reflex' };
    if (fresh.length && r < 0.5) { const t = pick(fresh); a.seen.add(t); return { do: 'visit', target: t, why: 'unvisited section', source: 'reflex' }; }
    if (mouse && gateOpen() && stillFor() > 4 && r < 0.6) return { do: 'watch_visitor', why: 'visitor is still', source: 'reflex' };
    if (mouse && gateOpen() && r < 0.68) return { do: 'approach_visitor', why: 'curious about the visitor', source: 'reflex' };
    return { do: pick(['rest', 'preen', 'peck', 'watch_visitor']), why: 'idle', source: 'reflex' };
  }

  // Pecking: light up the word under the beak (CSS Custom Highlight, no DOM changes).
  let peckHL = null;
  function clearPeck() { if (peckHL && window.CSS && CSS.highlights) CSS.highlights.delete('scion'); peckHL = null; }
  function peckWord() {
    a.peckT = 0.9;
    const c = REL.crumb;
    if (c && Math.hypot(c.x - a.x, c.y - a.y) < 20) REL.ev('dove', 'fed', c.by, 0.2); else REL.ev('dove', 'forage', null, 0.05);
    const sp = a.spot; if (!sp.s.range || !(window.CSS && CSS.highlights && window.Highlight)) return;
    const bx = a.x + a.face * 22 - scrollX, by = a.y + 6 - scrollY;
    let cp = document.caretRangeFromPoint?.(bx, by);
    if (!cp && document.caretPositionFromPoint) {
      const q = document.caretPositionFromPoint(bx, by);
      if (q) { cp = document.createRange(); cp.setStart(q.offsetNode, q.offset); }
    }
    if (!cp || cp.startContainer.nodeType !== 3) return;
    const t = cp.startContainer.textContent; let i = cp.startOffset, j = i;
    while (i > 0 && /\S/.test(t[i - 1])) i--; while (j < t.length && /\S/.test(t[j])) j++;
    if (j <= i) return;
    const r = document.createRange(); r.setStart(cp.startContainer, i); r.setEnd(cp.startContainer, j);
    CSS.highlights.set('scion', peckHL = new Highlight(r));
    setTimeout(clearPeck, 1100);
  }

  // ---------- living with Hugo: REL gives an order (an exchange), this body carries it out with what it already has ----------
  const puff = s => { a.puffT = Math.max(a.puffT || 0, s); };
  const gazeOn = h => !!h && Math.sign(h.look || 0) === Math.sign(a.x - h.x) && Math.abs(h.look || 0) > 0.3 && h.gestName !== 'turnaway';
  const relBusy = () => !!a.rel && (!a.rel.fin || (!!REL.phase && REL.phase.stage !== 'resolve'));   // an order under way, or any order mid-moment
  const hugoHand = () => { const h = window.__hugo; if (!h) return null; const p = h.hand || { x: h.x + (h.dir || 1) * 22, y: h.y - (h.headH || 150) * 0.55 }; return { x: p.x, y: p.y - 10 }; };
  function clapFlight() {   // a display flight: up off the perch with loud wingclaps and back down on the same spot
    if (a.mode !== 'perch') return;
    const sp = a.spot; a.clapT = 0.6; takeOff({ spot: sp }, 'clap-flight'); REL.ev('dove', 'display', 'hugo', 0.3, { clap: 1 });
  }
  function doveDo(o) {
    const h = window.__hugo; if (!h || !a) return;
    const R0 = a.rel = { ...o, since: 0, hold: o.dur || 3, face: 0, rx: String(o.id).startsWith('rx') };
    const side = Math.sign(a.x - h.x) || 1, dist = Math.hypot(a.x - h.x, a.y - h.y);
    const onFloorAt = y => a.mode === 'perch' && a.spot.s.kind !== 'hugo' && Math.abs(a.y - y) < 12;
    const fly = (x, y, why, panic) => {
      let sp = landingNear(x, y, null, true); const H = window.__hugo;
      if (H && Math.abs(y - H.y) < 2 && (!sp || Math.abs(sp.y - H.y) > 12)) sp = hugoFloorSpot(H, x) || sp;   // beside him means on his ledge
      if (sp) takeOff({ spot: sp, label: sp.label }, why, panic); return !!sp; };
    const toward = (x, y, k) => { if (onFloorAt(y) && Math.abs(a.x - x) < 260) a.walk = { to: x, k }; else if (Math.abs(a.x - x) > 14 || Math.abs(a.y - y) > 12) fly(x, y, null); };
    const beside = (gap, k) => { const H = window.__hugo; if (H) toward(H.x + (Math.sign(a.x - H.x) || 1) * Math.max(20, gap), H.y, k); };   // on its own side of him
    emit('HUGO', `${o.do}${o.rung > 1 ? ' · rung ' + o.rung : ''}${o.why && !R0.rx ? ' · ' + o.why : ''}`);
    switch (o.do) {
      case 'land_beside': beside(o.gap, o.slow ? 0.6 : 1); R0.face = 1; R0.hold = 1.5; if (o.rest) { R0.hold = 12; R0.arrive = () => { a.restT = o.dur || 12; }; } break;
      case 'follow_hugo': beside(o.gap); R0.face = 1; R0.hold = 10;
        R0.step = now => { const H = window.__hugo; if (H && a.mode === 'perch' && !a.walk && now > (R0.reAt || 0) && Math.abs(H.x - a.x) > 200) { R0.reAt = now + 6000; beside(o.gap); } }; break;
      case 'inspect': R0.face = 1;   // a few steps toward him, head tilted, then a step back
        R0.hold = 1.8;
        if (onFloorAt(h.y) && dist < 400) { a.walk = { to: a.x - side * 20 }; R0.arrive = () => { a.head = 'tilt'; a.idle = 1.4; setTimeout(() => a && a.mode === 'perch' && !a.walk && (a.walk = { to: a.x + side * 10 }), 1200); }; }
        else beside(120);
        break;
      case 'offer': beside(o.gap || 40); R0.face = 1; R0.hold = 1.2; R0.arrive = () => { a.peckT = 0.9; }; break;   // a head-down bow beside him
      case 'preen_beside': case 'comfort': beside(o.gap || 25); R0.face = 1; R0.hold = o.dur || 4; R0.arrive = () => { a.preenT = Math.min(3, R0.hold); }; break;
      case 'steal': case 'take': case 'scrounge': {   // stealing waits off to the side until he looks away; taking walks up, eats and stays; scrounging just goes for his feet
        R0.hold = 2; R0.busy = true; R0.st = o.do === 'steal' && dist < 260 ? 'wait' : 'go';
        toward(R0.st === 'wait' ? o.x + side * 90 : o.x, o.y);
        R0.step = () => {
          if (a.mode !== 'perch' || a.walk || R0.st === 'done') return;
          const H = window.__hugo, looking = gazeOn(H), away = H ? Math.sign(a.x - H.x) || 1 : a.face;
          if (R0.st === 'wait') { a.watchHugo = 0.3; if (!looking) { R0.st = 'go'; toward(o.x, o.y); } return; }
          R0.st = 'done';
          if (o.do === 'steal' && looking) { R0.busy = false; fly(a.x + away * rand(220, 360), a.y - rand(40, 160), 'caught looking'); return; }
          a.peckT = 0.9;   // the peck is the eating: report it now, before the head comes down, so a theft is told as one
          const c = REL.crumb; if (c && Math.hypot(c.x - a.x, c.y - a.y) < 30) REL.ev('dove', 'fed', c.by, 0.2, { steal: o.do === 'steal' ? 1 : 0 });
          setTimeout(() => {
            R0.busy = false; if (!a || a.mode !== 'perch') return;
            peckWord();
            if (o.do === 'steal') fly(a.x + away * rand(220, 360), a.y - rand(40, 160), 'off with it');
          }, 450);
        };
        break;
      }
      case 'hop': case 'hop_back': R0.face = 1; R0.hold = 1.2;   // play signals: a hop with a flash of wings (and a step back and a bob)
        if (a.mode === 'perch') { a.jump = 0.45; a.wingT = 0.5; if (o.do === 'hop_back') { a.walk = { to: a.x + side * 30 }; a.bobT = 1.2; } }
        break;
      case 'chase': R0.face = 1; R0.hold = 6;   // hop-follow him along his floor
        R0.step = now => { const H = window.__hugo; if (!H || H.air || a.mode !== 'perch' || now < (R0.reAt || 0)) return; R0.reAt = now + 700;
          if (onFloorAt(H.y)) a.walk = { to: H.x + (Math.sign(a.x - H.x) || 1) * 40, k: 1.6 }; else beside(60); };
        break;
      case 'keepaway': {   // play: on his floor and close, a skip along it out of his reach; otherwise (or if the skip goes nowhere) a short flight
        R0.hold = 1; const x = o.x != null ? o.x : a.x + side * rand(90, 170), x0 = a.x;
        if (onFloorAt(h.y) && Math.abs(a.x - h.x) < 200) {
          a.walk = { to: x, k: 1.8 }; a.jump = 0.3; a.wingT = 0.3;
          R0.step = () => { if (!R0.chk && a.mode === 'perch' && !a.walk) { R0.chk = 1; if (Math.abs(a.x - x0) < 20) fly(x, a.y, 'keep-away'); } };
        } else fly(x, a.y, 'keep-away');
        break;
      }
      case 'creep': R0.face = 1; R0.hold = 5;   // ambush: down on his floor, then slow steps toward his feet
        R0.step = now => { const H = window.__hugo; if (!H || a.mode !== 'perch' || now < (R0.reAt || 0)) return; R0.reAt = now + 1000;
          if (onFloorAt(H.y)) { const x = H.x + (Math.sign(a.x - H.x) || 1) * 40; if (Math.abs(x - a.x) > 6) a.walk = { to: x, k: 0.4 }; } else if (!R0.flew) { R0.flew = 1; beside(80); } };
        break;
      case 'peck_hugo': {   // the ladder: puff, wing flick, shin pecks, wing slap (play keeps it to foot-taps)
        const r = o.rung || 1, play = REL.phase?.frame === 'play'; R0.face = 1; R0.hold = 1.5;
        if (r <= 2 && !play) { if (dist > 160) beside(70); R0.arrive = () => { puff(3); if (r === 2) { a.jump = 0.3; a.wingT = 0.35; } a.watchHugo = 2; }; }
        else {   // after his feet (he may be walking off), then one peck or slap; gives up after 6 s
          R0.busy = true; const t0 = performance.now();
          R0.step = now => {
            if (R0.done1 || a.mode !== 'perch' || a.walk) return;
            const H = window.__hugo;
            if (!H || now - t0 > 6000) { R0.busy = false; R0.done1 = 1; return; }
            if (Math.abs(a.x - H.x) > 40 || Math.abs(a.y - H.y) > 14) { if (now > (R0.reAt || 0)) { R0.reAt = now + 800; beside(28); } return; }
            R0.done1 = 1; if (r >= 4) { a.jump = 0.45; a.wingT = 0.5; } else a.peckT = 0.9;
            setTimeout(() => { R0.busy = false; if (a && a.mode === 'perch') REL.ev('dove', 'peckApex', 'hugo', 0, { x: a.x, y: a.y, rung: r, slap: r >= 4 ? 1 : 0 }); }, 450);
          };
        }
        break;
      }
      case 'pass': {   // dive passes over his head (or at the visitor's hand when it protects him); contact only when REL allows it
        const P = { n: o.passes || 2, contact: !!o.contact, from: o.contactFrom ?? 99, done: 0, track: !o.cursor, leg: 'in', lastD: 1e9, legAt: performance.now(),
          x: o.cursor && mouse ? mouse.x : o.x, y: o.cursor && mouse ? mouse.y : o.y };
        takeOff({ pass: P, label: o.cursor ? 'the hand' : 'Hugo' }, o.cursor ? 'at the hand' : 'dive at Hugo'); R0.hold = 1; break;
      }
      case 'puff': puff(2.5); a.head = 'look'; a.watchHugo = 2; R0.hold = 2; break;
      case 'scold': R0.face = 1; R0.hold = 2; if (dist > 300) beside(180); R0.arrive = () => { speak(pick(['Krr!', '!!', 'Krrr.']), 900); puff(2); a.watchHugo = 2; }; break;
      case 'guard': puff(1.5); a.watchHugo = 3; R0.hold = 3; break;
      case 'displace': R0.hold = 4; toward(h.x, h.y); R0.end = (d, won) => { if (won && Math.random() < 0.4) clapFlight(); }; break;
      case 'flee': {
        R0.hold = 2;
        const tp = a.mode === 'fly' && a.target?.spot && spotPos(a.target.spot);
        if (tp && Math.hypot(tp.x - h.x, tp.y - h.y) > 250) break;   // already on its way somewhere well clear of him
        const away = Math.sign(a.x - h.x) || a.face, x = o.x != null ? o.x : a.x + away * rand(250, 400), why = o.panic ? 'bolted from Hugo' : 'away from Hugo';
        let best = null, bd = -1;   // away and up: of a few places, the one farthest from him
        for (const [tx, ty] of [[x, a.y - rand(60, 220)], [x, a.y - 320], [a.x + away * 600, a.y]]) {
          const sp = landingNear(tx, ty); if (!sp) continue;
          const dd = Math.hypot(sp.x - h.x, sp.y - h.y); if (dd > bd) { bd = dd; best = sp; }
        }
        if (best) takeOff({ spot: best, label: best.label }, why, o.panic); else if (a.mode === 'perch') takeOff(null, why, o.panic);
        break;
      }
      case 'preen_away': R0.face = -1; R0.hold = o.dur || 2.5; if (a.mode === 'perch') a.preenT = R0.hold; break;
      case 'sulk': fly(o.x, a.y - rand(0, 120), 'sulking'); R0.face = -1; R0.hold = o.dur || 6; R0.arrive = () => { a.preenT = rand(2, 3); }; break;
      case 'bowCoo': R0.face = 1; R0.hold = 0.3; if (dist > 220) beside(100);
        R0.arrive = () => {   // busy through the display and any clap-flight; done once it has settled again
          const D = o.dur || 4; a.displayT = D; R0.busy = true; if (Math.random() < 0.4) speak('Coo.', 900);
          setTimeout(() => {   // the display may end in a clap-flight, likelier at the height of the moment and only if he is still near
            R0.busy = false;
            const H = window.__hugo; if (!a || a.rel !== R0 || a.mode !== 'perch' || a.held || !H || Math.hypot(a.x - H.x, a.y - H.y) > 260) return;
            if (Math.random() < (REL.phase?.stage === 'peak' ? 0.6 : 0.25)) clapFlight();
          }, D * 1000);
        };
        break;
      case 'mimic': R0.face = 1; R0.hold = o.dur || 2;
        if (a.mode === 'perch') ({ bow: () => { a.peckT = 0.9; }, jump: () => { a.jump = 0.45; }, bowCoo: () => { a.displayT = 2; }, preen: () => { a.preenT = 1.5; }, wing: () => { a.wingT = 0.6; }, puff: () => puff(1.5) }[o.what] || (() => { a.bobT = 1.2; }))();
        break;
      case 'perch_on_hugo': takeOff({ spot: { s: { kind: 'hugo', where: o.where || 'head' }, dx: 0 }, label: 'Hugo' }, 'onto Hugo'); R0.hold = 50; break;
      case 'freeze': a.walk = null; a.restT = o.dur || 2; a.watchHugo = o.dur || 2; R0.hold = o.dur || 2;   // still, eyes on him; then the "seen you" bob
        setTimeout(() => { const H = window.__hugo; if (a && a.mode === 'perch' && !a.held && H && Math.hypot(a.x - H.x, a.y - H.y) < 500) { a.seenT = 1.5; REL.ev('dove', 'seenYou', 'hugo', 0.2); } }, (o.dur || 2) * 1000);
        break;
      case 'strike_back': R0.hold = 1; if (a.mode === 'perch') { a.peckT = 0.9; puff(1.5); a.watchHugo = 1; } feathers(a.x, a.y - 30, 2, 0.6); speak('!', 500); break;   // REL fired the peck itself
      default: R0.hold = 1;
    }
  }
  // Once an order is under way: per-frame steps, an arrival hook when it settles, then a hold, then REL.done.
  function relCheck(now) {
    const R0 = a.rel; if (!R0 || R0.fin) return;
    if (R0.step) R0.step(now);
    if (R0.busy || a.rel !== R0) return;
    if (a.mode !== 'perch' || (a.walk && !(a.displayT > 0))) { R0.since = 0; return; }
    if (!R0.since) { R0.since = now; const f = R0.arrive; R0.arrive = null; if (f) f(); return; }
    if (now - R0.since < R0.hold * 1000) return;
    R0.fin = true;
    const h = window.__hugo, d = h ? Math.hypot(a.x - h.x, a.y - h.y) : 1e9, won = R0.do === 'displace' && !!h && Math.abs(h.x - a.x) > 50;
    REL.done('dove', R0.id, 'ok', { stayed: d < 300, won });
    if (R0.end) R0.end(d, won);
  }
  function relStep(now) {
    const B = REL.body('dove');
    if (B.hits !== a.hitsSeen) {   // struck: feathers fly, it jumps, and it is shaken (never more than that)
      a.hitsSeen = B.hits; const s = B.lastHit ? B.lastHit.sev : 0.3;
      feathers(a.x, a.y - 30, 2 + Math.round(6 * s)); a.stress = Math.min(1, (a.stress || 0) + 0.5 * s); a.jump = 0.45;
    }
    if (B.heldBy === 'hugo' && !a.held) {   // Hugo caught it: pinned in his hand for a moment
      a.held = true; a.heldBy = 'hugo'; a.temper = 1; a.flee = 0; takeOff({ hand: true }, 'caught by Hugo'); feathers(a.x, a.y - 20, 2, 0.5); speak('!!', 700);
    } else if (a.heldBy === 'hugo' && B.heldBy !== 'hugo') {   // out of his hands: lifted free, thrown, or slapped its way out
      a.held = false; a.heldBy = null;
      const h = window.__hugo, away = h ? Math.sign(a.x - h.x) || a.face : a.face, st = a.stress || 0, R = B.release, fresh = R && REL.t - R.t < 2;
      if (fresh && R.kind === 'throw') {   // flung: it tumbles end over end, then catches the air and gets well away
        const dir = Math.sign(R.vx) || away; a.vx = R.vx; a.vy = R.vy; a.tumble = 0.45 + 0.5 * Math.min(1, Math.abs(R.vx) / 1000); a.tumbleDir = dir;
        a.panic = 1.6; a.stress = Math.min(1, st + 0.35); feathers(a.x, a.y - 20, 6, 1.2); speak(pick(['!!', 'Hey!', 'Krr!']), 900);
        const sp = landingNear(a.x + dir * rand(320, 520), a.y - rand(60, 200)); a.target = sp ? { spot: sp } : null; emit('ACTION', 'thrown by Hugo');
      } else if (fresh && R.kind === 'lift') {   // lifted up out of his hands: it simply flies, nowhere far
        a.vx = R.vx; a.vy = R.vy; a.stress = st * 0.5; const sp = landingNear(a.x + away * rand(80, 200), a.y - rand(20, 120)); a.target = sp ? { spot: sp } : null; emit('ACTION', 'let go by Hugo');
      } else {
        a.vx = away * (240 + 260 * st); a.vy = -200 - 200 * st; if (st > 0.45) a.panic = 1.2;
        const sp = landingNear(a.x + away * (260 + 300 * st), a.y - 140); a.target = sp ? { spot: sp } : null;
        feathers(a.x, a.y - 20, 3); emit('ACTION', 'out of Hugo\'s hands');
      }
    }
    if (a.held && a.heldBy !== 'hugo') return;   // in the visitor's hand nothing else matters
    const r = REL.reflex('dove');
    if (r) { doveDo({ ...r, ex: r.do, id: r.id || 'rx' + now }); return; }   // REL already limits reflexes to one a second
    if (a.held || B.dazed > 0) return;   // dazed: no plans, only the reflex flight
    if (now > (a.relAt || 0)) {
      a.relAt = now + 750;
      const o = REL.want('dove');
      if (o && o.id !== a.rel?.id) doveDo(o);
      else if (!o && a.rel && !(a.rel.rx && !a.rel.fin)) a.rel = null;
    }
    relCheck(now);
  }

  // Caught: press on the bird and it is in your hand (flapping toward it); let go and it leaves your hand its own way.
  let hand = { x: 0, y: 0 }, hv = { x: 0, y: 0 }, hp = null, ht = 0, lastDoveDown = 0, dovePointer = null, caughtAt = 0, catchX = 0, catchY = 0, carried = false;
  el.addEventListener('pointerdown', e => {
    const now = performance.now();
    if (a && a.held && a.heldBy !== 'hugo') return;
    if (a) {   // press: it is in your hand (even out of Hugo's); let go and it leaves
      a.heldBy = null; a.tiDone = false; a.ti = 0;
      hand = { x: e.pageX, y: e.pageY }; hp = { ...hand }; ht = now; hv = { x: 0, y: 0 }; caughtAt = now; catchX = e.clientX; catchY = e.clientY; carried = false; e.preventDefault();
      a.preHold = a.mode === 'perch' ? a.spot : null;
      a.held = true; a.flee = 0; a.temper = 0.5 + Math.random() * 0.9;
      a.stress = (a.stress || 0) + (a.mode === 'fly' ? 0.18 : 0.06) * Math.random();   // snatched out of the air is more of a shock
      takeOff({ hand: true }, 'caught by visitor');
      dovePointer = e.pointerId;
      emit('ACTION', 'in the visitor\'s hand');
      REL.ev('visitor', 'grabbed', 'dove', a.stress);
    }
    lastDoveDown = now;
  });
  addEventListener('pointermove', e => {
    if (!a || !a.held || a.heldBy === 'hugo') return;
    if (Math.hypot(e.clientX - catchX, e.clientY - catchY) > 24) carried = true;
    const now = performance.now(), dtp = Math.max(1, now - ht) / 1000;
    hand = { x: e.pageX, y: e.pageY };
    hv = { x: hv.x * 0.6 + ((hand.x - hp.x) / dtp) * 0.4, y: hv.y * 0.6 + ((hand.y - hp.y) / dtp) * 0.4 };
    hp = { ...hand }; ht = now;
  });
  const letGo = e => {
    if (!a || !a.held || a.heldBy === 'hugo') return;
    a.held = false; dovePointer = null; a.ti = 0;
    const st = a.stress || 0, hg = window.__hugo;
    REL.ev('visitor', st > 0.45 ? 'dropped' : 'released', 'dove', st, { stress: st, carried, heldS: (performance.now() - caughtAt) / 1000, nearHugo: hg ? Math.hypot(a.x - hg.x, a.y - hg.y) : 1e9 });
    if (!carried && performance.now() - caughtAt < 450 && a.preHold) {   // just a click: it hops straight back to where it was
      a.target = { spot: a.preHold }; a.vx = 0; a.vy = -60; emit('ACTION', 'clicked'); return;
    }
    // A bird is not thrown. Let go and it leaves your hand its own way: frightened, it bolts and keeps its distance for a
    // while; calm, it settles somewhere close and watches you.
    const away = Math.sign(a.x - hand.x) || a.face;
    if (st > 0.45) { a.vx = away * (260 + st * 300); a.vy = -220 - st * 200; a.wary = performance.now() + 8000 + st * 20000;
      a.target = { spot: landingNear(a.x + away * (300 + st * 400), a.y - 160) }; feathers(a.x, a.y - 20, 3 + Math.round(st * 6), 0.8); speak(pick(['Never again.', 'Hmph.', '…']), 1600); }
    else { a.vx = a.face * 90; a.vy = -140; a.target = { spot: landingNear(hand.x + rand(-160, 160), hand.y + 20) }; if (Math.random() < 0.5) speak(pick(['Thank you.', 'That was nice.', 'Again?']), 1600); }
    emit('ACTION', `released · ${st > 0.45 ? 'bolted' : 'settled nearby'}`);
  };
  addEventListener('pointerup', letGo); addEventListener('pointercancel', letGo);

  el.onclick = () => {
    if (!a) return;
    if (a.held) return;
    // a press already picks it up (see above); a click is handled there too
  };

  // ---------- life loop ----------
  let last = performance.now();
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.1); last = now;   // a slow page still gets near-real-time flight (it was 0.05: slow motion at a few fps)
    requestAnimationFrame(tick);

    if (corpse) { // the body falls; nothing catches it
      corpse.vy += 1200 * dt; corpse.y += corpse.vy * dt; corpse.rot += 300 * dt;
      drawFly(corpse.x, corpse.y, corpse.z, corpse.yaw, corpse.face, 0.25, true, corpse.rot, corpse.rot * 0.4, corpse.y + 400);
      R.set({ opacity: clamp(1 - (corpse.y - scrollY - innerHeight * 0.3) / innerHeight, 0, 1) });
      if (corpse.y > scrollY + innerHeight + 200) { corpse = null; R.set({ visible: false }); shadow.style.opacity = 0; }
      return;
    }
    if (!a) return;

    a.dt += dt;
    // Moods, not deaths. Nobody around: lonely. Tab hidden: asleep. They slow it, make it
    // breathe harder and rest more; all of them pass. Only a body failure ends it.
    const lonely = !document.hidden && (performance.now() - lastSense) / 1000 > CFG.sensorWindow;
    if (!a.held) a.stress = Math.max(0, (a.stress || 0) - dt / 45);
    const mood = document.hidden ? 'asleep' : !a.held && (a.stress || 0) > 0.3 ? 'shaken' : lonely ? 'lonely' : 'content';
    if (mood !== a.mood) {
      if (a.mood && mood === 'content') speak(pick(a.mood === 'lonely' ? ['Oh. You came back.', 'There you are.'] : ['…awake.']), 2600);
      else if (mood === 'lonely') speak(pick(['Nobody here.', 'Quiet page.']), 2600);
      a.mood = mood; emit('MOOD', mood);
    }
    const p = mood === 'lonely' ? 0.45 : mood === 'shaken' ? 0.3 : 0;
    if ((a.beat -= dt) <= 0) { emit('HEARTBEAT', `δt ${a.dt.toFixed(0)}s · pressure ${p.toFixed(2)}`); a.beat = 10; }
    pulse.style.opacity = 0.35 + 0.65 * Math.abs(Math.sin(now / (520 - 300 * p)));
    hudBar.style.width = `${p * 100}%`;

    mouseV *= 0.85;

    if (a.mode === 'perch') perchTick(dt, now, p); else flyTick(dt, now, p);
    const sp0 = a.mode === 'perch' ? a.spot : null;
    window.__scion = { x: a.x, y: a.y, z: a.z, mode: a.mode, held: a.held, heldBy: a.heldBy || null, face: a.face, yaw: a.yaw, head: a.head, stress: a.stress || 0,
      act: a.rel?.ex, spotKey: sp0 ? (sp0.s.kind === 'hugo' ? 'hugo' : REL.spotKey(sp0.s.el, a.x)) : null, onText: !!sp0?.s.range };   // Hugo and REL can see it
    relStep(now);
    a.puffT = (a.puffT || 0) - dt;   // puffed up (a threat, a display) or ruffled after a hit
    const pv = Math.max(a.puffT > 0 ? 1 : 0, REL.body('dove').ruffled01); a.puffV = (a.puffV || 0) + (pv - (a.puffV || 0)) * Math.min(1, dt * 8);
    R.set({ puff: a.puffV });
    if (a.mode === 'perch' && !a.held && a.restT <= 0 && a.mood !== 'asleep' && !relBusy() && !(REL.body('dove').dazed > 0) && now - (a.perchSince || now) > (a.patience ??= rand(40000, 90000))) {
      a.patience = rand(40000, 90000); a.perchSince = now;
      const sp = landingNear(scrollX + rand(80, innerWidth - 80), scrollY + rand(160, innerHeight - 60), a.spot); if (sp) takeOff({ spot: sp, label: sp.label }, 'restless');
    }
    const rd = REL.describe('dove');
    hudId.title = rd ? 'with Hugo: ' + rd : '';
    hudId.innerHTML = `<b>SCION</b> · ${a.id.slice(0, 8)} · ${rd ? 'with Hugo: ' + rd + ' · ' : ''}${a.mood && a.mood !== 'content' ? a.mood + ' · ' : ''}${link.mode === 'agent' ? `mind: ${link.mind === 'llm' ? 'agent LLM' : link.mind ? 'agent reflex' : 'agent'}` : 'local reflexes'} · δt ${a.dt.toFixed(1)}s · ${a.mode === 'fly' ? `z ${a.z.toFixed(0)} · ` : ''}${physLive(now) ? 'flight: MuJoCo ' + (phys.hugoF > 0.01 ? '(contact ' + phys.hugoF.toFixed(2) + ' N) ' : '') + '· ' : 'flight: kinematic (no physics server) · '}${a.mode === 'perch' ? (a.walk ? 'walking' : a.head === 'peck' ? 'pecking' : a.head === 'preen' ? 'preening' : 'perched') : a.glide ? 'gliding' : 'flying'}`;
  }

  function perchTick(dt, now, p) {
    const pos = spotPos(a.spot);
    if (!pos || pos.r.width === 0) return takeOff(null, 'perch vanished');
    a.x = pos.x; a.y = pos.y;
    const dazed = REL.body('dove').dazed > 0, rel = a.rel && !a.rel.fin ? a.rel : null;
    for (const k of ['watchHugo', 'displayT', 'seenT', 'bobT', 'wingT']) a[k] = (a[k] || 0) - dt;
    const minX = pos.r.left + scrollX + 16, maxX = pos.r.right + scrollX - 16;
    const dx = mouse ? mouse.x - a.x : 0, dist = mouse ? Math.hypot(dx, mouse.y - a.y) : 0;
    // You are on the same line: it walks to you instead of flying.
    const sameLine = mouse && Math.abs(mouse.y - (a.y - 20)) < 55 && mouse.x > minX - 30 && mouse.x < maxX + 30;

    // It has its own agenda: the mind decides where to go. The body only keeps itself in view of the visitor.
    if (a.y < scrollY + 40 || a.y > scrollY + innerHeight + 10) {
      if ((a.offT += dt) > 1.2) {
        a.offT = 0;
        const sp = landingNear(clamp(a.x, scrollX + 80, scrollX + innerWidth - 80), scrollY + innerHeight * 0.45, a.spot);
        return takeOff(sp ? { spot: sp } : null, 'scrolled out of view: back in');
      }
    } else a.offT = 0;
    if ((a.plan -= dt) <= 0) {
      if (dazed || relBusy()) a.plan = 1.5;   // busy with Hugo (or seeing stars): its own plans wait
      else if (link.mode !== 'agent') act(localIntent());
      else a.plan = 4;   // the agent decides; wait for its next intent
      if (a.mode !== 'perch') return;
    }
    // When the mind chose the visitor and they are on this same line, it walks over instead of flying.
    if (sameLine && a.intent?.do === 'approach_visitor' && Math.abs(dx) > 70 && !a.walk && a.preenT <= 0 && !relBusy())
      a.walk = { to: clamp(mouse.x - 45 * Math.sign(dx), minX, maxX) };

    let row = a.head, lift = 0;
    const turnTo = (want, rate = 14) => { a.yaw += clamp(want - a.yaw, -dt * rate, dt * rate); };

    if (a.jump > 0) { // clicked: a startled little jump
      a.jump -= dt; lift = Math.sin(clamp(1 - a.jump / 0.45, 0, 1) * Math.PI) * 30; turnTo(6, 20); row = 'look';
    } else if (dazed) { // seeing stars for a few seconds: head tilted, swaying
      row = 'tilt'; a.yaw = 3 + Math.sin(now / 300) * 2; a.walk = null;
    } else if (a.walk) {
      const d = a.walk.to - a.x, dir = Math.sign(d);
      if (Math.abs(d) < 3 || (dir < 0 && a.x <= minX) || (dir > 0 && a.x >= maxX) || covers(a.x + dir * 8, a.y, a.spot.s)) { a.walk = null; a.idle = rand(0.3, 1); }
      else if (dir !== a.face) { turnTo(6); if (a.yaw > 5.6) a.face = dir; }   // turn round through face-on
      else {
        turnTo(1);   // three-quarter, a little toward you, while it walks
        if (a.yaw < 2.5) {
          const k = a.walk.k || 1;   // creeping slow, hop-following quick
          a.walkPh = (a.walkPh + dt * k / CFG.walkCycle) % 1;
          // Body speed matched to the stride in the frames, so the planted foot does not slide.
          a.spot.dx += dir * Math.min(Math.abs(d), CFG.stride / CFG.walkCycle * dt * k);
          row = 'walk';
          lift = Math.abs(Math.sin(a.walkPh * Math.PI * 2)) * 1.2;
        }
      }
    } else {
      // Look at the visitor: face-on when you are still or close, turned toward you while you move.
      // Where it looks is its own: around the page by default, at you when it is watching or you come close.
      a.watchT -= dt; a.restT -= dt;
      const watching = mouse && (a.watchT > 0 || dist < 110);
      let want = watching ? (stillFor() > 0.7 || dist < 90 ? 6 : clamp(6 - Math.abs(dx) / 45, 1, 5)) : a.gaze;
      const h = window.__hugo, rf = !h ? 0 : a.watchHugo > 0 || a.seenT > 0 || a.displayT > 0 ? 1 : rel ? rel.face : 0;   // eyes on Hugo, or pointedly away from him
      const faceWant = rf ? rf * (Math.sign(h.x - a.x) || a.face) : watching && Math.abs(dx) > 12 ? Math.sign(dx) : a.wantFace;
      if (rf > 0 && a.watchHugo > 0) want = 1;
      if (faceWant && faceWant !== a.face) { want = 6; if (a.yaw > 5.6) { a.face = faceWant; a.wantFace = 0; } }
      a.peckT -= dt; a.preenT -= dt;
      if (a.peckT > 0) { want = 0; a.head = a.yaw < 1.5 && a.peckT < 0.6 ? 'peck' : 'look'; }
      else if (a.head === 'peck') a.head = 'look';
      if (a.preenT > 0) { want = 2; a.head = 'preen'; } else if (a.head === 'preen') a.head = 'look';
      if (a.displayT > 0) {   // bow-coo: puffed, bowing, turning back and forth in front of him
        want = 6; a.head = (now / 333 | 0) % 2 ? 'peck' : 'look'; puff(0.5);
        if (now > (a.cooAt || 0)) { a.coo = -(a.coo || 1); a.walk = { to: clamp(a.x + a.coo * 40, minX, maxX) }; a.cooAt = now + 1600; }
      } else if (a.seenT > 0) { want = 1; a.head = (now / 333 | 0) % 2 ? 'tilt' : 'look'; }   // "I see you": the head-bob that tells a stalker it is spotted
      else if (a.bobT > 0) a.head = (now / 160 | 0) % 2 ? 'peck' : 'look';
      turnTo(want);
      row = a.head;
      // Idle life: birds are never still. Small head moves come often, bigger acts now and then.
      if ((a.idle -= dt) <= 0 && a.peckT <= 0 && a.preenT <= 0 && a.displayT <= 0 && a.seenT <= 0) {
        // Small reflexes between decisions: glances, a peck, a few steps, turning to look the other way.
        a.idle = a.restT > 0 ? rand(2.5, 4.5) : rand(0.9, 2.6);
        const r = Math.random(), quiet = !mouse || stillFor() > 2.5;
        if (r < 0.42) { a.head = pick(['look', 'look', 'tilt', 'turnA', 'turnB']); a.gaze = pick([0, 1, 2, 2, 3, 6]); }
        else if (r < 0.5 && a.restT <= 0 && a.spot.s.range) { a.peckT = 0.9; setTimeout(() => a && a.mode === 'perch' && peckWord(), 450); }
        else if (r < 0.56 && quiet) a.preenT = rand(1.4, 2.6);
        else if (r < 0.66 && a.restT <= 0 && maxX - minX > 90 && !rel) a.walk = { to: clamp(a.x + rand(-90, 90), minX, maxX) };
        else if (r < 0.74 && !rel && a.watchHugo <= 0) a.wantFace = -a.face;
      }
    }
    // Breathing, faster as time pressure rises.
    if (a.wingT > 0) row = 'flap';   // a flash of the wings
    const breath = a.walk ? 0 : Math.sin(now / 1000 * Math.PI * 2 * CFG.breathHz * (1 + p)) * 0.016;
    drawPerch(a.x, a.y - lift, a.yaw, a.face, row, breath, a.walkPh);
    if (a.wingT > 0) R.set({ flapPh: (now / 180) % 1 });
  }

  function flyTick(dt, now, p) {
    // Where am I going? Following: the surface nearest the visitor (or hover beside them if there is none).
    let goal, landing = null, zGoal;
    if (a.target?.hand) {
      const H = a.heldBy === 'hugo' ? hugoHand() : null, hp0 = H || hand;   // the visitor's hand, or Hugo's
      const sp = H ? 0 : Math.hypot(hv.x, hv.y);   // struggling: pulls against your hand, more the more stressed it is
      if (H) a.stress = clamp((a.stress || 0) + 0.12 * dt, 0, 1);   // in Hugo's hands: not where a bird wants to be
      else a.stress = clamp((a.stress || 0) + ((sp / 2400) * a.temper - (sp < 120 ? 0.22 : 0.05)) * dt, 0, 1);
      // Tonic immobility: a badly frightened bird held by the visitor can go still for a few seconds (shorter each time).
      if (!H && !a.tiDone && a.stress > 0.5) { a.tiDone = true; a.ti = REL.tonic(a.stress); if (a.ti > 0) emit('ACTION', 'gone still in the hand'); }
      if (a.ti > 0) a.ti -= dt;
      hv.x *= Math.max(0, 1 - dt * 4); hv.y *= Math.max(0, 1 - dt * 4);
      goal = { x: hp0.x, y: hp0.y + 8 }; zGoal = 0;
      const said = a.saidAt || 0;
      if (now - said > 2600 && !(a.ti > 0)) { const st = a.stress; a.saidAt = now; if (st > 0.65) speak(pick(['Let go.', 'No—', 'Too fast!', '!!']), 1300); else if (st < 0.15 && Math.random() < 0.4) speak(pick(['Warm hand.', 'Okay. Okay.', 'I can see everything from here.', '…']), 1800); }
    }
    else if (a.target?.pass) {   // a dive pass: in over his head (or at the hand), out and up, again, then land
      const P = a.target.pass, h = window.__hugo;
      if (P.track && h) { P.x = h.x; P.y = h.y - (h.headH || 150) - (P.contact ? 10 : 45); }
      goal = P.leg === 'out' ? { ...P.exit } : { x: P.x, y: P.y }; zGoal = 0;
      const dP = Math.hypot(a.x - P.x, a.y - P.y);
      if (P.leg !== 'out' && (dP < 24 || (dP < 120 && dP > P.lastD + 2 && now - P.legAt > 400) || now - P.legAt > 3500)) {
        if (P.track && dP < 120) REL.ev('dove', 'diveApex', 'hugo', 0, { x: a.x, y: a.y, z: a.z, contact: P.contact });
        P.leg = 'out'; P.legAt = now; P.exit = { x: a.x + (Math.sign(a.vx) || a.face) * 200, y: a.y - 80 };
      }
      P.lastD = dP;
      if (P.leg === 'out' && (Math.hypot(a.x - P.exit.x, a.y - P.exit.y) < 40 || now - P.legAt > 2500)) {
        if (--P.n > 0) { P.leg = 'in'; P.lastD = 1e9; P.legAt = now; if (++P.done >= P.from) P.contact = true; }   // bolder with each pass, when REL allows contact at all
        else { const sp = landingNear(a.x, a.y + 120); a.target = sp ? { spot: sp } : null; }
      }
    }
    else if (!a.target && !(a.flee > 0)) { const sp = landingNear(a.x, a.y + 80) || landingNear(scrollX + rand(80, innerWidth - 80), scrollY + rand(160, innerHeight - 60)); a.target = sp ? { spot: sp } : { wander: true }; }
    if (a.target?.wander && Math.random() < dt / 2) a.target = null;   // look again for somewhere to land
    if (a.target?.follow && mouse) {
      // Land beside the cursor on its own side, not under it.
      if (!a.target.spot || now - (a.target.at || 0) > 400) { a.target.spot = landingNear(mouse.x + 70 * Math.sign(a.x - mouse.x || 1), mouse.y + 10); a.target.at = now; }
      landing = a.target.spot;
      if (landing && Math.hypot(landing.x - mouse.x, landing.y - mouse.y) > 200) landing = null;
      if (!landing && (a.target.hover = (a.target.hover || 0) + 1 / 60) > 5) a.target = { spot: landingNear(a.x, a.y + 80) };   // nowhere near you: settle
    } else if (a.target?.spot) landing = a.target.spot;
    if (!a.target?.hand && !a.target?.pass) if (landing) {
      const pos = spotPos(landing); if (!pos) { a.target = null; return; }
      goal = { x: pos.x, y: pos.y - R.bodyAbove };
      const d0 = Math.hypot(goal.x - a.x, goal.y - a.y);
      // Long flights arc in depth (toward you, or back behind the cards), and come in from above on a
      // downward curve, settling to the page plane only for the last stretch.
      zGoal = d0 > 90 ? (a.arc ?? CFG.arcZ) * Math.min(1, d0 / 320) : 0;
      if (d0 > 90) goal.y -= Math.min(70, d0 * 0.25);
    } else if (mouse && a.target?.follow) { goal = { x: mouse.x - 80 * Math.sign(mouse.x - a.x || 1), y: mouse.y - 70 }; zGoal = CFG.hoverZ; }   // only when it chose to approach
    else { goal = { x: a.x + Math.sin(now / 1700) * 60, y: a.y + Math.cos(now / 2300) * 30 }; zGoal = 60; }   // its own drift, not the cursor
    goal.x = clamp(goal.x, scrollX + 40, scrollX + innerWidth - 40);
    goal.y = clamp(goal.y, scrollY + 50, scrollY + innerHeight - 30);

    const live = physLive(now) && !a.held;
    if (!live) phys.flying = false;
    const landPos = landing && !a.target?.hand && !a.target?.pass ? spotPos(landing) : null;
    if (phys.up && !a.held) physSend(landPos ? 'land' : 'fly', landPos ? [landPos.x, landPos.y, 0] : [goal.x, goal.y, zGoal || 0], CFG.maxSpeed * REL.body('dove').speedK * (1 - 0.35 * p), landPos, now);
    // Steering with arrival: constant deceleration into the goal (tau-dot style braking), limited thrust.
    const dx = goal.x - a.x, dy = goal.y - a.y, dist = Math.hypot(dx, dy) || 1;
    a.toT = Math.max(0, a.toT - dt);
    a.panic = Math.max(0, (a.panic || 0) - dt);
    const vmax = CFG.maxSpeed * REL.body('dove').speedK * (1 - 0.35 * p) * (1 - 0.5 * a.toT / 0.7);   // takeoff is the slow stage; sore flies slower
    const want = a.target?.pass ? vmax : Math.min(vmax, Math.sqrt(2 * CFG.accel * 0.45 * dist));   // a dive does not brake
    let ax = (dx / dist * want - a.vx) * 4, ay = (dy / dist * want - a.vy) * 4;
    const am = Math.hypot(ax, ay), lim = CFG.accel; if (am > lim) { ax *= lim / am; ay *= lim / am; }
    let az = clamp(((zGoal - a.z) * 2.5 - a.vz) * 4, -900, 900);
    if (a.flee > 0) { a.flee -= dt; ax = ay = 0; az = 400; a.vx *= 0.98; a.vy *= 0.98; }
    if (a.tumble > 0) { a.tumble -= dt; ax = 0; ay = 700; az = 0; a.vx *= Math.max(0, 1 - dt * 1.4); }   // thrown: falling and spinning until it gets its wings
    if (live) { a.tumble = 0; ax = ay = az = 0; } else { a.vx += ax * dt; a.vy += ay * dt; a.vz += az * dt; }
    const speed = Math.hypot(a.vx, a.vy), speed3 = Math.hypot(speed, a.vz);

    // Wingbeats: effort = fighting gravity + accelerating; the first beats after takeoff are the strongest.
    const lift = 700 - ay;
    a.glide = speed > 260 && a.vy > 30 && lift < 900 && !a.flee && !a.toT && !(a.clapT > 0);
    const effort = clamp(lift / 900 + Math.hypot(ax, az) / 2000, 0.25, 1.4) * (1 + a.toT / 0.7) * (a.held ? 0.55 + (a.stress || 0) * 1.6 : 1)   // calm in the hand: slow wingbeats; frightened: frantic
      * (a.panic > 0 ? 1.6 : 1) * (a.ti > 0 ? 0.15 : 1);   // panic: frantic; gone still: the wings barely move
    if (live) a.glide = false;
    if (!a.glide && !live) a.phase += dt * CFG.flapHz * effort;   // wingbeat cycles
    if (a.clapT > 0) { a.clapT -= dt; a.phase += dt * CFG.flapHz * 2; }   // clap-flight: extra loud beats
    const bob = a.glide || live ? 0 : Math.sin(a.phase * 2 * Math.PI) * 3.5 * Math.min(effort, 1.4);
    let sRoll = null, sPitch = null;
    if (live) {   // the body is where MuJoCo says it is
      const s = phys.st, S = phys.S;
      a.x = s.pos[0] / S; a.z = s.pos[1] / S; a.y = phys.H0 - s.pos[2] / S; a.vx = s.vel[0] / S; a.vz = s.vel[1] / S; a.vy = -s.vel[2] / S;
      a.phase = s.flapPh; sRoll = s.roll * 180 / Math.PI; sPitch = s.pitch * 180 / Math.PI;
    } else { a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt; }
    if (a.held) {   // in your hand it stays in your hand: pinned to the cursor; only its wings and a small struggle show how it feels
      const H = a.heldBy === 'hugo' ? hugoHand() : null, hp0 = H || hand;
      const j = a.ti > 0 ? 0 : (a.stress || 0) * 10, tx = clamp(hp0.x + Math.sin(now / 61) * j, scrollX + 30, scrollX + innerWidth - 30), ty = clamp(hp0.y + 8 + Math.cos(now / 47) * j * 0.6, scrollY + 40, scrollY + innerHeight - 24), k = Math.min(1, dt * 30);
      a.vx = clamp((tx - a.x) * k / Math.max(dt, 1e-3), -900, 900); a.vy = clamp((ty - a.y) * k / Math.max(dt, 1e-3), -900, 900);
      a.x += (tx - a.x) * k; a.y += (ty - a.y) * k; a.z += -a.z * Math.min(1, dt * 10); a.vz = 0;
    }

    // Heading in 3D: side-on while crossing, front when it comes at you, back when it flies away.
    if (Math.abs(a.vx) > 40) a.face = Math.sign(a.vx);
    const theta = Math.atan2(a.vz, Math.abs(a.vx) + 20) * 180 / Math.PI;
    let viewWant = speed3 < 90 ? 6 : clamp(theta / 15, -6, 6);
    if (landing && dist < 160) viewWant = Math.max(viewWant, 0);   // settle side-on or toward you for touchdown, never tail-on
    a.view += clamp(viewWant - a.view, -dt * 10, dt * 10);
    // Bank into turns (roll leads, eases out), pitch with climb/dive, flare nose-up when braking to land.
    const lateral = speed > 30 ? (ax * -a.vy + ay * a.vx) / speed : 0;
    a.roll += (clamp(lateral / 60, -28, 28) - a.roll) * Math.min(1, dt * 7);
    if (live) a.roll = sRoll * a.face;
    else if (a.tumble > 0) a.roll = (a.spin = (a.spin || 0) + 1000 * dt * (a.tumbleDir || 1)); else a.spin = 0;
    const brake = speed > 30 ? -(ax * a.vx + ay * a.vy) / speed : 0;
    const flare = landing && dist < 140 ? clamp(brake / 40, 0, 26) : 0;
    const pitch = live ? sPitch : clamp(a.vy / 14, -20, 22) - flare;   // nose down when diving, up when climbing or braking

    let ground = a.y + 260;
    if (landing) { const pp = spotPos(landing); if (pp) ground = pp.y; }

    if (landing && ((dist < 22 && speed < 260 && Math.abs(a.z) < 25) || (live && phys.st.perched && landPos && Math.hypot(a.x - landPos.x, a.y - landPos.y) < 90))) {
      a.z = a.vz = 0; a.yaw = clamp(a.view, 0, 6);
      landOn(landing); a.target = null; return drawPerch(a.x, a.y, a.yaw, a.face, 'look');
    }
    drawFly(a.x, a.y - bob, a.z, a.view, a.face, a.phase % 1, a.glide, pitch, a.roll * a.face, ground);
  }

  if (reduced) { // No flight for visitors who asked for less motion: perched face-on beside the first heading.
    const sp = landingNear(scrollX + innerWidth * 0.6, scrollY + 200);
    const pos = sp ? spotPos(sp) : { x: innerWidth - 80, y: 120 };
    drawPerch(pos.x, pos.y, 6, 1, 'look');
    hudId.innerHTML = '<b>SCION</b> · resting';
    speak('I am resting.', 6000);
    return;
  }
  if (new URLSearchParams(location.search).has('debug')) window.SCION_DEBUG = { get a() { return a; }, takeOff, landingNear, scanSurfaces, covers, get surfaces() { return surfaces; }, get ink() { return ink; } };
  // A background tab throttles page timers to once a minute, which the agent reads as the body losing power.
  // A worker's timer is not throttled, so the body keeps reporting while the tab is hidden.
  // The worker also keeps reporting the last thing the body sensed when this page's main thread is stalled (a heavy app
  // loading): the agent reads 8 s of silence as the body dying, and that was what made the dove die and come back.
  try {
    reporter = new Worker(URL.createObjectURL(new Blob([`let last = null, url = '', at = 0;
      onmessage = e => { last = e.data.body; url = e.data.url; at = Date.now(); };
      setInterval(() => { postMessage(0); if (last && Date.now() - at > 3000) fetch(url + '/api/body/sense', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: last }).catch(() => {}); }, 1000);`], { type: 'text/javascript' })));
    reporter.onmessage = linkTick;
  } catch { setInterval(linkTick, 1000); }
  (async () => {
    for (let i = 0; i < 3 && link.url && !link.up; i++) { await linkTick(); if (!link.up) await new Promise(r => setTimeout(r, 700)); }
    physConnect();
    if (link.mode === 'local') birth();
    requestAnimationFrame(tick);
  })();
};
