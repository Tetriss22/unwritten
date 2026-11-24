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

// ---------- the Scribe
export function makeHero() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const cloth = lam(0xf2eefc), dark = lam(0x6f62a8), scarfM = glow(0xff8fc8);
  part(body, G.cone, cloth, 0.98, 1.2, 0.98, 0, 0.62, 0);
  part(body, G.sph, cloth, 0.6, 0.36, 0.5, 0, 1.14, 0);
  const head = new THREE.Group(); head.position.set(0, 1.4, 0); body.add(head);
  part(head, G.sph, dark, 0.5, 0.5, 0.52);
  part(head, G.cone, dark, 0.42, 0.34, 0.42, 0, 0.3, -0.06).rotation.x = -0.35;
  part(head, G.sph, lam(0x1a1626), 0.33, 0.33, 0.2, 0, -0.03, 0.17);
  part(head, G.sph, glow(0xffffff), 0.07, 0.07, 0.05, -0.08, -0.01, 0.26);
  part(head, G.sph, glow(0xffffff), 0.07, 0.07, 0.05, 0.08, -0.01, 0.26);
  const scarf = [];
  for (let i = 0; i < 3; i++) scarf.push(part(body, G.box, scarfM, 0.2 - i * 0.04, 0.09, 0.24, -0.12, 1.16, -0.3 - i * 0.2));
  part(body, G.tor, scarfM, 0.62, 0.62, 1.2, 0, 1.17, 0).rotation.x = Math.PI / 2;
  // right arm with the quill-blade
  const armR = new THREE.Group(); armR.position.set(0.3, 1.02, 0.05); body.add(armR);
  part(armR, G.cyl, cloth, 0.14, 0.46, 0.14, 0.1, -0.16, 0.12).rotation.z = 0.5;
  const quill = new THREE.Group(); quill.position.set(0.2, -0.3, 0.26); armR.add(quill);
  part(quill, G.cyl, glow(0xffffff), 0.05, 1.15, 0.05, 0, 0, 0.5).rotation.x = Math.PI / 2;
  part(quill, G.cone4, glow(0xfff1c9), 0.12, 0.3, 0.06, 0, 0, 1.18).rotation.x = Math.PI / 2;
  part(quill, G.box, glow(0xd8c8ff), 0.03, 0.34, 0.9, 0, 0.14, 0.3).rotation.x = 0.16;
  // left hand lantern
  const armL = new THREE.Group(); armL.position.set(-0.3, 1.02, 0.05); body.add(armL);
  part(armL, G.cyl, cloth, 0.14, 0.44, 0.14, -0.1, -0.16, 0.14).rotation.z = -0.5;
  const lantern = new THREE.Group(); lantern.position.set(-0.24, -0.5, 0.3); armL.add(lantern);
  part(lantern, G.box, glow(0xffd98a), 0.2, 0.26, 0.2);
  part(lantern, G.cone4, lam(0x5a4a3a), 0.3, 0.14, 0.3, 0, 0.2, 0).rotation.y = Math.PI / 4;
  part(lantern, G.cyl, lam(0x5a4a3a), 0.03, 0.2, 0.03, 0, 0.32, 0);
  // slash arc, shown for a blink
  const arc = new THREE.Mesh(G.arc, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.75, blending: THREE.NoBlending }));
  const arcWrap = new THREE.Group(); arcWrap.rotation.y = -Math.PI / 2; g.add(arcWrap);
  arc.rotation.x = -Math.PI / 2; arc.position.y = 0.75; arc.scale.setScalar(1.8); arc.visible = false; arcWrap.add(arc);
  const spin = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: 0xfff1c9, side: THREE.DoubleSide, transparent: true, opacity: 0.75, blending: THREE.NoBlending }));
  spin.rotation.x = -Math.PI / 2; spin.position.y = 0.75; spin.scale.setScalar(2.0); spin.visible = false; g.add(spin);
  return { g, body, head, armR, armL, quill, lantern, scarf, arc, spin };
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
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, alphaTest: 0.4, transparent: false }));
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
  s.scale.set(0.8, 0.8, 1); s.position.y = 0.7;
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
