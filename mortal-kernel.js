// Mortal Agent kernel for the page's two beings (Hugo and the dove), ported from the frame
// (C:/all-projects/agent/mortal_agent/agent_core: holy_rng.py, lifespan.py, motivation.py, goal_hierarchy.py,
// runtime_state.py, mortal_agent.py's NET_FETCH idle planner). Shared by hugo3d.js and dove-agent.js; bond.js (REL)
// feeds it each second and holds the needs (hunger, energy). window.MORTAL.
// - HolyRNG: OS entropy + performance.now jitter, mixed with SHA-256 (crypto.subtle). The seed lives in RAM only.
// - A hidden lifespan per being, log-uniform over years, sealed in localStorage with the birth time so it spans
//   visits. Never shown. Death: the lifespan runs out, or energy hits 0. Rebirth = a new id, nothing carried over.
// - Pressure exactly as motivation.py (curiosity .4, social isolation .3, existential anxiety .3; act at .45).
// - Drives -> goals -> actions: scored choice with a commitment bonus, minimum action times and hysteresis.
// - Idle curiosity: a few small public fetches per visit (the owner's GitHub activity, the visitor's sky), cached.
(() => {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const DOM = typeof document !== 'undefined';
  const store = k => { try { return G.localStorage ? G.localStorage.getItem(k) : null; } catch (e) { return null; } };
  const stash = (k, v) => { try { if (v == null) G.localStorage.removeItem(k); else G.localStorage.setItem(k, v); } catch (e) { /* private mode: RAM only */ } };
  const sget = k => { try { return JSON.parse(G.sessionStorage.getItem(k)); } catch (e) { return null; } };
  const sset = (k, v) => { try { G.sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* no session cache */ } };
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const now = () => (G.performance ? G.performance.now() : Date.now());
  let Q; try { Q = new URLSearchParams(G.location ? G.location.search : ''); } catch (e) { Q = new URLSearchParams(''); }
  const DEBUG = Q.has('debug');

  // ---------------------------------------------------------------- HolyRNG (holy_rng.py)
  const C = G.crypto;
  const sha = async bytes => new Uint8Array(await C.subtle.digest('SHA-256', bytes));
  function entropy() {   // OS bytes + 8 timer-jitter samples, as _collect_entropy
    const parts = [C.getRandomValues(new Uint8Array(16))];
    for (let i = 0; i < 8; i++) {
      const t0 = now(), b = C.getRandomValues(new Uint8Array(4)), t1 = now(), j = new Uint8Array(4);
      new DataView(j.buffer).setUint32(0, (((t1 - t0) * 1e6) ^ (t1 * 1e3)) >>> 0);
      parts.push(b, j);
    }
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  // A stream of SHA-256(state || counter) blocks, pre-computed into a pool (subtle is async); u() is synchronous.
  async function HolyRNG() {
    let state = C.subtle ? await sha(await sha(entropy())) : C.getRandomValues(new Uint8Array(32)), counter = 0, filling = null;
    const pool = [];
    const refill = n => filling || (filling = (async () => {
      for (let i = 0; i < n; i++) {
        const buf = new Uint8Array(40); buf.set(state); new DataView(buf.buffer).setUint32(36, ++counter);
        state = C.subtle ? await sha(buf) : C.getRandomValues(new Uint8Array(32)); pool.push(state.slice());
      }
      filling = null;
    })());
    await refill(16);
    const r = {
      u() {   // uniform [0, 1), 53 bits, as uniform_01
        if (pool.length < 6) refill(16);
        const b = pool.length ? pool.shift() : C.getRandomValues(new Uint8Array(32));   // pool drained mid-burst: OS bytes for that one draw
        const v = new DataView(b.buffer, b.byteOffset, 8);
        return ((v.getUint32(0) & 0x1fffff) * 4294967296 + v.getUint32(4)) / 9007199254740992;
      },
      bytes(n) { const out = new Uint8Array(n); for (let i = 0; i < n; i++) out[i] = (r.u() * 256) | 0; return out; },
      range: (a, b) => a + (b - a) * r.u(),
    };
    return r;
  }

  // ---------------------------------------------------------------- lifespan (lifespan.py), calibrated to years
  const YEAR = 365.25 * 86400;
  const LIFE_MIN = 1 * YEAR, LIFE_MAX = 5 * YEAR;
  const sampleLifespan = (rng, min = LIFE_MIN, max = LIFE_MAX) => Math.exp(Math.log(min) + rng.u() * (Math.log(max) - Math.log(min)));
  const uuid = rng => { const b = rng.bytes(16); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128; const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };
  // shortcut: the seal only keeps the death time out of plain sight (devtools can still read it); a real secret needs a server.
  const mask = id => parseInt(id.replace(/-/g, '').slice(0, 9), 16);
  const seal = (id, deathAt) => (deathAt * 7 + mask(id)).toString(36);
  const unseal = (id, s) => (parseInt(s, 36) - mask(id)) / 7;
  const KEY = who => 'mortal.v1.' + who;

  // ---------------------------------------------------------------- motivation (motivation.py, exact)
  const W_CUR = .4, W_SOC = .3, W_EXI = .3, ACT = .45, SILENCE = 60, STALL_AFTER = 15;
  const newMot = () => ({ c: 0, s: 0, e: 0, stall: 0 });
  const total = m => Math.min(1, m.c * W_CUR + m.s * W_SOC + m.e * W_EXI);
  function motStep(m, silenceS, unknowns, stalled) {
    if (silenceS >= SILENCE * .5) m.s = Math.min(1, .2 + .8 * (silenceS / Math.max(1, SILENCE))); else m.s = Math.max(0, m.s - .02);
    m.c = Math.min(1, .1 + .4 * Math.min(5, Math.max(0, unknowns)) / 5);
    if (stalled) { m.stall++; m.e = Math.min(1, .1 + .02 * Math.min(30, m.stall)); } else { m.stall = Math.max(0, m.stall - 1); m.e = Math.max(0, m.e - .02); }
    m.c = Math.max(0, m.c - .01); m.s = Math.max(0, m.s - .01); m.e = Math.max(0, m.e - .01);   // decay_slightly
    return total(m);
  }

  // ---------------------------------------------------------------- goal hierarchy (goal_hierarchy.py) + scored choice
  const DRIVES = { curiosity: .4, consequence: .25, coherence: .2, survival: .15 };
  // options: [{ id, drive, u (0..1), move, minT (s), urgent }]. Self-directed moves need pressure >= .45 (the frame acts
  // only above its threshold; below it silence is valid). The current action keeps a 1.3x commitment bonus, and nothing
  // replaces it before its minimum time unless an option is urgent (survival).
  function pick(who, opts, p) {
    const B = beings[who], cur = B.act, t = now() / 1000, prev = cur ? cur.id : B.lastAct;
    let best = null, bs = 0;
    for (const o of opts) {
      if (!o || !(o.u > 0)) continue;
      if (o.move && p < ACT) continue;
      let s = o.u * (.5 + (DRIVES[o.drive] || .2));
      if (prev === o.id) s *= 1.3;   // commitment: what it is (or was just) doing keeps a bonus, so near-ties do not flip
      if (s > bs) { bs = s; best = o; }
    }
    if (cur && t - cur.t0 < (cur.minT || 0) && !(best && best.urgent && best.id !== cur.id)) return null;   // still committed
    if (!best || bs < .12) { B.act = null; return null; }
    if (cur && cur.id === best.id && t - cur.t0 < (cur.maxT || 30)) return null;   // keep doing it
    B.act = { ...best, t0: t };
    return B.act;
  }

  // ---------------------------------------------------------------- beings
  let rng = null;
  const beings = { hugo: null, dove: null };
  const subs = { hugo: [], dove: [] };
  const fire = (who, type, x) => { for (const f of subs[who]) { try { f(type, x); } catch (e) { if (DEBUG) console.error(e); } } };
  function fresh(who, id, born, deathAt) {
    return { who, id, born, deathAt, dt: 0, alive: true, external: false, mot: newMot(), act: null, visited: new Set(), lastUser: now(), progressAt: now(), goals: [], ended: null };
  }
  function create(who) {
    const id = uuid(rng), born = Date.now(), deathAt = born + sampleLifespan(rng) * 1000;
    stash(KEY(who), JSON.stringify({ id, born, seal: seal(id, deathAt) }));
    return fresh(who, id, born, deathAt);
  }
  function load(who) {
    let r = null; try { r = JSON.parse(store(KEY(who))); } catch (e) { r = null; }
    if (r && r.id && r.born && r.seal) {
      const deathAt = unseal(r.id, r.seal);
      if (isFinite(deathAt) && deathAt > r.born) {
        if (Date.now() < deathAt) return fresh(who, r.id, r.born, deathAt);
        const b = create(who); b.ended = { id: r.id, cause: 'lifespan_expired' };   // it died while nobody was here
        return b;
      }
    }
    return create(who);
  }
  function die(who, cause) {
    const B = beings[who]; if (!B || !B.alive) return;
    B.alive = false; stash(KEY(who), null);   // death is final: no save, no reload
    fire(who, 'ENDED', cause);
  }
  async function newBeing(who) {
    await ready;
    const B = beings[who] = create(who);
    fire(who, 'BIRTH', B.id);
    return B.id;
  }

  // ---------------------------------------------------------------- the page as it senses it: sections seen, the visitor
  const sec = { all: [], inView: new Set(), seen: new Set() };
  const titleOf = h => h.textContent.replace(/\s+/g, ' ').trim().slice(0, 60);
  let tops = [], topsAt = -1e9;
  function sectionAt(y) {   // the heading that owns page height y (the last one above it); heading tops re-read every 2 s at most
    if (!DOM) return null;
    if (now() - topsAt > 2000) { topsAt = now(); tops = sec.all.filter(h => h.isConnected && h.getClientRects().length).map(h => [h.getBoundingClientRect().top + scrollY, titleOf(h)]); }
    let best = null, bt = -1e9; for (const [t, n] of tops) if (t <= y + 4 && t > bt) { bt = t; best = n; }
    return best;
  }
  function watchSections() {
    if (!DOM || !G.IntersectionObserver) return;
    const io = new IntersectionObserver(es => { for (const e of es) { const t = titleOf(e.target); if (e.isIntersecting) { sec.inView.add(t); sec.seen.add(t); } else sec.inView.delete(t); } });
    const scan = () => { for (const h of document.querySelectorAll('h1,h2,h3')) if (!sec.all.includes(h) && !h.closest('#scion-hud,#scion-say')) { sec.all.push(h); io.observe(h); } };
    scan(); setTimeout(scan, 4000);
  }

  // ---------------------------------------------------------------- environment and idle curiosity (NET_FETCH)
  const env = { hour: new Date().getHours(), night: false, isDay: null, weather: '', temp: null, sleepy: 0, self: null };
  function envUpdate() {
    env.hour = new Date().getHours();
    env.night = env.isDay === 0 || (env.isDay == null && (env.hour < 6 || env.hour >= 22));
    env.sleepy = (env.night ? .3 : 0) + (/rain|snow|storm/.test(env.weather) ? .1 : 0);
  }
  envUpdate();
  const FETCH = { budget: 4, used: 0, busy: false, done: new Set(), nextAt: 8000 };
  const get = async (url, key) => {
    const c = sget('mortal.f.' + key); if (c) return c;
    if (FETCH.used >= FETCH.budget) return null;
    FETCH.used++;
    const r = await fetch(url, { cache: 'force-cache', credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined });
    if (!r.ok) return null;
    const j = await r.json(); sset('mortal.f.' + key, j); return j;
  };
  const WMO = c => (c >= 95 ? 'storm' : c >= 71 && c <= 86 && !(c >= 80 && c <= 82) ? 'snow' : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) ? 'rain' : c >= 45 && c <= 48 ? 'fog' : c >= 2 ? 'cloud' : 'clear');
  const SOURCES = {
    // about itself: what its maker last pushed (public events, 60 requests/h unauthenticated; one per visit at most)
    async github() {
      const ev = await get('https://api.github.com/users/CH6RIZARD/events/public?per_page=15', 'gh');
      const push = Array.isArray(ev) && ev.find(e => e.type === 'PushEvent' && e.repo);
      if (!push) return;
      const repo = push.repo.name.split('/').pop(), ageH = (Date.now() - Date.parse(push.created_at)) / 36e5;
      env.self = { repo, ageH: Math.round(ageH) };
      const words = repo.toLowerCase().split(/[-_.]+/).filter(w => w.length > 2 && !/^(the|app|web|site|io|github|main)$/.test(w));
      const h = sec.all.find(h => words.some(w => titleOf(h).toLowerCase().includes(w)));
      const pri = ageH < 72 ? .8 : .4;   // fresh work is more interesting
      for (const who of ['hugo', 'dove']) addGoal(who, { id: 'gh:' + repo, desc: `visit ${repo}${h ? ' (' + titleOf(h) + ')' : ''}`, drive: 'curiosity', title: h ? titleOf(h) : null, pri, novel: 1 });
    },
    // about its world: the visitor's sky, from the time zone's city only (no geolocation, nothing personal sent)
    async sky() {
      let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { tz = ''; }
      const city = tz.includes('/') ? tz.split('/').pop().replace(/_/g, ' ') : '';
      if (!city) return;
      const g = await get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`, 'geo:' + city);
      const p = g && g.results && g.results[0]; if (!p) return;
      const w = await get(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude.toFixed(1)}&longitude=${p.longitude.toFixed(1)}&current=is_day,temperature_2m,weather_code&timezone=auto`, 'sky:' + city);
      const cur = w && w.current; if (!cur) return;
      env.isDay = cur.is_day; env.weather = WMO(cur.weather_code); env.temp = cur.temperature_2m; envUpdate();
    },
  };
  async function curiosity(B) {   // the frame's _autonomous_planner_loop: idle (10 s untouched) with something unknown -> fetch, one source at a time
    if (FETCH.busy || now() < FETCH.nextAt || (G.navigator && G.navigator.onLine === false) || (DOM && document.hidden)) return;
    if ((now() - B.lastUser) / 1000 < 10 || B.mot.c < .15) return;
    const src = Object.keys(SOURCES).find(k => !FETCH.done.has(k)); if (!src) return;
    FETCH.busy = true; FETCH.done.add(src); FETCH.nextAt = now() + 15000;
    try { await SOURCES[src](); } catch (e) { /* offline, blocked or rate-limited: it simply does not learn this today */ } finally { FETCH.busy = false; }
  }
  function addGoal(who, g) {
    const B = beings[who]; if (!B || B.goals.some(x => x.id === g.id)) return;
    B.goals.push({ ...g, done: false }); if (B.goals.length > 10) B.goals.shift();
  }

  // ---------------------------------------------------------------- the 1 Hz tick (called by REL)
  // sig: { hugo: { energy, x, y, section }, dove: {...} } from REL's needs and the bodies.
  const speed = DEBUG && +Q.get('lifex') > 0 ? +Q.get('lifex') : 1;   // ?debug&lifex=N: needs run N times faster (death/rebirth tests only)
  function tick(dt, sig) {
    if (!beings.hugo) return;
    const gate = !(DOM && document.hidden);   // embodied time accrues only while the page is visible
    envUpdate();
    for (const who of ['hugo', 'dove']) {
      const B = beings[who], s = (sig && sig[who]) || {};
      if (!B || !B.alive) continue;
      if (gate) B.dt += dt;
      const section = s.section || (s.y != null ? sectionAt(s.y) : null);
      if (section && !B.visited.has(section)) { B.visited.add(section); progress(who, 'new place'); }
      const unknowns = [...sec.seen].filter(t => !B.visited.has(t)).length + B.goals.filter(g => !g.done && g.novel).length;
      const silence = (now() - B.lastUser) / 1000;   // the visitor's silence toward this being (touch, hover, the cursor close)
      B.p = motStep(B.mot, silence, unknowns, (now() - B.progressAt) / 1000 > STALL_AFTER);
      if (B.external || !gate) continue;   // a frame or agent process owns this life on localhost
      if (Date.now() >= B.deathAt) die(who, 'lifespan_expired');
      else if (s.energy != null && s.energy <= 0) die(who, 'energy_depleted');
    }
    if (beings.dove && beings.dove.alive) curiosity(beings.dove);
  }
  function progress(who, why) { const B = beings[who]; if (B) { B.progressAt = now(); B.lastWhy = why; } }
  const MOODS = (who, n) => {   // mood: REL's affect point toward the other plus the needs
    const B = beings[who]; if (!B || !B.alive) return 'gone';
    if (n.energy < .25) return 'tired'; if (n.hunger > .6) return 'hungry';
    if (env.night && n.energy < .5) return 'sleepy'; if (n.stress > .3) return 'shaken';
    if (B.mot.s > .6) return 'lonely'; if (n.aff < -.25) return 'wary'; if (n.aro > .55 && n.aff > .2) return 'playful';
    if (B.mot.c > .35) return 'curious'; return 'content';
  };

  let ready;
  const MORTAL = {
    YEAR, ACT, DRIVES, HolyRNG, sampleLifespan, motStep, total, env, sec, speed,
    get ready() { return ready; },
    being: who => beings[who],
    alive: who => !!(beings[who] && beings[who].alive),
    id: who => (beings[who] ? beings[who].id : null),
    pressure: who => (beings[who] ? beings[who].p || 0 : 0),
    mot: who => (beings[who] ? beings[who].mot : newMot()),
    mood: (who, needs) => MOODS(who, needs || {}),
    heard(who) { const B = beings[who]; if (B) B.lastUser = now(); },   // the visitor engaged this being directly
    progress, tick, die, newBeing,
    external(who, on) { const B = beings[who]; if (B) B.external = !!on; },
    visited(who, title) { const B = beings[who]; if (B && title && !B.visited.has(title)) { B.visited.add(title); progress(who, 'visited ' + title); } },
    unvisitedInView: who => { const B = beings[who]; return B ? [...sec.inView].filter(t => !B.visited.has(t)) : []; },
    goal: who => { const B = beings[who]; return B ? B.goals.find(g => !g.done) || null : null; },
    goalDone(who, id) { const B = beings[who]; const g = B && B.goals.find(x => x.id === id); if (g) { g.done = true; progress(who, 'goal ' + id); } },
    choose: (who, opts) => (beings[who] ? pick(who, opts, beings[who].p || 0) : null),
    current: who => (beings[who] ? beings[who].act : null),
    done(who) { const B = beings[who]; if (B && B.act) { B.lastAct = B.act.id; B.act = null; } },   // the body finished (or gave up on) its action
    on(who, f) { subs[who].push(f); },
    get fetches() { return { used: FETCH.used, budget: FETCH.budget, done: [...FETCH.done] }; },
  };
  if (DEBUG) MORTAL.debug = {   // death/rebirth tests only; never on by default
    kill: (who, cause) => die(who, cause || 'debug'),
    lifespan(who, s) { const B = beings[who]; if (B) { B.deathAt = Date.now() + s * 1000; stash(KEY(who), JSON.stringify({ id: B.id, born: B.born, seal: seal(B.id, B.deathAt) })); } },
    fetchNow: () => { FETCH.nextAt = 0; },
  };
  G.MORTAL = MORTAL;
  ready = (async () => {
    try { rng = await HolyRNG(); } catch (e) { rng = { u: () => C.getRandomValues(new Uint32Array(1))[0] / 4294967296 }; rng.bytes = n => C.getRandomValues(new Uint8Array(n)); }
    beings.hugo = load('hugo'); beings.dove = load('dove');
    if (DOM) { if (document.readyState === 'loading') addEventListener('DOMContentLoaded', watchSections); else watchSections(); }
    return beings;
  })();
})();
