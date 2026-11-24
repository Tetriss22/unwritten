// UNWRITTEN — everything that stands on the page is built here from primitives.
// The ASCII pass only sees brightness and hue, so shapes are simple and bold.
import * as THREE from '../lib/three.module.min.js';

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(0.5, 14, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 12),
  cone4: new THREE.ConeGeometry(0.5, 1, 4),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  ico: new THREE.IcosahedronGeometry(0.5, 0),
  oct: new THREE.OctahedronGeometry(0.5, 0),
  tet: new THREE.TetrahedronGeometry(0.5, 0),
  tor: new THREE.TorusGeometry(0.5, 0.07, 6, 20),
  arc: new THREE.RingGeometry(0.78, 1.0, 20, 1, -1.15, 2.3),
  ring: new THREE.RingGeometry(0.9, 1.0, 28),
  frust: new THREE.CylinderGeometry(0.28, 0.5, 1, 12),
};
const cache = new Map();
export function lam(hex, flat = false) {
  const k = 'l' + hex + flat;
  if (!cache.has(k)) cache.set(k, new THREE.MeshLambertMaterial({ color: hex, flatShading: flat }));
  return cache.get(k);
}
export function glow(hex) {
  const k = 'g' + hex;
  if (!cache.has(k)) cache.set(k, new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.75, blending: THREE.NoBlending }));
  return cache.get(k);
}
export const WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, blending: THREE.NoBlending });
function inkMat(hex, em) { const k = 'i' + hex; if (!cache.has(k)) cache.set(k, new THREE.MeshLambertMaterial({ color: hex, emissive: em })); return cache.get(k); }

function part(parent, geo, mat, sx, sy, sz, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z); parent.add(m);
  return m;
}

// ---------- the Scribe: legs, long coat, pointed hood, scarf, a quill as tall as a spear, a lantern
export function makeHero() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const coat = lam(0xffffff), cape = lam(0x7a66e8), dark = lam(0x5a4e98), skin = lam(0xffe0c8), scarfM = glow(0xff7fc0), gold = glow(0xffd98a);
  const legs = [-1, 1].map(sd => {
    const l = new THREE.Group(); l.position.set(sd * 0.15, 0.82, 0); body.add(l);
    part(l, G.cyl, dark, 0.19, 0.78, 0.19, 0, -0.39, 0);
    part(l, G.box, lam(0x2a2440), 0.22, 0.14, 0.36, 0, -0.76, 0.07);
    return l;
  });
  part(body, G.frust, coat, 0.92, 0.95, 0.8, 0, 1.12, 0);                 // coat skirt
  part(body, G.box, dark, 0.56, 0.1, 0.5, 0, 1.5, 0);                     // belt
  part(body, G.frust, coat, 0.8, 0.5, 0.75, 0, 1.62, 0).rotation.x = Math.PI;   // chest
  part(body, G.frust, cape, 0.98, 0.34, 0.86, 0, 1.76, -0.03);            // shoulder cape
  part(body, G.box, lam(0x8a6a48), 0.26, 0.34, 0.14, -0.33, 1.12, -0.2);   // book satchel
  const head = new THREE.Group(); head.position.set(0, 2.08, 0); body.add(head);
  part(head, G.sph, skin, 0.36, 0.38, 0.36, 0, 0, 0.05);
  part(head, G.sph, cape, 0.44, 0.44, 0.44, 0, 0.06, -0.08);
  part(head, G.cone, cape, 0.26, 0.7, 0.26, 0, 0.42, -0.24).rotation.x = -0.8;   // hood tip
  part(head, G.sph, glow(0xffffff), 0.075, 0.075, 0.05, -0.085, -0.02, 0.27);
  part(head, G.sph, glow(0xffffff), 0.075, 0.075, 0.05, 0.085, -0.02, 0.27);
  const scarf = [];
  part(body, G.tor, scarfM, 0.6, 0.6, 1.4, 0, 1.86, 0).rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) scarf.push(part(body, G.box, scarfM, 0.2 - i * 0.03, 0.09, 0.3, -0.14, 1.84, -0.34 - i * 0.26));
  // right arm with the quill
  const armR = new THREE.Group(); armR.position.set(0.36, 1.74, 0.02); body.add(armR);
  part(armR, G.cyl, coat, 0.16, 0.62, 0.16, 0.06, -0.26, 0.1).rotation.x = -0.4;
  part(armR, G.sph, skin, 0.15, 0.15, 0.15, 0.08, -0.54, 0.24);
  const quill = new THREE.Group(); quill.position.set(0.08, -0.54, 0.24); armR.add(quill);
  part(quill, G.cyl, glow(0xffffff), 0.055, 1.7, 0.055, 0, 0, 0.55).rotation.x = Math.PI / 2;
  part(quill, G.cone4, gold, 0.14, 0.36, 0.07, 0, 0, 1.56).rotation.x = Math.PI / 2;
  part(quill, G.box, glow(0xe6dcff), 0.03, 0.42, 0.8, 0, 0.17, -0.02).rotation.x = 0.2;
  part(quill, G.box, glow(0xe6dcff), 0.03, 0.3, 0.5, 0, -0.1, -0.1).rotation.x = -0.25;
  // left arm with the lantern
  const armL = new THREE.Group(); armL.position.set(-0.36, 1.74, 0.02); body.add(armL);
  part(armL, G.cyl, coat, 0.16, 0.62, 0.16, -0.06, -0.26, 0.12).rotation.x = -0.5;
  part(armL, G.sph, skin, 0.15, 0.15, 0.15, -0.08, -0.52, 0.28);
  const lantern = new THREE.Group(); lantern.position.set(-0.08, -0.86, 0.3); armL.add(lantern);
  part(lantern, G.box, gold, 0.24, 0.3, 0.24);
  part(lantern, G.cone4, lam(0x5a4a3a), 0.36, 0.16, 0.36, 0, 0.23, 0).rotation.y = Math.PI / 4;
  part(lantern, G.cyl, lam(0x5a4a3a), 0.03, 0.22, 0.03, 0, 0.36, 0);
  const flat = { side: THREE.DoubleSide, transparent: true, opacity: 0.75, blending: THREE.NoBlending };
  const arc = new THREE.Mesh(G.arc, new THREE.MeshBasicMaterial({ color: 0xffffff, ...flat }));
  const arcWrap = new THREE.Group(); arcWrap.rotation.y = -Math.PI / 2; g.add(arcWrap);
  arc.rotation.x = -Math.PI / 2; arc.position.y = 1.0; arc.visible = false; arcWrap.add(arc);
  const spin = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: 0xfff1c9, ...flat }));
  spin.rotation.x = -Math.PI / 2; spin.position.y = 1.0; spin.visible = false; g.add(spin);
  g.traverse(m => { if (m.isMesh) m.layers.set(m === arc || m === spin ? 2 : 3); });   // layer 3: drawn after the world, with a see-through pass
  return { g, body, head, armR, armL, quill, lantern, scarf, arc, spin, legs };
}

// ---------- the unwriters
export function makeEnemy(type) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const ink = inkMat(0xa88cf0, 0x2c1c50), ink2 = inkMat(0x6a50a8, 0x1c1238), eye = glow(0xff3a5a);
  const o = { g, body, type };
  if (type === 'blot') {
    part(body, G.sph, ink, 1.0, 0.86, 1.0, 0, 0.5, 0);
    part(body, G.cone, ink2, 0.24, 0.5, 0.24, -0.26, 1.0, 0).rotation.z = 0.35;
    part(body, G.cone, ink2, 0.24, 0.5, 0.24, 0.26, 1.0, 0).rotation.z = -0.35;
    part(body, G.sph, eye, 0.2, 0.24, 0.12, -0.19, 0.6, 0.43);
    part(body, G.sph, eye, 0.2, 0.24, 0.12, 0.19, 0.6, 0.43);
    for (let i = 0; i < 5; i++) part(body, G.sph, ink2, 0.3, 0.2, 0.3, Math.cos(i * 1.26) * 0.45, 0.1, Math.sin(i * 1.26) * 0.45);
  } else if (type === 'scratch') {
    part(body, G.cone, ink, 0.6, 1.5, 0.6, 0, 1.05, 0).rotation.x = Math.PI;
    part(body, G.oct, ink2, 0.5, 0.5, 0.5, 0, 1.95, 0);
    part(body, G.sph, eye, 0.26, 0.26, 0.16, 0, 1.5, 0.24);
    o.ring = part(body, G.tor, glow(0xc9a8ff), 1.2, 1.2, 1.2, 0, 1.25, 0); o.ring.rotation.x = Math.PI / 2;
  } else if (type === 'brute') {
    part(body, G.box, ink, 1.5, 1.7, 0.9, 0, 0.95, 0);
    part(body, G.box, ink2, 1.7, 0.3, 1.0, 0, 1.85, 0);
    part(body, G.box, eye, 1.0, 0.14, 0.1, 0, 1.3, 0.48);
    o.armL = part(body, G.box, ink2, 0.4, 1.1, 0.5, -0.98, 0.8, 0.1);
    o.armR = part(body, G.box, ink2, 0.4, 1.1, 0.5, 0.98, 0.8, 0.1);
  } else if (type === 'boss') {
    // THE EDITOR: a floating redaction bar with one eye, a ragged cloak and two hands
    const bar = inkMat(0xb090ff, 0x30205a), red = glow(0xff3a5a);
    o.head = new THREE.Group(); o.head.position.y = 2.7; body.add(o.head);
    part(o.head, G.box, bar, 3.6, 1.1, 1.0);
    part(o.head, G.box, ink2, 4.0, 0.22, 1.1, 0, 0.66, 0);
    for (let i = -3; i <= 3; i++) part(o.head, G.cone4, ink2, 0.34, 0.6 + (i % 2 ? 0.25 : 0), 0.34, i * 0.55, 1.05, 0);
    o.eye = part(o.head, G.sph, red, 0.8, 0.62, 0.3, 0, 0, 0.5);
    part(o.head, G.sph, glow(0xffffff), 0.26, 0.26, 0.2, 0, 0, 0.62);
    part(body, G.cone, ink, 2.3, 2.5, 1.4, 0, 1.2, 0);
    for (let i = 0; i < 7; i++) part(body, G.cone, ink2, 0.5, 0.9, 0.5, Math.cos(i * 0.9) * 0.95, 0.35, Math.sin(i * 0.9) * 0.55).rotation.x = Math.PI;
    o.hands = [-1, 1].map(s => {
      const h = new THREE.Group(); h.position.set(s * 2.6, 1.6, 0.4); g.add(h);
      part(h, G.box, bar, 1.0, 0.5, 1.2);
      for (let i = 0; i < 4; i++) part(h, G.box, ink2, 0.2, 0.3, 0.7, -0.36 + i * 0.24, -0.05, 0.8);
      part(h, G.box, red, 0.14, 0.14, 1.9, s * -0.2, 0.3, 0.5);
      return h;
    });
  }
  o.meshes = []; g.traverse(m => { if (m.isMesh) { m.userData.mat = m.material; o.meshes.push(m); if (type === 'boss') m.layers.set(1); } });
  return o;
}
export function setFlash(o, on) { for (const m of o.meshes) m.material = on ? WHITE : m.userData.mat; }

// ---------- pickups
function glyphSprite(text, color, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  x.font = `800 ${size * 0.92}px "JetBrains Mono", Menlo, Consolas, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = color; x.fillText(text, size / 2, size * 0.54);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, alphaTest: 0.4, transparent: false })); sp.layers.set(2); return sp;
}
export function makeLetter(ch) {
  const g = new THREE.Group();
  const lit = glyphSprite(ch, '#fff1c9'), dim = glyphSprite(ch, '#6a6490');
  lit.scale.set(1.5, 1.5, 1); dim.scale.set(1.5, 1.5, 1); lit.position.y = dim.position.y = 1.2;
  lit.visible = false; g.add(lit, dim);
  const cage = part(g, G.oct, new THREE.MeshBasicMaterial({ color: 0xff3a5a, wireframe: true }), 2.0, 2.4, 2.0, 0, 1.2, 0);
  return { g, lit, dim, cage };
}
export function makeHeart() {
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const x = c.getContext('2d'); x.fillStyle = '#ff6a9a';
  x.beginPath(); x.moveTo(48, 84); x.bezierCurveTo(4, 50, 10, 12, 34, 12); x.bezierCurveTo(44, 12, 48, 22, 48, 26);
  x.bezierCurveTo(48, 22, 52, 12, 62, 12); x.bezierCurveTo(86, 12, 92, 50, 48, 84); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, alphaTest: 0.4 }));
  s.scale.set(0.8, 0.8, 1); s.position.y = 0.7; s.layers.set(2);
  const g = new THREE.Group(); g.add(s); return { g, s };
}
export function makeShot(hex = 0xff3a5a) {
  const g = new THREE.Group();
  part(g, G.sph, glow(hex), 0.36, 0.36, 0.36, 0, 0.8, 0);
  part(g, G.oct, glow(0xffffff), 0.2, 0.2, 0.2, 0, 0.8, 0);
  return g;
}
export function makeBeacon() {
  const g = new THREE.Group(), stone = lam(0xa8a4c0, true);
  part(g, G.cyl, stone, 2.0, 0.26, 2.0, 0, 0.13, 0);
  part(g, G.cyl, stone, 1.4, 0.26, 1.4, 0, 0.39, 0);
  for (let i = 0; i < 4; i++) part(g, G.cyl, stone, 0.12, 1.7, 0.12, Math.cos(i * 1.571 + 0.785) * 0.55, 1.35, Math.sin(i * 1.571 + 0.785) * 0.55);
  part(g, G.cone4, stone, 1.5, 0.6, 1.5, 0, 2.5, 0).rotation.y = Math.PI / 4;
  part(g, G.sph, stone, 0.2, 0.2, 0.2, 0, 2.9, 0);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x3a3650, transparent: true, opacity: 0.75, blending: THREE.NoBlending });
  const core = part(g, G.oct, coreMat, 0.6, 1.0, 0.6, 0, 1.4, 0);
  return { g, core, coreMat };
}

// ---------- scenery
export function makeProp(p) {
  const g = new THREE.Group(), s = p.s, v = p.v;
  const add = (geo, mat, sx, sy, sz, x = 0, y = 0, z = 0) => part(g, geo, mat, sx * s, sy * s, sz * s, x * s, y * s, z * s);
  switch (p.type) {
    case 'house': case 'cabin': {
      const snow = p.type === 'cabin';
      const wall = lam(snow ? 0xb08a68 : 0xffffff, true), roof = lam(snow ? 0xffffff : [0x6a58e0, 0xe0508a, 0x4a70e8][Math.floor(v * 7) % 3], true), win = glow(0xffb040);
      const w = 2.7, d = 2.1, h = 1.7;
      add(G.box, wall, w, h, d, 0, h / 2, 0);
      const rf = new THREE.Group(); rf.scale.set((w + 0.5) / 0.707 * s, 1.35 * s, (d + 0.5) / 0.707 * s); rf.position.y = (h + 0.67) * s; g.add(rf);
      part(rf, G.cone4, roof, 1, 1, 1).rotation.y = Math.PI / 4;
      add(G.box, lam(0x4a3a50), 0.55, 1.0, 0.08, 0.55, 0.5, d / 2 + 0.03);
      add(G.box, win, 0.62, 0.7, 0.07, -0.65, 1.0, d / 2 + 0.03); add(G.box, win, 0.07, 0.7, 0.62, w / 2 + 0.03, 1.0, 0.2); add(G.box, win, 0.07, 0.7, 0.62, -w / 2 - 0.03, 1.0, -0.2);
      add(G.box, wall, 0.34, 0.9, 0.34, 0.75, h + 0.95, -0.2);
      if (snow) add(G.box, lam(0xffffff, true), 0.44, 0.14, 0.44, 0.75, h + 1.45, -0.2);
      g.rotation.y = p.rot; break;
    }
    case 'tower': case 'watchtower': {
      const st = lam(p.type === 'watchtower' ? 0x9a8a78 : 0xc8c4e0, true), hgt = 3.6 + v * 1.4;
      if (p.type === 'watchtower') {
        for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) add(G.cyl, st, 0.14, hgt, 0.14, x, hgt / 2, z);
        add(G.box, st, 1.7, 0.16, 1.7, 0, hgt, 0); add(G.box, st, 1.7, 0.5, 0.1, 0, hgt + 0.3, 0.8); add(G.box, st, 0.1, 0.5, 1.7, 0.8, hgt + 0.3, 0);
        add(G.cone4, lam(0xffffff, true), 2.8, 0.9, 2.8, 0, hgt + 1.4, 0).rotation.y = Math.PI / 4; add(G.box, glow(0xffc070), 0.3, 0.4, 0.3, 0, hgt + 0.4, 0);
      } else {
        add(G.cyl, st, 1.7, hgt, 1.7, 0, hgt / 2, 0); add(G.cyl, st, 2.1, 0.3, 2.1, 0, hgt + 0.15, 0);
        for (let i = 0; i < 8; i++) add(G.box, st, 0.36, 0.4, 0.36, Math.cos(i * 0.785) * 0.9, hgt + 0.5, Math.sin(i * 0.785) * 0.9);
        for (let i = 0; i < 3; i++) add(G.box, glow(0xffc070), 0.26, 0.5, 0.1, Math.sin(i * 1.1 - 0.6) * 0.82, 1.2 + i * 1.0, Math.cos(i * 1.1 - 0.6) * 0.82).rotation.y = i * 1.1 - 0.6;
        add(G.box, lam(0x4a3a50), 0.6, 1.0, 0.1, 0, 0.5, 0.86);
      }
      g.rotation.y = p.rot; break;
    }
    case 'windmill': {
      const st = lam(0xe6d8c8, true);
      add(G.frust, st, 2.4, 3.4, 2.4, 0, 1.7, 0); add(G.cone, lam(0xe07aa0, true), 1.7, 1.0, 1.7, 0, 3.9, 0);
      add(G.box, glow(0xffc070), 0.4, 0.5, 0.1, 0, 1.3, 1.0); add(G.box, lam(0x4a3a50), 0.5, 0.9, 0.1, 0.0, 0.45, 1.2);
      const hub = new THREE.Group(); hub.position.set(0, 3.5 * s, 0.95 * s); hub.userData.spin = 0.9; g.add(hub);
      for (let i = 0; i < 4; i++) { const b = new THREE.Group(); b.rotation.z = i * Math.PI / 2; hub.add(b); part(b, G.box, lam(0xffffff), 0.5 * s, 2.3 * s, 0.06 * s, 0, 1.3 * s, 0); part(b, G.box, lam(0x8a7a90), 0.08 * s, 2.6 * s, 0.08 * s, 0, 1.3 * s, -0.05 * s); }
      g.rotation.y = p.rot; break;
    }
    case 'ruinwall': {
      const st = lam(0xbfc8d8, true), win = glow(0xffd890);
      add(G.box, st, 5.0, 0.5, 0.7, 0, 0.25, 0);
      for (let i = 0; i < 4; i++) add(G.box, st, 0.5, 3.6 - (i === 3 ? v * 1.6 : 0), 0.8, -2.25 + i * 1.5, 1.8 - (i === 3 ? v * 0.8 : 0), 0);
      for (let i = 0; i < 3; i++) {
        if (i === 2 && v > 0.6) continue;
        add(G.box, st, 1.0, 0.6, 0.6, -1.5 + i * 1.5, 3.3, 0);
        add(G.box, win, 0.8, 1.9, 0.2, -1.5 + i * 1.5, 1.6, 0); add(G.cyl, win, 0.8, 0.2, 0.8, -1.5 + i * 1.5, 2.55, 0).rotation.x = Math.PI / 2;
        add(G.box, st, 0.08, 1.9, 0.26, -1.5 + i * 1.5, 1.6, 0); add(G.box, st, 0.8, 0.08, 0.26, -1.5 + i * 1.5, 1.7, 0);
      }
      g.rotation.y = p.rot; break;
    }
    case 'burnt': {
      const w = lam(0xa07868, true), ch = lam(0x4a3838, true);
      add(G.box, w, 2.8, 1.6 + v, 0.3, 0, (1.6 + v) / 2, -1.0); add(G.box, w, 0.3, 1.2, 2.0, -1.4, 0.6, 0); add(G.box, w, 0.3, 0.7 + v, 1.2, 1.4, 0.4, -0.4);
      add(G.box, glow(0xff8a3a), 0.5, 0.6, 0.34, -0.5, 1.0, -1.0); add(G.box, glow(0xff8a3a), 0.34, 0.5, 0.5, -1.4, 0.75, 0.2);
      add(G.box, ch, 0.14, 0.14, 2.6, 0.3, 1.5, 0).rotation.x = 0.5; add(G.box, ch, 2.4, 0.14, 0.14, 0, 0.9, 0.3).rotation.z = -0.35;
      add(G.box, w, 0.5, 2.6, 0.5, 1.1, 1.3, -1.0);
      const f = add(G.cone, glow(0xffb050), 0.5, 0.9, 0.5, 0.2, 0.45, 0.2); f.userData.flame = true;
      g.rotation.y = p.rot; break;
    }
    case 'doorframe': {
      const wt = lam(0xf0e8ff, true), m = new THREE.Group(); m.userData.float = v * 6 + 0.1; m.position.y = 0.4 * s; g.add(m);
      part(m, G.box, wt, 0.3 * s, 3.2 * s, 0.3 * s, -0.9 * s, 1.6 * s, 0); part(m, G.box, wt, 0.3 * s, 3.2 * s, 0.3 * s, 0.9 * s, 1.6 * s, 0); part(m, G.box, wt, 2.4 * s, 0.3 * s, 0.4 * s, 0, 3.3 * s, 0);
      part(m, G.box, glow(0xc9b8ff), 1.5 * s, 3.0 * s, 0.06 * s, 0, 1.6 * s, 0);
      g.rotation.y = p.rot; break;
    }
    case 'cypress': { const lf = lam(v > 0.5 ? 0x7f93f0 : 0x9a86e8, true); add(G.cyl, lam(0x5a5078), 0.24, 0.8, 0.24, 0, 0.4, 0); add(G.cone, lf, 1.3, 3.2, 1.3, 0, 2.2, 0); add(G.cone, lf, 1.0, 2.2, 1.0, 0, 3.4, 0); break; }
    case 'hay': add(G.cyl, lam(0xffd9a0, true), 1.0, 0.7, 1.0, 0, 0.35, 0); add(G.sph, lam(0xffe9b8, true), 1.05, 0.7, 1.05, 0, 0.72, 0); break;
    case 'fence': {
      const w = lam(0xd8c8a8);
      add(G.cyl, w, 0.12, 0.85, 0.12, 0, 0.42, -0.8); add(G.box, w, 0.07, 0.08, 1.6, 0, 0.7, 0); add(G.box, w, 0.07, 0.08, 1.6, 0, 0.4, 0);
      if (v > 0.8) add(G.box, glow(0xffe2a0), 0.16, 0.2, 0.16, 0, 0.98, -0.8);
      g.rotation.y = p.rot; break;
    }
    case 'tree': {
      const leaf = [0x93a8ff, 0xf3a0c8, 0xb7a6ff, 0x7f93f0][Math.floor(v * 4)];
      add(G.cyl, lam(0x5a5078), 0.28, 1.3, 0.28, 0, 0.65, 0);
      add(G.ico, lam(leaf, true), 1.8, 1.5, 1.8, 0, 1.9, 0);
      add(G.ico, lam(leaf, true), 1.2, 1.1, 1.2, 0.5, 2.5, 0.2).rotation.y = v * 6;
      add(G.ico, lam(leaf, true), 1.1, 0.9, 1.1, -0.55, 2.35, -0.2).rotation.y = v * 3;
      break;
    }
    case 'bush': add(G.ico, lam(v > 0.5 ? 0x8ea2ff : 0xf3a0c8, true), 1.0, 0.7, 1.0, 0, 0.35, 0); add(G.ico, lam(0xb7a6ff, true), 0.7, 0.55, 0.7, 0.4, 0.3, 0.2); break;
    case 'rock': add(G.ico, lam(0x9a98b0, true), 0.9, 0.6, 0.8, 0, 0.26, 0).rotation.y = p.rot; break;
    case 'stone': add(G.box, lam(0xb0aec8, true), 0.55, 1.5, 0.3, 0, 0.75, 0).rotation.y = p.rot * 0.2; add(G.box, lam(0x8a88a8, true), 0.75, 0.2, 0.45, 0, 0.1, 0); break;
    case 'boulder': add(G.ico, lam(0x8fa0c0, true), 1.5, 1.2, 1.4, 0, 0.5, 0).rotation.y = p.rot; add(G.ico, lam(0xf0f6ff, true), 1.2, 0.5, 1.1, 0, 1.0, 0); break;
    case 'lamp': {
      add(G.cyl, lam(0x8880a8), 0.1, 2.0, 0.1, 0, 1.0, 0);
      add(G.box, lam(0x8880a8), 0.5, 0.06, 0.06, 0.2, 2.0, 0);
      add(G.box, glow(0xffe2a0), 0.26, 0.34, 0.26, 0.4, 1.74, 0);
      add(G.cone4, lam(0x6a6088), 0.44, 0.18, 0.44, 0.4, 1.99, 0).rotation.y = 0.785;
      break;
    }
    case 'brazier': {
      add(G.cyl, lam(0x7a6a68), 0.14, 0.9, 0.14, 0, 0.45, 0);
      add(G.cone, lam(0x7a6a68), 0.7, 0.4, 0.7, 0, 1.0, 0).rotation.x = Math.PI;
      const f = add(G.cone, glow(0xffb050), 0.42, 0.8, 0.42, 0, 1.55, 0); f.userData.flame = true;
      add(G.cone, glow(0xfff0b0), 0.2, 0.44, 0.2, 0, 1.42, 0);
      break;
    }
    case 'flame': { const f = add(G.cone, glow(0xff6a2a), 0.9, 2.2, 0.9, 0, 1.1, 0); f.userData.flame = true; add(G.cone, glow(0xffd27a), 0.5, 1.2, 0.5, 0, 0.6, 0); break; }
    case 'post': add(G.cyl, lam(0xc8b090), 0.16, 1.0, 0.16, 0, 0.5, 0); add(G.box, lam(0xc8b090), 0.24, 0.1, 0.24, 0, 1.02, 0); break;
    case 'reed': for (let i = 0; i < 5; i++) { const a = i * 1.3 + v * 6; add(G.cyl, lam(i % 2 ? 0x7fe0c0 : 0xa8f0a0), 0.05, 1.0 + (i % 3) * 0.4, 0.05, Math.cos(a) * 0.25, 0.6 + (i % 3) * 0.2, Math.sin(a) * 0.25).rotation.z = Math.cos(a) * 0.15; } break;
    case 'shelf': {
      const wood = lam(0x8a7a60, true);
      const sh = new THREE.Group(); sh.rotation.y = p.rot * 0.12 - 0.3; sh.rotation.z = (v - 0.5) * 0.2; g.add(sh);
      part(sh, G.box, wood, 1.7 * s, 2.3 * s, 0.5 * s, 0, 1.15 * s, 0);
      for (let r = 0; r < 3; r++) for (let b = 0; b < 5; b++) if ((r * 5 + b + Math.floor(v * 9)) % 4)
        part(sh, G.box, glow([0xffe9a8, 0x7ff0d8, 0xffc86b, 0xe6f2d8][(r + b) % 4]), 0.2 * s, 0.5 * s, 0.1 * s, (-0.6 + b * 0.3) * s, (0.45 + r * 0.7) * s, 0.26 * s);
      break;
    }
    case 'column': {
      const st = lam(0xc0bcd8, true), hgt = 1.2 + v * 2.2;
      add(G.cyl, st, 0.9, 0.24, 0.9, 0, 0.12, 0); add(G.cyl, st, 0.56, hgt, 0.56, 0, 0.24 + hgt / 2, 0);
      if (v > 0.5) add(G.box, st, 1.0, 0.24, 1.0, 0, 0.36 + hgt, 0); else add(G.ico, st, 0.6, 0.4, 0.6, 0.1, 0.3 + hgt, 0);
      break;
    }
    case 'deadtree': {
      const w = lam(0x8a6a60);
      add(G.cyl, w, 0.26, 2.4, 0.26, 0, 1.2, 0).rotation.z = (v - 0.5) * 0.3;
      add(G.cyl, w, 0.12, 1.2, 0.12, 0.4, 2.2, 0).rotation.z = -0.9;
      add(G.cyl, w, 0.1, 1.0, 0.1, -0.36, 1.8, 0.1).rotation.z = 1.0;
      add(G.cyl, w, 0.08, 0.7, 0.08, 0.1, 2.7, 0.2).rotation.x = 0.7;
      break;
    }
    case 'wall': {
      const w = lam(0xa07868, true), hgt = 1.4 + v * 1.6, wd = 1.6 + v;
      const wl = new THREE.Group(); wl.rotation.y = Math.round(p.rot) * 0.4; g.add(wl);
      part(wl, G.box, w, wd * s, hgt * s, 0.4 * s, 0, hgt * s / 2, 0);
      part(wl, G.box, w, 0.5 * s, 0.6 * s, 0.4 * s, -wd * s / 2 + 0.25 * s, (hgt + 0.3) * s, 0);
      if (v > 0.35) part(wl, G.box, glow(0xff8a3a), 0.4 * s, 0.5 * s, 0.1 * s, 0.2 * s, hgt * s * 0.55, 0.2 * s);
      break;
    }
    case 'pine': {
      add(G.cyl, lam(0x6a6078), 0.24, 1.0, 0.24, 0, 0.5, 0);
      for (let i = 0; i < 3; i++) { add(G.cone, lam(0x7f98c8, true), 1.8 - i * 0.45, 1.2, 1.8 - i * 0.45, 0, 1.3 + i * 0.8, 0); add(G.cone, lam(0xffffff, true), 1.3 - i * 0.36, 0.5, 1.3 - i * 0.36, 0, 1.75 + i * 0.8, 0); }
      break;
    }
    case 'spike': { const m = add(G.cone4, lam(0xbff0ff, true), 0.6, 2.2, 0.6, 0, 1.1, 0); m.rotation.z = (v - 0.5) * 0.5; add(G.cone4, glow(0x9fe8ff), 0.3, 1.2, 0.3, 0.3, 0.6, 0.2).rotation.z = -0.4; break; }
    case 'shard': { const m = add(G.oct, lam(0xc9b8ff, true), 0.7, 1.6, 0.7, 0, 1.6 + v, 0); m.userData.float = v * 6 + 0.1; m.rotation.y = p.rot; break; }
    case 'cube': { const m = add(G.box, lam(0xe0d8ff, true), 0.7, 0.7, 0.7, 0, 0.9 + v * 1.2, 0); m.userData.float = v * 6 + 0.1; m.rotation.set(v * 3, p.rot, v); break; }
  }
  return g;
}
export function makeChunk(hex) { return new THREE.Mesh(G.tet, glow(hex)); }

// Bake many motionless props into a few meshes (one per material per map chunk) so the whole
// world can be on screen at once when the camera pulls back.
export function mergeStatic(groups) {
  const by = new Map(), v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const g of groups) {
    g.updateMatrixWorld(true);
    const key = Math.floor(g.position.x / 32) + '|' + Math.floor(g.position.z / 40);
    g.traverse(m => { if (!m.isMesh) return; const k = m.material.uuid + '|' + key; if (!by.has(k)) by.set(k, { mat: m.material, list: [] }); by.get(k).list.push(m); });
  }
  const out = [];
  for (const { mat, list } of by.values()) {
    let n = 0; for (const m of list) n += m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    for (const m of list) {
      const P = m.geometry.attributes.position, Nn = m.geometry.attributes.normal, idx = m.geometry.index, cnt = idx ? idx.count : P.count;
      nm.getNormalMatrix(m.matrixWorld);
      for (let i = 0; i < cnt; i++) {
        const k = idx ? idx.getX(i) : i;
        v.fromBufferAttribute(P, k).applyMatrix4(m.matrixWorld); pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z;
        v.fromBufferAttribute(Nn, k).applyMatrix3(nm).normalize(); nor[o] = v.x; nor[o + 1] = v.y; nor[o + 2] = v.z; o += 3;
      }
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    bg.computeBoundingSphere();
    const mesh = new THREE.Mesh(bg, mat); mesh.matrixAutoUpdate = false; out.push(mesh);
  }
  return out;
}
