// UNWRITTEN — game loop, the Scribe, the unwriters, one small world of five lands and the Editor.
import * as THREE from '../lib/three.module.min.js';
import { Renderer, SIN, MAX_LIGHTS, MAX_ERASE, MAX_PULSE } from './render.js';
import { LANDS, SIZE, buildWorld } from './terrain.js';
import * as M from './models.js';
import { Audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const rotY = (a) => Math.atan2(Math.cos(a), Math.sin(a) / SIN);
const place = (o, x, y, h = 0) => o.position.set(x, h, y / SIN);
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);

const audio = new Audio();
let R = null, W = null;
const S = { mode: 'boot', land: 0, landT: 0, t: 0, camX: 0, camY: 0, shake: 0, hitstop: 0, flash: 0, reveal: 0, revealTo: 0, amb: 0, deaths: 0, runT: 0, paused: false, timers: [], zoom: 0.85, zoomTo: 0.85, zMin: 0.1, env: null };
const P = { x: 0, y: 0, vx: 0, vy: 0, kx: 0, ky: 0, face: 0, hp: 5, maxHp: 5, inv: 0, dashT: 0, dashCd: 0, dx: 0, dy: 0, atkT: 0, atkDur: 0.24, atkCd: 0, combo: 0, comboT: 0, hitDone: true, walk: 0, stepT: 0, burnT: 0, cx: 0, cy: 0, m: null };
const keys = new Set();
const input = { mx: 0, my: 0, mouseT: -99, attack: false, held: false, dash: false, sx: 0, sy: 0, stickId: null, ox: 0, oy: 0, pinch: 0 };
const after = (sec, fn) => S.timers.push({ t: sec, fn });

// ---------------------------------------------------------------- save
const SAVE = 'unwritten.world.v1';
const readSave = () => { try { return JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch (e) { return null; } };
const clearSave = () => { try { localStorage.removeItem(SAVE); } catch (e) { /* storage unavailable */ } };
function save() {
  try { localStorage.setItem(SAVE, JSON.stringify({ taken: W.letters.filter(l => l.state === 'taken').map(l => l.id), lit: W.lands.map(l => l.lit), cp: [P.cx, P.cy], t: S.runT, d: S.deaths })); } catch (e) { /* storage unavailable */ }
}

// ---------------------------------------------------------------- HUD
const msg = { q: [], cur: null, i: 0, t: 0, hold: 0 };
function say(text, hold = 3.2) { msg.q.push({ text, hold }); if (msg.cur && msg.i >= msg.cur.text.length) msg.hold = Math.min(msg.hold, 0.5); }
function updateMsg(dt) {
  const el = $('msg');
  if (!msg.cur && msg.q.length) { msg.cur = msg.q.shift(); msg.i = 0; msg.t = 0; msg.hold = msg.cur.hold; el.innerHTML = '<span></span>'; }
  if (!msg.cur) return;
  const span = el.firstChild, len = msg.cur.text.length;
  if (msg.i < len) {
    msg.t += dt;
    while (msg.t > 0.026 && msg.i < len) { msg.i++; msg.t -= 0.026; if (msg.i % 3 === 0) audio.play('type'); }
    span.textContent = msg.cur.text.slice(0, msg.i) + (msg.i < len ? '_' : '');
  } else { msg.hold -= dt; if (msg.hold <= 0) { msg.cur = null; el.innerHTML = ''; } }
}
function hudHearts() {
  let s = ''; for (let i = 0; i < P.maxHp; i++) s += i < P.hp ? '♥' : '<i>♥</i>';
  $('hearts').innerHTML = s;
}
function hudWord() {
  const land = W.lands[S.land], w = land.def.word; let s = '';
  for (let i = 0; i < w.length; i++) s += land.letters[i].state === 'taken' ? w[i] : '<i>_</i>';
  $('word').innerHTML = s; $('word').classList.toggle('done', land.wordDone);
  $('chapter').textContent = land.def.roman + ' · ' + land.def.name;
  let l = ''; for (let i = 0; i < 4; i++) l += W.lands[i].lit ? '◆' : '<i>◇</i>';
  $('lanterns').innerHTML = l + ' <small>LANTERNS</small>';
}
function showCard(def) {
  const c = $('card'); c.querySelector('.n').textContent = def.roman; c.querySelector('.t').textContent = def.name; c.querySelector('.s').textContent = def.sub;
  c.classList.add('on'); c.style.opacity = 1;
  clearTimeout(showCard.h); showCard.h = setTimeout(() => { c.style.opacity = 0; setTimeout(() => c.classList.remove('on'), 520); }, 2300);
}

// ---------------------------------------------------------------- effects
function pulse(x, y, col = [1, 0.95, 0.8], w = 1, v = 7, life = 0.7, r0 = 0.2) { W.pulses.push({ x, y, r: r0, v, life, max: life, col, w }); if (W.pulses.length > 24) W.pulses.shift(); }
function burst(x, y, h, n, hex = 0xffffff, sp = 4.5) {
  for (let i = 0; i < n; i++) {
    const m = M.makeChunk(hex), a = rnd(6.283), s = rnd(0.4, 1) * sp;
    m.scale.setScalar(rnd(0.14, 0.3)); R.root.add(m);
    W.parts.push({ m, x, y, h, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vh: rnd(2, 6), life: rnd(0.4, 0.9) });
  }
}
function removeObj(o) { if (o && o.parent) o.parent.remove(o); }

// ---------------------------------------------------------------- world
function loadWorld() {
  R.root.clear();
  const B = buildWorld();
  W = { B, T: B.T, lamps: B.lamps.slice(), letters: [], gates: B.gates, enemies: [], shots: [], hearts: [], parts: [], pulses: [], flames: [], floats: [], barrierProps: [], lines: [], slams: [], rewrites: [], bossState: 'wait', boss: null, hinted: false, bossTries: 0, wx: { type: 0, amt: 0, col: [1, 1, 1] } };
  W.lands = LANDS.map((def, i) => ({ def, i, letters: [], wordDone: false, lit: false, entered: false, weather: def.weather.slice(), goal: B.goals[i], beacon: null }));
  R.setTerrain(B.T); R.setPalette(LANDS.flatMap(l => l.palette));
  const statics = [];
  for (const p of B.props) {
    const g = M.makeProp(p); place(g, p.x, p.y);
    let dyn = p.barrier !== undefined;
    g.traverse(m => { if (m.userData.flame || m.userData.float) dyn = true; });
    if (!dyn) { statics.push(g); continue; }
    R.root.add(g);
    g.traverse(m => { if (m.userData.flame) W.flames.push({ m, s: m.scale.clone(), ph: rnd(6) }); if (m.userData.float) W.floats.push({ m, y: m.position.y, ph: m.userData.float }); });
    if (p.barrier !== undefined) W.barrierProps.push({ g, gate: p.barrier });
  }
  for (const m of M.mergeStatic(statics)) R.root.add(m);
  for (const l of B.letters) {
    const o = M.makeLetter(l.ch); place(o.g, l.x, l.y); R.root.add(o.g);
    const L = { ...l, o, state: 'idle', ph: rnd(6), alive: [] };
    W.letters.push(L); W.lands[l.land].letters.push(L);
  }
  for (const h of B.hearts) addHeart(h.x, h.y);
  for (const r of B.roam) spawnEnemy(r.type, r.x, r.y, null, true);
  for (const land of W.lands) {
    const bc = M.makeBeacon(); place(bc.g, land.goal.x, land.goal.y); R.root.add(bc.g);
    bc.channel = 0; bc.g.visible = land.i < 4; land.beacon = bc;
    if (land.i < 4) B.T.solidCircle(land.goal.x, land.goal.y, 0.8);
  }
  if (!P.m) P.m = M.makeHero();
  R.root.add(P.m.g); P.m.g.visible = true;
  Object.assign(P, { x: B.start.x, y: B.start.y, vx: 0, vy: 0, kx: 0, ky: 0, face: 0, hp: P.maxHp, inv: 0, dashT: 0, atkT: 0, cx: B.start.x, cy: B.start.y });
  S.camX = P.x; S.camY = P.y; S.land = 0;
  const d = LANDS[0];
  S.env = { amb: d.ambient.slice(), bg: d.bg.slice(), dark: d.dark, lightR: d.lightR, a3c: new THREE.Color(d.amb3d[0]), a3i: d.amb3d[1], mc: new THREE.Color(d.moon[0]), mi: d.moon[1] };
  $('boss').style.display = 'none';
  hudHearts(); hudWord();
}
function addHeart(x, y) { const o = M.makeHeart(); place(o.g, x, y); R.root.add(o.g); W.hearts.push({ x, y, o, ph: rnd(6) }); }

// restore a saved run: letters, written words and lit lanterns
function applySave(sv) {
  for (const l of W.letters) if (sv.taken.includes(l.id)) { l.state = 'taken'; removeObj(l.o.g); }
  for (const land of W.lands) {
    if (land.letters.every(l => l.state === 'taken')) { land.wordDone = true; openGate(W.gates.find(g => g.id === 'w' + land.i), true); wordEffects(land, true); }
    if (sv.lit[land.i] && land.i < 4) { land.lit = true; land.entered = true; land.beacon.coreMat.color.setHex(0xfff1c9); W.B.brighten(land.i); }
  }
  if (W.lands.slice(0, 4).every(l => l.lit)) openGate(W.gates.find(g => g.id === 'seal'), true);
  R.touchTerrain();
  Object.assign(P, { x: sv.cp[0], y: sv.cp[1], cx: sv.cp[0], cy: sv.cp[1] });
  S.camX = P.x; S.camY = P.y; S.runT = sv.t || 0; S.deaths = sv.d || 0;
}
function openGate(g, instant = false) {
  if (g.open) return; g.open = true;
  if (instant) { for (const [cx, cy] of g.cells) W.B.paintGate(g, cx, cy); return; }
  W.rewrites.push({ g, i: 0, acc: 0, snd: 0 });
}

// ---------------------------------------------------------------- movement
function moveEnt(e, dx, dy, r) {
  let hit = false; const T = W.T;
  if (dx !== 0) { if (!T.blocked(e.x + dx, e.y, r)) e.x += dx; else hit = true; }
  if (dy !== 0) { if (!T.blocked(e.x, e.y + dy, r)) e.y += dy; else hit = true; }
  return hit;
}

// ---------------------------------------------------------------- player
function hurtPlayer(dmg, fx, fy, kb = 7) {
  if (P.inv > 0 || P.dashT > 0 || S.mode !== 'play') return;
  P.hp -= dmg; P.inv = 1.15;
  const a = Math.atan2(P.y - fy, P.x - fx); P.kx = Math.cos(a) * kb; P.ky = Math.sin(a) * kb;
  S.flash = 1; S.shake = Math.max(S.shake, 0.5); S.hitstop = 0.09; audio.play('hurt');
  burst(P.x, P.y, 1, 6, 0xff8fc8, 4); hudHearts();
  if (P.hp <= 0) die();
}
function die() {
  S.mode = 'dead'; S.deaths++; audio.play('die'); P.m.g.visible = false;
  burst(P.x, P.y, 1, 26, 0xffffff, 6); pulse(P.x, P.y, [1, 0.4, 0.5], 1.4, 8, 0.9);
  say('...and you were struck from the page.', 1.4);
  after(1.3, () => { S.revealTo = 0; });
  after(2.2, respawn);
}
function respawn() {
  for (const l of W.letters) if (l.state === 'fight') { l.state = 'idle'; l.alive = []; }
  for (const e of W.enemies) {
    if (e.owner || e.type === 'boss' || e.minion) { removeObj(e.o.g); e.dead = true; }
    else { e.x = e.hx; e.y = e.hy; e.hp = e.maxHp; e.state = 'sleep'; e.kx = e.ky = 0; }
  }
  W.enemies = W.enemies.filter(e => !e.dead);
  for (const s of W.shots) removeObj(s.g); W.shots = [];
  W.lines = []; W.slams = [];
  if (W.bossState === 'fight') { W.bossState = 'wait'; W.boss = null; $('boss').style.display = 'none'; audio.intense = false; }
  Object.assign(P, { x: P.cx, y: P.cy, vx: 0, vy: 0, kx: 0, ky: 0, hp: P.maxHp, inv: 1.6, dashT: 0, atkT: 0 });
  P.m.g.visible = true; S.camX = P.x; S.camY = P.y; S.mode = 'play'; S.revealTo = 1; hudHearts();
}

function startAttack(mx, my, moving) {
  let a = P.face;
  if (S.t - input.mouseT < 2.5 && !document.body.classList.contains('touch')) {
    const [wx, wy] = R.toWorld(input.mx, input.my); a = Math.atan2(wy - (P.y - 0.5), wx - P.x);
  } else {
    let best = null, bd = 3.6;
    for (const e of W.enemies) { const d = dist(P.x, P.y, e.x, e.y) - e.r; if (!e.dead && e.state !== 'sleep' && d < bd) { bd = d; best = e; } }
    if (best) a = Math.atan2(best.y - P.y, best.x - P.x); else if (moving) a = Math.atan2(my, mx);
  }
  P.face = a; P.combo = P.comboT > 0 ? (P.combo % 3) + 1 : 1;
  const spin = P.combo === 3;
  P.atkDur = P.atkT = spin ? 0.34 : 0.22; P.atkCd = spin ? 0.46 : 0.25; P.comboT = P.atkCd + 0.42; P.hitDone = false;
  P.kx += Math.cos(a) * (spin ? 2 : 3.4); P.ky += Math.sin(a) * (spin ? 2 : 3.4);
  audio.play(spin ? 'spin' : 'slash', P.combo);
}
function doHit() {
  const spin = P.combo === 3, range = spin ? 2.15 : 1.8, half = spin ? 4 : 1.25, dmg = spin ? 2 : 1;
  if (spin) pulse(P.x, P.y, [1, 0.95, 0.8], 0.9, 9, 0.28, 0.4);
  for (const e of W.enemies) {
    if (e.dead) continue;
    const d = dist(P.x, P.y, e.x, e.y), a = Math.atan2(e.y - P.y, e.x - P.x);
    if (d <= range + e.r && (d < 0.9 + e.r || Math.abs(angDiff(a, P.face)) <= half)) hitEnemy(e, dmg, a);
  }
  for (const s of W.shots) {
    if (!s.hostile) continue;
    const d = dist(P.x, P.y, s.x, s.y), a = Math.atan2(s.y - P.y, s.x - P.x);
    if (d <= range + 0.3 && (d < 0.9 || Math.abs(angDiff(a, P.face)) <= half)) {
      s.hostile = false; s.vx = Math.cos(a) * 10; s.vy = Math.sin(a) * 10; s.life = 1.6; audio.play('hit'); burst(s.x, s.y, 0.8, 3, 0xffffff, 3);
    }
  }
}
function updatePlayer(dt) {
  const p = P;
  let mx = 0, my = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
  mx += input.sx; my += input.sy;
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  const moving = ml > 0.12;
  p.inv = Math.max(0, p.inv - dt); p.dashCd -= dt; p.atkCd -= dt; p.comboT -= dt;
  if (input.dash) {
    input.dash = false;
    if (p.dashCd <= 0 && p.dashT <= 0) {
      const a = moving ? Math.atan2(my, mx) : p.face;
      p.dx = Math.cos(a); p.dy = Math.sin(a); p.dashT = 0.17; p.dashCd = 0.62; p.inv = Math.max(p.inv, 0.27); p.atkT = 0;
      if (moving) p.face = a;
      audio.play('dash'); pulse(p.x, p.y, [0.7, 0.75, 1], 0.5, 6, 0.3);
    }
  }
  if ((input.attack || input.held) && p.atkCd <= 0 && p.dashT <= 0) startAttack(mx, my, moving);
  input.attack = false;
  const tag = W.T.tagAt(p.x, p.y);
  if (p.dashT > 0) { p.dashT -= dt; p.vx = p.dx * 14.5; p.vy = p.dy * 14.5; }
  else {
    const sp = (p.atkT > 0 ? 1.5 : 4.7) * (tag === 3 ? 0.85 : 1), k = tag === 2 ? 2.2 : 16;
    p.vx += (mx * sp - p.vx) * Math.min(1, k * dt); p.vy += (my * sp - p.vy) * Math.min(1, k * dt);
  }
  p.kx *= Math.pow(0.0008, dt); p.ky *= Math.pow(0.0008, dt);
  moveEnt(p, (p.vx + p.kx) * dt, (p.vy + p.ky) * dt, 0.3);
  if (moving && p.atkT <= 0 && p.dashT <= 0) p.face += angDiff(Math.atan2(my, mx), p.face) * Math.min(1, 14 * dt);
  const speed = Math.hypot(p.vx, p.vy);
  p.walk += speed * dt * 2.8;
  if (speed > 1.5 && p.dashT <= 0) { p.stepT -= dt * speed; if (p.stepT <= 0) { p.stepT = 1.5; audio.play('step'); } }
  if (tag === 1 && p.dashT <= 0) { p.burnT += dt; if (p.burnT > 0.12) hurtPlayer(1, p.x - p.vx, p.y - p.vy + 0.01, 6); } else p.burnT = 0;
  if (p.atkT > 0) {
    const el = p.atkDur - p.atkT;
    if (!p.hitDone && el >= 0.06) { p.hitDone = true; doHit(); }
    p.atkT -= dt;
  }
  // which land are we standing in
  const here = W.T.regAt(p.x, p.y);
  if (here !== S.land) { S.landT += dt; if (S.landT > 0.5) enterLand(here); } else S.landT = 0;
}
function poseHero(dt) {
  const p = P, m = p.m, speed = S.mode === 'play' ? Math.hypot(p.vx, p.vy) : 0;
  place(m.g, p.x, p.y); m.g.rotation.y = rotY(p.face);
  m.body.position.y = speed > 0.5 ? Math.abs(Math.sin(p.walk)) * 0.07 : Math.sin(S.t * 2) * 0.015;
  m.body.rotation.x = p.dashT > 0 ? 0.55 : Math.min(0.2, speed * 0.04);
  m.scarf.forEach((s, i) => { s.position.x = -0.12 + Math.sin(S.t * 7 - i * 0.9) * (0.04 + i * 0.03); s.position.y = 1.16 + Math.sin(S.t * 5 - i) * 0.03 + Math.min(0.3, speed * 0.03) * i * 0.4; });
  const el = p.atkDur - p.atkT, spin = p.combo === 3;
  if (p.atkT > 0 && S.mode === 'play') {
    const k = clamp(el / p.atkDur, 0, 1), dir = p.combo === 2 ? -1 : 1;
    m.armR.rotation.set(-0.1, spin ? k * Math.PI * 2 : dir * lerp(1.7, -1.7, k), 0);
    m.arc.visible = !spin && el > 0.03 && el < 0.17; m.arc.scale.setScalar(1.35 + k * 0.5); m.arc.scale.y *= dir;
    m.spin.visible = spin && el > 0.04 && el < 0.26; m.spin.scale.setScalar(0.9 + k * 1.3);
  } else { m.armR.rotation.set(0.42 + Math.sin(p.walk) * 0.12, 0.25, 0); m.arc.visible = m.spin.visible = false; }
  m.armL.rotation.x = -0.25 + Math.sin(p.walk + 1) * 0.1;
  if (S.mode !== 'dead') m.g.visible = !(p.inv > 0 && p.dashT <= 0 && Math.floor(S.t * 22) % 2 === 0);
}
function enterLand(i) {
  S.land = i; S.landT = 0;
  const land = W.lands[i]; hudWord(); audio.setMusic(land.def.music);
  if (!land.entered) {
    land.entered = true; showCard(land.def); say(land.def.line, 3.2);
    if (!land.wordDone) after(4, () => say('Collect the letters of ' + land.def.word + '.', 2.6));
    P.cx = P.x; P.cy = P.y;
  }
}

// ---------------------------------------------------------------- enemies
const BASE = { blot: { hp: 2, r: 0.42, er: 1.05, sp: 2.5 }, scratch: { hp: 2, r: 0.38, er: 0.9, sp: 1.9 }, brute: { hp: 7, r: 0.74, er: 1.55, sp: 1.35 }, boss: { hp: 54, r: 1.5, er: 2.4, sp: 0 } };
function spawnEnemy(type, x, y, owner = null, sleep = false) {
  const b = BASE[type], o = M.makeEnemy(type), land = W.T.regAt(x, y);
  const hp = b.hp + (type === 'blot' && land >= 3 ? 1 : 0) + (type === 'brute' && land >= 4 ? 2 : 0);
  const e = { type, land, x, y, hx: x, hy: y, kx: 0, ky: 0, hp, maxHp: hp, r: b.r, er: b.er, sp: b.sp * (1 + land * 0.05), o, state: sleep ? 'sleep' : 'spawn', t: 0, cd: rnd(0.5, 1.4), face: rnd(6), dx: 0, dy: 0, flash: 0, owner, dead: false, grow: sleep ? 1 : 0, strafe: Math.random() < 0.5 ? 1 : -1, ph: rnd(6) };
  place(o.g, x, y); o.g.scale.setScalar(sleep ? 1 : 0.01); R.root.add(o.g); W.enemies.push(e);
  return e;
}
function hitEnemy(e, dmg, a) {
  if (e.dead || (e.type === 'boss' && e.state === 'spawn')) return;
  e.hp -= dmg; e.flash = 0.1;
  const kb = e.type === 'boss' ? 0 : e.type === 'brute' ? (e.state === 'charge' ? 0 : 2.2) : 7;
  e.kx = Math.cos(a) * kb; e.ky = Math.sin(a) * kb;
  if (e.state === 'sleep') e.state = 'chase';
  if (e.type !== 'boss' && e.type !== 'brute' && (e.state === 'wind' || e.state === 'leap')) { e.state = 'chase'; e.cd = 0.5; }
  burst(e.x, e.y, 0.9, 4, 0xffffff, 4); audio.play('hit');
  S.hitstop = Math.max(S.hitstop, dmg > 1 ? 0.07 : 0.04); S.shake = Math.max(S.shake, 0.16);
  if (e.type === 'boss') $('bossbar').firstChild.style.width = clamp(e.hp / e.maxHp * 100, 0, 100) + '%';
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true;
  if (e.type === 'boss') return bossDead(e);
  removeObj(e.o.g); audio.play('kill');
  burst(e.x, e.y, 0.8, e.type === 'brute' ? 22 : 12, 0xc9a8ff, 6); pulse(e.x, e.y, [0.8, 0.7, 1], 1, 7, 0.5);
  if (Math.random() < (P.hp <= 2 ? 0.45 : 0.16)) addHeart(e.x, e.y);
  if (e.owner) {
    const l = e.owner; l.alive = l.alive.filter(x => x !== e);
    if (l.alive.length === 0 && l.state === 'fight') { l.state = 'free'; audio.play('free'); pulse(l.x, l.y, [1, 0.95, 0.75], 1.5, 6, 1.0); say('The letter ' + l.ch + ' is free.', 1.6); }
  }
}
function fire(x, y, a, sp = 5.4) {
  const g = M.makeShot(); place(g, x, y); R.root.add(g);
  W.shots.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 3.4, g, hostile: true });
}
function updateEnemy(e, dt) {
  const d = dist(e.x, e.y, P.x, P.y), o = e.o;
  if (e.state === 'sleep' && d > 26) return;            // far away and asleep: nothing to do
  const a = Math.atan2(P.y - e.y, P.x - e.x);
  e.t += dt; e.cd -= dt;
  if (e.flash > 0) { e.flash -= dt; M.setFlash(o, e.flash > 0); }
  e.kx *= Math.pow(0.002, dt); e.ky *= Math.pow(0.002, dt);
  let vx = 0, vy = 0, sy = 1, sxz = 1, hop = 0, lean = 0;
  const alive = S.mode === 'play';
  if (e.state === 'spawn') { e.grow = Math.min(1, e.grow + dt / 0.7); if (e.grow >= 1) { e.state = 'chase'; e.t = 0; } }
  else if (e.state === 'sleep') { if (d < 6.2 && alive) { e.state = 'chase'; e.t = 0; audio.play('spawn'); } hop = Math.sin(S.t * 2 + e.ph) * 0.04; }
  else if (!e.owner && !e.minion && d > 15) { e.state = 'sleep'; e.x = e.hx; e.y = e.hy; }   // lost interest, back to its post
  else if (e.type === 'blot') {
    if (e.state === 'chase') {
      e.face = a; vx = Math.cos(a) * e.sp; vy = Math.sin(a) * e.sp; hop = Math.abs(Math.sin(e.t * 7 + e.ph)) * 0.22;
      if (d < 2.5 && e.cd <= 0 && alive) { e.state = 'wind'; e.t = 0; }
      if (d < e.r + 0.3) hurtPlayer(1, e.x, e.y);
    } else if (e.state === 'wind') {
      sy = 1 - Math.min(0.45, e.t * 1.4); sxz = 1 + Math.min(0.3, e.t); e.face = a;
      if (e.t > 0.38) { e.state = 'leap'; e.t = 0; e.dx = Math.cos(a); e.dy = Math.sin(a); }
    } else if (e.state === 'leap') {
      vx = e.dx * 8.4; vy = e.dy * 8.4; hop = Math.sin(e.t / 0.32 * Math.PI) * 0.7; sy = 1.2;
      if (d < e.r + 0.42) hurtPlayer(1, e.x, e.y);
      if (e.t > 0.32) { e.state = 'chase'; e.t = 0; e.cd = rnd(0.9, 1.5); }
    }
  } else if (e.type === 'scratch') {
    hop = 0.15 + Math.sin(S.t * 3 + e.ph) * 0.1; o.ring.rotation.z += dt * 3;
    if (e.state === 'chase') {
      e.face = a; o.ring.scale.setScalar(1.2);
      if (d > 5.6) { vx = Math.cos(a) * e.sp; vy = Math.sin(a) * e.sp; }
      else if (d < 3.3) { vx = -Math.cos(a) * e.sp * 1.2; vy = -Math.sin(a) * e.sp * 1.2; }
      else { vx = -Math.sin(a) * e.sp * e.strafe; vy = Math.cos(a) * e.sp * e.strafe; if (Math.random() < dt * 0.4) e.strafe *= -1; }
      if (e.cd <= 0 && d < 8.5 && alive) { e.state = 'wind'; e.t = 0; audio.play('warn'); }
    } else if (e.state === 'wind') {
      e.face = a; o.ring.scale.setScalar(1.2 + e.t * 0.9); o.ring.rotation.z += dt * 12;
      if (Math.floor(e.t * 16) % 2 === 0) e.flash = Math.max(e.flash, 0.03);
      if (e.t > 0.55) {
        const n = e.land >= 3 ? 3 : 1;
        for (let i = 0; i < n; i++) fire(e.x, e.y, a + (i - (n - 1) / 2) * 0.3, 5.2 + e.land * 0.25);
        audio.play('shot'); e.state = 'chase'; e.t = 0; e.cd = rnd(1.9, 2.7) - e.land * 0.12;
      }
    }
  } else if (e.type === 'brute') {
    if (e.state === 'chase') {
      e.face += angDiff(a, e.face) * Math.min(1, 5 * dt); vx = Math.cos(a) * e.sp; vy = Math.sin(a) * e.sp;
      hop = Math.abs(Math.sin(e.t * 4)) * 0.08; o.armL.rotation.x = Math.sin(e.t * 4) * 0.5; o.armR.rotation.x = -Math.sin(e.t * 4) * 0.5;
      if (d < 5.4 && e.cd <= 0 && alive) { e.state = 'wind'; e.t = 0; audio.play('warn'); }
      if (d < e.r + 0.3) hurtPlayer(1, e.x, e.y, 8);
    } else if (e.state === 'wind') {
      e.face += angDiff(a, e.face) * Math.min(1, 8 * dt); lean = -0.25; o.armL.rotation.x = o.armR.rotation.x = -1.2;
      if (Math.floor(e.t * 14) % 2 === 0) e.flash = Math.max(e.flash, 0.035);
      if (e.t > 0.75) { e.state = 'charge'; e.t = 0; e.dx = Math.cos(e.face); e.dy = Math.sin(e.face); audio.play('charge'); }
    } else if (e.state === 'charge') {
      lean = 0.4; vx = e.dx * 9.6; vy = e.dy * 9.6;
      if (d < e.r + 0.5) hurtPlayer(1, e.x, e.y, 11);
      const blockedX = W.T.blocked(e.x + vx * dt, e.y, e.r * 0.8), blockedY = W.T.blocked(e.x, e.y + vy * dt, e.r * 0.8);
      if ((blockedX && Math.abs(e.dx) > 0.5) || (blockedY && Math.abs(e.dy) > 0.5) || e.t > 0.8) {
        const wall = e.t <= 0.8; e.state = 'stun'; e.t = 0; e.stunT = wall ? 1.3 : 0.6;
        if (wall) { S.shake = Math.max(S.shake, 0.4); audio.play('slam'); burst(e.x, e.y, 1, 8, 0xc9a8ff, 5); pulse(e.x, e.y, [0.8, 0.7, 1], 1, 6, 0.5); }
      }
    } else if (e.state === 'stun') { lean = 0.5; hop = 0; o.armL.rotation.x = o.armR.rotation.x = 0.6; if (e.t > e.stunT) { e.state = 'chase'; e.t = 0; e.cd = 1.5; } }
  }
  for (const b of W.enemies) {
    if (b === e || b.dead || b.type === 'boss') continue;
    const dd = dist(e.x, e.y, b.x, b.y), min = e.r + b.r;
    if (dd < min && dd > 0.001) { vx += (e.x - b.x) / dd * 2.5; vy += (e.y - b.y) / dd * 2.5; }
  }
  moveEnt(e, (vx + e.kx) * dt, (vy + e.ky) * dt, e.r * 0.8);
  place(o.g, e.x, e.y, hop); o.g.rotation.y = rotY(e.face);
  o.g.scale.set(e.grow * sxz, e.grow * sy, e.grow * sxz); o.body.rotation.x = lean;
}

// ---------------------------------------------------------------- THE EDITOR
const PATTERN = ['slam', 'line', 'drift', 'burst', 'slam', 'summon', 'line', 'drift'];
const arena = () => W.B.goals[4];
function startBoss() {
  const c = arena(); W.bossState = 'fight';
  const e = spawnEnemy('boss', c.x + 1.5, c.y - 2.6); W.boss = e; e.pi = 0; e.phase = 1; e.wait = 1.2; e.tx = e.x; e.ty = e.y;
  // each defeat makes the Editor a little shorter-winded
  e.maxHp = e.hp = Math.round(e.hp * Math.max(0.6, 1 - W.bossTries * 0.1)); W.bossTries++;
  $('boss').style.display = 'block'; $('bossbar').firstChild.style.width = '100%';
  audio.intense = true; audio.play('spawn'); S.shake = 0.7; pulse(e.x, e.y, [1, 0.2, 0.35], 1.6, 6, 1.2);
  say('THE EDITOR: "You were cut for length."', 2.8);
}
function arenaClamp(x, y, r = 6.2) { const c = arena(), d = dist(x, y, c.x, c.y); return d > r ? [c.x + (x - c.x) / d * r, c.y + (y - c.y) / d * r] : [x, y]; }
function addSlam(delay, hand) { W.slams.push({ t: -delay, dur: W.boss.phase === 3 ? 0.58 : 0.78, hand, x: 0, y: 0, set: false, done: false }); }
function addLine(pos, dir, delay = 0) { W.lines.push({ pos, dir, hw: 0.78, t: -delay, tele: W.boss.phase === 3 ? 0.78 : 0.98, hit: false }); }
function updateBoss(e, dt) {
  const c = arena(), o = e.o;
  const phase = e.hp > e.maxHp * 0.66 ? 1 : e.hp > e.maxHp * 0.33 ? 2 : 3;
  if (phase !== e.phase) {
    e.phase = phase; S.shake = 0.8; pulse(e.x, e.y, [1, 0.2, 0.35], 1.8, 9, 1.0); audio.play('slam');
    say(phase === 2 ? 'THE EDITOR: "Strike that."' : 'THE EDITOR: "DELETE. DELETE. DELETE."', 2.2);
  }
  e.t += dt;
  if (e.flash > 0) { e.flash -= dt; M.setFlash(o, e.flash > 0); }
  if (e.state === 'spawn') { e.grow = Math.min(1, e.grow + dt / 1.4); if (e.grow >= 1) { e.state = 'idle'; e.t = 0; } }
  else if (e.state === 'idle') {
    if (e.t > e.wait && S.mode === 'play') {
      let atk = PATTERN[e.pi++ % PATTERN.length];
      const minions = W.enemies.filter(x => x.minion && !x.dead).length;
      if (atk === 'summon' && minions >= 4) atk = 'burst';
      e.state = atk; e.t = 0; e.step = 0;
      if (atk === 'slam') { for (let i = 0; i < phase; i++) addSlam(i * 0.62, i % 2); e.end = phase * 0.62 + 0.9; }
      if (atk === 'line') {
        const dir = Math.random() < 0.5 ? 0 : 1;
        if (phase === 1) addLine(dir ? P.x : P.y, dir);
        else if (phase === 2) { addLine(P.y, 0); addLine(P.x, 1, 0.25); }
        else { for (let i = -1; i <= 1; i++) addLine((dir ? P.x : P.y) + i * 2.5, dir); addLine(dir ? P.y : P.x, 1 - dir, 0.7); }
        audio.play('warn'); e.end = phase === 3 ? 2.1 : 1.6;
      }
      if (atk === 'burst') e.end = phase > 1 ? 1.5 : 0.9;
      if (atk === 'summon') e.end = 1.0;
      if (atk === 'drift') {
        let tries = 0; do { const a = rnd(6.283), r = rnd(1.5, 4.2); e.tx = c.x + Math.cos(a) * r; e.ty = c.y + Math.sin(a) * r * 0.8; } while (dist(e.tx, e.ty, P.x, P.y) < 3 && ++tries < 12);
        e.end = 1.3;
      }
    }
  } else {
    if (e.state === 'drift') { const d = dist(e.x, e.y, e.tx, e.ty); if (d > 0.1) { const s = Math.min(d, 5 * dt); e.x += (e.tx - e.x) / d * s; e.y += (e.ty - e.y) / d * s; } }
    if (e.state === 'burst') {
      const waves = phase > 1 ? 2 : 1;
      while (e.step < waves && e.t > 0.35 + e.step * 0.6) {
        const n = 8 + phase * 3, off = rnd(6.283);
        for (let i = 0; i < n; i++) fire(e.x, e.y + 0.4, off + i / n * 6.283, 3.9 + phase * 0.3);
        audio.play('shot'); audio.play('strike'); pulse(e.x, e.y, [1, 0.2, 0.35], 1, 8, 0.5); e.step++;
      }
    }
    if (e.state === 'summon' && e.step === 0 && e.t > 0.4) {
      e.step = 1; audio.play('spawn');
      for (let i = 0; i < (phase === 1 ? 2 : 3); i++) { const a = rnd(6.283); const [x, y] = arenaClamp(e.x + Math.cos(a) * 2.6, e.y + 1 + Math.sin(a) * 2.2, 6); if (!W.T.blocked(x, y, 0.4)) spawnEnemy(phase === 3 && i === 0 ? 'scratch' : 'blot', x, y).minion = true; }
    }
    if (e.t > e.end) { e.state = 'idle'; e.t = 0; e.wait = phase === 1 ? 0.95 : phase === 2 ? 0.65 : 0.4; }
  }
  const hov = Math.sin(S.t * 1.6) * 0.18;
  place(o.g, e.x, e.y, 0.5 + hov); o.g.scale.setScalar(Math.max(0.01, e.grow));
  const a = Math.atan2(P.y - e.y, P.x - e.x); e.face += angDiff(a, e.face) * Math.min(1, 3 * dt);
  o.body.rotation.y = rotY(e.face); o.eye.scale.y = 0.62 * (0.7 + 0.3 * Math.sin(S.t * 5));
  o.hands.forEach((h, i) => {
    const sl = W.slams.find(s => s.hand === i && s.set && s.t < s.dur + 0.5);
    let tx = (i ? 1 : -1) * 2.7, ty = 1.5 + Math.sin(S.t * 2 + i * 2) * 0.2, tz = 0.5;
    if (sl) { tx = sl.x - e.x; tz = (sl.y - e.y) / SIN; ty = sl.t < sl.dur ? 3.4 : -0.3 - hov; }
    const k = Math.min(1, (sl && sl.t >= sl.dur ? 40 : 7) * dt);
    h.position.x = lerp(h.position.x, tx, k); h.position.y = lerp(h.position.y, ty, k); h.position.z = lerp(h.position.z, tz, k);
  });
}
function updateBossHazards(dt) {
  for (const s of W.slams) {
    s.t += dt; if (s.t < 0) continue;
    if (!s.set) { s.set = true; [s.x, s.y] = arenaClamp(P.x, P.y); audio.play('warn'); }
    if (!s.done && s.t >= s.dur) {
      s.done = true; S.shake = Math.max(S.shake, 0.7); audio.play('slam');
      pulse(s.x, s.y, [1, 0.3, 0.4], 1.6, 9, 0.6, 0.6); burst(s.x, s.y, 0.3, 12, 0xff3a5a, 7);
      if (dist(P.x, P.y, s.x, s.y) < 1.75) hurtPlayer(1, s.x, s.y, 9);
    }
  }
  W.slams = W.slams.filter(s => s.t < s.dur + 0.55);
  for (const l of W.lines) {
    l.t += dt;
    if (!l.hit && l.t >= l.tele) { l.hit = true; audio.play('strike'); S.shake = Math.max(S.shake, 0.4); }
    if (l.t >= l.tele && l.t < l.tele + 0.2 && Math.abs((l.dir ? P.x : P.y) - l.pos) < l.hw * 0.92) hurtPlayer(1, l.dir ? l.pos : P.x, l.dir ? P.y : l.pos, 5);
  }
  W.lines = W.lines.filter(l => l.t < l.tele + 0.24);
}
function bossDead(e) {
  W.bossState = 'dying'; W.lines = []; W.slams = []; audio.play('bossdie'); audio.intense = false; S.hitstop = 0.25;
  for (const m of W.enemies) if (m !== e && !m.dead && (m.minion || dist(m.x, m.y, e.x, e.y) < 12)) { m.dead = true; removeObj(m.o.g); burst(m.x, m.y, 0.8, 10, 0xc9a8ff, 6); }
  for (const s of W.shots) removeObj(s.g); W.shots = [];
  for (let i = 0; i < 10; i++) after(i * 0.2, () => { S.shake = 0.6; burst(e.x + rnd(-1.6, 1.6), e.y + rnd(-1, 1), rnd(1, 3), 12, i % 2 ? 0xff3a5a : 0xffffff, 8); pulse(e.x, e.y, [1, 0.9, 0.8], 1.4, 10, 0.7); });
  say('THE EDITOR: "...fine. Leave it in."', 2.6);
  after(2.1, () => {
    removeObj(e.o.g); W.enemies = W.enemies.filter(x => x !== e); W.boss = null; W.bossState = 'dead'; $('boss').style.display = 'none';
    const bc = W.lands[4].beacon; bc.g.visible = true; S.amb = 0.5; pulse(arena().x, arena().y, [1, 0.95, 0.75], 2, 6, 1.6);
    say('One lantern left. Light it.', 3);
  });
}

// ---------------------------------------------------------------- world rules
function updateWorld(dt) {
  const B = W.B, play = S.mode === 'play';
  for (const l of W.letters) {
    if (l.state === 'taken') continue;
    const d = dist(P.x, P.y, l.x, l.y), o = l.o;
    if (d > 30) continue;
    l.ph += dt;
    o.lit.position.y = o.dim.position.y = 1.25 + Math.sin(l.ph * 2) * 0.12;
    o.cage.rotation.y += dt * 1.2; o.cage.rotation.x = Math.sin(l.ph) * 0.2;
    if (l.state === 'idle' && d < 4.8 && play) {
      if (!l.guards.length) l.state = 'free';
      else {
        l.state = 'fight'; audio.play('spawn');
        if (!W.hinted) { W.hinted = true; say('Something guards this letter. Unwrite it first.', 2.4); }
        l.guards.forEach((type, i) => {
          let x = l.x, y = l.y;
          for (let k = 0; k < 14; k++) {
            const a = i / l.guards.length * 6.283 + l.ph + k * 0.9, r = 2.2 + (k % 3) * 0.5;
            x = l.x + Math.cos(a) * r; y = l.y + Math.sin(a) * r;
            if (!W.T.blocked(x, y, 0.6) && dist(x, y, P.x, P.y) > 1.8) break;
          }
          const e = spawnEnemy(type, x, y, l); l.alive.push(e);
        });
      }
    }
    const free = l.state === 'free';
    o.lit.visible = free; o.dim.visible = !free; o.cage.visible = !free;
    if (free && d < 1.05 && play) {
      const land = W.lands[l.land];
      l.state = 'taken'; removeObj(o.g); audio.play('letter', land.letters.filter(x => x.state === 'taken').length);
      pulse(l.x, l.y, [1, 0.95, 0.75], 1.6, 8, 0.8); burst(l.x, l.y, 1.2, 14, 0xfff1c9, 6);
      P.cx = l.x; P.cy = l.y; if (P.hp < P.maxHp) { P.hp++; hudHearts(); }
      if (land.letters.every(x => x.state === 'taken')) wordComplete(land); else hudWord();
      save();
    }
  }
  for (const h of W.hearts) {
    h.ph += dt; h.o.s.position.y = 0.7 + Math.sin(h.ph * 3) * 0.1;
    if (!h.gone && P.hp < P.maxHp && dist(P.x, P.y, h.x, h.y) < 0.85 && play) { h.gone = true; removeObj(h.o.g); P.hp++; hudHearts(); audio.play('heart'); pulse(h.x, h.y, [1, 0.5, 0.7], 1, 5, 0.4); }
  }
  W.hearts = W.hearts.filter(h => !h.gone);
  // words being written back into the ground
  for (const rw of W.rewrites) {
    const n = rw.g.cells.length; rw.acc += n / 1.9 * dt; rw.snd -= dt;
    while (rw.acc >= 1 && rw.i < n) { const [cx, cy] = rw.g.cells[rw.i++]; B.paintGate(rw.g, cx, cy); rw.acc--; }
    R.touchTerrain(); if (rw.snd <= 0) { rw.snd = 0.05; audio.play('type'); }
    if (rw.i >= n) { rw.done = true; pulse(rw.g.B.x, rw.g.B.y, [1, 0.95, 0.75], 1.4, 7, 0.9); }
  }
  W.rewrites = W.rewrites.filter(r => !r.done);
  for (const b of W.barrierProps) { if (b.melt) { b.g.scale.multiplyScalar(Math.pow(0.02, dt)); if (b.g.scale.y < 0.03) { removeObj(b.g); b.gone = true; } } }
  W.barrierProps = W.barrierProps.filter(b => !b.gone);
  // crossing a written bridge moves the checkpoint to the far side
  for (const g of W.gates) if (g.open && !g.crossed && dist(P.x, P.y, g.B.x, g.B.y) < 1.6) { g.crossed = true; P.cx = g.B.x; P.cy = g.B.y; }
  const ar = arena(), last = W.lands[4];
  if (W.bossState === 'wait' && last.wordDone && !W.rewrites.length && dist(P.x, P.y, ar.x, ar.y) < 6.4 && play) startBoss();
  for (const land of W.lands) {
    const bc = land.beacon, g = land.goal;
    if (!bc.g.visible) continue;
    const can = !land.lit && land.wordDone && play && (land.i < 4 || W.bossState === 'dead');
    if (can && dist(P.x, P.y, g.x, g.y) < 2.3) {
      bc.channel += dt; if (Math.random() < dt * 9) pulse(g.x, g.y, [1, 0.9, 0.6], 0.6, -4, 0.5, 2.3);
      if (bc.channel > 1.1) lightBeacon(land);
    } else bc.channel = Math.max(0, bc.channel - dt);
    bc.core.rotation.y += dt * (land.lit ? 2 : 0.4 + bc.channel * 5);
  }
  for (const f of W.flames) { const k = 0.85 + Math.sin(S.t * 9 + f.ph) * 0.12 + Math.sin(S.t * 23 + f.ph * 2) * 0.06; f.m.scale.set(f.s.x * (2 - k), f.s.y * k, f.s.z * (2 - k)); }
  for (const f of W.floats) { f.m.position.y = f.y + Math.sin(S.t * 0.9 + f.ph) * 0.25; f.m.rotation.y += dt * 0.3; }
  for (const s of W.shots) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; place(s.g, s.x, s.y); s.g.rotation.y += dt * 8;
    if (s.hostile) { if (dist(s.x, s.y, P.x, P.y) < 0.5 && play && P.dashT <= 0) { hurtPlayer(1, s.x - s.vx, s.y - s.vy, 5); if (P.inv > 1) s.life = 0; } }
    else for (const e of W.enemies) if (!e.dead && dist(s.x, s.y, e.x, e.y) < e.r + 0.35) { hitEnemy(e, 1, Math.atan2(s.vy, s.vx)); s.life = 0; break; }
    if (s.life <= 0) { removeObj(s.g); burst(s.x, s.y, 0.8, 3, 0xff3a5a, 3); }
  }
  W.shots = W.shots.filter(s => s.life > 0);
  for (const p of W.parts) { p.life -= dt; p.vh -= 14 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.h = Math.max(0.05, p.h + p.vh * dt); place(p.m, p.x, p.y, p.h); p.m.rotation.x += dt * 9; p.m.rotation.y += dt * 7; if (p.life <= 0) removeObj(p.m); }
  W.parts = W.parts.filter(p => p.life > 0);
  for (const p of W.pulses) { p.life -= dt; p.r = Math.max(0.05, p.r + p.v * dt); }
  W.pulses = W.pulses.filter(p => p.life > 0);
  // the air of the land we are in
  const land = W.lands[S.land], d = land.def, e = S.env, k = Math.min(1, dt * 1.3);
  for (let i = 0; i < 3; i++) { e.amb[i] = lerp(e.amb[i], d.ambient[i], k); e.bg[i] = lerp(e.bg[i], d.bg[i], k); }
  e.dark = lerp(e.dark, d.dark, k); e.lightR = lerp(e.lightR, d.lightR, k); e.a3i = lerp(e.a3i, d.amb3d[1], k); e.mi = lerp(e.mi, d.moon[1], k);
  e.a3c.lerp(new THREE.Color(d.amb3d[0]), k); e.mc.lerp(new THREE.Color(d.moon[0]), k);
  const wx = W.wx, tw = land.weather;
  if (wx.type !== tw[0]) { wx.amt -= dt * 0.2; if (wx.amt <= 0) { wx.amt = 0; wx.type = tw[0]; wx.col = tw[2]; } }
  else { wx.amt = lerp(wx.amt, tw[1], Math.min(1, dt * 0.8)); wx.col = tw[2]; }
}
function wordEffects(land, instant = false) {
  for (const b of W.barrierProps) if (b.gate === land.i) { if (instant) { removeObj(b.g); b.gone = true; } else b.melt = true; }
  if (land.i === 2) { land.weather = [1, 0.11, [0.5, 0.75, 1.0]]; W.B.coolHazard(); R.touchTerrain(); }
  if (land.i === 3 && !instant) audio.play('ice');
}
function wordComplete(land) {
  const def = land.def, g = W.gates.find(x => x.id === 'w' + land.i);
  land.wordDone = true; hudWord(); audio.play('word'); S.shake = 0.3;
  say(def.doneLine, 3.2);
  openGate(g); wordEffects(land);
  P.cx = g.A.x; P.cy = g.A.y;
  after(3.4, () => say(land.i === 4 ? 'Cross. The Editor is waiting.' : 'Cross, and light the lantern.', 2.6));
}
function lightBeacon(land) {
  const bc = land.beacon, g = land.goal; land.lit = true; bc.coreMat.color.setHex(0xfff1c9); audio.play('beacon');
  S.amb = 0.9; S.shake = 0.3;
  for (let i = 0; i < 5; i++) after(i * 0.35, () => pulse(g.x, g.y, [1, 0.95, 0.75], 1.6, 12, 1.6));
  burst(g.x, g.y, 2, 30, 0xfff1c9, 8);
  if (land.i === 4) { S.mode = 'clear'; say('The page is whole. Nobody gets to cut it now.', 3); clearSave(); after(5, ending); return; }
  W.B.brighten(land.i); R.touchTerrain(); hudWord();
  const n = W.lands.slice(0, 4).filter(l => l.lit).length;
  say('The lantern is lit. ' + land.def.name + ' can be read again.', 3);
  if (n === 4) after(3.6, () => { openGate(W.gates.find(x => x.id === 'seal')); audio.play('word'); say('Four lanterns. The road into THE BLANK is being written.', 3.4); });
  else after(3.6, () => say((4 - n) + ' lantern' + (4 - n === 1 ? '' : 's') + ' left. Zoom out and pick a land.', 3));
  P.cx = g.x; P.cy = g.y + 1.6; save();
}
function ending() {
  S.mode = 'end'; $('hud').classList.remove('on');
  const t = Math.floor(S.runT), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
  $('stats').textContent = `The world written back in ${mm}:${ss}. Struck from the page ${S.deaths} time${S.deaths === 1 ? '' : 's'}.`;
  $('end').classList.add('on');
  const text = `I wrote the world back in ${mm}:${ss} with ${S.deaths} death${S.deaths === 1 ? '' : 's'}. UNWRITTEN, an ASCII action game in the browser:`;
  $('share').href = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(location.hostname.endsWith('github.io') ? location.href.split(/[?#]/)[0] : 'https://tetriss22.github.io/unwritten/');
}

// ---------------------------------------------------------------- frame
const zoomBright = () => clamp((0.95 - S.zoom) / 0.5, 0, 1);
function fillUniforms() {
  const u = R.u, env = S.env;
  const Ls = [];
  const fl = 1 + Math.sin(S.t * 11) * 0.02 + Math.sin(S.t * 4.3) * 0.03;
  if (S.mode !== 'dead') Ls.push([P.x, P.y, env.lightR * fl, 1.05, 1.0, 0.9, 0.72, 0]);
  for (const l of W.lamps) Ls.push([l.x, l.y, l.r, l.int * (0.9 + Math.sin(S.t * 6 + l.ph) * 0.08), ...l.col, dist(l.x, l.y, S.camX, S.camY)]);
  for (const l of W.letters) if (l.state !== 'taken') Ls.push(l.state === 'free' ? [l.x, l.y, 3.2, 1.1, 1, 0.92, 0.7, 1] : [l.x, l.y, 2.2, 0.7, 1, 0.25, 0.35, dist(l.x, l.y, S.camX, S.camY)]);
  for (const s of W.shots) Ls.push([s.x, s.y, 1.8, 0.9, 1, 0.25, 0.35, 2]);
  for (const h of W.hearts) Ls.push([h.x, h.y, 1.3, 0.7, 1, 0.45, 0.65, dist(h.x, h.y, S.camX, S.camY) + 2]);
  for (const land of W.lands) {
    const bc = land.beacon, g = land.goal; if (!bc.g.visible) continue;
    Ls.push(land.lit ? [g.x, g.y, 12, 1.5, 1, 0.92, 0.7, dist(g.x, g.y, S.camX, S.camY) * 0.3] : [g.x, g.y, 3 + bc.channel * 3, 0.5 + bc.channel, 1, 0.9, 0.7, dist(g.x, g.y, S.camX, S.camY)]);
  }
  if (W.boss) Ls.push([W.boss.x, W.boss.y, 4.5, 0.8, 1, 0.2, 0.35, 0]);
  Ls.sort((a, b) => a[7] - b[7]);
  for (let i = 0; i < MAX_LIGHTS; i++) {
    const l = Ls[i]; if (l) { u.uLights.value[i].set(l[0], l[1], l[2], l[3]); u.uLightCol.value[i].set(l[4], l[5], l[6]); } else u.uLights.value[i].set(0, 0, 1, 0);
  }
  const pts = R.points; let pi = 0;
  const setP = (x, y, h, col, int, d) => { if (pi < pts.length) { const p = pts[pi++]; place(p, x, y, h); p.color.setRGB(col[0], col[1], col[2]); p.intensity = int; p.distance = d; } };
  if (S.mode !== 'dead') setP(P.x, P.y + 0.3, 1.3, [1, 0.88, 0.7], 9 * fl, env.lightR + 2.5);
  let n1 = null, n2 = null, d1 = 1e9, d2 = 1e9;
  for (const l of W.lamps) { const d = dist(l.x, l.y, S.camX, S.camY); if (d < d1) { d2 = d1; n2 = n1; d1 = d; n1 = l; } else if (d < d2) { d2 = d; n2 = l; } }
  for (const l of [n1, n2]) if (l) setP(l.x, l.y + 0.3, 1.9, l.col, 6, 6);
  while (pi < pts.length) pts[pi++].intensity = 0;
  const er = [];
  for (const e of W.enemies) { if (e.dead) continue; const d = dist(e.x, e.y, P.x, P.y); if (d < 40) er.push([e.x, e.y, e.er * e.grow * (e.state === 'sleep' ? 0.75 : 1), d]); }
  for (const s of W.slams) if (s.set && !s.done) er.push([s.x, s.y, 1.75 * clamp(s.t / s.dur, 0, 1), 0]);
  er.sort((a, b) => a[3] - b[3]);
  for (let i = 0; i < MAX_ERASE; i++) { const e = er[i]; if (e) u.uErase.value[i].set(e[0], e[1], e[2]); else u.uErase.value[i].set(0, 0, 0); }
  const ps = W.pulses.slice(-MAX_PULSE);
  for (const s of W.slams) if (s.set && !s.done && ps.length < MAX_PULSE) ps.push({ x: s.x, y: s.y, r: 1.75, life: 1, max: 1, col: [1, 0.15, 0.25], w: 0.9 + Math.sin(S.t * 30) * 0.3 });
  for (let i = 0; i < MAX_PULSE; i++) { const p = ps[i]; if (p) { u.uPulse.value[i].set(p.x, p.y, p.r, p.w * clamp(p.life / p.max, 0, 1)); u.uPulseCol.value[i].set(...p.col); } else u.uPulse.value[i].set(0, 0, 0, 0); }
  for (let i = 0; i < 4; i++) { const l = W.lines[i]; if (l && l.t >= 0) u.uLine.value[i].set(l.pos, l.dir, l.hw, l.t < l.tele ? 0.3 + 0.3 * (Math.floor(l.t * 12) % 2) + l.t / l.tele * 0.3 : 2.2); else u.uLine.value[i].set(0, 0, 0, 0); }
  // pulling the camera back turns the lights up, so the map can be read
  const k = S.amb + zoomBright() * 0.85, a = env.amb;
  u.uMap.value = clamp((0.6 - S.zoom) / 0.3, 0, 1);
  u.uAmbient.value.set(a[0] + k * 0.75, a[1] + k * 0.72, a[2] + k * 0.66);
  u.uBg.value.set(env.bg[0], env.bg[1], env.bg[2]);
  u.uDark.value = env.dark * (1 - zoomBright()) - zoomBright() * 0.55;
  u.uPlayer.value.set(P.x, P.y); u.uReveal.value = S.reveal; u.uFlash.value = S.flash;
  u.uWeather.value = W.wx.type; u.uWeatherAmt.value = W.wx.amt * (1 - zoomBright() * 0.7); u.uWeatherCol.value.set(...W.wx.col);
  R.ambient.color.copy(env.a3c); R.ambient.intensity = env.a3i + k * 1.1;
  R.moon.color.copy(env.mc); R.moon.intensity = env.mi;
}
function objective() {
  if (S.mode !== 'play' || W.bossState === 'fight' || W.bossState === 'dying') return null;
  const nearestLetter = (land) => { let best = null, bd = 1e9; for (const l of land.letters) if (l.state !== 'taken') { const d = dist(P.x, P.y, l.x, l.y); if (d < bd) { bd = d; best = l; } } return best && { x: best.x, y: best.y, label: best.ch }; };
  const land = W.lands[S.land];
  if (!land.wordDone) return nearestLetter(land);
  if (!land.lit) return { x: land.goal.x, y: land.goal.y, label: land.i === 4 ? (W.bossState === 'dead' ? 'LANTERN' : 'EDITOR') : 'LANTERN' };
  const left = W.lands.slice(0, 4).filter(l => !l.lit);
  if (left.length) { left.sort((a, b) => dist(P.x, P.y, W.B.centers[a.i].x, W.B.centers[a.i].y) - dist(P.x, P.y, W.B.centers[b.i].x, W.B.centers[b.i].y)); const c = W.B.centers[left[0].i]; return { x: c.x, y: c.y, label: left[0].def.name }; }
  const sb = W.B.N.sB; return { x: sb.x, y: sb.y, label: 'THE BLANK' };
}
function updateOverlay() {
  const el = $('arrow'), tgt = objective(), w = innerWidth, h = innerHeight, mg = 64;
  let shown = false;
  if (tgt) {
    const [sx, sy] = R.toScreen(tgt.x, tgt.y, 1);
    if (!(sx > mg && sx < w - mg && sy > mg + 40 && sy < h - mg)) {
      const cx = w / 2, cy = h / 2, dx = sx - cx, dy = sy - cy, k = Math.min((cx - mg) / Math.abs(dx || 1e-6), (cy - mg - 20) / Math.abs(dy || 1e-6));
      el.style.transform = `translate(${cx + dx * k - 10}px, ${cy + dy * k - 18}px)`;
      el.innerHTML = `<span style="display:inline-block;transform:rotate(${Math.atan2(dy, dx)}rad)">&gt;</span><small>${tgt.label}</small>`;
      shown = true;
    }
  }
  el.style.display = shown ? 'block' : 'none';
  // map labels once the camera is far enough back
  const far = clamp((0.42 - S.zoom) / 0.12, 0, 1), map = $('map');
  map.style.opacity = S.mode === 'play' || S.mode === 'title' ? far : 0;
  if (far > 0) {
    W.lands.forEach((land, i) => {
      const c = W.B.centers[i], [x, y] = R.toScreen(c.x, c.y - (i === 4 ? 9 : 0)), d = map.children[i];
      d.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      const st = land.lit ? 'LIT' : land.wordDone ? 'WRITTEN' : land.letters.filter(l => l.state === 'taken').length + '/' + land.letters.length;
      if (d.dataset.st !== st) { d.dataset.st = st; d.innerHTML = `<b>${land.def.roman}</b> ${land.def.name}<small>${st}</small>`; d.classList.toggle('lit', land.lit); }
    });
    const [px, py] = R.toScreen(P.x, P.y, 1); map.children[5].style.transform = `translate(${px}px, ${py}px) translate(-50%, -100%)`;
  }
}

function step(dt) {
  if (S.hitstop > 0) { S.hitstop -= dt; dt *= 0.05; }
  S.t += dt;
  for (const tm of S.timers) tm.t -= dt;
  const due = S.timers.filter(tm => tm.t <= 0); S.timers = S.timers.filter(tm => tm.t > 0); for (const tm of due) tm.fn();
  S.reveal += clamp(S.revealTo - S.reveal, -dt * 1.6, dt * 1.1);
  S.amb = Math.max(0, S.amb - dt * 0.3);
  S.flash = Math.max(0, S.flash - dt * 2.2); S.shake = Math.max(0, S.shake - dt * 1.6);
  if (S.mode === 'play') { S.runT += dt; updatePlayer(dt); }
  else if (S.mode === 'title') P.face = 1.2 + Math.sin(S.t * 0.3) * 0.5;
  poseHero(dt);
  if (S.mode !== 'title') {
    for (const e of W.enemies) if (!e.dead) (e.type === 'boss' ? updateBoss : updateEnemy)(e, dt);
    W.enemies = W.enemies.filter(e => !e.dead || e.type === 'boss');
    if (W.bossState === 'fight') updateBossHazards(dt);
  }
  updateWorld(dt); updateMsg(dt);
}
function camera(dt) {
  // zoom
  if (keys.has('Equal') || keys.has('NumpadAdd')) S.zoomTo *= Math.pow(2.2, dt);
  if (keys.has('Minus') || keys.has('NumpadSubtract')) S.zoomTo *= Math.pow(2.2, -dt);
  S.zMin = Math.min(R.W / (SIZE[0] * R.U0), R.H / (SIZE[1] * R.U0)) * 0.97;
  S.zoomTo = clamp(S.zoomTo, S.zMin, 1.7);
  S.zoom = Math.abs(S.zoomTo - S.zoom) < 0.002 ? S.zoomTo : S.zoom * Math.pow(S.zoomTo / S.zoom, Math.min(1, dt * 9));
  R.setZoom(S.zoom);
  let tx = P.x + Math.cos(P.face) * 0.5, ty = P.y + Math.sin(P.face) * 0.4 - 0.55;
  if ((W.bossState === 'fight' || W.bossState === 'dying') && W.boss) { tx = lerp(P.x, W.boss.x, 0.38); ty = lerp(P.y, W.boss.y, 0.38) - 1.1; }
  if (S.mode === 'title') { tx = W.B.start.x + 6 + Math.sin(S.t * 0.15) * 3; ty = W.B.start.y - 4 + Math.cos(S.t * 0.11) * 1.2; }
  // far back, keep the page on screen instead of the dark around it
  const [vw, vh] = R.viewUnits(), kk = clamp((0.8 - S.zoom) / 0.3, 0, 1);
  const bx = vw >= SIZE[0] ? SIZE[0] / 2 : clamp(tx, vw / 2, SIZE[0] - vw / 2), by = vh >= SIZE[1] ? SIZE[1] / 2 : clamp(ty, vh / 2, SIZE[1] - vh / 2);
  tx = lerp(tx, bx, kk); ty = lerp(ty, by, kk);
  S.camX += (tx - S.camX) * Math.min(1, 5 * dt); S.camY += (ty - S.camY) * Math.min(1, 5 * dt);
}
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!W) return;
  if (!S.paused) for (let i = 0; i < (S.steps || 1); i++) step(dt);
  camera(dt);
  fillUniforms();
  const sh = S.shake * S.shake * R.U * 0.5;
  R.render(S.camX, S.camY, S.t, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
  updateOverlay();
}

// ---------------------------------------------------------------- input
function zoomBy(f) { S.zoomTo = clamp(S.zoomTo * f, S.zMin, 1.7); }
function bind() {
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code); audio.start();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (S.mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) return startGame(!!readSave());
    if (e.code === 'KeyJ' || e.code === 'Space') { input.attack = true; input.held = true; }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyK') input.dash = true;
    if (e.code === 'KeyM') toggleSound();
    if (e.code === 'KeyZ') S.zoomTo = S.zoomTo < 0.5 ? 0.85 : S.zMin;
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  });
  addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'KeyJ' || e.code === 'Space') input.held = false; });
  addEventListener('blur', () => { keys.clear(); input.held = false; input.sx = input.sy = 0; });
  const cv = $('game');
  cv.addEventListener('mousemove', (e) => { input.mx = e.clientX; input.my = e.clientY; input.mouseT = S.t; });
  cv.addEventListener('mousedown', (e) => { audio.start(); input.mx = e.clientX; input.my = e.clientY; input.mouseT = S.t; if (e.button === 0) { input.attack = true; input.held = true; } else if (e.button === 2) input.dash = true; });
  addEventListener('mouseup', (e) => { if (e.button === 0) input.held = false; });
  addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('wheel', (e) => { e.preventDefault(); zoomBy(Math.exp(-clamp(e.deltaY, -240, 240) * 0.0022)); }, { passive: false });
  addEventListener('resize', () => R.resize());
  // touch: left thumb moves, two fingers pinch the zoom
  const stick = $('stick'), base = $('base'), knob = $('knob');
  addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });
  const pd = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  addEventListener('touchstart', (e) => { if (e.touches.length === 2) input.pinch = pd(e.touches); }, { passive: true });
  addEventListener('touchmove', (e) => { if (e.touches.length === 2 && input.pinch) { const d = pd(e.touches); zoomBy(d / input.pinch); input.pinch = d; input.sx = input.sy = 0; } }, { passive: true });
  addEventListener('touchend', (e) => { if (e.touches.length < 2) input.pinch = 0; }, { passive: true });
  stick.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') return; audio.start(); input.stickId = e.pointerId; input.ox = e.clientX; input.oy = e.clientY; base.style.display = 'block'; base.style.left = e.clientX + 'px'; base.style.top = e.clientY + 'px'; knob.style.transform = ''; stick.setPointerCapture(e.pointerId); });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId !== input.stickId || input.pinch) return;
    let dx = e.clientX - input.ox, dy = e.clientY - input.oy; const d = Math.hypot(dx, dy), max = 52;
    if (d > max) { dx *= max / d; dy *= max / d; }
    input.sx = dx / max; input.sy = dy / max; knob.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const up = (e) => { if (e.pointerId !== input.stickId) return; input.stickId = null; input.sx = input.sy = 0; base.style.display = 'none'; };
  stick.addEventListener('pointerup', up); stick.addEventListener('pointercancel', up);
  const btn = (id, down, upf) => { const b = $(id); b.addEventListener('pointerdown', (e) => { e.preventDefault(); audio.start(); b.classList.add('down'); down(); }); const u = () => { b.classList.remove('down'); upf && upf(); }; b.addEventListener('pointerup', u); b.addEventListener('pointercancel', u); b.addEventListener('pointerleave', u); };
  btn('bA', () => { input.attack = true; input.held = true; }, () => { input.held = false; });
  btn('bD', () => { input.dash = true; });
  $('start').addEventListener('click', () => startGame(false));
  $('cont').addEventListener('click', () => startGame(true));
  $('snd').addEventListener('click', toggleSound);
  $('pz').addEventListener('click', togglePause);
  $('zin').addEventListener('click', () => zoomBy(1.5));
  $('zout').addEventListener('click', () => zoomBy(1 / 1.5));
  $('zmap').addEventListener('click', () => { S.zoomTo = S.zoomTo < 0.5 ? 0.85 : S.zMin; });
  $('resume').addEventListener('click', togglePause);
  $('quit').addEventListener('click', () => location.reload());
  $('again').addEventListener('click', () => { clearSave(); location.reload(); });
}
function toggleSound() { audio.start(); $('snd').textContent = audio.toggle() ? 'SOUND OFF' : 'SOUND ON'; }
function togglePause() {
  if (S.mode === 'title' || S.mode === 'end') return;
  S.paused = !S.paused; $('pause').classList.toggle('on', S.paused); last = performance.now();
  if (audio.ctx) S.paused ? audio.ctx.suspend() : audio.ctx.resume();
}
function startGame(cont) {
  if (S.mode !== 'title') return;
  audio.start(); $('title').classList.remove('on'); $('hud').classList.add('on');
  S.runT = 0; S.deaths = 0; S.mode = 'play';
  const sv = cont && readSave();
  if (sv) { applySave(sv); S.land = -1; enterLand(W.T.regAt(P.x, P.y)); }
  else { clearSave(); S.land = -1; enterLand(0); }
  $('hint').textContent = 'WHEEL ZOOM · WASD MOVE · CLICK STRIKE · SHIFT DASH';
  setTimeout(() => { $('hint').textContent = ''; }, 30000);
}

async function boot() {
  try {
    try { await Promise.all([document.fonts.load('500 20px "JetBrains Mono"'), document.fonts.load('800 20px "JetBrains Mono"')]); } catch (e) { /* fall back to system monospace */ }
    R = new Renderer($('game'));
    bind();
    if (matchMedia('(pointer: coarse)').matches) { document.body.classList.add('touch'); $('keys').textContent = 'LEFT THUMB move · STRIKE · DASH · PINCH or + − zoom'; }
    loadWorld(); S.mode = 'title'; S.reveal = 0; S.revealTo = 1;
    if (readSave()) $('cont').style.display = ''; else $('start').textContent = 'BEGIN';
    $('loading').style.display = 'none'; $('start').style.visibility = 'visible';
    audio.pending = LANDS[0].music;
    requestAnimationFrame(frame);
    const q = new URLSearchParams(location.search);
    if (q.has('debug')) window.__uw = { S, P, R, get W() { return W; }, LANDS, startGame, wordComplete, hitEnemy, keys, input, lightBeacon, startBoss, spawn: spawnEnemy, hurtPlayer, openGate, save, objective };
  } catch (err) {
    console.error(err); $('err').style.display = 'flex'; $('title').classList.remove('on');
  }
}
boot();
