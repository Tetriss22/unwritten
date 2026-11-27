// UNWRITTEN — things that break. A crate, a cart, a column, a shelf of books stays whole (and merged into the
// world's static meshes) until something hits it hard enough. Then it is cut into pieces along its own parts,
// and every piece is a small rigid body: gravity, bounce, friction, spin, settling flat, piling on other pieces,
// being kicked by whoever walks through, and hurting what it hits when it flies fast enough.
import * as THREE from '../lib/three.module.min.js';
import { mergeStatic } from './models.js';

// hp, how many pieces, what it is made of. burn: fire takes it. boom: it goes off. loot: scrap and sometimes more.
export const BREAK = {
  crates: { hp: 3, n: 14, wood: 1, burn: 1, loot: 2 },
  barrel: { hp: 2.4, n: 10, wood: 1, burn: 1, loot: 1 },
  cart: { hp: 5, n: 18, wood: 1, burn: 1, loot: 3 },
  fence: { hp: 1.2, n: 6, wood: 1, burn: 1 },
  sign: { hp: 1, n: 5, wood: 1, burn: 1 },
  hay: { hp: 1.5, n: 12, soft: 1, burn: 1 },
  logs: { hp: 4, n: 12, wood: 1, burn: 1, loot: 2 },
  shack: { hp: 11, n: 40, wood: 1, burn: 1, loot: 6 },
  tent: { hp: 2.5, n: 26, soft: 1, burn: 1, loot: 2 },
  shelf: { hp: 3, n: 16, wood: 1, burn: 1, books: 1 },
  ruinwall: { hp: 9, n: 34, wood: 1, burn: 1, books: 1 },
  hull: { hp: 9, n: 30, wood: 1, burn: 1, loot: 3 },
  mast: { hp: 5, n: 14, wood: 1, burn: 1 },
  column: { hp: 7, n: 14, stone: 1, loot: 1 },
  pillar: { hp: 8, n: 18, stone: 1, loot: 2 },
  wall: { hp: 8, n: 18, stone: 1 },
  burnt: { hp: 12, n: 34, stone: 1, loot: 2 },
  keg: { hp: 1, n: 9, wood: 1, boom: 1 },
};

const GRAV = 24, MAXB = 420, CELL = 0.9;
const BOX = new THREE.BoxGeometry(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _a = new THREE.Vector3(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _bb = new THREE.Box3(), _id = new THREE.Quaternion();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

// cut a box with sides L into about k smaller boxes, always halving the longest side first
function grid(L, k) {
  const n = [1, 1, 1];
  while (n[0] * n[1] * n[2] < k) { let j = 0, best = -1; for (let a = 0; a < 3; a++) { const c = L[a] / n[a]; if (c > best) { best = c; j = a; } } if (best < 0.12) break; n[j]++; }
  return n;
}
// how far a turned box reaches below its centre
function reachY(b) {
  const q = b.m.quaternion, x = q.x, y = q.y, z = q.z, w = q.w;
  return Math.abs(2 * (x * y + w * z)) * b.hx + Math.abs(1 - 2 * (x * x + z * z)) * b.hy + Math.abs(2 * (y * z - w * x)) * b.hz;
}

export class Wreck {
  constructor(root, T, hooks) { Object.assign(this, { root, T, hooks, items: [], chunks: new Map(), bits: [], t: 0, clackT: 0 }); }

  add(p, g) {
    const def = BREAK[p.type]; g.updateMatrixWorld(true);
    const parts = [];
    g.traverse(m => {
      if (!m.isMesh) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      m.getWorldScale(_s); const lb = m.geometry.boundingBox, L = [(lb.max.x - lb.min.x) * _s.x, (lb.max.y - lb.min.y) * _s.y, (lb.max.z - lb.min.z) * _s.z];
      parts.push({ mat: m.material, mw: m.matrixWorld.clone(), wq: m.getWorldQuaternion(new THREE.Quaternion()), lb: lb.clone(), L, vol: Math.max(0.004, L[0] * L[1] * L[2]) });
    });
    _bb.setFromObject(g); const sz = _bb.getSize(new THREE.Vector3());
    const key = Math.floor(p.x / 16) + '|' + Math.floor(p.y / 16);
    const it = { id: this.items.length, p, g, def, type: p.type, x: p.x, y: p.y, r: Math.max(0.35, Math.min(2.2, Math.max(sz.x, sz.z) * 0.5)), top: _bb.max.y, hp: def.hp * (0.6 + 0.4 * p.s), parts, cells: p.cells || null, key, alive: true, loose: false, burn: 0, shake: 0, sa: 0 };
    it.max = it.hp; this.items.push(it);
    if (!this.chunks.has(key)) this.chunks.set(key, { list: [], meshes: [] });
    this.chunks.get(key).list.push(it);
    return it;
  }
  build() { for (const k of this.chunks.keys()) this.remerge(k); }
  remerge(key) {
    const c = this.chunks.get(key); if (!c) return;
    for (const m of c.meshes) { this.root.remove(m); m.geometry.dispose(); }
    c.meshes = mergeStatic(c.list.filter(i => i.alive && !i.loose).map(i => i.g));
    for (const m of c.meshes) this.root.add(m);
  }
  near(x, y, r) { const out = []; for (const it of this.items) if (it.alive && Math.abs(it.x - x) < r + it.r && Math.abs(it.y - y) < r + it.r && Math.hypot(it.x - x, it.y - y) < r + it.r) out.push(it); return out; }
  // a thing broken in an earlier visit: gone, with no pieces
  remove(it) { if (!it.alive) return; it.alive = false; if (it.cells) for (const c of it.cells) this.T.solid[c] = 0; if (it.loose) this.root.remove(it.g); }

  damage(it, dmg, sx, sy, force, fire = false) {
    if (!it.alive) return false;
    it.hp -= dmg;
    if (fire && it.def.burn && !it.burn) it.burn = 0.001;
    // powder never goes off in the same instant: a short fuse, so a row of kegs goes off one after another
    if (it.def.boom) { if (fire || it.hp <= 0) { const f = it.hp <= 0 ? 0.12 : 0.55; it.fuse = it.burn ? Math.min(it.fuse, f) : f; if (!it.burn) it.burn = 0.001; } this.loosen(it); it.shake = 1; it.sa = Math.atan2(it.y - sy, it.x - sx); return false; }
    if (it.hp <= 0) { this.smash(it, sx, sy, force); return true; }
    this.loosen(it); it.shake = 1; it.sa = Math.atan2(it.y - sy, it.x - sx);
    this.hooks.chip(it, sx, sy);
    return false;
  }
  loosen(it) { if (it.loose) return; it.loose = true; this.root.add(it.g); this.remerge(it.key); }
  ignite(it) { if (it.alive && it.def.burn && !it.burn) { it.burn = 0.001; this.loosen(it); } else if (it.alive && it.def.boom && !it.burn) { it.burn = 0.001; it.fuse = 0.55; this.loosen(it); } }

  smash(it, sx, sy, force) {
    if (!it.alive) return;
    it.alive = false;
    if (it.cells) for (const c of it.cells) this.T.solid[c] = 0;
    if (it.loose) this.root.remove(it.g); else this.remerge(it.key);
    const def = it.def, charred = it.burn > 0.6 && !def.boom, sum = it.parts.reduce((s, q) => s + q.vol, 0);
    const heavy = def.stone, lean = Math.atan2(it.y - sy, it.x - sx), far = Math.hypot(it.x - sx, it.y - sy);
    for (const q of it.parts) {
      const k = clamp(Math.round(def.n * q.vol / sum), 1, 18), n = grid(q.L, k), lx = (q.lb.max.x - q.lb.min.x) / n[0], ly = (q.lb.max.y - q.lb.min.y) / n[1], lz = (q.lb.max.z - q.lb.min.z) / n[2];
      for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) for (let l = 0; l < n[2]; l++) {
        _p.set(q.lb.min.x + (i + 0.5) * lx, q.lb.min.y + (j + 0.5) * ly, q.lb.min.z + (l + 0.5) * lz).applyMatrix4(q.mw);
        const shrink = def.soft ? rnd(0.6, 0.85) : rnd(0.82, 0.97);
        const hx = Math.max(0.035, q.L[0] / n[0] / 2 * shrink), hy = Math.max(0.035, q.L[1] / n[1] / 2 * shrink), hz = Math.max(0.035, q.L[2] / n[2] / 2 * shrink);
        // pushed away from what hit it, harder the closer it was; tall things also lean over the way they were pushed
        const dx = _p.x - sx, dz = _p.z - sy, d = Math.hypot(dx, dz) || 1, f = Math.min(11, force * rnd(0.5, 1.15) / (1 + d * 0.7));
        const nx = dx / d, nz = dz / d, tip = heavy ? _p.y * 0.9 * Math.min(1, force / 6) : _p.y * 0.35;
        const vx = nx * f + Math.cos(lean) * tip + rnd(-1, 1) * (0.4 + force * 0.12), vz = nz * f + Math.sin(lean) * tip + rnd(-1, 1) * (0.4 + force * 0.12);
        const vy = (far < 2.5 || force > 7 ? rnd(0.6, 1.4) * f * 0.6 : rnd(0, 0.4) * f) + rnd(0, 1.2);
        const b = this.spawn(_p.x, _p.y, _p.z, hx, hy, hz, charred ? this.hooks.charMat : q.mat, q.wq, vx, vy, vz);
        _a.set(Math.cos(lean + 1.57), 0, Math.sin(lean + 1.57)).multiplyScalar(-tip * 1.2);   // topple about the axis across the push
        b.w.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(1.5 + force * 0.5).add(_a);
        b.src = it;
      }
    }
    this.hooks.broke(it, sx, sy, force);
  }

  spawn(x, y, z, hx, hy, hz, mat, q, vx, vy, vz) {
    const m = new THREE.Mesh(BOX, mat); m.scale.set(hx * 2, hy * 2, hz * 2); m.position.set(x, y, z); if (q) m.quaternion.copy(q); this.root.add(m);
    const b = { m, x, y, z, px: x, pz: z, vx, vy, vz, w: new THREE.Vector3(), hx, hy, hz, r: Math.cbrt(hx * hy * hz) * 1.25, mass: hx * hy * hz * 8, t: 0, life: rnd(16, 24), sink: 0, sleep: false, still: 0, ign: this.T.isSolid(x, z), hit: null, ground: false };
    this.bits.push(b);
    if (this.bits.length > MAXB) { for (const o of this.bits) if (!o.sink && o.t > 0.5) { o.sink = 0.001; if (this.bits.filter(c => !c.sink).length <= MAXB - 40) break; } }
    if (this.bits.length > MAXB + 120) { const o = this.bits.shift(); this.root.remove(o.m); }
    return b;
  }
  wake(b) { if (b.sleep) { b.sleep = false; b.still = 0; } }

  // explosions and slams: break what is in reach, then throw every loose piece outwards
  impulse(x, y, r, force) {
    for (const b of this.bits) {
      if (b.sink) continue; const dx = b.x - x, dz = b.z - y, d = Math.hypot(dx, dz); if (d > r) continue;
      const f = force * (1 - d / r) / (b.mass * 6 + 1), n = d || 1;
      b.vx += dx / n * f; b.vz += dz / n * f; b.vy += f * rnd(0.5, 0.9); b.w.x += rnd(-1, 1) * f; b.w.z += rnd(-1, 1) * f; this.wake(b);
      const sp = Math.hypot(b.vx, b.vy, b.vz); if (sp > 13) { const k = 13 / sp; b.vx *= k; b.vy *= k; b.vz *= k; }
    }
  }

  update(dt, actors) {
    this.t += dt; this.clackT -= dt;
    // things that were hit judder; things on fire burn down
    for (const it of this.items) {
      if (!it.alive || !it.loose) continue;
      if (it.shake > 0) { it.shake = Math.max(0, it.shake - dt * 5); const j = Math.sin(this.t * 55) * 0.07 * it.shake; it.g.position.set(it.x + Math.cos(it.sa) * j, 0, it.y + Math.sin(it.sa) * j); }
      if (it.burn > 0) {
        it.burn += dt; this.hooks.burning(it, dt);
        if (it.def.boom) { it.fuse -= dt; if (it.fuse <= 0) { this.smash(it, it.x + rnd(-0.2, 0.2), it.y + rnd(-0.2, 0.2), 9); continue; } }
        if (!it.spread && it.burn > 0.8) { it.spread = true; for (const o of this.near(it.x, it.y, it.r + 1.1)) if (o !== it && Math.random() < 0.75) this.ignite(o); this.hooks.groundFire(it); }
        if (it.burn > 2.4 + it.r) this.smash(it, it.x + rnd(-0.3, 0.3), it.y + rnd(-0.3, 0.3), 1.4);
      }
    }
    if (!this.bits.length) return;
    const sub = dt > 0.02 ? 3 : 2, h = Math.min(dt, 0.05) / sub;
    for (let s = 0; s < sub; s++) { this.integrate(h); this.collide(h, actors, s === 0); }
    // sinking into the page after a while
    for (const b of this.bits) {
      b.t += dt;
      if (!b.sink && b.t > b.life && b.sleep) b.sink = 0.001;
      if (b.sink) { b.sink += dt; b.m.position.y = b.y - b.sink * 0.35; if (b.sink > 2.2) b.dead = true; continue; }
      b.m.position.set(b.x, b.y, b.z);
    }
    if (this.bits.some(b => b.dead)) { for (const b of this.bits) if (b.dead) this.root.remove(b.m); this.bits = this.bits.filter(b => !b.dead); }
  }

  integrate(h) {
    const T = this.T;
    for (const b of this.bits) {
      if (b.sleep || b.sink) continue;
      b.px = b.x; b.pz = b.z;
      b.vy -= GRAV * h;
      b.vx *= 1 - 0.05 * h; b.vz *= 1 - 0.05 * h;
      b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
      const wl = b.w.length(); if (wl > 1e-4) { _a.copy(b.w).divideScalar(wl); _q.setFromAxisAngle(_a, wl * h); b.m.quaternion.premultiply(_q); }
      const ext = reachY(b);
      if (b.y - ext < 0) {
        b.y = ext;
        if (b.vy < 0) {
          const imp = -b.vy;
          b.vy = imp > 1.6 ? imp * 0.3 : 0;
          // a real bounce turns sliding into tumbling
          if (imp > 1.6) { b.w.x += b.vz * 0.6; b.w.z -= b.vx * 0.6; }
          if (imp > 4 && this.clackT <= 0) { this.clackT = 0.045; this.hooks.clack(b.x, b.z, Math.min(1, imp / 12), b.mass); }
        }
        const fr = Math.max(0, 1 - 7.5 * h); b.vx *= fr; b.vz *= fr; b.w.multiplyScalar(Math.max(0, 1 - 11 * h));
        b.ground = true;
        // lie flat: turn toward whichever face is nearest to down
        if (wl < 4) this.settle(b, Math.min(1, h * 8));
      } else b.ground = false;
      // walls and trees stop pieces that are low enough to hit them
      if (b.ign) { if (!T.isSolid(b.x, b.z)) b.ign = false; }
      else if (b.y - ext < 1.7 && T.isSolid(b.x, b.z)) {
        if (!T.isSolid(b.px, b.z)) { b.x = b.px; b.vx *= -0.35; } else if (!T.isSolid(b.x, b.pz)) { b.z = b.pz; b.vz *= -0.35; } else { b.x = b.px; b.z = b.pz; b.vx *= -0.35; b.vz *= -0.35; }
        b.w.multiplyScalar(0.8);
      }
      const sp = b.vx * b.vx + b.vy * b.vy + b.vz * b.vz;
      if (sp < 0.1 && wl < 0.6) { b.still += h; if (b.still > 0.3) { b.sleep = true; b.vx = b.vy = b.vz = 0; b.w.set(0, 0, 0); } } else b.still = 0;
    }
  }
  settle(b, k) {
    const q = b.m.quaternion, x = q.x, y = q.y, z = q.z, w = q.w;
    const ay = [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)];
    // rest on a big face more often than on an edge: the nearest face wins, weighted by how big it is
    const ar = [Math.pow(b.hy * b.hz, 0.7), Math.pow(b.hx * b.hz, 0.7), Math.pow(b.hx * b.hy, 0.7)];
    let j = 0; for (let a = 1; a < 3; a++) if (Math.abs(ay[a]) * ar[a] > Math.abs(ay[j]) * ar[j]) j = a;
    _v.set(j === 0 ? 1 : 0, j === 1 ? 1 : 0, j === 2 ? 1 : 0).applyQuaternion(q);
    _q2.setFromUnitVectors(_v, ay[j] > 0 ? UP : DOWN); _q.copy(_id).slerp(_q2, k); q.premultiply(_q);
  }

  collide(h, actors, first) {
    // pieces against pieces, through a coarse grid
    const grid = new Map(), bits = this.bits;
    for (let i = 0; i < bits.length; i++) {
      const b = bits[i]; if (b.sink) continue;
      const k = Math.floor(b.x / CELL) * 7919 + Math.floor(b.z / CELL); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(i);
    }
    for (const [k, list] of grid) {
      const gx = Math.round(k / 7919), gz = k - gx * 7919;
      for (let ox = 0; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        if (ox === 0 && oz < 0) continue;
        const other = ox === 0 && oz === 0 ? list : grid.get((gx + ox) * 7919 + gz + oz); if (!other) continue;
        for (let a = 0; a < list.length; a++) for (let c = other === list ? a + 1 : 0; c < other.length; c++) this.pair(bits[list[a]], bits[other[c]]);
      }
    }
    // people walking through kick pieces about; fast pieces hurt what they hit
    for (const ac of actors) {
      for (const b of bits) {
        if (b.sink) continue;
        const dx = b.x - ac.x, dz = b.z - ac.y; if (Math.abs(dx) > ac.r + 0.6 || Math.abs(dz) > ac.r + 0.6) continue;
        const d = Math.hypot(dx, dz), rr = ac.r + b.r * 0.8; if (d >= rr || b.y - b.hy > 1.6) continue;
        const sp = Math.hypot(b.vx - (ac.vx || 0), b.vz - (ac.vy || 0), b.vy);
        if (first && ac.e && sp > 7 && b.mass > 0.004 && !(b.hit && b.hit.has(ac.e))) { (b.hit || (b.hit = new Set())).add(ac.e); this.hooks.bitHit(ac.e, b, sp); }
        const n = d || 1, nx = dx / n, nz = dz / n;
        b.x = ac.x + nx * rr; b.z = ac.y + nz * rr;
        const vn = (b.vx - (ac.vx || 0)) * nx + (b.vz - (ac.vy || 0)) * nz;
        if (vn < 0) { const kick = (ac.kick || 1) / Math.sqrt(b.mass * 6 + 0.3); b.vx += nx * (-vn * 1.2 + 0.6 * kick) + (ac.vx || 0) * 0.3; b.vz += nz * (-vn * 1.2 + 0.6 * kick) + (ac.vy || 0) * 0.3; b.vy += Math.min(3, 0.4 + Math.hypot(ac.vx || 0, ac.vy || 0) * 0.15) * kick; b.w.x += rnd(-2, 2); b.w.z += rnd(-2, 2); }
        this.wake(b);
      }
    }
  }
  pair(a, b) {
    if (a.sleep && b.sleep) return;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, rr = a.r + b.r, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= rr * rr) return;
    const d = Math.sqrt(d2) || 1e-4, nx = dx / d, ny = dy / d, nz = dz / d, ov = rr - d;
    const ia = a.sleep ? 0 : 1 / a.mass, ib = b.sleep ? 0 : 1 / b.mass, s = ia + ib; if (!s) return;
    const c = ov * 0.7 / s;
    a.x -= nx * c * ia; a.y -= ny * c * ia; a.z -= nz * c * ia; b.x += nx * c * ib; b.y += ny * c * ib; b.z += nz * c * ib;
    const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz;
    if (vn < 0) {
      const j = -1.2 * vn / s;
      a.vx -= nx * j * ia; a.vy -= ny * j * ia; a.vz -= nz * j * ia; b.vx += nx * j * ib; b.vy += ny * j * ib; b.vz += nz * j * ib;
      // rubbing takes some of the sideways speed and gives a little spin
      const tf = 0.12; a.vx *= 1 - tf * ia / s; a.vz *= 1 - tf * ia / s; b.vx *= 1 - tf * ib / s; b.vz *= 1 - tf * ib / s;
      if (-vn > 2.5) { this.wake(a); this.wake(b); }
    }
  }
}
