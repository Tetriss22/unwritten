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
export const KINDS = {
  coat: ['NZSW#MHEzs=:', 11, 0], cape: ['WMNHKXV', 10, 0], skin: ['oOeac', 12, 0], dark: ['zs:;=x', 11, 0], leather: ['%&8B', 11, 0],
  scarf: ['~=S$~', 11, 0], quill: ['|/!I1', 12, 0], gold: ['#@O0', 10, 0], slash: ['/-\\~=', 6, 0], xray: ['.:', 8, 0],
  ink: ['@&%8$#', 9, 0], ink2: ['xX*#', 9, 0], eye: ['O@0', 9, 0], boss: ['#@&%$?!', 5, 0],
  wall: ['H#N[]=IH', 4.4, 0], plaster: ['H[]#|I', 4.4, 0], roof: ['=^=/\\A', 4.8, 0], window: ['#H8@', 6.5, 0], door: ['|[]I', 5.5, 0],
  wood: ['|=I!l', 6.5, 0], stone: ['O0#o%Q', 5.2, 0], brick: ['[]=#', 4.6, 0], metal: ['!i|:', 8, 0], lamp: ['*@#', 8, 0],
  leaf: ['&%@oO8', 5.4, 1], needle: ['A^M/\\', 5.2, 0.7], trunk: ['|I!l1', 6, 0], reed: ['|!/l', 9, 1.6], hay: ['~=%/', 5.6, 0.5],
  snow: ['*.+:\'', 5.2, 0], ice: ['/\\|V<>', 5, 0], fire: ['^*~W', 6, 0], book: ['=|#I', 7, 0], voidstone: ['?!_.-:', 5, 0], chunk: ['*+x#', 4, 0],
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
uniform sampler2D tGlyph; uniform float uSet[12]; uniform float uSetLen; uniform float uDens; uniform float uSeed;
`;
const FRAG_BODY = `
{
  vec3 gan = abs(vGn);
  vec2 gp = gan.y > 0.62 ? vec2(vGp.x, -vGp.z) : (gan.x > gan.z ? vec2(-vGp.z * sign(vGn.x), vGp.y) : vec2(vGp.x * sign(vGn.z), vGp.y));
  vec2 gq = gp * uDens * vec2(1.5, 1.0);
  vec2 gcell = floor(gq), guv = fract(gq);
  float gh = fract(sin(dot(gcell + uSeed, vec2(12.9898, 78.233))) * 43758.5453);
  float code = uSet[int(min(gh * uSetLen, uSetLen - 1.0))];
  vec2 auv = vec2((mod(code, 16.0) + clamp(guv.x, 0.06, 0.94)) / 16.0, 1.0 - (floor(code / 16.0) + clamp(1.0 - guv.y, 0.04, 0.96)) / 6.0);
  float gm = textureGrad(tGlyph, auv, dFdx(gq) / vec2(16.0, 6.0), dFdy(gq) / vec2(16.0, 6.0)).r;
  gl_FragColor.rgb *= smoothstep(0.08, 0.6, gm) ;
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
  const u = { tGlyph: shared.tGlyph, uTime: shared.uTime, uSet: { value: codes }, uSetLen: { value: Math.min(12, set.length) }, uDens: { value: opt.dens || dens }, uSeed: { value: (hex % 97) * 0.37 }, uSway: { value: opt.sway ?? sway } };
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
