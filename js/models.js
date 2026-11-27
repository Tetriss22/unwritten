// UNWRITTEN — everything that stands on the page, built from primitives and written in letters.
// Each part names the kind of surface it is (wall, roof, leaf, coat...), and that kind decides
// which symbols it is drawn with and how large they are. See glyph.js.
import * as THREE from '../lib/three.module.min.js';
import { gmat } from './glyph.js';

function prismGeo() {   // a gabled roof: ridge along z, eaves at y = 0, apex at y = 1
  const p = [], n = [];
  const tri = (a, b, c) => { const u = new THREE.Vector3().subVectors(b, a), v = new THREE.Vector3().subVectors(c, a), nn = u.cross(v).normalize(); for (const q of [a, b, c]) { p.push(q.x, q.y, q.z); n.push(nn.x, nn.y, nn.z); } };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const A = V(-0.5, 0, 0.5), B = V(0.5, 0, 0.5), C = V(0, 1, 0.5), D = V(-0.5, 0, -0.5), E = V(0.5, 0, -0.5), F = V(0, 1, -0.5);
  tri(A, B, C); tri(E, D, F);                       // gables
  tri(B, E, F); tri(B, F, C);                       // right slope
  tri(D, A, C); tri(D, C, F);                       // left slope
  tri(A, D, E); tri(A, E, B);                       // underside
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  return g;
}
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(0.5, 14, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 12),
  cone4: new THREE.ConeGeometry(0.5, 1, 4),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  ico: new THREE.IcosahedronGeometry(0.5, 1),
  oct: new THREE.OctahedronGeometry(0.5, 0),
  tet: new THREE.TetrahedronGeometry(0.5, 0),
  tor: new THREE.TorusGeometry(0.5, 0.07, 6, 20),
  torThin: new THREE.TorusGeometry(0.5, 0.022, 5, 28),
  arc: new THREE.RingGeometry(0.84, 1.0, 20, 1, -1.15, 2.3),
  ring: new THREE.RingGeometry(0.86, 1.0, 28),
  frust: new THREE.CylinderGeometry(0.3, 0.5, 1, 14),
  disc: new THREE.CylinderGeometry(0.5, 0.5, 0.06, 20),
  prism: prismGeo(),
};
const L = (hex, kind, flat = false) => gmat(hex, kind, { flat });
const Gl = (hex, kind, opt = {}) => gmat(hex, kind, { glow: true, ...opt });
export const WHITE = Gl(0xffffff, 'gold');

function part(parent, geo, mat, sx, sy, sz, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z); parent.add(m);
  return m;
}

// ---------- the Scribe: written in the smallest, whitest letters on the page so nothing else looks like them
export function makeHero() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const H = (hex, kind) => gmat(hex, kind, { lift: 0.55 });      // the hero is never left in the dark
  const coat = gmat(0xffffff, 'coat', { lift: 0.85 }), cape = Gl(0xff5a78, 'cape'), dark = H(0xd0c8f0, 'dark'), skin = H(0xffe6d0, 'skin');
  const scarfM = Gl(0xff7fc0, 'scarf'), gold = Gl(0xffd98a, 'gold');
  const legs = [-1, 1].map(sd => {
    const l = new THREE.Group(); l.position.set(sd * 0.15, 0.8, 0); body.add(l);
    part(l, G.cyl, dark, 0.2, 0.78, 0.2, 0, -0.39, 0);
    part(l, G.box, L(0x8a82b0, 'leather'), 0.23, 0.15, 0.38, 0, -0.74, 0.07);
    return l;
  });
  // the coat is a stack of rings; each ring trails the one above it, so the hem swings when the Scribe moves
  const robe = [];
  for (let i = 0; i < 6; i++) { const w = 0.6 + i * 0.085; robe.push(part(body, G.cyl, coat, w, 0.2, w * 0.88, 0, 1.52 - i * 0.17, 0)); }
  part(body, G.frust, coat, 0.82, 0.5, 0.74, 0, 1.8, 0).rotation.x = Math.PI;      // chest
  part(body, G.box, L(0x9088b8, 'leather'), 0.6, 0.09, 0.52, 0, 1.6, 0);          // belt
  part(body, G.frust, cape, 1.0, 0.34, 0.9, 0, 1.94, -0.03);                      // shoulder cape
  part(body, G.box, L(0xc8a878, 'leather'), 0.26, 0.34, 0.14, -0.36, 1.25, -0.2); // book satchel
  const head = new THREE.Group(); head.position.set(0, 2.26, 0); body.add(head);
  part(head, G.sph, skin, 0.36, 0.38, 0.36, 0, 0, 0.05);
  part(head, G.sph, cape, 0.45, 0.45, 0.45, 0, 0.06, -0.08);
  const tip = part(head, G.cone, cape, 0.26, 0.75, 0.26, 0, 0.42, -0.24); tip.rotation.x = -0.8;
  part(head, G.sph, Gl(0xffffff, 'eye'), 0.08, 0.08, 0.05, -0.085, -0.02, 0.27);
  part(head, G.sph, Gl(0xffffff, 'eye'), 0.08, 0.08, 0.05, 0.085, -0.02, 0.27);
  const scarf = [];
  part(body, G.tor, scarfM, 0.6, 0.6, 1.5, 0, 2.04, 0).rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i++) scarf.push(part(body, G.box, scarfM, 0.2 - i * 0.025, 0.1, 0.3, -0.14, 2.02, -0.34 - i * 0.26));
  const armR = new THREE.Group(); armR.position.set(0.38, 1.92, 0.02); body.add(armR);
  part(armR, G.cyl, coat, 0.17, 0.62, 0.17, 0.05, -0.26, 0.1).rotation.x = -0.4;
  part(armR, G.sph, skin, 0.15, 0.15, 0.15, 0.07, -0.54, 0.24);
  const quill = new THREE.Group(); quill.position.set(0.07, -0.54, 0.24); armR.add(quill);
  part(quill, G.cyl, Gl(0xffffff, 'quill'), 0.06, 1.8, 0.06, 0, 0, 0.6).rotation.x = Math.PI / 2;
  part(quill, G.cone4, gold, 0.15, 0.4, 0.08, 0, 0, 1.68).rotation.x = Math.PI / 2;
  part(quill, G.oct, Gl(0xf0e8ff, 'quill'), 0.03, 0.44, 1.0, 0, 0.13, -0.1).rotation.x = 0.16;      // the feather: a leaf, pointed at both ends
  part(quill, G.oct, Gl(0xf0e8ff, 'quill'), 0.03, 0.26, 0.7, 0, -0.08, -0.16).rotation.x = -0.2;
  const tipMark = new THREE.Object3D(); tipMark.position.set(0, 0, 1.85); quill.add(tipMark);
  const baseMark = new THREE.Object3D(); baseMark.position.set(0, 0, 1.25); quill.add(baseMark);
  // the BLADE: a broad letter-opener as long as the Scribe is tall. Slow, wide, and it shakes the page.
  const mark = (g, z) => { const o = new THREE.Object3D(); o.position.set(0, 0, z); g.add(o); return o; };
  const seal = new THREE.Group(); seal.position.copy(quill.position); armR.add(seal);
  part(seal, G.cyl, H(0xe0d0b0, 'wood'), 0.09, 0.5, 0.09, 0, 0, 0.02).rotation.x = Math.PI / 2;      // grip
  part(seal, G.sph, gold, 0.17, 0.17, 0.17, 0, 0, -0.27);                                           // pommel
  part(seal, G.oct, gold, 0.62, 0.1, 0.16, 0, 0, 0.3);                                              // guard, pointed at both ends
  part(seal, G.cone4, Gl(0xeef4ff, 'quill'), 0.4, 1.85, 0.07, 0, 0, 1.25).rotation.x = Math.PI / 2;   // the blade tapers to a point
  // the NIBS: two short blades. Fast, close, light.
  const nibs = new THREE.Group(); nibs.position.copy(quill.position); armR.add(nibs);
  part(nibs, G.cone4, Gl(0xffffff, 'quill'), 0.16, 1.0, 0.06, 0, 0, 0.6).rotation.x = Math.PI / 2;
  const nb2 = part(nibs, G.cone4, Gl(0xa8e0ff, 'quill'), 0.16, 0.9, 0.06, -0.3, 0, 0.5); nb2.rotation.x = Math.PI / 2; nb2.rotation.z = 0.5;
  const weapons = [{ g: quill, tip: tipMark, base: baseMark }, { g: seal, tip: mark(seal, 2.1), base: mark(seal, 1.3) }, { g: nibs, tip: mark(nibs, 1.1), base: mark(nibs, 0.45) }];
  // five more, made by smiths
  const held = () => { const w = new THREE.Group(); w.position.copy(quill.position); armR.add(w); return w; };
  const steel = Gl(0xf2f7ff, 'quill'), woodM = H(0xe0c8a0, 'wood'), up = (m) => { m.rotation.x = Math.PI / 2; return m; };
  const sword = held();        // a straight blade with a cross guard
  up(part(sword, G.cyl, woodM, 0.09, 0.44, 0.09, 0, 0, 0)); part(sword, G.sph, gold, 0.16, 0.16, 0.16, 0, 0, -0.25); part(sword, G.box, gold, 0.6, 0.09, 0.1, 0, 0, 0.26);
  part(sword, G.box, steel, 0.17, 0.05, 1.7, 0, 0, 1.15); up(part(sword, G.cone4, steel, 0.17, 0.32, 0.05, 0, 0, 2.16));
  const sabre = held();        // curved: three lengths, each leaning a little further
  up(part(sabre, G.cyl, woodM, 0.09, 0.4, 0.09, 0, 0, 0)); part(sabre, G.tor, gold, 0.34, 0.34, 0.6, 0, -0.08, 0.05).rotation.y = Math.PI / 2;
  [[0.55, 0.0, 0.0], [1.1, 0.07, -0.13], [1.62, 0.21, -0.27]].forEach(([z, y, r]) => { part(sabre, G.box, steel, 0.05, 0.2, 0.6, 0, y, z).rotation.x = r; });
  part(sabre, G.cone4, steel, 0.05, 0.3, 0.2, 0, 0.36, 2.0).rotation.x = Math.PI / 2 - 0.5;
  const pike = held();         // a long shaft and a leaf of steel
  up(part(pike, G.cyl, woodM, 0.07, 3.2, 0.07, 0, 0, 1.0)); up(part(pike, G.cone4, steel, 0.24, 0.7, 0.08, 0, 0, 2.95)); part(pike, G.box, gold, 0.34, 0.06, 0.08, 0, 0, 2.58);
  const bow = held();          // held upright: two limbs and a string
  part(bow, G.box, woodM, 0.08, 1.0, 0.09, 0, 0.46, 0.3).rotation.x = -0.38; part(bow, G.box, woodM, 0.08, 1.0, 0.09, 0, -0.46, 0.3).rotation.x = 0.38;
  part(bow, G.box, gold, 0.1, 0.3, 0.12, 0, 0, 0.48); part(bow, G.cyl, steel, 0.02, 1.8, 0.02, 0, 0, 0.1);
  const bowTip = new THREE.Object3D(); bowTip.position.set(0, 0.92, 0.12); bow.add(bowTip); const bowBase = new THREE.Object3D(); bowBase.position.set(0, -0.92, 0.12); bow.add(bowBase);
  const hammer = held();       // a block of metal on a stick
  up(part(hammer, G.cyl, woodM, 0.09, 1.9, 0.09, 0, 0, 0.75)); part(hammer, G.box, Gl(0xd8dcf0, 'metal'), 0.95, 0.5, 0.5, 0, 0, 1.75); part(hammer, G.box, gold, 1.0, 0.2, 0.2, 0, 0, 1.75);
  weapons.push({ g: sword, tip: mark(sword, 2.3), base: mark(sword, 1.2) }, { g: sabre, tip: mark(sabre, 2.1), base: mark(sabre, 1.1) }, { g: pike, tip: mark(pike, 3.3), base: mark(pike, 2.4) }, { g: bow, tip: bowTip, base: bowBase }, { g: hammer, tip: mark(hammer, 2.0), base: mark(hammer, 1.3) });
  const armL = new THREE.Group(); armL.position.set(-0.38, 1.92, 0.02); body.add(armL);
  part(armL, G.cyl, coat, 0.17, 0.62, 0.17, -0.05, -0.26, 0.12).rotation.x = -0.5;
  part(armL, G.sph, skin, 0.15, 0.15, 0.15, -0.07, -0.52, 0.28);
  const lantern = new THREE.Group(); lantern.position.set(-0.07, -0.88, 0.3); armL.add(lantern);
  part(lantern, G.cyl, gold, 0.25, 0.3, 0.25);                                      // round, so it never reads as a block stuck to the weapon
  part(lantern, G.cone, L(0xa89070, 'metal'), 0.36, 0.18, 0.36, 0, 0.24, 0);
  part(lantern, G.cyl, L(0xa89070, 'metal'), 0.04, 0.24, 0.04, 0, 0.38, 0);
  const arc = new THREE.Mesh(G.arc, Gl(0xffffff, 'slash', { side: THREE.DoubleSide }));
  const arcWrap = new THREE.Group(); arcWrap.rotation.y = -Math.PI / 2; g.add(arcWrap);
  arc.rotation.x = -Math.PI / 2; arc.position.y = 1.05; arc.visible = false; arcWrap.add(arc);
  const spin = new THREE.Mesh(G.ring, Gl(0xfff1c9, 'slash', { side: THREE.DoubleSide }));
  spin.rotation.x = -Math.PI / 2; spin.position.y = 1.05; spin.visible = false; g.add(spin);
  g.traverse(m => { if (m.isMesh) m.layers.set(m === arc || m === spin ? 2 : 3); });   // layer 3: drawn after the world, with a see-through pass
  return { g, body, head, tip, armR, armL, quill, lantern, scarf, arc, spin, legs, robe, tipMark, baseMark, weapons };
}

// ---------- the paper horse: same fine white letters as the Scribe, so the pair read as one
export function makeHorse() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const H = (hex, kind) => gmat(hex, kind, { lift: 0.5 }), white = H(0xffffff, 'coat'), grey = H(0xd8d4f0, 'dark'), mane = Gl(0xff7fc0, 'scarf');
  part(body, G.box, white, 0.72, 0.72, 1.75, 0, 1.3, 0);
  part(body, G.sph, white, 0.8, 0.8, 0.8, 0, 1.32, 0.75); part(body, G.sph, white, 0.82, 0.82, 0.82, 0, 1.32, -0.75);
  const neck = new THREE.Group(); neck.position.set(0, 1.55, 0.85); body.add(neck);
  part(neck, G.box, white, 0.34, 0.95, 0.42, 0, 0.35, 0.2).rotation.x = 0.6;
  part(neck, G.box, white, 0.32, 0.36, 0.72, 0, 0.82, 0.62).rotation.x = 0.25;
  part(neck, G.cone4, grey, 0.12, 0.26, 0.12, -0.11, 1.08, 0.38); part(neck, G.cone4, grey, 0.12, 0.26, 0.12, 0.11, 1.08, 0.38);
  for (let i = 0; i < 4; i++) part(neck, G.box, mane, 0.1, 0.3, 0.22, 0, 0.75 - i * 0.2, 0.1 - i * 0.1).rotation.x = 0.6;
  const tail = part(body, G.box, mane, 0.14, 0.9, 0.16, 0, 1.15, -1.05); tail.rotation.x = -0.5;
  const legs = [[-0.24, 0.62], [0.24, 0.62], [-0.24, -0.62], [0.24, -0.62]].map(([x, z]) => {
    const l = new THREE.Group(); l.position.set(x, 1.0, z); body.add(l);
    part(l, G.cyl, white, 0.17, 1.0, 0.17, 0, -0.5, 0); part(l, G.box, grey, 0.2, 0.14, 0.24, 0, -0.95, 0.02);
    return l;
  });
  g.traverse(m => { if (m.isMesh) m.layers.set(3); });
  return { g, body, neck, legs, tail };
}
// ---------- the people who stayed
export function makeNPC(k) {
  // twelve cloths; coat, shawl and hat each take a different one, and there are three kinds of hat
  const g = new THREE.Group(), cols = [0xffd98a, 0x9be070, 0xff9a5c, 0x8ad8ff, 0xffa8d0, 0xc9a8ff, 0x6fe0c0, 0xf2f25a, 0xff7a7a, 0x7aa8ff, 0xe8e8f0, 0xd0a070];
  const m = (i) => gmat(cols[i % 12], 'cape', { lift: 0.35 }), robe = m(k), shawl = m(k * 5 + 3), hat = m(k * 7 + 6), skin = gmat(0xffe6d0, 'skin', { lift: 0.35 });
  part(g, G.frust, robe, 0.95, 1.5, 0.9, 0, 0.75, 0);
  part(g, G.frust, shawl, 0.8, 0.3, 0.75, 0, 1.6, 0); part(g, G.cyl, shawl, 0.74, 0.1, 0.7, 0, 0.95, 0);
  part(g, G.sph, skin, 0.4, 0.42, 0.4, 0, 1.95, 0.03);
  if (k % 3 === 0) { part(g, G.cyl, hat, 0.75, 0.07, 0.75, 0, 2.15, 0); part(g, G.cone, hat, 0.42, 0.4, 0.42, 0, 2.36, 0); }
  else if (k % 3 === 1) { part(g, G.cyl, hat, 0.5, 0.2, 0.5, 0, 2.2, 0); part(g, G.box, hat, 0.3, 0.05, 0.3, 0, 2.14, 0.3); }
  else part(g, G.sph, hat, 0.5, 0.46, 0.5, 0, 2.02, -0.06);
  part(g, G.sph, Gl(0x201830, 'eye'), 0.07, 0.07, 0.05, -0.09, 1.96, 0.21); part(g, G.sph, Gl(0x201830, 'eye'), 0.07, 0.07, 0.05, 0.09, 1.96, 0.21);
  // arms on shoulder pivots, so townsfolk can wave, carry, chop and plough; the right hand holds a tool
  const arm = (sd) => { const a = new THREE.Group(); a.position.set(sd * 0.4, 1.58, 0.02); g.add(a); part(a, G.cyl, shawl, 0.17, 0.62, 0.17, 0, -0.3, 0); part(a, G.sph, skin, 0.16, 0.16, 0.16, 0, -0.64, 0); return a; };
  const armL = arm(-1), armR = arm(1), hand = new THREE.Group(); hand.position.set(0, -0.66, 0); armR.add(hand);
  g.userData = { armL, armR, hand };
  return g;
}
// what townsfolk work with; each is held in the right hand, pointing along the forearm
export function makeTool(kind) {
  const g = new THREE.Group(), wood = L(0xc8a070, 'wood'), metal = L(0xd8dcf0, 'metal');
  switch (kind) {
    case 'cleaver': part(g, G.cyl, wood, 0.07, 0.3, 0.07, 0, 0, 0.05).rotation.x = Math.PI / 2; part(g, G.box, metal, 0.05, 0.28, 0.36, 0, -0.1, 0.32); break;
    case 'axe': part(g, G.cyl, wood, 0.07, 1.1, 0.07, 0, -0.1, 0.35).rotation.x = Math.PI / 2; part(g, G.box, metal, 0.06, 0.3, 0.26, 0, -0.12, 0.85); break;
    case 'hammer': part(g, G.cyl, wood, 0.07, 0.6, 0.07, 0, 0, 0.2).rotation.x = Math.PI / 2; part(g, G.box, L(0x8a8ea8, 'metal'), 0.16, 0.16, 0.3, 0, 0, 0.5).rotation.x = Math.PI / 2; break;
    case 'broom': part(g, G.cyl, wood, 0.06, 1.6, 0.06, 0, -0.45, 0.2).rotation.x = 0.6; part(g, G.cone, L(0xffd9a0, 'hay', true), 0.4, 0.5, 0.2, 0, -1.2, 0.68).rotation.x = Math.PI + 0.6; break;
    case 'bucket': part(g, G.frust, L(0xb8bcd0, 'metal', true), 0.42, 0.4, 0.42, 0, -0.32, 0).rotation.x = Math.PI; part(g, G.disc, L(0x5a8aff, 'ice'), 0.36, 1, 0.36, 0, -0.14, 0); part(g, G.torThin, metal, 0.42, 0.42, 1, 0, -0.1, 0); break;
    case 'hoe': part(g, G.cyl, wood, 0.06, 1.5, 0.06, 0, -0.3, 0.3).rotation.x = 1.0; part(g, G.box, metal, 0.3, 0.05, 0.2, 0, -0.92, 0.95); break;
    case 'needle': part(g, G.cyl, metal, 0.03, 0.3, 0.03, 0, -0.1, 0.1).rotation.x = 1.2; part(g, G.box, L(0xff8fc8, 'cape', true), 0.3, 0.02, 0.3, 0, -0.2, 0.3); break;
    case 'spoon': part(g, G.cyl, wood, 0.05, 0.9, 0.05, 0, -0.35, 0.1).rotation.x = 0.3; break;
    case 'meat': part(g, G.sph, L(0xff8a8a, 'cape', true), 0.36, 0.26, 0.3, 0, -0.12, 0.12); break;
  }
  return noShadow(g);
}
// the butcher's block, the woodcutter's stump, the smith's anvil, a kettle on a fire
export function makeWorkspot(kind) {
  const g = new THREE.Group(), wood = L(0xc89a6a, 'wood', true);
  if (kind === 'block') { part(g, G.cyl, wood, 0.9, 0.8, 0.9, 0, 0.4, 0); part(g, G.box, L(0xff8a8a, 'cape', true), 0.55, 0.12, 0.38, 0.05, 0.86, 0); part(g, G.box, L(0xffe0e0, 'skin', true), 0.18, 0.13, 0.36, -0.2, 0.87, 0); part(g, G.box, wood, 0.9, 1.0, 0.1, 0, 0.5, -0.9); for (const x of [-0.3, 0, 0.3]) part(g, G.sph, L(0xff7a7a, 'cape', true), 0.22, 0.32, 0.18, x, 0.85, -0.85); }
  if (kind === 'stump') { part(g, G.cyl, wood, 0.95, 0.5, 0.95, 0, 0.25, 0); part(g, G.cyl, L(0xffe0b0, 'wood', true), 0.85, 0.02, 0.85, 0, 0.51, 0); for (let i = 0; i < 5; i++) part(g, G.cyl, wood, 0.32, 0.9, 0.32, -0.9 + (i % 3) * 0.32, 0.18 + Math.floor(i / 3) * 0.28, -0.7 + (i % 2) * 0.1).rotation.z = Math.PI / 2; }
  if (kind === 'log') part(g, G.cyl, L(0xc89a6a, 'trunk', true), 0.42, 0.7, 0.42, 0, 0.35, 0);
  if (kind === 'anvil') { part(g, G.box, L(0x8a8ea8, 'metal', true), 0.36, 0.42, 0.3, 0, 0.21, 0); part(g, G.box, L(0x9aa0b8, 'metal', true), 0.7, 0.18, 0.34, 0.05, 0.5, 0); part(g, G.cone4, L(0x9aa0b8, 'metal', true), 0.2, 0.3, 0.2, 0.48, 0.5, 0).rotation.z = -Math.PI / 2; }
  if (kind === 'kettle') { part(g, G.sph, L(0x403848, 'metal', true), 0.7, 0.55, 0.7, 0, 0.45, 0); for (let i = 0; i < 3; i++) part(g, G.cyl, wood, 0.08, 1.4, 0.08, Math.cos(i * 2.1) * 0.5, 0.6, Math.sin(i * 2.1) * 0.5).rotation.set(Math.sin(i * 2.1) * 0.4, 0, -Math.cos(i * 2.1) * 0.4); const f = part(g, G.cone, Gl(0xff8a2a, 'fire'), 0.4, 0.5, 0.4, 0, 0.2, 0); f.userData.flame = true; }
  return g;
}
// a paper ox and the plough behind it
export function makeOx() {
  const g = new THREE.Group(), hide = gmat(0xf0e4d0, 'cape', { lift: 0.3 }), dark = gmat(0x8a6a50, 'leather', { lift: 0.3 }), horn = L(0xfff1c9, 'stone');
  const body = new THREE.Group(); g.add(body);
  part(body, G.box, hide, 0.9, 0.8, 1.7, 0, 1.0, 0); part(body, G.box, dark, 0.92, 0.3, 0.6, 0, 1.25, -0.2);
  const head = new THREE.Group(); head.position.set(0, 1.15, 0.95); body.add(head);
  part(head, G.box, hide, 0.55, 0.5, 0.6, 0, 0, 0.2); part(head, G.box, dark, 0.4, 0.25, 0.2, 0, -0.12, 0.52);
  for (const sd of [-1, 1]) part(head, G.cone, horn, 0.1, 0.4, 0.1, sd * 0.38, 0.25, 0.1).rotation.z = -sd * 1.1;
  part(head, G.sph, Gl(0x201830, 'eye'), 0.08, 0.08, 0.05, -0.18, 0.08, 0.5); part(head, G.sph, Gl(0x201830, 'eye'), 0.08, 0.08, 0.05, 0.18, 0.08, 0.5);
  const legs = [];
  for (const [x, z] of [[-0.3, 0.6], [0.3, 0.6], [-0.3, -0.6], [0.3, -0.6]]) { const l = new THREE.Group(); l.position.set(x, 0.65, z); body.add(l); part(l, G.cyl, dark, 0.2, 0.65, 0.2, 0, -0.32, 0); legs.push(l); }
  part(body, G.cyl, dark, 0.06, 0.6, 0.06, 0, 1.0, -0.98).rotation.x = 0.6;
  // yoke and plough, trailing behind
  const plough = new THREE.Group(); plough.position.set(0, 0, -1.9); g.add(plough);
  part(plough, G.box, L(0xc8a070, 'wood'), 0.1, 0.1, 1.6, 0, 0.55, 0.55).rotation.x = -0.3;
  part(plough, G.cone4, L(0xd8dcf0, 'metal', true), 0.32, 0.5, 0.2, 0, 0.2, -0.1).rotation.x = -Math.PI / 2;
  for (const sd of [-1, 1]) part(plough, G.box, L(0xc8a070, 'wood'), 0.06, 0.06, 0.9, sd * 0.25, 0.75, -0.45).rotation.x = 0.5;
  g.userData = { body, head, legs, plough };
  return g;
}

export function makeCampfire() {
  const g = new THREE.Group(), w = L(0xd0a878, 'wood', true);
  for (let i = 0; i < 4; i++) { const m = part(g, G.box, w, 0.16, 0.16, 1.0, 0, 0.12, 0); m.rotation.y = i * 0.8; }
  for (let i = 0; i < 6; i++) part(g, G.ico, L(0xc8c4e0, 'stone', true), 0.26, 0.2, 0.26, Math.cos(i * 1.047) * 0.62, 0.08, Math.sin(i * 1.047) * 0.62);
  const f1 = part(g, G.cone, Gl(0xff8a2a, 'fire'), 0.6, 1.1, 0.6, 0, 0.7, 0); f1.userData.flame = true;
  const f2 = part(g, G.cone, Gl(0xffd27a, 'fire'), 0.34, 0.7, 0.34, 0.05, 0.5, 0.05); f2.userData.flame = true;
  g.traverse(m => { if (m.isMesh && m.userData.flame) m.layers.set(2); });
  return g;
}

// ---------- the unwriters: heavy purple symbols, red eyes
// every kind of unwriter has its own colour, and each land leans them a little toward its own
const MOB = { blot: [0xb890ff, 0x8a62e0, 0xff3a5a], scratch: [0x5fe0d0, 0x2fa8a0, 0xffd040], brute: [0xff9a4a, 0xd06a20, 0xfff1c9], typo: [0xc8f04a, 0x8fc020, 0xff3a5a], asterisk: [0x7a9cff, 0x4a6ae0, 0xffffff], ghost: [0xd8ecff, 0xa8c8f0, 0x7fd8ff], redactor: [0x9aa4d8, 0x7482c8, 0xff3a5a], mimic: [0xc8a060, 0xa07840, 0xff3a5a] };
const LAND_LEAN = [null, 0x8ad8ff, 0xff7a4a, 0xf0f8ff, 0xffffff];
export function makeEnemy(type, land = 0) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mc = MOB[type] || MOB.blot, lean = (hex) => LAND_LEAN[land] ? new THREE.Color(hex).lerp(new THREE.Color(LAND_LEAN[land]), 0.28).getHex() : hex;
  const ink = gmat(lean(mc[0]), 'ink', { lift: 0.3 }), ink2 = gmat(lean(mc[1]), 'ink2', { lift: 0.3 }), eye = Gl(mc[2], 'eye');
  const o = { g, body, type };
  if (type === 'blot') {
    part(body, G.sph, ink, 1.0, 0.86, 1.0, 0, 0.5, 0);
    part(body, G.cone, ink2, 0.24, 0.5, 0.24, -0.26, 1.0, 0).rotation.z = 0.35;
    part(body, G.cone, ink2, 0.24, 0.5, 0.24, 0.26, 1.0, 0).rotation.z = -0.35;
    part(body, G.sph, eye, 0.22, 0.26, 0.12, -0.19, 0.6, 0.43);
    part(body, G.sph, eye, 0.22, 0.26, 0.12, 0.19, 0.6, 0.43);
    for (let i = 0; i < 5; i++) part(body, G.sph, ink2, 0.3, 0.2, 0.3, Math.cos(i * 1.26) * 0.45, 0.1, Math.sin(i * 1.26) * 0.45);
  } else if (type === 'scratch') {
    part(body, G.cone, ink, 0.6, 1.5, 0.6, 0, 1.05, 0).rotation.x = Math.PI;
    part(body, G.oct, ink2, 0.5, 0.5, 0.5, 0, 1.95, 0);
    part(body, G.sph, eye, 0.28, 0.28, 0.16, 0, 1.5, 0.24);
    o.ring = part(body, G.tor, Gl(0xe0c8ff, 'ink2'), 1.2, 1.2, 1.2, 0, 1.25, 0); o.ring.rotation.x = Math.PI / 2;
  } else if (type === 'brute') {
    part(body, G.box, ink, 1.5, 1.7, 0.9, 0, 0.95, 0);
    part(body, G.box, ink2, 1.7, 0.3, 1.0, 0, 1.85, 0);
    part(body, G.box, eye, 1.0, 0.16, 0.1, 0, 1.3, 0.48);
    o.armL = part(body, G.box, ink2, 0.4, 1.1, 0.5, -0.98, 0.8, 0.1);
    o.armR = part(body, G.box, ink2, 0.4, 1.1, 0.5, 0.98, 0.8, 0.1);
  } else if (type === 'typo') {            // a small quick mistake; they come in fours
    part(body, G.oct, ink, 0.5, 0.42, 0.5, 0, 0.32, 0); part(body, G.cone4, ink2, 0.16, 0.34, 0.16, 0, 0.66, 0);
    part(body, G.sph, eye, 0.2, 0.2, 0.1, 0, 0.36, 0.22);
  } else if (type === 'asterisk') {        // a footnote with a fuse
    o.star = new THREE.Group(); o.star.position.y = 0.85; body.add(o.star);
    part(o.star, G.sph, Gl(0xffa040, 'fire'), 0.5, 0.5, 0.5);
    for (let i = 0; i < 6; i++) { const sp = part(o.star, G.cone4, ink, 0.24, 0.66, 0.24, Math.cos(i * 1.047) * 0.52, Math.sin(i * 1.047) * 0.52, 0); sp.rotation.z = i * 1.047 - Math.PI / 2; }
    part(body, G.sph, eye, 0.18, 0.18, 0.1, 0, 0.85, 0.26);
  } else if (type === 'ghost') {           // the Ghostwriter: never where you last saw it
    const pale = gmat(lean(mc[0]), 'cape', { lift: 0.5 }), blue = eye;
    part(body, G.cone, pale, 0.95, 1.6, 0.95, 0, 1.1, 0); part(body, G.sph, pale, 0.58, 0.58, 0.58, 0, 2.0, 0);
    part(body, G.sph, blue, 0.14, 0.18, 0.1, -0.13, 2.02, 0.26); part(body, G.sph, blue, 0.14, 0.18, 0.1, 0.13, 2.02, 0.26);
    part(body, G.cone4, Gl(0xffffff, 'quill'), 0.1, 0.9, 0.05, 0.62, 1.5, 0.2).rotation.z = -0.4;
  } else if (type === 'redactor') {        // a slab that blacks things out
    const slab = gmat(lean(mc[0]), 'brick', { lift: 0.3 }), bar = Gl(0xffffff, 'gold');
    part(body, G.box, slab, 1.5, 2.6, 0.7, 0, 1.3, 0);
    for (let i = 0; i < 3; i++) part(body, G.box, bar, 1.15 - i * 0.2, 0.13, 0.06, -i * 0.1, 0.7 + i * 0.45, 0.37);
    part(body, G.box, eye, 0.95, 0.18, 0.1, 0, 2.2, 0.37);
    o.armL = part(body, G.box, ink2, 0.4, 1.5, 0.5, -1.0, 1.3, 0.1); o.armR = part(body, G.box, ink2, 0.4, 1.5, 0.5, 1.0, 1.3, 0.1);
  } else if (type === 'mimic') {
    o.lid = chestParts(body);
    for (let i = -2; i <= 2; i++) part(body, G.cone4, Gl(0xffffff, 'quill'), 0.13, 0.24, 0.13, i * 0.19, 0.68, 0.3);
    part(o.lid, G.sph, eye, 0.17, 0.17, 0.1, -0.22, 0.2, 0.72); part(o.lid, G.sph, eye, 0.17, 0.17, 0.1, 0.22, 0.2, 0.72);
  } else if (type === 'boss') {
    const bar = L(0xc0a0ff, 'boss'), dk = L(0x7a5ad0, 'boss'), red = Gl(0xff3a5a, 'eye');
    o.head = new THREE.Group(); o.head.position.y = 2.7; body.add(o.head);
    part(o.head, G.box, bar, 3.6, 1.1, 1.0);
    part(o.head, G.box, dk, 4.0, 0.22, 1.1, 0, 0.66, 0);
    for (let i = -3; i <= 3; i++) part(o.head, G.cone4, dk, 0.34, 0.6 + (i % 2 ? 0.25 : 0), 0.34, i * 0.55, 1.05, 0);
    o.eye = part(o.head, G.sph, red, 0.8, 0.62, 0.3, 0, 0, 0.5);
    part(o.head, G.sph, Gl(0xffffff, 'eye'), 0.26, 0.26, 0.2, 0, 0, 0.62);
    part(body, G.cone, bar, 2.3, 2.5, 1.4, 0, 1.2, 0);
    for (let i = 0; i < 7; i++) part(body, G.cone, dk, 0.5, 0.9, 0.5, Math.cos(i * 0.9) * 0.95, 0.35, Math.sin(i * 0.9) * 0.55).rotation.x = Math.PI;
    o.hands = [-1, 1].map(s => {
      const h = new THREE.Group(); h.position.set(s * 2.6, 1.6, 0.4); g.add(h);
      part(h, G.box, bar, 1.0, 0.5, 1.2);
      for (let i = 0; i < 4; i++) part(h, G.box, dk, 0.2, 0.3, 0.7, -0.36 + i * 0.24, -0.05, 0.8);
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
  const lit = glyphSprite(ch, '#fff1c9'), dim = glyphSprite(ch, '#8a84b0');
  lit.scale.set(1.7, 1.7, 1); dim.scale.set(1.7, 1.7, 1); lit.position.y = dim.position.y = 1.3;
  lit.visible = false; g.add(lit, dim);
  const cage = new THREE.Group(); cage.position.y = 1.3; g.add(cage);
  for (let i = 0; i < 3; i++) { const r = part(cage, G.torThin, Gl(0xff3a5a, 'ink2'), 2.0, 2.0, 2.0); r.rotation.set(i * 1.05, i * 2.1, 0); }
  return { g, lit, dim, cage };
}
export function makeHeart() {
  const s = glyphSprite('♥', '#ff6a9a', 96); s.scale.set(0.7, 0.7, 1); s.position.y = 0.7;
  const g = new THREE.Group(); g.add(s); return { g, s };
}
export function makeShot() {
  const g = new THREE.Group();
  part(g, G.sph, Gl(0xff3a5a, 'eye'), 0.4, 0.4, 0.4, 0, 0.8, 0);
  part(g, G.oct, Gl(0xffffff, 'chunk'), 0.24, 0.24, 0.24, 0, 0.8, 0);
  return g;
}
export function makeBeacon() {
  const g = new THREE.Group(), stone = L(0xd8d4f0, 'stone', true);
  part(g, G.cyl, stone, 2.0, 0.26, 2.0, 0, 0.13, 0);
  part(g, G.cyl, stone, 1.4, 0.26, 1.4, 0, 0.39, 0);
  for (let i = 0; i < 4; i++) part(g, G.cyl, L(0xb8b4d8, 'metal'), 0.13, 1.7, 0.13, Math.cos(i * 1.571 + 0.785) * 0.55, 1.35, Math.sin(i * 1.571 + 0.785) * 0.55);
  part(g, G.cone4, L(0xb8b4d8, 'roof', true), 1.5, 0.6, 1.5, 0, 2.5, 0).rotation.y = Math.PI / 4;
  const coreMat = gmat(0x55507a, 'gold', { glow: true, own: true });
  const core = part(g, G.oct, coreMat, 0.6, 1.0, 0.6, 0, 1.4, 0);
  return { g, core, coreMat };
}

// ---------- scenery
export function makeProp(p) {
  const g = new THREE.Group(), s = p.s, v = p.v;
  const add = (geo, mat, sx, sy, sz, x = 0, y = 0, z = 0) => part(g, geo, mat, sx * s, sy * s, sz * s, x * s, y * s, z * s);
  const WIN = Gl(0xffb040, 'window');
  switch (p.type) {
    case 'house': case 'cabin': {
      const snow = p.type === 'cabin';
      const wall = L(snow ? 0xd8b088 : [0xffffff, 0xfff0e0, 0xf0e8ff][Math.floor(v * 3)], snow ? 'wood' : 'wall', true);
      const roof = L(snow ? 0xffffff : [0xe0704e, 0xc05a40, 0x8fa4c8][Math.floor(v * 7) % 3], snow ? 'snow' : 'roof', true), frame = L(0xc8b090, 'wood');
      const w = 3.0, d = 2.3, h = 1.8;
      add(G.box, wall, w, h, d, 0, h / 2, 0);
      add(G.prism, roof, w + 0.5, 1.35, d + 0.6, 0, h, 0).rotation.y = Math.PI / 2;
      add(G.box, wall, w, 0.06, d, 0, h + 0.02, 0);
      add(G.box, L(0x9a7a60, 'door'), 0.6, 1.1, 0.1, 0.65, 0.55, d / 2 + 0.04);
      for (const [x, z, rx] of [[-0.65, d / 2 + 0.04, 0], [w / 2 + 0.04, 0.2, 1], [-w / 2 - 0.04, -0.2, 1]]) {
        add(G.box, WIN, rx ? 0.08 : 0.66, 0.72, rx ? 0.66 : 0.08, x, 1.05, z);
        add(G.box, frame, rx ? 0.1 : 0.8, 0.1, rx ? 0.8 : 0.1, x, 1.46, z); add(G.box, frame, rx ? 0.1 : 0.8, 0.1, rx ? 0.8 : 0.1, x, 0.64, z);
      }
      add(G.box, L(0xd0c0b0, 'brick', true), 0.4, 1.3, 0.4, -0.8, h + 0.75, -0.3);
      add(G.cyl, frame, 0.12, 1.0, 0.12, 1.2, 0.5, d / 2 + 0.7); add(G.cyl, frame, 0.12, 1.0, 0.12, 0.1, 0.5, d / 2 + 0.7); add(G.box, roof, 1.5, 0.08, 0.8, 0.65, 1.02, d / 2 + 0.4);
      g.rotation.y = p.rot; break;
    }
    case 'tower': case 'watchtower': {
      const st = L(p.type === 'watchtower' ? 0xd8c0a0 : 0xe8e4ff, p.type === 'watchtower' ? 'wood' : 'brick', true), hgt = 3.8 + v * 1.4;
      if (p.type === 'watchtower') {
        for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) add(G.cyl, st, 0.16, hgt, 0.16, x, hgt / 2, z);
        add(G.box, st, 1.7, 0.16, 1.7, 0, hgt, 0); add(G.box, st, 1.7, 0.5, 0.1, 0, hgt + 0.3, 0.8); add(G.box, st, 0.1, 0.5, 1.7, 0.8, hgt + 0.3, 0);
        add(G.cone4, L(0xffffff, 'snow', true), 2.8, 0.9, 2.8, 0, hgt + 1.4, 0).rotation.y = Math.PI / 4; add(G.box, WIN, 0.34, 0.44, 0.34, 0, hgt + 0.4, 0);
      } else {
        add(G.cyl, st, 1.8, hgt, 1.8, 0, hgt / 2, 0); add(G.cyl, L(0xc8c4e8, 'stone', true), 2.2, 0.3, 2.2, 0, hgt + 0.15, 0);
        for (let i = 0; i < 8; i++) add(G.box, st, 0.4, 0.42, 0.4, Math.cos(i * 0.785) * 0.95, hgt + 0.5, Math.sin(i * 0.785) * 0.95);
        for (let i = 0; i < 3; i++) add(G.box, WIN, 0.3, 0.56, 0.12, Math.sin(i * 1.1 - 0.6) * 0.87, 1.2 + i * 1.05, Math.cos(i * 1.1 - 0.6) * 0.87).rotation.y = i * 1.1 - 0.6;
        add(G.box, L(0x9a7a60, 'door'), 0.6, 1.1, 0.1, 0, 0.55, 0.9);
      }
      g.rotation.y = p.rot; break;
    }
    case 'windmill': {
      add(G.frust, L(0xffffff, 'wall', true), 2.5, 3.5, 2.5, 0, 1.75, 0); add(G.cone, L(0xe0704e, 'roof', true), 1.8, 1.1, 1.8, 0, 4.05, 0);
      add(G.box, WIN, 0.42, 0.54, 0.1, 0, 1.4, 1.02); add(G.box, L(0x9a7a60, 'door'), 0.56, 1.0, 0.1, 0, 0.5, 1.24);
      const hub = new THREE.Group(); hub.position.set(0, 3.6 * s, 1.0 * s); hub.userData.spin = 0.9; g.add(hub);
      for (let i = 0; i < 4; i++) { const b = new THREE.Group(); b.rotation.z = i * Math.PI / 2; hub.add(b); part(b, G.box, L(0xffffff, 'hay'), 0.56 * s, 2.4 * s, 0.06 * s, 0, 1.35 * s, 0); part(b, G.box, L(0xc8b090, 'wood'), 0.09 * s, 2.7 * s, 0.09 * s, 0, 1.35 * s, -0.06 * s); }
      g.rotation.y = p.rot; break;
    }
    case 'ruinwall': {      // what is left of the library: a wall of bays, books still on some shelves, the top broken off
      const st = L(0xd8e0f0, 'brick', true), back = L(0x8a94b0, 'brick', true), books = [0xff9a5c, 0x62d8b8, 0xffe9a8, 0xc9a8ff, 0x8ad8ff].map(c => L(c, 'book', true));
      add(G.box, st, 5.0, 0.5, 0.7, 0, 0.25, 0);
      for (let i = 0; i < 4; i++) add(G.box, st, 0.5, 3.6 - (i === 3 ? v * 1.6 : 0), 0.8, -2.25 + i * 1.5, 1.8 - (i === 3 ? v * 0.8 : 0), 0);
      for (let i = 0; i < 3; i++) {
        const tall = i === 2 ? 2.0 - v * 1.2 : 3.0 - ((i * 7 + Math.floor(v * 10)) % 3) * 0.45, x = -1.5 + i * 1.5;
        add(G.box, back, 1.0, tall, 0.3, x, 0.5 + tall / 2, -0.12);
        for (let r = 0; r * 0.8 + 0.9 < tall; r++) {
          add(G.box, st, 1.0, 0.09, 0.6, x, 0.55 + r * 0.8, 0.05);
          if ((i + r + Math.floor(v * 7)) % 4 !== 0) for (let b = 0; b < 4; b++) add(G.box, books[(i * 3 + r * 2 + b + Math.floor(v * 5)) % 5], 0.17, 0.42 + ((b * 5 + r) % 3) * 0.07, 0.34, x - 0.33 + b * 0.22, 0.83 + r * 0.8, 0.12);
        }
      }
      g.rotation.y = p.rot; break;
    }
    case 'burnt': {
      const w = L(0xe0a890, 'brick', true), ch = L(0x9a7a70, 'wood', true);
      add(G.box, w, 2.8, 1.6 + v, 0.3, 0, (1.6 + v) / 2, -1.0); add(G.box, w, 0.3, 1.2, 2.0, -1.4, 0.6, 0); add(G.box, w, 0.3, 0.7 + v, 1.2, 1.4, 0.4, -0.4);
      add(G.box, Gl(0xff8a3a, 'window'), 0.5, 0.6, 0.34, -0.5, 1.0, -1.0); add(G.box, Gl(0xff8a3a, 'window'), 0.34, 0.5, 0.5, -1.4, 0.75, 0.2);
      add(G.box, ch, 0.16, 0.16, 2.6, 0.3, 1.5, 0).rotation.x = 0.5; add(G.box, ch, 2.4, 0.16, 0.16, 0, 0.9, 0.3).rotation.z = -0.35;
      add(G.box, w, 0.5, 2.6, 0.5, 1.1, 1.3, -1.0);
      const f = add(G.cone, Gl(0xffb050, 'fire'), 0.5, 0.9, 0.5, 0.2, 0.45, 0.2); f.userData.flame = true;
      g.rotation.y = p.rot; break;
    }
    case 'doorframe': {
      const wt = L(0xf6f0ff, 'voidstone', true), m = new THREE.Group(); m.userData.float = v * 6 + 0.1; m.position.y = 0.4 * s; g.add(m);
      part(m, G.box, wt, 0.3 * s, 3.2 * s, 0.3 * s, -0.9 * s, 1.6 * s, 0); part(m, G.box, wt, 0.3 * s, 3.2 * s, 0.3 * s, 0.9 * s, 1.6 * s, 0); part(m, G.box, wt, 2.4 * s, 0.3 * s, 0.4 * s, 0, 3.3 * s, 0);
      part(m, G.box, Gl(0xc9b8ff, 'book'), 1.5 * s, 3.0 * s, 0.06 * s, 0, 1.6 * s, 0);
      g.rotation.y = p.rot; break;
    }
    case 'tree': {
      const leaf = L([0x5fbf5a, 0x86d468, 0x48a860, 0xffa8d0, 0x6cc860][Math.floor(v * 5)], 'leaf', true);
      add(G.cyl, L(0xb89878, 'trunk'), 0.3, 1.5, 0.3, 0, 0.75, 0);
      add(G.ico, leaf, 1.9, 1.6, 1.9, 0, 2.1, 0); add(G.ico, leaf, 1.3, 1.2, 1.3, 0.55, 2.75, 0.2); add(G.ico, leaf, 1.2, 1.0, 1.2, -0.6, 2.55, -0.2);
      break;
    }
    case 'cypress': { const lf = L(v > 0.5 ? 0x3f9a58 : 0x58b068, 'needle', true); add(G.cyl, L(0xb89878, 'trunk'), 0.24, 0.8, 0.24, 0, 0.4, 0); add(G.cone, lf, 1.3, 3.2, 1.3, 0, 2.2, 0); add(G.cone, lf, 1.0, 2.2, 1.0, 0, 3.4, 0); break; }
    case 'pine': {
      add(G.cyl, L(0xb0a0b8, 'trunk'), 0.26, 1.0, 0.26, 0, 0.5, 0);
      for (let i = 0; i < 3; i++) { add(G.cone, L(0xa8c0f0, 'needle', true), 1.9 - i * 0.45, 1.2, 1.9 - i * 0.45, 0, 1.3 + i * 0.8, 0); add(G.cone, L(0xffffff, 'snow', true), 1.35 - i * 0.36, 0.5, 1.35 - i * 0.36, 0, 1.78 + i * 0.8, 0); }
      break;
    }
    case 'deadtree': {
      const w = L(0xc09a88, 'trunk');
      add(G.cyl, w, 0.28, 2.4, 0.28, 0, 1.2, 0).rotation.z = (v - 0.5) * 0.3;
      add(G.cyl, w, 0.14, 1.2, 0.14, 0.4, 2.2, 0).rotation.z = -0.9; add(G.cyl, w, 0.12, 1.0, 0.12, -0.36, 1.8, 0.1).rotation.z = 1.0; add(G.cyl, w, 0.1, 0.7, 0.1, 0.1, 2.7, 0.2).rotation.x = 0.7;
      break;
    }
    case 'bush': add(G.ico, L(v > 0.75 ? 0xffa8d0 : 0x6cc860, 'leaf', true), 1.0, 0.7, 1.0, 0, 0.35, 0); add(G.ico, L(0x48a860, 'leaf', true), 0.7, 0.55, 0.7, 0.4, 0.3, 0.2); break;
    case 'reed': for (let i = 0; i < 5; i++) { const a = i * 1.3 + v * 6; add(G.cyl, L(i % 2 ? 0x8af0d8 : 0xc4f8bc, 'reed'), 0.07, 1.0 + (i % 3) * 0.4, 0.07, Math.cos(a) * 0.25, 0.6 + (i % 3) * 0.2, Math.sin(a) * 0.25).rotation.z = Math.cos(a) * 0.15; } break;
    case 'rock': add(G.ico, L(0xd0cce8, 'stone', true), 0.9, 0.6, 0.8, 0, 0.26, 0).rotation.y = p.rot; break;
    case 'stone': add(G.box, L(0xe0dcf8, 'stone', true), 0.6, 1.5, 0.32, 0, 0.75, 0).rotation.y = p.rot * 0.2; add(G.box, L(0xc0bcd8, 'stone', true), 0.8, 0.2, 0.5, 0, 0.1, 0); break;
    case 'boulder': add(G.ico, L(0xc0d0e8, 'stone', true), 1.5, 1.2, 1.4, 0, 0.5, 0).rotation.y = p.rot; add(G.ico, L(0xffffff, 'snow', true), 1.2, 0.5, 1.1, 0, 1.0, 0); break;
    case 'lamp': {
      add(G.cyl, L(0xc8c0e8, 'metal'), 0.11, 2.0, 0.11, 0, 1.0, 0); add(G.box, L(0xc8c0e8, 'metal'), 0.5, 0.07, 0.07, 0.2, 2.0, 0);
      add(G.box, Gl(0xffe2a0, 'lamp'), 0.3, 0.38, 0.3, 0.4, 1.74, 0); add(G.cone4, L(0xa8a0c8, 'metal'), 0.48, 0.2, 0.48, 0.4, 2.02, 0).rotation.y = 0.785;
      break;
    }
    case 'brazier': {
      add(G.cyl, L(0xc0a8a0, 'metal'), 0.15, 0.9, 0.15, 0, 0.45, 0); add(G.cone, L(0xc0a8a0, 'metal'), 0.7, 0.4, 0.7, 0, 1.0, 0).rotation.x = Math.PI;
      const f = add(G.cone, Gl(0xffb050, 'fire'), 0.44, 0.85, 0.44, 0, 1.55, 0); f.userData.flame = true;
      break;
    }
    case 'flame': { const f = add(G.cone, Gl(0xff6a2a, 'fire'), 0.9, 2.2, 0.9, 0, 1.1, 0); f.userData.flame = true; add(G.cone, Gl(0xffd27a, 'fire'), 0.5, 1.2, 0.5, 0, 0.6, 0); break; }
    case 'shelf': {
      const sh = new THREE.Group(); sh.rotation.y = p.rot * 0.12 - 0.3; sh.rotation.z = (v - 0.5) * 0.2; g.add(sh);
      part(sh, G.box, L(0xd0b890, 'wood', true), 1.7 * s, 2.3 * s, 0.5 * s, 0, 1.15 * s, 0);
      for (let r = 0; r < 3; r++) part(sh, G.box, Gl([0xffe9a8, 0x8af0d8, 0xffc86b][r], 'book'), 1.4 * s, 0.46 * s, 0.1 * s, 0, (0.45 + r * 0.7) * s, 0.26 * s);
      break;
    }
    case 'column': {
      const st = L(0xe8e4ff, 'stone', true), hgt = 1.2 + v * 2.2;
      add(G.cyl, st, 0.9, 0.24, 0.9, 0, 0.12, 0); add(G.cyl, L(0xe8e4ff, 'trunk'), 0.56, hgt, 0.56, 0, 0.24 + hgt / 2, 0);
      if (v > 0.5) add(G.box, st, 1.0, 0.24, 1.0, 0, 0.36 + hgt, 0); else add(G.ico, st, 0.6, 0.4, 0.6, 0.1, 0.3 + hgt, 0);
      break;
    }
    case 'wall': {
      const hgt = 1.4 + v * 1.6, wd = 1.6 + v, wl = new THREE.Group(); wl.rotation.y = Math.round(p.rot) * 0.4; g.add(wl);
      part(wl, G.box, L(0xe0a890, 'brick', true), wd * s, hgt * s, 0.4 * s, 0, hgt * s / 2, 0);
      part(wl, G.box, L(0xe0a890, 'brick', true), 0.5 * s, 0.6 * s, 0.4 * s, -wd * s / 2 + 0.25 * s, (hgt + 0.3) * s, 0);
      if (v > 0.35) part(wl, G.box, Gl(0xff8a3a, 'window'), 0.44 * s, 0.54 * s, 0.12 * s, 0.2 * s, hgt * s * 0.55, 0.2 * s);
      break;
    }
    case 'spike': { const m = add(G.cone4, L(0xd0f4ff, 'ice', true), 0.6, 2.2, 0.6, 0, 1.1, 0); m.rotation.z = (v - 0.5) * 0.5; add(G.cone4, L(0xb0f0ff, 'ice', true), 0.3, 1.2, 0.3, 0.3, 0.6, 0.2).rotation.z = -0.4; break; }
    case 'shard': { const m = add(G.oct, L(0xdcd0ff, 'voidstone', true), 0.7, 1.6, 0.7, 0, 1.6 + v, 0); m.userData.float = v * 6 + 0.1; m.rotation.y = p.rot; break; }
    case 'cube': { const m = add(G.box, L(0xf0e8ff, 'voidstone', true), 0.7, 0.7, 0.7, 0, 0.9 + v * 1.2, 0); m.userData.float = v * 6 + 0.1; m.rotation.set(v * 3, p.rot, v); break; }
    case 'hay': add(G.cyl, L(0xffd9a0, 'hay', true), 1.0, 0.7, 1.0, 0, 0.35, 0); add(G.sph, L(0xffe9b8, 'hay', true), 1.05, 0.7, 1.05, 0, 0.72, 0); break;
    case 'fence': {
      const w = L(0xf0e0c0, 'wood');
      add(G.cyl, w, 0.14, 0.9, 0.14, 0, 0.45, -0.8); add(G.box, w, 0.1, 0.12, 1.6, 0, 0.72, 0); add(G.box, w, 0.1, 0.12, 1.6, 0, 0.4, 0);
      if (v > 0.8) add(G.box, Gl(0xffe2a0, 'lamp'), 0.18, 0.22, 0.18, 0, 1.02, -0.8);
      g.rotation.y = p.rot; break;
    }
    case 'stall': {
      const w = L(0xe8d0a0, 'wood', true), c = L(v < 0.34 ? 0xff6a5a : v < 0.67 ? 0x6fa8ff : 0xffd060, 'roof', true);
      add(G.box, w, 2.3, 0.12, 0.95, 0, 0.95, 0);
      for (const [x, z] of [[-1.05, -0.4], [1.05, -0.4], [-1.05, 0.4], [1.05, 0.4]]) add(G.cyl, w, 0.1, 2.2, 0.1, x, 1.1, z);
      add(G.box, c, 2.7, 0.1, 1.5, 0, 2.25, 0.1).rotation.x = 0.2;
      if (v < 0.34) { add(G.box, L(0xb8bcd0, 'metal'), 0.6, 0.3, 0.3, -0.5, 1.16, 0); add(G.cone4, Gl(0xf2f7ff, 'quill'), 0.14, 0.9, 0.05, 0.5, 1.06, 0).rotation.z = Math.PI / 2; }
      else if (v < 0.67) { add(G.cyl, Gl(0x6f9bff, 'cape'), 0.3, 0.34, 0.3, -0.55, 1.18, 0); add(G.tor, Gl(0xffe066, 'gold'), 0.3, 0.3, 1.5, 0.45, 1.06, 0).rotation.x = Math.PI / 2; }
      else for (const [x, col] of [[-0.6, 0xff5a78], [0, 0x5aa8ff], [0.6, 0xffd060]]) add(G.sph, Gl(col, 'glass'), 0.3, 0.3, 0.3, x, 1.17, 0);
      g.rotation.y = p.rot; break;
    }
    case 'well': {
      add(G.cyl, L(0xe0dcf8, 'brick', true), 1.3, 0.7, 1.3, 0, 0.35, 0); add(G.cyl, L(0x5a8aff, 'ice'), 1.0, 0.06, 1.0, 0, 0.7, 0);
      add(G.cyl, L(0xd0b890, 'wood'), 0.12, 1.5, 0.12, -0.6, 0.95, 0); add(G.cyl, L(0xd0b890, 'wood'), 0.12, 1.5, 0.12, 0.6, 0.95, 0);
      add(G.prism, L(0xe0704e, 'roof', true), 1.7, 0.5, 1.1, 0, 1.7, 0); break;
    }
    case 'crates': {
      const w = L(0xe0c8a0, 'wood', true);
      add(G.box, w, 0.7, 0.7, 0.7, 0, 0.35, 0).rotation.y = v; add(G.box, w, 0.6, 0.6, 0.6, 0.75, 0.3, 0.2).rotation.y = v * 2; add(G.box, w, 0.55, 0.55, 0.55, 0.2, 0.98, 0.05).rotation.y = v * 3;
      add(G.cyl, L(0xc8a878, 'wood'), 0.56, 0.8, 0.56, -0.7, 0.4, 0.3); break;
    }
    // things the new places are built from; every one of them breaks
    case 'barrel': {
      const w = L(0xd8b088, 'wood', true), band = L(0xb8bcd0, 'metal');
      add(G.cyl, w, 0.62, 0.9, 0.62, 0, 0.45, 0); add(G.cyl, band, 0.66, 0.07, 0.66, 0, 0.18, 0); add(G.cyl, band, 0.66, 0.07, 0.66, 0, 0.72, 0);
      if (v > 0.6) add(G.cyl, w, 0.62, 0.9, 0.62, 0, 0.36, 0.62).rotation.x = Math.PI / 2;
      break;
    }
    case 'keg': {     // blasting powder: red, banded, a fuse on top. Fire or a hard hit sets it off
      const w = L(0xff5a4a, 'wood', true), band = L(0x403040, 'metal');
      add(G.cyl, w, 0.62, 0.82, 0.62, 0, 0.41, 0); add(G.cyl, band, 0.66, 0.07, 0.66, 0, 0.14, 0); add(G.cyl, band, 0.66, 0.07, 0.66, 0, 0.68, 0);
      add(G.box, Gl(0xffe066, 'gold'), 0.3, 0.3, 0.05, 0, 0.42, 0.31).rotation.z = 0.785;
      add(G.cyl, Gl(0xffb050, 'fire'), 0.05, 0.26, 0.05, 0.12, 0.92, 0).rotation.z = 0.4;
      break;
    }
    case 'logs': {
      const w = L(0xc89a6a, 'trunk', true), cut = L(0xffe0b0, 'wood', true);
      for (const [x, y] of [[-0.68, 0.34], [0, 0.34], [0.68, 0.34], [-0.34, 0.92], [0.34, 0.92], [0, 1.5]]) {
        add(G.cyl, w, 0.66, 2.3, 0.66, x, y, 0).rotation.x = Math.PI / 2;
        add(G.cyl, cut, 0.58, 0.04, 0.58, x, y, 1.16).rotation.x = Math.PI / 2;
      }
      g.rotation.y = p.rot; break;
    }
    case 'shack': {
      const w = L(0xd8b888, 'wood', true), dk = L(0x9a7a58, 'wood', true), roof = L(0xc8a070, 'roof', true);
      add(G.box, w, 2.6, 1.7, 0.16, 0, 0.85, -0.85); add(G.box, w, 0.16, 1.7, 1.7, -1.22, 0.85, 0); add(G.box, w, 0.16, 1.7, 1.7, 1.22, 0.85, 0);
      add(G.box, w, 0.9, 1.7, 0.16, -0.85, 0.85, 0.85); add(G.box, w, 0.9, 1.7, 0.16, 0.85, 0.85, 0.85); add(G.box, w, 0.8, 0.4, 0.16, 0, 1.5, 0.85);
      add(G.box, dk, 0.1, 1.9, 0.1, -1.25, 0.95, 0.88); add(G.box, dk, 0.1, 1.9, 0.1, 1.25, 0.95, 0.88);
      const r1 = add(G.box, roof, 2.9, 0.12, 2.3, 0, 1.95, 0); r1.rotation.x = -0.22;
      add(G.box, Gl(0xffb040, 'window'), 0.36, 0.3, 0.06, -0.6, 1.1, -0.95);
      g.rotation.y = p.rot; break;
    }
    case 'tent': {
      const c = L([0xe8d8b0, 0xc8e0c0, 0xe0c0a0][Math.floor(v * 3)], 'cape', true);
      add(G.prism, c, 2.0, 1.5, 2.4, 0, 0, 0); add(G.cyl, L(0xc8a878, 'wood'), 0.08, 1.8, 0.08, 0, 0.9, 1.25);
      add(G.box, L(0x302830, 'cape', true), 0.6, 0.9, 0.04, 0, 0.45, 1.21);
      g.rotation.y = p.rot; break;
    }
    case 'pillar': {    // a quarry stack: blocks cut and left one on another
      const st = L(0xe0d8f0, 'stone', true), n = 3 + Math.floor(v * 2);
      for (let k = 0; k < n; k++) { const sz = 1.15 - k * 0.08; add(G.box, st, sz, 0.78, sz * (0.9 + (k % 2) * 0.12), (k % 2 ? 0.06 : -0.04) * (v * 3 - 1), 0.39 + k * 0.8, 0).rotation.y = k * 0.35 + v; }
      break;
    }
    case 'hull': {      // one third of a ship frozen in the snow, keel along x
      const w = L(0xc8986a, 'wood', true), deck = L(0xe0c08a, 'wood', true), snowy = L(0xffffff, 'snow', true), bow = v < 0.34, stern = v > 0.67;
      add(G.box, w, 2.2, 1.1, 0.18, 0, 0.75, -0.95); add(G.box, w, 2.2, 1.1, 0.18, 0, 0.75, 0.95); add(G.box, w, 2.2, 0.3, 1.7, 0, 0.3, 0);
      add(G.box, deck, 2.2, 0.12, 1.9, 0, 1.25, 0); add(G.box, snowy, 1.8, 0.14, 1.5, 0.1, 1.36, 0.05);
      if (bow) { add(G.prism, w, 1.2, 1.3, 1.9, 1.1, 0.75, 0).rotation.z = -Math.PI / 2; }
      if (stern) { add(G.box, w, 0.3, 1.9, 2.0, -1.2, 0.95, 0); add(G.box, Gl(0xffb040, 'window'), 0.08, 0.4, 0.5, -1.37, 1.1, 0.4); }
      g.rotation.y = p.rot; g.rotation.z = (v - 0.5) * 0.12; break;
    }
    case 'mast': {
      const w = L(0xc8986a, 'trunk', true);
      add(G.cyl, w, 0.28, 5.2, 0.28, 0, 2.6, 0); add(G.box, w, 0.14, 0.14, 2.8, 0, 4.3, 0);
      add(G.box, L(0xf4ecdc, 'cape', true), 0.05, 2.2, 2.5, 0.12, 3.1, 0).rotation.x = 0.08;
      g.rotation.y = p.rot; g.rotation.z = 0.12; break;
    }
    case 'cart': {
      const w = L(0xe0c8a0, 'wood', true);
      add(G.box, w, 1.8, 0.5, 1.0, 0, 0.75, 0); add(G.box, L(0xffd9a0, 'hay', true), 1.6, 0.4, 0.85, 0, 1.15, 0);
      for (const [x, z] of [[-0.6, 0.55], [0.6, 0.55], [-0.6, -0.55], [0.6, -0.55]]) add(G.disc, L(0xc8a878, 'wood'), 0.7, 1.4, 0.7, x, 0.36, z).rotation.x = Math.PI / 2;
      add(G.box, w, 1.3, 0.08, 0.08, 1.5, 0.7, 0.3); add(G.box, w, 1.3, 0.08, 0.08, 1.5, 0.7, -0.3);
      g.rotation.y = p.rot; break;
    }
    case 'sign': { const w = L(0xf0e0c0, 'wood'); add(G.cyl, w, 0.12, 1.6, 0.12, 0, 0.8, 0); add(G.box, w, 1.1, 0.34, 0.08, 0.2, 1.45, 0).rotation.y = 0.3; add(G.box, w, 0.9, 0.3, 0.08, -0.15, 1.05, 0).rotation.y = -0.5; g.rotation.y = p.rot; break; }
  }
  return g;
}
// ---------- magic and elixirs, written in the same letters as everything else
const noShadow = (g) => { g.traverse(m => { if (m.isMesh) m.layers.set(2); }); return g; };
export function makeBomb() { const g = new THREE.Group(); part(g, G.sph, L(0x3a3444, 'metal', true), 0.5, 0.5, 0.5); part(g, G.cyl, L(0xb8bcd0, 'metal'), 0.2, 0.1, 0.2, 0, 0.26, 0); part(g, G.sph, Gl(0xffd060, 'fire'), 0.12, 0.12, 0.12, 0, 0.36, 0); return noShadow(g); }
export function makeFireball() { const g = new THREE.Group(); part(g, G.sph, Gl(0xff7a2a, 'fire'), 0.75, 0.75, 0.75); part(g, G.oct, Gl(0xffe9a8, 'fire'), 0.42, 0.42, 0.42); return noShadow(g); }
export function makeSkyBolt() {
  const g = new THREE.Group(); let x = 0, z = 0;
  for (let i = 0; i < 7; i++) {
    const nx = (Math.random() - 0.5) * 1.4, nz = (Math.random() - 0.5) * 1.4;
    const seg = part(g, G.box, Gl(i % 2 ? 0xffffff : 0xa8e0ff, 'bolt'), 0.11, 1.55, 0.11, (x + nx) / 2, 0.7 + i * 1.35, (z + nz) / 2);
    seg.rotation.z = Math.atan2(x - nx, 1.35); seg.rotation.x = Math.atan2(nz - z, 1.35); x = nx; z = nz;
  }
  return noShadow(g);
}
export function makeElixir(kind) {
  const c = { xp: 0xffd060, ink: 0x5aa8ff, hp: 0xff5a78 }[kind], g = new THREE.Group();
  part(g, G.sph, Gl(c, 'glass'), 0.52, 0.52, 0.52, 0, 0.3, 0); part(g, G.cyl, gmat(0xffffff, 'glass', { lift: 0.6 }), 0.2, 0.3, 0.2, 0, 0.66, 0); part(g, G.cyl, L(0xc8a878, 'wood'), 0.25, 0.1, 0.25, 0, 0.84, 0);
  return noShadow(g);
}
export function makeChunk(hex) { return new THREE.Mesh(G.tet, gmat(hex, 'chunk', { glow: true })); }

// Bake many motionless props into a few meshes (one per material per map chunk) so the whole
// world can be on screen at once when the camera pulls back.
export function mergeStatic(groups) {
  const by = new Map(), v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (const g of groups) {
    g.updateMatrixWorld(true);
    const key = Math.floor(g.position.x / 32) + '|' + Math.floor(g.position.z / 32);
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

// ---------- loot on the ground: the thing itself, and a pillar of letters in its rarity's colour so it can be seen from far off
export function makeLoot(slot, hex) {
  const g = new THREE.Group(), it = new THREE.Group(); g.add(it);
  const m = Gl(hex, 'gold'), w = Gl(0xffffff, 'glass');
  if (slot === 'robe') { part(it, G.frust, m, 0.5, 0.5, 0.42, 0, 0.32, 0).rotation.x = Math.PI; part(it, G.cyl, w, 0.56, 0.08, 0.5, 0, 0.08, 0); }
  else if (slot === 'ring') { const r = part(it, G.tor, m, 0.62, 0.62, 2.4, 0, 0.42, 0); r.rotation.x = 0.3; part(it, G.oct, w, 0.2, 0.24, 0.2, 0, 0.78, 0); }
  else { part(it, G.oct, m, 0.42, 0.6, 0.42, 0, 0.45, 0); part(it, G.torThin, w, 0.7, 0.7, 4, 0, 0.45, 0).rotation.x = Math.PI / 2; }
  const beam = part(g, G.cyl, Gl(hex, 'bolt'), 0.12, 1, 0.12, 0, 0.5, 0);
  const halo = part(g, G.ring, Gl(hex, 'gold', { side: THREE.DoubleSide }), 0.75, 0.75, 0.75, 0, 0.04, 0); halo.rotation.x = -Math.PI / 2;
  return { g: noShadow(g), it, beam, halo };
}

// ---------- hidden things: a chest (the mimic wears the same one), and the thin light over something buried
function chestParts(parent) {
  const wood = gmat(0xc8a060, 'wood', { lift: 0.35 }), gold = Gl(0xffd98a, 'gold');
  part(parent, G.box, wood, 1.0, 0.55, 0.7, 0, 0.3, 0); part(parent, G.box, gold, 0.16, 0.2, 0.06, 0, 0.42, 0.36);
  const lid = new THREE.Group(); lid.position.set(0, 0.58, -0.35); parent.add(lid);
  part(lid, G.box, wood, 1.04, 0.26, 0.74, 0, 0.13, 0.35); part(lid, G.box, gold, 1.08, 0.07, 0.78, 0, 0.02, 0.35);
  return lid;
}
export function makeChest() { const g = new THREE.Group(); chestParts(g); return noShadow(g); }
export function makeGlint() {
  const g = new THREE.Group(); part(g, G.cyl, Gl(0xfff1c9, 'bolt'), 0.09, 1, 0.09, 0, 0.5, 0);
  part(g, G.ring, Gl(0xfff1c9, 'gold', { side: THREE.DoubleSide }), 0.5, 0.5, 0.5, 0, 0.04, 0).rotation.x = -Math.PI / 2;
  return noShadow(g);
}

export function makeArrow() {
  const g = new THREE.Group(), w = Gl(0xffffff, 'quill');
  part(g, G.cyl, w, 0.05, 1.1, 0.05, 0, 0, 0).rotation.x = Math.PI / 2; part(g, G.cone4, Gl(0xffe066, 'gold'), 0.16, 0.34, 0.16, 0, 0, 0.68).rotation.x = Math.PI / 2;
  part(g, G.oct, w, 0.03, 0.22, 0.36, 0, 0, -0.5);
  return noShadow(g);
}

// a champion wears a crown
export function addCrown(o, h) {
  const gold = Gl(0xffd060, 'gold'), c = new THREE.Group(); c.position.y = h; o.body.add(c);
  part(c, G.tor, gold, 0.5, 0.5, 1.2, 0, 0, 0).rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i++) part(c, G.cone4, gold, 0.12, 0.3, 0.12, Math.cos(i * 1.257) * 0.24, 0.16, Math.sin(i * 1.257) * 0.24);
  return c;
}
