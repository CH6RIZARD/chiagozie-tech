// REL: the relationship engine between Hugo and SCION the dove. Nothing here is a script. Each side holds a point in a
// feeling space toward the other (affection, dominance, arousal), memories of what actually happened between them
// (facts that fade), motives that rise and tire, and needs (boredom, loneliness, energy, hunger). A phase "director"
// only samples where the pair could plausibly go next from that state and sets a tension target; the bodies ask
// REL.want() what to do and report what happened through REL.ev(). Every visit is a new life: RAM only, nothing is
// stored. Violence is cartoon only (timers and a hits counter the bodies animate) and REL never touches either body's
// lifecycle. window.BOND is a thin shim over REL for the bodies' older calls.
(() => {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  const DOM = typeof document !== 'undefined';

  // ---------------------------------------------------------------- 1. util
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, u) => a + (b - a) * u;
  const sigm = x => 1 / (1 + Math.exp(-x));
  const smooth = (e0, e1, x) => { const u = clamp((x - e0) / (e1 - e0)); return u * u * (3 - 2 * u); };
  const logistic = (d, mid, k) => 1 / (1 + Math.exp((d - mid) / k));
  const bell = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s));
  const sgn = x => (x > 0 ? 1 : x < 0 ? -1 : 0);
  function mulberry32(a) {
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  let rnd = mulberry32((Math.random() * 4294967296) >>> 0);
  const reseed = s => { rnd = mulberry32(s >>> 0); };
  const U = (a, b) => a + (b - a) * rnd();
  const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
  const pickOf = a => a[(rnd() * a.length) | 0];
  const expo = m => -Math.log(1 - rnd()) * m;
  const OTHER = { hugo: 'dove', dove: 'hugo' };
  const AG = ['hugo', 'dove'];
  const PT = { hugo: 'hd', dove: 'dh' };
  const HOLDER = { hd: 'hugo', dh: 'dove' };
  const INF = 1e9;
  let Q; try { Q = new URLSearchParams(G.location ? G.location.search : ''); } catch (e) { Q = new URLSearchParams(''); }
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const f2 = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2).replace(/^0/, '');

  // Tunables (the spec's "tune k, θ and the row weights until the asserts pass").
  const K = {
    kBuild0: .03, kBuild1: .07, kPeak: .09, kResolve: .05,  // anchor gains /s
    ui: .012,                                    // anti-complementary heating
    hold: .25,                                   // phaseHold bias on the lead's anchor-implied motive
    playOff: .02, dispOff: -.05,                 // frame priors (play, display)
    plaus: 4,                                    // plausibility width, in jump² units
    tensTau: 10,                                 // felt tension follows arousal (s)
  };
  // Motive biases b_m (§4.2), adjusted so no single motive owns the field.
  const B0 = { approach: -.5, care: -.45, inspect: -.95, play: -.8, prey: -.8, antag: -.7, avoid: -.2, own: -.6, display: -.45, mimic: -.5, ignore: -1.3 };

  // ---------------------------------------------------------------- 2. state
  const MOT = ['approach', 'care', 'inspect', 'play', 'prey', 'antag', 'avoid', 'own', 'display', 'mimic', 'ignore'];
  const HABK = ['approach', 'wave', 'swat', 'chase', 'grab', 'dive', 'peck', 'hold'];
  const o0 = (keys, v = 0) => { const o = {}; for (const k of keys) o[k] = v; return o; };
  const STORYJ = { rising: .5, calm: .4, random: .65 };
  let S = null, SIM = null;
  let DEBUG = false, HUDEL = null;

  const newDrv = () => ({ boredom: U(.1, .4), lonely: 0, energy: U(.5, .9), hunger: U(.1, .4) });
  function newM() { return { facts: [], famil: 0, hab: { hugo: o0(HABK), dove: o0(HABK) }, own: {}, W: { hugo: {}, dove: {} }, history: [], doveId: null }; }
  function newS() {
    const r = rnd(), kind = r < .4 ? 'rising' : r < .75 ? 'calm' : 'random';
    const P = { hugo: o0(['warmth', 'dom', 'aggr', 'play', 'nurture', 'curious', 'patience', 'show']), dove: o0(['warmth', 'dom', 'nerve', 'social', 'energy', 'show', 'aggr']) };
    for (const w in P) for (const k in P[w]) P[w][k] = U(.1, .9);
    const s = {
      t: 0, gentle: Q.has('gentle'), story: { kind, J0: STORYJ[kind], n: 0, bossCool: 2, cool: false },
      P, pt: { hd: { aff: 0, dom: 0, aro: U(.1, .3) }, dh: { aff: 0, dom: 0, aro: U(.1, .3) } }, rest: { hd: { aff: 0, dom: 0 }, dh: { aff: 0, dom: 0 } },
      I: { hugo: o0(MOT, .2), dove: o0(MOT, .2) }, eng: { hugo: null, dove: null }, phi: { hugo: o0(MOT), dove: o0(MOT) },
      nudge: { hugo: {}, dove: {} }, boost: { hugo: {}, dove: {} },
      drv: { hugo: newDrv(), dove: newDrv() },
      food: [], foodIds: 0, nextFood: U(15, 40), meal: { hugo: false, dove: false }, dig: { hugo: 0, dove: 0 }, fedOut: { hugo: 0, dove: 0 }, block: { hugo: {}, dove: {} }, guardUntil: 0, rideAt: 0,
      tens: { hugo: 0, dove: 0 }, conf: { hugo: 0, dove: 0 }, frameRead: { hugo: .3, dove: .3 },
      bid: { hugo: { answered: .6 }, dove: { answered: .6 } }, bidOpen: { hugo: null, dove: null },
      body: { dove: { ruffled: 0, sore: 0, dazed: 0, hits: 0, lastHit: null, heldBy: null, heldUntil: 0 }, hugo: { ruffled: 0, sore: 0, dazed: 0, hits: 0, lastHit: null, heldBy: null, heldUntil: 0 } },
      cur: { hugo: null, dove: null }, imp: { hugo: [], dove: [] }, cool: { hugo: {}, dove: {} }, contactAt: { hugo: -9, dove: -9 },
      rung: { hugo: {}, dove: {} }, lastShow: { hugo: -9, dove: -9 }, lastStrike: { hugo: -9, dove: -9 },
      hold: { who: null, t0: 0, tier: 0, by: 'visitor', stress: 0 }, lastHold: { hugo: -1e9, dove: -1e9 }, grabAt: -1e9,
      crumb: null, log: [], M: newM(), ph: null, mem: null, acc: 1, ids: 0,
      apart: 0, lastNear: 0, dist: 1e4, distPrev: 1e4, away: 0, cursor: null, inKey: { hugo: null, dove: null },
      relaxT: 0, relaxMin: U(10, 25), armAt: 0, armed: [], staged: null, stagedDone: false, forced: null, pendTrig: null, viewT: 0,
      fellAt: -1e9, fellSev: 0, loser: null, last: null, reflexAt: 0, reflexUntil: 0, audit: null, liveAt: -9, live: '',
    };
    return s;
  }
  function boot() {
    S = newS(); refreshMem(); restCalc();
    for (const X of ['hd', 'dh']) { S.pt[X].aff = clamp(S.rest[X].aff + .25 * gauss(), -1, 1); S.pt[X].dom = clamp(S.rest[X].dom + .25 * gauss(), -1, 1); }
    for (const w of ['hugo', 'dove']) intentStep(w, 8);
  }

  // ---------------------------------------------------------------- 3. facts and memory
  const fw = f => Math.pow(.5, f.age / f.half);
  function addFact(k, a, b, v, half) {
    const F = S.M.facts;
    if (k === 'reconciled') for (const f of F) if (f.v < 0 && f.a === a && f.b === b) f.v *= .5;
    F.push({ k, a, b, v: clamp(v, -1, 1), half, age: 0 });
    if (F.length > 80) { F.sort((x, y) => fw(y) - fw(x)); F.length = 80; }
    refreshMem();
  }
  // trust/grudge are derived from the facts only; "holder" is the one whose feelings these are.
  function refreshMem() {
    const m = { tr: { hugo: 0, dove: 0 }, gr: { hugo: 0, dove: 0 }, fed: 0, hurt: { hugo: 0, dove: 0 } };
    for (const f of S.M.facts) {
      if (f.b !== 'hugo' && f.b !== 'dove') continue;
      const w = fw(f);
      if (f.v > 0) m.tr[f.b] += Math.min(.5, f.v * w); else m.gr[f.b] += Math.min(.5, 3 * -f.v * w);
      if (f.k === 'fed') m.fed += w;
      if (f.v < 0 && f.k !== 'blame') m.hurt[f.b] += w;
    }
    for (const w of ['hugo', 'dove']) { m.tr[w] = clamp(m.tr[w]); m.gr[w] = clamp(m.gr[w]); }
    S.mem = m;
  }
  const trust = holder => S.mem.tr[holder];
  const grudge = holder => S.mem.gr[holder];
  const opinion = holder => trust(holder) - grudge(holder);

  // ---------------------------------------------------------------- 4. point dynamics
  function ownHere(who) { const k = S.inKey[who] && S.inKey[who].key, o = k && S.M.own[k]; return o ? (o.who === who ? 1 : -.5) : 0; }
  function restCalc() {
    for (const X of ['hd', 'dh']) {
      const w = HOLDER[X];
      S.rest[X].aff = clamp(.55 * opinion(w) + .2 * S.P[w].warmth + .15 * (S.M.famil - .5) + .1 * (X === 'dh' ? Math.min(1, S.mem.fed / 4) : 0), -1, 1);
      S.rest[X].dom = clamp(.5 * S.conf[w] + .3 * S.P[w].dom + .2 * ownHere(w), -1, 1);
    }
  }
  function gainK() {
    const ph = S.ph; if (!ph) return 0;
    switch (ph.stage) {
      case 'build': return lerp(K.kBuild0, K.kBuild1, clamp((S.t - ph.stageT0) / (.35 * ph.dur)));
      case 'peak': return K.kPeak;
      case 'resolve': return K.kResolve;
      default: return 0;
    }
  }
  function stepPoints(dt) {
    const k = gainK(), A = S.ph && S.ph.anchor, hd = S.pt.hd, dh = S.pt.dh;
    const Ui = Math.max(0, hd.dom + dh.dom) + .5 * Math.abs(hd.aff - dh.aff);
    const ya = [dh.aff, hd.aff], yd = [dh.dom, hd.dom];
    for (let i = 0; i < 2; i++) {
      const X = i ? 'dh' : 'hd', p = S.pt[X], r = S.rest[X], a = A ? A[X] : null, kk = a ? k : 0;
      // while a phase holds its anchor, the free drift (rest, mirroring, complementarity) mostly yields to it
      const fr = 1 - .6 * Math.min(1, kk / K.kPeak);
      p.aff += (fr * (.01 * (r.aff - p.aff) + .02 * (ya[i] - p.aff)) + (a ? kk * (a.aff - p.aff) : 0)) * dt + U(-.005, .005) * dt;
      p.dom += (fr * (.01 * (r.dom - p.dom) + .03 * (-yd[i] - p.dom)) + (a ? kk * (a.dom - p.dom) : 0)) * dt + U(-.005, .005) * dt;
      p.aro += ((a ? kk * (a.aro - p.aro) : 0) - .02 * p.aro + K.ui * Ui) * dt;
      p.aff = clamp(p.aff, -1, 1); p.dom = clamp(p.dom, -1, 1); p.aro = clamp(p.aro);
    }
  }

  // ---------------------------------------------------------------- 5. perception
  const getH = () => (SIM ? SIM.h : G.__hugo || null);
  const getD = () => (SIM ? SIM.d : G.__scion || null);
  const sore01 = who => S.body[who].sore / (who === 'dove' ? 90 : 60);
  function inView(who) {
    if (SIM) return true;
    const a = who === 'hugo' ? getH() : getD(); if (!a || !DOM) return !!a;
    return !(a.y - (who === 'hugo' ? 150 : 0) > scrollY + innerHeight || a.y < scrollY);
  }
  const visitorHolds = who => S.hold.who === who;
  function keyOf(who) {
    const a = who === 'hugo' ? getH() : getD(); if (!a) return null;
    if (who === 'dove' && a.spotKey !== undefined && !SIM) return a.spotKey;
    if (who === 'hugo' && (a.air || a.held || !(a.floor || SIM))) return null;
    if (who === 'dove' && a.mode !== 'perch') return null;
    return SIM ? Math.round(a.y) * 1e4 + Math.round(a.x / 40) : Math.round(a.y) + '|' + Math.round(a.x / 40);
  }
  const CTXC = { hugo: null, dove: null };
  function ctx(who, extra) {
    const h = getH(), d = getD();
    const hx = h ? h.x : NaN, hy = h ? h.y : NaN, dx = d ? d.x : NaN, dy = d ? d.y : NaN, rc = extra && extra.reach != null ? +extra.reach : -1, fr = S.ph ? S.ph.frame : '';
    const C0 = CTXC[who];
    if (C0 && C0.S === S && C0.t === S.t && C0.hx === hx && C0.hy === hy && C0.dx === dx && C0.dy === dy && C0.rc === rc && C0.fr === fr && C0.dm === (d && d.mode)) return C0.c;
    const c = ctx0(who, extra, h, d); CTXC[who] = { S, t: S.t, hx, hy, dx, dy, rc, fr, dm: d && d.mode, c }; return c;
  }
  function ctx0(who, extra, h, d) {
    const o = OTHER[who], me = S.pt[PT[who]], ph = S.ph;
    const has = !!(h && d && isFinite(h.x) && isFinite(d.x));
    const dx = has ? d.x - h.x : 1e4, dy = has ? d.y - h.y : 0, dist = has ? Math.hypot(dx, dy) : 1e4;
    const look = has ? +h.look || 0 : 0;
    const gaze = has && sgn(look) === sgn(dx) && Math.abs(look) > .3 && h.gestName !== 'turnaway';
    const facing = has && d.face === sgn(-dx) && (d.yaw == null || d.yaw < 4);
    const vH = has ? (h.vxw != null ? +h.vxw : +h.vx || 0) : 0;
    const direct = sgn(vH) === sgn(dx) ? Math.min(1, Math.abs(vH) / 80) : 0;
    const threatH = .35 * gaze + .25 * Math.min(1, Math.abs(vH) / 80) + .2 * direct + .2 * Math.max(0, -S.pt.dh.aff);
    const fear = Math.max(0, -me.aff) * (1 - me.dom) / 2 + .5 * Math.max(0, me.aro - .6) + .3 * sore01(who);
    const reachY = 2.2 * Math.max(64, (h && h.headH) || 150);
    const reach = extra && extra.reach != null ? !!extra.reach : has && d.mode === 'perch' && !d.held && d.y >= h.y - reachY;
    const ob = S.body[o];
    const otherSore = Math.max(sore01(o), ob.dazed > 0 ? 1 : 0, o === 'hugo' && S.t - S.fellAt < 60 ? 1 : 0);
    const crumbNear = S.crumb && d ? Math.hypot(S.crumb.x - d.x, S.crumb.y - d.y) : 1e4;
    const self = who === 'hugo' ? h : d;
    const visitorNear = !!(S.cursor && self && S.t - S.cursor.t < 5 && Math.hypot(S.cursor.x - self.x, S.cursor.y - self.y) < 200);
    const bidFail = 1 - S.bid[who].answered;
    const nurt = who === 'dove' ? S.P.dove.social : S.P.hugo.nurture;
    const anx = me.aff > .3 ? clamp(.6 * nurt + .6 * bidFail - .3) : 0;
    const own = ownHere(who), okey = S.inKey[o] && S.inKey[o].key;
    const contested = (okey && S.M.own[okey] && S.M.own[okey].who === who) || (own === 1 && dist < 150) ? 1 : 0;
    const otherHeld = visitorHolds(o) || (o === 'dove' && ob.heldBy === 'hugo');
    const habD = S.M.hab.dove, frame = ph ? ph.frame : 'serious';
    let risk = threatH * (1 - habD.approach) * (1 + S.tens.dove) * (1 + .6 * grudge('dove')) * (1 + .5 * sore01('dove'));
    if (has && d.y < h.y - reachY && !h.air && h.mode !== 'climb' && !h.hop) risk *= .3;
    const cost = .5 * Math.max(0, ownHere('dove')) + .4 * S.drv.dove.hunger * ((d && d.onText) || crumbNear < 60 ? 1 : 0) + .25 * (frame === 'play') + .15;
    // flight distance shrinks as the dove gets used to him and trusts him (urban doves: FID falls with habituation)
    const fid = clamp((40 + 160 * S.P.dove.nerve) * (.4 + risk) / (.4 + cost) * (1 - .35 * S.M.famil) * (1 - .25 * Math.max(0, trust('dove'))), 20, 420);
    const fearH = who === 'hugo' ? fear : Math.max(0, -S.pt.hd.aff) * (1 - S.pt.hd.dom) / 2 + .5 * Math.max(0, S.pt.hd.aro - .6) + .3 * sore01('hugo');
    const flightH = clamp(40 + 160 * fearH * (1 - S.M.hab.hugo.dive) + 80 * sore01('hugo') - 60 * S.M.famil, 25, 300);
    return {
      risk, fid, flightH, who, o, h, d, has, dx, dy, dist, gaze, facing, vH, threatH, fear, reach, otherSore, crumbNear, visitorNear, bidFail, anx,
      own, contested, otherHeld, otherHeldRecent: otherHeld || S.t - S.lastHold[o] < 20,
      otherDisplaying: S.t - S.lastShow[o] < 3, aff: me.aff, dom: me.dom, aro: me.aro,
      trust: trust(who), grudge: grudge(who), famil: S.M.famil, conf: S.conf[who],
      openHarm: grudge(who) > .1 || grudge(o) > .1 || !!(ph && ph.harm.length && !ph.repaired),
      stress: clamp(+((self && self.stress) || 0)), frame,
      away: S.away > 0 ? 1 : 0, sore: sore01(who), advert: who === 'dove' ? advertBest('dove').adv : 0,
    };
  }

  // ---------------------------------------------------------------- 6. intents
  function impliedMotive(who, p, frame, obj) {
    if (obj === 'crumb' && who === 'dove' && frame === 'serious') return 'prey';
    const z = zone(p);
    if (frame === 'play') return { D: 'prey', HD: 'prey', WD: 'play', W: 'mimic', WS: who === 'dove' ? 'approach' : 'mimic', S: 'avoid', HS: 'avoid', H: 'antag' }[z] || (p.aro > .5 ? 'play' : p.aro < .3 ? 'ignore' : who === 'hugo' ? 'inspect' : 'mimic');
    if (frame === 'display') return { W: who === 'dove' ? 'display' : 'care', WS: 'approach', S: 'mimic', HD: 'own', H: 'antag', HS: 'avoid', C: who === 'hugo' ? 'ignore' : 'inspect' }[z] || 'display';
    switch (z) {
      case 'W': return p.aro > .45 ? 'care' : 'approach';
      case 'WD': return 'care';
      case 'D': return 'own';
      case 'HD': return who === 'hugo' ? 'prey' : 'antag';
      case 'H': return who === 'dove' && p.aro < .5 ? 'avoid' : 'antag';
      case 'HS': return 'avoid';
      case 'S': return p.aro > .5 ? 'avoid' : 'mimic';
      case 'WS': return 'approach';
      default: return p.aro > .4 ? 'inspect' : 'ignore';
    }
  }
  function rowZ(who, c) {
    const P = S.P[who], dv = who === 'dove', Dr = S.drv[who], aff = c.aff, dom = c.dom, aro = c.aro;
    const nurt = dv ? P.social : P.nurture, cur = dv ? P.social : P.curious;
    const z = {
      approach: 1.2 * aff + .6 * Dr.lonely - .9 * c.fear + .3 * c.famil,
      care: 1.3 * aff + .4 * dom + .8 * c.otherSore + .4 * nurt,
      inspect: .6 * (1 - c.famil) + .6 * cur - .5 * Math.abs(aff) + .5 * bell(aro, .45, .2),
      play: aff < -.2 ? -1 : 1.0 * (dv ? P.energy : P.play) + .8 * Dr.boredom + .5 * aff - 1.2 * c.stress,
      prey: dv ? .8 * Dr.hunger + .4 * dom + .6 * c.advert + .3 * c.conf - 1.0 * c.threatH * (c.gaze ? 1 : 0)   // advert: the food's own pull (value x distance falloff)
        : .9 * P.aggr + .6 * Dr.boredom + .5 * dom - .6 * aff * (1 - S.frameRead.hugo) + .4 * (c.reach ? 1 : 0) + .3 * c.away,
      antag: -1.2 * aff + .8 * dom + .9 * c.grudge + .4 * aro + .4 * c.anx * (c.otherHeldRecent ? 1 : 0),
      avoid: 1.5 * c.fear + .6 * c.sore - .7 * c.conf,
      own: 1.0 * c.own + .5 * dom + .6 * c.contested,
      display: .9 * Math.max(0, aff) * (dom + .5) + .6 * P.show + .4 * (c.visitorNear ? 1 : 0),
      mimic: .7 * cur + .6 * aff + .8 * (c.otherDisplaying ? 1 : 0),
      ignore: 1.2 * (1 - aro) - .9 * Math.abs(aff) + .8 * c.bidFail - .5 * Dr.lonely,
    };
    for (const m of MOT) z[m] += B0[m];
    return z;
  }
  function intentStep(who, dt) {
    const c = ctx(who), z = rowZ(who, c), I = S.I[who], phi = S.phi[who], ph = S.ph;
    const holdM = ph && ph.lead === who && (ph.stage === 'build' || ph.stage === 'peak') ? ph.mot[who] : null;
    let best = null;
    for (const m of MOT) {
      const n = S.nudge[who][m], nv = n && n.until > S.t ? n.v : 0;
      const zz = z[m] - .6 * phi[m] + (S.eng[who] === m ? .25 : 0) + nv + (holdM === m ? K.hold : 0);
      const tgt = sigm(4 * (zz - .5));
      I[m] = clamp(I[m] + (tgt - I[m]) * Math.min(1, dt / 8));
      if (!best || I[m] > I[best]) best = m;
    }
    // Schmitt engagement: on above .6 when it is the strongest, off below .35
    if (S.eng[who] && I[S.eng[who]] < .35) S.eng[who] = null;
    if (!S.eng[who] && I[best] > .6) S.eng[who] = best;
    const tau = who === 'hugo' ? 160 + 40 * S.P.hugo.patience : 160 + 40 * (1 - S.P.dove.energy);
    const dec = Math.exp(-dt / 120), inc = dt / tau;
    for (const m of MOT) { if (S.eng[who] === m) phi[m] += inc; else phi[m] *= dec; }
  }

  // ---------------------------------------------------------------- 7. EX table and utility
  const EX = [
    // id, esc, motives, aro_e, window [lo, hi], tau, frame gate, cast, close (out of range => implicit approach)
    ['approach', 0, { approach: 1, inspect: .3, care: .3 }, .3, [120, INF], 4, 'any', 'both', 0],
    ['inspect', 0, { inspect: 1 }, .45, [80, 350], 8, 'any', 'both', 1],
    ['follow', 0, { approach: .6, care: .3 }, .3, [150, INF], 10, 'any', 'both', 0],
    ['offer', -1, { care: 1, approach: .4 }, .3, [0, 160], 15, 'any', 'both', 1],
    ['scrounge', 1, { prey: 1 }, .5, [0, 250], 6, 'any', 'dove', 1],
    ['groom', -1, { care: 1 }, .2, [0, 70], 12, 'any', 'both', 1],
    ['pickup', 0, { care: .7, play: .5, approach: .3 }, .35, [0, 90], 10, 'any', 'hugo', 1],
    ['sit_with', -1, { approach: .7, care: .3, ignore: .2 }, .1, [0, 140], 20, 'any', 'both', 1],
    ['play_bow', 0, { play: 1 }, .5, [0, 300], 6, 'play', 'both', 0],
    ['chase', 1, { play: .7, prey: .6 }, .7, [0, 400], 5, 'any', 'both', 0],
    ['keepaway', 0, { play: .8, avoid: .4 }, .6, [0, 200], 3, 'any', 'both', 0],
    ['stalk', 1, { prey: 1 }, .6, [120, 400], 10, 'sp', 'both', 0],
    ['pounce', 1, { prey: 1 }, .8, [0, 110], 8, 'sp', 'hugo', 0],
    ['swat', 1, { antag: 1, prey: .3 }, .75, [0, 90], 4, 'sp', 'hugo', 1],
    ['peck_at', 1, { antag: 1, own: .4 }, .7, [0, 260], 3, 'sp', 'dove', 1],
    ['dive_bomb', 1, { antag: 1, own: .3 }, .9, [80, 500], 25, 'sp', 'dove', 0],
    ['threat', 1, { antag: .6, own: .6 }, .6, [0, 200], 6, 'any', 'both', 1],
    ['scold', 1, { antag: .7 }, .6, [80, 300], 6, 'any', 'both', 0],
    ['guard_spot', 0, { own: 1 }, .5, [0, 180], 8, 'any', 'both', 0],
    ['displace', 1, { own: 1, antag: .3 }, .6, [0, 200], 15, 'any', 'both', 1],
    ['flee', -1, { avoid: 1 }, .7, [0, 'fid'], 2, 'any', 'both', 0],
    ['ignore', -1, { ignore: 1 }, .1, [0, INF], 6, 'any', 'both', 0],
    ['sulk', -1, { avoid: .5, ignore: .6 }, .2, [0, INF], 15, 'any', 'both', 0],
    ['display', 0, { display: 1 }, .55, [60, 220], 12, 'dispD', 'both', 1],
    ['mimic', 0, { mimic: 1 }, .5, [0, 300], 4, 'any', 'both', 0],
    ['reconcile', -1, { care: .6, approach: .6 }, .3, [0, INF], 20, 'any', 'both', 0],
    ['comfort', -1, { care: 1 }, .3, [0, INF], 15, 'any', 'both', 0],
    ['protect', 0, { care: .7, antag: .5 }, .7, [0, INF], 5, 'any', 'both', 0],
    ['ride', -1, { approach: .5, care: .5 }, .2, [0, 200], 40, 'any', 'dove', 1],
    ['wait_below', 0, { prey: .6 }, .4, [0, INF], 15, 'any', 'hugo', 0],
  ].map(([id, esc, m, aro, win, tau, fr, who, close]) => ({ id, esc, m, aro, win, tau, fr, who, close, mSum: Object.values(m).reduce((a, b) => a + b, 0) }));
  const EXI = {}; for (const e of EX) EXI[e.id] = e;
  const TOWARD = new Set(['approach', 'sit_with', 'groom', 'pickup', 'mimic', 'play_bow', 'display', 'offer', 'follow', 'comfort', 'reconcile', 'ride', 'inspect']);
  const AWAY = new Set(['ignore', 'flee', 'sulk']);
  const AGAINST = new Set(['threat', 'scold', 'swat', 'peck_at', 'displace', 'dive_bomb', 'pounce']);
  const SHOWY = new Set(['display', 'play_bow', 'mimic', 'keepaway']);
  const NEARX = new Set(['approach', 'sit_with', 'groom', 'offer', 'comfort', 'reconcile', 'ride', 'follow', 'inspect', 'mimic', 'display']);
  const BOLDX = new Set(['peck_at', 'displace', 'scrounge', 'chase', 'stalk', 'threat']);
  const MIMIC = { bow: 'bow', hop: 'jump', dance: 'bowCoo', scratch: 'preen', stretch: 'wing', mimicBob: 'bob', look: 'bob', greet: 'bow',
    curious: 'bob', peer: 'bob', fist: 'puff', shoo: 'puff', hips: 'puff', turnaway: 'preen' };
  const MIMIC_D = { bow: 'bow', jump: 'hop', bowCoo: 'dance', preen: 'scratch', wing: 'stretch', bob: 'mimicBob',
    hop: 'hop', hop_back: 'hop', offer: 'bow', preen_away: 'scratch', preen_beside: 'scratch', puff: 'hips' };
  const actOf = o => (o.gesture ? o.gesture.name : o.what || o.do || o.ex);
  const recentAct = who => (S.lastAct && S.lastAct[who] && S.t - S.lastAct[who].t <= 4 ? S.lastAct[who].name : null);

  const Tnow = () => Math.max(S.tens.hugo, S.tens.dove);
  function Tstar() {
    const ph = S.ph; if (!ph) return .2;
    const u = (S.t - ph.t0) / ph.dur;
    if (ph.stage === 'build') return ph.band * smooth(0, .35, u);
    if (ph.stage === 'peak') return ph.band;
    return ph.band * (1 - smooth(.6, .9, u));
  }
  function peekRung(who, id) {
    if (id !== 'peck_at' && id !== 'dive_bomb') return 0;
    const r = S.rung[who][id]; let n = r && S.t - r.t < 15 ? r.n : 1;
    if ((S.ph && S.ph.frame === 'play') || S.gentle) n = Math.min(2, n);
    return n;
  }
  function takeRung(who, id) {
    if (id !== 'peck_at' && id !== 'dive_bomb') return 0;
    let r = S.rung[who][id];
    if (!r || S.t - r.t > 15) r = { n: 1 + (rnd() < .25 + .45 * S.P[who].aggr + .3 * S.tens[who] ? 1 : 0), step: S.t, gap: U(2.5, 5) };   // an aggressive or wound-up bird skips the opening warning
    else if (S.t - r.step > r.gap) { r.n = Math.min(4, r.n + 1); r.step = S.t; r.gap = U(3, 6); }
    r.t = S.t; S.rung[who][id] = r;
    let n = r.n; if ((S.ph && S.ph.frame === 'play') || S.gentle) n = Math.min(2, n);
    return n;
  }
  function gateOK(e, who, c) {
    if (e.who !== 'both' && e.who !== who) return false;
    if (!c.has) return false;
    const fr = c.frame;
    if (e.fr === 'play' && fr !== 'play') return false;
    if (e.fr === 'sp' && fr === 'display') return false;
    if (e.fr === 'dispD' && who === 'dove' && fr !== 'display') return false;
    const ph = S.ph;
    switch (e.id) {
      case 'ride': return c.aff > .55 && (c.trust > .3 || c.famil > .45) && !!c.h && !c.h.held && !c.h.air;
      case 'reconcile': return c.openHarm;
      case 'protect': return c.otherHeld && visitorHolds(c.o);
      case 'wait_below': return !c.reach && c.d.mode === 'perch' && c.dist < 500 && (S.eng.hugo === 'prey' || S.t - (S.cool.hugo.stalk ?? -1e9) < 20 || S.t - (S.cool.hugo.chase ?? -1e9) < 20);
      case 'comfort': return c.otherSore > .2;
      case 'pounce': return c.reach && !c.otherHeld;
      case 'chase': if (fr === 'play' && ph && ph.chaser !== who) return false; return who === 'hugo' ? c.reach || (c.d.mode === 'fly' && c.d.y >= c.h.y - 2.2 * (c.h.headH || 150)) : !c.h.air;
      case 'keepaway': return !(fr === 'play' && ph && ph.chaser === who);
      case 'stalk': return who === 'hugo' ? c.reach : !c.h.air && !c.h.held;
      case 'swat': return c.reach && !c.otherHeld;
      case 'pickup': return c.reach && !c.otherHeld && c.d.mode === 'perch' && (c.aff > .15 || fr === 'play' || S.I.hugo.care > .4);
      case 'scrounge': return !!advertBest('dove').item || c.dist < 250;
      case 'peck_at': return !c.h.air && !c.h.held;
      case 'guard_spot': return c.own > 0;
      case 'displace': return c.dom > .2 || ownHere(c.o) !== 0 || c.contested > 0;
      case 'offer': return !c.otherHeld;
      case 'mimic': return !!recentAct(c.o);
      default: return true;
    }
  }
  function distF(e, c) {
    const d = c.dist; let lo = e.win[0], hi = e.win[1];
    if (hi === 'fid') hi = 1.5 * (c.who === 'dove' ? c.fid : c.flightH);
    const fin = hi >= INF ? 1 : logistic(d, hi, Math.max(8, hi * .12));
    const fout = lo <= 0 ? 1 : 1 - logistic(d, lo, Math.max(8, lo * .12));
    let f = fin * fout;
    if (e.close && d > hi) f = Math.max(f, .35);
    return f;
  }
  const boostOf = (who, id) => { const b = S.boost[who][id]; return b && b.until > S.t && (b.from == null || b.from <= S.t) ? b.v : 0; };
  function util(e, who, c) {
    if (!gateOK(e, who, c)) return 0;
    if (S.gentle && (e.id === 'swat' || e.id === 'pounce')) return 0;
    const I = S.I[who]; let f = 0;
    for (const m in e.m) f += I[m] * e.m[m];
    f /= e.mSum;
    const aroE = e.aro + .1 * Math.max(0, peekRung(who, e.id) - 1);
    f *= Math.exp(-((c.aro - aroE) ** 2) / (2 * .09));
    const en = e.esc > 0 ? .4 + .6 * S.drv[who].energy : 1;
    const last = S.cool[who][e.id], cool = last == null ? 1 : 1 - Math.exp(-(S.t - last) / e.tau);
    const mom = S.cur[who] && S.cur[who].ex === e.id ? 1.25 : 1;
    const tn = clamp(1 + 1.5 * e.esc * (Tstar() - Tnow()), .1, 2);
    const W = S.M.W[who][e.id] != null ? S.M.W[who][e.id] : 1;
    return W * f * distF(e, c) * en * cool * mom * tn * (1 + boostOf(who, e.id)) * U(.85, 1.15);
  }

  // Realisations: what each exchange means for each body (order shapes are the bodies' contract).
  const G_ = (name, dur, aro, side, extra) => ({ name, dur, windup: lerp(.8, .3, aro), side, amp: 1, ...(extra || {}) });
  function hugoOrder(e, c, o) {
    const h = c.h, d = c.d, side = sgn(c.dx) || 1, near = (x, gap) => ({ x: x - side * gap, y: d.y });
    Object.assign(o, { goal: null, spdK: 1, crouch: 0, look: side * .8, gesture: null, stop: false, pounce: null, drop: null, carry: false });
    const far = d && c.dist > (e.win[1] === INF ? 1e9 : e.win[1]);
    switch (e.id) {
      case 'approach': o.goal = near(d.x, U(40, 80)); if (S.I.hugo.inspect > S.I.hugo.approach) { o.spdK = .7; o.look = -side * .5; } break;
      case 'inspect': o.goal = { x: h.x + side * Math.max(0, Math.min(40, c.dist - 90)), y: h.y }; o.gesture = G_(rnd() < .5 ? 'curious' : 'peer', 2.5, c.aro, side); break;
      case 'follow': o.goal = near(d.x, 80); o.until = S.t + 6; break;
      case 'offer': if (far) o.goal = near(d.x, 70); o.gesture = G_('greet', 3, c.aro, side); o.drop = 'crumb'; break;
      case 'groom': o.goal = near(d.x, 35); o.gesture = G_('pat', 3, c.aro, side); break;
      case 'pickup': o.goal = near(d.x, 24); o.gesture = G_('scoop', 1.6, c.aro, side); break;
      case 'sit_with': o.goal = near(d.x, U(55, 90)); o.sit = true; o.look = side * .4; break;
      case 'play_bow': o.stop = true; o.gesture = G_('bow', 1.6, c.aro, side); break;
      case 'chase': o.goal = { x: d.x, y: d.y }; o.spdK = 2.2; break;
      case 'keepaway': o.goal = { x: h.x - side * U(120, 200), y: h.y }; o.spdK = 1.6; o.gesture = G_('dance', 1.5, c.aro, -side); o.look = side * .6; break;
      case 'stalk': o.goal = near(d.x, 110); o.crouch = .6; o.spdK = .45; o.look = side; o.until = S.t + 20; break;
      case 'pounce': { const hcap = c.frame === 'play' ? (.4 + .4 * S.P.hugo.play) * 40 : 0; o.pounce = { x: d.x - side * hcap }; o.stop = true; o.gesture = G_('crouch', .6, c.aro, side, { windup: lerp(.8, .3, c.aro) }); break; }
      case 'swat': o.goal = near(d.x, 30); o.gesture = G_('swat', 1.2, c.aro, side); if (c.frame === 'play') o.gesture.soft = 1; break;
      case 'threat': o.stop = !far; if (far) o.goal = near(d.x, 120); o.gesture = G_(pickOf(['shoo', 'fist', 'stomp']), 2.2, c.aro, side); break;
      case 'scold': o.stop = true; o.gesture = G_('fist', 2, c.aro, side); break;
      case 'guard_spot': o.stop = true; o.gesture = G_('hips', 3, c.aro, side); break;
      case 'displace': o.goal = { x: d.x, y: d.y }; o.spdK = 1.2; break;
      case 'flee': o.goal = { x: h.x - side * U(200, 320), y: h.y }; o.spdK = 1.8; o.look = side * .5; break;
      case 'ignore': o.stop = true; o.gesture = G_(rnd() < .7 ? 'turnaway' : 'breathe', 4, c.aro, side); o.look = -side * .8; break;
      case 'sulk': o.sit = true; o.stop = true; o.gesture = G_('turnaway', 6, c.aro, side); o.look = -side * .9; break;
      case 'display': o.stop = !far; if (far) o.goal = near(d.x, 140); o.gesture = G_(rnd() < .6 ? 'dance' : 'stretch', 3, c.aro, side); break;
      case 'mimic': { o.stop = true; o.gesture = G_(MIMIC_D[recentAct('dove')] || 'mimicBob', 2, c.aro, side); break; }
      case 'reconcile': o.goal = near(d.x, c.dist > 200 ? 140 : 60); o.spdK = .5; o.gesture = G_('greet', 2.5, c.aro, side, { amp: .5 }); break;
      case 'comfort': o.goal = near(d.x, 45); o.crouch = .4; o.gesture = G_('greet', 3, c.aro, side); break;
      case 'protect': { const cu = S.cursor || d; o.goal = { x: cu.x, y: h.y }; o.gesture = G_('fist', 2, c.aro, sgn(cu.x - h.x) || 1); break; }
      case 'wait_below': o.stop = true; o.gesture = G_(S.P.hugo.patience > .5 ? 'stare' : 'behind', 4, c.aro, side); break;
      default: o.stop = true;
    }
    return o;
  }
  function doveOrder(e, c, o) {
    const h = c.h, aff = c.aff, side = sgn(c.d.x - h.x) || 1;
    Object.assign(o, { do: e.id, x: h.x, y: h.y, gap: 0, passes: 0, contact: false, panic: false, dur: 3, where: null });
    switch (e.id) {
      case 'approach': o.do = 'land_beside'; o.gap = Math.max(30, c.fid * (1 - aff) / 2); break;
      case 'inspect': o.do = 'inspect'; o.dur = 3; break;
      case 'follow': o.do = 'follow_hugo'; o.gap = U(60, 150); o.until = S.t + 10; break;
      case 'offer': o.do = 'offer'; o.gap = 40; break;
      case 'scrounge': { const it = advertBest('dove').item; o.do = it ? (c.aff < .1 || (c.gaze && c.fear > .3) ? 'steal' : 'take') : 'scrounge'; if (it) { o.x = it.x; o.y = it.y; o.food = it.id; } else { o.x = h.x + side * 30; } break; }
      case 'groom': o.do = 'preen_beside'; o.gap = 25; o.dur = 4; break;
      case 'sit_with': o.do = 'land_beside'; o.gap = U(40, 90); o.dur = 20; o.rest = true; break;
      case 'play_bow': o.do = 'hop'; o.dur = 1.2; break;
      case 'chase': o.do = 'chase'; o.until = S.t + 8; break;
      case 'keepaway': o.do = 'keepaway'; o.x = c.d.x + side * U(90, 170); o.y = c.d.y; break;
      case 'stalk': o.do = 'creep'; o.x = h.x + side * 40; o.until = S.t + 12; break;
      case 'peck_at': o.do = 'peck_hugo'; o.gap = 28; o.dur = 1.5; break;
      case 'dive_bomb': o.do = 'pass'; o.passes = 2 + ((rnd() * 4) | 0); o.contact = false; o.contactFrom = c.frame !== 'play' && !S.gentle ? Math.max(1, 3 - o.rung) : 99; o.until = S.t + 25; break;
      case 'threat': o.do = 'puff'; o.dur = 2; break;
      case 'scold': o.do = 'scold'; o.dur = 2; break;
      case 'guard_spot': o.do = 'guard'; o.dur = 3; break;
      case 'displace': o.do = 'displace'; o.x = h.x; o.y = h.y; break;
      case 'flee': o.do = 'flee'; o.panic = c.fear > .6; o.x = c.d.x + side * 1.5 * c.fid; break;
      case 'ignore': o.do = 'preen_away'; o.dur = U(2, 3); break;
      case 'sulk': o.do = 'sulk'; o.x = c.d.x + side * U(300, 500); o.dur = 6; break;
      case 'display': o.do = 'bowCoo'; o.dur = 4; break;
      case 'mimic': { o.do = 'mimic'; o.what = MIMIC[recentAct('hugo')] || 'bob'; o.dur = 2; break; }
      case 'reconcile': o.do = 'land_beside'; o.gap = c.dist > 200 ? 140 : 60; o.slow = true; break;
      case 'comfort': o.do = 'comfort'; o.gap = 25; o.dur = 5; break;
      case 'protect': { const cu = S.cursor || h; o.do = 'pass'; o.x = cu.x; o.y = cu.y; o.passes = 2; o.contact = false; o.cursor = true; break; }
      case 'ride': o.do = 'perch_on_hugo'; o.where = rnd() < .6 ? 'head' : 'shoulder'; o.until = S.t + 60; break;
      default: o.do = 'preen_away';
    }
    return o;
  }
  const UNTIL = { pickup: 14, chase: 35, sit_with: 30, ride: 60, stalk: 20, display: 12, sulk: 20, follow: 12, dive_bomb: 25, reconcile: 20, comfort: 15, groom: 14, offer: 15 };
  function makeOrder(who, e, c, u, why) {
    const rung = takeRung(who, e.id);
    const o = { id: who[0] + (++S.ids), ex: e.id, rung, u: +u.toFixed(3), why, until: S.t + (UNTIL[e.id] || 8), evalAt: S.t };
    return who === 'hugo' ? hugoOrder(e, c, o) : doveOrder(e, c, o);
  }
  function startEx(who, o, c) {
    const ph = S.ph, o2 = OTHER[who], e = EXI[o.ex];
    S.cool[who][o.ex] = S.t; S.lastAct = S.lastAct || {}; S.lastAct[who] = { name: actOf(o), t: S.t };
    S.drv[who].boredom = clamp(S.drv[who].boredom - .05);
    if (SHOWY.has(o.ex)) S.lastShow[who] = S.t;
    if (ph) {
      ph.exSeq.push(who[0] + ':' + o.ex); ph.x[who[0] + ':' + o.ex] = (ph.x[who[0] + ':' + o.ex] || 0) + 1;
      if (e && e.esc > 0) ph.init.push(who);
      if (o.ex === 'chase') { ph.chaseSegs++; }
      if (o.ex === 'protect' && visitorHolds(o2)) ph.protected = who;
      if ((o.ex === 'peck_at' && o.rung >= 4) || (o.ex === 'dive_bomb' && o.rung >= 3) || o.ex === 'pounce') ph.ladderTop = true;
      if (o.ex === 'ride') ph.gist = true;
      if (ph.lastRelease && S.t - ph.lastRelease < 20 && ph.heldHugo && who === 'dove' && (o.ex === 'peck_at' || o.ex === 'dive_bomb')) ph.jealousAct = true;
      if (ph.fellT && S.t - ph.fellT < 20 && who === 'dove') { if (o.ex === 'comfort' || o.ex === 'groom') ph.rescue = true; if (o.ex === 'peck_at') ph.kicked = true; }
    }
    // the reply to the other's open bid
    const ob = S.bidOpen[o2];
    if (ob && S.t - ob.t < 15 && !o.imp) {
      S.bidOpen[o2] = null;
      if (TOWARD.has(o.ex)) ev(who, 'answered', o2, .1);
      else if (AWAY.has(o.ex)) ev(who, 'ignored', o2, .1);
      else if (AGAINST.has(o.ex)) { S.bid[o2].answered += .25 * (0 - S.bid[o2].answered); if (ph) ph.againstAt = S.t; }
    }
    if (c.dist < 600 && !o.imp) S.bidOpen[who] = { ex: o.ex, t: S.t };
    const SV = { approach: 'approach', follow: 'approach', chase: 'chased', flee: 'fled', display: 'display', mimic: 'mimicked', threat: 'bid', scold: 'bid', offer: 'bid', play_bow: 'bid', groom: 'bid', sit_with: 'bid' }[o.ex];
    if (SV) ev(who, SV, o2, .1 + .3 * Math.max(0, e ? e.esc : 0) * c.aro, { ex: o.ex, quiet: 1 });
  }
  // The body asks what to do now (every ~0.75 s). null = no relational order: the body's own life runs.
  function want(who, extra) {
    if (!S || (who !== 'hugo' && who !== 'dove')) return null;
    if (visitorHolds(who) || (who === 'dove' && S.body.dove.heldBy === 'hugo')) { S.cur[who] = null; return null; }
    if (who === 'dove' && S.t < S.reflexUntil) return null;
    let cur = S.cur[who];
    if (cur && S.t > cur.until) { S.cur[who] = cur = null; }
    if (cur && cur.imp) return cur;
    const q = S.imp[who];
    while (q.length && q[0].exp < S.t) q.shift();
    if (!q.length && cur && S.t - (cur.evalAt || 0) < 2) return cur;
    if (q.length) {
      const o = q.shift(); o.id = who[0] + (++S.ids); o.until = S.t + Math.min(1.5, o.dur || 1.5); o.imp = true; o.u = 1; o.why = o.why || 'impulse';
      S.cur[who] = o; S.lastAct = S.lastAct || {}; S.lastAct[who] = { name: actOf(o), t: S.t };
      if (S.ph) S.ph.exSeq.push(who[0] + ':' + o.ex);
      return o;
    }
    const c = ctx(who, extra);
    if (S.staged && S.staged.who === who && S.staged.exp > S.t) {
      const st = S.staged; S.staged = null;
      if (c.has) {
        const e = EXI[st.ex], o = makeOrder(who, e, c, .5, 'staged');
        if (st.gap) o.gap = st.gap;
        S.cur[who] = o; startEx(who, o, c); return o;
      }
    }
    let best = null, bestU = 0, curU = 0; const scored = [];
    for (const e of EX) {
      const u = util(e, who, c); if (u <= 0) continue;
      scored.push([u, e]); if (u > bestU) { bestU = u; best = e; }
      if (cur && cur.ex === e.id) curU = u;
    }
    if (cur) {
      cur.evalAt = S.t;
      if (!best || best.id === cur.ex || bestU < 1.35 * curU) return cur;
    }
    if (!best || bestU < .12) { S.cur[who] = null; return null; }
    scored.sort((a, b) => b[0] - a[0]);
    const top = scored.slice(0, 3); let tot = 0; for (const s of top) tot += s[0] * s[0];
    let r = rnd() * tot, ch = top[0];
    for (const s of top) { r -= s[0] * s[0]; if (r <= 0) { ch = s; break; } }
    const o = makeOrder(who, ch[1], c, ch[0], c.has ? `${ch[1].id} (${Object.keys(ch[1].m)[0]})` : 'alone');
    S.cur[who] = o; startEx(who, o, c);
    return o;
  }
  function done(who, id, result = 'ok', data = {}) {
    if (!S) return;
    const o = S.cur[who]; if (!o || o.id !== id) return;
    S.cur[who] = null;
    if (result !== 'ok') return;
    const o2 = OTHER[who], ph = S.ph;
    switch (o.ex) {
      case 'offer': {
        const c = ctx(o2), x = 6 * (.5 * c.aff + .3 * c.famil + .2 * S.M.hab[o2].approach - .6 * c.fear - .5) + gauss() * .6;
        if (data.stayed !== false && x > 0) {
          ev(o2, 'answered', who, .1, { offer: 1 }); if (ph) { ph.gist = true; ph.accepted = (ph.accepted || 0) + 1; }
          if (o2 === 'dove' && S.crumb) S.boost.dove.scrounge = { v: .8, until: S.t + 15 };
        }
        else ev(o2, 'ignored', who, .1, { offer: 1 });
        break;
      }
      case 'reconcile': if (ctx(who).dist < 200) ev(who, 'reconciled', o2, .3); break;
      case 'displace': if (data.won) ev(who, 'displaced', o2, .3); break;
      case 'comfort': if (ph && ctx(who).otherSore > .2) ph.comforted = who; break;
      case 'protect': if (ph) ph.protected = who; break;
      default:
    }
  }
  const impulse = (who, o) => { S.imp[who].push({ ...o, exp: S.t + 4 }); if (S.imp[who].length > 3) S.imp[who].shift(); };

  // Reflex: the dove's flight initiation distance and freeze band (per frame; 1 s internal cooldown).
  function reflex(who = 'dove') {
    if (!S || who !== 'dove' || S.t < S.reflexAt) return null;
    const h = getH(), d = getD(); if (!h || !d) return null;
    const B = S.body.dove, byHugo = B.heldBy === 'hugo';
    if (visitorHolds('dove') || (d.held && !byHugo)) return null;
    if (!byHugo && (d.mode !== 'perch' || Math.hypot(d.x - h.x, d.y - h.y) > 760)) return null;
    const c = ctx('dove'), conf = S.conf.dove, p = S.pt.dh;
    const cornered = c.dist < 40 && (S.ph && S.ph.chaser === 'hugo') && c.fid > 200;
    let r = null;
    if ((byHugo || (c.dist < 40 && (S.t - S.lastStrike.hugo < 2 || cornered))) && p.dom + conf > .6) r = { do: 'strike_back', slap: byHugo };
    else if (byHugo || d.mode !== 'perch' || B.dazed > 0) return null;
    else {
      const cur = S.cur.dove;
      if (cur && !cur.imp && ((NEARX.has(cur.ex) && p.aff > .3) || (BOLDX.has(cur.ex) && p.dom + conf > .3))) return null;
      if (cur && cur.ex === 'keepaway' && c.frame === 'play') return null;
      const hc = S.cur.hugo;
      if (hc && TOWARD.has(hc.ex) && trust('dove') + Math.max(0, p.aff) + .5 * S.M.famil > .55 + .4 * c.fear) return null;
      if (c.dist < 45 && c.threatH > .3) r = { do: 'flee', panic: c.risk > .55 };
      else if (c.dist < c.fid) r = { do: 'flee', panic: c.risk > .55 };
      else if (c.dist < 1.8 * c.fid && S.cur.hugo && S.cur.hugo.ex === 'stalk') r = { do: 'freeze', dur: U(1.5, 3) };
      if (r && r.do === 'flee' && c.frame === 'play' && S.frameRead.dove >= .4 && c.risk <= .55) r = { do: 'keepaway', x: d.x + (sgn(d.x - h.x) || 1) * U(90, 170), y: d.y };
    }
    if (!r) return null;
    S.reflexAt = S.t + 1; S.reflexUntil = S.t + (r.do === 'freeze' ? r.dur : 2);
    S.cur.dove = null; r.ex = r.do; r.id = 'rx' + (++S.ids);
    if (S.ph) { S.ph.exSeq.push('d:' + r.do); S.ph.x['d:' + r.do] = (S.ph.x['d:' + r.do] || 0) + 1; }
    if (r.do === 'flee') ev('dove', 'fled', 'hugo', .2, { reflex: 1, panic: r.panic });
    if (r.do === 'strike_back') ev('dove', 'peckApex', 'hugo', 0, { x: d.x, y: d.y, slap: byHugo ? 1 : 0, rung: 3 });
    return r;
  }

  // ---------------------------------------------------------------- 8. contact
  const APEX = { strikeApex: 'swat', peckApex: 'peck', diveApex: 'dive', pounceLand: 'pounce', pickApex: 'pick' };
  function setBody(who, kind, sev) {
    const B = S.body[who], max = who === 'dove' ? 90 : 60;
    if (who === 'dove' && kind === 'swat') B.ruffled = Math.min(8, B.ruffled + 3 + 5 * sev);
    if (who === 'dove' && kind === 'pounce') B.ruffled = Math.min(8, B.ruffled + 2 + 3 * sev);
    if (kind !== 'pounce' || who === 'dove') B.sore = Math.min(max, B.sore + (who === 'dove' ? 20 : 15) + 40 * sev);
    if (sev > .6) B.dazed = Math.min(4, B.dazed + 1 + 7.5 * (sev - .6));
  }
  function resolve(kind, a, b, data) {
    const h = getH(), d = getD(), ph = S.ph; if (!h || !d || !b || !S.body[b]) return;
    const B = S.body[b], wasHeld = visitorHolds(b), wasDazed = B.dazed > 0, since = S.t - S.contactAt[b];
    if (a === 'hugo' || a === 'dove') S.lastStrike[a] = S.t;
    const x = data.x != null ? data.x : a === 'hugo' ? h.x : d.x, y = data.y != null ? data.y : a === 'hugo' ? h.y : d.y;
    if (kind === 'pick') return pick(x, y);
    let ok = !wasHeld && !wasDazed && since >= 1.5 && (!ph || ph.contacts < 6) && !S.gentle;
    if (b === 'dove' && Math.abs(d.z || 0) >= 25) ok = false;
    let p = 0, hit = '', miss = '';
    switch (kind) {
      case 'swat': ok = ok && Math.hypot(x - d.x, y - (d.y - 30)) < 40 && d.mode === 'perch' && !d.held; p = .75; hit = 'swatHit'; miss = 'swatMiss'; break;
      case 'peck': ok = ok && (data.slap && S.body.dove.heldBy === 'hugo' ? true : Math.abs(d.x - h.x) < 30 && Math.abs(d.y - h.y) < 12); p = .85; hit = 'peckHit'; miss = 'nearMiss'; break;
      case 'dive': ok = ok && !!data.contact && Math.hypot(x - h.x, y - (h.y - ((h.headH) || 150))) < 40; p = .7; hit = 'diveHit'; miss = 'diveMiss'; break;
      case 'pounce': ok = ok && Math.abs(x - d.x) < 40 && d.mode === 'perch' && Math.abs(d.y - y) < 12 && S.t - S.reflexAt > -.9 && S.body.dove.heldBy !== 'hugo'; p = .65 - .3 * S.drv.dove.energy; hit = 'caught'; miss = 'nearMiss'; break;
      default: return;
    }
    if (!ok || rnd() >= p) {
      if (ph) ph.misses++;
      const near = kind === 'dive' ? Math.hypot(x - h.x, y - (h.y - ((h.headH) || 150))) < 80 : kind === 'swat' ? Math.abs(x - d.x) < 80 : Math.abs(d.x - h.x) < 70;
      if (near || kind === 'dive') ev(a, miss, b, .2, { kind, x, y });
      if (kind === 'dive' && b === 'hugo' && Math.hypot(x - h.x, y - (h.y - (h.headH || 150))) < 80) {
        impulse('hugo', { ex: 'cover', stop: true, gesture: { name: 'cover', dur: .8, windup: 0, side: sgn(d.x - h.x) || 1, amp: 1 } });
        S.boost.hugo.flee = { v: .4 * clamp(.3 + ctx('hugo').fear), until: S.t + 10 };
      }
      return;
    }
    const pa = S.pt[PT[a]], rung = data.rung || (S.cur[a] && S.cur[a].rung) || 0;
    let sev = clamp(.15 + .6 * pa.aro * (rung ? rung / 4 : .5), .1, .8);
    const play = ph && ph.frame === 'play';
    if (play) { const hh = a === 'hugo' ? .4 + .4 * S.P.hugo.play : .4 + .4 * S.P.dove.energy; sev *= 1 - hh; }
    sev = clamp(sev, .05, .8);
    if (S.audit) S.audit.push({ t: S.t, recv: b, held: wasHeld, dazed: wasDazed, since, contacts: ph ? ph.contacts : 0, sev });
    B.hits++; B.lastHit = { sev, by: a, kind }; S.contactAt[b] = S.t;
    if (ph) { ph.contacts++; ph.gist = true; ph.lastContact = S.t; if (kind !== 'pounce' || !play) ph.harm.push({ a, b, sev, t: S.t, kind }); }
    setBody(b, kind, sev);
    if (kind === 'pounce') { B.heldBy = 'hugo'; B.holdKind = 'catch'; B.heldUntil = S.t + (play ? 3 : 2) + U(0, 2); B.releasing = null; }
    ev(a, hit, b, sev, { kind, x, y, rung, play: play ? 1 : 0 });
    // frame-break test (play only)
    if (play && S.ph) {
      const read = S.frameRead[b] + gauss() * .15 * (1 - S.M.famil);
      if (sev > .25 + .3 * trust(b)) frameBreak(b, 'hard');
      else if (read < .3) frameBreak(b, 'misread');
      else S.frameRead[b] = clamp(S.frameRead[b] - .15);
    }
    // impulses: cover then rub (Hugo), a reflex flight (the dove) unless it stands its ground
    if (b === 'hugo') { impulse('hugo', { ex: 'cover', stop: true, gesture: { name: 'cover', dur: 1, windup: 0, side: sgn(d.x - h.x) || 1, amp: 1 } }); impulse('hugo', { ex: 'rub', stop: true, gesture: { name: 'rub', dur: 1.5, windup: 0, side: 1, amp: 1 } }); }
    else if (kind !== 'pounce') {
      const c = ctx('dove');
      if (!(S.pt.dh.dom + S.conf.dove > .6)) impulse('dove', { ex: 'flee', do: 'flee', panic: c.fear > .6, x: d.x + (sgn(d.x - h.x) || 1) * 1.5 * c.fid, y: d.y });
    }
    if (S.ph && S.ph.frame === 'play' && (a === 'hugo' || a === 'dove')) metaSignals(a);
  }
  // A pick-up is not a strike: whether the bird lets him is the bird's call, from its trust, its liking and its fear.
  function pick(x, y) {
    const h = getH(), d = getD(), ph = S.ph, B = S.body.dove;
    if (!h || !d || B.heldBy === 'hugo' || visitorHolds('dove') || d.held || d.mode !== 'perch') return;
    const c = ctx('dove'), near = Math.abs(x - d.x) < 50 && Math.abs(d.y - h.y) < 16;
    const willing = clamp(.2 + .6 * trust('dove') + .45 * Math.max(0, S.pt.dh.aff) + .15 * S.M.famil - .55 * c.fear + (ph && ph.frame === 'play' ? .1 : 0), .05, .95);
    if (!near || rnd() >= willing) {   // it hops out of his hands
      tally('pickDodged'); ev('dove', 'nearMiss', 'hugo', .2, { kind: 'pick', x, y });
      impulse('dove', { ex: 'flee', do: 'flee', panic: c.fear > .6, x: d.x + (sgn(d.x - h.x) || 1) * Math.max(120, c.fid), y: d.y });
      return;
    }
    B.heldBy = 'hugo'; B.holdKind = 'cradle'; B.heldUntil = S.t + U(3.5, 8) * (.6 + .6 * Math.max(0, S.pt.hd.aff)); B.releasing = null;
    S.contactAt.dove = S.t; if (ph) { ph.contacts++; ph.gist = true; ph.lastContact = S.t; }
    ev('hugo', 'pickedUp', 'dove', .15, { x, y });
  }
  // The end of a hold: he lets it go up out of his hands, or he throws it. How he feels about it right now decides.
  function endHold() {
    const B = S.body.dove, h = getH(), d = getD(); if (B.releasing) return;
    const p = S.pt.hd, play = S.ph && S.ph.frame === 'play';
    const throwP = clamp(.08 + .75 * Math.max(0, -p.aff) + .4 * Math.max(0, p.dom) * p.aro + (play ? .3 : 0) + (B.holdKind === 'catch' ? .15 : 0) + .3 * S.tens.hugo);
    const kind = rnd() < throwP ? 'throw' : 'lift', side = h && d ? sgn(d.x - h.x) || 1 : 1;
    B.releasing = { kind, by: S.t + (kind === 'throw' ? 2.2 : 1.8) };   // his body plays the throw or lift; this is only the fallback
    impulse('hugo', kind === 'throw'
      ? { ex: 'throw', stop: true, gesture: { name: 'throw', dur: 1.1, windup: .5, side, amp: .7 + .6 * clamp(p.aro + Math.max(0, -p.aff)) } }
      : { ex: 'lift', stop: true, gesture: { name: 'lift', dur: 1.1, windup: 0, side, amp: 1 } });
  }
  function letGo(kind) {
    const B = S.body.dove; if (B.heldBy !== 'hugo') return;
    const h = getH(), d = getD(), side = h && d ? sgn(d.x - h.x) || 1 : 1, p = S.pt.hd;
    const force = kind === 'throw' ? clamp(.35 + .5 * Math.max(0, -p.aff) + .35 * p.aro) : 0;
    B.heldBy = null; B.heldUntil = 0; B.releasing = null; B.holdKind = null;
    B.release = { kind, t: S.t, vx: kind === 'throw' ? side * (420 + 700 * force) : side * 90, vy: kind === 'throw' ? -(200 + 420 * force) : -240 };
    ev('hugo', kind === 'throw' ? 'threw' : 'released', 'dove', kind === 'throw' ? .2 + .5 * force : .1, { lift: kind === 'lift' ? 1 : 0, force });
  }
  // A play signal from one side; the other reads it only if it is close and looking, and answers from its own utility.
  function metaSignals(lead) {
    const ph = S.ph; lead = lead || (ph ? ph.lead : 'hugo'); const o = OTHER[lead];
    if (lead === 'hugo') impulse('hugo', { ex: 'play_bow', stop: true, gesture: { name: rnd() < .6 ? 'bow' : 'dance', dur: 1.4, windup: 0, side: 1, amp: 1 }, meta: 1 });
    else impulse('dove', { ex: 'play_bow', do: 'hop_back', dur: 1.2, meta: 1 });
    const c = ctx(o);
    if (c.has && c.dist < 300 && (o === 'dove' ? c.facing : c.gaze)) S.frameRead[o] = clamp(S.frameRead[o] + .3);
    S.boost[o].play_bow = { v: .5, until: S.t + 6 };
  }
  function frameBreak(recv, why) {
    const ph = S.ph; if (!ph || ph.frame !== 'play') return;
    ph.frame = 'serious'; ph.wasPlay = true; ph.frameBreak = true; if (why === 'misread') ph.misread = true;
    S.frameRead.hugo = S.frameRead.dove = .1;
    S.pt.hd.aro = clamp(S.pt.hd.aro + .3); S.pt.dh.aro = clamp(S.pt.dh.aro + .3);
    const p = S.pt[PT[recv]], m = p.dom + S.conf[recv] > 0 ? 'antag' : 'avoid';
    S.nudge[recv][m] = { v: .2, until: S.t + 20 };
    ev(null, 'frameBreak', null, .4, { why, recv });
    bend('frameBreak');
  }

  // ---------------------------------------------------------------- 9. events
  const STIM = { approach: 'approach', bid: 'wave', display: 'wave', chased: 'chase', swatHit: 'swat', swatMiss: 'swat', strikeApex: 'swat', peckHit: 'peck', nearMiss: 'approach',
    diveHit: 'dive', diveMiss: 'dive', caught: 'grab', grabbed: 'grab', pounceLand: 'grab' };
  const HIT = new Set(['swatHit', 'peckHit', 'diveHit', 'caught']);
  const VIS_REL = new Set(['released', 'dropped', 'tossed']);
  function logEv(a, v, b, sev, data) {
    const h = getH(), L = S.log;
    L.push({ t: S.t, a, v, b, sev, x: data.x != null ? data.x : h ? h.x : 0, y: data.y != null ? data.y : h ? h.y : 0, ph: S.ph ? S.ph.n : 0, ex: a && S.cur[a] ? S.cur[a].ex : null });
    if (L.length > 360) L.splice(0, L.length - 300);
  }
  function ev(a, v, b, sev = .3, data = {}) {
    if (!S || !v) return;
    sev = clamp(+sev || 0, 0, .8); data = data || {};
    if (APEX[v]) { logEv(a, v, b, 0, data); return resolve(APEX[v], a, b, data); }
    logEv(a, v, b, sev, data);
    if (/^(pickedUp|threw|swatHit|peckHit|diveHit|caught)$/.test(v) || (v === 'released' && data.lift)) tally(v === 'released' ? 'lifted' : v);
    const ph = S.ph;
    if (ph) { const k = (a || 'n') + ':' + v; ph.c[k] = (ph.c[k] || 0) + 1; }
    const isAg = w => w === 'hugo' || w === 'dove';
    // tension and habituation
    const st = STIM[v], s1 = isAg(b) && st ? sev * (1 - S.M.hab[b][st]) : sev;
    const felt = !data.quiet && sev >= .15;
    if (felt && isAg(a) && a !== b) S.tens[a] = clamp(S.tens[a] + .25 * sev);
    if (felt && isAg(b)) {
      S.tens[b] = clamp(S.tens[b] + .5 * s1);
      if (st) {
        const H = S.M.hab[b];
        if (sev < .4) H[st] += .08 * (1 - H[st]);
        else if (sev > .6) { for (const k in H) H[k] *= .6; S.pt[PT[b]].aro = clamp(S.pt[PT[b]].aro + .3); }
      }
    }
    const before = { hd: { ...S.pt.hd }, dh: { ...S.pt.dh } };
    forces(a, v, b, sev, s1, data);
    if (ph && v !== 'frameBreak') {
      let dmax = 0; for (const X of ['hd', 'dh']) dmax = Math.max(dmax, Math.hypot(S.pt[X].aff - before[X].aff, S.pt[X].dom - before[X].dom));
      if (dmax > .35) bend('event:' + v);
    }
    if (ph && (HIT.has(v) || v === 'roleFlip' || v === 'frameBreak' || v === 'fed' || (v === 'display' && a === 'dove' && data.clap))) ph.gist = true;
    if (!ph && (HIT.has(v) || v === 'grabbed' || v === 'fell' || (v === 'landedNear' && data.byVisitor))) S.pendTrig = { a, b, v };
  }
  let CNT = {};   // contact tallies for the sim's report
  const tally = k => { CNT[k] = (CNT[k] || 0) + 1; };
  function bumpPt(who, daff, ddom, daro) {
    const p = S.pt[PT[who]]; p.aff = clamp(p.aff + (daff || 0), -1, 1); p.dom = clamp(p.dom + (ddom || 0), -1, 1); p.aro = clamp(p.aro + (daro || 0));
  }
  function forces(a, v, b, sev, s, data) {
    const ph = S.ph, isAg = w => w === 'hugo' || w === 'dove';
    switch (v) {
      case 'swatHit': {
        const up = S.conf[b] > .2 && S.P[b].aggr > .5;
        bumpPt(b, -.25 * s, up ? .1 * s : -.15 * s, .5 * s); bumpPt(a, 0, .1 * s, 0); S.conf[a] = clamp(S.conf[a] + .1 * s, -1, 1);
        addFact('swatted', a, b, -.35 * sev / .5, 8); break;
      }
      case 'peckHit': case 'diveHit':
        bumpPt(b, -.15 * s, 0, .35 * s); bumpPt(a, 0, .1 * s, 0); S.conf[a] = clamp(S.conf[a] + .1 * s, -1, 1);
        addFact(v === 'peckHit' ? 'pecked' : 'divebombed', a, b, v === 'peckHit' ? -.25 : -.3, 6);
        if (v === 'peckHit' && data.slap && S.body.dove.heldBy === 'hugo') { S.body.dove.heldBy = null; S.body.dove.heldUntil = 0; ev('hugo', 'released', 'dove', .1, { slap: 1 }); }
        break;
      case 'caught':
        bumpPt(b, -.2 * s, 0, .4 * s); S.conf[a] = clamp(S.conf[a] + .05 * s, -1, 1);
        if (data.play && sev < .2) addFact('heldGently', a, b, .12, 4); else addFact('caughtRough', a, b, -.2, 6);
        break;
      case 'fed': {   // a: the eater, b: who put the food there (if anyone)
        const eater = isAg(a) ? a : 'dove', feeder = isAg(b) && b !== eater ? b : null;
        if (data.frac == null && S.crumb) bite(eater, S.crumb, 1, true);   // eaten whole (the sim's toy bodies)
        bumpPt(eater, .08 * Math.max(s, .5), 0, 0);
        if (feeder) { addFact('fed', feeder, eater, .15, 4); S.M.famil = clamp(S.M.famil + .02); }   // feeding builds trust
        if (ph) { ph.fed = (ph.fed || 0) + 1; if (data.steal) ph.stole = true; }
        break;
      }
      case 'forage': S.drv.dove.hunger = clamp(S.drv.dove.hunger - .05); break;   // a word is not a meal
      case 'drop': if (data.x != null) dropFood(a, data); break;
      case 'nearMiss': bumpPt('hugo', 0, 0, .15 * sev / .3); bumpPt('dove', 0, 0, .15 * sev / .3);
        if (isAg(b)) S.frameRead[b] = clamp(S.frameRead[b] + (ph && ph.frame === 'play' ? .1 : -.15)); break;
      case 'ignored': if (isAg(b)) { bumpPt(b, -.03, 0, 0); S.bid[b].answered += .25 * (.5 - S.bid[b].answered); } break;
      case 'answered': if (isAg(b)) S.bid[b].answered += .25 * (1 - S.bid[b].answered); break;
      case 'displaced': if (isAg(a) && isAg(b)) {
        S.conf[b] = clamp(S.conf[b] - .1, -1, 1); bumpPt(b, 0, -.1, 0); S.conf[a] = clamp(S.conf[a] + .1, -1, 1); bumpPt(a, 0, .1, 0);
        const k = S.inKey[b] && S.inKey[b].key; if (k) S.M.own[k] = { who: a, since: S.t };
        addFact('wonSpot', b, a, .1, 3); addFact('lostSpot', a, b, -.1, 3);
        if (ph) { ph.displaced = ph.displaced || {}; ph.displaced[a] = S.t; }
      } break;
      case 'reconciled': bumpPt('hugo', .12, 0, 0); bumpPt('dove', .12, 0, 0);
        if (isAg(a) && isAg(b)) { addFact('reconciled', a, b, .2, 5); addFact('reconciled', b, a, .2, 5); }
        if (ph) ph.repaired = true; break;
      case 'seenYou': S.I.hugo.prey *= .85; break;
      case 'fell': S.fellAt = S.t; S.fellSev = sev; if (ph) { ph.fellT = S.t; ph.fellSev = Math.max(ph.fellSev || 0, sev); } break;
      case 'released': if (a === 'visitor') visitorRelease(v, b, sev, data);
        else if (a === 'hugo' && b === 'dove' && data.lift) { bumpPt('dove', .06, 0, -.1); addFact('heldGently', 'hugo', 'dove', .14, 4); }
        else if (a === 'hugo' && b === 'dove' && !data.slap) impulse('dove', { ex: 'flee', do: 'flee', panic: ctx('dove').fear > .6 }); break;
      case 'throwApex': if (S.body.dove.releasing && S.body.dove.releasing.kind === 'throw') letGo('throw'); break;
      case 'liftApex': if (S.body.dove.releasing && S.body.dove.releasing.kind === 'lift') letGo('lift'); break;
      case 'pickedUp': bumpPt('dove', 0, -.08, .25); S.conf.hugo = clamp(S.conf.hugo + .05, -1, 1); if (ph) ph.held = (ph.held || 0) + 1; break;
      case 'threw': {
        const play = ph && ph.frame === 'play' && sev < .45, B = S.body.dove;
        bumpPt('dove', play ? -.03 : -.2 * (s || sev), -.05, .4 * sev); bumpPt('hugo', 0, .08, 0); S.conf.hugo = clamp(S.conf.hugo + .08, -1, 1);
        B.ruffled = Math.min(8, B.ruffled + 2 + 4 * sev); if (!play) B.sore = Math.min(90, B.sore + 10 + 30 * sev);
        addFact(play ? 'tossed' : 'thrown', 'hugo', 'dove', play ? -.05 : -.3 * sev / .5, play ? 3 : 7);
        if (ph) { ph.gist = true; if (!play) ph.harm.push({ a: 'hugo', b: 'dove', sev, t: S.t, kind: 'throw' }); }
        break;
      }
      case 'dropped': case 'tossed': if (a === 'visitor') visitorRelease(v, b, sev, data); break;
      case 'grabbed': if (a === 'visitor' && isAg(b)) {
        S.hold = { who: b, t0: S.t, tier: 0, by: 'visitor', stress: sev, stance: null, pivoted: false }; S.grabAt = S.t; S.cur[b] = null;
        if (b === 'dove') { const H = S.M.hab.dove; H.hold += .12 * (1 - H.hold); if (S.body.dove.heldBy === 'hugo') { S.body.dove.heldBy = null; S.body.dove.heldUntil = 0; } }
        if (ph && b === 'hugo') ph.heldHugo = true;
      } break;
      case 'roleFlip': if (ph) ph.roleFlips++; break;
      case 'landedNear': if (ph && data.ride) ph.gist = true; break;
      case 'mimicked': if (ph) ph.mimics = (ph.mimics || 0) + 1; break;
      case 'gesture': if (isAg(a) && data.name) { S.lastAct = S.lastAct || {}; S.lastAct[a] = { name: data.name, t: S.t }; } break;
      default:
    }
  }
  function visitorRelease(v, who, sev, data) {
    if (S.hold.who !== who) return;
    const H = S.hold, hs = S.t - H.t0, stress = data.stress != null ? data.stress : sev, ph = S.ph, o = OTHER[who];
    S.hold = { who: null, t0: 0, tier: 0, by: 'visitor', stress: 0 }; S.lastHold[who] = S.t;
    if (ph) ph.lastRelease = S.t;
    const c = ctx(who), d = c.dist;
    if (hs < 3) {
      impulse(who, who === 'hugo' ? { ex: 'dust', stop: true, gesture: { name: 'dust', dur: 1.5, windup: 0, side: 1, amp: 1 }, look: sgn(c.dx) } : { ex: 'preen', do: 'preen_away', dur: 1.5 });
      if (ph && !ph.gist && S.cur[who]) delete S.cool[who][S.cur[who].ex];
    } else {
      if (ph) ph.frozen = false;
      S.tens[who] = clamp(S.tens[who] + .6 * stress);
      if (H.stance === 'jealous') S.boost[o].peck_at = { v: .5, until: S.t + 20, from: S.t };
    }
    const pivotNow = !H.pivoted && (hs > 10 || (v === 'tossed' && d < 150) || (who === 'dove' && hs >= 3 && d < 150));
    if (ph && pivotNow) pivot();
    // misattribution: a scared dove let go next to Hugo blames him
    if (who === 'dove' && stress > .45 && d < 200) { addFact('blame', 'hugo', 'dove', -.08 * Math.max(1, sev / .5), 3); bumpPt('dove', -.05, 0, 0); if (ph) ph.blame = true; }
    // consolation: a gentle hold of the one that just lost
    if (stress < .3 && hs >= 3 && S.loser && S.loser.who === who && S.t - S.loser.t < 60) { bumpPt(who, 0, 0, -.2); S.I[who].antag = clamp(S.I[who].antag - .2); if (ph) ph.consoled = true; }
    // training
    const lastC = S.body[o].lastHit && S.body[o].lastHit.by === who && S.t - S.contactAt[o] < 4;
    const W = S.M.W[who], cl = x => clamp(x, .5, 1.5);
    if ((v === 'tossed' || (v === 'dropped' && stress > .45)) && lastC && S.lastAct && S.lastAct[who]) { const ex = S.body[o].lastHit.kind === 'swat' ? 'swat' : S.body[o].lastHit.kind === 'pounce' ? 'pounce' : S.body[o].lastHit.kind === 'dive' ? 'dive_bomb' : 'peck_at'; W[ex] = cl((W[ex] || 1) * .9); }
    if (v === 'released' && stress < .45 && d < 100) {
      for (const ex of ['approach', 'sit_with', 'groom', 'offer']) W[ex] = cl((W[ex] || 1) * 1.05);
      ev('visitor', 'landedNear', who, .1, { byVisitor: 1 });
    }
  }
  function pivot() {
    const ph = S.ph; if (!ph) return; S.hold.pivoted = true;
    if (ph.pivots < 1 && ph.bends < 2) { ph.pivots++; bend('visitor', S.story.J0 * 3); if (S.grabAt > S.t - 30) ph.object = { kind: 'visitor', key: null, x: 0, y: 0 }; }
    else if (ph.stage === 'build' || ph.stage === 'peak') { ph.stage = 'fade'; ph.stageT0 = S.t; ph.cause = 'visitor-grab'; }
  }
  // ---------------------------------------------------------------- 9b. food: a smart object with a life cycle
  // HELD (in Hugo's hand; the bird can only beg) -> DROPPED (falls, bounces and settles on a real ledge, page coords)
  // -> PECKED (each peck knocks 2-4 crumbs loose; Hugo takes 25-35% bites) -> STALE (untouched 60-90 s: half the pull,
  // duller) -> GONE (a fade). One fresh item at a time; Hugo finds the next one 20-60 s later. Each item advertises
  // value x 1/(1+(d/R)^2); eaters score it through a hunger curve with meal hysteresis (on at .6, off at .2).
  const edible = it => !!it && it.st !== 'held' && it.st !== 'gone' && it.n >= .02 && (it.settled || !!SIM);
  function mkFood(by, x, y, st, main, n) {
    return { id: ++S.foodIds, by, x, y, vx: 0, vy: 0, st, main: !!main, n: n == null ? 1 : n, t0: S.t, touched: S.t, life: SIM ? 30 : U(60, 90),
      settled: !!SIM, ledge: null, el: null, owner: null, ownUntil: 0, holder: null, fedBy: {} };
  }
  function syncCrumb() { S.crumb = S.food.find(it => it.main && edible(it)) || S.food.find(edible) || null; }
  function release(it, x, y, vx) { it.st = 'dropped'; it.holder = null; it.x = x; it.y = y - 2; it.vx = vx || 0; it.vy = -40; it.settled = !!SIM; it.touched = S.t; physKick(); }
  function dropFood(a, data) {
    const held = S.food.find(it => it.st === 'held');
    if (held) return release(held, data.x, data.hy != null ? data.hy : data.y, data.vx);
    if (S.food.some(it => it.main && it.st !== 'gone')) return;   // one fresh item at a time
    S.food.push(mkFood(a === 'hugo' ? 'hugo' : 'stage', data.x, (data.hy != null ? data.hy : data.y) - (SIM ? 0 : 2), 'dropped', true)); syncCrumb(); physKick();
  }
  function advertBest(who) {
    const a = who === 'hugo' ? getH() : getD(); let item = null, adv = 0;
    if (!a || !S.food.length) return { item, adv };
    const R = (DOM && G.innerWidth < 760 ? 120 : 200) * (SIM ? 1 : 1 + 2 * S.drv[who].hunger), blk = S.block[who];   // hunger widens the search (the sim keeps the plain falloff)
    for (const it of S.food) {
      if (!edible(it) || (blk[it.id] || 0) > S.t || (who === 'hugo' && !SIM && !it.ledge)) continue;   // he walks: only food lying on a floor
      const d = Math.hypot(it.x - a.x, it.y - a.y), v = (.4 + .6 * it.n) * (it.st === 'stale' ? .5 : 1) / (1 + (d / R) ** 2);   // even a crumb is worth a peck
      if (v > adv) { adv = v; item = it; }
    }
    return { item, adv: Math.min(1, adv) };
  }
  // How much `who` wants to eat right now, and what. Considerations multiply (any zero vetoes): hunger x advert x fear x possession.
  function eatU(who) {
    const D = S.drv[who];
    if (D.hunger >= .6) S.meal[who] = true; else if (D.hunger <= .2) S.meal[who] = false;
    if (!S.meal[who]) return null;
    const hU = clamp(.3 + D.hunger);
    const held = S.food.find(it => it.st === 'held' && it.holder === who);
    if (held) return { u: hU, item: held, held: true };
    const { item, adv } = advertBest(who); if (!item) return null;
    const h = getH(), c = ctx(who); let veto = 1, steal = false;
    if (who === 'dove' && h) {
      const near = Math.hypot(item.x - h.x, item.y - h.y) < 160;
      if (near) veto *= 1 - .8 * c.fear;
      if (near && S.t < S.guardUntil && c.gaze) veto *= .4;   // he is guarding it and looking
      steal = near && (c.aff < .1 || (c.gaze && c.fear > .3));
    }
    if (item.owner && item.owner !== who && S.t < item.ownUntil) veto *= .3;   // someone got there first: a 2-3 s possession window
    return { u: hU * adv * veto, item, steal };
  }
  function bite(who, it, frac, quiet) {
    if (!it || it.st === 'gone' || (it.st === 'held' && it.holder !== who)) return 0;
    const take = Math.min(it.n, frac); if (take <= 0) return 0;
    const stale = it.st === 'stale', food = take * (stale ? .5 : 1);
    it.n -= take; it.touched = S.t; if (it.st === 'dropped') it.st = 'pecked';
    const D = S.drv[who];
    D.hunger = clamp(D.hunger - food * (who === 'dove' ? 2.2 : 1.2));
    S.dig[who] += food * .6; S.fedOut[who] += food;   // digested into energy over the next seconds
    if (G.MORTAL && !SIM) G.MORTAL.progress(who, 'ate');
    if (!it.owner || S.t > it.ownUntil || it.owner === who) { it.owner = who; it.ownUntil = S.t + 2.5; }
    if (who === 'dove' && it.n > .15 && !SIM) {   // the peck knocks crumbs loose
      const k = 2 + ((rnd() * 3) | 0);
      for (let i = 0; i < k && S.food.length < 9; i++) {
        const n = Math.min(.05, (it.n - .1) / k); if (n < .02) break;
        it.n -= n; const cr = mkFood(it.by, it.x, it.y - 3, 'pecked', false, n); cr.vx = U(-70, 70); cr.vy = U(-160, -90); cr.settled = false; S.food.push(cr);
      }
      physKick();
    }
    if (it.n < .02) it.st = 'gone';
    if (!quiet && !it.fedBy[who]) {   // the first bite of a meal is the relational event
      it.fedBy[who] = 1;
      const h = getH(), byHugo = it.by === 'hugo' && who === 'dove';
      ev(who, 'fed', it.by === 'hugo' && who !== 'hugo' ? 'hugo' : null, .2, { frac: take, steal: byHugo && h && Math.hypot(h.x - it.x, h.y - it.y) < 160 && S.meal.hugo ? 1 : 0 });
      if (byHugo && h && S.meal.hugo && Math.hypot(h.x - it.x, h.y - it.y) < 160) {   // producer-scrounger: a hungry Hugo shares, guards or chases
        const P = S.P.hugo, ch = ctx('hugo');
        if (P.aggr > .55 && ch.aff < .4) S.boost.hugo.chase = { v: .6, until: S.t + 8 };
        else if (ch.dom > 0 || P.aggr > .35) { S.guardUntil = S.t + 5; S.boost.hugo.guard_spot = { v: .6, until: S.t + 6 }; }
        else ev('hugo', 'answered', 'dove', .1);
      }
    }
    syncCrumb();
    return food;
  }
  function foodStep(dt) {
    for (const it of S.food) {
      if (it.st === 'held') { it.touched = S.t; continue; }
      if (SIM) { if (S.t - it.t0 > 90) it.st = 'gone'; continue; }
      if (it.st !== 'gone' && it.st !== 'stale' && S.t - it.touched > it.life) it.st = 'stale';
      else if (it.st === 'stale' && S.t - it.touched > it.life + 60) it.st = 'gone';
    }
    for (let i = S.food.length - 1; i >= 0; i--) { const it = S.food[i]; if (it.st === 'gone' && (!it.el || it.faded)) { if (it.main) S.nextFood = S.t + U(20, 60); S.food.splice(i, 1); } }
    syncCrumb();
    if (SIM) return;
    const h = getH();
    // Hugo is the producer: he comes up with the next one and holds it
    if (h && !S.food.some(it => it.main) && S.t > S.nextFood && h.floor && !h.held && !h.air && !h.dead) {
      S.food.push(Object.assign(mkFood('hugo', h.x, h.y, 'held', true), { holder: 'hugo', heldAt: S.t, holdFor: 6 + 14 * S.P.hugo.patience })); physKick();
    }
    const held = S.food.find(it => it.st === 'held');
    if (held) {
      if (!h || h.held || h.air || h.dead) release(held, held.x, held.y);
      else if (!S.meal.hugo) {   // not hungry: share it with the bird if he likes it, else set it down after a while
        const c = ctx('hugo');
        if (c.has && c.dist < 320 && c.aff > .1) S.boost.hugo.offer = { v: .7, until: S.t + 3 };
        if (S.t - held.heldAt > held.holdFor) release(held, h.x + (h.dir || 1) * 20, h.y - 10);
      }
    }
    if ((S.rideAt += dt) >= 1) {   // settled food rides its ledge as the page reflows (one rect read per item a second)
      S.rideAt = 0;
      for (const it of S.food) {
        const L = it.ledge; if (!it.settled || !L || !L.el) continue;
        const r = L.el.isConnected ? L.el.getBoundingClientRect() : null;
        if (!r || !r.height) { it.settled = false; it.ledge = null; physKick(); continue; }
        it.y = r.top + scrollY + L.dy;
      }
    }
  }
  // Fixed-step physics while anything is in the air or in a hand: gravity, bounce (restitution .4), rolling friction,
  // sleep when slow. The colliders are the top edges of the ledges Hugo already scans.
  let physRAF = 0, physLast = 0, physAcc = 0;
  function physKick() { if (!physRAF && DOM && !SIM && G.requestAnimationFrame) { physLast = performance.now(); physAcc = 0; physRAF = requestAnimationFrame(physFrame); } }
  function physFrame(tm) {
    physRAF = 0; if (!S) return;
    physAcc += Math.min(.1, (tm - physLast) / 1000); physLast = tm;
    const fl = G.__hugoFloors ? G.__hugoFloors() : [], H = 1 / 60;
    for (; physAcc >= H; physAcc -= H) for (const it of S.food) if (!it.settled && it.st !== 'held' && it.st !== 'gone') physStep(it, H, fl);
    renderFood();
    if (S.food.some(it => it.st === 'held' || (!it.settled && it.st !== 'gone'))) physRAF = requestAnimationFrame(physFrame);
  }
  function physStep(it, H, fl) {
    const py = it.y; it.vy += 1400 * H; it.x += it.vx * H; it.y += it.vy * H;
    let f = null;
    for (const q of fl) if (q.support !== false && it.x >= q.x1 && it.x <= q.x2 && py <= q.y + .5 && it.y >= q.y && (!f || q.y < f.y)) f = q;
    if (f) {
      it.y = f.y;
      if (it.vy > 80) { it.vy = -it.vy * .4; it.vx *= .7; }
      else {
        it.vy = 0; it.vx *= Math.max(0, 1 - 8 * H);
        if (Math.abs(it.vx) < 6) {   // asleep on this ledge: remember which one, so it rides it
          it.settled = true; it.vx = 0; it.touched = S.t;
          let dy = 0; try { dy = f.y - (f.el.getBoundingClientRect().top + scrollY); } catch (e) { dy = 0; }
          it.ledge = f.el && !f.fr && !f.ground ? { el: f.el, dy, x1: f.x1, x2: f.x2, y: f.y, text: !!f.text } : { el: null, dy: 0, x1: f.x1, x2: f.x2, y: f.y, ground: !!f.ground };
        }
      }
    }
    if (it.y > document.documentElement.scrollHeight + 300) it.st = 'gone';
  }
  function renderFood() {
    if (!DOM || SIM) return;
    const L = document.getElementById('agent-layer'); if (!L) return;
    const h = getH();
    for (const it of S.food) {
      if (it.st === 'held' && h && h.hand) { it.x = h.hand.x; it.y = h.hand.y + 4; }
      if (!it.el) {
        if (it.st === 'gone') { it.faded = true; continue; }
        it.el = L.appendChild(Object.assign(document.createElement('i'), { className: 'rel-crumb' }));
        Object.assign(it.el.style, { position: 'absolute', left: 0, top: 0, borderRadius: '50%', pointerEvents: 'none', transition: 'opacity .6s, background-color 1.5s', willChange: 'transform' });
      }
      const s = Math.max(3, Math.round(3 + 5 * Math.sqrt(it.n)));
      if (it.sz !== s) { it.sz = s; it.el.style.width = it.el.style.height = s + 'px'; }
      it.el.style.background = it.st === 'stale' ? '#8F846E' : '#C9A86A';
      it.el.style.transform = `translate(${(it.x - s / 2).toFixed(1)}px,${(it.y - s).toFixed(1)}px)`;
      if (it.st === 'gone' && !it.fading) { it.fading = true; it.el.style.opacity = 0; setTimeout(() => { try { it.el.remove(); } catch (e) { /* gone */ } it.faded = true; }, 650); }
    }
  }

  // ---------------------------------------------------------------- 10. phase
  const DISP_Z = new Set(['W', 'WD', 'WS', 'D', 'HD']);
  function salience() { let s = 0; for (let i = S.log.length - 1; i >= 0 && S.log[i].t > S.t - 60; i--) if (S.log[i].a !== 'mind') s = Math.max(s, S.log[i].sev); return s; }
  function target(n) {
    const st = S.story;
    if (st.kind === 'rising') return st.cool ? .35 : .35 + .45 * Math.min(1, n / 6);
    if (st.kind === 'calm') return .3 + .1 * Math.sin(n);
    return st.rt != null ? st.rt : (st.rt = U(.2, .95));
  }
  function pushes() {
    const P = { hd: { aff: 0, dom: 0, aro: 0 }, dh: { aff: 0, dom: 0, aro: 0 } }, add = (X, a, d, r) => { P[X].aff += a; P[X].dom += d; P[X].aro += r || 0; };
    const last = S.last;
    if (grudge('dove') > .2) add('dh', -.3, .3 * (S.conf.dove >= 0 ? 1 : -1));
    if (grudge('hugo') > .2) add('hd', -.2, .2 * (S.conf.hugo >= 0 ? 1 : -1));
    if (last && last.fed >= 2) add('dh', .3, -.2);
    if (S.drv.hugo.lonely > .5 || S.drv.dove.lonely > .5) { add('hd', .15, 0, .2); add('dh', .15, 0, .2); }
    if (S.drv.hugo.boredom > .6 && S.P.hugo.aggr > .5) add('hd', -.15, .3);
    if (sore01('dove') > .3) add('dh', -.2, S.P.dove.aggr > .6 ? .2 : -.3);
    if (last && last.outcome === 'rupture') { const v = (trust('dove') + trust('hugo')) / 2 * S.M.famil + .2; add('hd', .25 * v, 0); add('dh', .25 * v, 0); }
    if (last && last.cause === 'visitor-grab') { add('hd', .14, .14); add('dh', .14, -.14); }
    if (last && last.unfinished) { const pr = PRESETS.find(p => p.label === last.unfinished); if (pr) for (const X of ['hd', 'dh']) { const p = S.pt[X], a = pr[X], dx = a[0] - p.aff, dy = a[1] - p.dom, n = Math.hypot(dx, dy) || 1; add(X, .25 * dx / n, .25 * dy / n); } }
    return P;
  }
  function stressMax() { const h = getH(), d = getD(); return Math.max(clamp(+(h && h.stress) || 0), clamp(+(d && d.stress) || 0)); }
  function objectNow(c) {
    for (const k in S.M.own) { const o = S.M.own[k], other = OTHER[o.who], ok = S.inKey[other] && S.inKey[other].key; if (ok === k || (c.contested && c.dist < 200)) return { kind: 'spot', key: k, x: 0, y: 0 }; }
    if (S.crumb) return { kind: 'crumb', key: null, x: S.crumb.x, y: S.crumb.y };
    if (S.t - S.grabAt <= 30) return { kind: 'visitor', key: null, x: 0, y: 0 };
    return { kind: 'none', key: null, x: 0, y: 0 };
  }
  function planned(c) { return `${FR[c.frame]}${ZH[c.zh]} Hugo × ${ZD[c.zd]} dove`; }
  function sample(Kn, jumpAbs) {
    const sal = salience(), jump = jumpAbs || S.story.J0 * (1 + 2 * sal), push = pushes(), cH = ctx('hugo'), cD = ctx('dove');
    const n = S.story.n + 1, tgt = target(n), bored = (S.drv.hugo.boredom + S.drv.dove.boredom) / 2, stress = stressMax();
    let pre = 1; if (grudge('dove') > .3 || grudge('hugo') > .3) pre++; if (Object.keys(S.M.own).length) pre++; if (S.t - S.grabAt <= 30) pre++;
    if (S.last && S.last.fed >= 2) pre++; if (S.t - S.fellAt <= 30) pre++; if (S.last && S.last.outcome === 'rupture') pre++;
    const obj = objectNow(cH), out = [];
    for (let i = 0; i < Kn; i++) {
      const c = { hd: null, dh: null };
      let dist2 = 0;
      for (const X of ['hd', 'dh']) {
        const p = S.pt[X], q = push[X];
        const a = clamp(p.aff + jump * gauss() + q.aff, -1, 1), dm = clamp(p.dom + jump * gauss() + q.dom, -1, 1);
        c[X] = { aff: a, dom: dm, aro: clamp(p.aro + .3 * gauss() + q.aro) };
        dist2 += (a - p.aff) ** 2 + (dm - p.dom) ** 2;
      }
      c.zh = zone(c.hd); c.zd = zone(c.dh);
      const hot = z => z === 'H' || z === 'HS';
      const pPlay = hot(c.zh) || hot(c.zd) ? 0 : sigm(4 * (Math.min(c.hd.aff, c.dh.aff) + K.playOff + .4 * bored - stress));
      const pDisp = DISP_Z.has(c.zh) || DISP_Z.has(c.zd) ? sigm(5 * (Math.max(c.hd.aff * c.hd.dom, c.dh.aff * c.dh.dom) - K.dispOff) + 2 * (cH.visitorNear || cD.visitorNear ? 1 : 0)) : 0;
      c.frame = rnd() < pPlay ? 'play' : rnd() < pDisp ? 'display' : 'serious';
      c.object = obj;
      c.mot = { hugo: impliedMotive('hugo', c.hd, c.frame, obj.kind), dove: impliedMotive('dove', c.dh, c.frame, obj.kind) };
      const act = w => (c.mot[w] === 'avoid' || c.mot[w] === 'ignore' ? 0 : S.I[w][c.mot[w]] + .25 * rnd() + .2 * Math.hypot(c[PT[w]].aff, c[PT[w]].dom));
      const aH = act('hugo'), aD = act('dove');
      c.lead = aH === aD ? (rnd() < .5 ? 'hugo' : 'dove') : aH > aD ? 'hugo' : 'dove';
      if (c.mot[c.lead] === 'avoid' || c.mot[c.lead] === 'ignore') c.lead = rnd() < .5 ? 'hugo' : 'dove';
      c.boss = Math.max(c.hd.aro, c.dh.aro) >= .75 && (c.zh === 'HD' || c.zh === 'H' || c.zd === 'HD' || c.zd === 'H');
      c.E = c.boss ? .9 : .4 + .5 * Math.max(Math.abs(c.hd.aff), Math.abs(c.dh.aff)) * Math.max(c.hd.aro, c.dh.aro);
      const fit = 1 - Math.abs(c.E - tgt);
      let nov = 1;
      const H = S.M.history;
      for (let j = 0; j < H.length; j++) {
        const hj = H[H.length - 1 - j], same = hj.zh === c.zh && hj.zd === c.zd;
        const sim = same && hj.frame === c.frame ? 1 : same ? .5 : hj.zh === c.zh || hj.zd === c.zd ? .25 : 0;
        nov *= 1 - .6 * sim * Math.pow(.8, j);
      }
      const plaus = Math.exp(-dist2 / (2 * K.plaus * jump * jump));
      const temper = S.story.kind === 'calm' ? 1.2 - c.E : 1;
      c.score = Math.max(.05, pre * fit * nov * plaus * temper) * (c.boss && (S.story.bossCool > 0 || S.gentle) ? 0 : 1);
      c.name = planned(c);
      out.push(c);
    }
    return out;
  }
  function weighted(cands) {
    let tot = 0; for (const c of cands) tot += c.score * c.score;
    if (tot <= 0) return cands[0];
    let r = rnd() * tot; for (const c of cands) { r -= c.score * c.score; if (r <= 0) return c; }
    return cands[cands.length - 1];
  }
  function trig(c, cx) {
    const d = cx.dist, L = c.lead, o = OTHER[L];
    if (!cx.has) return false;
    switch (c.mot[L]) {
      case 'approach': case 'care': return d < 250 || (!S.cur[L] && S.relaxT > 30);
      case 'prey': return L === 'hugo' ? cx.reach && d < 400 : d < 300 || !!S.crumb;
      case 'antag': return d < 250;
      case 'own': return d < 220;
      case 'play': return d < 400 && (S.t - S.lastShow.hugo < 3 || S.t - S.lastShow.dove < 3 || Math.abs(cx.vH) > 30 || (cx.d && cx.d.mode === 'fly'));
      case 'display': return d < 320;
      case 'mimic': return d < 300 && S.t - S.lastShow[o] <= 3;
      case 'inspect': case 'ignore': return S.viewT >= 10 && S.relaxT > 20;
      case 'avoid': return d < 1.5 * cx.fid;
      default: return false;
    }
  }
  function armTick(dt) {
    if (S.forced) { const F = S.forced; if (!F.loop) S.forced = null; else S.forced = { ...F }; commit(forcedCand(F), 'forced'); return; }
    S.relaxT += dt;
    const both = inView('hugo') && inView('dove');
    S.viewT = both ? S.viewT + dt : 0;
    if (S.relaxT < S.relaxMin) { S.pendTrig = null; return; }
    if (S.t >= S.armAt || !S.armed.length) { S.armed = sample(16).sort((a, b) => b.score - a.score).slice(0, 3); S.armAt = S.t + 5; }
    if (!both) return;
    const cx = S.c1 || ctx('hugo');
    if (S.pendTrig) {
      const P = S.pendTrig; S.pendTrig = null;
      const m = S.armed.filter(c => c.lead === P.a || c.lead === P.b);
      if (m.length) return commit(weighted(m), P.v);
    }
    const fired = S.armed.filter(c => trig(c, cx));
    if (fired.length) return commit(weighted(fired), 'trigger:' + fired[0].mot[fired[0].lead]);
    if (S.relaxT > 45 && !S.stagedDone) { S.stagedDone = true; stage(); }
    if (S.relaxT > 90) commit(weighted(S.armed), 'lull');
  }
  // Staged opportunity: the drive nearest its threshold gets a chance to act (a crumb, a sit, a visit).
  function stage() {
    const h = getH(), d = getD(); if (!h || !d) return;
    const hun = S.drv.dove.hunger / .6, lon = Math.max(S.drv.hugo.lonely, S.drv.dove.lonely) / .5, bor = Math.max(S.drv.hugo.boredom, S.drv.dove.boredom) / .6;
    if (hun >= lon && hun >= bor) { if (!S.crumb && (h.floor || SIM)) ev(null, 'drop', 'dove', 0, { x: h.x + U(-60, 60), y: h.y }); if (S.crumb) S.crumb.by = 'stage'; }
    else if (lon >= bor) S.staged = { who: 'hugo', ex: 'sit_with', exp: S.t + 20 };
    else S.staged = { who: 'dove', ex: 'approach', gap: U(160, 220), exp: S.t + 20 };
  }
  function forcedCand(F) {
    const pr = F.preset, mk = a => ({ aff: a[0], dom: a[1], aro: a[2] });
    const c = { hd: mk(pr.hd), dh: mk(pr.dh), frame: pr.frame, lead: pr.lead === 'either' ? (rnd() < .5 ? 'hugo' : 'dove') : pr.lead, boss: !!pr.boss };
    c.zh = zone(c.hd); c.zd = zone(c.dh); c.object = { kind: pr.obj || 'none', key: null, x: 0, y: 0 };
    c.mot = { hugo: impliedMotive('hugo', c.hd, c.frame, c.object.kind), dove: impliedMotive('dove', c.dh, c.frame, c.object.kind) };
    c.E = c.boss ? .9 : .4 + .5 * Math.max(Math.abs(c.hd.aff), Math.abs(c.dh.aff)) * Math.max(c.hd.aro, c.dh.aro);
    c.score = 1; c.name = pr.label; c.forced = pr.slug;
    return c;
  }
  function commit(c, cause) {
    const st = S.story;
    let dur = U(185, 235) + (st.kind === 'calm' ? 10 : st.kind === 'rising' ? -5 : 0);
    st.n++;
    if (c.boss) st.bossCool = 3; else st.bossCool--;
    S.ph = {
      n: st.n, sig0: `${c.zh}/${c.zd}/${c.frame}`, zh0: c.zh, zd0: c.zd, lead: c.lead, frame: c.frame, frame0: c.frame, object: c.object,
      anchor: { hd: { ...c.hd }, dh: { ...c.dh } }, band: clamp(c.E, .25, 1), boss: c.boss, t0: S.t, dur, stage: 'build', stageT0: S.t,
      frozen: false, gist: false, pivots: 0, bends: 0, contacts: 0, roleFlips: 0, chaser: c.lead, chaseT: 0, segLen: U(8, 16),
      maxT: 0, harm: [], repaired: false, consoled: false, sepT: U(25, 60), offFor: 0, exSeq: [], cause, label: null, outcome: null,
      mot: c.mot, x: {}, c: {}, init: [], chaseSegs: 0, misses: 0, deadline: false, ladderTop: false, hint: null, extraPeak: false,
      pk: { hd: [0, 0, 0], dh: [0, 0, 0], w: 0 }, bk: { hd: [0, 0, 0], dh: [0, 0, 0], w: 0 }, ia: o0(MOT), coT: 0, nearT: 0, rideT: 0, maxAro: 0,
      lastContact: -1e9, name0: c.name, forced: c.forced || null, startGrudge: grudge('dove') > .3 || grudge('hugo') > .3, againstAt: -1e9,
    };
    S.armed = []; S.staged = null;
    logEv(null, 'phase', null, 0, { cause });
    if (c.frame === 'play') metaSignals(c.lead);
  }
  function accPts(A, dt) { for (const X of ['hd', 'dh']) { const p = S.pt[X]; A[X][0] += p.aff * dt; A[X][1] += p.dom * dt; A[X][2] += p.aro * dt; } A.w += dt; }
  function setStage(s) { S.ph.stage = s; S.ph.stageT0 = S.t; }
  function settled() {
    const h = getH(), d = getD(); if (!h || !d) return true;
    return (!h.air && !h.held && h.mode !== 'climb') && (d.mode === 'perch' || !inView('dove'));
  }
  function stageTick(dt) {
    const ph = S.ph, el = S.t - ph.t0, u = el / ph.dur, T = Tnow(), c = S.c1 || ctx('hugo');
    ph.maxT = Math.max(ph.maxT, T);
    ph.maxAro = Math.max(ph.maxAro, S.pt.hd.aro, S.pt.dh.aro);
    if (c.dist < 300) ph.coT += dt;
    if (c.dist < 1.2 * c.fid) ph.nearT += dt;
    if (S.cur.dove && S.cur.dove.ex === 'ride' && c.dist < 60) ph.rideT += dt;
    // role swap in play chase segments
    const CH = w => S.cur[w] && (S.cur[w].ex === 'chase' || S.cur[w].ex === 'keepaway'), chasing = CH('hugo') || CH('dove');
    if (chasing) { if (S.t - (ph.chaseOn ?? -1e9) > 10) ph.chaseT = 0; ph.chaseOn = S.t; ph.chaseT += dt; }   // only time spent chasing counts; a long gap starts a new bout
    if (ph.frame === 'play' && chasing && (ph.chaseT > ph.segLen || (ph.chaseT > 2 && CH(ph.chaser) && c.dist < 50))) {   // a long chase, or the chaser catches up: tag, the other is it
      ph.chaser = OTHER[ph.chaser]; ph.chaseT = 0; ph.segLen = U(8, 16); ev(null, 'roleFlip', null, .2, { chaser: ph.chaser });
    }
    // Hugo holding the dove too long in play breaks the frame when it is scared
    if (ph.frame === 'play' && S.body.dove.heldBy === 'hugo' && S.body.dove.heldUntil - S.t < 1 && ctx('dove').fear > .4) frameBreak('dove', 'held');
    if (!inView('hugo') || !inView('dove')) ph.offFor += dt; else ph.offFor = 0;
    if (ph.offFor > ph.sepT) return close('separated');
    if (el >= 240) return close(T > .5 ? 'hardRupture' : 'hard');
    if (ph.stage === 'build' && u > .2) accPts(ph.bk, dt);
    if (ph.stage === 'peak') accPts(ph.pk, dt);
    if (ph.frozen) return;
    switch (ph.stage) {
      case 'build':
        if (T >= .85 * ph.band || ph.gist || ph.ladderTop) { setStage('peak'); break; }
        if (!ph.deadline && u >= .45 && T < .6 * ph.band) { ph.deadline = true; ph.band *= .6; stage(); }
        if (u >= .55) { ph.hint = 'fizzle'; enterResolve(); }
        break;
      case 'peak':
        if (S.t - ph.stageT0 >= (ph.extraPeak ? 20 : 25) && u >= .6) setStage('fade');
        if (T > ph.band + .3) { ph.overT = (ph.overT || 0) + dt; if (ph.overT >= 6) ph.overshoot = true; }
        break;
      case 'fade':
        if ((T < .4 && S.t - ph.lastContact >= 4 && settled()) || S.t - ph.stageT0 >= 30) enterResolve();
        break;
      case 'resolve':
        if (u >= 1 && T < .25) return close(null);
        break;
      default:
    }
  }
  function enterResolve() {
    const ph = S.ph; setStage('resolve');
    const A = { hd: { aff: S.pt.hd.aff, dom: S.pt.hd.dom * .5, aro: .15 }, dh: { aff: S.pt.dh.aff, dom: S.pt.dh.dom * .5, aro: .15 } };
    const conflict = ph.contacts > 0 || ph.harm.length > 0;
    if (conflict) {
      const aff = Math.max(S.pt.hd.aff, S.pt.dh.aff), value = .5 * Math.max(0, aff) + .3 * S.M.famil + .2 * Math.min(1, ph.coT / 600);
      const pR = sigm(6 * (value - .45)) + (ph.consoled ? .25 : 0);
      if (rnd() < pR) {
        const rec = S.P.hugo.nurture >= S.P.dove.social ? 'hugo' : 'dove';
        S.boost[rec].reconcile = { v: .5, until: S.t + 60 };
        for (const X of ['hd', 'dh']) A[X].aff = clamp(S.pt[X].aff + .4 * value * (1 - grudge(HOLDER[X])), -1, 1);
        ph.reconciler = rec;
      }
    } else {
      const aff = (S.pt.hd.aff + S.pt.dh.aff) / 2, C = (aff + 1) / 2 + S.M.famil - .2;
      const settle = C > .3 ? ['sit_with', 'groom'] : ['sulk', 'ignore'];
      for (const w of ['hugo', 'dove']) S.boost[w][pickOf(settle)] = { v: .8, until: S.t + 90 };
    }
    ph.anchor = A;
  }
  function bend(why, jumpAbs) {
    const ph = S.ph; if (!ph || ph.bends >= 2) return false;
    const c = weighted(sample(16, jumpAbs || S.story.J0 * (1 + 2 * salience())));
    ph.anchor = { hd: { ...c.hd }, dh: { ...c.dh } }; ph.bends++;
    if (ph.stage === 'resolve' && !ph.extraPeak && S.t - ph.t0 < 215) { ph.extraPeak = true; setStage('peak'); }
    logEv(null, 'bend', null, 0, { why });
    return true;
  }
  function peakZones(ph) {
    const A = ph.pk.w > 0 ? ph.pk : ph.bk.w > 0 ? ph.bk : null;
    if (!A) return { hd: { ...S.pt.hd }, dh: { ...S.pt.dh } };
    const m = X => ({ aff: A[X][0] / A.w, dom: A[X][1] / A.w, aro: A[X][2] / A.w });
    return { hd: m('hd'), dh: m('dh') };
  }
  function outcomeOf(ph, why) {
    if (why === 'separated') return 'yield';
    if (why === 'hardRupture') return 'rupture';
    if (ph.maxT < .4) return 'fizzle';
    const init = ph.init, n = init.length, half = n >> 1;
    const maj = arr => { let h = 0; for (const w of arr) h += w === 'hugo' ? 1 : -1; return h > 0 ? 'hugo' : h < 0 ? 'dove' : null; };
    const flipped = half >= 2 && n - half >= 2 && maj(init.slice(0, half)) && maj(init.slice(half)) && maj(init.slice(0, half)) !== maj(init.slice(half));
    const pz = peakZones(ph), domNow = S.pt.hd.dom - S.pt.dh.dom, domPk = pz.hd.dom - pz.dh.dom;
    const reversed = Math.abs(domNow) > .15 && Math.abs(domPk) > .15 && sgn(domNow) !== sgn(domPk);
    if (ph.roleFlips >= 1 || flipped || reversed) return 'flip';
    if ((ph.harm.some(x => x.sev > .3) || ph.overshoot) && !ph.repaired) return 'rupture';
    const c = ctx('hugo');
    if (c.dist < 150 && S.pt.hd.aro < .35 && S.pt.dh.aro < .35 && S.t - ph.againstAt > 30) return 'together';
    return 'yield';
  }
  function close(why) {
    const ph = S.ph; if (!ph) return null;
    const pz = peakZones(ph), zh = zone(pz.hd), zd = zone(pz.dh);
    const outcome = outcomeOf(ph, why);
    ph.outcome = outcome; ph.separated = why === 'separated';
    const sig = `${zh}/${zd}/${ph.frame0}/${outcome}`;
    ph.zh = zh; ph.zd = zd; ph.peak = pz;
    const match = label(ph);
    const nm = `${FR[ph.frame0]}${ZH[zh]} Hugo × ${ZD[zd]} dove · ${OC[outcome]}`;
    ph.label = match ? `${match} (${nm})` : nm;
    const fp = fingerprint(ph.exSeq);
    let topM = MOT[0]; for (const m of MOT) if (ph.ia[m] > ph.ia[topM]) topM = m;
    const cls = topM + '/' + ph.frame0;
    // writes: facts, conf, hab, famil, history
    if (outcome === 'together') { addFact('together', 'hugo', 'dove', .05, 3); addFact('together', 'dove', 'hugo', .05, 3); }
    if (ph.comforted) addFact('comforted', ph.comforted, OTHER[ph.comforted], .25, 6);
    if (ph.protected) addFact('protected', ph.protected, OTHER[ph.protected], .2, 6);
    const dealt = { hugo: 0, dove: 0 }; let maxSev = 0;
    for (const x of ph.harm) { if (dealt[x.a] != null) dealt[x.a] += x.sev; maxSev = Math.max(maxSev, x.sev); }
    if (maxSev > 0) {
      const w = dealt.hugo >= dealt.dove ? 'hugo' : 'dove', l = OTHER[w];
      S.conf[w] = clamp(S.conf[w] + .15 * maxSev, -1, 1); S.conf[l] = clamp(S.conf[l] - .2 * maxSev, -1, 1); S.loser = { who: l, t: S.t };
    }
    for (const w of ['hugo', 'dove']) S.conf[w] *= S.conf[w] > 0 ? Math.SQRT1_2 : Math.pow(.5, .3);
    for (const w of ['hugo', 'dove']) for (const k in S.M.hab[w]) S.M.hab[w][k] *= .85;
    S.M.famil = clamp(S.M.famil + .02 + .05 * Math.min(1, ph.coT / 150) + (outcome === 'together' ? .03 : 0));
    for (const f of S.M.facts) f.age += 1;
    S.M.facts = S.M.facts.filter(f => fw(f) >= .03);
    refreshMem();
    const unfinished = match && ['payback', 'foot-pecker', 'thief'].includes(match) && outcome !== 'together' ? match : null;
    const rec = { n: ph.n, sig, sig0: ph.sig0, fp, label: ph.label, match, cls, outcome, separated: ph.separated, boss: ph.boss, cause: ph.cause, t: +S.t.toFixed(1),
      hard: why === 'hard' || why === 'hardRupture', dur: +(S.t - ph.t0).toFixed(1), contacts: ph.contacts, zh, zd, frame: ph.frame0, harm: ph.harm.map(x => x.a + '>' + x.b), fed: ph.fed || 0, unfinished, forced: ph.forced, lead: ph.lead, mcls: ph.mot[ph.lead] + '/' + ph.frame0, zh0: ph.zh0, zd0: ph.zd0, bends: ph.bends };
    S.M.history.push(rec); if (S.M.history.length > 12) S.M.history.shift();
    if (ph.maxT > .8) S.story.cool = true; else if (S.story.kind === 'rising') S.story.cool = false;
    if (S.story.kind === 'random') S.story.rt = null;
    S.last = rec;
    S.ph = null; S.relaxT = 0; S.relaxMin = U(10, 25); S.armAt = S.t; S.armed = []; S.stagedDone = false;
    S.eng.hugo = S.eng.dove = null;
    for (const w of ['hugo', 'dove']) S.boost[w] = {};
    if (DEBUG && !SIM && typeof console !== 'undefined' && console.table) console.table({ n: rec.n, label: rec.label, sig, fp, cls, outcome, dur: rec.dur, contacts: rec.contacts, cause: rec.cause });
    if (SIM && SIM.onClose) SIM.onClose(rec);
    return rec;
  }

  // ---------------------------------------------------------------- 11. sifter
  const hasX = (ph, k) => (ph.x[k] || 0);
  const cnt = (ph, k) => (ph.c[k] || 0);
  const PATTERNS = [
    ['cat and mouse', p => p.frame0 === 'play' && p.chaseSegs >= 3 && p.roleFlips >= 1],
    ['tag', p => p.frame0 === 'play' && hasX(p, 'h:chase') && hasX(p, 'd:chase') && !p.contacts],
    ['gave up the hunt', p => { const q = p.exSeq, s = q.lastIndexOf('h:stalk'), w = q.lastIndexOf('h:wait_below'); return s >= 0 && w > s && hasX(p, 'd:flee') && q.slice(w).some(x => x === 'h:ignore' || x === 'h:sulk'); }],
    ['caught', p => cnt(p, 'hugo:caught') > 0],
    ['hunt', p => p.frame0 === 'serious' && hasX(p, 'h:stalk') && hasX(p, 'h:pounce')],
    ['bully', p => cnt(p, 'hugo:swatHit') > 0 && hasX(p, 'd:flee') && p.frame === 'serious'],
    ['fed-up owner', p => (hasX(p, 'h:swat') || hasX(p, 'h:threat')) && (p.zd === 'WD' || p.zd === 'WS')],
    ['foot-pecker', p => cnt(p, 'dove:peckHit') >= 2 && (hasX(p, 'h:flee') || hasX(p, 'h:sulk') || p.outcome === 'yield')],
    ['dive-bomb war', p => cnt(p, 'dove:diveHit') + cnt(p, 'dove:diveMiss') >= 3 && hasX(p, 'h:flee')],
    ['mobbing', p => hasX(p, 'd:scold') && hasX(p, 'd:dive_bomb') && !p.contacts],
    ['payback', p => p.harm.length && S.M.history.slice(-2).some(r => p.harm.some(x => r.harm.includes(x.b + '>' + x.a)))],
    ['seat war', p => cnt(p, 'hugo:displaced') && cnt(p, 'dove:displaced')],
    ['rivals', p => (hasX(p, 'h:guard_spot') || hasX(p, 'd:guard_spot')) && (cnt(p, 'hugo:displaced') || cnt(p, 'dove:displaced'))],
    ['thief', p => !!p.stole],
    ['pet and owner', p => (p.fed || 0) >= 2 && hasX(p, 'd:follow') + hasX(p, 'h:follow') >= 2],
    ['clingy pet', p => hasX(p, 'd:follow') >= 3 && S.bid.dove.answered < .4],
    ['jealous', p => !!p.jealousAct],
    ['protector', p => !!p.protected],
    ['rescue', p => (p.fellSev || 0) > .35 && !!p.rescue],
    ['kicked while down', p => !!p.kicked],
    ['mimicry game', p => (p.mimics || 0) >= 3],
    ['courtship', p => p.frame0 === 'display' && hasX(p, 'd:display') >= 2 && p.outcome === 'together'],
    ['rebuffed suitor', p => hasX(p, 'd:display') >= 2 && hasX(p, 'h:ignore') >= 2],
    ['tease too far', p => p.wasPlay && p.frameBreak && !p.misread],
    ['misunderstanding', p => !!p.misread],
    ['consoled', p => p.consoled && cnt(p, 'hugo:reconciled') + cnt(p, 'dove:reconciled') > 0],
    ['reconciliation', p => cnt(p, 'hugo:reconciled') + cnt(p, 'dove:reconciled') > 0 && (p.startGrudge || (S.last && S.last.outcome === 'rupture'))],
    ['misattributed grudge', p => p.blame && (hasX(p, 'd:flee') || hasX(p, 'd:scold') || hasX(p, 'd:sulk'))],
    ['gave up on the pigeon', p => cnt(p, 'dove:ignored') >= 3 && cnt(p, 'dove:answered') <= 1 && p.outcome === 'fizzle' && p.lead === 'hugo'],
    ['cold shoulder', p => cnt(p, 'dove:ignored') >= 3 && cnt(p, 'dove:answered') <= 1 && ['H', 'HS', 'C', 'S'].includes(p.zd)],
    ['standoff', p => p.nearT >= 30 && p.misses > 0 && !p.contacts],
    ['ride', p => p.rideT >= 20],
    ['follow the leader', p => Math.max(hasX(p, 'd:follow'), hasX(p, 'h:follow')) >= 3 && Math.min(hasX(p, 'd:follow'), hasX(p, 'h:follow')) <= 1 && !p.harm.length && p.againstAt < p.t0],
    ['shared vigil', p => p.coT >= 90 && p.maxAro < .25],
    ['arranged neighbours', p => cnt(p, 'visitor:landedNear') >= 2],
    ['gloat', p => p.displaced && Object.keys(p.displaced).some(w => hasX(p, w[0] + ':display'))],
    ['old friends', p => p.outcome === 'together' && trust('dove') + S.M.famil > .7 && trust('hugo') + S.M.famil > .6 && (hasX(p, 'h:sit_with') + hasX(p, 'd:sit_with') + hasX(p, 'h:groom') + hasX(p, 'd:groom') > 0)],
    ['mutual indifference', p => p.coT >= 60 && !(cnt(p, 'hugo:answered') + cnt(p, 'dove:answered')) && p.zh === 'C' && p.zd === 'C'],
  ];
  function label(ph) { for (const [name, f] of PATTERNS) { try { if (f(ph)) return name; } catch (e) { /* partial phase */ } } return null; }
  function fingerprint(seq) {
    const m = {}; for (let i = 1; i < seq.length; i++) { const k = seq[i - 1] + '>' + seq[i]; m[k] = (m[k] || 0) + 1; }
    return Object.keys(m).sort((a, b) => m[b] - m[a] || (a < b ? -1 : 1)).slice(0, 6).sort().join(',');
  }

  // ---------------------------------------------------------------- 12. names, debug, HUD
  const ZONES = ['W', 'WD', 'D', 'HD', 'H', 'HS', 'S', 'WS'];
  function zone(p) { if (Math.hypot(p.aff, p.dom) < .25) return 'C'; let a = Math.atan2(p.dom, p.aff) * 180 / Math.PI; if (a < 0) a += 360; return ZONES[Math.round(a / 45) % 8]; }
  const ZH = { W: 'fond', WD: 'doting', D: 'bossy', HD: 'predatory', H: 'irritable', HS: 'nervous', S: 'meek', WS: 'adoring', C: 'oblivious' };
  const ZD = { W: 'friendly', WD: 'pushy', D: 'imperious', HD: 'aggressive', H: 'cross', HS: 'skittish', S: 'timid', WS: 'devoted', C: 'indifferent' };
  const FR = { serious: '', play: 'playful ', display: 'showy ' };
  const OC = { together: 'ends together', yield: 'one backs down', rupture: 'ends badly', flip: 'roles flip', fizzle: 'fizzles out' };
  const ZN = { ZH, ZD, FR, OC };
  function liveLabel() {
    const ph = S.ph; if (!ph) return '';
    if (S.t - S.liveAt > 2) { S.liveAt = S.t; const pz = peakZones(ph); ph.zh = zone(pz.hd); ph.zd = zone(pz.dh); S.live = label(ph) || ph.name0; }
    return S.live;
  }
  function describe(who) {
    if (!S) return '';
    if (S.ph) return `${liveLabel()} · ${S.ph.stage}`;
    const zh = zone(S.pt.hd), zd = zone(S.pt.dh);
    if (who === 'dove') return `${ZD[zd]} toward Hugo · between moments`;
    if (who === 'hugo') return `${ZH[zh]} about the dove · between moments`;
    return `${ZH[zh]} Hugo, ${ZD[zd]} dove · between moments`;
  }
  const pt3 = p => `(${f2(p.aff)},${f2(p.dom)},${p.aro.toFixed(2)})`;
  function hud() {
    if (!S) return 'REL —';
    const ph = S.ph;
    if (ph) {
      const el = S.t - ph.t0;
      return `REL p${ph.n} · ${ph.stage} ${mmss(el)}/${mmss(ph.dur)} · T ${Tnow().toFixed(2)}/${Tstar().toFixed(2)} · "${liveLabel()}" · plan ${ph.zh0}×${ph.zd0} ${ph.frame} ${ph.lead}-led · H${pt3(S.pt.hd)} D${pt3(S.pt.dh)} · H:${S.cur.hugo ? S.cur.hugo.ex : '-'} D:${S.cur.dove ? S.cur.dove.ex : '-'} · fat ${Math.max(...Object.values(S.phi.hugo)).toFixed(2)}/${Math.max(...Object.values(S.phi.dove)).toFixed(2)} · c ${ph.contacts}/6`;
    }
    const arm = S.armed.map(c => `${c.name}(${c.score.toFixed(2)})`).join(' ');
    return `REL relax ${mmss(S.relaxT)}/0:45 · armed: ${arm || '-'} · H${pt3(S.pt.hd)} D${pt3(S.pt.dh)}${S.last ? ` · last: "${S.last.label}" ${S.last.outcome}` : ''}`;
  }
  function brief() {
    if (!S) return null;
    const c = ctx('dove'), b = body('dove');
    return { dist_px: c.has ? Math.round(c.dist) : null, phase: S.ph ? liveLabel() : null, stage: S.ph ? S.ph.stage : 'relax', my_stance: ZD[zone(S.pt.dh)],
      lead: S.ph ? S.ph.lead : null, engaged: !!S.eng.dove, body: { ruffled: +b.ruffled01.toFixed(2), sore: +b.sore01.toFixed(2) } };
  }
  function body(who) {
    const B = S ? S.body[who] : null;
    if (!B) return { speedK: 1, puff: 0, ruffled01: 0, sore01: 0, dazed: 0, hits: 0, lastHit: null, heldBy: null, heldUntil: 0 };
    const so = sore01(who), ru = clamp(B.ruffled / 8);
    return { speedK: Math.max(.6, 1 - .35 * so), puff: ru, ruffled01: ru, sore01: so, dazed: B.dazed, hits: B.hits, lastHit: B.lastHit, heldBy: B.heldBy || null, heldUntil: B.heldUntil || 0,
      holdKind: B.holdKind || null, releasing: B.releasing ? B.releasing.kind : null, release: B.release || null };
  }
  const tonic = s => (s > .5 && S ? clamp((1.5 + 12 * (s - .5)) * (1 - S.M.hab.dove.hold), 0, 7) : 0);
  function mindBias(e) {
    if (!S || !e) return false;
    const ph = S.ph, c = ctx('dove');
    if (!ph || (ph.stage !== 'build' && ph.stage !== 'peak') || !S.eng.dove || c.dist >= 400) return false;
    const N = (m, v) => { S.nudge.dove[m] = { v, until: S.t + 20 }; };
    switch (e.do) {
      case 'visit_hugo': N('approach', .3); break;
      case 'peck': N(c.dist < 260 ? 'antag' : 'ignore', .3); break;
      case 'rest': case 'preen': N('ignore', .3); break;
      case 'watch_visitor': case 'approach_visitor': case 'explore': case 'visit': N('ignore', .3); N('avoid', .15); break;
      default: return false;
    }
    logEv('mind', 'mind', 'dove', 0, { do: e.do });
    return true;
  }
  // Hugo's mind: hugo-mind.py (Claude) reads this every ~10 s while the page is visible and leans one of his motives
  // for 20 s, the same nudge the dove's mind uses. No server (public host, credits gone) = REL alone, as before.
  function hugoBrief() {
    const c = ctx('hugo'), r2 = v => +v.toFixed(2), b = w => { const x = body(w); return { sore: r2(x.sore01), ruffled: r2(x.ruffled01), dazed: !!x.dazed, held_by: x.heldBy }; };
    return {
      personality: Object.fromEntries(Object.entries(S.P.hugo).map(([k, v]) => [k, r2(v)])),
      hugo_feels: `${ZH[zone(S.pt.hd)]} ${pt3(S.pt.hd)}`, dove_feels: `${ZD[zone(S.pt.dh)]} ${pt3(S.pt.dh)}`,
      moment: S.ph ? liveLabel() : null, stage: S.ph ? S.ph.stage : 'between moments', dist_px: c.has ? Math.round(c.dist) : null,
      my_move_with_dove: S.cur.hugo ? S.cur.hugo.ex : null, dove_doing: S.cur.dove ? S.cur.dove.ex : null, leaning: S.eng.hugo,
      body: b('hugo'), dove_body: b('dove'), needs: Object.fromEntries(Object.entries(S.drv.hugo).map(([k, v]) => [k, r2(v)])), food: foodBrief('hugo'),
      recent: S.log.filter(e => e.a !== 'mind' && e.t > S.t - 90).slice(-8).map(e => `${Math.round(S.t - e.t)}s ago: ${[e.a, e.v, e.b].filter(Boolean).join(' ')}`),
    };
  }
  function foodBrief(who) {   // the food it can see, relative to it (+dx right, +dy above), for a mind that wants to eat or feed
    const a = who === 'hugo' ? getH() : getD(); if (!a) return [];
    return S.food.filter(it => it.st !== 'gone').slice(0, 4).map(it => ({ state: it.st, held_by: it.holder, size: +it.n.toFixed(2), dx: Math.round(it.x - a.x), dy: Math.round(a.y - it.y) }));
  }
  // He thinks every 12 s, or within 3 s of something happening to him (hugo3d's pokes: the cursor near, grabbed, thrown,
  // a wall; REL: a hit or a fall). The mind sees his body's senses (hugo3d's __hugoSense) and REL's state, and answers
  // with a lean toward the dove (REL motive) and something to do with his body (hugo3d's __hugoAct, his own moves only).
  const HUGO_MIND = DOM && /^(127\.0\.0\.1|localhost)$/.test(G.location.hostname) ? 'http://127.0.0.1:8772/decide' : '';
  const LIFE = Math.random().toString(36).slice(2, 10);   // one visit, one life: the mind's memory is keyed to it
  let hugoMindBusy = false, thoughtAt = -1e9, pokesSeen = 0, logSeen = 0, lastResult = null;
  if (HUGO_MIND) setInterval(async () => {
    if (!S || SIM || hugoMindBusy || document.hidden || frame.up || frame.dead) return;   // the frame is his mind when it is up
    const now = performance.now() / 1000, sense = G.__hugoSense ? G.__hugoSense() : null;
    const hit = S.log.some(e => e.t > logSeen && (e.a === 'hugo' || e.b === 'hugo') && e.a !== 'mind' && e.sev >= .3);
    if (!(now - thoughtAt >= 12 || ((hit || (sense && sense.poke !== pokesSeen)) && now - thoughtAt >= 3))) return;
    hugoMindBusy = true; thoughtAt = now; pokesSeen = sense ? sense.poke : 0; logSeen = S.t;
    try {
      const brief = { life: LIFE, ...hugoBrief(), ...(sense || {}), last_wish_result: lastResult };
      const r = await (await fetch(HUGO_MIND, { method: 'POST', body: JSON.stringify(brief), signal: AbortSignal.timeout(25000) })).json();
      if (!S) return;
      if (MOT.includes(r.lean)) { S.nudge.hugo[r.lean] = { v: .3, until: S.t + 20 }; logEv('mind', 'mind', 'hugo', 0, { do: r.lean }); }
      lastResult = r.act && G.__hugoAct ? `${r.act}${r.target ? ' ' + r.target : ''}: ${G.__hugoAct(r.act, r.target)}` : null;
      S.hugoMind = { ...r, result: lastResult };
    } catch (e) { /* no mind reachable: REL and his own body, as before */ } finally { hugoMindBusy = false; }
  }, 1000);
  // His mind, first choice: the Mortal Agent Frame (run_web_body.py --port 8081 --body hugo), the same frame and the same
  // protocol as the dove's link in dove-agent.js (linkTick / openStream): the body reports what it senses about once a
  // second, the frame's own being answers with BODY_INTENT. Its life is the frame's: BIRTH = a new being in this body,
  // ENDED (or the frame vanishing mid-life) = the body goes limp until the next BIRTH. Frame not running (every public
  // visitor: no URL, no request at all) = REL and his reflexes, as before.
  const FRAME = HUGO_MIND ? 'http://127.0.0.1:8081' : '';
  const frame = { up: false, id: null, es: null, busy: false, fails: 0, retryAt: 0, dead: false, deadAt: 0, leaving: false };
  const frameSense = () => JSON.stringify({
    gate: { power: !document.hidden && !frame.leaving, sensors: !!G.__hugoSense, actuators: !!G.__hugoAct },   // the truth: a hidden or closing tab is a body with no power
    observation: { ...hugoBrief(), ...G.__hugoSense(), last_wish_result: lastResult }, fed: REL.takeFed('hugo') });   // fed: nutrition eaten since the last report (the frame regenerates energy from it)
  const framePost = (path, body, keepalive) => fetch(FRAME + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive, signal: keepalive ? undefined : AbortSignal.timeout(3000) });
  function frameBorn(id) {
    if (!id || id === frame.id) return;
    frame.id = id; frame.dead = false; lastResult = null; S.nudge.hugo = {}; S.hugoMind = { born: id };
    if (G.MORTAL) G.MORTAL.external('hugo', true);   // the frame's being owns this life now
    newBody('hugo', id); G.__hugoLife(true);
  }
  function frameDied(cause) {
    if (frame.dead || !frame.id) return;
    frame.dead = true; frame.deadAt = performance.now(); S.hugoMind = { ended: cause, id: frame.id }; G.__hugoLife(false);
  }
  async function frameTick() {
    const now = performance.now();
    if (!S || SIM || frame.busy || document.hidden || !G.__hugoSense || !G.__hugoAct || (!frame.up && now < frame.retryAt)) return;
    frame.busy = true;
    try {
      if (!frame.up) {
        const h = await (await fetch(FRAME + '/health', { cache: 'no-store', signal: AbortSignal.timeout(3000) })).json();
        if (!h.alive) throw 0;
        frame.up = true; frame.fails = 0; frameStream();
      }
      const r = await (await framePost('/api/body/sense', frameSense())).json();
      frame.fails = 0; frameBorn(r.instance_id);
    } catch (e) {
      if (frame.up && ++frame.fails >= 3) { frame.up = false; frame.es.close(); frameDied('frame unreachable'); }   // the process is gone, and that being with it
      if (!frame.up) {   // a dead body waits 30 s for the supervisor's next being, then lives on REL alone; with no frame, a quiet look every 15 s
        frame.retryAt = now + (frame.dead ? 2000 : 15000);
        if (frame.dead && now - frame.deadAt > 30000) { frame.dead = false; frame.id = null; G.__hugoLife(true); if (G.MORTAL) G.MORTAL.external('hugo', false); }
      }
    } finally { frame.busy = false; }
  }
  function frameStream() {
    const es = frame.es = new EventSource(FRAME + '/events');
    es.onerror = () => { if (S) frameDied('frame process gone'); };   // killed outright it sends no ENDED; the being lived in its RAM, so it is dead all the same
    es.onmessage = m => {
      let e; try { e = JSON.parse(m.data); } catch (x) { return; }
      if (!S) return;
      if (e.event_type === 'BIRTH') return frameBorn(e.instance_id);
      if (frame.dead || (e.instance_id && e.instance_id !== frame.id)) return;
      if (e.event_type === 'BODY_INTENT') {
        if (MOT.includes(e.lean)) { S.nudge.hugo[e.lean] = { v: .3, until: S.t + 20 }; logEv('mind', 'mind', 'hugo', 0, { do: e.lean }); }
        lastResult = `${e.do}${e.target ? ' ' + e.target : ''}: ${G.__hugoAct(e.do, e.target)}`;
        if (e.say) G.__hugoSay(e.say);
        S.hugoMind = { ...e, result: lastResult };
      }
      // as with the dove, only its replies to the visitor are spoken: its background musings stay in the agent's own log
      else if (e.event_type === 'PAGE' && (e.tags || []).includes('chat_reply')) G.__hugoSay(e.text);
      else if (e.event_type === 'ENDED') frameDied(e.cause);
    };
  }
  if (FRAME) {
    setInterval(frameTick, 1000);
    const powerOff = () => { if (frame.up && !frame.dead && S && G.__hugoSense) framePost('/api/body/sense', frameSense(), true).catch(() => {}); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) powerOff(); });
    addEventListener('pagehide', () => { frame.leaving = true; powerOff(); });
    G.__hugoChat = message => framePost('/api/chat', JSON.stringify({ message }));   // no chat box for him yet: the console can talk to him
    G.__hugoFrame = frame;   // read-only peek for debugging, like __hugo
  }
  function spotKey(el, x) {
    let t = '';
    try { const sec = el && el.closest && el.closest('section,article'), hh = sec && sec.querySelector('h1,h2,h3'); t = (hh ? hh.textContent : '').trim().slice(0, 30); } catch (e) { /* detached */ }
    return t + '|' + Math.round(x / 40);
  }
  function newBody(who, id, mode) {
    if (!S || (who !== 'dove' && who !== 'hugo')) return;
    const M = S.M, k = who + 'Id', prev = M[k]; M[k] = id;
    if (S.hold.who === who) { S.hold = { who: null, t0: 0, tier: 0, by: 'visitor', stress: 0 }; if (S.ph) S.ph.frozen = false; }
    if (prev == null || prev === id) return;
    // a different being in that body: nothing the old one felt carries over; the other's memories of it fade by half
    M.facts = M.facts.filter(f => f.b !== who);
    for (const f of M.facts) if (f.a === who) f.v *= .5;
    M.hab[who] = o0(HABK); S.conf[who] = 0; M.W[who] = {};
    S.drv[who] = newDrv(); S.meal[who] = false; S.dig[who] = 0; S.block[who] = {};   // a new body with its own needs
    S.body[who] = { ruffled: 0, sore: 0, dazed: 0, hits: 0, lastHit: null, heldBy: null, heldUntil: 0 };
    S.I[who] = o0(MOT, .2); S.phi[who] = o0(MOT); S.cur[who] = null; S.imp[who] = [];
    refreshMem();
    if (S.ph) close('separated');
  }

  // Presets (§2.4): anchor points only, used by ?rel=force: and as a sim sanity check. They are not scripts.
  const PRESET_ROWS = [
    ['old friends', [.7, .1, .3], [.7, -.1, .3], 'serious', 'together', 'dove'],
    ['pet and owner', [.6, .6, .35], [.5, -.6, .45], 'serious', 'together', 'hugo', 'crumb'],
    ['demanding pet', [.5, -.5, .4], [.6, .6, .55], 'serious', 'yield', 'dove', 'spot'],
    ['random bird that doesn\'t care', [.35, 0, .35], [0, 0, .05], 'serious', 'fizzle', 'hugo'],
    ['mutual indifference', [0, 0, .1], [0, 0, .1], 'serious', 'fizzle', 'either'],
    ['curious stranger', [.15, .1, .5], [.1, -.35, .55], 'serious', 'together', 'dove'],
    ['the naturalist', [.4, -.3, .45], [-.3, -.5, .6], 'serious', 'yield', 'hugo'],
    ['curiosity standoff', [.1, -.1, .55], [.1, -.1, .55], 'serious', 'fizzle', 'either'],
    ['hunt', [-.4, .65, .8], [-.5, -.6, .85], 'serious', 'yield', 'hugo', null, 1],
    ['caught', [-.5, .75, .85], [-.6, -.6, .9], 'serious', 'rupture', 'hugo', null, 1],
    ['cat and mouse', [.1, .6, .7], [.05, -.35, .7], 'play', 'flip', 'hugo'],
    ['bully reversal', [.1, -.4, .6], [.1, .6, .7], 'play', 'flip', 'dove'],
    ['tag', [.4, .4, .65], [.4, .4, .65], 'play', 'flip', 'either'],
    ['bully', [-.5, .7, .75], [-.4, -.7, .8], 'serious', 'rupture', 'hugo', 'spot', 1],
    ['fed-up owner', [-.45, .1, .6], [.6, .5, .6], 'serious', 'yield', 'hugo'],
    ['foot-pecker', [-.1, -.5, .7], [-.6, .7, .8], 'serious', 'yield', 'dove'],
    ['dive-bomb war', [-.35, -.3, .8], [-.7, .8, .95], 'serious', 'yield', 'dove', 'spot', 1],
    ['mobbing', [-.3, -.05, .6], [-.5, .6, .75], 'serious', 'yield', 'dove'],
    ['payback', [.32, .08, .35], [-.4, .6, .7], 'serious', 'rupture', 'dove'],
    ['rivals over a spot', [-.1, .55, .6], [-.1, .55, .6], 'serious', 'yield', 'either', 'spot'],
    ['seat war', [-.4, .55, .65], [-.4, .55, .65], 'serious', 'flip', 'either', 'spot'],
    ['thief', [0, .2, .5], [-.1, .4, .6], 'serious', 'yield', 'dove', 'crumb'],
    ['tease too far', [.3, .2, .6], [.4, .5, .7], 'play', 'rupture', 'dove'],
    ['standoff', [-.35, 0, .5], [-.35, 0, .5], 'serious', 'fizzle', 'either'],
    ['protector', [.6, .5, .7], [.5, -.3, .7], 'serious', 'together', 'hugo', 'visitor'],
    ['guardian dove', [.4, -.3, .6], [.6, .5, .75], 'serious', 'together', 'dove', 'visitor'],
    ['jealous pet', [.35, 0, .4], [.6, .6, .7], 'serious', 'yield', 'dove', 'visitor'],
    ['mimicry game', [.4, 0, .5], [.4, 0, .5], 'play', 'together', 'either'],
    ['copycat Hugo', [.5, -.3, .5], [.4, .1, .45], 'play', 'together', 'hugo'],
    ['courtship-like display', [.3, -.2, .4], [.75, .5, .6], 'display', 'together', 'dove'],
    ['rebuffed suitor', [0, 0, .2], [.75, .5, .6], 'display', 'fizzle', 'dove'],
    ['Hugo shows off', [.5, .4, .6], [0, 0, .2], 'display', 'fizzle', 'hugo'],
    ['cold shoulder', [.4, 0, .4], [-.5, -.1, .2], 'serious', 'fizzle', 'hugo'],
    ['still sulking from last visit', [.35, 0, .35], [-.4, -.4, .45], 'serious', 'yield', 'hugo'],
    ['reconciliation', [.3, -.3, .4], [-.2, 0, .5], 'serious', 'together', 'either'],
    ['misattributed grudge', [.4, 0, .3], [-.4, 0, .6], 'serious', 'rupture', 'dove'],
    ['rescue', [.35, 0, .5], [.6, .4, .5], 'serious', 'together', 'dove'],
    ['kicked while down', [-.3, -.35, .6], [-.5, .6, .7], 'serious', 'yield', 'dove'],
    ['consoled loser', [.4, .1, .4], [.1, -.4, .4], 'serious', 'together', 'hugo'],
    ['ride', [.5, -.4, .25], [.7, .4, .3], 'serious', 'together', 'dove'],
    ['follow the leader', [.3, .5, .4], [.5, -.5, .4], 'serious', 'together', 'hugo'],
    ['shared vigil', [.35, 0, .1], [.35, 0, .1], 'serious', 'together', 'either'],
    ['arranged neighbours', [0, 0, .3], [0, 0, .3], 'serious', 'together', 'either'],
    ['misunderstanding', [.4, .1, .6], [-.2, -.3, .6], 'play', 'yield', 'hugo'],
    ['afraid of the bird', [-.4, -.45, .6], [.55, .15, .5], 'serious', 'yield', 'dove'],
    ['gloat', [0, -.4, .4], [.1, .6, .6], 'serious', 'yield', 'dove', 'spot'],
    ['truce', [-.3, 0, .2], [-.3, 0, .2], 'serious', 'together', 'either'],
  ];
  const slug = s => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const PRESETS = PRESET_ROWS.map(([label, hd, dh, frame, outcome, lead, obj, boss]) => ({ label, slug: slug(label), hd, dh, frame, outcome, lead, obj: obj || 'none', boss: !!boss }));
  function parseForce(spec) {
    if (!spec) return null;
    const s = String(spec).trim(), pr = PRESETS.find(p => p.slug === slug(s) || p.label === s);
    if (pr) return pr;
    const parts = s.split('.'), cen = z => {
      if (z === 'C') return [0, 0]; const i = ZONES.indexOf(z); if (i < 0) return null;
      return [.6 * Math.cos(i * Math.PI / 4), .6 * Math.sin(i * Math.PI / 4)];
    };
    const a = cen((parts[0] || '').toUpperCase()), b = cen((parts[1] || '').toUpperCase()); if (!a || !b) return null;
    const frame = ['play', 'display', 'serious'].includes(parts[2]) ? parts[2] : 'serious', boss = parts.includes('boss');
    const aro = boss ? .85 : .55, lead = parts.includes('dove') ? 'dove' : parts.includes('hugo') ? 'hugo' : 'either';
    return { label: s, slug: slug(s), hd: [a[0], a[1], aro], dh: [b[0], b[1], aro], frame, outcome: '', lead, obj: 'none', boss };
  }
  function force(spec, loop) {
    if (!S) boot();
    const pr = parseForce(spec); if (!pr) return false;
    S.forced = { preset: pr, loop: !!loop };
    if (S.ph) close('separated');
    return pr.slug;
  }

  // ---------------------------------------------------------------- engine tick (shared by the page and the sim)
  function step(dt) {
    S.t += dt;
    const h = getH(), d = getD(), has = !!(h && d);
    // 1. drives and body timers
    S.distPrev = S.dist; S.dist = has ? Math.hypot(d.x - h.x, d.y - h.y) : 1e4;
    S.away = has && S.dist > S.distPrev + .5 * dt ? 1 : S.away > 0 ? S.away - dt : 0;
    if (S.dist > 220) S.apart += dt; else { S.apart = 0; S.lastNear = S.t; }
    for (let i = 0; i < 2; i++) { const B = S.body[AG[i]]; B.ruffled = Math.max(0, B.ruffled - dt); B.sore = Math.max(0, B.sore - dt); B.dazed = Math.max(0, B.dazed - dt); }
    const BD = S.body.dove;
    if (BD.heldBy === 'hugo' && S.t >= BD.heldUntil) { if (!BD.releasing) endHold(); else if (S.t >= BD.releasing.by) letGo(BD.releasing.kind); }
    // visitor hold tiers
    if (S.hold.who) {
      const hs = S.t - S.hold.t0, ph = S.ph;
      if (hs >= 3 && !S.hold.tier2) {
        S.hold.tier2 = true; if (ph) ph.frozen = true;
        const o = OTHER[S.hold.who], c = ctx(o);
        const stance = c.aff > .4 && c.dom > 0 ? 'protect' : c.anx > .5 ? 'jealous' : c.aff < -.2 ? 'opportunist' : zone(S.pt[PT[o]]) === 'C' ? 'indifferent' : null;
        S.hold.stance = stance;
        if (stance === 'protect') S.boost[o].protect = { v: .5, until: S.t + 12 };
        if (stance === 'opportunist') S.boost[o].displace = { v: .5, until: S.t + 15 };
      }
      if (hs > 10 && !S.hold.pivoted && ph) pivot();
    }
    // 2. facts/rest and 4. intents at 1 Hz
    S.acc += dt;
    if (S.acc >= 1) { const a = S.acc; S.acc = 0; drives(a, h, d); refreshMem(); restCalc(); intentStep('hugo', a); intentStep('dove', a); S.c1 = ctx('hugo');
      const ph = S.ph; if (ph && (ph.stage === 'build' || ph.stage === 'peak')) { const I = S.I[ph.lead]; for (const m of MOT) ph.ia[m] += I[m] * a; }
    }
    // 3. points
    stepPoints(dt);
    // 5. felt tension follows arousal, and holds while engaged up close
    const engaged = S.ph && S.ph.stage === 'peak' && S.dist < 120 && (S.cur.hugo || S.cur.dove);
    for (const w of ['hugo', 'dove']) {
      const p = S.pt[PT[w]], nt = S.tens[w] + (p.aro - S.tens[w]) * Math.min(1, dt / K.tensTau);
      S.tens[w] = clamp(engaged && nt < S.tens[w] ? S.tens[w] : nt);
    }
    // 6. phase
    if (S.ph) stageTick(dt); else armTick(dt);
    // 7. food
    foodStep(dt);
    if (DOM && !SIM) renderFood();
  }
  // Drives and spot ownership, 1 Hz.
  const DRAIN = 1 / (3 * 3600);   // energy per embodied second: full -> empty in 3 h with no food (the frame's ~.0001/s)
  function drives(dt, h, d) {
    for (const w of AG) {
      const D = S.drv[w];
      if (!S.cur[w]) D.boredom = clamp(D.boredom + .004 * dt);
      D.lonely = clamp((S.apart - 40) / 200);
      const a = w === 'hugo' ? h : d;
      if (SIM) {   // the sim's toy world has no food economy for Hugo: its needs keep their old shape
        if (w === 'dove') D.hunger = clamp(D.hunger + .002 * dt);
        if (a) { const moving = w === 'hugo' ? (a.mode === 'walk' && Math.abs(+a.vxw || +a.vx || 0) > 5) || a.air : a.mode === 'fly'; D.energy = clamp(D.energy + (moving ? (w === 'hugo' ? -.002 : -.004) : .01) * dt); }
      } else {
        // runtime_state.py's one energy pool on the frame's own scale (will_config ENERGY_DRAIN_PER_SEC ~3 h, regen half that):
        // a full pool with no food lasts ~3 h of embodied time at rest (moving costs a little more), rest gives a little back
        // only when not hungry, food is the real refill (digested over the next seconds). Hunger stays quick (felt within a
        // minute or two: the dove empties in ~90 s, Hugo in ~4 min) so the food behaviour is visible; it no longer kills fast.
        const k = dt * ((G.MORTAL && G.MORTAL.speed) || 1);
        D.hunger = clamp(D.hunger + (w === 'hugo' ? .004 : .011) * k);
        const dig = Math.min(S.dig[w], .06 * dt); S.dig[w] -= dig;
        if (a) {
          const moving = w === 'hugo' ? (a.mode === 'walk' && Math.abs(+a.vxw || +a.vx || 0) > 5) || a.air : a.mode === 'fly';
          D.energy = clamp(D.energy + (-DRAIN * (1 + (moving ? .15 : 0)) + (!moving && D.hunger < .6 ? DRAIN / 2 : 0)) * k + dig);
        }
      }
      // spot keys and ownership: whoever stays in a key for 20 s owns it
      const k = keyOf(w), K0 = S.inKey[w];
      if (!k) S.inKey[w] = null;
      else if (!K0 || K0.key !== k) S.inKey[w] = { key: k, since: S.t };
      else if (S.t - K0.since >= 20 && !S.M.own[k]) S.M.own[k] = { who: w, since: K0.since };
    }
    if (G.MORTAL && !SIM) G.MORTAL.tick(dt, { hugo: { energy: S.drv.hugo.energy, y: h ? h.y : null, lane: h ? h.z || 0 : 0, w: h ? h.w : null }, dove: { energy: S.drv.dove.energy, y: d ? d.y : null, lane: d ? (d.z < -4 ? -1 : d.z > 40 ? 1 : 0) : 0 } });   // lane and w (depth.js): what part of the page's hidden depth each body is in
  }

  // ---------------------------------------------------------------- 13. sim: a toy world driven through the same calls
  function simWorld(visitor) {
    const FL = [600, 480], DP = [600, 480, 100];
    return {
      FL, DP, ho: null, dor: null, hWant: 0, dWant: 0,
      h: { x: U(200, 1200), y: pickOf(FL), floor: true, mode: 'walk', air: false, held: false, look: 0, gestName: null, headH: 150, vxw: 0, vx: 0, dir: 1, stress: 0, amt: 1, airT: 0, hitsSeen: 0, shaken: 0, wanderX: null },
      d: { x: U(100, 1300), y: pickOf(DP), z: 0, mode: 'perch', held: false, heldBy: null, face: 1, yaw: 0, stress: 0, onText: rnd() < .3, head: 'look', tx: 0, ty: 0, hitsSeen: 0, pass: null, ride: false, wanderAt: U(20, 60) },
      vis: visitor ? { next: expo(300), hold: null } : null, cursor: { x: 700, y: 400 },
    };
  }
  const nearestFloor = (W, y) => W.FL.reduce((b, f) => (Math.abs(f - y) < Math.abs(b - y) ? f : b), W.FL[0]);
  function simVisitor(W, dt) {
    const V = W.vis; if (!V) return;
    W.cursor.x = clamp(W.cursor.x + gauss() * 40 * dt, 0, 1400); W.cursor.y = clamp(W.cursor.y + gauss() * 30 * dt, 0, 700);
    S.cursor = { x: W.cursor.x, y: W.cursor.y, t: S.t };
    if (!V.hold && S.t >= V.next) {
      const who = rnd() < .5 ? 'hugo' : 'dove', A = who === 'hugo' ? W.h : W.d;
      V.hold = { who, until: S.t + pickOf([1, 5, 12]), toss: rnd() < .3, stress: U(.1, .8), t0: S.t };
      W.cursor.x = A.x; W.cursor.y = A.y - 40;
      ev('visitor', 'grabbed', who, V.hold.stress);
    }
    if (V.hold) {
      const A = V.hold.who === 'hugo' ? W.h : W.d; A.held = true; A.x = W.cursor.x; A.stress = Math.max(A.stress, V.hold.stress);
      if (S.t >= V.hold.until) {
        const { who, toss, stress, t0 } = V.hold; V.hold = null; A.held = false; A.x = clamp(A.x + U(-250, 250), 20, 1380);
        if (who === 'hugo') {
          A.y = pickOf(W.FL);
          if (toss) { A.air = true; A.airT = .6; A.vx = U(-300, 300); A.shaken = U(.2, .8); ev('visitor', 'tossed', 'hugo', U(.35, .8), { stress }); }
          else ev('visitor', 'released', 'hugo', stress * .5, { stress });
        } else {
          A.y = pickOf(W.DP); A.mode = 'perch'; A.z = 0;
          ev('visitor', toss ? 'tossed' : stress > .45 ? 'dropped' : 'released', 'dove', toss ? U(.35, .8) : stress, { stress, heldS: S.t - t0, nearHugo: Math.hypot(A.x - W.h.x, A.y - W.h.y) });
        }
        V.next = S.t + expo(300);
      }
    }
  }
  function simHugo(W, dt) {
    const h = W.h, B = S.body.hugo, d = W.d;
    h.stress = Math.max(0, h.stress - dt * .03);
    if (h.held) return;
    if (h.air) {
      h.airT -= dt; h.x = clamp(h.x + h.vx * dt, 10, 1390);
      if (h.airT <= 0) {
        h.air = false; h.vx = 0;
        if (h.pounce) { const px = h.x; h.pounce = null; ev('hugo', 'pounceLand', 'dove', 0, { x: px, y: h.y }); }
        if (h.shaken > .35) ev('hugo', 'fell', null, h.shaken, { x: h.x, y: h.y });
        h.shaken = 0;
      }
      return;
    }
    if (B.hits !== h.hitsSeen) { h.hitsSeen = B.hits; const s = B.lastHit.sev; h.shaken = Math.max(h.shaken, s); h.stress = Math.min(1, h.stress + .3 * s); h.air = true; h.airT = .4; h.vx = -(sgn(d.x - h.x) || 1) * 80 * s; return; }
    h.vxw = 0; h.gestName = null;
    if (B.dazed > 0) return;
    if (S.t >= W.hWant) {
      W.hWant = S.t + 1;
      const o = want('hugo', { reach: d.mode === 'perch' && !d.held && d.y >= h.y - 330 && W.FL.includes(d.y), floorY: h.y });
      if (o && (!W.ho || o.id !== W.ho.id)) W.ho = { ...o, st: S.t, g: o.gesture ? { ...o.gesture, t0: null } : null, arrived: false, dropped: false };
      else if (!o) W.ho = null;
    }
    const o = W.ho;
    if (!o) { // his own life: wander
      if (h.wanderX == null || Math.abs(h.wanderX - h.x) < 5) h.wanderX = rnd() < .02 ? U(50, 1350) : h.x;
      const dx = h.wanderX - h.x; if (Math.abs(dx) > 5) { const v = 60 * dt * sgn(dx); h.x += v; h.vxw = v / dt; h.dir = sgn(dx); }
      h.look = rnd() < .1 ? U(-1, 1) : h.look;
      return;
    }
    if (S.t > o.until) { done('hugo', o.id, o.arrived ? 'ok' : 'interrupted', { stayed: Math.hypot(d.x - h.x, d.y - h.y) < 300 }); W.ho = null; return; }
    h.look = o.look != null ? o.look : 0;
    if (o.ex === 'stalk' && d.face === sgn(h.x - d.x)) { h.vxw = 0; return; }
    if (o.pounce) {
      if (S.t - o.st > ((o.gesture && o.gesture.windup) || .3)) { h.air = true; h.airT = .5; h.pounce = o.pounce; h.vx = (o.pounce.x - h.x) / .5; done('hugo', o.id, 'ok'); W.ho = null; }
      return;
    }
    if (o.goal && !o.arrived) {
      const tx = clamp(o.goal.x, 20, 1380), dx = tx - h.x;
      if (Math.abs(dx) < 8) { const fy = nearestFloor(W, o.goal.y); if (Math.abs(fy - o.goal.y) < 12) h.y = fy; o.arrived = true; }
      else { const v = 70 * (o.spdK || 1) * Math.max(.6, 1 - .35 * sore01('hugo')), s = sgn(dx) * Math.min(Math.abs(dx), v * dt); h.x += s; h.vxw = s / dt; h.dir = sgn(dx); return; }
    }
    if (o.drop && !o.dropped) { o.dropped = true; ev('hugo', 'drop', 'dove', 0, { x: h.x + h.dir * 20, y: h.y }); }
    if (o.g) {
      const g = o.g; if (g.t0 == null) g.t0 = S.t;
      h.gestName = g.name;
      if (g.name === 'swat' && !g.fired && S.t - g.t0 > g.windup + .05) { g.fired = 1; const sd = sgn(d.x - h.x) || 1; ev('hugo', 'strikeApex', 'dove', 0, { x: h.x + sd * 35, y: h.y - 30 }); }
      if (g.name === 'scoop' && !g.fired && S.t - g.t0 > .55 * g.dur) { g.fired = 1; ev('hugo', 'pickApex', 'dove', 0, { x: d.x, y: d.y }); }
      if ((g.name === 'throw' || g.name === 'lift') && !g.fired && S.t - g.t0 > (g.windup || 0) + .1) { g.fired = 1; ev('hugo', g.name + 'Apex', 'dove', 0); }
      if (S.t - g.t0 >= g.dur) { done('hugo', o.id, 'ok', { stayed: Math.hypot(d.x - h.x, d.y - h.y) < 300, won: true }); W.ho = null; }
      return;
    }
    const hold = o.sit ? 12 : o.ex === 'follow' ? 2 : 1.5;
    if (S.t - o.st > hold && (o.arrived || o.stop || !o.goal)) { done('hugo', o.id, 'ok', { stayed: Math.hypot(d.x - h.x, d.y - h.y) < 300, won: o.ex === 'displace' && o.arrived }); W.ho = null; }
  }
  function simFly(W, d, x, y, why) { d.mode = 'fly'; d.tx = clamp(x, 10, 1390); d.ty = y; d.flyWhy = why; d.z = why === 'pass' ? 0 : 30; }
  function doveDoSim(W, o) {
    const d = W.d, h = W.h, side = sgn(d.x - h.x) || 1, c = ctx('dove');
    W.dor = { ...o, st: S.t, phase: 0 };
    switch (o.do) {
      case 'flee': { const x = o.x != null ? o.x : d.x + side * 1.5 * c.fid; simFly(W, d, x, o.panic && rnd() < .5 ? 100 : pickOf(W.DP), 'flee'); d.panic = o.panic ? 1.2 : 0; break; }
      case 'land_beside': case 'offer': case 'preen_beside': case 'comfort': case 'follow_hugo': {
        const gx = h.x + side * Math.max(20, o.gap || 40); if (Math.abs(d.x - gx) > 15 || Math.abs(d.y - h.y) > 5) simFly(W, d, gx, h.y, 'to'); break;
      }
      case 'sulk': simFly(W, d, o.x, pickOf(W.DP), 'to'); break;
      case 'pass': W.dor.n = o.passes || 2; W.dor.leg = 'in'; simFly(W, d, h.x, h.y - h.headH, 'pass'); break;
      case 'perch_on_hugo': simFly(W, d, h.x, h.y - h.headH, 'ride'); break;
      case 'displace': case 'peck_hugo': case 'steal': case 'take': case 'scrounge': case 'chase': case 'creep': {
        const cr = (o.do === 'steal' || o.do === 'take') && S.crumb, tx = cr ? S.crumb.x : h.x - side * 28, ty = cr ? S.crumb.y : h.y;
        if (Math.abs(d.y - ty) > 5) simFly(W, d, tx, ty, 'to'); break;
      }
      case 'keepaway': if (Math.abs(d.y - h.y) > 6 || Math.abs(d.x - h.x) >= 200) simFly(W, d, o.x != null ? o.x : d.x + side * 130, d.y, 'to'); break;
      default:
    }
  }
  function simDove(W, dt) {
    const d = W.d, h = W.h, B = S.body.dove;
    d.stress = Math.max(0, d.stress - dt * .03);
    if (d.held) { d.mode = 'perch'; return; }
    if (B.heldBy === 'hugo') {
      d.heldBy = 'hugo'; d.x = h.x + 20; d.y = h.y - 60; d.mode = 'fly'; d.z = 0; W.dor = null;
      reflex('dove'); return;
    }
    if (d.heldBy === 'hugo') { d.heldBy = null; d.mode = 'perch'; d.y = nearestFloor(W, h.y); }
    if (B.hits !== d.hitsSeen) { d.hitsSeen = B.hits; d.stress = Math.min(1, d.stress + .5 * B.lastHit.sev); }
    if (d.mode === 'fly') {
      const o = W.dor, P = d.flyWhy === 'pass';
      if (P && o) { d.tx = o.cursor ? W.cursor.x : h.x; if (o.leg === 'in') d.ty = o.cursor ? W.cursor.y : h.y - h.headH - (o.contact ? 10 : 45); }
      if (d.flyWhy === 'ride') { d.tx = h.x; d.ty = h.y - h.headH; }
      const dx = d.tx - d.x, dy = d.ty - d.y, L = Math.hypot(dx, dy), v = 260 * Math.max(.6, 1 - .35 * sore01('dove')) * (d.panic > 0 ? 1.6 : 1) * dt;
      d.panic = Math.max(0, (d.panic || 0) - dt);
      if (L > v) { d.x += dx / L * v; d.y += dy / L * v; d.face = sgn(dx) || d.face; return; }
      d.x = d.tx; d.y = d.ty;
      if (P && o) {
        if (o.leg === 'in') { ev('dove', 'diveApex', 'hugo', 0, { x: d.x, y: d.y, z: 0, contact: o.contact }); o.leg = 'out'; d.tx = d.x + (sgn(d.x - h.x) || 1) * 200; d.ty = d.y - 80; return; }
        if (--o.n > 0) { o.leg = 'in'; if (o.passes - o.n >= (o.contactFrom ?? 99)) o.contact = true; return; }
        simFly(W, d, d.x + U(-200, 200), pickOf(W.DP), 'to'); done('dove', o.id, 'ok'); W.dor = null; return;
      }
      d.mode = 'perch'; d.z = 0;
      if (d.flyWhy === 'ride') { d.ride = true; ev('dove', 'landedNear', 'hugo', .1, { ride: 1 }); }
      if (d.flyWhy === 'flee' && W.dor && W.dor.do === 'flee') { done('dove', W.dor.id, 'ok'); W.dor = null; }
      return;
    }
    if (d.ride) { if (!W.dor || W.dor.do !== 'perch_on_hugo' || h.air || h.held) { d.ride = false; simFly(W, d, h.x + U(-150, 150), pickOf(W.DP), 'to'); return; } d.x = h.x; d.y = h.y - h.headH; }
    if (B.dazed > 0) return;
    // reflex first, then the relationship, then its own life
    const r = reflex('dove');
    if (r) { if (r.do !== 'strike_back') doveDoSim(W, { ...r, id: r.id }); return; }
    if (S.t >= W.dWant) {
      W.dWant = S.t + 1;
      const o = want('dove');
      if (o && (!W.dor || o.id !== W.dor.id)) doveDoSim(W, o);
      else if (!o && W.dor && !String(W.dor.id).startsWith('rx')) W.dor = null;
      if (d.mode === 'fly') return;
    }
    const o = W.dor;
    if (!o) { if (S.t > d.wanderAt) { d.wanderAt = S.t + U(20, 70); simFly(W, d, U(50, 1350), pickOf(W.DP), 'to'); } return; }
    const el = S.t - o.st, side = sgn(d.x - h.x) || 1, onFloor = Math.abs(d.y - h.y) < 6;
    d.face = -side;
    switch (o.do) {
      case 'peck_hugo': case 'displace': case 'chase': case 'creep': {
        const tx = h.x - (o.do === 'creep' ? -side * 40 : side * 28) * (o.do === 'peck_hugo' || o.do === 'displace' ? 1 : 1.5);
        if (!onFloor) { simFly(W, d, tx, h.y, 'to'); return; }
        const dx = tx - d.x, sp = (o.do === 'creep' ? 30 : 70) * dt;
        if (Math.abs(dx) > 4) { d.x += sgn(dx) * Math.min(Math.abs(dx), sp); return; }
        if (o.do === 'peck_hugo') { o.pk = (o.pk || 0) + dt; d.head = 'peck'; if (!o.fired && o.pk > .45) { o.fired = 1; ev('dove', 'peckApex', 'hugo', 0, { x: d.x, y: d.y, rung: o.rung }); } if (o.pk > .9) { done('dove', o.id, 'ok'); W.dor = null; } return; }
        if (o.do === 'displace') { done('dove', o.id, 'ok', { won: Math.abs(h.x - d.x) > 20 || true }); W.dor = null; return; }
        if (el > 6) { done('dove', o.id, 'ok'); W.dor = null; }
        return;
      }
      case 'steal': case 'take': case 'scrounge': {
        const cr = o.do !== 'scrounge' && S.crumb, tx = cr ? S.crumb.x : h.x - side * 30, ty = cr ? S.crumb.y : h.y;
        if (Math.abs(d.y - ty) > 6) { simFly(W, d, tx, ty, 'to'); return; }
        const dx = tx - d.x; if (Math.abs(dx) > 4) { d.x += sgn(dx) * Math.min(Math.abs(dx), 70 * dt); return; }
        d.head = 'peck';
        if (S.crumb && Math.hypot(S.crumb.x - d.x, S.crumb.y - d.y) < 20) ev('dove', 'fed', S.crumb.by, .2, { steal: o.do === 'steal' && !ctx('dove').gaze ? 1 : 0 });
        else ev('dove', 'forage', null, .05);
        done('dove', o.id, 'ok'); W.dor = null; return;
      }
      case 'keepaway': { const dx = o.x - d.x; if (Math.abs(dx) > 4 && el < 3) { d.x = clamp(d.x + sgn(dx) * Math.min(Math.abs(dx), 120 * dt), 10, 1390); return; } done('dove', o.id, 'ok'); W.dor = null; return; }
      case 'follow_hugo': if (Math.abs(d.x - h.x) > 200 || !onFloor) { simFly(W, d, h.x + side * (o.gap || 100), h.y, 'to'); return; } break;
      case 'perch_on_hugo': if (!d.ride) { simFly(W, d, h.x, h.y - h.headH, 'ride'); return; } break;
      default:
    }
    if (o.do === 'offer' && !o.bowed) o.bowed = 1;
    const hold = o.rest ? 12 : o.do === 'perch_on_hugo' ? 50 : o.dur || 3;
    if (el > hold || S.t > o.until) { done('dove', o.id, 'ok', { stayed: Math.hypot(d.x - h.x, d.y - h.y) < 300 }); W.dor = null; }
  }
  function simStep(W, dt) {
    simVisitor(W, dt);
    simHugo(W, dt);
    simDove(W, dt);
    step(dt);
  }
  function srcCheck() {
    let fs = null, file = null;
    try { fs = typeof require === 'function' ? require('fs') : null; file = typeof __filename === 'string' ? __filename : null; } catch (e) { fs = null; }
    if (!fs || !file) return true;
    const src = fs.readFileSync(file, 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
    const re = new RegExp('(^|[^\\w.$])(' + 'e' + 'nd|bir' + 'th)\\s*\\(|cor' + 'pse');
    return !re.test(src);
  }
  function sim(opts) {
    const o = Object.assign({ loads: 200, phases: 15, seed: 1, dt: .5, trials: 20, presets: true, visitor: true, log: true }, opts || {});
    const keepS = S, keepSIM = SIM, keepDBG = DEBUG;
    const A = (cond, msg) => { if (!cond) { S = keepS; SIM = keepSIM; DEBUG = keepDBG; throw new Error('REL.sim assert failed: ' + msg); } };
    DEBUG = false; CNT = {};
    reseed(o.seed);
    const recs = [];
    let clampBad = null, sevMax = 0;
    const checkClamps = () => {
      const b = S.body;
      if (b.dove.dazed > 4 + 1e-9 || b.hugo.dazed > 4 + 1e-9 || b.dove.ruffled > 8 + 1e-9 || b.dove.sore > 90 + 1e-9 || b.hugo.sore > 60 + 1e-9) clampBad = JSON.stringify(b);
      if (body('dove').speedK < .6 || body('hugo').speedK < .6) clampBad = 'speedK';
    };
    const audits = [];
    for (let L = 0; L < o.loads; L++) {
      boot(); SIM = simWorld(o.visitor); S.audit = [];
      let n = 0; SIM.onClose = r => { recs.push(r); n++; };
      let guard = 0;
      while (n < o.phases && guard++ < o.phases * 900 / o.dt) { simStep(SIM, o.dt); if ((guard & 7) === 0) checkClamps(); if (o.trace && guard % Math.round((o.traceEvery || 10) / o.dt) === 0) o.trace(hud(), S, SIM); }
      for (const e of S.log) sevMax = Math.max(sevMax, e.sev);
      audits.push(...S.audit);
    }
    const CNT_MAIN = { ...CNT };   // contact tallies of the free-running loads only (not the forced preset trials)
    // preset sanity: each forced anchor pulls its planned zone pair at peak
    const presetFails = [];
    if (o.presets) {
      for (const pr of PRESETS) {
        let okN = 0;
        for (let i = 0; i < o.trials; i++) {
          boot(); SIM = simWorld(false); S.audit = [];
          let rec = null, got = null; SIM.onClose = r => { if (!rec) rec = r; };
          force(pr.slug);
          // the zone pair the points actually held at peak (read once the peak is over)
          for (let g = 0; !rec && !got && g < 300 / o.dt; g++) {
            simStep(SIM, o.dt);
            const ph = S.ph;
            if (ph && ph.forced && (ph.stage === 'fade' || ph.stage === 'resolve')) { const pz = peakZones(ph); got = zone(pz.hd) + '/' + zone(pz.dh); }
          }
          if (!got && rec) got = rec.zh + '/' + rec.zd;
          // near enough: the planned zone, a ring neighbour of it, or the centre (a planned centre has to stay there)
          const adj = (p, g) => p === g || (p !== 'C' && (g === 'C' || (g !== 'C' && Math.min((ZONES.indexOf(p) - ZONES.indexOf(g) + 8) % 8, (ZONES.indexOf(g) - ZONES.indexOf(p) + 8) % 8) === 1)));
          const gz = (got || '/').split('/');
          if (adj(zone({ aff: pr.hd[0], dom: pr.hd[1] }), gz[0]) && adj(zone({ aff: pr.dh[0], dom: pr.dh[1] }), gz[1])) okN++;
          audits.push(...S.audit);
        }
        if (okN < .6 * o.trials) presetFails.push(`${pr.slug} ${okN}/${o.trials}`);
      }
    }
    SIM = null;
    const N = recs.length, count = key => { const m = {}; for (const r of recs) m[r[key]] = (m[r[key]] || 0) + 1; return m; };
    const sigs = count('sig'), fps = count('fp'), clss = count('cls'), outs = count('outcome');
    const maxOf = m => Math.max(...Object.values(m)) / N;
    const durs = recs.filter(r => !r.separated).map(r => r.dur).sort((a, b) => a - b);
    const inRange = durs.filter(x => x >= 180 && x <= 240).length / Math.max(1, durs.length);
    const pct = q => durs[Math.min(durs.length - 1, Math.floor(q * durs.length))];
    const topSig = Object.entries(sigs).sort((a, b) => b[1] - a[1])[0], topCls = Object.entries(clss).sort((a, b) => b[1] - a[1])[0];
    const stats = {
      phases: N, uniqueSig: Object.keys(sigs).length, uniqueFp: Object.keys(fps).length, maxSigShare: +maxOf(sigs).toFixed(4), topSig: topSig && topSig[0],
      maxClsShare: +maxOf(clss).toFixed(4), topCls: topCls && topCls[0], durP5: pct(.05), durP95: pct(.95), durInRange: +inRange.toFixed(4),
      outcomeShares: Object.fromEntries(Object.entries(outs).map(([k, v]) => [k, +(v / N).toFixed(3)])), fizzleShare: +((outs.fizzle || 0) / N).toFixed(3),
      separatedShare: +(recs.filter(r => r.separated).length / Math.max(1, N)).toFixed(3),
      frames: Object.fromEntries(Object.entries(count('frame')).map(([k, v]) => [k, +(v / N).toFixed(3)])),
      labelled: +(recs.filter(r => r.match).length / Math.max(1, N)).toFixed(3), contacts: audits.length, presetFails: presetFails.length,
      contactKinds: Object.fromEntries(Object.entries(CNT_MAIN).map(([k, v]) => [k, +(v / N).toFixed(3)])),   // per phase
    };
    if (o.log && typeof console !== 'undefined') console.log(JSON.stringify(stats));
    S = keepS; SIM = keepSIM; DEBUG = keepDBG;
    if (o.assert === false) return { stats, recs, presetFails };
    A(stats.uniqueSig >= 500, `unique sig ${stats.uniqueSig} < 500`);
    A(stats.maxSigShare <= .03, `sig ${stats.topSig} has ${stats.maxSigShare} > 3%`);
    A(stats.uniqueFp >= 500, `unique fp ${stats.uniqueFp} < 500`);
    A(stats.maxClsShare <= .08, `cls ${stats.topCls} has ${stats.maxClsShare} > 8%`);
    A(inRange >= .95, `only ${inRange} of phase durations in [180, 240]`);
    A(!clampBad, `body clamp broken: ${clampBad}`);
    A(sevMax <= .8 + 1e-9, `sev ${sevMax} > .8`);
    for (const a of audits) {
      A(!a.held && !a.dazed, `contact while the receiver was ${a.held ? 'held' : 'dazed'}`);
      A(a.since >= 1.5, `contact cooldown ${a.since.toFixed(2)} < 1.5 s`);
      A(a.contacts < 6, 'more than 6 contacts in a phase');
      A(a.sev <= .8, 'contact sev > .8');
    }
    A(!presetFails.length, `presets that did not pull: ${presetFails.join('; ')}`);
    A(srcCheck(), 'REL references the dove lifecycle');
    return stats;
  }

  // ---------------------------------------------------------------- 14. shim: window.BOND for the bodies' older calls
  const BOND = {
    get v() {
      if (!S) return { warmth: .5, trust: .5, play: .3, tension: .3, attention: .5, lead: .5 };
      const hd = S.pt.hd, dh = S.pt.dh;
      return {
        warmth: (hd.aff + dh.aff + 2) / 4,
        trust: clamp(.5 + .5 * opinion('dove') + .25 * dh.aff),
        play: clamp(.8 * (S.P.hugo.play + S.P.dove.energy) / 2 + .3 * Math.max(S.I.hugo.play, S.I.dove.play) + (S.ph && S.ph.frame === 'play' ? .35 : 0)),
        tension: Math.max(hd.aro, dh.aro),
        attention: clamp(.3 + .4 * (hd.aro + dh.aro) / 2 + .4 * Math.max(S.I.hugo.approach, S.I.dove.approach, S.I.hugo.inspect, S.I.dove.inspect) - .6 * (S.I.hugo.ignore + S.I.dove.ignore) / 2),
        lead: S.ph ? (S.ph.lead === 'hugo' ? 1 : 0) : clamp(.5 + (S.I.hugo.approach - S.I.dove.approach) / 2),
      };
    },
    event(n) {
      if (!S) return;
      const h = getH(), moving = h && h.mode === 'walk' && !h.air ? 'hugo' : 'dove';
      switch (n) {
        case 'greeted': ev('dove', 'answered', 'hugo', .1); break;
        case 'fled': ev('dove', 'fled', 'hugo', .2); break;
        case 'visited': ev(moving, 'approach', OTHER[moving], .1); break;
        case 'ignored': ev('dove', 'ignored', 'hugo', .1); break;
        case 'chased': ev('hugo', 'chased', 'dove', .2); break;
        default:
      }
    },
    describe: () => describe(),
    seek: w => (S ? clamp(S.I[w === 'hugo' ? 'hugo' : 'dove'].approach) : .5),
    tick() { /* the engine has its own clock */ },
    get apart() { return S ? S.apart : 0; },
    get sinceNear() { return S ? S.t - S.lastNear : 0; },
  };

  // ---------------------------------------------------------------- public API
  const REL = {
    ev, want, done, reflex, body, tonic, mindBias, brief, describe, hud, spotKey, newBody, force, sim, zone,
    reset() { boot(); return true; },
    get phase() {
      const ph = S && S.ph; if (!ph) return null;
      return Object.freeze({ n: ph.n, stage: ph.stage, lead: ph.lead, frame: ph.frame, object: ph.object.kind, label: liveLabel(), band: ph.band, boss: ph.boss, t: S.t - ph.t0, dur: ph.dur, contacts: ph.contacts, sig0: ph.sig0 });
    },
    get crumb() { return S && S.crumb ? { x: S.crumb.x, y: S.crumb.y, by: S.crumb.by, id: S.crumb.id } : null; },
    // food and needs for the bodies (read-only views; bites and blocks go through these calls)
    get foods() { return S ? S.food.filter(it => it.st !== 'gone') : []; },
    food: id => (S ? S.food.find(it => it.id === id && it.st !== 'gone') || null : null),
    eat: who => (S && (who === 'hugo' || who === 'dove') ? eatU(who) : null),
    bite: (who, id, frac) => { if (!S) return 0; const it = S.food.find(x => x.id === id); return bite(who, it, frac); },
    foodBlock(who, id, s) { if (S && S.block[who]) S.block[who][id] = S.t + (s || 20); },
    needs: who => { if (!S) return { hunger: 0, energy: 1 }; const D = S.drv[who], p = S.pt[PT[who]]; return { hunger: D.hunger, energy: D.energy, meal: S.meal[who], aff: p.aff, aro: p.aro }; },
    spend(who, e) { if (S && S.drv[who]) S.drv[who].energy = clamp(S.drv[who].energy - e * .05); },   // speech and effort cost energy, on the 3 h pool's scale (a word ~1 s of living)
    takeFed(who) { if (!S) return 0; const f = S.fedOut[who]; S.fedOut[who] = 0; return +f.toFixed(3); },   // nutrition since the last report (the frame's regen)
    get P() { return S ? S.P : null; },
    get t() { return S ? S.t : 0; },
    PRESETS, ZN, EX: EX.map(e => e.id), PATTERNS: PATTERNS.map(p => p[0]),
    _state: () => S,
  };
  G.REL = REL;
  G.BOND = BOND;

  // ---------------------------------------------------------------- 15. init (the page only)
  function init() {
    if (Q.has('relseed')) reseed(+Q.get('relseed') || 1);
    boot();
    const rel = Q.get('rel');
    DEBUG = Q.has('rel');
    if (rel && /^(force|loop):/.test(rel)) force(rel.slice(rel.indexOf(':') + 1), rel.startsWith('loop'));
    let last = performance.now();
    setInterval(() => {
      const now = performance.now(), dt = Math.min(1, (now - last) / 1000); last = now;
      if (document.hidden) return;
      try { step(dt); } catch (e) { if (DEBUG) console.error(e); }
      if (HUDEL) HUDEL.textContent = hud();
    }, 250);
    addEventListener('pointermove', e => { if (S) S.cursor = { x: e.clientX + scrollX, y: e.clientY + scrollY, t: S.t }; }, { passive: true });
    if (DEBUG) {
      const mk = () => {
        HUDEL = document.createElement('div');
        Object.assign(HUDEL.style, { position: 'fixed', right: '8px', bottom: '8px', maxWidth: 'min(760px, calc(100vw - 16px))', font: '11px/1.4 ui-monospace, monospace', color: '#e8e2d4', background: 'rgba(12,12,14,.82)', padding: '6px 8px', borderRadius: '6px', pointerEvents: 'none', zIndex: 99999, whiteSpace: 'pre-wrap' });
        document.body.appendChild(HUDEL);
      };
      if (document.body) mk(); else addEventListener('DOMContentLoaded', mk);
    }
  }
  if (DOM) init(); else boot();
})();
