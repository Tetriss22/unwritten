// UNWRITTEN — game loop, the Scribe, the unwriters, one small world of five lands and the Editor.
import * as THREE from '../lib/three.module.min.js';
import { Renderer, SY, CY, SINP, MAX_LIGHTS, MAX_ERASE, MAX_PULSE } from './render.js';
import { LANDS, SIZE, TEXTS, buildWorld, rng } from './terrain.js';
import * as M from './models.js';
import { gmat } from './glyph.js';
import { Audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const rotY = (a) => Math.atan2(Math.cos(a), Math.sin(a));
const place = (o, x, y, h = 0) => o.position.set(x, h, y);
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);

const audio = new Audio();
let R = null, W = null;
const S = { mode: 'boot', land: 0, landT: 0, t: 0, camX: 0, camY: 0, shake: 0, hitstop: 0, flash: 0, reveal: 0, revealTo: 0, amb: 0, deaths: 0, runT: 0, paused: false, timers: [], zoom: 1.0, zoomTo: 1.0, zMin: 0.1, env: null };
const P = { x: 0, y: 0, vx: 0, vy: 0, kx: 0, ky: 0, face: 0, hp: 5, maxHp: 5, inv: 0, dashT: 0, dashCd: 0, dx: 0, dy: 0, atkT: 0, atkDur: 0.24, atkCd: 0, combo: 0, comboT: 0, hitDone: true, walk: 0, stepT: 0, burnT: 0, cx: 0, cy: 0, m: null, h: 0, hTo: 0, up: null, mounted: false, zoomBack: 1.0, lvl: 1, xp: 0, ink: 60, maxInk: 60, dmgMul: 1, weapon: 0, gear: { robe: null, ring: null, charm: null }, bag: [], st: null, hits: 0 };
const keys = new Set();
const input = { mx: 0, my: 0, mouseT: -99, attack: false, held: false, dash: false, use: false, ride: false, fire: false, swap: false, s1: false, s2: false, sx: 0, sy: 0, stickId: null, ox: 0, oy: 0, pinch: 0 };
const after = (sec, fn) => S.timers.push({ t: sec, fn });
const nowMs = () => S.cap ? S.capT * 1000 : performance.now();     // filming steps the game by hand, so time must not run on its own
const TRAIL = 12, WHITE3 = new THREE.Color(0xffffff);
const RB = Array.from({ length: 6 }, () => ({ x: 0, z: 0, vx: 0, vz: 0 }));   // the coat's rings, each on a spring

// ---------------------------------------------------------------- save
const SAVE = 'unwritten.world.v3';      // v3: the world grew, old positions no longer fit
const readSave = () => { try { return JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch (e) { return null; } };
const clearSave = () => { try { localStorage.removeItem(SAVE); } catch (e) { /* storage unavailable */ } };
function save() {
  try { localStorage.setItem(SAVE, JSON.stringify({ taken: W.letters.filter(l => l.state === 'taken').map(l => l.id), lit: W.lands.map(l => l.lit), cp: [P.cx, P.cy], t: S.runT, d: S.deaths, lvl: P.lvl, xp: P.xp, wp: P.weapon, elx: W.elixirs.filter(e => e.gone).map(e => e.id), gear: P.gear, bag: P.bag, cch: W.caches.filter(c => c.gone).map(c => c.id) })); } catch (e) { /* storage unavailable */ }
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
  let s = ''; for (let i = 0; i < P.maxHp; i++) s += i < P.hp ? '\u25ae' : '<i>\u25af</i>';
  $('hearts').innerHTML = '<b>HP</b> ' + s + ' <small>' + Math.max(0, P.hp) + '/' + P.maxHp + '</small>';
}
function hudWord() {
  const land = W.lands[S.land], w = land.def.word; let s = '';
  for (let i = 0; i < w.length; i++) s += land.letters[i].state === 'taken' ? w[i] : '<i>_</i>';
  $('word').innerHTML = '<b>WORD</b> ' + s; $('word').classList.toggle('done', land.wordDone);
  $('chapter').textContent = 'Scribe · ' + land.def.roman + ' ' + land.def.name;
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
// a short flash of light on the ground: hits, kills, slams
function glow(x, y, r, int, col, life) { W.glows.push({ x, y, r, int, col, life, max: life }); if (W.glows.length > 10) W.glows.shift(); }
// numbers and words that float up from a hit
const floats = [];
function floatText(x, y, h, text, cls) {
  const el = document.createElement('div'); el.className = 'ft ' + cls; el.textContent = text; $('fx').appendChild(el);
  floats.push({ el, x: x + rnd(-0.3, 0.3), y, h, t: nowMs() }); if (floats.length > 24) floats.shift().el.remove();
}
function removeObj(o) { if (o && o.parent) o.parent.remove(o); }

// ---------------------------------------------------------------- world
function loadWorld() {
  R.root.clear();
  const B = buildWorld();
  W = { B, T: B.T, lamps: B.lamps.slice(), letters: [], gates: B.gates, enemies: [], shots: [], hearts: [], parts: [], pulses: [], flames: [], floats: [], barrierProps: [], lines: [], slams: [], rewrites: [], bossState: 'wait', boss: null, hinted: false, bossTries: 0, wx: { type: 0, amt: 0, col: [1, 1, 1] } };
  W.lands = LANDS.map((def, i) => ({ def, i, letters: [], wordDone: false, lit: false, entered: false, weather: def.weather.slice(), goal: B.goals[i], beacon: null }));
  R.setTerrain(B.T); R.setPalette(LANDS.flatMap(l => l.palette)); R.setTexts(TEXTS);
  W.spins = []; W.scars = []; W.glows = [];
  // the ribbon the quill leaves in the air
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 18), 3)); tg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(TRAIL * 18).map((_, i) => i % 3 === 1 ? 1 : 0), 3));
  W.trail = new THREE.Mesh(tg, gmat(0xff9ad5, 'slash', { glow: true, side: THREE.DoubleSide })); W.trail.frustumCulled = false; W.trail.layers.set(2); W.trailPts = []; R.root.add(W.trail);
  const statics = [];
  for (const p of B.props) {
    const g = M.makeProp(p); place(g, p.x, p.y);
    let dyn = p.barrier !== undefined;
    g.traverse(m => { if (m.userData.flame || m.userData.float || m.userData.spin) dyn = true; });
    if (!dyn) { statics.push(g); continue; }
    R.root.add(g);
    g.traverse(m => { if (m.userData.flame) W.flames.push({ m, s: m.scale.clone(), ph: rnd(6) }); if (m.userData.float) W.floats.push({ m, y: m.position.y, ph: m.userData.float }); if (m.userData.spin) W.spins.push(m); });
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
  W.horse = M.makeHorse(); W.horse.x = B.start.x - 2.2; W.horse.y = B.start.y + 1.2; W.horse.face = 0.4; W.horse.call = false; W.horse.gait = 0; R.root.add(W.horse.g);
  W.npcs = B.npcs.map(n => { const g = M.makeNPC(n.hue); place(g, n.x, n.y); R.root.add(g); return { ...n, g, ph: rnd(6) }; });
  W.drops = []; W.firstDrop = false; P.gear = { robe: null, ring: null, charm: null }; P.bag = []; P.st = null; W.fire = null; W.said = {}; W.fireballs = []; W.burns = []; W.bolts = []; W.skybolts = []; spawnElixirs(); spawnCaches(); spawnWild();
  if (!P.m) P.m = M.makeHero();
  R.root.add(P.m.g); P.m.g.visible = true; tintRobe();
  P.lvl = 1; P.xp = 0; applyLevel(); P.ink = P.maxInk; setWeapon(0);
  Object.assign(P, { x: B.start.x, y: B.start.y, vx: 0, vy: 0, kx: 0, ky: 0, face: 0, hp: P.maxHp, inv: 0, dashT: 0, atkT: 0, cx: B.start.x, cy: B.start.y, h: 0, hTo: 0, up: null, mounted: false });
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
  if (sv.gear) { P.gear = Object.assign({ robe: null, ring: null, charm: null }, sv.gear); P.bag = sv.bag || []; P.st = null; tintRobe(); }
  P.lvl = sv.lvl || 1; P.xp = sv.xp || 0; applyLevel(); P.hp = P.maxHp; P.ink = P.maxInk; hudHearts();
  for (const e of W.elixirs) if ((sv.elx || []).includes(e.id)) e.gone = true;
  for (const c of W.caches) if ((sv.cch || []).includes(c.id)) c.gone = true;
  setWeapon(WEAPONS[sv.wp || 0].lvl <= P.lvl ? sv.wp || 0 : 0);
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
  if (S.god) return;      // filming only
  if (P.dashT > 0 && S.mode === 'play' && S.t - (P.missT || -9) > 0.5) { P.missT = S.t; floatText(P.x, P.y, 2.6, 'miss', 'miss'); }
  if (P.inv > 0 || P.dashT > 0 || S.mode !== 'play' || P.up) return;
  if (GS().fx.dodge && Math.random() < 0.25) { P.inv = 0.4; floatText(P.x, P.y, 2.6, 'missed', 'miss'); pulse(P.x, P.y, [1, 0.55, 0.15], 0.6, 6, 0.3); return; }
  if (P.mounted) dismount();
  P.hp -= dmg; P.inv = 1.15;
  const a = Math.atan2(P.y - fy, P.x - fx); P.kx = Math.cos(a) * kb; P.ky = Math.sin(a) * kb;
  S.flash = 1; S.shake = Math.max(S.shake, 0.5); S.hitstop = 0.09; audio.play('hurt');
  floatText(P.x, P.y, 2.6, '-' + dmg, 'hurt'); glow(P.x, P.y, 3.2, 1.0, [1, 0.25, 0.35], 0.35);
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
  for (const f of W.fireballs) removeObj(f.g); W.fireballs = []; W.burns = [];
  W.lines = []; W.slams = [];
  if (W.bossState === 'fight') { W.bossState = 'wait'; W.boss = null; $('boss').style.display = 'none'; audio.intense = false; }
  Object.assign(P, { x: P.cx, y: P.cy, vx: 0, vy: 0, kx: 0, ky: 0, hp: P.maxHp, inv: 1.6, dashT: 0, atkT: 0, up: null, hTo: 0, h: 0, mounted: false });
  P.m.g.visible = true; S.camX = P.x; S.camY = P.y; S.mode = 'play'; S.revealTo = 1; hudHearts();
}

// ---------------------------------------------------------------- riding, climbing, fires, talking
function once(key, text, hold = 3) { if (!W.said[key]) { W.said[key] = 1; say(text, hold); } }
function dismount() {
  if (!P.mounted) return;
  const hz = W.horse; P.mounted = false; hz.x = P.x; hz.y = P.y; hz.face = P.face; hz.call = false;
  const sx = -Math.sin(P.face) * 0.95, sy = Math.cos(P.face) * 0.95;
  if (!W.T.blocked(P.x + sx, P.y + sy, 0.3)) { P.x += sx; P.y += sy; } else if (!W.T.blocked(P.x - sx, P.y - sy, 0.3)) { P.x -= sx; P.y -= sy; }
  P.vx *= 0.3; P.vy *= 0.3;
}
function ride() {
  if (S.mode !== 'play' || P.up) return;
  if (P.mounted) return dismount();
  const hz = W.horse; audio.play('whistle');
  if (dist(hz.x, hz.y, P.x, P.y) > 14) { hz.x = P.x - CY * 12 - SY * 2; hz.y = P.y + SY * 12 - CY * 2; }   // it comes in from the left edge of the screen
  hz.call = true;
}
function interactTarget() {
  if (S.mode !== 'play') return null;
  if (P.up) return { kind: 'down', x: P.up.x, y: P.up.y, h: P.up.top + 3.2, text: 'climb down' };
  let best = null, bd = 1e9;
  for (const t of W.B.towers) { const d = dist(P.x, P.y, t.x, t.y) - t.base; if (d < 1.9 && d < bd) { bd = d; best = { kind: 'tower', ref: t, x: t.x, y: t.y, h: 1.6, text: 'climb' }; } }
  for (const n of W.npcs) { const d = dist(P.x, P.y, n.x, n.y) - 0.5; if (d < 2.4 && d < bd) { bd = d; best = { kind: 'npc', ref: n, x: n.x, y: n.y, h: 3.3, text: 'talk' }; } }
  for (const c of W.caches) { if (c.gone) continue; const d = dist(P.x, P.y, c.x, c.y) - 0.4; if (d < 1.4 && d < bd) { bd = d; best = { kind: 'cache', ref: c, x: c.x, y: c.y, h: 1.9, text: c.kind === 'buried' ? 'dig' : 'open' }; } }
  return best;
}
function interact() {
  const t = interactTarget(); if (!t) return;
  if (t.kind === 'cache') { dismount(); return openCache(t.ref); }
  if (t.kind === 'down') {
    const tw = P.up; P.up = null; P.hTo = 0; S.zoomTo = P.zoomBack;
    for (let k = 0; k < 8; k++) { const a = Math.atan2(CY, SY) + k * 0.785, x = tw.x + Math.cos(a) * (tw.base + 0.7), y = tw.y + Math.sin(a) * (tw.base + 0.7); if (!W.T.blocked(x, y, 0.3)) { P.x = x; P.y = y; break; } }
    P.vx = P.vy = 0; audio.play('dash'); return;
  }
  if (t.kind === 'tower') {
    dismount(); const tw = t.ref; P.up = tw; P.x = tw.x; P.y = tw.y; P.hTo = tw.top; P.vx = P.vy = 0; P.atkT = 0;
    P.zoomBack = S.zoomTo; S.zoomTo = Math.min(S.zoomTo, 0.55); audio.play('free'); pulse(tw.x, tw.y, [1, 0.95, 0.75], 1, 9, 0.8);
    once('tower', 'High ground. Nothing reaches you up here, and thin lights show where things are buried.', 3.8); return;
  }
  say(t.ref.name + ': "' + t.ref.line + '"', 4.2); audio.play('letter', -5);
}
function campfire() {
  if (S.mode !== 'play' || P.up || P.mounted) return;
  let x = P.x + Math.cos(P.face) * 1.1, y = P.y + Math.sin(P.face) * 1.1; if (W.T.blocked(x, y, 0.3)) { x = P.x; y = P.y; }
  if (!W.fire) { const g = M.makeCampfire(); R.root.add(g); g.traverse(m => { if (m.userData.flame) W.flames.push({ m, s: m.scale.clone(), ph: rnd(6) }); }); W.fire = { g, t: 0, heal: 0 }; }
  W.fire.x = x; W.fire.y = y; W.fire.t = 0; place(W.fire.g, x, y); P.cx = P.x; P.cy = P.y;
  audio.play('fire'); glow(x, y, 8, 1.6, [1, 0.6, 0.25], 0.8); burst(x, y, 0.5, 10, 0xffb050, 4);
  once('fire', 'A fire remembers where you stood. Rest by it and it mends you.', 3.4); save();
}
function updateHorse(dt) {
  const hz = W.horse; let sp = 0;
  if (P.mounted) { hz.x = P.x; hz.y = P.y; hz.face = P.face; sp = Math.hypot(P.vx, P.vy); }
  else if (hz.call) {
    const d = dist(hz.x, hz.y, P.x, P.y), a = Math.atan2(P.y - hz.y, P.x - hz.x);
    if (d < 1.4 && S.mode === 'play' && !P.up) { hz.call = false; P.mounted = true; P.x = hz.x; P.y = hz.y; P.face = hz.face; P.atkT = 0; pulse(P.x, P.y, [1, 1, 1], 0.6, 7, 0.4); once('ride', 'R to get down. Strike and you jump off swinging.', 3); }
    else { sp = Math.min(13, 4 + d * 1.5); hz.x += Math.cos(a) * sp * dt; hz.y += Math.sin(a) * sp * dt; hz.face = a; }
  }
  hz.gait += sp * dt * 1.6;
  if (sp > 2) { hz.hoofT = (hz.hoofT || 0) - dt * sp; if (hz.hoofT <= 0) { hz.hoofT = 2.6; audio.play('hoof'); if (P.mounted) pulse(hz.x, hz.y, [0.8, 0.9, 0.8], 0.25, 3, 0.25, 0.2); } }
  place(hz.g, hz.x, hz.y, P.mounted ? P.h : 0); hz.g.rotation.y = rotY(hz.face);
  const amp = Math.min(0.9, 0.3 + sp * 0.07), sw = sp > 0.5 ? Math.sin(hz.gait) * amp : 0, sw2 = sp > 0.5 ? Math.sin(hz.gait + 1.9) * amp : 0;
  hz.legs[0].rotation.x = sw; hz.legs[1].rotation.x = sw2; hz.legs[2].rotation.x = -sw2; hz.legs[3].rotation.x = -sw;
  hz.body.position.y = sp > 0.5 ? Math.abs(Math.sin(hz.gait)) * 0.1 : Math.sin(S.t * 1.6) * 0.012;
  hz.neck.rotation.x = sp > 0.5 ? 0.25 + Math.sin(hz.gait) * 0.08 : Math.sin(S.t * 0.7) * 0.08; hz.tail.rotation.x = -0.5 - Math.min(0.7, sp * 0.07) + Math.sin(S.t * 3) * 0.08;
}

// ---------------------------------------------------------------- weapons, magic, elixirs, levels
const WEAPONS = [
  { name: 'QUILL', dmg: 1, range: 1.8, half: 1.25, dur: 0.22, cd: 0.25, hitAt: 0.28, spin: true, snd: 'slash', lvl: 1 },
  { name: 'BLADE', dmg: 3, range: 2.4, half: 1.5, dur: 0.44, cd: 0.66, hitAt: 0.55, slam: true, snd: 'spin', lvl: 2 },
  { name: 'NIBS', dmg: 0.6, range: 1.45, half: 1.0, dur: 0.11, cd: 0.12, hitAt: 0.3, snd: 'slash', lvl: 4 },
];
const SPELLS = { fire: { cost: 20, lvl: 1 }, bolt: { cost: 30, lvl: 3 } };
const ELX = { xp: { col: [1, 0.85, 0.4] }, ink: { col: [0.4, 0.7, 1] }, hp: { col: [1, 0.35, 0.45] } };
const xpNeed = (l) => 30 + l * 30;
function applyLevel() { const st = GS(); P.dmgMul = (1 + 0.2 * (P.lvl - 1)) * (1 + st.dmg / 100); P.maxHp = 5 + Math.floor(P.lvl / 2) + st.hp; P.maxInk = 60 + 10 * (P.lvl - 1) + st.ink; }
function hudStats() {
  const bar = (v, max, n = 10) => { const k = Math.round(clamp(v / max, 0, 1) * n); return '▮'.repeat(k) + '<i>' + '▯'.repeat(n - k) + '</i>'; };
  $('lv').innerHTML = '<b>LV ' + P.lvl + '</b> ' + bar(P.xp, xpNeed(P.lvl)) + ' <small>' + Math.floor(P.xp) + '/' + xpNeed(P.lvl) + '</small>';
  $('ink').innerHTML = '<b>INK</b> ' + bar(P.ink, P.maxInk) + ' <small>' + Math.floor(P.ink) + '/' + P.maxInk + '</small>';
  const sp = (k, key, label) => P.lvl >= SPELLS[k].lvl ? `<span class="${P.ink >= SPELLS[k].cost ? '' : 'off'}">${key} ${label}</span>` : `<span class="off">${key} LV${SPELLS[k].lvl}</span>`;
  if (W && W.caches) $('secrets').innerHTML = '<b>SECRETS</b> ' + W.caches.filter(c => c.gone).length + '<i>/' + W.caches.length + '</i>';
  $('slots').innerHTML = '<span>Q ' + WEAPONS[P.weapon].name + '</span>' + sp('fire', '1', 'FIRE') + sp('bolt', '2', 'BOLT') + '<span class="bagk">I BAG ' + P.bag.length + '</span>';
}
function gainXP(n, raw = false) {
  P.xp += raw ? n : Math.round(n * (1 + GS().xp / 100));
  while (P.xp >= xpNeed(P.lvl)) {
    P.xp -= xpNeed(P.lvl); P.lvl++; applyLevel(); P.hp = P.maxHp; P.ink = P.maxInk; hudHearts();
    audio.play('word'); pulse(P.x, P.y, [1, 0.9, 0.5], 1.8, 10, 1.0); glow(P.x, P.y, 9, 1.6, [1, 0.9, 0.5], 1.0); burst(P.x, P.y, 1.5, 24, 0xffe9a8, 8);
    floatText(P.x, P.y, 3.8 + P.h, 'LEVEL ' + P.lvl, 'lvl');
    const w = WEAPONS.find(w => w.lvl === P.lvl);
    say('Level ' + P.lvl + '. ' + (w ? 'New weapon: ' + w.name + '. Press Q to switch.' : P.lvl === SPELLS.bolt.lvl ? 'New spell: BOLT. Press 2.' : 'Your hand is heavier and your ink runs deeper.'), 3.4);
  }
  hudStats();
}
function setWeapon(i) { P.weapon = i; P.m.weapons.forEach((w, k) => { w.g.visible = k === i; }); hudStats(); }
function nextWeapon() {
  if (S.mode !== 'play') return; let i = P.weapon;
  do { i = (i + 1) % WEAPONS.length; } while (WEAPONS[i].lvl > P.lvl);
  if (i !== P.weapon) { setWeapon(i); audio.play('dash'); floatText(P.x, P.y, 3.4 + P.h, WEAPONS[i].name, 'gain'); } else once('wpn', 'More weapons come with levels. Drink elixirs.', 2.6);
}
function aimAngle() {
  if (S.t - input.mouseT < 2.5 && !document.body.classList.contains('touch')) {
    const [gx, gy] = R.toScreen(P.x, P.y), [hx, hy] = R.toScreen(P.x, P.y, 1.0 + P.h + (P.mounted ? 0.8 : 0)), [wx, wy] = R.toWorld(input.mx - hx + gx, input.my - hy + gy);
    return Math.atan2(wy - P.y, wx - P.x);
  }
  let best = null, bd = 11; for (const e of W.enemies) { const d = dist(P.x, P.y, e.x, e.y); if (!e.dead && e.state !== 'sleep' && d < bd) { bd = d; best = e; } }
  return best ? Math.atan2(best.y - P.y, best.x - P.x) : P.face;
}
function spend(k) {
  const s = SPELLS[k]; if (S.mode !== 'play') return false;
  if (P.lvl < s.lvl) { once('lock' + k, 'That spell opens at level ' + s.lvl + '. Drink elixirs to grow.', 2.8); return false; }
  if (P.ink < s.cost) { floatText(P.x, P.y, 3.2 + P.h, 'no ink', 'miss'); return false; }
  P.ink -= s.cost; hudStats(); return true;
}
function castFire() {
  if (!spend('fire')) return; const a = aimAngle(); P.face = a;
  for (const da of GS().fx.split ? [-0.28, 0, 0.28] : [0]) {
    const g = M.makeFireball(), b = a + da; R.root.add(g);
    W.fireballs.push({ x: P.x + Math.cos(b) * 0.8, y: P.y + Math.sin(b) * 0.8, h: 1.3 + P.h, vx: Math.cos(b) * 12, vy: Math.sin(b) * 12, life: 1.1, g });
  }
  audio.play('fire'); glow(P.x, P.y, 4, 1.2, [1, 0.6, 0.25], 0.25); P.atkCd = Math.max(P.atkCd, 0.2);
}
function explode(f) {
  removeObj(f.g); const r = 2.5;
  W.burns.push({ x: f.x, y: f.y, r, t: 0, life: 3.6, tick: 0 }); if (W.burns.length > 4) W.burns.shift();
  pulse(f.x, f.y, [1, 0.6, 0.2], 1.6, 9, 0.5, 0.3); glow(f.x, f.y, 8, 1.8, [1, 0.55, 0.2], 0.5); burst(f.x, f.y, 0.6, 18, 0xffb050, 7); burst(f.x, f.y, 0.6, 8, 0xffe9a8, 5);
  S.shake = Math.max(S.shake, 0.4); audio.play('slam');
  for (const e of W.enemies) if (!e.dead && dist(e.x, e.y, f.x, f.y) < r + e.r) { const [dm, cr] = roll(2, 'fire'); hitEnemy(e, dm, Math.atan2(e.y - f.y, e.x - f.x), false, cr); }
}
function freeBolt(t) {
  const [dm, cr] = roll(2, 'bolt'); hitEnemy(t, dm, Math.atan2(t.y - P.y, t.x - P.x), false, cr);
  W.bolts.push({ pts: [[P.x, P.y], [t.x, t.y]], t: 0 }); if (W.bolts.length > 2) W.bolts.shift();
  const g = M.makeSkyBolt(); place(g, t.x, t.y); R.root.add(g); W.skybolts.push({ g, t: 0 }); glow(t.x, t.y, 6, 2.0, [1, 0.4, 0.4], 0.3); audio.play('zap');
}
function castBolt() {
  if (!spend('bolt')) return; const a = aimAngle(); P.face = a;
  const pts = [[P.x, P.y]], hit = []; let cx = P.x, cy = P.y, reach = 10;
  for (let n = 0; n < 4; n++) {
    let best = null, bd = reach;
    for (const e of W.enemies) {
      if (e.dead || hit.includes(e) || (e.type === 'boss' && e.state === 'spawn')) continue;
      const d = dist(cx, cy, e.x, e.y); if (d < bd && (n > 0 || d < 3 || Math.abs(angDiff(Math.atan2(e.y - cy, e.x - cx), a)) < 1.2)) { bd = d; best = e; }
    }
    if (!best) break; hit.push(best); pts.push([best.x, best.y]); cx = best.x; cy = best.y; reach = 5.5;
  }
  if (!hit.length) pts.push([P.x + Math.cos(a) * 6, P.y + Math.sin(a) * 6]);
  W.bolts.push({ pts, t: 0 }); if (W.bolts.length > 2) W.bolts.shift();
  hit.forEach((e, i) => { const [dm, cr] = roll(2.5 * Math.pow(0.8, i), 'bolt'); hitEnemy(e, dm, Math.atan2(e.y - P.y, e.x - P.x), false, cr); });
  for (let i = 1; i < pts.length; i++) { const g = M.makeSkyBolt(); place(g, pts[i][0], pts[i][1]); R.root.add(g); W.skybolts.push({ g, t: 0 }); glow(pts[i][0], pts[i][1], 6, 2.0, [0.7, 0.9, 1], 0.3); burst(pts[i][0], pts[i][1], 0.8, 8, 0xc8f0ff, 7); }
  S.shake = Math.max(S.shake, 0.5); audio.play('zap'); P.atkCd = Math.max(P.atkCd, 0.25);
}
// ---------------------------------------------------------------- loot: things the unwriters drop, in four colours of rarity
const RARITY = [
  { name: 'COMMON', col: '#cfcbe0', hex: 0xcfcbe0, rgb: [0.82, 0.8, 0.9], aff: 1, beam: 1.6, salv: 6 },
  { name: 'MAGIC', col: '#6f9bff', hex: 0x6f9bff, rgb: [0.45, 0.62, 1], aff: 2, beam: 3.2, salv: 16 },
  { name: 'RARE', col: '#ffe066', hex: 0xffe066, rgb: [1, 0.88, 0.4], aff: 3, beam: 5, salv: 40 },
  { name: 'LEGENDARY', col: '#ff8a2a', hex: 0xff8a2a, rgb: [1, 0.55, 0.15], aff: 3, beam: 9, salv: 100 },
];
const SLOTS = ['robe', 'ring', 'charm'];
const BASES = { robe: ['Robe', 'Coat', 'Mantle'], ring: ['Ring', 'Band', 'Loop'], charm: ['Charm', 'Seal', 'Bookmark'] };
// each stat: how it reads, its prefix and suffix, and how big a roll is at item level il
const AFX = {
  dmg: { t: v => `+${v}% damage`, pre: 'Sharp', suf: 'of Edits', roll: il => 4 + il + Math.floor(rnd(6)) },
  hp: { t: v => `+${v} heart${v > 1 ? 's' : ''}`, pre: 'Sturdy', suf: 'of the Margin', roll: il => il >= 7 && Math.random() < 0.4 ? 2 : 1 },
  ink: { t: v => `+${v} max ink`, pre: 'Inked', suf: 'of the Well', roll: il => 8 + il * 2 + Math.floor(rnd(8)) },
  regen: { t: v => `+${v} ink per second`, pre: 'Flowing', suf: 'of Drafts', roll: il => Math.round((0.6 + il * 0.12 + rnd(0.6)) * 10) / 10 },
  crit: { t: v => `${v}% chance to crit`, pre: 'Cruel', suf: 'of Typos', roll: il => 3 + Math.floor(il / 2) + Math.floor(rnd(4)) },
  speed: { t: v => `+${v}% move speed`, pre: 'Swift', suf: 'of the Wind', roll: il => 4 + Math.floor(il / 2) + Math.floor(rnd(4)) },
  fire: { t: v => `+${v}% fire damage`, pre: 'Burning', suf: 'of Cinders', roll: il => 10 + il * 2 + Math.floor(rnd(10)) },
  bolt: { t: v => `+${v}% lightning damage`, pre: 'Charged', suf: 'of Thunder', roll: il => 10 + il * 2 + Math.floor(rnd(10)) },
  leech: { t: v => `+${v} ink on every hit`, pre: 'Thirsty', suf: 'of the Quill', roll: il => 1 + Math.floor(il / 5) + (Math.random() < 0.5 ? 1 : 0) },
  xp: { t: v => `+${v}% experience`, pre: 'Studious', suf: 'of Footnotes', roll: il => 5 + il + Math.floor(rnd(6)) },
};
// what a full point of each stat is worth, to compare two items in one number
const WORTH = { dmg: 1, hp: 9, ink: 0.45, regen: 6, crit: 1.6, speed: 1.4, fire: 0.45, bolt: 0.45, leech: 4, xp: 0.5 };
const LEGENDS = [
  { slot: 'robe', name: 'The Last Draft', fx: 'cut', desc: 'Dashing through enemies cuts them' },
  { slot: 'robe', name: 'Cinder Mantle', fx: 'trail', desc: 'Your dash leaves fire behind' },
  { slot: 'ring', name: 'Red Pen', fx: 'chain', desc: 'Every 4th strike that lands calls lightning' },
  { slot: 'ring', name: 'Run-On Sentence', fx: 'pop', desc: 'Enemies you kill burst and hurt the ones next to them' },
  { slot: 'charm', name: 'Comma Splice', fx: 'split', desc: 'Fireballs split into three' },
  { slot: 'charm', name: 'Margin of Error', fx: 'dodge', desc: 'One hit in four misses you' },
];
const BAG_MAX = 16;
let itemId = 1;
function makeItem(rar, il, slot = SLOTS[Math.floor(rnd(3))]) {
  const r = RARITY[rar], keys = Object.keys(AFX), it = { id: itemId++ + '-' + Math.floor(rnd(1e6)), rar, il, slot, aff: {} };
  let leg = null;
  if (rar === 3) { const pool = LEGENDS.filter(l => l.slot === slot); leg = pool[Math.floor(rnd(pool.length))]; it.fx = leg.fx; }
  const pick = keys.slice().sort(() => Math.random() - 0.5).slice(0, r.aff);
  for (const k of pick) it.aff[k] = AFX[k].roll(il + (rar === 3 ? 3 : rar));
  const base = BASES[slot][Math.floor(rnd(3))];
  if (leg) it.name = leg.name;
  else if (rar === 0) it.name = base;
  else if (rar === 1) it.name = AFX[pick[0]].pre + ' ' + base;
  else it.name = AFX[pick[0]].pre + ' ' + base + ' ' + AFX[pick[1]].suf;
  return it;
}
const itemPower = (it) => it ? Object.entries(it.aff).reduce((s, [k, v]) => s + v * WORTH[k], 0) + (it.fx ? 25 : 0) : 0;
function gearStats() {
  const st = { dmg: 0, hp: 0, ink: 0, regen: 0, crit: 0, speed: 0, fire: 0, bolt: 0, leech: 0, xp: 0, fx: {} };
  for (const s of SLOTS) { const it = P.gear[s]; if (!it) continue; for (const [k, v] of Object.entries(it.aff)) st[k] += v; if (it.fx) st.fx[it.fx] = true; }
  return st;
}
const GS = () => P.st || (P.st = gearStats());
// a hit's damage after the gear has had its say; crits double
function roll(base, kind) {
  const st = GS(); let d = base * P.dmgMul * (kind === 'fire' ? 1 + st.fire / 100 : kind === 'bolt' ? 1 + st.bolt / 100 : 1);
  const crit = Math.random() * 100 < st.crit; if (crit) d *= 2;
  return [d, crit];
}
function tintRobe() {
  const it = P.gear.robe, hex = it ? new THREE.Color(0xffffff).lerp(new THREE.Color(RARITY[it.rar].hex), it.rar === 0 ? 0.12 : 0.42).getHex() : 0xffffff;
  const m = gmat(hex, 'coat', { lift: 0.55 }); P.m.robe.forEach(r => { r.material = m; });
}
function equip(it) {
  const old = P.gear[it.slot]; P.gear[it.slot] = it; P.bag = P.bag.filter(b => b !== it); if (old) P.bag.push(old);
  P.st = null; const hp0 = P.maxHp; applyLevel(); if (P.maxHp > hp0) P.hp += P.maxHp - hp0; P.hp = Math.min(P.hp, P.maxHp); P.ink = Math.min(P.ink, P.maxInk);
  tintRobe(); hudHearts(); hudStats(); audio.play('heart'); save();
}
function salvage(it) {
  P.bag = P.bag.filter(b => b !== it); const n = RARITY[it.rar].salv;
  floatText(P.x, P.y, 3.2 + P.h, '+' + n + ' XP', 'gain'); gainXP(n, true); audio.play('type'); save();
}
// what falls out of an unwriter: often nothing, sometimes a colour you have never seen
function maybeDrop(e) {
  const land = Math.max(0, e.land || 0), chance = { blot: 0.14, scratch: 0.2, brute: 0.7, typo: 0.05, asterisk: 0.18, ghost: 0.35, redactor: 1, mimic: 1 }[e.type] ?? 0.1, elite = e.type === 'brute' || e.type === 'redactor';
  if (e.type === 'mimic') { dropItem(e.x, e.y, Math.random() < 0.25 ? 3 : 2, 3 + land * 2 + P.lvl); dropItem(e.x, e.y, 1, 1 + land * 2 + P.lvl); return; }
  if (!W.firstDrop && e.type !== 'boss') { W.firstDrop = true; return dropItem(e.x, e.y, 1, 1 + land * 2 + P.lvl); }
  if (Math.random() > chance) return;
  const lg = 0.015 + land * 0.008 + (elite ? 0.03 : 0) + (e.type === 'redactor' ? 0.06 : 0), ra = 0.09 + land * 0.02 + (elite ? 0.12 : 0) + (e.type === 'redactor' ? 0.4 : 0), mg = 0.3;
  const q = Math.random(), rar = q < lg ? 3 : q < lg + ra ? 2 : q < lg + ra + mg ? 1 : 0;
  dropItem(e.x, e.y, rar, 1 + land * 2 + P.lvl);
}
function dropItem(x, y, rar, il, slot) {
  const it = makeItem(rar, il, slot), r = RARITY[rar], o = M.makeLoot(it.slot, r.hex), a = rnd(6.28);
  const tx = x + Math.cos(a) * rnd(0.6, 1.4), ty = y + Math.sin(a) * rnd(0.6, 1.4);
  o.beam.scale.y = 0.01; place(o.g, x, y, 1.4); R.root.add(o.g);
  W.drops.push({ it, o, x, y, tx, ty, t: 0, lab: null });
  if (rar >= 2) { audio.play(rar === 3 ? 'legend' : 'rare'); }
  if (rar === 3) { S.amb = Math.max(S.amb, 0.4); after(0.5, () => { glow(tx, ty, 10, 2.2, r.rgb, 1.2); pulse(tx, ty, r.rgb, 2, 9, 1.2); floatText(tx, ty, 3.4, 'LEGENDARY', 'leg'); }); }
  once('loot', 'They drop things now. Walk over them. I opens your bag.', 3.2);
}
function updateLoot(dt) {
  const play = S.mode === 'play';
  for (const d of W.drops) {
    d.t += dt; const k = Math.min(1, d.t / 0.55), r = RARITY[d.it.rar];
    const x = lerp(d.x, d.tx, k), y = lerp(d.y, d.ty, k), h = k < 1 ? Math.sin(k * Math.PI) * 1.4 + (1 - k) * 0.3 : 0.12 + Math.sin(S.t * 2.4 + d.t) * 0.08;
    place(d.o.g, x, y, 0); d.o.it.position.y = h; d.o.it.rotation.y += dt * 1.6;
    const bh = r.beam * Math.min(1, Math.max(0, d.t - 0.5) * 2.5); d.o.beam.scale.y = Math.max(0.01, bh); d.o.beam.position.y = bh / 2;
    d.o.beam.scale.x = d.o.beam.scale.z = 0.1 + Math.sin(S.t * 6 + d.t) * 0.025; d.o.halo.scale.setScalar(0.7 + Math.sin(S.t * 3 + d.t) * 0.08);
    d.cx = x; d.cy = y;
    if (k >= 1 && d.it.rar >= 2 && Math.random() < dt * (d.it.rar === 3 ? 10 : 3)) burst(x, y, rnd(0.3, r.beam * 0.8), 1, r.hex, 1.4);
    if (k >= 1 && play && !P.up && dist(P.x, P.y, x, y) < 1.15) {
      if (P.bag.length >= BAG_MAX) { if (S.t - (W.fullT || -9) > 3) { W.fullT = S.t; floatText(P.x, P.y, 3.2 + P.h, 'bag full', 'miss'); once('full', 'Your bag is full. Press I and salvage what you do not need.', 3); } continue; }
      d.dead = true; removeObj(d.o.g); if (d.lab) d.lab.remove();
      P.bag.push(d.it); audio.play(d.it.rar >= 2 ? 'rare' : 'heart'); pulse(x, y, r.rgb, 1, 6, 0.4);
      floatText(x, y, 2.4, d.it.name, 'loot r' + d.it.rar);
      const cur = P.gear[d.it.slot];
      if (!cur) { equip(d.it); say(d.it.name + ' put on. Press I to see your gear.', 2.6); }
      else if (itemPower(d.it) > itemPower(cur)) once('better', 'That one is better than what you wear. Press I to swap.', 3);
      hudStats(); save();
    }
  }
  W.drops = W.drops.filter(d => !d.dead);
  // a legendary on you shows: a few sparks of its colour come off the Scribe
  const st = GS();
  if (Object.keys(st.fx).length && P.m.g.visible && Math.random() < dt * 5) {
    const leg = SLOTS.map(s => P.gear[s]).find(it => it && it.fx); burst(P.x + rnd(-0.4, 0.4), P.y + rnd(-0.4, 0.4), rnd(0.4, 2.2) + P.h, 1, RARITY[leg.rar].hex, 1.2);
  }
}
function lootLabels(near) {
  for (const d of W.drops) {
    const on = near && d.t > 0.6 && dist(P.x, P.y, d.cx, d.cy) < 16;
    if (!on) { if (d.lab) d.lab.style.display = 'none'; continue; }
    if (!d.lab) { d.lab = document.createElement('div'); d.lab.className = 'lab loot r' + d.it.rar; d.lab.textContent = d.it.name; $('fx').appendChild(d.lab); }
    const [x, y] = R.toScreen(d.cx, d.cy, 1.25); d.lab.style.display = 'block'; d.lab.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }
}
// ---- the bag
const statLine = (k, v, cmp) => { const c = cmp === undefined ? '' : cmp > v ? ' <em class="dn">&#9660;</em>' : cmp < v ? ' <em class="up">&#9650;</em>' : ''; return `<li>${AFX[k].t(v)}${c}</li>`; };
function itemHTML(it, vs) {
  if (!it) return '<div class="it empty">empty</div>';
  const r = RARITY[it.rar], leg = it.fx && LEGENDS.find(l => l.fx === it.fx);
  const p = vs !== undefined ? itemPower(it) - itemPower(vs) : 0;
  return `<div class="it r${it.rar}"><b>${it.name}</b><small>${r.name} ${it.slot.toUpperCase()} &middot; item level ${it.il}</small><ul>${Object.entries(it.aff).map(([k, v]) => statLine(k, v, vs ? vs.aff[k] ?? 0 : undefined)).join('')}${vs ? Object.entries(vs.aff).filter(([k]) => !(k in it.aff)).map(([k, v]) => `<li class="dn">lose ${AFX[k].t(v)}</li>`).join('') : ''}</ul>${leg ? `<p>${leg.desc}</p>` : ''}${vs !== undefined ? `<i class="${p > 0 ? 'up' : p < 0 ? 'dn' : ''}">${p > 0 ? 'BETTER' : p < 0 ? 'WORSE' : 'SAME'} than what you wear</i>` : ''}</div>`;
}
function renderBag() {
  const sel = P.bag.find(b => b.id === S.bagSel) || P.bag[0], st = GS();
  if (sel) S.bagSel = sel.id;
  $('gearSlots').innerHTML = SLOTS.map(s => `<div class="slot"><span>${s.toUpperCase()}</span>${itemHTML(P.gear[s])}</div>`).join('');
  const tot = [['damage', `${Math.round((P.dmgMul - 1) * 100)}%`], ['hearts', P.maxHp], ['ink', P.maxInk], ['crit', st.crit + '%'], ['speed', '+' + st.speed + '%'], ['ink/s', (2.5 + st.regen).toFixed(1)]];
  $('gearTot').innerHTML = tot.map(([a, b]) => `<span>${a} <b>${b}</b></span>`).join('');
  $('bagList').innerHTML = P.bag.length ? P.bag.map(b => `<button type="button" data-id="${b.id}" class="row r${b.rar}${sel && b.id === sel.id ? ' sel' : ''}">${b.name}<small>${b.slot}</small></button>`).join('') : '<p class="none">Nothing yet. Unwriters drop things: grey, blue, gold and, rarely, orange.</p>';
  $('bagCount').textContent = P.bag.length + '/' + BAG_MAX;
  $('bagInfo').innerHTML = sel ? itemHTML(sel, P.gear[sel.slot] || null) : '';
  $('bagAct').style.display = sel ? 'flex' : 'none';
}
function toggleBag(force) {
  if (S.mode !== 'play' && !$('bag').classList.contains('on')) return;
  const on = force ?? !$('bag').classList.contains('on');
  $('bag').classList.toggle('on', on); S.paused = on; last = performance.now(); keys.clear(); input.held = false; input.sx = input.sy = 0;
  if (on) renderBag();
}
function bindBag() {
  $('bagList').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { S.bagSel = b.dataset.id; renderBag(); } });
  $('bagEquip').addEventListener('click', () => { const it = P.bag.find(b => b.id === S.bagSel); if (it) { equip(it); S.bagSel = null; renderBag(); } });
  $('bagSalv').addEventListener('click', () => { const it = P.bag.find(b => b.id === S.bagSel); if (it) { salvage(it); S.bagSel = null; renderBag(); } });
  $('bagJunk').addEventListener('click', () => { P.bag.filter(b => b.rar === 0).forEach(salvage); renderBag(); });
  $('bagClose').addEventListener('click', () => toggleBag(false));
  $('bagBtn').addEventListener('click', () => toggleBag());
}

// ---------------------------------------------------------------- the wilds: hidden caches and what lives between the roads
const NAMES = { typo: 'Typo', asterisk: 'Asterisk', ghost: 'Ghostwriter', redactor: 'Redactor', mimic: 'Mimic' };
const HEAVY = { brute: 1, redactor: 1, mimic: 1 };
function spawnCaches() {
  const r = rng(777), AR = W.B.goals[4], st = W.B.start; W.caches = [];
  const ok = (x, y, gap) => !(W.B.walk(x, y) < 7.5 || W.T.blocked(x, y, 0.9) || W.T.tagAt(x, y) !== 0 || dist(x, y, AR.x, AR.y) < 18 || W.caches.some(c => dist(c.x, c.y, x, y) < gap));
  // one chest a short walk off the first road, so the first minutes teach that leaving the road pays
  for (let k = 0; k < 400 && !W.caches.length; k++) { const a = r() * 6.28, d = 13 + r() * 9, x = st.x + Math.cos(a) * d, y = st.y + Math.sin(a) * d; if (ok(x, y, 0)) W.caches.push({ id: 0, x, y, kind: 'chest', mimic: false, guard: false, land: 0, ph: 0, g: null, gone: false }); }
  for (let i = 1, tries = 0; i < 46 && tries < 30000; tries++) {
    const x = 4 + r() * (SIZE[0] - 8), y = 4 + r() * (SIZE[1] - 8); if (!ok(x, y, 13)) continue;
    const kind = i % 3 === 2 ? 'buried' : 'chest', land = W.T.regAt(x, y), far = dist(x, y, st.x, st.y) > 40;
    W.caches.push({ id: i, x, y, kind, mimic: kind === 'chest' && far && r() < 0.24, guard: kind === 'chest' && far && i % 7 === 3, land, ph: r() * 6, g: null, gone: false }); i++;
  }
}
function spawnWild() {
  const r = rng(555), AR = W.B.goals[4], st = W.B.start, spots = [];
  const TABLE = [['typo', 'typo', 'typo', 'asterisk'], ['typo', 'ghost', 'typo', 'asterisk'], ['asterisk', 'asterisk', 'typo', 'ghost'], ['ghost', 'ghost', 'asterisk', 'typo', 'redactor'], ['ghost', 'redactor', 'asterisk', 'typo']];
  const COUNT = { typo: 4, asterisk: 2, ghost: 1, redactor: 1 };
  for (let n = 0, tries = 0; n < 36 && tries < 30000; tries++) {
    const x = 4 + r() * (SIZE[0] - 8), y = 4 + r() * (SIZE[1] - 8);
    if (W.B.walk(x, y) < 2.5 || W.T.blocked(x, y, 1.2) || W.T.tagAt(x, y) !== 0 || dist(x, y, st.x, st.y) < 20 || dist(x, y, AR.x, AR.y) < 20 || spots.some(s => dist(s[0], s[1], x, y) < 11)) continue;
    spots.push([x, y]); n++;
    const tb = TABLE[W.T.regAt(x, y)] || TABLE[0], type = tb[Math.floor(r() * tb.length)];
    for (let k = 0; k < COUNT[type]; k++) { const a = k * 1.6 + r(), ex = x + (k ? Math.cos(a) * 1.3 : 0), ey = y + (k ? Math.sin(a) * 1.3 : 0); if (!W.T.blocked(ex, ey, 0.5)) spawnEnemy(type, ex, ey, null, true); }
  }
  for (const c of W.caches) if (c.guard) for (const [dx, dy] of [[1.9, 0.6], [-1.9, 0.6], [0, -2]]) if (!W.T.blocked(c.x + dx, c.y + dy, 0.9)) { spawnEnemy('redactor', c.x + dx, c.y + dy, null, true); break; }
}
function openCache(c) {
  c.gone = true; if (c.g) { removeObj(c.g); c.g = null; }
  pulse(c.x, c.y, [1, 0.9, 0.5], 1.4, 8, 0.6); glow(c.x, c.y, 6, 1.5, [1, 0.9, 0.5], 0.5); burst(c.x, c.y, 0.5, 14, 0xffe9a8, 6);
  if (c.mimic) { const e = spawnEnemy('mimic', c.x, c.y); e.grow = 1; e.state = 'chase'; e.cd = 0.4; audio.play('warn'); S.shake = Math.max(S.shake, 0.4); say('That was never a chest.', 2.2); save(); return; }
  audio.play('free'); const il = 3 + c.land * 2 + P.lvl, n = c.kind === 'buried' ? 2 : Math.random() < 0.4 ? 2 : 1;
  for (let k = 0; k < n; k++) { const q = Math.random(); dropItem(c.x, c.y, c.kind === 'buried' ? (q < 0.12 ? 3 : q < 0.6 ? 2 : 1) : (q < 0.05 ? 3 : q < 0.35 ? 2 : 1), il); }
  gainXP(15); const found = W.caches.filter(x => x.gone).length;
  floatText(c.x, c.y, 3, 'SECRET ' + found + '/' + W.caches.length, 'gain'); hudStats(); save();
}
function updateCaches(dt) {
  for (const c of W.caches) {
    if (c.gone) continue; const d = dist(P.x, P.y, c.x, c.y);
    if (d > 60) { if (c.g) { removeObj(c.g); c.g = null; } continue; }
    if (!c.g) { c.g = c.kind === 'buried' ? M.makeGlint() : M.makeChest(); place(c.g, c.x, c.y); c.g.rotation.y = c.ph; R.root.add(c.g); }
    if (c.kind === 'buried') {
      // buried things show only from right on top of them, or from the top of a tower
      const high = P.up && d < 52, near = d < 5.5; c.g.visible = !!(high || near);
      const hgt = high ? 7 : 0.5 + Math.sin(S.t * 5 + c.ph) * 0.2; c.g.children[0].scale.y = hgt; c.g.children[0].position.y = hgt / 2; c.g.rotation.y += dt * 2;
      if (near && Math.random() < dt * 6) burst(c.x + rnd(-0.5, 0.5), c.y + rnd(-0.5, 0.5), 0.2, 1, 0xfff1c9, 1.6);
      if (near && S.mode === 'play') once('glint', 'Something glints under the page. Stand on it and press E to dig.', 3.4);
    } else if (d < 9 && S.mode === 'play') once('chest', 'A chest, off the road. There are more out in the wilds. Some are buried, and towers show you where.', 4.2);
  }
}
function asteriskBlast(e) {
  e.dead = true; removeObj(e.o.g);
  pulse(e.x, e.y, [1, 0.6, 0.2], 1.8, 10, 0.5, 0.3); glow(e.x, e.y, 8, 1.8, [1, 0.55, 0.2], 0.5); burst(e.x, e.y, 0.7, 20, 0xffb050, 8); S.shake = Math.max(S.shake, 0.5); audio.play('slam');
  if (dist(e.x, e.y, P.x, P.y) < 2.7) hurtPlayer(2, e.x, e.y, 10);
  for (const b of W.enemies) if (!b.dead && b !== e && b.type !== 'boss' && dist(b.x, b.y, e.x, e.y) < 2.7 + b.r) hitEnemy(b, 1.5, Math.atan2(b.y - e.y, b.x - e.x));
}
// the five that live in the wilds; returns [vx, vy, hop, sy, sxz, lean]
function updateWild(e, dt, d, a, alive) {
  const o = e.o; let vx = 0, vy = 0, hop = 0, sy = 1, sxz = 1, lean = 0;
  if (e.type === 'typo') {
    const w = a + Math.sin(e.t * 6 + e.ph) * 0.8; e.face = w; hop = Math.abs(Math.sin(e.t * 11 + e.ph)) * 0.3;
    if (e.cd <= 0) { vx = Math.cos(w) * e.sp; vy = Math.sin(w) * e.sp; if (d < e.r + 0.4 && alive) { hurtPlayer(1, e.x, e.y, 5); e.kx = -Math.cos(a) * 9; e.ky = -Math.sin(a) * 9; e.cd = 0.7; } }
  } else if (e.type === 'asterisk') {
    hop = 0.25 + Math.sin(S.t * 3 + e.ph) * 0.1; o.star.rotation.z += dt * (e.state === 'wind' ? 16 : 2.5);
    if (e.state === 'chase') { e.face = a; vx = Math.cos(a) * e.sp; vy = Math.sin(a) * e.sp; if (d < 2.0 && e.cd <= 0 && alive) { e.state = 'wind'; e.t = 0; audio.play('warn'); } }
    else if (e.state === 'wind') { sxz = sy = 1 + e.t * 0.7; if (Math.floor(e.t * 18) % 2 === 0) e.flash = Math.max(e.flash, 0.03); if (e.t > 0.8) asteriskBlast(e); }
  } else if (e.type === 'ghost') {
    hop = 0.35 + Math.sin(S.t * 2.4 + e.ph) * 0.15;
    if (e.state === 'chase') {
      e.face = a;
      if (d > 4.5) { vx = Math.cos(a) * e.sp; vy = Math.sin(a) * e.sp; } else { vx = -Math.sin(a) * e.sp * e.strafe; vy = Math.cos(a) * e.sp * e.strafe; }
      if (e.t > 1.7 && alive) { e.state = 'fade'; e.t = 0; }
    } else if (e.state === 'fade') {
      sxz = sy = Math.max(0.03, 1 - e.t * 3.5);
      if (e.t > 1.0) {
        for (let k = 0; k < 8; k++) { const b = rnd(6.28), x = P.x + Math.cos(b) * 4.6, y = P.y + Math.sin(b) * 4.6; if (!W.T.blocked(x, y, 0.5)) { e.x = x; e.y = y; break; } }
        e.state = 'appear'; e.t = 0; audio.play('dash'); pulse(e.x, e.y, [0.6, 0.85, 1], 0.8, 6, 0.4);
      }
    } else if (e.state === 'appear') {
      e.face = a; sxz = sy = Math.min(1, 0.03 + e.t / 0.4); if (Math.floor(e.t * 16) % 2 === 0) e.flash = Math.max(e.flash, 0.03);
      if (e.t > 0.6) { for (let i = -1; i <= 1; i++) fire(e.x, e.y, a + i * 0.32, 5.6); audio.play('shot'); e.state = 'chase'; e.t = 0; }
    }
  } else if (e.type === 'redactor') {
    if (e.state === 'chase') {
      e.face += angDiff(a, e.face) * Math.min(1, 4 * dt); vx = Math.cos(a) * e.sp; vy = Math.sin(a) * e.sp;
      hop = Math.abs(Math.sin(e.t * 3)) * 0.06; o.armL.rotation.x = Math.sin(e.t * 3) * 0.4; o.armR.rotation.x = -Math.sin(e.t * 3) * 0.4;
      if (d < 3.1 && e.cd <= 0 && alive) { e.state = 'wind'; e.t = 0; audio.play('warn'); }
      if (d < e.r + 0.3) hurtPlayer(1, e.x, e.y, 8);
      if (!e.called && e.hp < e.maxHp / 2) { e.called = true; audio.play('spawn'); for (let k = 0; k < 3; k++) { const m = spawnEnemy('typo', e.x + Math.cos(k * 2.1) * 1.4, e.y + Math.sin(k * 2.1) * 1.4); m.minion = true; } }
    } else if (e.state === 'wind') {
      o.armL.rotation.x = o.armR.rotation.x = -2.6; sy = 1 + e.t * 0.12; if (Math.floor(e.t * 14) % 2 === 0) e.flash = Math.max(e.flash, 0.035);
      if (e.t > 0.95) {
        pulse(e.x, e.y, [1, 1, 1], 2, 12, 0.5, 0.4); glow(e.x, e.y, 8, 1.6, [0.9, 0.85, 1], 0.4); burst(e.x, e.y, 0.4, 16, 0xffffff, 7); S.shake = Math.max(S.shake, 0.6); audio.play('slam');
        if (d < 3.5) hurtPlayer(2, e.x, e.y, 12);
        e.state = 'stun'; e.t = 0; e.stunT = 1.0;
      }
    } else if (e.state === 'stun') { lean = 0.3; o.armL.rotation.x = o.armR.rotation.x = 0.6; if (e.t > e.stunT) { e.state = 'chase'; e.t = 0; e.cd = 1.4; } }
  } else if (e.type === 'mimic') {
    o.lid.rotation.x = e.state === 'sleep' ? 0 : -0.25 - Math.abs(Math.sin(e.t * 9)) * 0.55;
    if (e.state === 'chase') {
      e.face = a; vx = Math.cos(a) * e.sp; vy = Math.sin(a) * e.sp; hop = Math.abs(Math.sin(e.t * 8 + e.ph)) * 0.3;
      if (d < 3.6 && e.cd <= 0 && alive) { e.state = 'wind'; e.t = 0; }
      if (d < e.r + 0.3) hurtPlayer(1, e.x, e.y);
    } else if (e.state === 'wind') { sy = 1 - Math.min(0.4, e.t * 1.6); e.face = a; if (e.t > 0.3) { e.state = 'leap'; e.t = 0; e.dx = Math.cos(a); e.dy = Math.sin(a); } }
    else if (e.state === 'leap') { vx = e.dx * 10.5; vy = e.dy * 10.5; hop = Math.sin(e.t / 0.34 * Math.PI) * 0.8; if (d < e.r + 0.45) hurtPlayer(2, e.x, e.y, 9); if (e.t > 0.34) { e.state = 'chase'; e.t = 0; e.cd = rnd(0.7, 1.2); } }
  }
  return [vx, vy, hop, sy, sxz, lean];
}

function spawnElixirs() {
  const r = rng(4242), kinds = ['xp', 'xp', 'xp', 'ink', 'ink', 'hp']; W.elixirs = [];
  for (let i = 0, tries = 0; i < 150 && tries < 8000; tries++) {
    const x = 3 + r() * (SIZE[0] - 6), y = 3 + r() * (SIZE[1] - 6);
    if (W.T.blocked(x, y, 0.6)) continue;
    W.elixirs.push({ id: i++, x, y, kind: kinds[Math.floor(r() * kinds.length)], ph: r() * 6, g: null, gone: false });
  }
  // three right by the start, so the first minute teaches it
  [[4.5, 1.6, 'xp'], [7, 0.6, 'ink'], [9.5, 1.4, 'xp']].forEach(([dx, dy, kind], k) => W.elixirs.push({ id: 200 + k, x: W.B.start.x + dx, y: W.B.start.y + dy, kind, ph: k, g: null, gone: false }));
}
function updateMagic(dt) {
  const play = S.mode === 'play';
  P.ink = Math.min(P.maxInk, P.ink + dt * (2.5 + GS().regen)); S.hudT = (S.hudT || 0) - dt; if (S.hudT <= 0) { S.hudT = 0.25; hudStats(); }
  for (const f of W.fireballs) {
    f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt; f.h += (1.0 - f.h) * Math.min(1, dt * 3); place(f.g, f.x, f.y, f.h); f.g.rotation.y += dt * 12; f.g.rotation.x += dt * 9;
    if (Math.random() < dt * 30) burst(f.x, f.y, f.h, 1, 0xffb050, 1.5);
    let hit = f.life <= 0 || W.T.isSolid(f.x, f.y);
    for (const e of W.enemies) if (!e.dead && dist(e.x, e.y, f.x, f.y) < e.r + 0.5) hit = true;
    if (hit) { f.dead = true; explode(f); }
  }
  W.fireballs = W.fireballs.filter(f => !f.dead);
  for (const b of W.burns) {
    b.t += dt; b.tick -= dt;
    if (b.tick <= 0) { b.tick = 0.5; for (const e of W.enemies) if (!e.dead && dist(e.x, e.y, b.x, b.y) < b.r) hitEnemy(e, roll(0.5, 'fire')[0], Math.atan2(e.y - b.y, e.x - b.x), true); }
    if (Math.random() < dt * 10) burst(b.x + rnd(-b.r, b.r) * 0.7, b.y + rnd(-b.r, b.r) * 0.7, 0.2, 1, 0xffb050, 1.2);
  }
  W.burns = W.burns.filter(b => b.t < b.life);
  for (const b of W.bolts) b.t += dt; W.bolts = W.bolts.filter(b => b.t < 0.3);
  for (const s of W.skybolts) { s.t += dt; s.g.rotation.y = rnd(6.28); s.g.scale.x = s.g.scale.z = 0.6 + rnd(0.8); if (s.t > 0.22) { removeObj(s.g); s.dead = true; } }
  W.skybolts = W.skybolts.filter(s => !s.dead);
  for (const e of W.elixirs) {
    if (e.gone) continue; const d = dist(P.x, P.y, e.x, e.y);
    if (d > 36) { if (e.g) { removeObj(e.g); e.g = null; } continue; }
    if (!e.g) { e.g = M.makeElixir(e.kind); R.root.add(e.g); }
    place(e.g, e.x, e.y, 0.25 + Math.sin(S.t * 2.2 + e.ph) * 0.12); e.g.rotation.y += dt * 1.4;
    if (d < 1.0 && play && !P.up) {
      e.gone = true; removeObj(e.g); e.g = null; audio.play('heart'); pulse(e.x, e.y, ELX[e.kind].col, 1.2, 6, 0.5); glow(e.x, e.y, 4, 1.2, ELX[e.kind].col, 0.4);
      if (e.kind === 'hp') { P.hp = Math.min(P.maxHp, P.hp + 2); hudHearts(); floatText(e.x, e.y, 2.4, '+2 HP', 'hurt'); gainXP(5); }
      else if (e.kind === 'ink') { P.ink = Math.min(P.maxInk, P.ink + 40); floatText(e.x, e.y, 2.4, '+40 INK', 'ink'); gainXP(5); }
      else { floatText(e.x, e.y, 2.4, '+25 XP', 'gain'); gainXP(25); }
      once('elx', 'Elixirs. Gold makes you grow, blue fills your ink, red mends you.', 3.2); save();
    }
  }
}

function startAttack(mx, my, moving) {
  let a = P.face;
  if (S.t - input.mouseT < 2.5 && !document.body.classList.contains('touch')) {
    const [hx, hy] = R.toScreen(P.x, P.y, 1.0), [wx, wy] = R.toWorld(input.mx - hx + R.toScreen(P.x, P.y)[0], input.my - hy + R.toScreen(P.x, P.y)[1]); a = Math.atan2(wy - P.y, wx - P.x);
  } else {
    let best = null, bd = 3.6;
    for (const e of W.enemies) { const d = dist(P.x, P.y, e.x, e.y) - e.r; if (!e.dead && e.state !== 'sleep' && d < bd) { bd = d; best = e; } }
    if (best) a = Math.atan2(best.y - P.y, best.x - P.x); else if (moving) a = Math.atan2(my, mx);
  }
  const wp = WEAPONS[P.weapon];
  P.face = a; P.combo = P.comboT > 0 ? (P.combo % 3) + 1 : 1; if (!wp.spin && P.combo === 3) P.combo = 1;
  const spin = P.combo === 3;
  P.atkDur = P.atkT = spin ? 0.34 : wp.dur; P.atkCd = spin ? 0.46 : wp.cd; P.comboT = P.atkCd + 0.42; P.hitDone = false;
  P.kx += Math.cos(a) * (spin ? 2 : 3.4); P.ky += Math.sin(a) * (spin ? 2 : 3.4);
  audio.play(spin ? 'spin' : wp.snd, P.combo);
}
function doHit() {
  const wp = WEAPONS[P.weapon], spin = P.combo === 3, range = spin ? 2.15 : wp.range, half = spin ? 4 : wp.half, base = spin ? 2 : wp.dmg, st = GS(); let landed = null;
  if (wp.slam) { const hx = P.x + Math.cos(P.face) * 1.5, hy = P.y + Math.sin(P.face) * 1.5; pulse(hx, hy, [1, 0.85, 0.5], 1.5, 8, 0.45, 0.3); glow(hx, hy, 5, 1.5, [1, 0.85, 0.5], 0.3); burst(hx, hy, 0.3, 10, 0xffd98a, 6); S.shake = Math.max(S.shake, 0.45); audio.play('slam'); }
  if (spin) pulse(P.x, P.y, [1, 0.95, 0.8], 0.9, 9, 0.28, 0.4);
  glow(P.x + Math.cos(P.face), P.y + Math.sin(P.face), 2.8, 0.7, [1, 0.8, 0.9], 0.14);
  W.scars.push({ x: P.x, y: P.y, a: P.face, t: 0, spin }); if (W.scars.length > 4) W.scars.shift();
  for (const e of W.enemies) {
    if (e.dead) continue;
    const d = dist(P.x, P.y, e.x, e.y), a = Math.atan2(e.y - P.y, e.x - P.x);
    if (d <= range + e.r && (d < 0.9 + e.r || Math.abs(angDiff(a, P.face)) <= half)) { const [dm, cr] = roll(base); hitEnemy(e, dm, a, false, cr); landed = landed || e; if (st.leech) P.ink = Math.min(P.maxInk, P.ink + st.leech); }
  }
  if (landed && st.fx.chain && ++P.hits % 4 === 0) freeBolt(landed);
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
  let ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  const moving = ml > 0.12;
  [mx, my] = [mx * CY + my * SY, -mx * SY + my * CY];     // the camera is turned: up on screen is not north
  p.inv = Math.max(0, p.inv - dt); p.dashCd -= dt; p.atkCd -= dt; p.comboT -= dt;
  if (input.use) { input.use = false; interact(); }
  if (input.swap) { input.swap = false; nextWeapon(); }
  if (input.s1) { input.s1 = false; castFire(); }
  if (input.s2) { input.s2 = false; castBolt(); }
  if (input.ride) { input.ride = false; ride(); }
  if (input.fire) { input.fire = false; campfire(); }
  if (p.up) { input.attack = input.held = input.dash = false; }
  if (p.mounted) { input.dash = false; if (input.attack || input.held) dismount(); }
  if (input.dash) {
    input.dash = false;
    if (p.dashCd <= 0 && p.dashT <= 0) {
      const a = moving ? Math.atan2(my, mx) : p.face;
      p.dx = Math.cos(a); p.dy = Math.sin(a); p.dashT = 0.17; p.dashCd = 0.62; p.inv = Math.max(p.inv, 0.27); p.atkT = 0;
      if (moving) p.face = a;
      audio.play('dash'); pulse(p.x, p.y, [0.7, 0.75, 1], 0.5, 6, 0.3); p.cut = [];
      if (GS().fx.trail) { W.burns.push({ x: p.x, y: p.y, r: 1.6, t: 0, life: 2.6, tick: 0 }); if (W.burns.length > 4) W.burns.shift(); }
    }
  }
  if ((input.attack || input.held) && p.atkCd <= 0 && p.dashT <= 0) startAttack(mx, my, moving);
  input.attack = false;
  const tag = W.T.tagAt(p.x, p.y);
  if (p.dashT > 0) {
    p.dashT -= dt; p.vx = p.dx * 14.5; p.vy = p.dy * 14.5;
    if (GS().fx.cut) for (const e of W.enemies) if (!e.dead && !(p.cut || []).includes(e) && e.type !== 'boss' && dist(p.x, p.y, e.x, e.y) < e.r + 0.9) { (p.cut = p.cut || []).push(e); const [dm, cr] = roll(1.5); hitEnemy(e, dm, Math.atan2(e.y - p.y, e.x - p.x), false, cr); }
  }
  else {
    const sp = (p.up ? 2.6 : p.mounted ? 10.2 : (p.atkT > 0 ? 1.5 : 4.7) * (1 + GS().speed / 100)) * (tag === 3 && !p.up ? 0.72 : 1), k = p.up ? 14 : tag === 2 ? 2.2 : p.mounted ? (moving ? 3.2 : 4.5) : (moving ? 10 : 13);
    p.vx += (mx * sp - p.vx) * Math.min(1, k * dt); p.vy += (my * sp - p.vy) * Math.min(1, k * dt);
  }
  p.kx *= Math.pow(0.0008, dt); p.ky *= Math.pow(0.0008, dt);
  if (p.up) {      // on a tower top: free to pace inside the parapet
    p.x += p.vx * dt; p.y += p.vy * dt; const d = dist(p.x, p.y, p.up.x, p.up.y);
    if (d > p.up.rad) { p.x = p.up.x + (p.x - p.up.x) / d * p.up.rad; p.y = p.up.y + (p.y - p.up.y) / d * p.up.rad; }
  } else moveEnt(p, (p.vx + p.kx) * dt, (p.vy + p.ky) * dt, p.mounted ? 0.42 : 0.3);
  p.h += (p.hTo - p.h) * Math.min(1, dt * 7);
  if (moving && p.atkT <= 0 && p.dashT <= 0) p.face += angDiff(Math.atan2(my, mx), p.face) * Math.min(1, 14 * dt);
  const speed = Math.hypot(p.vx, p.vy);
  p.walk += speed * dt * 2.8;
  if (speed > 1.5 && p.dashT <= 0 && !p.mounted) { p.stepT -= dt * speed; if (p.stepT <= 0) { p.stepT = 1.5; audio.play('step'); pulse(p.x, p.y, [0.8, 0.8, 1], 0.22, 2.6, 0.22, 0.15); } }
  if (tag === 1 && p.dashT <= 0 && !p.up) { p.burnT += dt; if (p.burnT > 0.12) hurtPlayer(1, p.x - p.vx, p.y - p.vy + 0.01, 6); } else p.burnT = 0;
  if (p.atkT > 0) {
    const el = p.atkDur - p.atkT;
    if (!p.hitDone && el >= p.atkDur * (p.combo === 3 ? 0.2 : WEAPONS[p.weapon].hitAt)) { p.hitDone = true; doHit(); }
    p.atkT -= dt;
  }
  // which land are we standing in
  const here = W.T.regAt(p.x, p.y);
  if (here !== S.land) { S.landT += dt; if (S.landT > 0.5) enterLand(here); } else S.landT = 0;
}
function poseHero(dt) {
  const p = P, m = p.m, play = S.mode === 'play', speed = play ? Math.hypot(p.vx, p.vy) : 0;
  place(m.g, p.x, p.y, p.h + (p.mounted ? 0.82 : 0)); m.g.rotation.y = rotY(p.face);
  m.legs[0].visible = m.legs[1].visible = !p.mounted;
  const cf = Math.cos(p.face), sf = Math.sin(p.face);
  const wvx = play ? p.vx + p.kx : 0, wvy = play ? p.vy + p.ky : 0;
  const lvx = wvx * sf - wvy * cf, lvz = wvx * cf + wvy * sf;          // velocity in the hero's own frame
  const turn = angDiff(p.face, p.lastFace ?? p.face) / Math.max(dt, 0.001); p.lastFace = p.face;
  const el = p.atkDur - p.atkT, spin = p.combo === 3, atk = p.atkT > 0 && play;
  m.body.position.y = speed > 0.5 ? Math.abs(Math.sin(p.walk)) * 0.08 : Math.sin(S.t * 2) * 0.015;
  m.body.rotation.x = lerp(m.body.rotation.x, p.dashT > 0 ? 0.6 : clamp(lvz * 0.045, -0.15, 0.3) + (atk ? 0.22 : 0), Math.min(1, dt * 12));
  m.body.rotation.z = lerp(m.body.rotation.z, clamp(-lvx * 0.05 - turn * 0.012, -0.3, 0.3), Math.min(1, dt * 10));
  const sw = speed > 0.5 ? Math.sin(p.walk) * 0.8 : 0; m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw;
  // coat: each ring is pulled toward where the one above was, so the hem lags, swings and flares
  const sub = Math.min(dt, 0.033), flare = Math.min(0.3, speed * 0.018) + (atk && spin ? 0.45 : atk ? 0.15 : 0) + (p.dashT > 0 ? 0.2 : 0);
  RB.forEach((r, i) => {
    const k = (i + 1) / 6, lim = 0.07 + 0.16 * k;
    const tx = clamp(-lvx * 0.045 * k - turn * 0.02 * k, -lim, lim), tz = clamp(-lvz * 0.05 * k, -lim, lim) + Math.sin(S.t * 2.2 + i * 0.5) * 0.012 * k;
    r.vx += ((tx - r.x) * 70 - r.vx * 8) * sub; r.vz += ((tz - r.z) * 70 - r.vz * 8) * sub; r.x += r.vx * sub; r.z += r.vz * sub;
    const mesh = m.robe[i], w = (0.6 + i * 0.085) * (1 + flare * k);
    mesh.position.x = r.x; mesh.position.z = r.z; mesh.scale.x = w; mesh.scale.z = w * 0.88;
  });
  m.scarf.forEach((sc, i) => { const r = RB[Math.min(5, i + 1)]; sc.position.x = -0.14 + r.x * 2.2 + Math.sin(S.t * 7 - i * 0.9) * (0.03 + i * 0.03); sc.position.z = -0.34 - i * 0.26 + r.z * 1.6; sc.position.y = 2.02 + Math.sin(S.t * 5 - i) * 0.03 + Math.min(0.3, speed * 0.03) * i * 0.4; });
  m.tip.rotation.x = -0.8 - clamp(lvz * 0.07, -0.2, 0.6); m.head.rotation.y = clamp(turn * 0.02, -0.4, 0.4);
  if (atk) {
    const k = clamp(el / p.atkDur, 0, 1), dir = p.combo === 2 ? -1 : 1;
    m.armR.rotation.set(-0.1, spin ? k * Math.PI * 2 : dir * lerp(1.7, -1.7, k), 0);
    m.arc.visible = !spin && el > 0.03 && el < 0.17; m.arc.scale.setScalar((1.5 + k * 0.5) * WEAPONS[p.weapon].range / 1.8); m.arc.scale.y *= dir;
    m.spin.visible = spin && el > 0.04 && el < 0.26; m.spin.scale.setScalar(0.9 + k * 1.3);
  } else { m.armR.rotation.set(-1.2 - sw * 0.1, 0.12, 0); m.arc.visible = m.spin.visible = false; }
  m.armL.rotation.x = -0.2 + sw * 0.2; m.lantern.rotation.x = clamp(-lvz * 0.06, -0.5, 0.5) - sw * 0.1;
  if (S.mode !== 'dead') m.g.visible = !(p.inv > 0 && p.dashT <= 0 && Math.floor(S.t * 22) % 2 === 0);
  // the quill's ribbon: remember where the blade was for the last moments of a swing or a dash
  m.g.updateMatrixWorld(true);
  const pts = W.trailPts;
  for (const q of pts) q.t += dt;
  while (pts.length && pts[0].t > 0.16) pts.shift();
  if ((atk || p.dashT > 0) && m.g.visible) { pts.push({ a: m.weapons[p.weapon].tip.getWorldPosition(new THREE.Vector3()), b: m.weapons[p.weapon].base.getWorldPosition(new THREE.Vector3()), t: 0 }); if (pts.length > TRAIL + 1) pts.shift(); }
  const arr = W.trail.geometry.attributes.position.array; arr.fill(0);
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], o = i * 18;
    for (const [k, v] of [[0, a.a], [1, a.b], [2, b.a], [3, a.b], [4, b.b], [5, b.a]]) { arr[o + k * 3] = v.x; arr[o + k * 3 + 1] = v.y; arr[o + k * 3 + 2] = v.z; }
  }
  W.trail.geometry.attributes.position.needsUpdate = true;
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
const BASE = { blot: { hp: 2, r: 0.42, er: 1.05, sp: 2.5 }, scratch: { hp: 2, r: 0.38, er: 0.9, sp: 1.9 }, brute: { hp: 7, r: 0.74, er: 1.55, sp: 1.35 }, boss: { hp: 54, r: 1.5, er: 2.4, sp: 0 },
  typo: { hp: 1, r: 0.28, er: 0.7, sp: 4.3 }, asterisk: { hp: 2, r: 0.42, er: 1.0, sp: 3.2 }, ghost: { hp: 3, r: 0.45, er: 1.0, sp: 2.2 }, redactor: { hp: 16, r: 0.8, er: 1.7, sp: 1.5 }, mimic: { hp: 9, r: 0.6, er: 1.2, sp: 3.5 } };
function spawnEnemy(type, x, y, owner = null, sleep = false) {
  const b = BASE[type], o = M.makeEnemy(type), land = W.T.regAt(x, y);
  const hp = b.hp + (type === 'blot' && land >= 3 ? 1 : 0) + (type === 'brute' && land >= 4 ? 2 : 0) + (type === 'redactor' ? land * 2 : 0);
  const e = { type, land, x, y, hx: x, hy: y, kx: 0, ky: 0, hp, maxHp: hp, r: b.r, er: b.er, sp: b.sp * (1 + land * 0.05), o, state: sleep ? 'sleep' : 'spawn', t: 0, cd: rnd(0.5, 1.4), face: rnd(6), dx: 0, dy: 0, flash: 0, owner, dead: false, grow: sleep ? 1 : 0, strafe: Math.random() < 0.5 ? 1 : -1, ph: rnd(6) };
  place(o.g, x, y); o.g.scale.setScalar(sleep ? 1 : 0.01); R.root.add(o.g); W.enemies.push(e);
  return e;
}
function hitEnemy(e, dmg, a, soft = false, crit = false) {
  if (e.dead || (e.type === 'boss' && e.state === 'spawn') || (e.type === 'ghost' && e.state === 'fade' && e.t > 0.2)) return;
  e.hp -= dmg; e.flash = 0.1;
  const kb = e.type === 'boss' ? 0 : HEAVY[e.type] ? (e.state === 'charge' ? 0 : 2.2) : 7;
  e.kx = Math.cos(a) * kb * (soft ? 0.12 : 1); e.ky = Math.sin(a) * kb * (soft ? 0.12 : 1);
  if (e.state === 'sleep') e.state = 'chase';
  if (e.type !== 'boss' && !HEAVY[e.type] && (e.state === 'wind' || e.state === 'leap')) { e.state = 'chase'; e.cd = 0.5; }
  burst(e.x, e.y, 0.9, 4, 0xffffff, 4); audio.play('hit');
  floatText(e.x, e.y, e.type === 'boss' ? 3.6 : 1.9, (crit ? 'CRIT ' : '') + String(Math.max(1, Math.round(dmg * 10 + rnd(-3, 4)))), crit ? 'dmg critx' : soft ? 'burn' : dmg >= 2 ? 'dmg crit' : 'dmg'); glow(e.x, e.y, 2.4, 1.1, [1, 0.95, 0.85], 0.16);
  if (!soft) { S.hitstop = Math.max(S.hitstop, dmg > 1 ? 0.07 : 0.04); S.shake = Math.max(S.shake, 0.16); }
  if (e.type === 'boss') $('bossbar').firstChild.style.width = clamp(e.hp / e.maxHp * 100, 0, 100) + '%';
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true;
  if (e.type === 'boss') return bossDead(e);
  gainXP({ blot: 6, scratch: 8, brute: 20, typo: 3, asterisk: 8, ghost: 14, redactor: 45, mimic: 40 }[e.type] || 5); maybeDrop(e);
  if (GS().fx.pop) { pulse(e.x, e.y, [1, 0.55, 0.15], 1.2, 9, 0.4); for (const o of W.enemies) if (!o.dead && o !== e && dist(o.x, o.y, e.x, e.y) < 2.4 + o.r) after(0.08, () => hitEnemy(o, ...roll(1.5), Math.atan2(o.y - e.y, o.x - e.x))); }
  removeObj(e.o.g); audio.play('kill'); glow(e.x, e.y, 4, 1.2, [0.75, 0.55, 1], 0.45);
  burst(e.x, e.y, 0.8, HEAVY[e.type] ? 22 : 12, 0xc9a8ff, 6); pulse(e.x, e.y, [0.8, 0.7, 1], 1, 7, 0.5);
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
  } else if (NAMES[e.type]) {
    [vx, vy, hop, sy, sxz, lean] = updateWild(e, dt, d, a, alive); if (e.dead) return;
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
    if (sl) { tx = sl.x - e.x; tz = sl.y - e.y; ty = sl.t < sl.dur ? 3.4 : -0.3 - hov; }
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
      pulse(s.x, s.y, [1, 0.3, 0.4], 1.6, 9, 0.6, 0.6); burst(s.x, s.y, 0.3, 12, 0xff3a5a, 7); glow(s.x, s.y, 5, 1.5, [1, 0.3, 0.2], 0.6);
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
  gainXP(120); after(1.2, () => { dropItem(e.x, e.y, 3, 14 + P.lvl); dropItem(e.x, e.y, 2, 12 + P.lvl); });
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
      pulse(l.x, l.y, [1, 0.95, 0.75], 1.6, 8, 0.8); burst(l.x, l.y, 1.2, 14, 0xfff1c9, 6); glow(l.x, l.y, 6, 1.4, [1, 0.9, 0.6], 0.9); floatText(l.x, l.y, 2.4, '+' + l.ch, 'gain'); gainXP(15);
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
  updateHorse(dt); updateMagic(dt);
  if (W.fire) {
    const f = W.fire; f.t += dt; f.heal += dt;
    if (Math.random() < dt * 7) burst(f.x + rnd(-0.2, 0.2), f.y + rnd(-0.2, 0.2), 0.7, 1, Math.random() < 0.5 ? 0xffb050 : 0xffe9a8, 0.9);
    if (f.heal > 2.2 && play && P.hp < P.maxHp && dist(P.x, P.y, f.x, f.y) < 3.2) { f.heal = 0; P.hp++; hudHearts(); audio.play('heart'); floatText(P.x, P.y, 2.8, '+1', 'gain'); }
  }
  for (const n of W.npcs) { const d = dist(P.x, P.y, n.x, n.y); if (d > 24) continue; n.g.position.y = Math.sin(S.t * 1.8 + n.ph) * 0.03; if (d < 7) n.g.rotation.y += angDiff(rotY(Math.atan2(P.y - n.y, P.x - n.x)), n.g.rotation.y) * Math.min(1, dt * 4); }
  for (const m of W.spins) m.rotation.z += dt * m.userData.spin * (1 + 0.4 * Math.sin(S.t * 0.5));
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
  for (const g of W.glows) g.life -= dt; W.glows = W.glows.filter(g => g.life > 0);
  for (const sc of W.scars) sc.t += dt; W.scars = W.scars.filter(sc => sc.t < 1.5);
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
const zoomBright = () => clamp((0.95 - S.zoom) / 0.55, 0, 1);
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
  if (W.fire) Ls.push([W.fire.x, W.fire.y, 7.5 * (1 + Math.sin(S.t * 9) * 0.04), 1.5 + Math.sin(S.t * 13) * 0.12, 1, 0.62, 0.25, 0.2]);
  for (const b of W.burns) Ls.push([b.x, b.y, b.r * 2.6, 1.4 * clamp((b.life - b.t) / 1.2, 0, 1), 1, 0.5, 0.15, 0.3]);
  for (const e of W.elixirs) if (e.g) Ls.push([e.x, e.y, 1.7, 0.9, ...ELX[e.kind].col, dist(e.x, e.y, S.camX, S.camY) + 3]);
  for (const g of W.glows) Ls.push([g.x, g.y, g.r, g.int * g.life / g.max, ...g.col, 0.5]);
  Ls.sort((a, b) => a[7] - b[7]);
  for (let i = 0; i < MAX_LIGHTS; i++) {
    const l = Ls[i]; if (l) { u.uLights.value[i].set(l[0], l[1], l[2], l[3]); u.uLightCol.value[i].set(l[4], l[5], l[6]); } else u.uLights.value[i].set(0, 0, 1, 0);
  }
  const pts = R.points; let pi = 0;
  const setP = (x, y, h, col, int, d) => { if (pi < pts.length) { const p = pts[pi++]; place(p, x, y, h); p.color.setRGB(col[0], col[1], col[2]); p.intensity = int; p.distance = d; } };
  if (S.mode !== 'dead') setP(P.x + SY * 0.4, P.y + CY * 0.4, 1.5 + P.h, [1, 0.88, 0.7], 9 * fl, env.lightR + 2.5);
  let n1 = null, n2 = null, d1 = 1e9, d2 = 1e9;
  for (const l of W.lamps) { const d = dist(l.x, l.y, S.camX, S.camY); if (d < d1) { d2 = d1; n2 = n1; d1 = d; n1 = l; } else if (d < d2) { d2 = d; n2 = l; } }
  if (W.fire && dist(W.fire.x, W.fire.y, S.camX, S.camY) < 30) setP(W.fire.x + SY * 0.3, W.fire.y + CY * 0.3, 1.2, [1, 0.6, 0.25], 12, 9);
  for (const l of [n1, n2]) if (l) setP(l.x + SY * 0.3, l.y + CY * 0.3, 1.9, l.col, 6, 6);
  while (pi < pts.length) pts[pi++].intensity = 0;
  const er = [];
  for (const e of W.enemies) { if (e.dead) continue; const d = dist(e.x, e.y, P.x, P.y); if (d < 40) er.push([e.x, e.y, e.er * e.grow * (e.state === 'sleep' ? 0.75 : 1), d]); }
  for (const s of W.slams) if (s.set && !s.done) er.push([s.x, s.y, 1.75 * clamp(s.t / s.dur, 0, 1), 0]);
  er.sort((a, b) => a[3] - b[3]);
  for (let i = 0; i < MAX_ERASE; i++) { const e = er[i]; if (e) u.uErase.value[i].set(e[0], e[1], e[2]); else u.uErase.value[i].set(0, 0, 0); }
  const ps = W.pulses.slice(-MAX_PULSE);
  for (let i = 0; i < MAX_PULSE; i++) { const p = ps[i]; if (p) { u.uPulse.value[i].set(p.x, p.y, p.r, p.w * clamp(p.life / p.max, 0, 1)); u.uPulseCol.value[i].set(...p.col); } else u.uPulse.value[i].set(0, 0, 0, 0); }
  for (let i = 0; i < 4; i++) { const l = W.lines[i]; if (l && l.t >= 0) u.uLine.value[i].set(l.pos, l.dir, l.hw, l.t < l.tele ? 0.3 + 0.3 * (Math.floor(l.t * 12) % 2) + l.t / l.tele * 0.3 : 2.2); else u.uLine.value[i].set(0, 0, 0, 0); }
  for (let i = 0; i < 4; i++) { const b = W.burns[i]; if (b) u.uBurn.value[i].set(b.x, b.y, b.r * Math.min(1, b.t * 6), clamp((b.life - b.t) / 1.2, 0, 1)); else u.uBurn.value[i].set(0, 0, 0, 0); }
  let bi = 0, ba = 0;
  for (const b of W.bolts) { ba = Math.max(ba, 1 - b.t / 0.3); for (let i = 0; i + 1 < b.pts.length && bi < 6; i++) u.uBolt.value[bi++].set(b.pts[i][0], b.pts[i][1], b.pts[i + 1][0], b.pts[i + 1][1]); }
  while (bi < 6) u.uBolt.value[bi++].set(0, 0, 0, 0); u.uBoltA.value = ba;
  const rings = [];
  for (const e of W.enemies) {
    if (e.dead || rings.length >= 6) continue;
    if (e.type === 'blot' && e.state === 'wind') rings.push([e.x + Math.cos(e.face) * 2.5, e.y + Math.sin(e.face) * 2.5, 0.85, 0.5 + e.t * 1.3]);
    else if (e.type === 'scratch' && e.state === 'wind') rings.push([P.x, P.y, 0.7, 0.4 + e.t]);
    else if (e.type === 'asterisk' && e.state === 'wind') rings.push([e.x, e.y, 2.7, 0.5 + e.t * 1.2]);
    else if (e.type === 'redactor' && e.state === 'wind') rings.push([e.x, e.y, 3.5, 0.4 + e.t]);
    else if (e.type === 'mimic' && e.state === 'wind') rings.push([e.x + Math.cos(e.face) * 3, e.y + Math.sin(e.face) * 3, 1.0, 0.5 + e.t * 1.5]);
    else if (e.type === 'brute' && e.state === 'wind') rings.push([e.x + Math.cos(e.face) * 4, e.y + Math.sin(e.face) * 4, 1.3, 0.4 + e.t]);
    else if (e.type === 'boss' && e.state === 'burst' && e.step === 0) rings.push([e.x, e.y + 0.4, 2.8, 0.5 + e.t * 1.4]);
  }
  for (const sl of W.slams) if (sl.set && !sl.done && rings.length < 6) rings.push([sl.x, sl.y, 1.75, 0.5 + 0.5 * sl.t / sl.dur]);
  for (let i = 0; i < 6; i++) { const r = rings[i]; if (r) u.uRing.value[i].set(r[0], r[1], r[2], Math.min(1, r[3])); else u.uRing.value[i].set(0, 0, 0, 0); }
  for (let i = 0; i < 4; i++) { const sc = W.scars[i]; if (sc) u.uScar.value[i].set(sc.x, sc.y, sc.spin ? 99 : sc.a, 1 - sc.t / 1.5); else u.uScar.value[i].set(0, 0, 0, 0); }
  // pulling the camera back turns the lights up, so the map can be read
  const k = S.amb + zoomBright() * 0.85, a = env.amb;
  u.uMap.value = clamp((0.5 - S.zoom) / 0.25, 0, 1);
  u.uAmbient.value.set(a[0] + k * 0.75, a[1] + k * 0.72, a[2] + k * 0.66);
  u.uBg.value.set(env.bg[0], env.bg[1], env.bg[2]);
  u.uDark.value = env.dark * (1 - zoomBright()) - zoomBright() * 0.55;
  u.uPlayer.value.set(P.x, P.y); u.uReveal.value = S.reveal; u.uFlash.value = S.flash;
  u.uWeather.value = W.wx.type; u.uWeatherAmt.value = W.wx.amt * (1 - zoomBright() * 0.7); u.uWeatherCol.value.set(...W.wx.col);
  R.ambient.color.copy(env.a3c).lerp(WHITE3, 0.45); R.ambient.intensity = env.a3i * 2.4 + k * 1.2;
  R.moon.color.copy(env.mc).lerp(WHITE3, 0.3); R.moon.intensity = env.mi * 2.0;
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
const labels = new Set();
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
  // names and health over whatever is awake, like a party frame in the world
  const near = S.zoom > 0.55 && (S.mode === 'play' || S.mode === 'dead');
  for (const e of W.enemies) {
    const on = near && !e.dead && e.type !== 'boss' && e.state !== 'sleep' && e.grow > 0.9;
    if (!on) { if (e.lab) e.lab.style.display = 'none'; continue; }
    if (!e.lab) { e.lab = document.createElement('div'); e.lab.className = 'lab'; e.lab.innerHTML = `<span>${NAMES[e.type] || e.type[0].toUpperCase() + e.type.slice(1)}</span><i><b></b></i>`; $('fx').appendChild(e.lab); labels.add(e); }
    const [x, y] = R.toScreen(e.x, e.y, { brute: 2.6, scratch: 2.7, redactor: 3.3, ghost: 3.1, asterisk: 2.0, typo: 1.2, mimic: 1.6 }[e.type] || 1.7);
    e.lab.style.display = 'block'; e.lab.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    e.lab.lastChild.firstChild.style.width = clamp(e.hp / e.maxHp * 100, 0, 100) + '%';
  }
  for (const e of labels) if (e.dead || !W.enemies.includes(e)) { e.lab.remove(); e.lab = null; labels.delete(e); }
  lootLabels(near);
  const use = near ? interactTarget() : null, pr = $('prompt');
  if (use) { const tgt = use; const [x, y] = R.toScreen(tgt.x, tgt.y, tgt.h); pr.style.display = 'block'; pr.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; const tx = (document.body.classList.contains('touch') ? 'USE: ' : '[E] ') + tgt.text; if (pr.textContent !== tx) pr.textContent = tx; } else pr.style.display = 'none';
  for (const n of W.npcs) {
    const on = near && dist(P.x, P.y, n.x, n.y) < 9;
    if (!on) { if (n.lab) n.lab.style.display = 'none'; continue; }
    if (!n.lab) { n.lab = document.createElement('div'); n.lab.className = 'lab npc'; n.lab.textContent = n.name; $('fx').appendChild(n.lab); }
    const [x, y] = R.toScreen(n.x, n.y, 2.8); n.lab.style.display = 'block'; n.lab.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }
  const you = $('you2'), [hx, hy] = R.toScreen(P.x, P.y, 3.1 + P.h + (P.mounted ? 0.8 : 0));
  you.style.display = near && P.m.g.visible ? 'block' : 'none'; you.style.transform = `translate(${hx}px, ${hy}px) translate(-50%, -100%)`;
  const now = nowMs();
  for (const f of floats) {
    const age = (now - f.t) / 1000, [x, y] = R.toScreen(f.x, f.y, f.h + age * 1.8);
    f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.12 - age) * 4})`; f.el.style.opacity = clamp(1.6 - age * 2, 0, 1);
    if (age > 0.8) { f.el.remove(); f.dead = true; }
  }
  for (let i = floats.length - 1; i >= 0; i--) if (floats[i].dead) floats.splice(i, 1);
  // map labels once the camera is far enough back
  const far = clamp((0.36 - S.zoom) / 0.1, 0, 1), map = $('map');
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
    updateLoot(dt); updateCaches(dt);
  }
  updateWorld(dt); updateMsg(dt);
}
function camera(dt) {
  // zoom
  if (keys.has('Equal') || keys.has('NumpadAdd')) S.zoomTo *= Math.pow(2.2, dt);
  if (keys.has('Minus') || keys.has('NumpadSubtract')) S.zoomTo *= Math.pow(2.2, -dt);
  S.zMin = Math.min(R.W / ((SIZE[0] * CY + SIZE[1] * SY) * R.U0), R.H / ((SIZE[0] * SY + SIZE[1] * CY) * SINP * R.U0)) * 0.97;
  S.zoomTo = clamp(S.zoomTo, S.zMin, 2.2);
  S.zoom = Math.abs(S.zoomTo - S.zoom) < 0.002 ? S.zoomTo : S.zoom * Math.pow(S.zoomTo / S.zoom, Math.min(1, dt * 9));
  R.setZoom(S.zoom);
  const lead = P.mounted ? 1.6 : 0.5, lift = 0.9 + P.h * 0.75;      // look ahead further at a gallop; look up when on high ground
  let tx = P.x + Math.cos(P.face) * lead - SY * lift, ty = P.y + Math.sin(P.face) * lead - CY * lift;
  if ((W.bossState === 'fight' || W.bossState === 'dying') && W.boss) { tx = lerp(P.x, W.boss.x, 0.38) - SY * 1.6; ty = lerp(P.y, W.boss.y, 0.38) - CY * 1.6; }
  if (S.mode === 'title') { tx = W.B.start.x + 9 + Math.sin(S.t * 0.15) * 4; ty = W.B.start.y - 5 + Math.cos(S.t * 0.11) * 2; }
  // far back, centre on the page instead of the hero
  const kk = clamp((0.34 - S.zoom) / Math.max(0.01, 0.34 - S.zMin), 0, 1);
  tx = lerp(tx, SIZE[0] / 2, kk * kk); ty = lerp(ty, SIZE[1] / 2, kk * kk);
  tx += S.offX || 0; ty += S.offY || 0;
  S.camX += (tx - S.camX) * Math.min(1, 5 * dt); S.camY += (ty - S.camY) * Math.min(1, 5 * dt);
}
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!W || S.cap) return;
  if (!S.paused) for (let i = 0; i < (S.steps || 1); i++) step(dt);
  camera(dt);
  fillUniforms();
  const sh = S.shake * S.shake * R.U * 0.5;
  R.render(S.camX, S.camY, S.t, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
  updateOverlay();
}

// ---------------------------------------------------------------- input
// one hand-cranked frame, for filming the trailer
function tick(dt) { S.capT = (S.capT || 0) + dt; step(dt); camera(dt); fillUniforms(); const sh = S.shake * S.shake * R.U * 0.5; R.render(S.camX, S.camY, S.t, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh); updateOverlay(); }
function zoomBy(f) { S.zoomTo = clamp(S.zoomTo * f, S.zMin, 2.2); }
function bind() {
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'KeyI' || e.code === 'Tab' || e.code === 'KeyB') { e.preventDefault(); return toggleBag(); }
    if ($('bag').classList.contains('on')) { if (e.code === 'Escape') toggleBag(false); return; }
    keys.add(e.code); audio.start();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (S.mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) return startGame(!!readSave());
    if (e.code === 'KeyJ' || e.code === 'Space') { input.attack = true; input.held = true; }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyK') input.dash = true;
    if (e.code === 'KeyE') input.use = true;
    if (e.code === 'KeyQ') input.swap = true;
    if (e.code === 'Digit1') input.s1 = true;
    if (e.code === 'Digit2') input.s2 = true;
    if (e.code === 'KeyR') input.ride = true;
    if (e.code === 'KeyF') input.fire = true;
    if (e.code === 'KeyM') toggleSound();
    if (e.code === 'KeyZ') S.zoomTo = S.zoomTo < 0.5 ? 1.0 : S.zMin;
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
  btn('bU', () => { input.use = true; }); btn('bR', () => { input.ride = true; }); btn('bF', () => { input.fire = true; }); btn('bW', () => { input.swap = true; }); btn('b1', () => { input.s1 = true; }); btn('b2', () => { input.s2 = true; });
  bindBag();
  $('start').addEventListener('click', () => startGame(false));
  $('cont').addEventListener('click', () => startGame(true));
  $('snd').addEventListener('click', toggleSound);
  $('pz').addEventListener('click', togglePause);
  $('zin').addEventListener('click', () => zoomBy(1.5));
  $('zout').addEventListener('click', () => zoomBy(1 / 1.5));
  $('zmap').addEventListener('click', () => { S.zoomTo = S.zoomTo < 0.5 ? 1.0 : S.zMin; });
  $('resume').addEventListener('click', togglePause);
  $('quit').addEventListener('click', () => location.reload());
  $('again').addEventListener('click', () => { clearSave(); location.reload(); });
}
function toggleSound() { audio.start(); $('snd').textContent = audio.toggle() ? 'SOUND OFF' : 'SOUND ON'; }
function togglePause() {
  if (S.mode === 'title' || S.mode === 'end') return;
  if ($('bag').classList.contains('on')) return toggleBag(false);
  S.paused = !S.paused; $('pause').classList.toggle('on', S.paused); last = performance.now();
  if (audio.ctx) S.paused ? audio.ctx.suspend() : audio.ctx.resume();
}
function startGame(cont) {
  if (S.mode !== 'title') return;
  audio.start(); $('title').classList.remove('on'); $('hud').classList.add('on'); document.body.classList.add('playing');
  S.runT = 0; S.deaths = 0; S.mode = 'play';
  const sv = cont && readSave();
  if (sv) { applySave(sv); S.land = -1; enterLand(W.T.regAt(P.x, P.y)); }
  else { clearSave(); S.land = -1; enterLand(0); after(8.5, () => say('No walls out here. Go anywhere. R calls your horse, Z shows the whole world.', 4)); }
  $('hint').textContent = 'CLICK STRIKE \u00b7 Q WEAPON \u00b7 1 FIRE \u00b7 2 BOLT \u00b7 SHIFT DASH \u00b7 R HORSE \u00b7 E USE \u00b7 F CAMP \u00b7 I BAG';
  setTimeout(() => { $('hint').textContent = ''; }, 30000);
}

async function boot() {
  try {
    try { await Promise.all([document.fonts.load('500 20px "JetBrains Mono"'), document.fonts.load('800 20px "JetBrains Mono"')]); } catch (e) { /* fall back to system monospace */ }
    R = new Renderer($('game'));
    bind();
    if (matchMedia('(pointer: coarse)').matches) { document.body.classList.add('touch'); $('keys').textContent = 'LEFT THUMB move \u00b7 STRIKE \u00b7 DASH \u00b7 USE \u00b7 HORSE \u00b7 FIRE \u00b7 PINCH zoom \u00b7 BAG top right'; }
    loadWorld(); S.mode = 'title'; S.reveal = 0; S.revealTo = 1;
    if (readSave()) $('cont').style.display = ''; else $('start').textContent = 'BEGIN';
    $('loading').style.display = 'none'; $('start').style.visibility = 'visible';
    audio.pending = LANDS[0].music;
    requestAnimationFrame(frame);
    const q = new URLSearchParams(location.search);
    if (q.has('debug')) window.__uw = { S, P, R, get W() { return W; }, LANDS, startGame, wordComplete, hitEnemy, keys, input, lightBeacon, startBoss, spawn: spawnEnemy, hurtPlayer, openGate, save, objective, ride, interact, campfire, castFire, castBolt, gainXP, nextWeapon, tick, setWeapon, say, audio, dropItem, makeItem, equip, toggleBag, RARITY, openCache };
  } catch (err) {
    console.error(err); $('err').style.display = 'flex'; $('title').classList.remove('on');
  }
}
boot();
