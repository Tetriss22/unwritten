// UNWRITTEN — world data: five chapters, each a painted glyph terrain plus a node graph.
import { CPU } from './render.js';

// ---------- deterministic noise
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function h2(x, y, s = 0) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
  n = Math.imul(n ^ n >>> 13, 1274126177); n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s) { return vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 5) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 11) * 0.15; }
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

export class Terrain {
  constructor(wu, hu) {
    this.wu = wu; this.hu = hu; this.w = wu * CPU; this.h = hu * CPU;
    this.data = new Uint8Array(this.w * this.h * 4);
    this.solid = new Uint8Array(this.w * this.h).fill(1);
    this.tag = new Uint8Array(this.w * this.h);
  }
  put(cx, cy, chr, pal, bri, kind) {
    const i = (cy * this.w + cx) * 4;
    this.data[i] = chr.charCodeAt(0) - 32; this.data[i + 1] = pal;
    this.data[i + 2] = Math.max(0, Math.min(255, bri / 1.6 * 255)); this.data[i + 3] = kind;
  }
  idx(x, y) { const cx = Math.floor(x * CPU), cy = Math.floor(y * CPU); return (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) ? -1 : cy * this.w + cx; }
  isSolid(x, y) { const i = this.idx(x, y); return i < 0 || this.solid[i] === 1; }
  tagAt(x, y) { const i = this.idx(x, y); return i < 0 ? 0 : this.tag[i]; }
  blocked(x, y, r) {
    if (this.isSolid(x, y)) return true;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (this.isSolid(x + Math.cos(a) * r, y + Math.sin(a) * r)) return true; }
    return false;
  }
  solidCircle(x, y, r) {
    const c0x = Math.floor((x - r) * CPU), c1x = Math.floor((x + r) * CPU), c0y = Math.floor((y - r) * CPU), c1y = Math.floor((y + r) * CPU);
    for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
      if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) continue;
      if (Math.hypot((cx + 0.5) / CPU - x, (cy + 0.5) / CPU - y) <= r) this.solid[cy * this.w + cx] = 1;
    }
  }
}

// paint one cell from a material description
function paint(T, cx, cy, m, seed, word) {
  const n = vnoise(cx / (m.scale || 13), cy / (m.scale || 13), seed + 3);
  const band = m.bands[Math.min(m.bands.length - 1, Math.floor(n * m.bands.length))];
  const a = h2(cx, cy, seed), b = h2(cx, cy, seed + 9), c = h2(cx, cy, seed + 21);
  let chr = band[Math.floor(a * band.length)];
  if (m.text) { const s = m.text; chr = s[(((cx + cy * 7) % s.length) + s.length) % s.length]; if (c < (m.gap || 0)) chr = c < (m.gap || 0) * 0.4 ? '_' : ' '; }
  if (m.word && word) { const s = word + m.word; chr = s[((cx % s.length) + s.length) % s.length]; }
  if (m.sparse && c < m.sparse) chr = ' ';
  const pal = m.pal[Math.floor(b * m.pal.length)];
  const bri = m.bri[0] + (m.bri[1] - m.bri[0]) * c;
  const kind = (m.kind && h2(cx, cy, seed + 33) < (m.kindP ?? 1)) ? m.kind : 0;
  T.put(cx, cy, chr, pal, bri, kind);
}

const N = (x, y, r, o = {}) => ({ x, y, r, ...o });
const TALL = new Set(['tree', 'pine', 'deadtree', 'wall', 'shelf', 'column', 'boulder']);

export const LEVELS = [
  {
    id: 1, roman: 'I', name: 'THE MARGIN', sub: 'where every page begins', word: 'BRIDGE', seed: 11, size: [60, 36],
    line: 'Something is deleting the world, one word at a time.',
    doneLine: 'BRIDGE. You wrote it back.',
    palette: ['#000000', '#8ea2ff', '#f3a0c8', '#e9e6f5', '#b7a6ff', '#4a78ff', '#cfe6ff', '#2c3a78', '#4b5fb5', '#4a78ff', '#ffd9a0', '#fff1c9', '#ff5a4d', '#ffffff', '#7dffc9', '#ff9ad5'],
    bg: [0.012, 0.014, 0.04], ambient: [0.2, 0.22, 0.36], amb3d: [0x8090ff, 0.55], moon: [0xcfd8ff, 1.5],
    weather: [0, 0, [1, 1, 1]], dark: 0, lightR: 6.2, hasWater: 1, rough: 1.0, edgeW: 2.6,
    mats: {
      floor: { bands: ['<>=<>+', '++;+:+', ';~:;,;'], pal: [1, 1, 2, 4], bri: [0.55, 1.0], kind: 2, kindP: 0.22 },
      path: { bands: ['.:. ', ' ._.'], pal: [3], bri: [0.5, 0.85] },
      edge: { bands: ['"!|;', '|!\'"'], pal: [8, 1, 2], bri: [0.6, 1.0], kind: 2 },
      outside: { bands: ['^:^.', '^^"^', ':.^:'], pal: [7, 7, 8], bri: [0.35, 0.7], sparse: 0.25 },
      barrier: { bands: ['~'], pal: [5], bri: [0.9, 1.1], kind: 1 },
      bridge: { bands: ['='], pal: [10], bri: [1.0, 1.3], word: '=', kind: 5 },
    },
    band: { x: 43, w: 4.2, wav: 1.1 },
    nodes: [N(6, 18, 3), N(13, 18, 2.5), N(19, 11, 3), N(20, 26, 3), N(28, 18, 3.5), N(33, 8, 3), N(34, 28, 3), N(39, 18, 2.6), N(47, 18, 2.6), N(54, 18, 3.6)],
    edges: [[0, 1], [1, 2], [1, 3], [2, 4], [3, 4], [4, 5], [4, 6], [5, 7], [6, 7], [4, 7], [8, 9]],
    gate: [7, 8], start: 0, goal: 9,
    letters: [[1, []], [2, ['blot']], [3, ['blot', 'blot']], [4, ['blot', 'blot']], [5, ['blot', 'blot', 'blot']], [6, ['blot', 'blot', 'scratch']]],
    roam: [], hearts: [[30.5, 18]],
    lore: [[4.5, 16.1, 'the world was written.', 11], [4.5, 16.6, 'then it was edited.', 11], [10.3, 20.6, 'WASD move  CLICK strike  SHIFT dash', 3], [50.2, 14.2, 'light the lantern', 11]],
    props: { low: ['bush', 'rock', 'bush'], border: ['tree', 'tree', 'tree', 'bush'], borderP: 0.62, inner: ['rock', 'bush', 'stone'], innerP: 0.3, lamp: 'lamp', lampCol: [1.0, 0.82, 0.55] },
    music: { root: 57, scale: [0, 2, 3, 7, 10], tempo: 0.42 },
  },
  {
    id: 2, roman: 'II', name: 'THE DROWNED SHELVES', sub: 'a library the rain kept', word: 'STONE', seed: 23, size: [60, 36],
    line: 'They cut the roof first. Then the floor.',
    doneLine: 'STONE. The water remembers a road.',
    palette: ['#000000', '#5fe0c0', '#a8f0a0', '#e6f2d8', '#3fb0a8', '#1f7fa8', '#aef4ff', '#145a78', '#2a8fb0', '#145a78', '#e8dfc0', '#ffe9a8', '#ff5a4d', '#ffffff', '#ffc86b', '#7ff0d8'],
    bg: [0.006, 0.02, 0.028], ambient: [0.2, 0.32, 0.34], amb3d: [0x70c0c0, 0.5], moon: [0xc8fff0, 1.3],
    weather: [1, 0.07, [0.55, 0.85, 0.95]], dark: 0.1, lightR: 5.8, hasWater: 1, rough: 0.5, edgeW: 1.7,
    mats: {
      floor: { bands: [',;",', '.:;\'', '+;,:'], pal: [1, 1, 2, 4], bri: [0.55, 1.0], kind: 2, kindP: 0.15 },
      path: { bands: ['=-=', '-=_'], pal: [10, 3], bri: [0.55, 0.9] },
      edge: { bands: ['|!/|', '!|\\!'], pal: [2, 4, 1], bri: [0.6, 1.0], kind: 2 },
      outside: { bands: ['~'], pal: [7, 7, 8], bri: [0.7, 1.0], kind: 1 },
      barrier: { bands: ['~'], pal: [7, 8], bri: [0.7, 1.0], kind: 1 },
      bridge: { bands: ['O'], pal: [10], bri: [1.0, 1.3], word: 'o', kind: 5 },
    },
    band: { x: 42.3, w: 4.6, wav: 0.5 },
    nodes: [N(5, 28, 3), N(13, 24, 2.7), N(12, 12, 3), N(22, 17, 3.2), N(24, 29, 2.9), N(31, 8, 3), N(33, 23, 3), N(37.4, 15, 2.5), N(47.2, 15, 2.5), N(54, 17, 3.6)],
    edges: [[0, 1], [1, 2], [1, 3], [2, 3], [3, 4], [3, 5], [3, 6], [5, 7], [6, 7], [8, 9]],
    gate: [7, 8], start: 0, goal: 9,
    letters: [[1, ['blot', 'blot']], [2, ['blot', 'scratch']], [4, ['blot', 'blot', 'scratch']], [5, ['scratch', 'scratch', 'blot']], [6, ['blot', 'blot', 'blot', 'scratch']]],
    roam: [[17.5, 20.5, 'blot'], [27, 12.5, 'blot']], hearts: [[22, 17], [35.5, 19]],
    lore: [[2.6, 25.2, 'shelf by shelf, cut.', 11], [19.6, 14.3, 'nobody reads underwater', 11]],
    props: { low: ['reed'], border: ['reed', 'reed', 'shelf', 'column', 'reed'], borderP: 0.3, inner: ['shelf', 'column', 'rock'], innerP: 0.34, lamp: 'lamp', lampCol: [0.75, 1.0, 0.8] },
    music: { root: 53, scale: [0, 2, 5, 7, 9], tempo: 0.48 },
  },
  {
    id: 3, roman: 'III', name: 'CINDER ROW', sub: 'a street struck through in red', word: 'RAIN', seed: 37, size: [60, 36],
    line: 'Red ink burns. Do not stand on the corrections.',
    doneLine: 'RAIN. The corrections go cold.',
    palette: ['#000000', '#ff9a5c', '#c96a4a', '#f2d6b8', '#8a7a78', '#ff5a2a', '#ffd27a', '#4a3030', '#7a4a40', '#ff4a1a', '#9fb4c8', '#ffe9a8', '#ff3a2a', '#ffffff', '#7fd0ff', '#ffb080'],
    bg: [0.03, 0.01, 0.008], ambient: [0.3, 0.19, 0.15], amb3d: [0xff9070, 0.5], moon: [0xffc8a0, 1.3],
    weather: [3, 0.06, [1.0, 0.55, 0.25]], dark: 0.15, lightR: 5.8, hasWater: 0, rough: 0.9, edgeW: 2.4,
    mats: {
      floor: { bands: ['.,:;', '+=#+', ';:.\''], pal: [4, 4, 2, 3], bri: [0.5, 0.95] },
      path: { bands: ['.:.', ' ._'], pal: [3], bri: [0.5, 0.8] },
      edge: { bands: ['%#&;', '#%:.'], pal: [8, 2, 4], bri: [0.5, 0.9] },
      outside: { bands: ['#%&@', '%#.:', '&#%.'], pal: [7, 7, 8], bri: [0.35, 0.65], sparse: 0.3 },
      barrier: { bands: ['^'], pal: [9, 5, 6], bri: [1.0, 1.4], kind: 3 },
      bridge: { bands: [':'], pal: [10], bri: [0.9, 1.2], word: '.', kind: 5 },
      hazard: { bands: ['~'], pal: [5, 9, 6], bri: [1.0, 1.4], kind: 3 },
      cooled: { bands: [':.;,'], pal: [10, 4], bri: [0.5, 0.8] },
    },
    band: { x: 43.8, w: 3.8, wav: 0.9 },
    nodes: [N(5, 8, 3), N(14, 10, 2.6), N(20, 20, 3.3), N(12, 28, 3), N(29, 10, 3), N(30, 28, 3.2), N(36, 19, 2.7), N(39.6, 19, 2.5), N(48, 19, 2.5), N(55, 19, 3.4)],
    edges: [[0, 1], [1, 2], [2, 3], [2, 4], [2, 5], [4, 6], [5, 6], [6, 7], [8, 9]],
    gate: [7, 8], start: 0, goal: 9,
    letters: [[2, ['blot', 'blot', 'scratch']], [3, ['brute']], [4, ['scratch', 'scratch', 'blot', 'blot']], [5, ['brute', 'blot', 'blot']]],
    roam: [[14, 10, 'blot'], [25, 15, 'blot'], [24.5, 24.5, 'scratch']], hearts: [[36, 19], [12, 28]],
    lore: [[2.6, 5.4, 'the street was too long.', 11], [2.6, 5.8, 'so they shortened it.', 11]],
    props: { low: ['rock', 'rock', 'brazier'], border: ['wall', 'deadtree', 'wall', 'rock'], borderP: 0.5, inner: ['rock', 'deadtree', 'brazier'], innerP: 0.3, lamp: 'brazier', lampCol: [1.0, 0.6, 0.3] },
    music: { root: 50, scale: [0, 1, 5, 7, 8], tempo: 0.4 },
  },
  {
    id: 4, roman: 'IV', name: 'WHITEOUT PASS', sub: 'the page before the ink', word: 'FIRE', seed: 51, size: [60, 36],
    line: 'Up here nothing has been written yet. That is the danger.',
    doneLine: 'FIRE. The wall forgets it was ice.',
    palette: ['#000000', '#dfeeff', '#a8c8ff', '#ffffff', '#8fb0e8', '#7fd8ff', '#ffffff', '#3a4a70', '#6a7fa8', '#9fe8ff', '#ffb070', '#ffe9a8', '#ff5a4d', '#ffffff', '#ffb070', '#c8e0ff'],
    bg: [0.02, 0.026, 0.045], ambient: [0.2, 0.25, 0.34], amb3d: [0xa0c0ff, 0.6], moon: [0xe8f0ff, 1.4],
    weather: [2, 0.2, [0.9, 0.95, 1.0]], dark: 0.5, lightR: 5.0, hasWater: 0, rough: 1.0, edgeW: 2.6,
    mats: {
      floor: { bands: ['.,\'.', ' .:.', '.\'` '], pal: [1, 1, 2, 4], bri: [0.5, 0.95], kind: 4, kindP: 0.5, sparse: 0.12 },
      path: { bands: ['.:.', ':. '], pal: [3], bri: [0.6, 0.9] },
      edge: { bands: ['*+:.', '.:*\''], pal: [1, 2, 3], bri: [0.6, 1.0], kind: 4 },
      outside: { bands: ['#MW^', 'A^#.', '^#:.'], pal: [7, 7, 8], bri: [0.35, 0.7], sparse: 0.25 },
      barrier: { bands: ['#|H#', '|#|I'], pal: [9, 5, 13], bri: [0.9, 1.4], kind: 5 },
      bridge: { bands: ['~'], pal: [10], bri: [0.9, 1.2], word: '~', kind: 5 },
      ice: { bands: ['/-=\\', '-/_-'], pal: [5, 9], bri: [0.6, 1.0] },
    },
    band: { x: 43.2, w: 3.6, wav: 1.0 },
    nodes: [N(5, 30, 3), N(13, 24, 2.7), N(10, 12, 3), N(22, 9, 3), N(24, 23, 3.4), N(33, 30, 3), N(33, 13, 3), N(39, 20, 2.6), N(47.4, 20, 2.6), N(55, 20, 3.4)],
    edges: [[0, 1], [1, 2], [2, 3], [1, 4], [3, 6], [4, 5], [4, 6], [5, 7], [6, 7], [8, 9]],
    gate: [7, 8], start: 0, goal: 9,
    letters: [[2, ['blot', 'blot', 'blot', 'scratch']], [3, ['brute', 'scratch']], [5, ['brute', 'brute']], [6, ['scratch', 'scratch', 'blot', 'blot', 'blot']]],
    roam: [[13, 24, 'blot'], [16, 10, 'scratch'], [28.5, 26.5, 'blot'], [28, 11, 'blot']], hearts: [[24, 23], [36.5, 22]],
    lore: [[2.6, 27.2, 'no one drafts in the cold.', 11]],
    props: { low: ['rock', 'spike'], border: ['pine', 'pine', 'boulder', 'pine'], borderP: 0.6, inner: ['boulder', 'spike', 'rock'], innerP: 0.3, lamp: 'brazier', lampCol: [1.0, 0.7, 0.4] },
    music: { root: 55, scale: [0, 2, 3, 7, 8], tempo: 0.5 },
  },
  {
    id: 5, roman: 'V', name: 'THE BLANK', sub: 'the desk of the Editor', word: 'END', seed: 67, size: [60, 36],
    line: 'Every story it cut never got an ending. Write one.',
    doneLine: 'END. Now go and say it to the Editor.',
    palette: ['#000000', '#c9b8ff', '#ffffff', '#f0e8ff', '#8f7fd0', '#6a5acd', '#ffffff', '#3a2f60', '#5a4a90', '#3a2f60', '#ffe9a8', '#ffe9a8', '#ff3a5a', '#ffffff', '#ff3a5a', '#e0d0ff'],
    bg: [0.012, 0.008, 0.026], ambient: [0.2, 0.17, 0.32], amb3d: [0xa090ff, 0.5], moon: [0xe0d8ff, 1.3],
    weather: [3, 0.03, [0.8, 0.7, 1.0]], dark: 0.3, lightR: 5.8, hasWater: 0, rough: 0.25, edgeW: 1.6,
    mats: {
      floor: { bands: ['x'], text: 'the world was written and then it was edited but you are still here ', gap: 0.3, pal: [1, 1, 2, 4], bri: [0.5, 1.0] },
      path: { bands: ['x'], text: 'keep writing ', gap: 0.1, pal: [3, 2], bri: [0.7, 1.0] },
      edge: { bands: ['_. _', ' ._ '], pal: [4, 8], bri: [0.5, 0.8] },
      outside: { bands: ['.'], pal: [7, 8], bri: [0.5, 0.9], kind: 6 },
      barrier: { bands: ['.'], pal: [7, 8], bri: [0.5, 0.9], kind: 6 },
      bridge: { bands: ['E'], pal: [10], bri: [1.0, 1.3], word: ' THE ', kind: 5 },
    },
    band: { x: 37.5, w: 3.4, wav: 0.3 },
    nodes: [N(5, 18, 2.7), N(13, 18, 2.5), N(20, 9, 2.9), N(20, 27, 2.9), N(28, 18, 3.1), N(33.6, 18, 2.3), N(41.4, 18, 2.3), N(50.5, 18, 7.2)],
    edges: [[0, 1], [1, 2], [1, 3], [2, 4], [3, 4], [4, 5], [6, 7]],
    gate: [5, 6], start: 0, goal: 7, boss: true,
    letters: [[2, ['blot', 'blot', 'blot', 'scratch', 'scratch']], [3, ['brute', 'brute', 'blot']], [4, ['brute', 'scratch', 'scratch', 'blot', 'blot']]],
    roam: [[13, 18, 'blot'], [16.5, 13.5, 'scratch'], [16.5, 22.5, 'blot'], [24, 13.5, 'blot'], [24, 22.5, 'scratch']], hearts: [[13, 18], [28, 20.5], [44.5, 18]],
    lore: [],
    props: { low: ['cube'], border: ['shard', 'cube', 'shard'], borderP: 0.2, inner: ['column', 'cube'], innerP: 0.22, lamp: 'lamp', lampCol: [0.85, 0.75, 1.0] },
    music: { root: 48, scale: [0, 1, 3, 6, 7], tempo: 0.36 },
  },
];

export function buildLevel(L) {
  const [wu, hu] = L.size, T = new Terrain(wu, hu), seed = L.seed, R = rng(seed * 977 + 5);
  const nodes = L.nodes, m = L.mats, ew = L.edgeW;
  const edges = L.edges.map(([a, b]) => [nodes[a], nodes[b]]);
  const [ga, gb] = [nodes[L.gate[0]], nodes[L.gate[1]]];
  const bandC = (uy) => L.band.x + Math.sin(uy * 0.33 + seed) * L.band.wav;
  const walk = (ux, uy) => {
    let d = 1e9;
    for (const n of nodes) d = Math.min(d, Math.hypot(ux - n.x, uy - n.y) - n.r);
    for (const [a, b] of edges) d = Math.min(d, segDist(ux, uy, a.x, a.y, b.x, b.y) - ew / 2);
    return d;
  };
  const pathD = (ux, uy) => { let d = 1e9; for (const [a, b] of edges) d = Math.min(d, segDist(ux, uy, a.x, a.y, b.x, b.y)); return d; };
  const nodeD = (ux, uy) => { let d = 1e9; for (const n of nodes) d = Math.min(d, Math.hypot(ux - n.x, uy - n.y)); return d; };
  const inBand = (ux, uy, pad = 0) => Math.abs(ux - bandC(uy)) < L.band.w / 2 + pad;

  const bridge = [], hazard = [];
  for (let cy = 0; cy < T.h; cy++) for (let cx = 0; cx < T.w; cx++) {
    const ux = (cx + 0.5) / CPU, uy = (cy + 0.5) / CPU, i = cy * T.w + cx;
    const rough = (fbm(ux * 0.8, uy * 0.8, seed) - 0.5) * 1.1 * L.rough;
    const d = walk(ux, uy) + rough;
    const band = inBand(ux, uy, (fbm(ux * 1.3, uy * 1.3, seed + 2) - 0.5) * 0.5);
    const onBridge = segDist(ux, uy, ga.x, ga.y, gb.x, gb.y) < 1.0 && inBand(ux, uy, 0.9);
    if (onBridge) bridge.push([cx, cy, ux]);
    if (band) { paint(T, cx, cy, m.barrier, seed); continue; }
    if (d >= 0) { paint(T, cx, cy, m.outside, seed); continue; }
    T.solid[i] = 0;
    const pd = pathD(ux, uy);
    if (pd < 0.42) paint(T, cx, cy, m.path, seed);
    else if (d > -0.5) paint(T, cx, cy, m.edge, seed);
    else paint(T, cx, cy, m.floor, seed);
    // chapter-specific ground features
    if (L.id === 1) {
      if (pd > 0.6 && fbm(ux * 0.5, uy * 0.5, seed + 40) > 0.66 && h2(cx, cy, 77) < 0.3) T.put(cx, cy, '*', h2(cx, cy, 5) < 0.5 ? 15 : 14, 1.0 + h2(cx, cy, 6) * 0.4, 0);
    } else if (L.id === 2) {
      if (d > -0.62 || (pd > 0.7 && fbm(ux * 0.7, uy * 0.7, seed + 40) > 0.7)) { T.put(cx, cy, '~', 8, 0.95, 1); T.tag[i] = 3; }
    } else if (L.id === 3) {
      if (pd > 0.95 && nodeD(ux, uy) > 2.3 && d < -0.5 && Math.abs(fbm(ux * 0.55, uy * 0.55, seed + 40) - 0.5) < 0.02) { paint(T, cx, cy, m.hazard, seed); T.tag[i] = 1; hazard.push([cx, cy]); }
    } else if (L.id === 4) {
      if (pd > 0.5 && fbm(ux * 0.4, uy * 0.4, seed + 40) > 0.6) { paint(T, cx, cy, m.ice, seed); T.tag[i] = 2; }
    }
  }
  bridge.sort((a, b) => a[2] - b[2]);

  // writing left on the ground
  for (const [x, y, text, pal] of L.lore) {
    const cx0 = Math.floor(x * CPU), cy = Math.floor(y * CPU);
    for (let k = 0; k < text.length; k++) {
      const cx = cx0 + k; if (cx < 0 || cx >= T.w || cy < 0 || cy >= T.h) continue;
      T.put(cx, cy, text[k], pal, 1.25, text[k] === ' ' ? 0 : 5); T.tag[cy * T.w + cx] = 0;
    }
  }

  // ---------- props
  const props = [], lamps = [];
  const P = L.props, pick = (arr) => arr[Math.floor(R() * arr.length)];
  const far = (x, y, min) => props.every(p => Math.hypot(p.x - x, p.y - y) > min);
  for (let gy = 0.6; gy < hu; gy += 1.25) for (let gx = 0.6; gx < wu; gx += 1.25) {
    const x = gx + (R() - 0.5) * 0.9, y = gy + (R() - 0.5) * 0.9, d = walk(x, y);
    if (d < 0.55 || d > 4.6 || inBand(x, y, 0.7) || R() > P.borderP * (1 - (d - 0.55) / 6)) continue;
    if (!T.isSolid(x, y)) continue;
    let type = pick(P.border);
    // nothing tall directly south of a walkable strip: it would hide the fight
    if ((walk(x, y - 1.3) < 0.3 || walk(x, y - 2.4) < 0.3 || walk(x, y - 3.3) < 0.2) && TALL.has(type)) type = P.low[Math.floor(R() * P.low.length)];
    props.push({ type, x, y, s: 0.75 + R() * 0.45, rot: R() * 6.28, v: R() });
  }
  for (let gy = 1; gy < hu; gy += 2.3) for (let gx = 1; gx < wu; gx += 2.3) {
    const x = gx + (R() - 0.5) * 1.6, y = gy + (R() - 0.5) * 1.6;
    if (walk(x, y) > -1.35 || pathD(x, y) < 1.15 || nodeD(x, y) < 1.9 || inBand(x, y, 1.2) || R() > P.innerP) continue;
    if (T.blocked(x, y, 0.5)) continue;
    if (L.boss && Math.hypot(x - nodes[L.goal].x, y - nodes[L.goal].y) < nodes[L.goal].r + 0.5) continue;
    const type = pick(P.inner);
    const big = type === 'shelf' || type === 'boulder' || type === 'column';
    props.push({ type, x, y, s: 0.75 + R() * 0.45, rot: R() * 6.28, v: R() });
    T.solidCircle(x, y, big ? 0.5 : 0.36);
  }
  // lamps along the roads, and a pair at each end of the crossing
  const addLamp = (x, y) => {
    if (T.blocked(x, y, 0.3) || !far(x, y, 1.0)) return;
    props.push({ type: P.lamp, x, y, s: 1, rot: 0, v: R(), lamp: true });
    lamps.push({ x, y, r: 3.4, col: P.lampCol, int: 0.85, ph: R() * 6 });
    T.solidCircle(x, y, 0.22);
  };
  for (const [a, b] of edges) {
    const len = Math.hypot(b.x - a.x, b.y - a.y), nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    let side = R() < 0.5 ? 1 : -1;
    for (let s = 3.2; s < len - 2.5; s += 6.5) {
      const t = s / len; side = -side;
      addLamp(a.x + (b.x - a.x) * t + nx * side * (ew / 2 + 0.1), a.y + (b.y - a.y) * t + ny * side * (ew / 2 + 0.1));
    }
  }
  for (const g of [ga, gb]) for (const s of [-1, 1]) addLamp(g.x + (g === ga ? 0.9 : -0.9), g.y + s * 1.5);

  // barrier dressing that disappears when the word is written
  if (L.id === 4) for (let y = 1; y < hu; y += 0.9) props.push({ type: 'spike', x: bandC(y) + (R() - 0.5) * L.band.w * 0.7, y: y + (R() - 0.5) * 0.5, s: 1.2 + R() * 0.9, rot: R() * 6, v: R(), barrier: Math.abs(y - ga.y) < 2.2 });
  if (L.id === 3) for (let y = 1; y < hu; y += 1.5) props.push({ type: 'flame', x: bandC(y) + (R() - 0.5) * L.band.w * 0.5, y: y + (R() - 0.5) * 0.6, s: 0.9 + R() * 0.8, rot: R() * 6, v: R(), barrier: Math.abs(y - ga.y) < 2.2 });
  if (L.id === 1) for (const g of [ga, gb]) for (const s of [-1, 1]) props.push({ type: 'post', x: g.x + (g === ga ? 1.75 : -1.75), y: g.y + s * 1.05, s: 1, rot: 0, v: R() });

  const letters = L.letters.map(([ni, guards], k) => ({ ch: L.word[k], x: nodes[ni].x, y: nodes[ni].y, guards }));
  return {
    L, T, props, lamps, letters, bridge, hazard,
    start: nodes[L.start], goal: nodes[L.goal], gateA: ga, gateB: gb,
    roam: L.roam.map(([x, y, type]) => ({ x, y, type })), hearts: L.hearts.map(([x, y]) => ({ x, y })),
    paintBridge(cx, cy) { paint(T, cx, cy, m.bridge, seed, L.word); T.solid[cy * T.w + cx] = 0; T.tag[cy * T.w + cx] = 0; },
    coolHazard() { for (const [cx, cy] of hazard) { paint(T, cx, cy, m.cooled, seed); T.tag[cy * T.w + cx] = 0; } },
  };
}
