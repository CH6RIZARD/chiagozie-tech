// Mortal Agent kernel for the page's two beings (Hugo and the dove), ported from the frame
// (C:/all-projects/agent/mortal_agent/agent_core: holy_rng.py, lifespan.py, motivation.py, goal_hierarchy.py,
// runtime_state.py, mortal_agent.py's NET_FETCH idle planner). Shared by hugo3d.js and dove-agent.js; bond.js (REL)
// feeds it each second and holds the needs (hunger, energy). window.MORTAL.
// - HolyRNG: OS entropy + performance.now jitter, mixed with SHA-256 (crypto.subtle). The seed lives in RAM only.
// - A hidden lifespan per being, log-uniform over years, sealed in localStorage with the birth time so it spans
//   visits. Never shown. Death: the lifespan runs out, or energy hits 0. Rebirth = a new id, nothing carried over.
// - Pressure exactly as motivation.py (curiosity .4, social isolation .3, existential anxiety .3; act at .45).
// - Drives -> goals -> actions: scored choice with a commitment bonus, minimum action times and hysteresis.
// - Beliefs (patch 6): curiosity picks a lookup (its kind on Wikipedia, its sky on Open-Meteo, its maker's GitHub, the page's
//   terms); the facts become beliefs with source, time, confidence and decay, and move the repertoire's scores through words.
(() => {
  'use strict';
  const BELIEF_API = 'https://agent-beliefs.daniel4chigs.workers.dev';   // the shared belief service (belief_api.md); the one place its URL lives
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
  const W_CUR = .4, W_SOC = .3, W_EXI = .3, ACT = .45, SILENCE = 60;
  // The page's inputs, calibrated to a visit of a minute or two (the frame's scale is a chat of minutes to hours). The formula
  // and threshold above stay exact; only what is fed in is scaled:
  // - SIL_K: a visitor's silence counts 6x (isolation starts at 5 s ignored, full at 10 s; a chat's 30 s / 60 s).
  // - STALL_AFTER: 5 s without progress is a stall (the frame's 15 s), and a finished self-directed move is progress.
  // - BORN: a new mind in an unknown place starts anxious (stall 25, e .6), so a fresh visit sees it act within ~10 s.
  const SIL_K = 6, STALL_AFTER = 5, BORN = { e: .6, stall: 25 };
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
      // commitment: what it is (or was just) doing keeps a bonus, so near-ties do not flip; past its max time it has had
      // enough of it (habituation), so a rest that food or sleep cannot end still gives way to the next thing
      if (prev === o.id) s *= cur && cur.id === o.id && t - cur.t0 > (cur.maxT || 30) ? .6 : 1.3;
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
    return { who, id, born, deathAt, dt: 0, alive: true, external: false, mot: { ...newMot(), ...BORN }, act: null, visited: new Set(), lastUser: now(), progressAt: now() - STALL_AFTER * 1000, goals: [], ended: null,
      know: loadKnow(who, id), kv: 0, mc: new Map(), net: 0, asked: new Set(), grow: [], lookAt: 0, studied: new Set(), looking: null, wonder: null, ageK: 0, ageBel: null, section: null };
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
    B.alive = false; stash(KEY(who), null); stash(BKEY(who), null);   // death is final: no save, no reload
    fire(who, 'ENDED', cause);
  }
  async function newBeing(who) {
    await ready;
    const B = beings[who] = create(who); forget(who); loadShared(who);
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

  // ---------------------------------------------------------------- environment, beliefs and lookups (patch 6)
  const env = { hour: new Date().getHours(), night: false, isDay: null, weather: '', temp: null, sleepy: 0, self: null };
  function envUpdate() {
    env.hour = new Date().getHours();
    env.night = env.isDay === 0 || (env.isDay == null && (env.hour < 6 || env.hour >= 22));
    env.sleepy = (env.night ? .3 : 0) + (/rain|snow|storm/.test(env.weather) ? .1 : 0);
  }
  envUpdate();
  // Beliefs: what a being knows, built only from what it fetched or perceived. A belief is a sentence with its source, the time it
  // was learned, a confidence and a half-life. Behaviours that name words (d.words / d.avoid) score up or down by the live
  // confidence of a belief that mentions them, and the choice cites it: no rule says "rain -> shelter", the words do. Kept per
  // being across visits (localStorage, keyed by its id): a new being knows nothing.
  const BKEY = who => 'mortal.v1.know.' + who;
  const words = s => String(s).toLowerCase().match(/[a-z][a-z0-9.+#'-]*/g) || [];
  const confOf = (b, at = Date.now()) => b.c * Math.pow(.5, (at - b.at) / 1000 / b.hl);
  function loadKnow(who, id) { let r = null; try { r = JSON.parse(store(BKEY(who))); } catch (e) { r = null; } return r && r.id === id && Array.isArray(r.list) ? r.list.filter(b => confOf(b) > .05) : []; }
  const saveKnow = B => stash(BKEY(B.who), JSON.stringify({ id: B.id, list: B.know.map(({ w, ...b }) => b) }));
  function believe(who, f, shared) {   // f: { key, text, line?, src (url), name (source), c, hl (s), v?, title?, from? }; shared: it came from the service
    const B = beings[who]; if (!B || !f || !f.text) return null;
    const b = { key: f.key, text: String(f.text).slice(0, 240), line: String(f.line || f.text).slice(0, 120), src: f.src, name: f.name, at: f.at || Date.now(), c: f.c ?? .8, hl: f.hl || 86400, v: f.v, title: f.title, from: f.from };
    B.know = B.know.filter(x => x.key !== b.key && confOf(x) > .05); B.know.push(b); if (B.know.length > 80) B.know.shift();
    B.kv++; saveKnow(B);
    if (!shared && SHARE.has(f.kind)) api('/observe', { being: who, topic: f.topic || b.key, fact: b.text, source: b.name, url: b.src });   // what it read, for the next visit's beings
    return b;
  }
  function match(who, d) {   // the strongest beliefs this behaviour's words are about (the word scan is cached per belief version)
    const B = beings[who]; if (!B || !B.know.length || !(d.words || d.avoid)) return null;
    let m = B.mc.get(d.id);
    if (!m || m.kv !== B.kv) {
      const sky = b => b.from === 'sky' || b.key === 'clock';   // a '~' word is about the weather or the hour: only the sky and the clock speak to it ("snow" in a bird's name is no snowfall)
      const hit = stems => (stems ? B.know.filter(b => { const w = b.w || (b.w = words(b.text)); return stems.some(s => (s[0] === '~' ? sky(b) && w.some(x => x.startsWith(s.slice(1))) : w.some(x => x.startsWith(s)))); }) : []);
      m = { kv: B.kv, pro: hit(d.words), con: hit(d.avoid) }; B.mc.set(d.id, m);
    }
    const best = l => { let o = null, oc = .05; for (const b of l) { const c = confOf(b); if (c > oc) { oc = c; o = b; } } return o && { b: o, c: oc }; };
    return { pro: best(m.pro), con: best(m.con) };
  }
  const ago = at => { const s = Math.max(0, (Date.now() - at) / 1000); return s < 90 ? `${Math.round(s)} s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : s < 172800 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`; };
  const cite = b => `${b.text.length > 90 ? b.text.slice(0, 88) + '…' : b.text} (${b.name}, ${ago(b.at)})`;
  const SAID = new Set();   // a line never repeats in a visit
  function line(who, b) {   // at most one line per 45 s per being, and only the words of a belief it holds
    const B = beings[who], s = b && b.line; if (!B || !s || SAID.has(s) || Date.now() - (B.saidAt || 0) < 45000) return null;
    SAID.add(s); B.saidAt = Date.now(); return s;
  }

  // Lookups: curiosity about what it stands on or sees, its own kind and its sky. Keyless public GETs only, allowlisted hosts,
  // credentials omitted, no referrer, a 6 s timeout, results cached in localStorage with TTLs; per being per visit at most 6 network
  // fetches, at least 12 s apart, none in the first 5 s. Offline, blocked or rate-limited: it simply does not learn it today.
  const ALLOW = /^https:\/\/(api\.github\.com|api\.open-meteo\.com|geocoding-api\.open-meteo\.com|en\.wikipedia\.org)\//;
  // The shared belief service (a Cloudflare Worker, outreach/research_notes/.../belief_api.md): what every visit's beings learned, merged.
  // Its base URL is BELIEF_API (top of file; <meta name="mortal-api"> or window.MORTAL_API override it); down or slow (3 s): the beings learn alone.
  // Only what they read is sent (a topic, a fact, its source); never the visitor's clock, city or sky, nor anything about the visitor.
  // Asked only from the origins its CORS admits (elsewhere every call would be a console error): the live site, its mirror, localhost.
  const API = (() => { let u = G.MORTAL_API || ''; try { if (!u && DOM) { const m = document.querySelector('meta[name="mortal-api"]'); u = m ? m.content : ''; }
      if (!u && DOM && /^(chiagozie\.tech|www\.chiagozie\.tech|ch6rizard\.github\.io|localhost|127\.0\.0\.1)$/.test(location.hostname)) u = BELIEF_API; } catch (e) { u = ''; }
    return /^https:\/\/[\w.-]+(\/[\w./-]*)?$/.test(u) ? u.replace(/\/$/, '') : ''; })();
  const SRV = { api: API, up: !!API, fails: 0 };
  async function api(path, body) {   // a JSON call to the belief service; three failures in a visit and it is not asked again
    if (!SRV.up || typeof fetch !== 'function') return null;
    try {
      const r = await fetch(API + path, { method: body ? 'POST' : 'GET', credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors', keepalive: !!body,
        headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined });
      if (!r.ok) throw new Error('status ' + r.status);
      return await r.json();
    } catch (e) { if (++SRV.fails >= 3) SRV.up = false; return null; }
  }
  // a fact from the service, in whatever field names it uses, as a belief (confidence and decay kept; the newer of two copies wins)
  const fromSrv = (f, from) => { const text = f && (f.fact || f.text); if (!text) return null; const topic = f.topic || from || 'shared';
    // the service's confidence is already decayed at read (half-life 14 d): it starts again from now with that half-life
    return { key: f.key || `${topic}#${words(text).slice(0, 8).join('-')}`, text, line: f.line ? f.line : short(text), src: f.url || f.src || '', name: f.source || f.name || 'shared memory',
      c: clamp(+(f.confidence ?? f.conf ?? f.c ?? .6)), hl: +(f.halfLife ?? f.hl ?? 14 * 86400) || 14 * 86400, at: f.last_reinforced ? Date.now() : Date.parse(f.fetched_at || f.at || f.ts) || +f.at || Date.now(), v: f.v, from: f.from || from, related: f.related || f.links }; };
  const SHARE = new Set(['self', 'wiki', 'gh']);   // what may be sent: what it read, never what it perceived about the visitor
  async function loadShared(who) {   // at birth (or on the first visit of a life): the beliefs other visits taught this kind of being
    const j = await api('/beliefs?being=' + who + '&limit=30'), B = beings[who]; if (!B || !j) return;
    for (const f of (Array.isArray(j) ? j : j.beliefs || [])) { if (/open-meteo/i.test(f.source || '')) continue;   // another visitor's sky is not this one's
      const b = fromSrv(f); if (b && !B.know.some(x => x.key === b.key && x.at >= b.at)) believe(who, b, true); }
  }
  const NET = { max: 6, gap: 12000, after: 5000, log: [] }, LOOKS = [];
  const TTL = { wiki: 7 * 864e5, geo: 30 * 864e5, sky: 30 * 6e4, gh: 36e5 };
  const SPECIES = { hugo: 'Stick figure', dove: 'Rock dove' }, SILENT = { dove: 1 };
  const cget = k => { try { const r = JSON.parse(store('mortal.c.' + k)); return r && Date.now() - r.at < r.ttl ? r.v : undefined; } catch (e) { return undefined; } };
  const cset = (k, v, ttl) => stash('mortal.c.' + k, JSON.stringify({ at: Date.now(), ttl, v }));
  async function net(B, url, key, ttl, shape) {   // shape(json) -> the small part worth keeping; a 404 is cached as nothing
    const c = cget(key); if (c !== undefined) return c;
    if (!ALLOW.test(url) || B.net >= NET.max || typeof fetch !== 'function') return null;
    B.net++; NET.log.push({ who: B.who, host: url.split('/')[2], at: Date.now() });
    const r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors', signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
    if (!r.ok) { if (r.status === 404) cset(key, null, ttl); return null; }
    const v = shape(await r.json()); cset(key, v, ttl); return v;
  }
  const sentences = x => String(x || '').split(/\n+/).filter(l => !/^\s*=/.test(l)).join(' ').replace(/\s+/g, ' ')
    .split(/(?<=[a-z0-9)][.!?])\s+(?=[A-Z])/).filter(s => s.length > 30 && s.length < 220);
  const short = s => (s.length <= 110 ? s : s.slice(0, s.lastIndexOf(' ', 108)) + '…');
  const hm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const LOOK = {
    async self(B, topic) {   // its own kind: the article body (the intro rarely says what the animal does), what concerns its repertoire
      const t = encodeURIComponent(topic.replace(/ /g, '_')), src = 'https://en.wikipedia.org/wiki/' + t;
      const ss = await net(B, `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&formatversion=2&origin=*&titles=${t}`, 'ws:' + topic, TTL.wiki,
        j => sentences(j && j.query && j.query.pages && j.query.pages[0] && j.query.pages[0].extract).slice(0, 300));
      if (!ss || !ss.length) return [];
      const R = reps[B.who], stems = new Set(); if (R) for (const d of R.defs.values()) for (const s of [...(d.words || []), ...(d.avoid || [])]) if (s[0] !== '~') stems.add(s);
      const about = s => { const w = words(s); return [...stems].some(st => w.some(x => x.startsWith(st))); };
      const out = ss.slice(0, 1).map((s, i) => ({ key: `${topic}#${i}`, text: s, line: short(s), src, name: 'Wikipedia', c: .9, hl: 30 * 86400 }));
      for (const s of ss) { if (out.length >= 10) break; if (about(s) && !out.some(o => o.text === s)) out.push({ key: `${topic}#${ss.indexOf(s)}`, text: s, line: short(s), src, name: 'Wikipedia', c: .8, hl: 30 * 86400 }); }
      const life = ss.find(s => /life ?span|life expectancy|lives? (?:for|up to)/i.test(s) && /\d+\s*(?:[–-]|to)?\s*\d*\s+years/.test(s));
      if (life) { const m = life.match(/(\d+)(?:\s*(?:[–-]|to)\s*(\d+))?\s+years/); out.push({ key: 'lifespan', text: life, line: short(life), src, name: 'Wikipedia', c: .8, hl: 30 * 86400, v: m[2] ? (+m[1] + +m[2]) / 2 : +m[1] }); }
      return out;
    },
    async wiki(B, topic) {   // a thing on the page it stands on: the REST summary's first sentence
      const t = encodeURIComponent(topic.replace(/ /g, '_'));
      const s = await net(B, 'https://en.wikipedia.org/api/rest_v1/page/summary/' + t, 'w:' + topic, TTL.wiki, j => (j && j.type === 'standard' ? sentences(j.extract)[0] || null : null));
      return s ? [{ key: 'w:' + topic.toLowerCase(), text: s, line: short(s), src: 'https://en.wikipedia.org/wiki/' + t, name: 'Wikipedia', c: .8, hl: 30 * 86400 }] : [];
    },
    async gh(B) {   // its maker's public repos: what each is, its language, when it was last pushed; a repo named like a card on the page
      const src = 'https://github.com/CH6RIZARD';
      const rs = await net(B, 'https://api.github.com/users/CH6RIZARD/repos?sort=pushed&per_page=30', 'gh', TTL.gh,
        j => (Array.isArray(j) ? j.map(r => ({ n: r.name, l: r.language, d: (r.description || '').slice(0, 80), p: r.pushed_at })) : null));
      if (!rs) return [];
      const out = [];
      for (const r of rs) {
        const ws = r.n.toLowerCase().split(/[-_.]+/).filter(w => w.length > 2 && !/^(the|app|web|site|io|github|main|tech)$/.test(w));
        const h = sec.all.find(h => { const t = titleOf(h).toLowerCase(); return t.length < 30 && ws.some(w => t.split(/\W+/).some(x => x.length > 2 && (w.startsWith(x) || x.startsWith(w)))); });
        const text = `${r.n} is ${r.l ? 'written in ' + r.l : 'a repo'}${r.d ? ': ' + r.d : ''}, last pushed ${ago(Date.parse(r.p))}`;
        if (h || !out.length) out.push({ key: 'gh:' + r.n, text, line: short(text), src: `${src}/${r.n}`, name: 'GitHub', c: .9, hl: 6 * 3600, title: h ? titleOf(h) : null, at: Date.now() });
        if (h) addGoal(B.who, { id: 'gh:' + r.n, desc: `visit ${r.n} (${titleOf(h)})`, drive: 'curiosity', title: titleOf(h), pri: .6, novel: 1 });
        if (out.length >= 4) break;
      }
      return out;
    },
    async sky(B) {   // the visitor's sky, from the time zone's city only (no geolocation, nothing personal sent)
      let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { tz = ''; }
      const city = tz.includes('/') ? tz.split('/').pop().replace(/_/g, ' ') : ''; if (!city) return [];
      const p = await net(B, `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`, 'geo:' + city, TTL.geo,
        j => (j && j.results && j.results[0] ? { la: +j.results[0].latitude.toFixed(1), lo: +j.results[0].longitude.toFixed(1) } : null));
      if (!p) return [];
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.la}&longitude=${p.lo}&current=is_day,temperature_2m,weather_code&daily=sunrise,sunset&forecast_days=1&timezone=auto`;
      const w = await net(B, url, 'sky:' + city, TTL.sky, j => (j && j.current ? { d: j.current.is_day, t: j.current.temperature_2m, c: j.current.weather_code, at: Date.parse(j.current.time) || Date.now(), rise: j.daily && j.daily.sunrise && j.daily.sunrise[0], set: j.daily && j.daily.sunset && j.daily.sunset[0] } : null));
      if (!w) return [];
      env.isDay = w.d; env.weather = WMO(w.c); env.temp = w.t; envUpdate();
      const what = { storm: 'a storm', snow: 'snowing', rain: 'raining', fog: 'foggy', cloud: 'cloudy', clear: w.d ? 'sunny' : 'clear' }[env.weather];
      const feel = w.t < 8 ? ', cold' : w.t > 24 ? ', warm' : '', text = `it is ${what} in ${city}, ${Math.round(w.t)}°C${feel}${w.d ? '' : ', night'}`;
      const out = [{ key: 'sky', text, line: `${text[0].toUpperCase()}${text.slice(1)}.`, src: 'https://open-meteo.com', name: 'Open-Meteo', c: .9, hl: 1800, at: Date.now() }];
      if (w.rise && w.set) { const s = `the sun is up ${w.rise.slice(11, 16)} to ${w.set.slice(11, 16)} in ${city}${w.d && Date.parse(w.set) - Date.now() < 36e5 && Date.parse(w.set) > Date.now() ? ', dusk soon' : ''}`;
        out.push({ key: 'sun', text: s, line: `${s[0].toUpperCase()}${s.slice(1)}.`, src: 'https://open-meteo.com', name: 'Open-Meteo', c: .9, hl: 3600 }); }
      return out;
    },
  };
  const WMO = c => (c >= 95 ? 'storm' : c >= 71 && c <= 86 && !(c >= 80 && c <= 82) ? 'snow' : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) ? 'rain' : c >= 45 && c <= 48 ? 'fog' : c >= 2 ? 'cloud' : 'clear');
  const topicCache = new Map();
  function topicsOf(title) {   // the page around a heading: its stack tags and evidence lines, split into names a lookup can take
    if (!DOM || !title) return [];
    if (topicCache.has(title)) return topicCache.get(title);
    const h = sec.all.find(x => titleOf(x) === title), box = h && (h.closest('article, .realm, .poster, .stage, .cap, section') || h.parentElement), out = [];
    if (box) for (const el of box.querySelectorAll('.ev, .sp, b + span')) for (let s of el.textContent.split(/[·,;:()]|\s[-–—]\s/)) {
      s = s.trim(); if (s.length >= 3 && s.length <= 24 && /^[A-Z][\w.+#-]*(?: [A-Z0-9][\w.+#-]*){0,2}$/.test(s) && !out.includes(s)) out.push(s); }
    const t = titleOf(h || { textContent: '' }); if (/^[A-Za-z][\w .+-]{2,23}$/.test(t) && t.split(' ').length <= 3 && !out.includes(t)) out.unshift(t);
    topicCache.set(title, out.slice(0, 6)); return topicCache.get(title);
  }
  // Topics grow: a fact names things (the service's related terms, or proper names in the sentence), and those become new things to
  // wonder about, a little less salient than what led there; at most 3 per lookup and 8 per visit, so curiosity drifts but stays bounded.
  const GROW_LOOK = 3, GROW_VISIT = 8;
  function grow(B, w, got) {
    if (w.kind === 'sky') return;   // the weather names no topics
    const seen = new Set([...B.grow.map(g => g.topic.toLowerCase()), (w.topic || '').toLowerCase()]); let n = 0;
    const take = t => { t = String(t || '').trim(); const k = t.toLowerCase(); if (n >= GROW_LOOK || B.grow.length >= GROW_VISIT || t.length < 4 || t.length > 40 || seen.has(k) || /^(the|this|it|in|on|a|an)\b/i.test(t)) return; seen.add(k); n++; B.grow.push({ topic: t, s: Math.max(.2, (w.s || .5) * .8) }); };
    for (const f of got) for (const r of f.related || []) take(r);
    for (const f of got) for (const m of String(f.text || '').slice(1).matchAll(/\b([A-Z][a-z]{3,}(?: [A-Z][a-z]+){0,2})\b/g)) take(m[1]);
  }
  function wonder(who) {   // what it does not know and could look up now, scored by how close it is to it
    const B = beings[who];
    if (!B || B.looking || now() < NET.after || Date.now() - B.lookAt < NET.gap || B.net >= NET.max || (G.navigator && G.navigator.onLine === false) || (DOM && document.hidden)) return null;
    const known = key => B.asked.has(key) || B.know.some(b => b.from === key && confOf(b) > .3);
    let best = null; const ask = (key, kind, topic, s) => { if (!known(key) && (!best || s > best.s)) best = { key, kind, topic, s }; };
    ask('self', 'self', SPECIES[who], .7); ask('sky', 'sky', null, .55); ask('gh', 'gh', null, who === 'hugo' ? .75 : .3);   // Hugo stands on his maker's work
    topicsOf(B.section).forEach((t, i) => ask('w:' + t.toLowerCase(), 'wiki', t, .5 - .04 * i));
    for (const g of B.grow) ask('w:' + g.topic.toLowerCase(), 'wiki', g.topic, g.s);   // what earlier reading pointed to
    return best;
  }
  async function lookup(who) {   // the body began its lookup behaviour: fetch what it wondered about; the result becomes beliefs
    const B = beings[who], w = B && B.wonder; if (!w || B.looking || !B.alive) return null;
    B.looking = w; B.asked.add(w.key); B.lookAt = Date.now(); B.wonder = null;
    const R = rep(who); R.trace.push({ t: +(now() / 1000).toFixed(2), id: 'lookup', cat: 'learn', b: '-', topic: w.topic || w.kind, look: 1 });
    let got = [];
    try {
      let srv = null;
      if (SRV.up && (w.kind === 'wiki' || w.kind === 'gh') && B.net < NET.max) {   // its own kind it reads in full itself (the service has the summary only), then shares
        B.net++; NET.log.push({ who, host: 'belief-service', at: Date.now() });
        const j = await api('/lookup', { being: who, topic: w.kind === 'gh' ? 'github' : w.topic }); srv = j && (Array.isArray(j) ? j : j.beliefs || j.facts);
        if (srv) srv = srv.map(f => fromSrv(f, w.key)).filter(Boolean); if (srv && srv[0] && Array.isArray(j.candidates)) srv[0].related = [...(srv[0].related || []), ...j.candidates]; }   // candidates: new topics the service suggests
      got = srv && srv.length ? srv.map(f => ({ ...f, shared: 1 })) : (await LOOK[w.kind](B, w.topic)) || [];
    } catch (e) { got = []; if (!B.asked.has('retry:' + w.key)) { B.asked.delete(w.key); B.asked.add('retry:' + w.key); } if (DEBUG) console.warn('lookup failed', w.key, String(e)); } finally { B.looking = null; }   // a timeout or a dropped connection: it may wonder once more later (the fetch cap still holds)
    if (beings[who] !== B || !B.alive) return null;   // it died while it read
    const bs = got.map(f => believe(who, { ...f, from: w.key, kind: w.kind, topic: w.topic || w.kind }, !!f.shared)).filter(Boolean);
    grow(B, w, got);
    LOOKS.push({ who, key: w.key, topic: w.topic || w.kind, n: bs.length, at: Date.now() });
    return bs.find(b => b.key !== 'lifespan') || bs[0] || null;
  }
  function perceive(B, section) {   // what it sees without fetching: the visitor's clock, the place it is on
    if (Date.now() - (B.clockAt || 0) > 5 * 6e4) { B.clockAt = Date.now(); const d = new Date(), night = env.isDay === 0 || d.getHours() < 6 || d.getHours() >= 22;
      believe(B.who, { key: 'clock', text: `it is ${hm(d)} on the visitor's clock${night ? ', night' : ''}`, src: 'about:clock', name: "the visitor's clock", c: 1, hl: 900 }); }
    if (section && !B.know.some(b => b.key === 'here:' + section)) { const tp = topicsOf(section);
      believe(B.who, { key: 'here:' + section, text: `${section}${tp.length ? ': ' + tp.join(', ') : ''}`, src: DOM ? location.href.split('#')[0] : '', name: 'this page', c: .9, hl: 3600 }); }
    const life = B.know.find(b => b.key === 'lifespan' && b.v > 0 && confOf(b) > .3);
    B.ageK = life ? (Date.now() - B.born) / 1000 / YEAR / life.v : 0; B.ageBel = life || null;
  }
  function studyCard(who) {   // a card it holds a fact about and has not gone to see
    const B = beings[who]; if (!B) return null;
    const b = B.know.find(b => b.title && !B.studied.has(b.key) && confOf(b) > .3); return b ? { title: b.title, b } : null;
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
      B.lane = s.lane || 0; B.w = s.w ?? null;   // the body's depth lane and its section's scroll phase (depth.js), for drives that weigh it
      const section = s.section || (s.y != null ? sectionAt(s.y) : null);
      if (section && !B.visited.has(section)) { B.visited.add(section); progress(who, 'new place'); }
      if (section) B.section = section;
      if (gate) perceive(B, section);
      if (gate && SILENT[who] && !B.looking && !B.external && (B.wonder = wonder(who))) lookup(who);   // the dove reads without showing it
      const unknowns = [...sec.seen].filter(t => !B.visited.has(t)).length + B.goals.filter(g => !g.done && g.novel).length;
      const silence = (now() - B.lastUser) / 1000;   // the visitor's silence toward this being (touch, hover, the cursor close)
      B.p = motStep(B.mot, silence * SIL_K, unknowns, (now() - B.progressAt) / 1000 > STALL_AFTER);
      if (B.external || !gate) continue;   // a frame or agent process owns this life on localhost
      if (Date.now() >= B.deathAt) die(who, 'lifespan_expired');
      else if (s.energy != null && s.energy <= 0) die(who, 'energy_depleted');
    }
  }
  function progress(who, why) { const B = beings[who]; if (B) { B.progressAt = now(); B.lastWhy = why; } }
  const MOODS = (who, n) => {   // mood: REL's affect point toward the other plus the needs
    const B = beings[who]; if (!B || !B.alive) return 'gone';
    if (n.energy < .25) return 'tired'; if (n.hunger > .6) return 'hungry';
    if (env.night && n.energy < .5) return 'sleepy'; if (n.stress > .3) return 'shaken';
    if (B.mot.s > .6) return 'lonely'; if (n.aff < -.25) return 'wary'; if (n.aro > .55 && n.aff > .2) return 'playful';
    if (B.mot.c > .35) return 'curious'; return 'content';
  };

  // ---------------------------------------------------------------- repertoire: utility selection with memory (patch 5)
  // Dave Mark style scoring (needs x context x novelty) over a wide, parameterised repertoire the body registers, with memory:
  // no behaviour twice within 90 s, no category twice within 25 s, a novelty bonus for what this visit has not seen, a
  // per-visitor personality (localStorage seed + visit count: a returning visitor meets a shifted mix), hysteresis (what was
  // started is finished unless an interrupt or the screen edge scores 1.5x), and plans: 2-4 steps with a purpose. Shimeji and
  // Animal Crossing draw weighted among the eligible, never the argmax alone, so one situation does not always get one answer.
  const SAME_ID = 90, EDGE_ID = 10, SAME_CAT = 25, NOVEL = .3, TOP = 3, OVERRIDE = 1.5, EV_TTL = 2, EV_GAP = [8, 12], EV_CAP = 3, EV_WIN = 180, EV_P = .7;
  const VISITOR = (() => { let r = null; try { r = JSON.parse(store('mortal.v1.visitor')); } catch (e) { r = null; }
    if (!r || !(r.seed >= 0)) r = { seed: C.getRandomValues(new Uint32Array(1))[0] >>> 0, visits: 0 };
    r.visits++; stash('mortal.v1.visitor', JSON.stringify(r)); return r; })();
  const h32 = s => { let h = (2166136261 ^ VISITOR.seed) >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const persona = cat => .7 + .6 * h32(`cat:${cat}:${VISITOR.visits}`);   // this visitor's Hugo and his taste for each category, .7..1.3
  const u01 = () => (rng ? rng.u() : Math.random());
  const b3 = (v, a, b) => Math.min(2, Math.floor(((v - a) / (b - a)) * 3));
  function vary() {   // no two executions alike: speed .8-1.25x, amplitude .7-1.3x, duration .75-1.4x, side, a pause before (0-.6 s) and after (0-1.2 s)
    const p = { speed: .8 + .45 * u01(), amp: .7 + .6 * u01(), durK: .75 + .65 * u01(), side: u01() < .5 ? -1 : 1, before: .6 * u01() * u01(), after: 1.2 * u01() * u01() };
    p.b = `${b3(p.speed, .8, 1.25)}${b3(p.amp, .7, 1.3)}${p.side > 0 ? 'R' : 'L'}`;   // the parameter bucket the harness compares
    return p;
  }
  // The repertoire belongs to the body (it outlives a being); a new being starts with an empty memory of it (forget()).
  const reps = { hugo: null, dove: null }, blank = () => ({ last: new Map(), lastCat: new Map(), seen: new Set(), cur: null, plan: null, ev: [], catRun: 0, lastC: null, buckets: new Map() });
  const rep = who => (who in reps ? reps[who] || (reps[who] = { who, defs: new Map(), plans: [], trace: [], budget: new Map(), ...blank() }) : null);
  const forget = who => { if (reps[who]) Object.assign(reps[who], blank()); };
  // defs: [{ id, cat, u: ctx => 0..1, dur (s), on: [event types it reacts to], edge: true (a screen-edge move), move }]
  function repertoire(who, defs) { const R = rep(who); if (R) for (const d of defs) if (d && d.id) R.defs.set(d.id, { dur: 3, ...d }); }
  // plans: [{ goal, purpose, when: ctx => 0..1, steps: [id | { id, ...overrides }] }]. A plan is picked like a behaviour (id 'plan:goal',
  // category = goal) and then runs its steps in order; a step that fails drops the plan (Rain World: a far new goal drops the old path).
  function plans(who, list) { const R = rep(who); if (R) R.plans = list.filter(p => p && p.goal && p.steps && p.steps.length); }
  const gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += u01(); return (s - 2) * Math.sqrt(3); };
  // The world nudged it (scroll start/stop, a tap, the cursor near, a section change, the dove landing, a crumb, the tab back).
  // Noticing takes N(220, 40) ms clamped 150-300 (human reaction time); a reaction is budgeted (p .7, a gap of 8-12 s per type,
  // at most 3 per type per 3 min), so not every nudge gets one: what reacts to everything reads as a tool.
  function notice(who, type, x) {
    const R = rep(who); if (!R) return false;
    const t = now() / 1000, b = R.budget.get(type) || { at: [], nextAt: 0 };
    b.at = b.at.filter(a => t - a < EV_WIN);
    if (t < b.nextAt || b.at.length >= EV_CAP || u01() > EV_P) { R.budget.set(type, b); return false; }
    b.at.push(t); b.nextAt = t + EV_GAP[0] + (EV_GAP[1] - EV_GAP[0]) * u01(); R.budget.set(type, b);
    R.ev = R.ev.filter(e => e.type !== type); R.ev.push({ type, x, at: t + clamp(.22 + .04 * gauss(), .15, .3), until: t + EV_TTL });
    return true;
  }
  const answers = (d, ev) => !!(ev && d.on && d.on.includes(ev.type));
  const OLDER = new Set(['rest', 'flee']), YOUNGER = new Set(['move', 'fly', 'soar', 'play', 'glide']);
  function score(R, d, ctx, t, ev, lax) {
    let u = Math.min(1, +(typeof d.u === 'function' ? d.u(ctx, ev) : d.u) || 0);
    if (answers(d, ev)) u = Math.max(u, .8) * 1.5;   // a noticed interrupt it can answer
    const k = u > 0 && match(R.who, d);   // what it believes: a belief that mentions this behaviour's words lifts it, one it avoids lowers it
    if (k) { if (k.pro) u = Math.min(1.2, u * (1 + k.pro.c) + .2 * k.pro.c); if (k.con) u *= 1 - .7 * k.con.c; }
    const g = beings[R.who] ? beings[R.who].ageK : 0;   // its age against the lifespan it read for its kind: older rests and startles more, roams less
    if (g > .02) u *= OLDER.has(d.cat) ? 1 + Math.min(1, g) : YOUNGER.has(d.cat) ? 1 - .5 * Math.min(1, g) : 1;
    if (!(u > 0) || (d.edge && !ctx.edge)) return 0;
    if (ctx.edge && !d.edge) { if (ctx.edgeFor > 1) return 0; u *= .5; }   // the screen's edge is no home: after a second only edge moves are left
    const lid = R.last.get(d.id), lcat = R.lastCat.get(d.cat);
    let s = u * persona(d.cat) * (R.seen.has(d.id) ? 1 : 1 + NOVEL);
    if (lid != null && t - lid < (d.edge ? EDGE_ID : d.again || SAME_ID)) s *= lax ? .3 : 0;   // the same thing again inside 90 s (10 s for an edge move: the page keeps moving): never, unless nothing else answers the edge or the world
    if (lcat != null && t - lcat < SAME_CAT) { if (R.catRun >= 2 && R.lastC === d.cat) return 0; if (!(d.edge && ctx.edge)) s *= .15; }   // a third of the same kind running: never
    return s * (.85 + .3 * u01());   // Dave Mark: a little noise, so near-ties fall either way
  }
  function begin(who, R, d, ov, t, planned, ev, ctx) {
    const used = (R.buckets.get(d.id) || []).filter(x => t - x.t < SAME_ID); let p = vary(); for (let i = 0; i < 12 && used.some(x => x.b === p.b); i++) p = vary();   // a repeat inside 90 s (a plan step, the edge) never in the same way
    R.buckets.set(d.id, [...used, { t, b: p.b }]); p = { ...p, ...(ov || {}) };
    const B = beings[who], k = match(who, d), age = B && B.ageK > .02 && (OLDER.has(d.cat) || YOUNGER.has(d.cat)) ? B.ageBel : null;
    const bel = (planned && R.plan.bel) || (k && k.pro && k.pro.b) || age || null, because = bel ? `${cite(bel)} → ${planned ? R.plan.def.goal + ':' : ''}${d.id}` : null;
    if (!(ov && ov.speed)) p.speed *= 1 - .5 * env.sleepy - .2 * Math.min(1, B ? B.ageK : 0);   // night (and age) slows it
    const dur = (d.dur || 3) * p.durK, u = Math.min(1, +(typeof d.u === 'function' ? d.u(ctx, ev) : d.u) || 0);
    R.cur = { id: d.id, cat: d.cat, def: d, p, t0: t, minT: Math.min(dur * .6, 6), maxT: p.before + dur + p.after + 1.5, ev: ev ? ev.type : null, s: planned ? Math.max(.6, u) : u };
    R.last.set(d.id, t); R.lastCat.set(d.cat, t); R.seen.add(d.id); R.catRun = R.lastC === d.cat ? (R.catRun || 0) + 1 : 1; R.lastC = d.cat;
    R.cur.because = because;
    R.trace.push({ t: +t.toFixed(2), id: d.id, cat: d.cat, b: p.b, plan: planned ? R.plan.def.goal : null, ev: R.cur.ev, ...(because ? { bel: because } : {}) }); if (R.trace.length > 600) R.trace.shift();
    return { id: d.id, cat: d.cat, p, reason: why(who), ev: R.cur.ev, plan: planned ? R.plan.def : null, step: planned ? R.plan.i : -1, x: ev ? ev.x : undefined, belief: bel };
  }
  // The next thing to start, or null (carry on). ctx: whatever the body's utilities read (needs, pointer, edge, edgeFor, ...).
  function next(who, ctx) {
    const B = beings[who], R = rep(who); if (!R || !B || !B.alive) return null;
    ctx = ctx || {}; const t = now() / 1000;
    ctx.wonder = B.wonder = wonder(who); ctx.know = { card: studyCard(who), age: B.ageK };   // what it could look up now; a card it knows about
    R.ev = R.ev.filter(e => t < e.until); const ev = R.ev.find(e => t >= e.at) || null;
    if (R.cur && t - R.cur.t0 > R.cur.maxT) ended(who, true);   // it never said it finished: that was long enough
    if (R.cur) {   // committed: only a noticed interrupt or the screen edge may cut in, and only when it clearly scores higher
      const passing = ctx.edge && ctx.over && !R.cur.def.grab;   // a ledge passing over him on the edge: the grab is always worth dropping a run for
      if (!(ev || (ctx.edge && !R.cur.def.edge) || passing)) return null;
      let best = null, bs = 0;
      for (const lax of [0, 1]) { for (const d of R.defs.values()) { if (d === R.cur.def || !(answers(d, ev) || (ctx.edge && d.edge && (!R.cur.def.edge || (passing && d.grab))))) continue; const s = score(R, d, ctx, t, ev, lax); if (s > bs) { bs = s; best = d; } } if (best) break; }
      const thr = (ctx.edge && !R.cur.def.edge && ctx.edgeFor > 1) || (passing && best && best.grab) ? 0 : OVERRIDE * .6 * Math.max(.2, R.cur.s);   // on the screen edge for a second: no commitment left
      if (!best || bs <= thr) return null;
      ended(who, false); R.plan = null; if (ev) R.ev = R.ev.filter(e => e !== ev);
      return begin(who, R, best, null, t, false, answers(best, ev) ? ev : null, ctx);
    }
    if (R.plan) {   // the plan's next step, as decided (cooldowns do not apply inside a plan: the plan was the decision)
      const P = R.plan, st = P.def.steps[P.i], id = typeof st === 'string' ? st : st.id, d = R.defs.get(id);
      if (!d) { R.plan = null; return next(who, ctx); }
      return begin(who, R, d, typeof st === 'string' ? null : st, t, true, null, ctx);
    }
    const c = [];
    for (const lax of [0, 1]) { for (const d of R.defs.values()) { const s = score(R, d, ctx, t, ev, lax); if (s > 0) c.push([s, d, null]); } if (c.length || !(ctx.edge || ev)) break; }
    if (!ctx.edge) for (const P of R.plans) { const f0 = R.defs.get(typeof P.steps[0] === 'string' ? P.steps[0] : P.steps[0].id); if (f0 && R.catRun >= 2 && R.lastC === f0.cat) continue;   // its first step would be a third of a kind
      const s = 1.5 * score(R, { id: 'plan:' + P.goal, cat: P.goal, u: P.when }, ctx, t, ev); if (s > 0) c.push([s, P, 'plan']); }   // a purpose beats a fidget
    if (!c.length) return null;
    c.sort((a, b) => b[0] - a[0]); const top = c.slice(0, TOP), sum = top.reduce((n, x) => n + x[0], 0);
    let r = u01() * sum, pick = top[top.length - 1]; for (const x of top) { r -= x[0]; if (r <= 0) { pick = x; break; } }
    if (ev) R.ev = R.ev.filter(e => e !== ev);
    const [, d, kind] = pick;
    if (kind === 'plan') { R.last.set('plan:' + d.goal, t); R.lastCat.set(d.goal, t); R.seen.add('plan:' + d.goal); const bel = d.cite ? d.cite(ctx) : null; if (bel) B.studied.add(bel.key); R.plan = { def: d, i: 0, bel }; return next(who, ctx); }
    return begin(who, R, d, null, t, false, answers(d, ev) ? ev : null, ctx);
  }
  // The body finished (ok) or gave up on (!ok) what it was doing. A finished move is progress for the frame's stall count too.
  function ended(who, ok) {
    const R = rep(who); if (!R || !R.cur) return;
    if (R.cur.def.move && ok) { progress(who, 'did ' + R.cur.id); const B = beings[who]; if (B) B.mot.stall = 0; }
    R.cur = null;
    if (R.plan) { if (!ok) R.plan = null; else if (++R.plan.i >= R.plan.def.steps.length) R.plan = null; }
  }
  function why(who) {
    const R = rep(who); if (!R || !R.cur) return R && R.plan ? `${R.plan.def.purpose}: between steps` : 'idle';
    const P = R.plan, c = R.cur;
    return `${P ? `${P.def.purpose} [${P.i + 1}/${P.def.steps.length}] ` : ''}${c.id}${c.ev ? ` (reacting to ${c.ev})` : ''} x${c.p.speed.toFixed(2)} ${c.p.side > 0 ? 'R' : 'L'}${c.because ? ' ← ' + c.because : ''}`;
  }

  let ready;
  const MORTAL = {
    YEAR, ACT, SIL_K, STALL_AFTER, BORN, DRIVES, HolyRNG, sampleLifespan, motStep, total, env, sec, speed,
    get ready() { return ready; },
    being: who => beings[who],
    alive: who => !!(beings[who] && beings[who].alive),
    id: who => (beings[who] ? beings[who].id : null),
    pressure: who => (beings[who] ? beings[who].p || 0 : 0),
    mot: who => (beings[who] ? beings[who].mot : newMot()),
    mood: (who, needs) => MOODS(who, needs || {}),
    fatigue: e => clamp((.5 - e) / .3),   // tiredness on the 3 h energy pool: none above .5, full at .2 (urgent rest below it)
    heard(who) { const B = beings[who]; if (B) B.lastUser = now(); },   // the visitor engaged this being directly
    progress, tick, die, newBeing,
    external(who, on) { const B = beings[who]; if (B) B.external = !!on; },
    visited(who, title) { const B = beings[who]; if (B && title && !B.visited.has(title)) { B.visited.add(title); progress(who, 'visited ' + title); } },
    unvisitedInView: who => { const B = beings[who]; return B ? [...sec.inView].filter(t => !B.visited.has(t)) : []; },
    goal: who => { const B = beings[who]; return B ? B.goals.find(g => !g.done) || null : null; },
    goalDone(who, id) { const B = beings[who]; const g = B && B.goals.find(x => x.id === id); if (g) { g.done = true; progress(who, 'goal ' + id); } },
    choose: (who, opts) => (beings[who] ? pick(who, opts, beings[who].p || 0) : null),
    current: who => (beings[who] ? beings[who].act : null),
    // The body finished (or gave up on) its action. A move it made is progress and clears the stall count (the page's
    // calibration: a visit is too short to wind it down a tick at a time), so it rests until the next stall builds again.
    done(who) { const B = beings[who]; if (B && B.act) { if (B.act.move) { progress(who, 'did ' + B.act.id); B.mot.stall = 0; } B.lastAct = B.act.id; B.act = null; } },
    on(who, f) { subs[who].push(f); },
    signal: (who, type, x) => fire(who, type, x),   // a body tells the other being's code what happened to it (BODY_READY, ENTERED: the entrance, patch 5 item 0)
    // patch 5: the repertoire (what it can do), plans (why), interrupts (what it noticed) and the behaviour trace
    repertoire, plans, notice, next, ended, why, vary, persona,
    mark(who, id, cat) { const R = rep(who); if (R) { R.trace.push({ t: +(now() / 1000).toFixed(2), id, cat, b: '-', rel: 1 }); if (R.trace.length > 600) R.trace.shift(); } },   // something else moved the body (REL's orders): on the record, not a decision of the kernel
    trace: who => (reps[who] ? reps[who].trace : []),
    get visitor() { return { ...VISITOR }; },
    // patch 6: beliefs (what it learned, from where, how sure, now) and lookups
    believe, line, lookup, words, cite,
    beliefs: who => (beings[who] ? beings[who].know.map(({ w, ...b }) => ({ ...b, conf: +confOf(b).toFixed(3), ago: ago(b.at) })) : []),
    wonder: who => (beings[who] ? beings[who].wonder : null),
    get looks() { return LOOKS.slice(); },
    get said() { return [...SAID]; },
    service: SRV,   // { api, up, fails }
    grown: who => (beings[who] ? beings[who].grow.slice() : []),
    get fetches() { return { used: NET.log.length, max: NET.max, log: NET.log.slice(), hugo: beings.hugo ? beings.hugo.net : 0, dove: beings.dove ? beings.dove.net : 0 }; },
    NET,
  };
  if (DEBUG) MORTAL.debug = {   // death/rebirth tests only; never on by default
    kill: (who, cause) => die(who, cause || 'debug'),
    lifespan(who, s) { const B = beings[who]; if (B) { B.deathAt = Date.now() + s * 1000; stash(KEY(who), JSON.stringify({ id: B.id, born: B.born, seal: seal(B.id, B.deathAt) })); } },
    fetchNow: () => { NET.after = 0; NET.gap = 0; },
  };
  G.MORTAL = MORTAL;
  ready = (async () => {
    try { rng = await HolyRNG(); } catch (e) { rng = { u: () => C.getRandomValues(new Uint32Array(1))[0] / 4294967296 }; rng.bytes = n => C.getRandomValues(new Uint8Array(n)); }
    beings.hugo = load('hugo'); beings.dove = load('dove');
    setTimeout(() => { loadShared('hugo'); loadShared('dove'); }, DOM ? NET.after : 0);   // after the page's own load; not awaited: the beings live while the service answers (or does not)
    if (DOM) { if (document.readyState === 'loading') addEventListener('DOMContentLoaded', watchSections); else watchSections(); }
    return beings;
  })();
})();
