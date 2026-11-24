// UNWRITTEN — ASCII renderer.
// The camera is isometric (turned and tilted). Three low-resolution passes of the real 3D scene
// (shadows, water reflections, the scene itself) are redrawn as glyphs; the ground is read from a
// terrain texture through the same camera, so the glyph grid stays glued to the world while it scrolls.
import * as THREE from '../lib/three.module.min.js';
import { CPU, YAW, PITCH } from './terrain.js';
import { shared, makeMeshAtlas, gmat } from './glyph.js';
export { CPU, YAW, PITCH };

export const SINP = Math.sin(PITCH), COSP = Math.cos(PITCH), SY = Math.sin(YAW), CY = Math.cos(YAW);
export const MAX_LIGHTS = 14, MAX_ERASE = 16, MAX_PULSE = 8;
// world ground (x, z) <-> the screen plane, in world units
export const toPlane = (x, z, h = 0) => [x * CY - z * SY, (x * SY + z * CY) * SINP - h * COSP];
export const fromPlane = (px, py) => { const b = py / SINP; return [px * CY + b * SY, -px * SY + b * CY]; };
const SHADOW = [0.8, -0.28];         // where one unit of height throws its shadow on the ground

const FONT = '"JetBrains Mono", "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace';
const RAMP = " .':;~=+czsoaeZSG#@";

function makeAtlas(gw, gh, weight) {
  const cols = 16, rows = 6;
  const c = document.createElement('canvas');
  c.width = cols * gw; c.height = rows * gh;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  const px = Math.floor(gh * 0.86);
  x.font = `${weight} ${px}px ${FONT}`;
  for (let i = 0; i < 95; i++) {
    const ch = String.fromCharCode(32 + i);
    const cx = (i % cols) * gw + gw / 2, cy = Math.floor(i / cols) * gh + gh * 0.76;
    x.save(); x.beginPath(); x.rect((i % cols) * gw, Math.floor(i / cols) * gh, gw, gh); x.clip();
    x.fillText(ch, cx, cy); x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const f = (n) => n.toFixed(6);

const FRAG = `
precision highp float;
uniform sampler2D tRefl, tShadow, tTerrain, tText, tAtlasF, tAtlasC;
uniform vec2 uRes, uOrigin, uFine, uObj0, uObjSize, uTerSize, uPlayer;
uniform float uU, uG, uTime, uSeed, uMap;
uniform vec4 uScar[4];
uniform vec3 uPal[80];
uniform float uTextLen[8];
uniform vec4 uLights[${MAX_LIGHTS}];
uniform vec3 uLightCol[${MAX_LIGHTS}];
uniform vec3 uErase[${MAX_ERASE}];
uniform vec4 uPulse[${MAX_PULSE}];
uniform vec3 uPulseCol[${MAX_PULSE}];
uniform vec4 uLine[4];
uniform vec3 uAmbient, uBg;
const int RN = ${RAMP.length};
const int RAMP[${RAMP.length}] = int[](${[...RAMP].map(c => c.charCodeAt(0) - 32).join(',')});
const vec2 INVX = vec2(${f(CY)}, ${f(SY / SINP)});
const vec2 INVZ = vec2(${f(-SY)}, ${f(CY / SINP)});
const float CPUF = ${f(CPU)};

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float glyph(sampler2D atlas, float code, vec2 g){
  if (g.x < 0.0 || g.x > 1.0 || g.y < 0.0 || g.y > 1.0) return 0.0;
  float c = mod(code, 16.0), r = floor(code / 16.0);
  vec2 uv = vec2((c + clamp(g.x, 0.04, 0.96)) / 16.0, 1.0 - (r + clamp(g.y, 0.03, 0.97)) / 6.0);
  return texture(atlas, uv).r;
}
float ch(int c){ return float(c - 32); }
vec2 ground(vec2 planePx){ vec2 p = planePx / uU; return vec2(dot(INVX, p), dot(INVZ, p)); }
vec3 lightAt(vec2 p){
  vec3 L = uAmbient;
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    vec4 l = uLights[i];
    if (l.w <= 0.0) continue;
    float a = max(0.0, 1.0 - length(p - l.xy) / l.z);
    L += uLightCol[i] * l.w * a * a;
  }
  return L;
}
vec4 terrain(vec2 w){
  vec2 c = floor(w * CPUF);
  if (c.x < 0.0 || c.y < 0.0 || c.x >= uTerSize.x || c.y >= uTerSize.y) return vec4(0.0);
  return texelFetch(tTerrain, ivec2(c), 0);
}

void main(){
  vec2 sp = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 wp = uOrigin + sp;
  vec2 fcell = floor(wp / uFine), fuv = fract(wp / uFine);
  ivec2 oi = ivec2(fcell - uObj0);
  int rows = int(uObjSize.y);

  // ---- ground glyph cell and the spot of world under it
  vec2 gc = floor(wp / uG), cuv = fract(wp / uG);
  vec2 gpx = (gc + 0.5) * uG;
  vec2 w = ground(gpx);
  float hc = hash(gc + uSeed), hc2 = hash(gc + uSeed + 17.3);
  vec4 t = terrain(w);
  float cellW = uG / uU;
  if (cellW > 0.22 && t.a < 0.5) {    // far away: if any part of the cell is road, show road
    for (int k = 0; k < 4; k++) {
      vec4 t2 = terrain(ground(gpx + uG * vec2(k == 0 || k == 2 ? -0.3 : 0.3, k < 2 ? -0.3 : 0.3)));
      if (t2.a >= 0.5) { t = t2; break; }
    }
  }
  float code = floor(t.r * 255.0 + 0.5);
  int pal = int(t.g * 255.0 + 0.5);
  float bri = t.b * 1.6;
  int kind = int(t.a * 255.0 + 0.5);
  bool walkable = kind >= 128;
  if (walkable) kind -= 128;
  vec3 col = uPal[pal];
  int lp = (pal / 16) * 16;
  bri *= walkable ? 1.0 + uMap * 0.9 : 1.0 - uMap * 0.2;

  // ---- wind: gusts cross the world as bands
  float gust = sin(dot(w, vec2(0.52, 0.3)) - uTime * 1.7 + sin(w.y * 0.31 + w.x * 0.11 + uTime * 0.29) * 1.5);
  if (kind == 1) {            // water
    float wv = sin(uTime * 1.25 + w.x * 4.0 + sin(w.y * 5.6 + uTime * 0.35) * 1.6 + hc * 1.2);
    code = wv > 0.55 ? ch(126) : (wv > -0.15 ? ch(45) : (hc > 0.6 ? ch(95) : ch(32)));
    bri *= 0.6 + 0.45 * (wv * 0.5 + 0.5);
    if (wv > 0.86) col = uPal[lp + 6];
  } else if (kind == 2 || kind == 8) {     // grass and standing crops lean with the gusts
    float lean = gust + (hc - 0.5) * (kind == 8 ? 0.5 : 1.0);
    if (kind == 8) { code = lean > 0.4 ? ch(47) : (lean < -0.65 ? ch(92) : (hc2 > 0.5 ? ch(124) : ch(33))); bri *= 0.78 + 0.5 * smoothstep(0.1, 1.0, gust); }
    else { if (lean > 0.7) code = ch(47); else if (lean < -0.85) code = ch(92); bri *= 0.9 + 0.3 * smoothstep(0.2, 1.0, gust); }
    float pd = length(w - uPlayer);
    if (pd < 0.8) { code = w.x < uPlayer.x ? ch(92) : ch(47); if (pd < 0.45) code = ch(95); bri *= 1.2; }
  } else if (kind == 3) {     // lava / embers
    float fl = sin(uTime * 2.6 + hc * 6.28 + w.x * 3.2) * 0.5 + 0.5;
    code = fl > 0.7 ? ch(94) : (fl > 0.35 ? ch(126) : ch(42));
    bri *= 0.65 + 0.6 * fl;
  } else if (kind == 4) {     // snow glitter
    if (fract(hc + uTime * 0.21 + hc2) > 0.985) { code = ch(42); bri = 1.6; col = uPal[lp + 13]; }
  } else if (kind == 5) {     // glowing writing
    bri *= 0.75 + 0.35 * sin(uTime * 2.0 + gc.x * 0.25 + gc.y * 0.1);
  } else if (kind == 6) {     // void static: glyphs flicker in and out
    float fl = fract(hc + floor(uTime * 3.0 + hc2 * 5.0) * 0.173);
    if (fl > 0.35) code = ch(32); else code = ch(46 + int(fl * 30.0));
  } else if (kind == 7) {     // written words: read left to right on screen
    int id = int(code);
    float k = mod(gc.x + gc.y * 3.0, uTextLen[id]);
    code = floor(texelFetch(tText, ivec2(int(k), id), 0).r * 255.0 + 0.5);
    bri *= 0.8 + 0.3 * sin(uTime * 2.0 + gc.x * 0.25 + gc.y * 0.1);
  }
  if (uMap > 0.3 && code == 0.0 && t.g > 0.0) code = walkable ? ch(43) : ch(46);

  vec3 L = lightAt(w);
  vec3 pulse = vec3(0.0);
  for (int i = 0; i < ${MAX_PULSE}; i++) {
    vec4 p = uPulse[i];
    if (p.w <= 0.0) continue;
    float band = 1.0 - smoothstep(0.0, 0.28, abs(length(w - p.xy) - p.z));
    if (band > 0.0) { pulse += uPulseCol[i] * band * p.w; if (band > 0.5 && hc > 0.3) code = hc2 > 0.5 ? ch(42) : ch(43); }
  }
  for (int i = 0; i < 4; i++) {   // the Editor's strike-through
    vec4 l = uLine[i];
    if (l.w <= 0.0) continue;
    float dl = l.y < 0.5 ? abs(w.y - l.x) : abs(w.x - l.x);
    if (dl < l.z) { pulse += mix(vec3(1.0, 0.12, 0.22), vec3(1.0), clamp(l.w - 1.0, 0.0, 1.0)) * min(l.w, 1.6) * (0.45 + 0.55 * hc); code = l.y < 0.5 ? ch(61) : ch(35); }
  }
  for (int i = 0; i < 4; i++) {   // the quill leaves a mark where it cut
    vec4 sc = uScar[i];
    if (sc.w <= 0.0) continue;
    vec2 dv = w - sc.xy; float dr = length(dv);
    float da = abs(mod(atan(dv.y, dv.x) - sc.z + 3.14159, 6.28318) - 3.14159);
    if (dr > 0.7 && dr < 2.1 && (da < 1.15 || sc.z > 50.0) && hc > 0.25) { pulse += vec3(1.0, 0.45, 0.72) * sc.w * (0.5 + 0.5 * hc2); code = hc2 > 0.6 ? ch(120) : (hc2 > 0.3 ? ch(61) : ch(126)); }
  }
  float erased = 0.0;
  for (int i = 0; i < ${MAX_ERASE}; i++) {
    vec3 e = uErase[i];
    if (e.z <= 0.0) continue;
    if (length(w - e.xy) < e.z * (0.72 + 0.45 * hash(gc + floor(uTime * 5.0)))) erased = 1.0;
  }
  // shadows thrown by everything standing on the page
  ivec2 si = ivec2(floor(gpx / uFine) - uObj0);
  float shade = texelFetch(tShadow, ivec2(si.x, rows - 1 - si.y), 0).a;
  vec3 lit = col * bri * L * (1.0 - 0.62 * shade) + pulse;
  float lum = max(lit.r, max(lit.g, lit.b));
  if (kind != 6 && code != 0.0 && pulse == vec3(0.0)) {
    if (lum < 0.03) code = 0.0;
    else if (lum < 0.07 && hc > 0.45) code = ch(46);
  }
  vec2 g = (cuv - vec2(0.12, 0.03)) / vec2(0.76, 0.94);
  float gm = glyph(tAtlasC, code, g) * (1.0 - erased);
  vec3 outc = uBg + lit * gm;

  // ---- reflections of standing things in water
  if (kind == 1) {
    int wob = int(floor(sin(fcell.y * 0.8 + uTime * 2.4) * 1.3 + 0.5));
    vec4 rf = texelFetch(tRefl, ivec2(oi.x + wob, rows - 1 - oi.y), 0);
    if (rf.a > 0.5) {
      float rl = max(rf.r, max(rf.g, rf.b));
      int idx = int(clamp(pow(rl, 0.7) * float(RN) * 0.8, 1.0, float(RN - 1)));
      float m = glyph(tAtlasF, float(RAMP[idx]), fuv);
      outc = uBg + mix(uPal[lp + 5], rf.rgb / max(rl, 0.001), 0.45) * (0.2 + 0.5 * rl) * m;
    }
  }

  gl_FragColor = vec4(outc, 1.0);
}`;

const OVER = `
precision highp float;
uniform sampler2D tAtlasF;
uniform vec2 uRes, uOrigin, uFine;
uniform float uG, uTime, uReveal, uFlash, uWeatherAmt, uDark;
uniform int uWeather;
uniform vec3 uWeatherCol, uBg;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float glyph(float code, vec2 g){
  float c = mod(code, 16.0), r = floor(code / 16.0);
  return texture(tAtlasF, vec2((c + clamp(g.x, 0.04, 0.96)) / 16.0, 1.0 - (r + clamp(g.y, 0.03, 0.97)) / 6.0)).r;
}
void main(){
  vec2 sp = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 sc = floor(sp / uFine), fuv = fract(sp / uFine);
  vec3 add = vec3(0.0);
  if (uWeather == 1) {
    float h = hash(vec2(sc.x + floor(sc.y * 0.34), 7.0));
    if (h < uWeatherAmt) { float seg = mod(sc.y - uTime * (34.0 + h * 30.0) + h * 400.0, 46.0 + h * 50.0); if (seg < 4.0) add = uWeatherCol * (0.25 + seg * 0.14) * glyph(15.0, fuv); }
  } else if (uWeather == 2) {
    float drift = floor(sin(sc.y * 0.07 + uTime * 0.6 + hash(vec2(sc.x, 1.0)) * 6.0) * 2.0);
    float h = hash(vec2(sc.x + drift, 3.0));
    if (h < uWeatherAmt) { float seg = mod(sc.y - uTime * (7.0 + h * 9.0) + h * 300.0, 30.0 + h * 40.0); if (seg < 1.0) add = uWeatherCol * (0.5 + 0.5 * h) * glyph(h > uWeatherAmt * 0.5 ? 10.0 : 14.0, fuv); }
  } else if (uWeather == 3) {
    float drift = floor(sin(sc.y * 0.09 + uTime * 0.8 + hash(vec2(sc.x, 2.0)) * 6.0) * 2.0);
    float h = hash(vec2(sc.x + drift, 5.0));
    if (h < uWeatherAmt) { float seg = mod(sc.y + uTime * (5.0 + h * 8.0) + h * 300.0, 34.0 + h * 40.0); if (seg < 1.0) add = uWeatherCol * (0.4 + 0.6 * h) * glyph(h > uWeatherAmt * 0.5 ? 7.0 : 14.0, fuv); }
  }
  vec2 q = sp / uRes - 0.5;
  float dark = clamp(dot(q, q) * (0.8 + uDark), 0.0, 1.0);
  add += vec3(0.6, 0.04, 0.1) * uFlash * (0.04 + dot(q, q) * 1.5);
  vec2 gc = floor((uOrigin + sp) / uG);
  if (hash(gc * 1.37 + 3.1) > uReveal) { add = uBg * 0.5; dark = 1.0; }
  gl_FragColor = vec4(add, dark);
}`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.r.setPixelRatio(1);
    this.scene = new THREE.Scene();
    this.root = new THREE.Group();          // everything standing on the page; re-posed for shadows and reflections
    this.root.matrixAutoUpdate = false;
    this.scene.add(this.root);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 600);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.moon = new THREE.DirectionalLight(0xffffff, 1.0);
    this.moon.position.set(-SHADOW[0], 1.0, -SHADOW[1]).add(new THREE.Vector3(0, 0, 0.35));
    this.scene.add(this.ambient, this.moon);
    this.ambient.layers.enableAll(); this.moon.layers.enableAll();
    this.points = [];
    for (let i = 0; i < 4; i++) { const p = new THREE.PointLight(0xffffff, 0, 9, 1.4); p.layers.enableAll(); this.points.push(p); this.scene.add(p); }
    this.fsScene = new THREE.Scene();
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const U = (v) => ({ value: v });
    this.u = {
      tRefl: U(null), tShadow: U(null), tTerrain: U(null), tText: U(null), tAtlasF: U(null), tAtlasC: U(null),
      uRes: U(new THREE.Vector2()), uOrigin: U(new THREE.Vector2()), uFine: U(new THREE.Vector2()),
      uObj0: U(new THREE.Vector2()), uObjSize: U(new THREE.Vector2()), uTerSize: U(new THREE.Vector2()), uPlayer: U(new THREE.Vector2()),
      uU: U(1), uG: U(1), uTime: U(0), uReveal: U(1), uFlash: U(0), uWeatherAmt: U(0), uDark: U(0), uSeed: U(0), uMap: U(0),
      uWeather: U(0),
      uScar: U(Array.from({ length: 4 }, () => new THREE.Vector4())),
      uPal: U(Array.from({ length: 80 }, () => new THREE.Vector3(1, 1, 1))),
      uTextLen: U(new Array(8).fill(1)),
      uLights: U(Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4())),
      uLightCol: U(Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3())),
      uErase: U(Array.from({ length: MAX_ERASE }, () => new THREE.Vector3())),
      uPulse: U(Array.from({ length: MAX_PULSE }, () => new THREE.Vector4())),
      uPulseCol: U(Array.from({ length: MAX_PULSE }, () => new THREE.Vector3())),
      uLine: U(Array.from({ length: 4 }, () => new THREE.Vector4())),
      uAmbient: U(new THREE.Vector3(0.3, 0.3, 0.3)), uBg: U(new THREE.Vector3(0.01, 0.012, 0.03)), uWeatherCol: U(new THREE.Vector3(1, 1, 1)),
    };
    this.mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false });
    this.fsScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    const ou = this.u;
    this.over = new THREE.ShaderMaterial({ uniforms: { tAtlasF: ou.tAtlasF, uRes: ou.uRes, uOrigin: ou.uOrigin, uFine: ou.uFine, uG: ou.uG, uTime: ou.uTime, uReveal: ou.uReveal, uFlash: ou.uFlash, uWeatherAmt: ou.uWeatherAmt, uDark: ou.uDark, uWeather: ou.uWeather, uWeatherCol: ou.uWeatherCol, uBg: ou.uBg },
      vertexShader: VERT, fragmentShader: OVER, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
    this.overScene = new THREE.Scene(); this.overScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.over));
    makeMeshAtlas(FONT);
    this.flat = new THREE.MeshBasicMaterial({ color: 0xd8d0ff });
    this.terrainTex = null; this.ox = 0; this.oy = 0;
    this.xray = gmat(0xb8a8ff, 'xray', { glow: true, depthFunc: THREE.GreaterDepth });
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(320, Math.floor(innerWidth * dpr)), H = Math.max(320, Math.floor(innerHeight * dpr));
    this.W = W; this.H = H; this.dpr = dpr;
    this.r.setSize(W, H, false);
    this.canvas.style.width = innerWidth + 'px'; this.canvas.style.height = innerHeight + 'px';
    this.U0 = Math.max(40, Math.min(W / 7.4, H / 6.6));
    this.fw = Math.max(5.2, this.U0 / 23); this.fh = this.fw * 1.5;       // weather glyphs, and the grain of the shadow and reflection buffers
    this.G0 = this.fw * 2.1;                               // ground glyphs at zoom 1
    this.cols = Math.ceil(W / this.fw) + 2; this.rows = Math.ceil(H / this.fh) + 2;
    const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, type: THREE.UnsignedByteType };
    for (const k of ['rtRefl', 'rtShadow']) { if (this[k]) this[k].dispose(); this[k] = new THREE.WebGLRenderTarget(this.cols, this.rows, opts); }
    if (this.atlasF) { this.atlasF.dispose(); this.atlasC.dispose(); }
    this.atlasF = makeAtlas(Math.max(6, Math.round(this.fw * 2)), Math.max(9, Math.round(this.fh * 2)), 800);
    this.atlasC = makeAtlas(Math.max(8, Math.round(this.G0 * 0.76 * 2.4)), Math.max(12, Math.round(this.G0 * 0.94 * 2.4)), 800);
    const u = this.u;
    u.tRefl.value = this.rtRefl.texture; u.tShadow.value = this.rtShadow.texture;
    u.tAtlasF.value = this.atlasF; u.tAtlasC.value = this.atlasC;
    u.uRes.value.set(W, H); u.uFine.value.set(this.fw, this.fh); u.uObjSize.value.set(this.cols, this.rows);
    this.setZoom(this.zoom || 1);
  }

  // zoom < 1 shows more world. Ground glyphs shrink with the world until they would be unreadable,
  // then each glyph starts to stand for a larger patch of ground.
  setZoom(z) {
    this.zoom = z; this.U = this.U0 * z;
    this.step = Math.max(1, Math.ceil(0.5 / z));      // far away the ground letters get small, then merge
    this.G = this.G0 * z * this.step;
  }

  setTerrain(terrain) {
    if (this.terrainTex) this.terrainTex.dispose();
    const t = new THREE.DataTexture(terrain.data, terrain.w, terrain.h, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = false;
    t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
    this.terrainTex = t;
    this.u.tTerrain.value = t; this.u.uTerSize.value.set(terrain.w, terrain.h);
  }
  touchTerrain() { if (this.terrainTex) this.terrainTex.needsUpdate = true; }
  setPalette(hexes) {
    hexes.forEach((h, i) => { const n = parseInt(h.slice(1), 16); this.u.uPal.value[i].set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); });
  }
  // the sentences that can be written on the ground, one per row
  setTexts(texts) {
    const w = 96, data = new Uint8Array(w * 8 * 4);
    texts.forEach((s, r) => { for (let i = 0; i < s.length && i < w; i++) data[(r * w + i) * 4] = s.charCodeAt(i) - 32; this.u.uTextLen.value[r] = Math.min(w, s.length); });
    const t = new THREE.DataTexture(data, w, 8, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
    this.u.tText.value = t;
  }

  // world -> css pixel, and css pixel -> world ground
  toScreen(x, y, h = 0) { const [px, py] = toPlane(x, y, h); return [(px * this.U - this.ox) / this.dpr, (py * this.U - this.oy) / this.dpr]; }
  toWorld(px, py) { return fromPlane((px * this.dpr + this.ox) / this.U, (py * this.dpr + this.oy) / this.U); }

  render(cx, cy, time, shakeX = 0, shakeY = 0) {
    const u = this.u, U = this.U, [scx, scy] = toPlane(cx, cy);
    const ox = this.ox = Math.round(scx * U - this.W / 2 + shakeX), oy = this.oy = Math.round(scy * U - this.H / 2 + shakeY);
    u.uOrigin.value.set(ox, oy); u.uTime.value = time; u.uU.value = U; u.uG.value = this.G; u.uSeed.value = this.step * 7.13;
    const i0 = Math.floor(ox / this.fw), j0 = Math.floor(oy / this.fh);
    u.uObj0.value.set(i0, j0);
    const cam = this.cam;
    cam.left = (i0 * this.fw - scx * U) / U; cam.right = cam.left + this.cols * this.fw / U;
    cam.top = -(j0 * this.fh - scy * U) / U; cam.bottom = cam.top - this.rows * this.fh / U;
    cam.updateProjectionMatrix();
    cam.position.set(cx + SY * COSP * 200, SINP * 200, cy + CY * COSP * 200);
    cam.lookAt(cx, 0, cy);
    shared.uTime.value = time;
    const r = this.r, root = this.root, scene = this.scene;
    r.setClearColor(0x000000, 0);
    // 1. shadows: the scene flattened onto the ground along the light, low resolution
    scene.overrideMaterial = this.flat;
    root.matrix.set(1, SHADOW[0], 0, 0, 0, 0.002, 0, 0.01, 0, SHADOW[1], 1, 0, 0, 0, 0, 1); root.updateMatrixWorld(true);
    cam.layers.set(0); cam.layers.enable(3);
    r.setRenderTarget(this.rtShadow); r.clear(); r.render(scene, cam);
    // 2. reflections: the scene upside down, low resolution
    root.matrix.set(1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1); root.updateMatrixWorld(true);
    r.setRenderTarget(this.rtRefl); r.clear(); r.render(scene, cam);
    scene.overrideMaterial = null;
    root.matrix.identity(); root.updateMatrixWorld(true);
    // 3. to the screen: the ground, then everything standing on it at full resolution, each surface in its own letters
    const l = (ox - scx * U) / U, t = -(oy - scy * U) / U;
    cam.left = l; cam.right = l + this.W / U; cam.top = t; cam.bottom = t - this.H / U; cam.updateProjectionMatrix();
    r.setRenderTarget(null); r.setClearColor(0x000000, 1); r.clear();
    r.autoClear = false;
    r.render(this.fsScene, this.fsCam);
    cam.layers.set(1); r.render(scene, cam); r.clearDepth();           // the Editor first, depth thrown away: it never hides anything
    cam.layers.set(0); cam.layers.enable(2); r.render(scene, cam);
    cam.layers.set(3); scene.overrideMaterial = this.xray; r.render(scene, cam); scene.overrideMaterial = null;   // the hero's outline through walls
    r.render(scene, cam);                                               // then the hero
    r.render(this.overScene, this.fsCam);
    r.autoClear = true;
  }
}
