// UNWRITTEN — ASCII renderer.
// Ground: a world-anchored grid of large glyphs read from a terrain texture.
// Objects: real 3D meshes rendered small, then redrawn as fine glyphs by brightness.
import * as THREE from '../lib/three.module.min.js';

export const PITCH = 50 * Math.PI / 180;
export const SIN = Math.sin(PITCH), COS = Math.cos(PITCH);
export const CPU = 8;               // coarse ground cells per world unit
export const MAX_LIGHTS = 14, MAX_ERASE = 16, MAX_PULSE = 8;

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

const FRAG = `
precision highp float;
uniform sampler2D tObj, tRefl, tTerrain, tAtlasF, tAtlasC;
uniform vec2 uRes, uOrigin, uFine, uObj0, uObjSize, uTerSize, uPlayer;
uniform float uU, uC, uTime, uReveal, uFlash, uWeatherAmt, uHasWater, uDark, uBloom;
uniform int uWeather;
uniform vec3 uPal[16];
uniform vec4 uLights[${MAX_LIGHTS}];
uniform vec3 uLightCol[${MAX_LIGHTS}];
uniform vec3 uErase[${MAX_ERASE}];
uniform vec4 uPulse[${MAX_PULSE}];
uniform vec3 uPulseCol[${MAX_PULSE}];
uniform vec4 uLine[4];
uniform vec3 uAmbient, uBg, uWeatherCol;
const int RN = ${RAMP.length};
const int RAMP[${RAMP.length}] = int[](${[...RAMP].map(c => c.charCodeAt(0) - 32).join(',')});

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

float glyph(sampler2D atlas, float code, vec2 g){
  if (g.x < 0.0 || g.x > 1.0 || g.y < 0.0 || g.y > 1.0) return 0.0;
  float c = mod(code, 16.0), r = floor(code / 16.0);
  vec2 uv = vec2((c + clamp(g.x, 0.04, 0.96)) / 16.0, 1.0 - (r + clamp(g.y, 0.03, 0.97)) / 6.0);
  return texture(atlas, uv).r;
}
float ch(int c){ return float(c - 32); }
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

void main(){
  vec2 sp = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 wp = uOrigin + sp;
  vec2 fcell = floor(wp / uFine), fuv = fract(wp / uFine);
  ivec2 oi = ivec2(fcell - uObj0);
  int rows = int(uObjSize.y);
  vec4 obj = texelFetch(tObj, ivec2(oi.x, rows - 1 - oi.y), 0);

  vec2 cc = floor(wp / uC), cuv = fract(wp / uC);
  vec2 ccu = (cc + 0.5) * uC / uU;
  float hc = hash(cc), hc2 = hash(cc + 17.3);
  bool inb = cc.x >= 0.0 && cc.y >= 0.0 && cc.x < uTerSize.x && cc.y < uTerSize.y;
  vec4 t = inb ? texelFetch(tTerrain, ivec2(cc), 0) : vec4(0.0);
  float code = floor(t.r * 255.0 + 0.5);
  int pal = int(t.g * 255.0 + 0.5);
  float bri = t.b * 1.6;
  int kind = int(t.a * 255.0 + 0.5);
  vec3 col = uPal[pal];

  // ---- animated ground kinds
  if (kind == 1) {            // water
    float w = sin(uTime * 1.25 + cc.x * 0.5 + sin(cc.y * 0.7 + uTime * 0.35) * 1.6 + hc * 1.2);
    code = w > 0.55 ? ch(126) : (w > -0.15 ? ch(45) : (hc > 0.6 ? ch(95) : ch(32)));
    bri *= 0.55 + 0.45 * (w * 0.5 + 0.5);
    if (w > 0.86) col = uPal[6];
  } else if (kind == 2) {     // grass that sways and bends away from the player
    float wind = sin(uTime * 1.7 + cc.x * 0.33 + cc.y * 0.21 + hc * 2.0);
    if (wind > 0.72) code = ch(47); else if (wind < -0.78) code = ch(92);
    float pd = length(ccu - uPlayer);
    if (pd < 0.75) { code = ccu.x < uPlayer.x ? ch(92) : ch(47); if (pd < 0.42) code = ch(95); bri *= 1.25; }
  } else if (kind == 3) {     // lava / embers
    float f = sin(uTime * 2.6 + hc * 6.28 + cc.x * 0.4) * 0.5 + 0.5;
    code = f > 0.7 ? ch(94) : (f > 0.35 ? ch(126) : ch(42));
    bri *= 0.65 + 0.6 * f;
  } else if (kind == 4) {     // snow glitter
    float s = step(0.985, fract(hc + uTime * 0.21 + hc2));
    if (s > 0.5) { code = ch(42); bri = 1.6; col = uPal[13]; }
  } else if (kind == 5) {     // glowing writing
    bri *= 0.75 + 0.35 * sin(uTime * 2.0 + cc.x * 0.25 + cc.y * 0.1);
  } else if (kind == 6) {     // void static: glyphs flicker in and out
    float f = fract(hc + floor(uTime * 3.0 + hc2 * 5.0) * 0.173);
    if (f > 0.35) code = ch(32); else code = ch(46 + int(f * 30.0));
  }

  // ---- light
  vec3 L = lightAt(ccu);
  // ---- pulses (rings travelling over the glyph grid)
  vec3 pulse = vec3(0.0);
  for (int i = 0; i < ${MAX_PULSE}; i++) {
    vec4 p = uPulse[i];
    if (p.w <= 0.0) continue;
    float d = length(ccu - p.xy);
    float band = 1.0 - smoothstep(0.0, 0.28, abs(d - p.z));
    if (band > 0.0) { pulse += uPulseCol[i] * band * p.w; if (band > 0.5 && hc > 0.3) code = hc2 > 0.5 ? ch(42) : ch(43); }
  }
  // ---- strike-through lines (the Editor's red pen)
  for (int i = 0; i < 4; i++) {
    vec4 l = uLine[i];
    if (l.w <= 0.0) continue;
    float dl = l.y < 0.5 ? abs(ccu.y - l.x) : abs(ccu.x - l.x);
    if (dl < l.z) {
      pulse += mix(vec3(1.0, 0.12, 0.22), vec3(1.0), clamp(l.w - 1.0, 0.0, 1.0)) * min(l.w, 1.6) * (0.45 + 0.55 * hc);
      code = l.y < 0.5 ? ch(45) : ch(124);
    }
  }
  // ---- erasure around the unwriters
  float erased = 0.0;
  for (int i = 0; i < ${MAX_ERASE}; i++) {
    vec3 e = uErase[i];
    if (e.z <= 0.0) continue;
    float d = length(ccu - e.xy);
    float rr = e.z * (0.72 + 0.45 * hash(cc + floor(uTime * 5.0)));
    if (d < rr) erased = 1.0;
  }

  vec3 lit = col * bri * L + pulse;
  float lum = max(lit.r, max(lit.g, lit.b));
  if (kind != 6 && code != 0.0 && pulse == vec3(0.0)) {
    if (lum < 0.035) code = 0.0;
    else if (lum < 0.085 && hc > 0.45) code = ch(46);
  }
  vec2 g = (cuv - vec2(0.21, 0.08)) / vec2(0.58, 0.84);
  float gm = glyph(tAtlasC, code, g) * (1.0 - erased);
  vec3 outc = uBg + lit * gm;

  // ---- reflections of standing things in water
  if (kind == 1 && uHasWater > 0.5) {
    int wob = int(floor(sin(fcell.y * 0.8 + uTime * 2.4) * 1.3 + 0.5));
    vec4 rf = texelFetch(tRefl, ivec2(oi.x + wob, rows - 1 - oi.y), 0);
    if (rf.a > 0.5) {
      float rl = max(rf.r, max(rf.g, rf.b));
      int idx = int(clamp(pow(rl, 0.7) * float(RN) * 0.8, 1.0, float(RN - 1)));
      float m = glyph(tAtlasF, float(RAMP[idx]), fuv);
      outc = uBg + mix(uPal[5], rf.rgb / max(rl, 0.001), 0.45) * (0.16 + 0.42 * rl) * m;
    }
  }

  // ---- 3D objects as fine glyphs
  if (obj.a > 0.5) {
    vec3 oc = pow(obj.rgb, vec3(0.4545));
    vec3 Lo = lightAt((fcell + 0.5) * uFine / uU + vec2(0.0, 0.3));
    float lo = max(Lo.r, max(Lo.g, Lo.b));
    if (obj.a > 0.9) oc *= clamp(0.16 + lo * 0.8, 0.0, 1.2) * mix(vec3(1.0), Lo / max(lo, 0.001), 0.3);
    float ol = max(oc.r, max(oc.g, oc.b));
    int idx = int(clamp(pow(ol, 0.85) * float(RN), 0.0, float(RN - 1)));
    float m = glyph(tAtlasF, float(RAMP[idx]), fuv);
    vec3 hue = oc / max(ol, 0.001);
    outc = uBg * 0.6 + hue * (0.3 + 0.7 * ol) * m + oc * 0.07;
  }
  // soft bloom from the low-res object buffer
  vec2 buv = (wp / uFine - uObj0) / uObjSize;
  vec4 bl = texture(tObj, vec2(buv.x, 1.0 - buv.y));
  outc += pow(bl.rgb, vec3(0.4545)) * bl.a * uBloom * (1.0 - obj.a * 0.6);

  // ---- weather in screen space
  if (uWeather > 0) {
    vec2 sc = floor(sp / uFine);
    if (uWeather == 1) {          // rain
      float colId = sc.x + floor(sc.y * 0.34);
      float h = hash(vec2(colId, 7.0));
      if (h < uWeatherAmt) {
        float seg = mod(sc.y - uTime * (34.0 + h * 30.0) + h * 400.0, 46.0 + h * 50.0);
        if (seg < 4.0) outc += uWeatherCol * (0.25 + seg * 0.14) * glyph(tAtlasF, ch(47), fuv);
      }
    } else if (uWeather == 2) {   // snow
      float drift = floor(sin(sc.y * 0.07 + uTime * 0.6 + hash(vec2(sc.x, 1.0)) * 6.0) * 2.0);
      float h = hash(vec2(sc.x + drift, 3.0));
      if (h < uWeatherAmt) {
        float seg = mod(sc.y - uTime * (7.0 + h * 9.0) + h * 300.0, 30.0 + h * 40.0);
        if (seg < 1.0) outc += uWeatherCol * (0.5 + 0.5 * h) * glyph(tAtlasF, h > uWeatherAmt * 0.5 ? ch(42) : ch(46), fuv);
      }
    } else if (uWeather == 3) {   // rising ash and sparks
      float drift = floor(sin(sc.y * 0.09 + uTime * 0.8 + hash(vec2(sc.x, 2.0)) * 6.0) * 2.0);
      float h = hash(vec2(sc.x + drift, 5.0));
      if (h < uWeatherAmt) {
        float seg = mod(sc.y + uTime * (5.0 + h * 8.0) + h * 300.0, 34.0 + h * 40.0);
        if (seg < 1.0) outc += uWeatherCol * (0.4 + 0.6 * h) * glyph(tAtlasF, h > uWeatherAmt * 0.5 ? ch(39) : ch(46), fuv);
      }
    }
  }

  // ---- screen treatment
  vec2 q = sp / uRes - 0.5;
  outc *= 1.0 - dot(q, q) * (0.9 + uDark);
  outc += vec3(0.6, 0.04, 0.1) * uFlash * (0.04 + dot(q, q) * 1.5);
  if (hash(cc * 1.37 + 3.1) > uReveal) outc = uBg * 0.5;
  gl_FragColor = vec4(outc, 1.0);
}`;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.r.setPixelRatio(1);
    this.r.autoClear = true;
    this.scene = new THREE.Scene();
    this.root = new THREE.Group();          // everything that gets mirrored for water reflections
    this.scene.add(this.root);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
    this.cam.up.set(0, COS, -SIN);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.moon = new THREE.DirectionalLight(0xffffff, 1.0);
    this.moon.position.set(-0.6, 1.0, 0.75);
    this.scene.add(this.ambient, this.moon);
    this.ambient.layers.enable(1); this.moon.layers.enable(1);
    this.points = [];
    for (let i = 0; i < 5; i++) {
      const p = new THREE.PointLight(0xffffff, 0, 9, 1.4);
      p.layers.enable(1); this.points.push(p); this.scene.add(p);
    }
    this.fsScene = new THREE.Scene();
    this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const U = (v) => ({ value: v });
    this.u = {
      tObj: U(null), tRefl: U(null), tTerrain: U(null), tAtlasF: U(null), tAtlasC: U(null),
      uRes: U(new THREE.Vector2()), uOrigin: U(new THREE.Vector2()), uFine: U(new THREE.Vector2()),
      uObj0: U(new THREE.Vector2()), uObjSize: U(new THREE.Vector2()), uTerSize: U(new THREE.Vector2()),
      uPlayer: U(new THREE.Vector2()),
      uU: U(1), uC: U(1), uTime: U(0), uReveal: U(1), uFlash: U(0), uWeatherAmt: U(0), uHasWater: U(0), uDark: U(0), uBloom: U(0.16),
      uWeather: U(0),
      uPal: U(Array.from({ length: 16 }, () => new THREE.Vector3(1, 1, 1))),
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
    this.terrainTex = null;
    this.density = 2.5;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(320, Math.floor(innerWidth * dpr)), H = Math.max(320, Math.floor(innerHeight * dpr));
    this.W = W; this.H = H; this.dpr = dpr;
    this.r.setSize(W, H, false);
    this.canvas.style.width = innerWidth + 'px'; this.canvas.style.height = innerHeight + 'px';
    this.U = Math.max(40, Math.min(W / 7.4, H / 6.6));
    this.C = this.U / CPU;
    this.fw = this.C / this.density; this.fh = this.fw * 1.5;
    this.cols = Math.ceil(W / this.fw) + 2; this.rows = Math.ceil(H / this.fh) + 2;
    const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, type: THREE.UnsignedByteType };
    if (this.rtObj) { this.rtObj.dispose(); this.rtRefl.dispose(); }
    this.rtObj = new THREE.WebGLRenderTarget(this.cols, this.rows, opts);
    this.rtRefl = new THREE.WebGLRenderTarget(this.cols, this.rows, opts);
    if (this.atlasF) { this.atlasF.dispose(); this.atlasC.dispose(); }
    const k = 2;
    this.atlasF = makeAtlas(Math.max(6, Math.round(this.fw * k)), Math.max(9, Math.round(this.fh * k)), 800);
    this.atlasC = makeAtlas(Math.max(8, Math.round(this.C * 0.58 * k)), Math.max(12, Math.round(this.C * 0.84 * k)), 500);
    const u = this.u;
    u.tObj.value = this.rtObj.texture; u.tRefl.value = this.rtRefl.texture;
    u.tAtlasF.value = this.atlasF; u.tAtlasC.value = this.atlasC;
    u.uRes.value.set(W, H); u.uU.value = this.U; u.uC.value = this.C; u.uFine.value.set(this.fw, this.fh);
    u.uObjSize.value.set(this.cols, this.rows);
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
    hexes.forEach((h, i) => {
      const n = parseInt(h.slice(1), 16);
      this.u.uPal.value[i].set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    });
  }

  // world unit -> css pixel on screen, for HUD markers
  toScreen(x, y, h = 0) {
    const o = this.u.uOrigin.value;
    return [(x * this.U - o.x) / this.dpr, ((y - h * COS) * this.U - o.y) / this.dpr];
  }
  // css pixel -> world ground position
  toWorld(px, py) {
    const o = this.u.uOrigin.value;
    return [(px * this.dpr + o.x) / this.U, (py * this.dpr + o.y) / this.U];
  }
  viewUnits() { return [this.W / this.U, this.H / this.U]; }

  render(cx, cy, time, shakeX = 0, shakeY = 0) {
    const u = this.u, U = this.U;
    const ox = Math.round(cx * U - this.W / 2 + shakeX), oy = Math.round(cy * U - this.H / 2 + shakeY);
    u.uOrigin.value.set(ox, oy); u.uTime.value = time;
    const i0 = Math.floor(ox / this.fw), j0 = Math.floor(oy / this.fh);
    u.uObj0.value.set(i0, j0);
    const cam = this.cam;
    cam.left = (i0 * this.fw - cx * U) / U; cam.right = cam.left + this.cols * this.fw / U;
    cam.top = -(j0 * this.fh - cy * U) / U; cam.bottom = cam.top - this.rows * this.fh / U;
    cam.updateProjectionMatrix();
    const tz = cy / SIN;
    cam.position.set(cx, SIN * 120, tz + COS * 120);
    cam.lookAt(cx, 0, tz);
    const r = this.r;
    r.setClearColor(0x000000, 0);
    if (u.uHasWater.value > 0.5) {
      this.root.scale.y = -1; this.root.updateMatrixWorld(true);
      r.setRenderTarget(this.rtRefl); r.clear(); r.render(this.scene, cam);
      this.root.scale.y = 1; this.root.updateMatrixWorld(true);
    }
    // layer 1 (the Editor) is drawn first and its depth thrown away, so nothing it covers is ever hidden
    r.setRenderTarget(this.rtObj); r.clear();
    r.autoClear = false;
    cam.layers.set(1); r.render(this.scene, cam); r.clearDepth();
    cam.layers.set(0); r.render(this.scene, cam);
    r.autoClear = true;
    r.setRenderTarget(null);
    r.render(this.fsScene, this.fsCam);
  }
}
