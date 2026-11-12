/**
 * SpawnLoadout.js — self-contained 5-slot weapon loadout for HTML/JS shooters.
 * Pure JS, no deps. Attach via SpawnLoadout.attachToPlayer(player, { seed, mode }).
 */
(function (global) {
  'use strict';

  const RANGE = {
    CLOSE: 'CLOSE',
    CLOSE_MID: 'CLOSE_MID',
    MID: 'MID',
    MID_LONG: 'MID_LONG',
    LONG: 'LONG',
  };

  // --- Seeded RNG (mulberry32) ---
  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- Weapon pool (15): id, name, type, rarityWeight, effectiveRangeBand, baseDamage, headshotMult,
  // fireMode, rpm, magSize, reloadSec, spreadHip, spreadADS, recoilPerShot, recoilRecover, bloomPerShot,
  // bloomRecover, moveSpreadMult, falloffStart, falloffEnd, minDamageMult, projectile, projectileSpeed,
  // pellets, burstCount, tracerColor
  const FIRE = { SINGLE: 'single', AUTO: 'auto', BURST: 'burst' };
  const WEAPONS = [
    // CLOSE
    { id: 'pump_sg', name: 'Pump Shotgun', type: 'shotgun', rarityWeight: 1, effectiveRangeBand: RANGE.CLOSE, baseDamage: 22, headshotMult: 1.5, fireMode: FIRE.SINGLE, rpm: 52, magSize: 6, reloadSec: 0.9, spreadHip: 0.08, spreadADS: 0.045, recoilPerShot: 0.9, recoilRecover: 4, bloomPerShot: 0.04, bloomRecover: 2.5, moveSpreadMult: 1.8, falloffStart: 4, falloffEnd: 14, minDamageMult: 0.35, projectile: false, projectileSpeed: 0, pellets: 10, burstCount: 1, tracerColor: null },
    { id: 'auto_sg', name: 'Auto Shotgun', type: 'shotgun', rarityWeight: 0.8, effectiveRangeBand: RANGE.CLOSE, baseDamage: 14, headshotMult: 1.4, fireMode: FIRE.AUTO, rpm: 120, magSize: 8, reloadSec: 1.0, spreadHip: 0.075, spreadADS: 0.04, recoilPerShot: 0.5, recoilRecover: 6, bloomPerShot: 0.03, bloomRecover: 3, moveSpreadMult: 1.7, falloffStart: 3, falloffEnd: 12, minDamageMult: 0.4, projectile: false, projectileSpeed: 0, pellets: 8, burstCount: 1, tracerColor: null },
    { id: 'smg', name: 'SMG', type: 'smg', rarityWeight: 1, effectiveRangeBand: RANGE.CLOSE, baseDamage: 18, headshotMult: 1.5, fireMode: FIRE.AUTO, rpm: 240, magSize: 30, reloadSec: 1.8, spreadHip: 0.04, spreadADS: 0.022, recoilPerShot: 0.22, recoilRecover: 8, bloomPerShot: 0.012, bloomRecover: 5, moveSpreadMult: 1.4, falloffStart: 8, falloffEnd: 28, minDamageMult: 0.5, projectile: false, projectileSpeed: 0, pellets: 1, burstCount: 1, tracerColor: 0xffcc66 },
    // CLOSE_MID
    { id: 'tac_smg', name: 'Tactical SMG', type: 'smg', rarityWeight: 1, effectiveRangeBand: RANGE.CLOSE_MID, baseDamage: 20, headshotMult: 1.45, fireMode: FIRE.AUTO, rpm: 180, magSize: 25, reloadSec: 1.6, spreadHip: 0.032, spreadADS: 0.018, recoilPerShot: 0.2, recoilRecover: 9, bloomPerShot: 0.01, bloomRecover: 5.5, moveSpreadMult: 1.35, falloffStart: 12, falloffEnd: 38, minDamageMult: 0.55, projectile: false, projectileSpeed: 0, pellets: 1, burstCount: 1, tracerColor: 0xffdd77 },
    { id: 'fast_pistol', name: 'Fast Pistol', type: 'pistol', rarityWeight: 1, effectiveRangeBand: RANGE.CLOSE_MID, baseDamage: 24, headshotMult: 1.6, fireMode: FIRE.AUTO, rpm: 300, magSize: 18, reloadSec: 1.2, spreadHip: 0.028, spreadADS: 0.015, recoilPerShot: 0.18, recoilRecover: 10, bloomPerShot: 0.008, bloomRecover: 6, moveSpreadMult: 1.3, falloffStart: 10, falloffEnd: 35, minDamageMult: 0.5, projectile: false, projectileSpeed: 0, pellets: 1, burstCount: 1, tracerColor: 0xffaa44 },
    { id: 'gl', name: 'Grenade Launcher', type: 'utility', rarityWeight: 0.6, effectiveRangeBand: RANGE.CLOSE_MID, baseDamage: 90, headshotMult: 1.0, fireMode: FIRE.SINGLE, rpm: 45, magSize: 4, reloadSec: 2.8, spreadHip: 0.04, spreadADS: 0.025, recoilPerShot: 0.7, recoilRecover: 3, bloomPerShot: 0.02, bloomRecover: 2, moveSpreadMult: 1.5, falloffStart: 6, falloffEnd: 25, minDamageMult: 0.6, projectile: true, projectileSpeed: 22, pellets: 1, burstCount: 1, tracerColor: null },
    // MID
    { id: 'ar_std', name: 'Assault Rifle', type: 'ar', rarityWeight: 1, effectiveRangeBand: RANGE.MID, baseDamage: 32, headshotMult: 1.65, fireMode: FIRE.AUTO, rpm: 165, magSize: 30, reloadSec: 2.2, spreadHip: 0.025, spreadADS: 0.012, recoilPerShot: 0.28, recoilRecover: 6, bloomPerShot: 0.009, bloomRecover: 4, moveSpreadMult: 1.4, falloffStart: 25, falloffEnd: 65, minDamageMult: 0.55, projectile: false, projectileSpeed: 0, pellets: 1, burstCount: 1, tracerColor: 0xffdd88 },
    { id: 'ar_heavy', name: 'Heavy AR', type: 'ar', rarityWeight: 0.85, effectiveRangeBand: RANGE.MID, baseDamage: 38, headshotMult: 1.7, fireMode: FIRE.AUTO, rpm: 120, magSize: 25, reloadSec: 2.6, spreadHip: 0.03, spreadADS: 0.014, recoilPerShot: 0.35, recoilRecover: 5, bloomPerShot: 0.011, bloomRecover: 3.5, moveSpreadMult: 1.45, falloffStart: 30, falloffEnd: 75, minDamageMult: 0.5, projectile: false, projectileSpeed: 0, pellets: 1, burstCount: 1, tracerColor: 0xffbb66 },
    { id: 'ar_burst', name: 'Burst AR', type: 'ar', rarityWeight: 0.9, effectiveRangeBand: RANGE.MID, baseDamage: 34, headshotMult: 1.7, fireMode: FIRE.BURST, rpm: 270, magSize: 30, reloadSec: 2.2, spreadHip: 0.022, spreadADS: 0.01, recoilPerShot: 0.25, recoilRecover: 7, bloomPerShot: 0.008, bloomRecover: 4.5, moveSpreadMult: 1.35, falloffStart: 28, falloffEnd: 70, minDamageMult: 0.55, projectile: false, projectileSpeed: 0, pellets: 1, burstCount: 3, tracerColor: 0xffdd99 },
    // MID_LONG
    { id: 'dmr', name: 'DMR', type: 'dmr', rarityWeight: 1, effectiveRangeBand: RANGE.MID_LONG, baseDamage: 44, headshotMult: 1.85, fireMode: FIRE.SINGLE, rpm: 90, magSize: 10, reloadSec: 2.0, spreadHip: 0.018, spreadADS: 0.006, recoilPerShot: 0.4, recoilRecover: 5, bloomPerShot: 0.006, bloomRecover: 3, moveSpreadMult: 1.5, falloffStart: 50, falloffEnd: 120, minDamageMult: 0.5, projectile: false, projectileSpeed: 0, pellets: 1, burstCount: 1, tracerColor: 0xffeeaa },
    { id: 'marksman', name: 'Marksman Rifle', type: 'dmr', rarityWeight: 0.9, effectiveRangeBand: RANGE.MID_LONG, baseDamage: 48, headshotMult: 1.9, fireMode: FIRE.SINGLE, rpm: 75, magSize: 8, reloadSec: 2.1, spreadHip: 0.016, spreadADS: 0.005, recoilPerShot: 0.45, recoilRecover: 4.5, bloomPerShot: 0.005, bloomRecover: 2.8, moveSpreadMult: 1.55, falloffStart: 55, falloffEnd: 130, minDamageMult: 0.48, projectile: false, projectileSpeed: 0, pellets: 1, burstCount: 1, tracerColor: 0xffffbb },
    { id: 'scoped_ar', name: 'Scoped AR', type: 'ar', rarityWeight: 0.85, effectiveRangeBand: RANGE.MID_LONG, baseDamage: 36, headshotMult: 1.75, fireMode: FIRE.AUTO, rpm: 140, magSize: 20, reloadSec: 2.4, spreadHip: 0.02, spreadADS: 0.007, recoilPerShot: 0.3, recoilRecover: 5.5, bloomPerShot: 0.007, bloomRecover: 3.5, moveSpreadMult: 1.45, falloffStart: 45, falloffEnd: 110, minDamageMult: 0.52, projectile: false, projectileSpeed: 0, pellets: 1, burstCount: 1, tracerColor: 0xffdd99 },
    // LONG
    { id: 'bolt_sniper', name: 'Bolt Sniper', type: 'sniper', rarityWeight: 0.8, effectiveRangeBand: RANGE.LONG, baseDamage: 105, headshotMult: 2.0, fireMode: FIRE.SINGLE, rpm: 42, magSize: 5, reloadSec: 2.5, spreadHip: 0.012, spreadADS: 0.002, recoilPerShot: 0.85, recoilRecover: 2.5, bloomPerShot: 0.004, bloomRecover: 2, moveSpreadMult: 1.8, falloffStart: 80, falloffEnd: 250, minDamageMult: 0.6, projectile: false, projectileSpeed: 0, pellets: 1, burstCount: 1, tracerColor: 0xffffff },
    { id: 'semi_sniper', name: 'Semi Sniper', type: 'sniper', rarityWeight: 0.85, effectiveRangeBand: RANGE.LONG, baseDamage: 88, headshotMult: 1.95, fireMode: FIRE.SINGLE, rpm: 60, magSize: 6, reloadSec: 2.4, spreadHip: 0.01, spreadADS: 0.0025, recoilPerShot: 0.6, recoilRecover: 3, bloomPerShot: 0.003, bloomRecover: 2.2, moveSpreadMult: 1.7, falloffStart: 70, falloffEnd: 220, minDamageMult: 0.55, projectile: false, projectileSpeed: 0, pellets: 1, burstCount: 1, tracerColor: 0xffeecc },
    { id: 'bow', name: 'Bow', type: 'marksman', rarityWeight: 0.75, effectiveRangeBand: RANGE.LONG, baseDamage: 75, headshotMult: 1.9, fireMode: FIRE.SINGLE, rpm: 55, magSize: 1, reloadSec: 0.5, spreadHip: 0.014, spreadADS: 0.004, recoilPerShot: 0.35, recoilRecover: 4, bloomPerShot: 0.005, bloomRecover: 2.5, moveSpreadMult: 1.6, falloffStart: 40, falloffEnd: 150, minDamageMult: 0.5, projectile: true, projectileSpeed: 45, pellets: 1, burstCount: 1, tracerColor: null },
  ];

  const WEAPON_MAP = {};
  WEAPONS.forEach((w) => { WEAPON_MAP[w.id] = w; });

  // ADS handling per weapon type: fovMul = zoom level, inRate/outRate = blend speed
  const ADS_PROFILE = {
    pistol:   { fovMul: 0.88, inRate: 6.5, outRate: 9.0 },
    smg:      { fovMul: 0.90, inRate: 7.5, outRate: 10.0 },
    shotgun:  { fovMul: 0.92, inRate: 5.5, outRate: 8.0 },
    ar:       { fovMul: 0.85, inRate: 5.0, outRate: 8.5 },
    dmr:      { fovMul: 0.68, inRate: 4.0, outRate: 6.5 },
    sniper:   { fovMul: 0.30, inRate: 2.5, outRate: 5.0 },
    marksman: { fovMul: 0.80, inRate: 3.5, outRate: 5.5 },
    utility:  { fovMul: 0.90, inRate: 5.0, outRate: 8.0 },
  };
  function getAdsProf(w) { return (w && ADS_PROFILE[w.type]) || ADS_PROFILE.ar; }

  // Slot schema: preferred band per slot; fallback bands if pool is empty
  const SLOT_BANDS = [
    [RANGE.CLOSE],
    [RANGE.CLOSE_MID, RANGE.MID],
    [RANGE.MID],
    [RANGE.MID_LONG, RANGE.MID, RANGE.LONG],
    [RANGE.LONG, RANGE.MID_LONG],
  ];

  function pickFromBand(rng, band, excludeIds) {
    const list = WEAPONS.filter((w) => w.effectiveRangeBand === band && !excludeIds.includes(w.id));
    if (list.length === 0) return null;
    let total = 0;
    for (const w of list) total += w.rarityWeight || 1;
    let r = rng() * total;
    for (const w of list) {
      r -= w.rarityWeight || 1;
      if (r <= 0) return w.id;
    }
    return list[list.length - 1].id;
  }

  function pickCoherentLoadout(seed) {
    const rng = mulberry32(seed || 0);
    const used = [];
    const loadout = [];
    for (let slot = 0; slot < 5; slot++) {
      const bands = SLOT_BANDS[slot];
      let id = null;
      for (const band of bands) {
        id = pickFromBand(rng, band, used);
        if (id) break;
      }
      if (!id) {
        const any = WEAPONS.filter((w) => !used.includes(w.id));
        if (any.length) {
          const w = any[Math.floor(rng() * any.length)];
          id = w.id;
        }
      }
      if (id) {
        used.push(id);
        loadout.push(id);
      } else {
        loadout.push(null);
      }
    }
    return loadout;
  }

  // --- Reusable vec3 (no alloc in hot path) ---
  const _v0 = { x: 0, y: 0, z: 0 };
  const _v1 = { x: 0, y: 0, z: 0 };
  const _v2 = { x: 0, y: 0, z: 0 };

  function setVec3(v, x, y, z) {
    v.x = x;
    v.y = y;
    v.z = z;
  }

  function copyVec3(out, a) {
    out.x = a.x;
    out.y = a.y;
    out.z = a.z;
  }

  function addScaled(out, a, b, s) {
    out.x = a.x + b.x * s;
    out.y = a.y + b.y * s;
    out.z = a.z + b.z * s;
  }

  function lenSq(v) {
    return v.x * v.x + v.y * v.y + v.z * v.z;
  }

  function normalize(v) {
    const L = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (L > 1e-8) {
      v.x /= L;
      v.y /= L;
      v.z /= L;
    }
    return L;
  }

  // Camera ray from yaw/pitch (right-handed: -Z forward, Y up)
  function getCameraRay(yaw, pitch, outOrigin, outDir) {
    const cp = Math.cos(pitch);
    outDir.x = -Math.sin(yaw) * cp;
    outDir.y = -Math.sin(pitch);
    outDir.z = -Math.cos(yaw) * cp;
    normalize(outDir);
  }

  // Spread: screen-space offset -> ray offset. fovRad = vertical FOV in rad.
  function applySpreadToRay(dir, spreadX, spreadY, fovRad, aspect, rng) {
    const up = _v1;
    up.x = 0;
    up.y = 1;
    up.z = 0;
    const right = _v2;
    right.x = -dir.z;
    right.y = 0;
    right.z = dir.x;
    const rLen = Math.sqrt(right.x * right.x + right.z * right.z);
    if (rLen > 1e-8) {
      right.x /= rLen;
      right.z /= rLen;
    }
    const scale = Math.tan(fovRad * 0.5) * 2;
    const dx = spreadX * scale * (aspect || 1);
    const dy = spreadY * scale;
    dir.x += right.x * dx + up.x * dy;
    dir.y += right.y * dx + up.y * dy;
    dir.z += right.z * dx + up.z * dy;
    normalize(dir);
  }

  // Box center + halfExtents; ray origin + dir. Returns t or -1.
  function rayAABB(ox, oy, oz, dx, dy, dz, cx, cy, cz, hx, hy, hz) {
    const t0 = (cx - hx - ox) / dx;
    const t1 = (cx + hx - ox) / dx;
    const t2 = (cy - hy - oy) / dy;
    const t3 = (cy + hy - oy) / dy;
    const t4 = (cz - hz - oz) / dz;
    const t5 = (cz + hz - oz) / dz;
    const tmin = Math.max(Math.min(t0, t1), Math.min(t2, t3), Math.min(t4, t5));
    const tmax = Math.min(Math.max(t0, t1), Math.max(t2, t3), Math.max(t4, t5));
    if (tmin <= tmax && tmax >= 0) return tmin >= 0 ? tmin : tmax;
    return -1;
  }

  let state = null;
  let input = { fire: false, ads: false, reload: false, slotIndex: -1, slotDelta: 0 };
  let playerRef = null;
  let getRayTargets = () => [];
  let applyDamageStub = function (target, amount, isHead) { if (target && typeof target.applyDamage === 'function') target.applyDamage(amount, isHead); };
  let raycastHit = null;
  let spawnProjectileCallback = null;
  const events = { onWeaponFired: [], onWeaponChanged: [], onReload: [] };
  let fxCallback = null;

  function emit(name, payload) {
    (events[name] || []).forEach((cb) => { try { cb(payload); } catch (e) {} });
  }

  function getWeapon(slotIndex) {
    if (!state || slotIndex < 0 || slotIndex > 4) return null;
    const id = state.loadout[slotIndex];
    return id ? WEAPON_MAP[id] : null;
  }

  function currentWeapon() {
    return state ? getWeapon(state.activeSlot) : null;
  }

  function currentSlotState() {
    if (!state) return null;
    const s = state.slots[state.activeSlot];
    return s ? { ammo: s.ammo, reserve: s.reserve, weaponId: state.loadout[state.activeSlot], reloading: s.reloading } : null;
  }

  function fireWeapon() {
    const w = currentWeapon();
    const slotState = state.slots[state.activeSlot];
    if (!w || !slotState || slotState.ammo <= 0) return false;
    if (slotState.reloading) return false;

    const rng = state.rng;
    const now = state.time;
    const interval = 60 / w.rpm;
    if (now - slotState.lastFireTime < interval) return false;
    slotState.lastFireTime = now;
    slotState.ammo--;
    state.shotIndex++;

    const spreadMul = state.ads ? w.spreadADS : w.spreadHip;
    const moveMul = state.isMoving ? w.moveSpreadMult : 1;
    const bloom = (state.bloom || 0) * (state.ads ? 0.5 : 1);
    const spread = (spreadMul * moveMul) + bloom;

    const kick = w.recoilPerShot * (0.9 + rng() * 0.2);
    const kickH = (rng() - 0.5) * 0.3 * w.recoilPerShot;
    state.recoilY += kick;
    state.recoilX += kickH;
    state.bloom = Math.min(1, (state.bloom || 0) + w.bloomPerShot);

    const pellets = w.pellets || 1;
    const fovRad = (playerRef && playerRef.getFovRad) ? playerRef.getFovRad() : 75 * (Math.PI / 180);
    const aspect = (playerRef && playerRef.getAspect) ? playerRef.getAspect() : 16 / 9;

    for (let p = 0; p < pellets; p++) {
      const sx = (rng() - 0.5) * 2 * spread;
      const sy = (rng() - 0.5) * 2 * spread;
      getCameraRay(state.yaw, state.pitch, _v0, _v1);
      copyVec3(_v2, _v1);
      applySpreadToRay(_v2, sx, sy, fovRad, aspect, rng);

      if (w.projectile && w.projectileSpeed > 0) {
        if (spawnProjectileCallback) {
          spawnProjectileCallback({
            origin: { x: state.origin.x, y: state.origin.y, z: state.origin.z },
            dir: { x: _v2.x, y: _v2.y, z: _v2.z },
            speed: w.projectileSpeed,
            weapon: w,
            damage: computeDamage(w, 0),
            headshotMult: w.headshotMult,
          });
        }
      } else {
        hitscanRay(state.origin.x, state.origin.y, state.origin.z, _v2.x, _v2.y, _v2.z, w);
      }
    }

    if (w.fireMode === FIRE.BURST && w.burstCount > 1) {
      slotState.burstShotsLeft = (slotState.burstShotsLeft ?? 0) - 1;
      if (slotState.burstShotsLeft <= 0) {
        slotState.burstShotsLeft = w.burstCount;
        // enforce inter-burst pause: lock out until after the burst interval
        slotState.burstCooldownEnd = now + (60 / w.rpm) * w.burstCount * 0.6;
      }
    }

    // Animation kick
    if (state.anim) {
      const kick = w.recoilPerShot;
      state.anim.kickZ  = Math.max(state.anim.kickZ  - kick * 0.065, -0.11);
      state.anim.kickRx = Math.max(state.anim.kickRx - kick * 0.040, -0.10);
    }
    // FX callback (muzzle flash, tracer)
    if (fxCallback) {
      fxCallback({ type: 'muzzleFlash' });
      if (w.tracerColor) fxCallback({ type: 'tracer', color: w.tracerColor, dir: { x: _v2.x, y: _v2.y, z: _v2.z } });
    }

    emit('onWeaponFired', { weapon: w, slot: state.activeSlot });
    return true;
  }

  function computeDamage(w, distance) {
    let t = 1;
    if (distance > w.falloffStart) {
      const range = w.falloffEnd - w.falloffStart;
      t = 1 - (distance - w.falloffStart) / range;
      t = Math.max(w.minDamageMult, Math.min(1, t));
    }
    return w.baseDamage * t;
  }

  function hitscanRay(ox, oy, oz, dx, dy, dz, w) {
    const maxDist = 300;
    const targets = getRayTargets();
    let bestT = maxDist;
    let bestTarget = null;
    let bestIsHead = false;

    for (const t of targets) {
      const pos = t.position || t;
      const cx = typeof pos.x === 'number' ? pos.x : pos[0];
      const cy = typeof pos.y === 'number' ? pos.y : pos[1];
      const cz = typeof pos.z === 'number' ? pos.z : pos[2];
      const hx = (t.halfExtents && t.halfExtents.x) ?? (t.radius ?? 0.3);
      const hy = (t.halfExtents && t.halfExtents.y) ?? (t.radius ?? 0.3);
      const hz = (t.halfExtents && t.halfExtents.z) ?? (t.radius ?? 0.3);
      const tHit = rayAABB(ox, oy, oz, dx, dy, dz, cx, cy, cz, hx, hy, hz);
      if (tHit >= 0 && tHit < bestT) {
        bestT = tHit;
        bestTarget = t;
        bestIsHead = false;
        if (t.headPosition) {
          const h = t.headPosition;
          const hcx = typeof h.x === 'number' ? h.x : h[0];
          const hcy = typeof h.y === 'number' ? h.y : h[1];
          const hcz = typeof h.z === 'number' ? h.z : h[2];
          const headT = rayAABB(ox, oy, oz, dx, dy, dz, hcx, hcy, hcz, 0.1, 0.1, 0.1);
          if (headT >= 0 && headT < bestT) {
            bestIsHead = true;
          }
        }
      }
    }

    const dist = bestT < maxDist ? bestT : maxDist;
    const damage = computeDamage(w, dist);
    const finalDamage = bestIsHead ? damage * w.headshotMult : damage;

    if (bestTarget) {
      applyDamageStub(bestTarget, finalDamage, bestIsHead);
    }

    if (raycastHit) {
      raycastHit({
        origin: { x: ox, y: oy, z: oz },
        direction: { x: dx, y: dy, z: dz },
        distance: bestT < maxDist ? bestT : maxDist,
        target: bestTarget,
        isHead: bestIsHead,
        damage: finalDamage,
      });
    }
  }

  function startReload() {
    const w = currentWeapon();
    const slotState = state.slots[state.activeSlot];
    if (!w || !slotState || slotState.reloading) return;
    if (slotState.ammo >= w.magSize || slotState.reserve <= 0) return;
    slotState.reloading = true;
    slotState.reloadEndTime = state.time + w.reloadSec;
    emit('onReload', { weapon: w, slot: state.activeSlot });
  }

  function update(dt) {
    if (!state || !playerRef) return;

    const p = playerRef;
    state.time = (state.time || 0) + dt;
    state.origin.x = p.position?.x ?? p.position?.[0] ?? 0;
    state.origin.y = (p.position?.y ?? p.position?.[1] ?? 0) + (p.eyeHeight ?? 1.67);
    state.origin.z = p.position?.z ?? p.position?.[2] ?? 0;
    state.yaw = p.yaw ?? 0;
    state.pitch = p.pitch ?? 0;
    state.ads = input.ads;
    state.isMoving = p.isMoving ?? (Math.abs(p.vx || 0) + Math.abs(p.vz || 0) > 0.1);

    if (input.slotIndex >= 0 && input.slotIndex <= 4 && input.slotIndex !== state.activeSlot) {
      state.activeSlot = input.slotIndex;
      const w = getWeapon(state.activeSlot);
      const slotState = state.slots[state.activeSlot];
      if (slotState) {
        slotState.burstShotsLeft = w ? w.burstCount : 1;
        slotState.burstCooldownEnd = 0;
      }
      emit('onWeaponChanged', { slot: state.activeSlot, weapon: w });
    }
    if (input.slotDelta !== 0) {
      let next = state.activeSlot + input.slotDelta;
      if (next < 0) next = 4;
      if (next > 4) next = 0;
      input.slotIndex = next;
      input.slotDelta = 0;
      state.activeSlot = next;
      const w = getWeapon(state.activeSlot);
      const slotState = state.slots[state.activeSlot];
      if (slotState && w) {
        slotState.burstShotsLeft = w.burstCount;
        slotState.burstCooldownEnd = 0;
      }
      emit('onWeaponChanged', { slot: state.activeSlot, weapon: w });
    }

    if (input.reload) startReload();

    for (let i = 0; i < 5; i++) {
      const s = state.slots[i];
      const w = getWeapon(i);
      if (!s || !w) continue;
      if (s.reloading && state.time >= s.reloadEndTime) {
        const need = w.magSize - s.ammo;
        const take = Math.min(need, s.reserve);
        s.ammo += take;
        s.reserve -= take;
        s.reloading = false;
      }
    }

    const w = currentWeapon();
    const slotState = state.slots[state.activeSlot];
    if (w && slotState) {
      if (slotState.burstCooldownEnd > 0 && state.time < slotState.burstCooldownEnd) {
        // burst cooldown in progress
      } else if (slotState.burstCooldownEnd > 0) {
        slotState.burstCooldownEnd = 0;
        slotState.burstShotsLeft = w.burstCount;
      }
      const inBurstCooldown = slotState.burstCooldownEnd > 0 && state.time < slotState.burstCooldownEnd;
      if (input.fire && !slotState.reloading && !inBurstCooldown) {
        fireWeapon();
      }
      // Auto-reload when magazine runs dry
      if (slotState.ammo <= 0 && !slotState.reloading && slotState.reserve > 0) {
        startReload();
      }
    }

    const rec = w ? (state.ads ? w.recoilRecover * 1.2 : w.recoilRecover) : 10;
    const blm = w ? (state.ads ? w.bloomRecover * 1.1 : w.bloomRecover) : 5;
    state.recoilY += -state.recoilY * Math.min(1, dt * rec);
    state.recoilX += -state.recoilX * Math.min(1, dt * rec);
    state.bloom = Math.max(0, (state.bloom || 0) - dt * blm);

    if (state.recoilApply) {
      state.recoilApply(state.recoilX, state.recoilY);
    }

    // --- Procedural animation state ---
    if (!state.anim) state.anim = { adsProgress: 0, swayT: 0, bobT: 0, kickZ: 0, kickRx: 0 };
    const anim = state.anim;
    const adsProf = getAdsProf(w);
    const adsTarget = (state.ads && !(state.slots[state.activeSlot] && state.slots[state.activeSlot].reloading)) ? 1 : 0;
    const adsRate = adsTarget > anim.adsProgress ? adsProf.inRate : adsProf.outRate;
    anim.adsProgress = Math.max(0, Math.min(1, anim.adsProgress + (adsTarget - anim.adsProgress) * Math.min(1, dt * adsRate)));
    anim.swayT += dt * (state.isMoving ? 2.2 : 0.85);
    if (state.isMoving) anim.bobT += dt * 5.5;
    anim.kickZ  += (-anim.kickZ)  * Math.min(1, dt * 13);
    anim.kickRx += (-anim.kickRx) * Math.min(1, dt * 11);

    updateUI();
  }

  function updateUI() {
    if (!state || !state.ui) return;
    const bar = state.ui.slotBar;
    const ammoEl = state.ui.ammoEl;
    if (bar) {
      for (let i = 0; i < 5; i++) {
        const cell = bar.children[i];
        if (!cell) continue;
        const w = getWeapon(i);
        cell.textContent = w ? w.name.split(' ')[0] : '-';
        const active = i === state.activeSlot;
        cell.style.background = active ? 'rgba(255,200,80,.25)' : 'rgba(255,255,255,.08)';
        cell.style.border = active ? '1px solid rgba(255,200,80,.6)' : '1px solid transparent';
      }
    }
    if (ammoEl) {
      const w = currentWeapon();
      const s = state.slots[state.activeSlot];
      if (w && s) {
        ammoEl.textContent = s.reloading ? 'Reloading...' : `${s.ammo} / ${s.reserve}`;
      } else {
        ammoEl.textContent = '';
      }
    }
  }

  // Returns per-frame viewmodel animation data for the host renderer.
  // adsProgress: 0=hip 1=ADS (smoothstepped); dx/dy/dz: positional offsets;
  // drx/drz: rotation offsets; fovMul: FOV multiplier (< 1 = zoomed).
  function getViewmodelTransform() {
    if (!state || !state.anim) {
      return { adsProgress: 0, dx: 0, dy: 0, dz: 0, drx: 0, dry: 0, drz: 0, fovMul: 1 };
    }
    const anim = state.anim;
    const w = currentWeapon();
    const prof = getAdsProf(w);

    // Smoothstep ease on raw ADS progress
    const t = anim.adsProgress;
    const ap = t * t * (3 - 2 * t);

    // Idle sway — attenuated when ADS
    const swayScale = (1 - ap * 0.9) * 0.0028;
    const dx_sway = Math.sin(anim.swayT * 0.72) * swayScale;
    const dy_sway = Math.sin(anim.swayT * 1.08 + 0.9) * swayScale * 0.55;

    // Walk bob — attenuated when ADS
    const bobScale = state.isMoving ? (1 - ap * 0.9) * 0.0050 : 0;
    const dy_bob = Math.sin(anim.bobT) * bobScale;
    const dx_bob = Math.cos(anim.bobT * 0.5) * bobScale * 0.35;

    // FOV multiplier
    const fovMul = 1.0 - (1.0 - prof.fovMul) * ap;

    return {
      adsProgress: ap,
      dx: dx_sway + dx_bob,
      dy: dy_sway + dy_bob,
      dz: anim.kickZ,
      drx: anim.kickRx,
      dry: 0,
      drz: 0,
      fovMul,
    };
  }

  function createUI(container) {
    const wrap = document.createElement('div');
    wrap.id = 'spawn-loadout-ui';
    wrap.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);display:flex;align-items:center;gap:12px;background:rgba(0,0,0,.5);padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.1);font-size:12px;color:#e0e0e0;pointer-events:none;';
    const bar = document.createElement('div');
    bar.style.display = 'flex';
    bar.style.gap = '4px';
    for (let i = 0; i < 5; i++) {
      const cell = document.createElement('span');
      cell.style.cssText = 'padding:4px 8px;border-radius:4px;background:rgba(255,255,255,.08);min-width:48px;text-align:center;';
      cell.classList.add('slot');
      bar.appendChild(cell);
    }
    wrap.appendChild(bar);
    const ammoEl = document.createElement('span');
    ammoEl.style.marginLeft = '8px';
    ammoEl.style.minWidth = '80px';
    wrap.appendChild(ammoEl);
    (container || document.body).appendChild(wrap);
    return { slotBar: bar, ammoEl };
  }

  function attachToPlayer(player, opts) {
    opts = opts || {};
    const seed = opts.seed ?? Math.floor(Math.random() * 0xffffffff);
    const loadoutIds = pickCoherentLoadout(seed);
    const rng = mulberry32(seed);

    const slots = [];
    for (let i = 0; i < 5; i++) {
      const wid = loadoutIds[i];
      const w = wid ? WEAPON_MAP[wid] : null;
      const mag = w ? w.magSize : 0;
      const reserve = w ? Math.floor(mag * 2.5 + rng() * mag * 1.5) : 0;
      slots.push({
        ammo: mag,
        reserve: Math.max(0, reserve),
        lastFireTime: 0,
        reloading: false,
        reloadEndTime: 0,
        burstShotsLeft: w ? (w.burstCount || 1) : 1,
        burstCooldownEnd: 0,
      });
    }

    state = {
      loadout: loadoutIds,
      slots,
      activeSlot: 0,
      time: 0,
      rng,
      bloom: 0,
      recoilX: 0,
      recoilY: 0,
      shotIndex: 0,
      origin: { x: 0, y: 0, z: 0 },
      yaw: 0,
      pitch: 0,
      ads: false,
      isMoving: false,
      recoilApply: opts.recoilApply || null,
      anim: { adsProgress: 0, swayT: 0, bobT: 0, kickZ: 0, kickRx: 0 },
    };

    state.ui = createUI(opts.uiContainer);
    playerRef = player;

    const w0 = getWeapon(0);
    if (slots[0]) {
      slots[0].burstShotsLeft = w0 ? w0.burstCount : 1;
    }
    emit('onWeaponChanged', { slot: 0, weapon: w0 });
    updateUI();
    return state;
  }

  function setInput(next) {
    if (next.fire !== undefined) input.fire = !!next.fire;
    if (next.ads !== undefined) input.ads = !!next.ads;
    if (next.reload !== undefined) input.reload = !!next.reload;
    if (next.slotIndex !== undefined) input.slotIndex = next.slotIndex;
    if (next.slotDelta !== undefined) input.slotDelta = next.slotDelta;
  }

  function isActive() {
    return state !== null && playerRef !== null;
  }

  function detach() {
    const ui = state && state.ui;
    if (ui && ui.slotBar && ui.slotBar.parentNode) {
      const wrap = ui.slotBar.closest('#spawn-loadout-ui');
      if (wrap) wrap.remove();
    }
    state = null;
    playerRef = null;
  }

  global.SpawnLoadout = {
    RANGE,
    WEAPONS,
    WEAPON_MAP,
    pickCoherentLoadout,
    attachToPlayer,
    update,
    setInput,
    isActive,
    detach,
    currentWeapon,
    currentSlotState,
    getWeapon,
    on: function (name, cb) {
      if (!events[name]) events[name] = [];
      events[name].push(cb);
    },
    off: function (name, cb) {
      if (!events[name]) return;
      events[name] = events[name].filter((f) => f !== cb);
    },
    getRayTargets: function () { return getRayTargets; },
    setRayTargets: function (fn) { getRayTargets = typeof fn === 'function' ? fn : () => []; },
    setApplyDamage: function (fn) { applyDamageStub = typeof fn === 'function' ? fn : applyDamageStub; },
    setRaycastHit: function (fn) { raycastHit = typeof fn === 'function' ? fn : null; },
    setSpawnProjectile: function (fn) { spawnProjectileCallback = typeof fn === 'function' ? fn : null; },
    setFxCallback: function (fn) { fxCallback = typeof fn === 'function' ? fn : null; },
    getViewmodelTransform,
    isADS: function () { return state ? (state.anim && state.anim.adsProgress > 0.05) : false; },
  };
})(typeof window !== 'undefined' ? window : global);
