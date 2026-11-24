// UNWRITTEN — materials made of letters.
// Every surface carries its own grid of symbols, laid out in the surface's own space, so letters
// wrap around cylinders, lie flat on roofs and move with whatever they are painted on.
import * as THREE from '../lib/three.module.min.js';

export const shared = { tGlyph: { value: null }, uTime: { value: 0 } };

// one sharp atlas with mipmaps for everything standing on the page
export function makeMeshAtlas(font) {
  const cols = 16, rows = 6, gw = 64, gh = 96;
  const c = document.createElement('canvas'); c.width = cols * gw; c.height = rows * gh;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.font = `800 ${Math.floor(gh * 0.84)}px ${font}`;
  for (let i = 0; i < 95; i++) {
    x.save(); x.beginPath(); x.rect((i % cols) * gw + 2, Math.floor(i / cols) * gh + 2, gw - 4, gh - 4); x.clip();
    x.fillText(String.fromCharCode(32 + i), (i % cols) * gw + gw / 2, Math.floor(i / cols) * gh + gh * 0.76); x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.anisotropy = 4;
  t.colorSpace = THREE.NoColorSpace;
  shared.tGlyph.value = t;
  return t;
}

// what each kind of surface is written in: [symbols, letters per world unit, sway in the wind]
export const KINDS = {   // symbols run from light to heavy: the lit side of a thing is written in heavier letters
  coat: ['.:=zsSZNWM#', 13, 0], cape: [':=xvVKXNHWM', 12, 0], skin: ['.:oceaO', 13, 0], dark: ['.:;=xzs', 12, 0], leather: [':=%&8B', 12, 0],
  scarf: ['~=S$~', 12, 0], quill: ['|/!I1', 13, 0], gold: ['#@O0', 11, 0], slash: ['/-\\~=', 6, 0], xray: ['.:', 9, 0],
  ink: ['.:x%&8$#@', 10, 0], ink2: ['.:xX*#', 10, 0], eye: ['O@0', 10, 0], boss: ['.:?!$%&@#', 6.5, 0],
  wall: ['.:=I[]HN#', 6.5, 0], roof: ['.-=^/\\A', 6.5, 0], window: ['#H8@', 7, 0], door: [':|[]I', 7, 0],
  wood: ['.:|!lI=', 8, 0], stone: ['.:o0O%Q#', 7, 0], brick: ['.:=[]#', 6.5, 0], metal: ['.:!i|', 9, 0], lamp: ['*@#', 9, 0],
  leaf: ['.:o%&8@', 7.5, 1], needle: ['.^/\\AM', 7, 0.7], trunk: ['.:!|lI1', 8, 0], reed: ['|!/l', 9, 1.6], hay: ['.~=%/', 7, 0.5],
  bolt: ['/\\|#N', 5, 0], glass: ['oO0@', 9, 0],
  snow: [".':*+", 7, 0], ice: ['.:/\\|V<>', 7, 0], fire: ['^*~W', 7, 0], book: ['=|#I', 8, 0], voidstone: ['.:-_?!', 6.5, 0], chunk: ['*+x#', 4, 0],
};

const VERT_HEAD = `
varying vec3 vGp; varying vec3 vGn;
uniform float uTime; uniform float uSway;
`;
const VERT_BODY = `
vec3 gsc = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
vGp = position * gsc; vGn = normal;
if (uSway > 0.0) {
  vec4 gwp = modelMatrix * vec4(position, 1.0);
  float gust = sin(dot(gwp.xz, vec2(0.52, 0.3)) - uTime * 1.7 + sin(gwp.z * 0.31 + gwp.x * 0.11 + uTime * 0.29) * 1.5);
  float lift = max(0.0, gwp.y - 0.35);
  transformed.x += (gust * 0.09 + sin(uTime * 3.1 + gwp.x * 2.0) * 0.02) * uSway * lift / gsc.x;
  transformed.z += gust * 0.04 * uSway * lift / gsc.z;
}
`;
const FRAG_HEAD = `
varying vec3 vGp; varying vec3 vGn;
uniform sampler2D tGlyph; uniform float uSet[12]; uniform float uSetLen; uniform float uDens; uniform float uSeed; uniform float uShade;
`;
const FRAG_BODY = `
{
  vec3 gan = abs(vGn);
  vec2 gp = gan.y > 0.62 ? vec2(vGp.x, -vGp.z) : (gan.x > gan.z ? vec2(-vGp.z * sign(vGn.x), vGp.y) : vec2(vGp.x * sign(vGn.z), vGp.y));
  vec2 gq = gp * uDens * vec2(1.5, 1.0);
  vec2 gcell = floor(gq), guv = fract(gq);
  float gh = fract(sin(dot(gcell + uSeed, vec2(12.9898, 78.233))) * 43758.5453);
  float lum0 = max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b));
  float gk = clamp(lum0 * uShade + gh * (1.0 - uShade * 0.62), 0.0, 0.999);
  float code = uSet[int(gk * uSetLen)];
  if (uShade > 0.0) gl_FragColor.rgb = gl_FragColor.rgb / max(lum0, 0.001) * clamp(mix(0.42, 1.0, lum0), 0.0, 1.15);
  vec2 auv = vec2((mod(code, 16.0) + clamp(guv.x, 0.06, 0.94)) / 16.0, 1.0 - (floor(code / 16.0) + clamp(1.0 - guv.y, 0.04, 0.96)) / 6.0);
  float gm = textureGrad(tGlyph, auv, dFdx(gq) / vec2(16.0, 6.0), dFdy(gq) / vec2(16.0, 6.0)).r;
  float tiny = smoothstep(0.22, 0.55, length(dFdx(gq)));     // letters too small to read: fill in, so far things stay bright
  gl_FragColor.rgb *= mix(smoothstep(0.08, 0.6, gm), 0.8, tiny);
}
`;

const cache = new Map();
export function gmat(hex, kind, opt = {}) {
  const key = hex + '|' + kind + '|' + (opt.glow ? 1 : 0) + (opt.flat ? 1 : 0) + (opt.lift || '') + (opt.own ? Math.random() : '') + (opt.depthFunc || '') + (opt.side || '');
  if (cache.has(key)) return cache.get(key);
  const [set, dens, sway] = KINDS[kind];
  const base = { color: hex, side: opt.side || THREE.FrontSide };
  const m = opt.glow ? new THREE.MeshBasicMaterial(base) : new THREE.MeshLambertMaterial({ ...base, flatShading: !!opt.flat });
  if (opt.lift && !opt.glow) { m.emissive = new THREE.Color(hex).multiplyScalar(opt.lift); }   // never falls fully into shadow
  if (opt.depthFunc) { m.depthFunc = opt.depthFunc; m.depthWrite = false; }
  const codes = new Array(12).fill(0); [...set].forEach((c, i) => { if (i < 12) codes[i] = c.charCodeAt(0) - 32; });
  const u = { tGlyph: shared.tGlyph, uTime: shared.uTime, uSet: { value: codes }, uSetLen: { value: Math.min(12, set.length) }, uDens: { value: opt.dens || dens * 1.45 }, uSeed: { value: (hex % 97) * 0.37 }, uSway: { value: opt.sway ?? sway }, uShade: { value: opt.glow ? 0 : 0.72 } };
  m.userData.glyph = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_HEAD).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + FRAG_HEAD).replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + FRAG_BODY);
  };
  m.customProgramCacheKey = () => 'glyph' + (opt.glow ? 'B' : 'L') + (opt.flat ? 'F' : '');
  cache.set(key, m);
  return m;
}
