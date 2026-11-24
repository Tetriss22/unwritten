// UNWRITTEN — one small world: five lands painted into a single glyph terrain and joined by roads.
export const CPU = 8;               // ground cells per world unit
export const YAW = 32 * Math.PI / 180, PITCH = 47 * Math.PI / 180;   // the isometric camera

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
    this.reg = new Uint8Array(this.w * this.h);
  }
  put(cx, cy, chr, pal, bri, kind) {
    const i = (cy * this.w + cx) * 4;
    this.data[i] = chr.charCodeAt(0) - 32; this.data[i + 1] = pal;
    this.data[i + 2] = Math.max(0, Math.min(255, bri / 1.6 * 255)); this.data[i + 3] = kind;
  }
  putRaw(cx, cy, code, pal, bri, kind) {
    const i = (cy * this.w + cx) * 4;
    this.data[i] = code; this.data[i + 1] = pal; this.data[i + 2] = Math.max(0, Math.min(255, bri / 1.6 * 255)); this.data[i + 3] = kind;
  }
  idx(x, y) { const cx = Math.floor(x * CPU), cy = Math.floor(y * CPU); return (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) ? -1 : cy * this.w + cx; }
  isSolid(x, y) { const i = this.idx(x, y); return i < 0 || this.solid[i] === 1; }
  tagAt(x, y) { const i = this.idx(x, y); return i < 0 ? 0 : this.tag[i]; }
  regAt(x, y) { const i = this.idx(x, y); return i < 0 ? 0 : this.reg[i]; }
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

// paint one cell from a material description; pal indices are local to the land (16 colours each)
// ramp: dense text whose letters get heavier and brighter where a stone-like noise is high
// grass: the renderer draws these cells as a finer layer of blades; the letter here is only used far away
export const STONE = ".:-~;=+*rcsxzvuoawdbpq%&$#08QWNM@B", ASH = ".,:;=+x%#&@", SNOW = ".'`,:*+";
const BLADES = "|/\\!'\"";
function paint(T, cx, cy, m, seed, reg, word) {
  const a = h2(cx, cy, seed), b = h2(cx, cy, seed + 9), c = h2(cx, cy, seed + 21);
  const pal = m.pal[Math.floor(b * m.pal.length)];
  let bri = m.bri[0] + (m.bri[1] - m.bri[0]) * c, chr;
  const tid = word !== undefined ? word : m.tid;
  if (tid !== undefined) { if (c < (m.gap || 0)) T.put(cx, cy, c < (m.gap || 0) * 0.4 ? '_' : ' ', reg * 16 + pal, bri, 0); else T.putRaw(cx, cy, tid, reg * 16 + pal, bri, 7); return; }
  if (m.ramp) {
    const n = fbm(cx / (m.scale || 4.5), cy / (m.scale || 4.5), seed + 3), k = Math.max(0, Math.min(1, (n - 0.22) / 0.56));
    // the cell stores only how heavy the letter should be; the renderer picks the letter per glyph cell
    T.putRaw(cx, cy, Math.round(k * 255), reg * 16 + pal, m.bri[0] + (m.bri[1] - m.bri[0]) * k, m.ramp === STONE ? 9 : m.ramp === ASH ? 10 : 11); return;
  } else if (m.grass) chr = BLADES[Math.floor(a * BLADES.length)];
  else {
    const n = vnoise(cx / 13, cy / 13, seed + 3), band = m.bands[Math.min(m.bands.length - 1, Math.floor(n * m.bands.length))];
    chr = band[Math.floor(a * band.length)];
  }
  if (m.sparse && c < m.sparse) chr = ' ';
  const kind = (m.kind && h2(cx, cy, seed + 33) < (m.kindP ?? 1)) ? m.kind : 0;
  T.put(cx, cy, chr, reg * 16 + pal, bri, kind);
}

// ---------- the five lands. Palette slots: 1-4 ground, 5-6 water, 7-8 the wilds, 10-11 gold, 14-15 flowers
export const LANDS = [
  {
    roman: 'I', name: 'THE MARGIN', sub: 'where every page begins', word: 'BRIDGE', seed: 11,
    line: 'Something is deleting the world, one word at a time.', doneLine: 'BRIDGE. You wrote it back.',
    palette: ['#000000', '#58c060', '#9be070', '#e6e6de', '#3a9a54', '#4a8aff', '#d8ecff', '#2c8046', '#3c9450', '#4a8aff', '#ffd98a', '#fff1c9', '#ff5a4d', '#ffffff', '#ffffff', '#ff9ad5'],
    bg: [0.006, 0.012, 0.014], ambient: [0.6, 0.68, 0.64], amb3d: [0x98c8a8, 0.6], moon: [0xdfe8ff, 1.5],
    weather: [0, 0, [1, 1, 1]], dark: 0, lightR: 6.6, rough: 1.0, edgeW: 2.6,
    mats: {
      floor: { grass: 1, pal: [1, 1, 2, 4], bri: [0.78, 1.2], kind: 2 },
      path: { ramp: STONE, pal: [3], bri: [0.55, 1.15] },
      edge: { grass: 1, pal: [2, 1], bri: [0.8, 1.2], kind: 2 },
      outside: { grass: 1, pal: [7, 7, 8], bri: [0.6, 0.95], kind: 2 },
      field: { grass: 1, pal: [10, 10, 11], bri: [0.75, 1.15], kind: 8 },
      barrier: { bands: ['~'], pal: [5], bri: [0.9, 1.1], kind: 1 },
      bridge: { bands: ['='], pal: [10], bri: [1.0, 1.3], kind: 5 },
    },
    props: { build: ['house', 'house', 'house', 'house', 'windmill', 'tower'], low: ['bush', 'rock', 'bush'], border: ['tree', 'tree', 'cypress', 'bush'], borderP: 0.5, inner: ['rock', 'bush', 'stone'], innerP: 0.3, lamp: 'lamp', lampCol: [1.0, 0.72, 0.38] },
    music: { root: 57, scale: [0, 2, 3, 7, 10], tempo: 0.42 },
  },
  {
    roman: 'II', name: 'THE DROWNED SHELVES', sub: 'a library the rain kept', word: 'STONE', seed: 23,
    line: 'They cut the roof first. Then the floor.', doneLine: 'STONE. The water remembers a road.',
    palette: ['#000000', '#62d8b8', '#a8ecb0', '#e2ebe6', '#48b09c', '#2a9ad0', '#c8f8ff', '#1f7aa8', '#3aa0cc', '#1f7aa8', '#e8dfc0', '#ffe9a8', '#ff5a4d', '#ffffff', '#ffffff', '#ffc86b'],
    bg: [0.004, 0.014, 0.02], ambient: [0.56, 0.72, 0.74], amb3d: [0x80c8c8, 0.55], moon: [0xc8fff0, 1.3],
    weather: [1, 0.07, [0.55, 0.85, 0.95]], dark: 0.05, lightR: 6.2, rough: 0.5, edgeW: 1.8,
    mats: {
      floor: { ramp: STONE, pal: [3, 3, 10], bri: [0.38, 1.05] },
      moss: { grass: 1, pal: [1, 2, 4], bri: [0.65, 1.1], kind: 2 },
      path: { ramp: STONE, pal: [10], bri: [0.6, 1.2] },
      edge: { grass: 1, pal: [2, 4, 1], bri: [0.7, 1.1], kind: 2 },
      outside: { bands: ['~'], pal: [7, 7, 8], bri: [0.7, 1.0], kind: 1 },
      field: { grass: 1, pal: [2, 1, 4], bri: [0.7, 1.1], kind: 8 },
      barrier: { bands: ['~'], pal: [7, 8], bri: [0.7, 1.0], kind: 1 },
      bridge: { bands: ['O'], pal: [10], bri: [1.0, 1.3], kind: 5 },
    },
    props: { build: ['ruinwall', 'ruinwall', 'tower'], low: ['reed'], border: ['reed', 'reed', 'shelf', 'column', 'reed'], borderP: 0.26, inner: ['shelf', 'column', 'rock'], innerP: 0.34, lamp: 'lamp', lampCol: [0.75, 1.0, 0.8] },
    music: { root: 53, scale: [0, 2, 5, 7, 9], tempo: 0.48 },
  },
  {
    roman: 'III', name: 'CINDER ROW', sub: 'a street struck through in red', word: 'RAIN', seed: 37,
    line: 'Red ink burns. Do not stand on the corrections.', doneLine: 'RAIN. The corrections go cold.',
    palette: ['#000000', '#ff9a5c', '#d07a54', '#f0e6dc', '#a8a09c', '#ff5a2a', '#ffd27a', '#6e5854', '#8e6e64', '#ff4a1a', '#9fb4c8', '#ffe9a8', '#ff3a2a', '#ffffff', '#ffd27a', '#ff9a5c'],
    bg: [0.02, 0.008, 0.006], ambient: [0.72, 0.56, 0.5], amb3d: [0xffa080, 0.55], moon: [0xffc8a0, 1.3],
    weather: [3, 0.06, [1.0, 0.55, 0.25]], dark: 0.08, lightR: 6.2, rough: 0.9, edgeW: 2.4,
    mats: {
      floor: { ramp: ASH, pal: [4, 4, 3], bri: [0.38, 1.0] },
      path: { ramp: STONE, pal: [3], bri: [0.5, 1.1] },
      edge: { ramp: ASH, pal: [8, 2, 4], bri: [0.4, 0.9] },
      outside: { ramp: STONE, pal: [7, 7, 8], bri: [0.3, 0.8] },
      field: { grass: 1, pal: [2, 8, 1], bri: [0.5, 0.9], kind: 2 },
      barrier: { bands: ['^'], pal: [9, 5, 6], bri: [1.0, 1.4], kind: 3 },
      bridge: { bands: [':'], pal: [10], bri: [0.9, 1.2], kind: 5 },
      hazard: { bands: ['~'], pal: [5, 9, 6], bri: [1.0, 1.4], kind: 3 },
      cooled: { ramp: ASH, pal: [10, 4], bri: [0.45, 0.85] },
    },
    props: { build: ['burnt', 'burnt', 'burnt', 'tower'], low: ['rock', 'rock', 'brazier'], border: ['wall', 'deadtree', 'deadtree', 'rock'], borderP: 0.42, inner: ['rock', 'deadtree', 'brazier'], innerP: 0.3, lamp: 'brazier', lampCol: [1.0, 0.6, 0.3] },
    music: { root: 50, scale: [0, 1, 5, 7, 8], tempo: 0.4 },
  },
  {
    roman: 'IV', name: 'WHITEOUT PASS', sub: 'the page before the ink', word: 'FIRE', seed: 51,
    line: 'Up here nothing has been written yet. That is the danger.', doneLine: 'FIRE. The wall forgets it was ice.',
    palette: ['#000000', '#f0f6ff', '#c4dcff', '#ffffff', '#b0ccf8', '#7fd8ff', '#ffffff', '#5a70a0', '#8098c0', '#9fe8ff', '#ffb070', '#ffe9a8', '#ff5a4d', '#ffffff', '#ffffff', '#c8e0ff'],
    bg: [0.014, 0.02, 0.036], ambient: [0.6, 0.7, 0.86], amb3d: [0xa8c8ff, 0.65], moon: [0xe8f0ff, 1.4],
    weather: [2, 0.18, [0.9, 0.95, 1.0]], dark: 0.2, lightR: 5.6, rough: 1.0, edgeW: 2.6,
    mats: {
      floor: { ramp: SNOW, pal: [1, 1, 2, 4], bri: [0.5, 1.1], kind: 4, kindP: 0.5 },
      path: { ramp: STONE, pal: [4, 2], bri: [0.45, 1.0] },
      edge: { ramp: SNOW, pal: [1, 3], bri: [0.6, 1.15], kind: 4 },
      outside: { ramp: STONE, pal: [7, 7, 8], bri: [0.32, 0.85] },
      barrier: { bands: ['#|H#', '|#|I'], pal: [9, 5, 13], bri: [0.9, 1.4], kind: 5 },
      bridge: { bands: ['~'], pal: [10], bri: [0.9, 1.2], kind: 5 },
      ice: { bands: ['/-=\\', '-/_-'], pal: [5, 9], bri: [0.6, 1.0] },
    },
    props: { build: ['cabin', 'cabin', 'watchtower'], low: ['rock', 'spike'], border: ['pine', 'pine', 'boulder', 'pine'], borderP: 0.5, inner: ['boulder', 'spike', 'rock'], innerP: 0.3, lamp: 'brazier', lampCol: [1.0, 0.7, 0.4] },
    music: { root: 55, scale: [0, 2, 3, 7, 8], tempo: 0.5 },
  },
  {
    roman: 'V', name: 'THE BLANK', sub: 'the desk of the Editor', word: 'END', seed: 67,
    line: 'Every story it cut never got an ending. Write one.', doneLine: 'END. Now go and say it to the Editor.',
    palette: ['#000000', '#dcd0ff', '#ffffff', '#f6f0ff', '#b0a0f0', '#6a5acd', '#ffffff', '#6a58a8', '#8a78c8', '#6a58a8', '#ffe9a8', '#ffe9a8', '#ff3a5a', '#ffffff', '#ff3a5a', '#e0d0ff'],
    bg: [0.01, 0.006, 0.022], ambient: [0.6, 0.54, 0.82], amb3d: [0xa898ff, 0.55], moon: [0xe0d8ff, 1.3],
    weather: [3, 0.03, [0.8, 0.7, 1.0]], dark: 0.15, lightR: 6.0, rough: 0.25, edgeW: 1.7,
    mats: {
      floor: { tid: 6, gap: 0.3, pal: [1, 1, 2, 4], bri: [0.6, 1.1] },
      path: { tid: 7, gap: 0.1, pal: [3, 2], bri: [0.8, 1.15] },
      edge: { bands: ['_. _', ' ._ '], pal: [4, 8], bri: [0.5, 0.8] },
      outside: { bands: ['.'], pal: [7, 8], bri: [0.5, 0.9], kind: 6 },
      barrier: { bands: ['.'], pal: [7, 8], bri: [0.5, 0.9], kind: 6 },
      bridge: { bands: ['E'], pal: [10], bri: [1.0, 1.3], kind: 5 },
    },
    props: { build: ['doorframe', 'doorframe'], low: ['cube'], border: ['shard', 'cube', 'shard'], borderP: 0.22, inner: ['column', 'cube'], innerP: 0.2, lamp: 'lamp', lampCol: [0.85, 0.75, 1.0] },
    music: { root: 48, scale: [0, 1, 3, 6, 7], tempo: 0.36 },
  },
];

// ---------- the map: named places [x, y, radius, land]
export const SIZE = [128, 92];
const PLACES = {
  // I  the Margin (south-west) and the south road
  M0: [10, 84, 3, 0], M1: [18, 82, 2.5, 0], M2: [26, 76, 3, 0], M3: [16, 72, 2.8, 0], M4: [30, 86, 2.6, 0], M5: [36, 70, 3, 0], M6: [24, 64, 2.8, 0],
  MgA: [11, 70, 2.2, 0], MgB: [6.5, 63.5, 2.2, 0], ML: [9, 57, 3.2, 0],
  S1: [44, 82, 2.2, 0], XS: [64, 80, 3.2, 0], sA: [64, 75, 2, 0], W1: [30, 54, 2.2, 0],
  Mf1: [36.5, 79, 5.2, 0, 1], Mf2: [20.5, 87.6, 3.6, 0, 1], Mf3: [52, 85.5, 4.4, 0, 1], Mf4: [31, 61, 3.6, 0, 1],
  // II the Drowned Shelves (north-west) and the north causeway
  W2: [30, 41, 2.2, 1], D0: [30, 34, 2.8, 1], D1: [20, 30, 2.7, 1], D2: [12, 22, 3, 1], D3: [24, 20, 3.2, 1], D4: [36, 24, 2.9, 1], D5: [14, 10, 3, 1], D6: [30, 9, 3, 1],
  DgA: [33, 15, 2.2, 1], DgB: [41, 13.5, 2.2, 1], DL: [45.5, 10, 3.2, 1], N1: [48, 23, 2.2, 1], N2: [64, 16, 3, 1],
  Df1: [17.5, 17, 4.2, 1, 1],
  // III Cinder Row (north-east) and the east road
  N3: [80, 20, 2.2, 2], C0: [88, 22, 2.8, 2], C1: [98, 14, 3, 2], C2: [96, 28, 3.2, 2], C3: [108, 22, 3, 2], C4: [111, 10, 3, 2], C5: [108, 34, 3.1, 2],
  CgA: [112.5, 28, 2.2, 2], CgB: [120.6, 28, 2, 2], CL: [121.8, 22.4, 3.1, 2], E1: [103, 46, 2.2, 2],
  Cf1: [102, 21.5, 4.2, 2, 1],
  // IV Whiteout Pass (south-east)
  P0: [103, 59, 2.8, 3], P1: [112, 67, 3, 3], P2: [96, 68, 3.3, 3], P3: [118, 79, 3, 3], P4: [104, 81, 3, 3], P5: [88, 75, 3, 3],
  PgA: [113.5, 62.2, 2.2, 3], PgB: [120, 56.6, 2.2, 3], PL: [121.6, 51.6, 3, 3], S2: [84, 82, 2.2, 3],
  // V  the Blank (the hole in the middle of the page)
  sB: [64, 67, 2.2, 4], B1: [55, 62, 2.7, 4], B2: [73, 62, 2.7, 4], B3: [64, 58.5, 2.9, 4], eA: [64, 54, 2, 4], AR: [64, 41.5, 7.2, 4],
};
const ROADS = [
  'M0-M1', 'M1-M2', 'M1-M3', 'M2-M3', 'M2-M4', 'M2-M5', 'M2-M6', 'M5-M6', 'M3-MgA', 'MgB-ML', 'M4-S1', 'M5-S1', 'S1-XS', 'XS-sA', 'M6-W1', 'W1-W2',
  'W2-D0', 'D0-D1', 'D0-D4', 'D1-D2', 'D1-D3', 'D2-D3', 'D3-D4', 'D2-D5', 'D3-D6', 'D5-D6', 'D6-DgA', 'D4-DgA', 'DgB-DL', 'D4-N1', 'N1-N2', 'N2-N3',
  'N3-C0', 'C0-C1', 'C0-C2', 'C1-C4', 'C2-C3', 'C2-C5', 'C3-C4', 'C1-C3', 'C3-CgA', 'C5-CgA', 'CgB-CL', 'C5-E1', 'E1-P0',
  'P0-P1', 'P0-P2', 'P1-P3', 'P2-P4', 'P2-P5', 'P3-P4', 'P4-P5', 'P1-PgA', 'PgB-PL', 'P5-S2', 'S2-XS',
  'sB-B1', 'sB-B2', 'sB-B3', 'B1-B3', 'B2-B3', 'B3-eA',
];
// crossings that do not exist until something is written
const GATES = [
  { id: 'w0', a: 'MgA', b: 'MgB', land: 0, need: 'word', text: 'BRIDGE=' },
  { id: 'w1', a: 'DgA', b: 'DgB', land: 1, need: 'word', text: 'STONEo' },
  { id: 'w2', a: 'CgA', b: 'CgB', land: 2, need: 'word', text: 'RAIN.:' },
  { id: 'w3', a: 'PgA', b: 'PgB', land: 3, need: 'word', text: 'FIRE~' },
  { id: 'seal', a: 'sA', b: 'sB', land: 4, need: 'lanterns', text: 'BRIDGE STONE RAIN FIRE ' },
  { id: 'w4', a: 'eA', b: 'AR', land: 4, need: 'word', text: ' THE END' },
];
const ring = (cx, cy, r, n) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(i / n * 6.2832) * r, cy + Math.sin(i / n * 6.2832) * r]);
// rivers, walls and voids: strips of impassable ground [land, half-width, points]
const STRIPS = [
  [0, 1.9, [[-1, 73.4], [8.75, 66.75], [16, 61.7], [20, 56], [19.4, 49], [15, 42.5], [9, 38]]],
  [1, 1.7, [[36, 7.5], [37, 14.25], [37.5, 18]]],
  [2, 1.8, [[117.6, -1], [116.4, 14], [116.6, 28], [117.4, 39], [119, 45.5]]],
  [3, 1.7, [[109.6, 51.6], [116.75, 59.4], [123, 66.5], [129, 71.5]]],
  [4, 1.3, ring(64, 41.5, 9.7, 28)],
  [4, 1.4, [[55, 71.4], [64, 71], [73, 71.4]]],
];
const LETTERS = [
  [0, 'M1', []], [0, 'M2', ['blot']], [0, 'M3', ['blot', 'blot']], [0, 'M4', ['blot', 'blot']], [0, 'M5', ['blot', 'blot', 'blot']], [0, 'M6', ['blot', 'blot', 'scratch']],
  [1, 'D1', ['blot', 'blot']], [1, 'D2', ['blot', 'scratch']], [1, 'D4', ['blot', 'blot', 'scratch']], [1, 'D5', ['scratch', 'scratch', 'blot']], [1, 'D6', ['blot', 'blot', 'blot', 'scratch']],
  [2, 'C1', ['blot', 'blot', 'scratch']], [2, 'C3', ['brute']], [2, 'C4', ['scratch', 'scratch', 'blot', 'blot']], [2, 'C5', ['brute', 'blot', 'blot']],
  [3, 'P1', ['blot', 'blot', 'blot', 'scratch']], [3, 'P3', ['brute', 'scratch']], [3, 'P4', ['brute', 'brute']], [3, 'P5', ['scratch', 'scratch', 'blot', 'blot', 'blot']],
  [4, 'B1', ['blot', 'blot', 'blot', 'scratch', 'scratch']], [4, 'B2', ['brute', 'brute', 'blot']], [4, 'B3', ['brute', 'scratch', 'scratch', 'blot', 'blot']],
];
const ROAM = [
  [30, 47.5, 'blot'], [22, 25, 'blot'], [27, 14.5, 'blot'], [56, 19.5, 'scratch'], [72, 18, 'blot'],
  [88, 22, 'blot'], [102, 18, 'blot'], [102, 31, 'scratch'], [103, 52, 'blot'],
  [100, 63.5, 'blot'], [115, 73, 'scratch'], [96, 78, 'blot'], [74, 81, 'blot'],
  [59.5, 64.5, 'blot'], [68.5, 64.5, 'scratch'], [59.5, 60, 'blot'], [68.5, 60, 'scratch'],
];
const HEARTS = [[26, 76], [36, 70], [24, 20], [48, 23], [96, 28], [103, 46], [96, 68], [64, 80], [64, 67], [64, 54]];
export const TEXTS = [...GATES.map(g => g.text), 'the world was written and then it was edited but you are still here ', 'keep writing '];

export function buildWorld() {
  const [wu, hu] = SIZE, T = new Terrain(wu, hu), R = rng(90210);
  const nodes = Object.entries(PLACES).map(([id, [x, y, r, land, field]]) => ({ id, x, y, r, land, field: !!field }));
  const N = Object.fromEntries(nodes.map(n => [n.id, n]));
  const edges = ROADS.map(s => { const [a, b] = s.split('-').map(k => N[k]); return { a, b, w: Math.min(LANDS[a.land].edgeW, LANDS[b.land].edgeW) }; });
  const strips = STRIPS.map(([land, hw, pts]) => ({ land, hw, pts }));

  // spatial buckets so each cell only looks at what is near it
  const BS = 4, bw = Math.ceil(wu / BS), bh = Math.ceil(hu / BS), REACH = 8.5;
  const bk = Array.from({ length: bw * bh }, () => ({ n: [], e: [], s: [] }));
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    const cx = (bx + 0.5) * BS, cy = (by + 0.5) * BS, b = bk[by * bw + bx];
    for (const n of nodes) if (Math.hypot(cx - n.x, cy - n.y) - n.r < REACH) b.n.push(n);
    for (const e of edges) if (segDist(cx, cy, e.a.x, e.a.y, e.b.x, e.b.y) < REACH) b.e.push(e);
    strips.forEach(s => { for (let i = 0; i < s.pts.length - 1; i++) if (segDist(cx, cy, s.pts[i][0], s.pts[i][1], s.pts[i + 1][0], s.pts[i + 1][1]) < REACH) b.s.push([s, i]); });
  }
  const bucket = (ux, uy) => bk[Math.max(0, Math.min(bh - 1, Math.floor(uy / BS))) * bw + Math.max(0, Math.min(bw - 1, Math.floor(ux / BS)))];
  const walk = (ux, uy) => {
    const b = bucket(ux, uy); let d = 99;
    for (const n of b.n) d = Math.min(d, Math.hypot(ux - n.x, uy - n.y) - n.r);
    for (const e of b.e) d = Math.min(d, segDist(ux, uy, e.a.x, e.a.y, e.b.x, e.b.y) - e.w / 2);
    return d;
  };
  const pathD = (ux, uy) => { let d = 99; for (const e of bucket(ux, uy).e) d = Math.min(d, segDist(ux, uy, e.a.x, e.a.y, e.b.x, e.b.y)); return d; };
  const nodeD = (ux, uy) => { let d = 99; for (const n of bucket(ux, uy).n) d = Math.min(d, Math.hypot(ux - n.x, uy - n.y)); return d; };
  const stripAt = (ux, uy, pad = 0) => {
    let best = null, bd = 99;
    for (const [s, i] of bucket(ux, uy).s) { const d = segDist(ux, uy, s.pts[i][0], s.pts[i][1], s.pts[i + 1][0], s.pts[i + 1][1]) - s.hw - pad; if (d < bd) { bd = d; best = s; } }
    return bd < 0 ? best : null;
  };
  // which land owns a point: nearest place, sampled coarsely and blurred by noise so borders wander
  const RS = 2, rw = wu * RS, rh = hu * RS, rgrid = new Uint8Array(rw * rh);
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    const ux = (x + 0.5) / RS, uy = (y + 0.5) / RS; let bd = 1e9, land = 0;
    for (const n of nodes) { const d = Math.hypot(ux - n.x, uy - n.y) - n.r; if (d < bd) { bd = d; land = n.land; } }
    rgrid[y * rw + x] = land;
  }
  const rg = (ux, uy) => rgrid[Math.max(0, Math.min(rh - 1, Math.floor(uy * RS))) * rw + Math.max(0, Math.min(rw - 1, Math.floor(ux * RS)))];
  const landAt = (ux, uy) => rg(ux + (vnoise(ux * 0.35, uy * 0.35, 71) - 0.5) * 5, uy + (vnoise(ux * 0.35, uy * 0.35, 72) - 0.5) * 5);

  const gates = GATES.map((g, k) => ({ ...g, tid: k, A: N[g.a], B: N[g.b], cells: [], open: false }));
  const hazard = [];
  for (let cy = 0; cy < T.h; cy++) for (let cx = 0; cx < T.w; cx++) {
    const ux = (cx + 0.5) / CPU, uy = (cy + 0.5) / CPU, i = cy * T.w + cx;
    const wd = walk(ux, uy);
    const land = wd < 0.6 ? rg(ux, uy) : landAt(ux, uy);
    const L = LANDS[land], m = L.mats, seed = L.seed;
    T.reg[i] = land;
    const st = stripAt(ux, uy, (fbm(ux * 1.3, uy * 1.3, 5) - 0.5) * 0.5);
    for (const g of gates) if (segDist(ux, uy, g.A.x, g.A.y, g.B.x, g.B.y) < 1.0 && (wd > -0.3 || st || stripAt(ux, uy, 0.6))) g.cells.push([cx, cy, Math.hypot(ux - g.A.x, uy - g.A.y)]);
    if (st) { paint(T, cx, cy, LANDS[st.land].mats.barrier, LANDS[st.land].seed, st.land); continue; }
    const d = wd + (fbm(ux * 0.8, uy * 0.8, seed) - 0.5) * 1.1 * L.rough;
    if (d >= 0) { paint(T, cx, cy, m.outside, seed, land); continue; }
    T.solid[i] = 0;
    const pd = pathD(ux, uy);
    if (pd < 0.42) paint(T, cx, cy, m.path, seed, land);
    else if (d > -0.5) paint(T, cx, cy, m.edge, seed, land);
    else if (m.field && pd > 0.7 && bucket(ux, uy).n.some(n => n.field && Math.hypot(ux - n.x, uy - n.y) - n.r < -0.4 + (fbm(ux, uy, 9) - 0.5))) paint(T, cx, cy, m.field, seed, land);
    else if (m.moss && pd > 0.55 && fbm(ux * 0.45, uy * 0.45, seed + 60) > 0.55) paint(T, cx, cy, m.moss, seed, land);
    else paint(T, cx, cy, m.floor, seed, land);
    if (land === 0) {
    } else if (land === 1) {
      if (d > -0.62 || (pd > 0.7 && fbm(ux * 0.7, uy * 0.7, seed + 40) > 0.7)) { T.put(cx, cy, '~', 16 + 8, 0.95, 1); T.tag[i] = 3; }
    } else if (land === 2) {
      if (pd > 0.95 && nodeD(ux, uy) > 2.3 && d < -0.5 && Math.abs(fbm(ux * 0.55, uy * 0.55, seed + 40) - 0.5) < 0.02) { paint(T, cx, cy, m.hazard, seed, land); T.tag[i] = 1; hazard.push([cx, cy]); }
    } else if (land === 3) {
      if (pd > 0.5 && fbm(ux * 0.4, uy * 0.4, seed + 40) > 0.6) { paint(T, cx, cy, m.ice, seed, land); T.tag[i] = 2; }
    }
  }
  for (const g of gates) g.cells.sort((a, b) => a[2] - b[2]);

  // mark walkable cells (high bit of the kind byte) so the map view can lift roads and places out of the dark
  const markWalk = () => { for (let i = 0; i < T.solid.length; i++) if (!T.solid[i]) T.data[i * 4 + 3] |= 128; };
  markWalk();

  // ---------- scenery
  const props = [], lamps = [];
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const TALL = new Set(['tree', 'pine', 'deadtree', 'wall', 'shelf', 'column', 'boulder', 'cypress']);
  const AR = N.AR;
  for (const g of gates) g.mid = [(g.A.x + g.B.x) / 2, (g.A.y + g.B.y) / 2];
  // "behind" means away from the camera: tall things there never hide the road
  const back = [-Math.sin(YAW), -Math.cos(YAW)], backA = Math.atan2(back[1], back[0]);
  const hides = (x, y) => [1.4, 2.6, 3.8, 5].some(t => walk(x + back[0] * t, y + back[1] * t) < 0.3);
  // buildings stand behind the places they belong to, facing them, with lit windows
  const sites = [];
  for (const n of nodes) {
    const build = LANDS[n.land].props.build;
    if (n.field || /g[AB]$|^s[AB]$|^eA$|^AR$/.test(n.id)) continue;
    for (let k = 0; k < (n.r > 2.4 ? 3 : 2); k++) for (let tries = 0; tries < 14; tries++) {
      const ang = backA + (R() - 0.5) * 3.4, d = n.r + 2.2 + R() * 3.4, x = n.x + Math.cos(ang) * d, y = n.y + Math.sin(ang) * d;
      if (x < 3 || y < 3 || x > wu - 3 || y > hu - 3 || walk(x, y) < 1.8 || stripAt(x, y, 2.2) || hides(x, y)) continue;
      if (sites.some(q => Math.hypot(q.x - x, q.y - y) < 3.9)) continue;
      const type = pick(build), face = Math.atan2(n.x - x, n.y - y);
      sites.push({ x, y }); props.push({ type, x, y, s: 0.95 + R() * 0.25, rot: face + (R() - 0.5) * 0.5, v: R(), build: true });
      lamps.push({ x: x + Math.sin(face) * 1.8, y: y + Math.cos(face) * 1.8, r: 3.4, col: LANDS[n.land].props.lampCol, int: 0.7, ph: R() * 6 });
      break;
    }
  }
  // things people leave around buildings: wells, crates, carts; signposts where roads meet
  const DETAIL = [['well', 'crates', 'cart', 'crates'], ['crates'], ['crates'], ['crates', 'cart'], []];
  for (const q of sites.slice()) {
    const land = T.regAt(q.x, q.y), list = DETAIL[land]; if (!list.length || R() < 0.3) continue;
    for (let tries = 0; tries < 6; tries++) {
      const a = R() * 6.283, x = q.x + Math.cos(a) * 2.6, y = q.y + Math.sin(a) * 2.6;
      if (walk(x, y) < 0.7 || stripAt(x, y, 1) || hides(x, y) || sites.some(o => o !== q && Math.hypot(o.x - x, o.y - y) < 2.4)) continue;
      sites.push({ x, y }); props.push({ type: pick(list), x, y, s: 0.9 + R() * 0.2, rot: R() * 6.28, v: R() }); break;
    }
  }
  for (const id of ['XS', 'N2', 'W1', 'E1', 'S1', 'S2']) { const n = N[id], a = backA + 0.9, x = n.x + Math.cos(a) * (n.r + 0.5), y = n.y + Math.sin(a) * (n.r + 0.5); if (walk(x, y) > 0.2) { sites.push({ x, y }); props.push({ type: 'sign', x, y, s: 1.1, rot: Math.atan2(n.x - x, n.y - y), v: R() }); } }
  for (let gy = 0.6; gy < hu; gy += 1.25) for (let gx = 0.6; gx < wu; gx += 1.25) {
    const x = gx + (R() - 0.5) * 0.9, y = gy + (R() - 0.5) * 0.9, d = walk(x, y), P = LANDS[T.regAt(x, y)].props;
    if (d < 0.55 || d > 4.6 || stripAt(x, y, 0.7) || R() > P.borderP * (1 - (d - 0.55) / 6)) continue;
    if (!T.isSolid(x, y) || gates.some(g => segDist(x, y, g.A.x, g.A.y, g.B.x, g.B.y) < 2.4) || sites.some(q => Math.hypot(q.x - x, q.y - y) < 2.8)) continue;
    let type = pick(P.border);
    if (TALL.has(type) && hides(x, y)) type = pick(P.low);
    props.push({ type, x, y, s: 0.75 + R() * 0.45, rot: R() * 6.28, v: R() });
  }
  for (let gy = 1; gy < hu; gy += 2.3) for (let gx = 1; gx < wu; gx += 2.3) {
    const x = gx + (R() - 0.5) * 1.6, y = gy + (R() - 0.5) * 1.6, P = LANDS[T.regAt(x, y)].props;
    if (walk(x, y) > -1.35 || pathD(x, y) < 1.15 || nodeD(x, y) < 1.9 || stripAt(x, y, 1.2) || R() > P.innerP) continue;
    if (T.blocked(x, y, 0.5) || Math.hypot(x - AR.x, y - AR.y) < AR.r + 0.5) continue;
    const inField = T.regAt(x, y) === 0 && nodes.some(n => n.field && Math.hypot(x - n.x, y - n.y) < n.r - 0.8);
    const type = inField ? 'hay' : pick(P.inner), big = type === 'shelf' || type === 'boulder' || type === 'column' || type === 'hay';
    props.push({ type, x, y, s: 0.75 + R() * 0.45, rot: R() * 6.28, v: R() });
    T.solidCircle(x, y, big ? 0.5 : 0.36);
  }
  const far = (x, y, min) => lamps.every(p => Math.hypot(p.x - x, p.y - y) > min);
  const addLamp = (x, y) => {
    if (T.blocked(x, y, 0.25) || !far(x, y, 1.6)) return;
    const P = LANDS[T.regAt(x, y)].props;
    props.push({ type: P.lamp, x, y, s: 1, rot: 0, v: R(), lamp: true });
    lamps.push({ x, y, r: 3.6, col: P.lampCol, int: 0.9, ph: R() * 6 });   // lamp posts do not block the road
  };
  for (const e of edges) {
    const { a, b } = e, len = Math.hypot(b.x - a.x, b.y - a.y), nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    let side = R() < 0.5 ? 1 : -1;
    for (let s = 3.2; s < len - 2.5; s += 6.5) { const t = s / len; side = -side; addLamp(a.x + (b.x - a.x) * t + nx * side * (e.w / 2 - 0.4), a.y + (b.y - a.y) * t + ny * side * (e.w / 2 - 0.4)); }
  }
  for (const e of edges) {
    if (!/^[SWNEX]/.test(e.a.id) && !/^[SWNEX]/.test(e.b.id)) continue;
    if (e.a.land === 1 || e.a.land === 4) continue;
    const { a, b } = e, len = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    for (let t = 2.6; t < len - 2.6; t += 1.6) for (const sd of [-1, 1]) {
      const x = a.x + ux * t - uy * sd * (e.w / 2 + 0.75), y = a.y + uy * t + ux * sd * (e.w / 2 + 0.75);
      if (walk(x, y) < 0.35 || stripAt(x, y, 0.4) || R() < 0.12) continue;
      props.push({ type: 'fence', x, y, s: 1, rot: Math.atan2(ux, uy), v: R() });
    }
  }
  for (const g of gates) {
    const dx = g.B.x - g.A.x, dy = g.B.y - g.A.y, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    for (const [n, sg] of [[g.A, 1], [g.B, -1]]) for (const s of [-1, 1]) addLamp(n.x + ux * sg * 0.2 - uy * s * 1.35, n.y + uy * sg * 0.2 + ux * s * 1.35);
  }
  // barrier dressing: flames on the red ink, spikes on the ice. The ones at the crossing vanish with the word.
  for (const [si, type, step, gi] of [[2, 'flame', 1.5, 2], [3, 'spike', 0.9, 3]]) {
    const s = strips[si], g = gates[gi];
    for (let i = 0; i < s.pts.length - 1; i++) {
      const [ax, ay] = s.pts[i], [bx, by] = s.pts[i + 1], len = Math.hypot(bx - ax, by - ay);
      for (let t = 0; t < len; t += step) {
        const x = ax + (bx - ax) * t / len + (R() - 0.5) * s.hw * 1.3, y = ay + (by - ay) * t / len + (R() - 0.5) * s.hw * 1.3;
        if (x < 1 || y < 1 || x > wu - 1 || y > hu - 1) continue;
        props.push({ type, x, y, s: (type === 'spike' ? 1.2 : 0.9) + R() * 0.8, rot: R() * 6, v: R(), barrier: Math.hypot(x - g.mid[0], y - g.mid[1]) < 2.6 ? gi : undefined });
      }
    }
  }

  const letters = LETTERS.map(([land, at, guards], k) => ({ land, x: N[at].x, y: N[at].y, guards, id: k }));
  LANDS.forEach((L, li) => letters.filter(l => l.land === li).forEach((l, k) => { l.ch = L.word[k]; }));
  const goals = [N.ML, N.DL, N.CL, N.PL, N.AR];
  const core = { 0: 'M', 1: 'D', 2: 'C', 3: 'P', 4: 'B' };
  const centers = LANDS.map((_, li) => { const ns = nodes.filter(n => n.land === li && n.id[0] === core[li] && n.id.length === 2); return { x: ns.reduce((s, n) => s + n.x, 0) / ns.length, y: ns.reduce((s, n) => s + n.y, 0) / ns.length }; });
  return {
    T, N, nodes, edges, gates, props, lamps, letters, hazard, goals, centers, walk,
    start: N.M0, roam: ROAM.map(([x, y, type]) => ({ x, y, type })), hearts: HEARTS.map(([x, y]) => ({ x, y })),
    paintGate(g, cx, cy) { const L = LANDS[g.land]; paint(T, cx, cy, L.mats.bridge, L.seed, g.land, g.tid); const i = cy * T.w + cx; T.solid[i] = 0; T.tag[i] = 0; T.data[i * 4 + 3] |= 128; },
    coolHazard() { const L = LANDS[2]; for (const [cx, cy] of hazard) { paint(T, cx, cy, L.mats.cooled, L.seed, 2); T.tag[cy * T.w + cx] = 0; T.data[(cy * T.w + cx) * 4 + 3] |= 128; } },
    // a lit lantern makes its whole land easier to read
    brighten(land) { const d = T.data, r = T.reg; for (let i = 0; i < r.length; i++) if (r[i] === land) d[i * 4 + 2] = Math.min(255, d[i * 4 + 2] * 1.5 + 12); },
  };
}
