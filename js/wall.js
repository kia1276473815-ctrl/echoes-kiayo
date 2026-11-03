// ------------------------------------------------------------ the wall of monsters (me-114514, 3:41-3:58)
// At the turn the screen is full of pictures in one frame: Bosch, Bruegel, Goya, Arcimboldo, Redon, Ensor, Dalí and the
// rest (256 cuts in one atlas, tools/grotesque.py). The screen is cut into uneven pieces, cut again on the sixteenths;
// pieces divide, more pictures are slapped on top of them crooked and warped, and every piece
// changes picture every few frames — by the end every frame. Over all of it the screen itself breaks: bands tear
// sideways, it freezes, punches in on an eye or a mouth, flips over. It gets worse all the way to 3:58, ends in half a second of static, and then the music falls away
// and so does all of it, at once: what is left is the last frame burnt into the eye, in negative, going out.
// Plain WebGL: one textured quad per piece into a frame buffer, then one pass over the whole screen.
import { asset } from './assets.js';
import { renderScale } from './viz.js';

const ATLAS = 'assets/collage/grotesque.webp', GRID = 16, PICS = GRID * GRID;
// what a piece's picture is put through: 0 as painted, 1 negative, 2 coarse pixels, 3 mirrored into a face, 4 smeared,
// 5 red and black like the posters, 6 one-bit dither, 7 the picture inside itself, again and again
const MODES = [0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 3, 3, 3, 4, 5, 5, 6, 7, 7];
const FLOATS = 16;

const VS = `
attribute vec2 aPos; attribute vec2 aUV; attribute vec2 aImg; attribute vec4 aCrop; attribute vec4 aP; attribute vec2 aSize;
varying vec2 vUV; varying vec2 vImg; varying vec4 vCrop; varying vec4 vP; varying vec2 vSize;
void main() {
  vUV = aUV; vImg = aImg; vCrop = aCrop; vP = aP; vSize = aSize;
  gl_Position = vec4(aPos.x / 960.0 - 1.0, 1.0 - aPos.y / 540.0, 0.0, 1.0);
}`;
const HASH = `
float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`;
const FS = `
precision highp float;
uniform sampler2D uAtlas; uniform float uTime; uniform float uFlash;
varying vec2 vUV; varying vec2 vImg; varying vec4 vCrop; varying vec4 vP; varying vec2 vSize;
${HASH}
vec3 tap(float img, vec2 uv) {
  uv = clamp(uv, 0.006, 0.994);
  return texture2D(uAtlas, (vec2(mod(img, 16.0), floor(img / 16.0)) + uv) / 16.0).rgb;
}
void main() {
  float seed = vP.x, g = vP.y, sw = vP.z, mode = mod(vP.w, 10.0);
  float burst = max(0.0, 1.0 - sw / 0.07);           // just swapped: it tears hardest
  g = clamp(g + burst, 0.0, 1.0);
  float T = floor(uTime * (6.0 + 26.0 * g) + seed * 7.0);   // the glitch clock: a new tear every step
  vec2 uv = vUV;
  // torn horizontal bands
  float nb = 4.0 + floor(h1(seed + T) * 22.0), band = floor(uv.y * nb);
  if (h2(vec2(band, T + seed)) < g * 0.6) uv.x += (h2(vec2(band, T * 1.7 + seed)) - 0.5) * g * 0.55;
  // the picture rolls
  if (h1(seed * 3.1 + T) < g * 0.22) uv.y = fract(uv.y + h1(seed + T * 0.3));
  if (mode == 2.0) { float q = 6.0 + floor(h1(seed + T) * 22.0); uv = (floor(uv * q) + 0.5) / q; }
  if (mode == 3.0) uv.x = 0.5 - abs(uv.x - 0.5);
  if (mode == 4.0 && h1(seed + T * 0.7) < 0.4 + g * 0.6) { float r = floor(uv.y * 5.0) / 5.0 + 0.1; uv.y = mix(uv.y, r, 0.94); }
  uv = fract(uv);
  // the picture inside itself, each time a little smaller
  if (mode == 7.0) {
    float m = 0.15 + 0.06 * h1(seed);
    for (int i = 0; i < 5; i++) {
      vec2 q = (uv - m) / (1.0 - 2.0 * m);
      if (q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0) uv = q;
    }
  }
  vec2 cu = mix(vCrop.xy, vCrop.zw, uv);
  // which picture: the old one shows through while it changes, and at the worst any piece can flick to it
  float img = vImg.x;
  if (h1(seed * 7.0 + T) < burst * 0.7 || h1(seed * 5.0 + T * 1.3) < g * g * 0.2) img = vImg.y;
  float sp = (g * 0.02 + burst * 0.035) * (h1(seed + T * 2.1) - 0.3);
  vec3 c = vec3(tap(img, cu + vec2(sp, 0.0)).r, tap(img, cu).g, tap(img, cu - vec2(sp, 0.0)).b);
  float l = dot(c, vec3(0.3, 0.59, 0.11));
  if (mode == 1.0) c = 1.0 - c;
  if (mode == 5.0) c = mix(vec3(0.03, 0.0, 0.0), vec3(0.88, 0.1, 0.07), smoothstep(0.28, 0.62, l));
  if (mode == 6.0) c = vec3(step(0.42 + (h2(floor(gl_FragCoord.xy / 2.0)) - 0.5) * 0.5, l));
  if (h1(seed + T * 2.0) < g * 0.3) c = floor(c * 3.0 + 0.5) / 3.0;
  c *= 0.9 + 0.1 * sin(gl_FragCoord.y * 3.14159);
  c = mix(c, 1.0 - c, uFlash * step(0.5, h1(seed + 11.0)));
  gl_FragColor = vec4(c, 1.0);
}`;
// the whole screen, after the pieces: bands tear sideways, it holds still, punches in, flips; and at the very end,
// static
const QVS = `attribute vec2 aQ; varying vec2 vUV; void main() { vUV = aQ * 0.5 + 0.5; gl_Position = vec4(aQ, 0.0, 1.0); }`;
const PFS = `
precision highp float;
uniform sampler2D uScene; uniform sampler2D uPrev; uniform float uTime; uniform float uTear;
uniform float uZoom; uniform vec2 uZoomAt; uniform vec2 uFlip; uniform float uHold; uniform float uNoise; uniform float uOdd;
varying vec2 vUV;
${HASH}
void main() {
  vec2 uv = vUV;
  if (uFlip.x > 0.5) uv.x = 1.0 - uv.x;
  if (uFlip.y > 0.5) uv.y = 1.0 - uv.y;
  uv = uZoomAt + (uv - uZoomAt) / uZoom;
  float tick = floor(uTime * 30.0), band = floor(uv.y * (14.0 + floor(h1(tick) * 40.0)));
  if (h2(vec2(band, tick)) < uTear) uv.x += (h2(vec2(band, tick + 7.0)) - 0.5) * 0.35 * uTear;
  vec3 c = texture2D(uScene, clamp(uv, 0.0, 1.0)).rgb;
  c = mix(c, texture2D(uPrev, vUV).rgb, uHold);
  if (uNoise > 0.0) {
    float nz = step(0.5, h2(floor(gl_FragCoord.xy / 3.0) + fract(uTime * 7.31) * 97.0));
    c = uOdd > 0.5 ? mix(c, vec3(nz), 0.8 * uNoise) : mix(c, 1.0 - c, uNoise);
  }
  gl_FragColor = vec4(c, 1.0);
}`;
// the result to the screen; as the afterimage: negative, faint
const BFS = `
precision highp float;
uniform sampler2D uTex; uniform float uA; uniform float uNeg;
varying vec2 vUV;
void main() { vec3 c = texture2D(uTex, vUV).rgb; if (uNeg > 0.5) c = (1.0 - c) * 0.6; gl_FragColor = vec4(c * uA, uA); }`;

export class Wall {
  // o.state(): { phase, pos } — the song's part ('twist', 'twist2' = the fall at 3:58, 'end', anything else) and
  // position (s); o.twist, o.fall: where 3:41 and the fall are; o.beat: seconds a beat. The beats are counted off the
  // song's position: after the turn the bass never lets go, so there are no hits to hear
  constructor(cv, o) {
    this.cv = cv; this.o = o;
    const gl = (this.gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'high-performance' }));
    this.lite = matchMedia('(pointer: coarse)').matches;
    this.cap = this.lite ? 220 : 380;       // pieces of the mosaic
    this.floatCap = this.lite ? 30 : 64;    // pictures slapped over it
    this.fit();
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = (vs, fs, uniforms) => {
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {};
      uniforms.forEach((n) => (u[n] = gl.getUniformLocation(p, n)));
      return { p, u };
    };
    this.pp = prog(VS, FS, ['uAtlas', 'uTime', 'uFlash']);
    this.post = prog(QVS, PFS, ['uScene', 'uPrev', 'uTime', 'uTear', 'uZoom', 'uZoomAt', 'uFlip', 'uHold', 'uNoise', 'uOdd']);
    this.blit = prog(QVS, BFS, ['uTex', 'uA', 'uNeg']);
    this.attr = [['aPos', 2, 0], ['aUV', 2, 2], ['aImg', 2, 4], ['aCrop', 4, 6], ['aP', 4, 10], ['aSize', 2, 14]].map(([n, k, off]) => [gl.getAttribLocation(this.pp.p, n), k, off]);
    this.qa = [gl.getAttribLocation(this.post.p, 'aQ'), gl.getAttribLocation(this.blit.p, 'aQ')];
    this.qb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.vb = gl.createBuffer();
    this.ib = gl.createBuffer();
    const N = (this.N = this.cap + this.floatCap + 64), idx = new Uint16Array(N * 6);
    for (let i = 0; i < N; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.data = new Float32Array(N * 4 * FLOATS);
    this.fbs = null;
    this.tex = null;
    const im = new Image();
    im.onload = () => { if (!this.dead) this.upload(im); };
    im.src = asset(ATLAS);
    this.reset();
  }
  upload(im) {
    const gl = this.gl;
    let src = im;
    const max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    if (im.width > max) { const c = document.createElement('canvas'); c.width = c.height = max; c.getContext('2d').drawImage(im, 0, 0, max, max); src = c; }
    this.tex = this.texture(src);
  }
  texture(src, w, h) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // the screens are read back pixel for pixel: smoothing them, frame after frame, would turn what survives to grey
    const f = src ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  // three screens' worth: the pieces, and this frame and the last one after the pass over the whole screen
  buffers() {
    const gl = this.gl, w = this.cv.width, h = this.cv.height;
    if (this.fbs && this.fbs.w === w && this.fbs.h === h) return this.fbs;
    if (this.fbs) this.fbs.all.forEach(([f, t]) => { gl.deleteFramebuffer(f); gl.deleteTexture(t); });
    const all = [0, 1, 2].map(() => {
      const t = this.texture(null, w, h), f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      return [f, t];
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.fbs = { w, h, all, scene: all[0], out: [all[1], all[2]], cur: 0 };
    return this.fbs;
  }
  fit() {
    const k = Math.min(this.lite ? 1 : 1.25, renderScale());
    this.cv.width = Math.round(1920 * k); this.cv.height = Math.round(1080 * k);
  }
  reset() {
    this.leaves = []; this.floats = [];
    this.flash = 0; this.on = false; this.step = undefined; this.tw = -9; this.fallT = undefined; this.frame = 0;
    this.fx = { hold: 0, zoom: 0, zoomK: 1, zoomAt: [0.5, 0.5], flip: 0, flipXY: [0, 0], tear: 0 };
  }
  // nothing of the hall shows: it need not be drawn
  get covered() { return this.on && !!this.tex && this.fallT === undefined; }
  pick() { return Math.floor(Math.random() * PICS); }
  // a picture fills a piece edge to edge (cut to the piece's shape, from a random place in it)
  crop(w, h) {
    const a = w / h, cw = a > 1 ? 1 : a, ch = a > 1 ? 1 / a : 1;
    const x = Math.random() * (1 - cw), y = Math.random() * (1 - ch);
    return [x, y, x + cw, y + ch];
  }
  // how long a piece keeps a picture: a few frames, and more and more of them only one
  life(L) {
    if (Math.random() < 0.15 + 0.65 * this.R) return 0.001;
    return (0.04 + Math.random() * 0.12) * (1 - 0.6 * this.R) * (L.w * L.h > 250000 ? 1.8 : 1);
  }
  piece(x, y, w, h, now, o = {}) {
    const L = { x, y, w, h, rot: 0, warp: null, img: this.pick(), sw: now, born: now, mode: MODES[Math.floor(Math.random() * MODES.length)], seed: Math.random() * 100, g: 0, ...o };
    L.prev = L.prev ?? L.img;
    L.crop = L.crop || this.crop(w, h);
    L.next = now + this.life(L);
    return L;
  }
  swap(L, now) {
    L.prev = L.img; L.img = this.pick(); L.sw = now; L.crop = this.crop(L.w, L.h); L.seed = Math.random() * 100;
    if (Math.random() < 0.5) L.mode = MODES[Math.floor(Math.random() * MODES.length)];
    L.next = now + this.life(L);
  }
  // cut a piece in two, anywhere between a fifth and four fifths, mostly across its longer side
  cut(L) {
    const across = (L.w >= L.h) !== (Math.random() < 0.22), f = 0.2 + Math.random() * 0.6;
    if (across) { const w = Math.round(L.w * f); return [[L.x, L.y, w, L.h], [L.x + w, L.y, L.w - w, L.h]]; }
    const h = Math.round(L.h * f);
    return [[L.x, L.y, L.w, h], [L.x, L.y + h, L.w, L.h - h]];
  }
  // the whole screen, cut again into n uneven pieces (mostly the biggest is cut next)
  layout(n, now) {
    const rs = [[-40, -40, 2000, 1160]];
    while (rs.length < n) {
      rs.sort((a, b) => b[2] * b[3] * (0.5 + Math.random()) - a[2] * a[3] * (0.5 + Math.random()));
      const r = rs[0];
      if (Math.min(r[2], r[3]) < 46) break;
      rs.splice(0, 1, ...this.cut({ x: r[0], y: r[1], w: r[2], h: r[3] }));
    }
    this.leaves = rs.map(([x, y, w, h]) => this.piece(x, y, w, h, now));
  }
  // a piece divides: the halves keep showing their part of the parent for a moment, then each goes its own way
  split(L, now) {
    const i = this.leaves.indexOf(L);
    if (i < 0 || Math.min(L.w, L.h) < 50 || this.leaves.length >= this.cap) return;
    const [u0, v0, u1, v1] = L.crop;
    const kids = this.cut(L).map(([x, y, w, h]) => {
      const cr = [u0 + ((x - L.x) / L.w) * (u1 - u0), v0 + ((y - L.y) / L.h) * (v1 - v0), u0 + ((x + w - L.x) / L.w) * (u1 - u0), v0 + ((y + h - L.y) / L.h) * (v1 - v0)];
      const k = this.piece(x, y, w, h, now, { img: L.img, prev: L.img, crop: cr, mode: L.mode, seed: L.seed, sw: now - 0.05 });
      k.next = now + 0.03 + Math.random() * 0.1;
      return k;
    });
    this.leaves.splice(i, 1, ...kids);
  }
  // a picture slapped over the rest: any size, crooked, more and more often pulled out of shape
  paste(now) {
    if (this.floats.length >= this.floatCap) this.floats.shift();
    const w = 90 * Math.pow(10, Math.random()), h = w * (0.55 + Math.random() * 1.25), R = this.R;
    const tilt = Math.random() < 0.18 + 0.3 * R ? (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.6) : (Math.random() - 0.5) * 0.24;
    const k = 0.08 + 0.4 * R, warp = Math.random() < 0.3 + 0.5 * R ? Array.from({ length: 4 }, () => [(Math.random() - 0.5) * k * w, (Math.random() - 0.5) * k * h]) : null;
    const F = this.piece(Math.random() * 2000 - 40 - w / 2, Math.random() * 1160 - 40 - h / 2, w, h, now, {
      rot: tilt, warp, pasted: true,
    });
    F.die = now + (0.12 + Math.random() * 1.1) * (1 - 0.5 * R);
    this.floats.push(F);
  }
  draw(A, t, dt) {
    const gl = this.gl;
    if (!gl || this.dead) return;
    const st = this.o.state(), P = st.phase;
    const live = P === 'twist', fallen = P === 'twist2' || P === 'end';
    if (!live && !(fallen && this.on)) {
      if (this.on) { this.reset(); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); this.cv.style.visibility = 'hidden'; }
      return;
    }
    // 3:58: everything falls away at once. The last frame stays a moment, burnt in, in negative, and goes out
    if (fallen) {
      if (this.fallT === undefined) { this.fallT = t; this.cv.style.translate = ''; this.cv.style.rotate = ''; }
      const k = t - this.fallT, a = k < 0.05 ? 0 : 0.42 * Math.exp(-(k - 0.05) * 1.1);
      if (a < 0.004 || !this.fbs) {
        if (this.cv.style.visibility !== 'hidden') { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); this.cv.style.visibility = 'hidden'; }
        return;
      }
      this.show(this.fbs.out[this.fbs.cur][1], a, true);
      return;
    }
    const tw = st.pos - this.o.twist, end = this.o.fall - this.o.twist;
    // a jump back along the spiral starts it over
    if (this.fallT !== undefined || tw < this.tw - 1) this.reset();
    this.tw = tw;
    // how far gone it is: as now until 3:50, then worse and worse to the last half second (static)
    const R = (this.R = Math.max(0, Math.min(1, (tw - 8.3) / (end - 0.5 - 8.3))));
    const noise = tw > end - 0.5;
    // 3:41: full at once
    if (!this.on) { this.on = true; this.cv.style.visibility = 'visible'; this.layout(30 + Math.floor(Math.random() * 40), t); }
    // on the sixteenths: the screen is cut up again, pieces divide, pictures slapped on, and the screen breaks
    const six = Math.floor(tw / (this.o.beat / 4)), kick = this.step !== undefined && six !== this.step;
    const fx = this.fx;
    if (kick) {
      if (Math.random() < 0.35 + 0.65 * R) this.layout(Math.min(this.cap, [4, 7, 12, 20, 35, 60, 90, 140, 220, 320][Math.floor(Math.random() * 10)]), t);
      const m = 2 + Math.floor(Math.random() * (8 + 14 * R));
      for (let k = 0; k < m; k++) this.split(this.leaves[Math.floor(Math.random() * this.leaves.length)], t);
      for (let k = 0, n = 2 + Math.floor(R * 6); k < n; k++) this.paste(t);
      if (Math.random() < 0.2 + 0.3 * R) this.flash = 1;
      fx.tear = Math.random() < 0.1 + 0.5 * R ? 0.3 + 0.7 * Math.random() : fx.tear;
      if (!fx.hold && Math.random() < 0.05 + 0.15 * R) fx.hold = 2 + Math.floor(Math.random() * 3);
      if (!fx.zoom && Math.random() < 0.08 + 0.25 * R) {
        const L = this.leaves.concat(this.floats)[Math.floor(Math.random() * (this.leaves.length + this.floats.length))];
        if (L) { fx.zoom = 1 + Math.floor(Math.random() * 3); fx.zoomK = 2 + Math.random() * 2.5; fx.zoomAt = [(L.x + L.w / 2) / 1920, 1 - (L.y + L.h / 2) / 1080]; }
      }
      if (!fx.flip && Math.random() < 0.03 + 0.12 * R) { fx.flip = 1 + Math.floor(Math.random() * 3); fx.flipXY = Math.random() < 0.6 ? [1, 0] : Math.random() < 0.5 ? [0, 1] : [1, 1]; }
      const s = 1 + R * 2;
      this.cv.style.translate = `${(Math.random() - 0.5) * 30 * s}px ${(Math.random() - 0.5) * 18 * s}px`;
      this.cv.style.rotate = Math.random() < R * 0.5 ? `${(Math.random() - 0.5) * 6 * R}deg` : '';
    } else if (this.cv.style.translate && Math.random() < 0.3) { this.cv.style.translate = ''; this.cv.style.rotate = ''; }
    this.step = six;
    // and between them too
    if (Math.random() < dt * (14 + 30 * R)) this.split(this.leaves[Math.floor(Math.random() * this.leaves.length)], t);
    if (this.floats.length < Math.min(this.floatCap, 8 + tw * 2.5 + R * 40) && Math.random() < dt * (30 + 60 * R)) this.paste(t);
    this.floats = this.floats.filter((F) => F.die > t);
    this.flash = Math.max(0, this.flash - dt * 10);
    // every piece changes picture every few frames (at the end every frame), tearing as it does
    const gBase = 0.3 + Math.min(0.3, tw * 0.02) + 0.3 * R;
    for (const L of this.leaves.concat(this.floats)) {
      if (t > L.next) this.swap(L, t);
      L.g = Math.min(1, gBase * (L.w * L.h > 200000 ? 0.6 : 1) + (kick ? 0.4 * Math.random() : 0) + (Math.random() < 0.05 ? 0.6 : 0));
    }
    this.render(t, {
      tear: Math.min(1, fx.tear + 0.02 + 0.3 * R), hold: fx.hold > 0 ? 1 : 0,
      zoom: fx.zoom > 0 ? fx.zoomK : 1, zoomAt: fx.zoomAt, flip: fx.flip > 0 ? fx.flipXY : [0, 0], noise: noise ? 1 : 0,
    });
    fx.tear *= Math.pow(0.0005, dt);
    if (fx.hold) fx.hold--; if (fx.zoom) fx.zoom--; if (fx.flip) fx.flip--;
    this.frame++;
  }
  // the pieces into the frame buffer, then the pass over the whole screen (into this frame's buffer, which the next
  // frame reads back), then that to the canvas
  render(t, e) {
    const gl = this.gl;
    if (!this.tex) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); return; }
    const B = this.buffers(), W = B.w, H = B.h, time = t % 1000;
    gl.viewport(0, 0, W, H);
    if (!e.hold) {
      const D = this.data;
      let n = 0;
      for (const L of this.leaves.concat(this.floats)) {
        if (n >= this.N * 4) break;
        const s = L.pasted && t - L.born < 0.06 ? 1.06 : 1, w = L.w * s, h = L.h * s;   // slapped on
        const cx = L.x + L.w / 2, cy = L.y + L.h / 2, c = Math.cos(L.rot), si = Math.sin(L.rot), sw = Math.max(0, t - L.sw);
        [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([u, v], k) => {
          let dx = (u - 0.5) * w, dy = (v - 0.5) * h;
          if (L.warp) { dx += L.warp[k][0]; dy += L.warp[k][1]; }
          D.set([cx + dx * c - dy * si, cy + dx * si + dy * c, u, v, L.img, L.prev, ...L.crop, L.seed, L.g, sw, L.mode, w, h], n * FLOATS);
          n++;
        });
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, B.scene[0]);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      if (n) {
        gl.useProgram(this.pp.p);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vb);
        gl.bufferData(gl.ARRAY_BUFFER, D.subarray(0, n * FLOATS), gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib);
        for (const [loc, k, off] of this.attr) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, k, gl.FLOAT, false, FLOATS * 4, off * 4); }
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.uniform1i(this.pp.u.uAtlas, 0);
        gl.uniform1f(this.pp.u.uTime, time);
        gl.uniform1f(this.pp.u.uFlash, this.flash);
        gl.drawElements(gl.TRIANGLES, (n / 4) * 6, gl.UNSIGNED_SHORT, 0);
        for (const [loc] of this.attr) gl.disableVertexAttribArray(loc);
      }
    }
    const prev = B.out[B.cur], next = B.out[1 - B.cur];
    gl.bindFramebuffer(gl.FRAMEBUFFER, next[0]);
    const P = this.post;
    gl.useProgram(P.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, B.scene[1]);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, prev[1]);
    gl.uniform1i(P.u.uScene, 0); gl.uniform1i(P.u.uPrev, 1);
    gl.uniform1f(P.u.uTime, time); gl.uniform1f(P.u.uTear, e.tear);
    gl.uniform1f(P.u.uZoom, e.zoom); gl.uniform2f(P.u.uZoomAt, e.zoomAt[0], e.zoomAt[1]);
    gl.uniform2f(P.u.uFlip, e.flip[0], e.flip[1]); gl.uniform1f(P.u.uHold, e.hold);
    gl.uniform1f(P.u.uNoise, e.noise); gl.uniform1f(P.u.uOdd, this.frame % 2);
    this.quad(this.qa[0]);
    gl.activeTexture(gl.TEXTURE0);
    B.cur = 1 - B.cur;
    this.show(next[1], 1, false);
  }
  quad(loc) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.qb);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(loc);
  }
  // a finished frame to the canvas; neg: as the afterimage
  show(tex, a, neg) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.cv.width, this.cv.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.blit.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(this.blit.u.uTex, 0); gl.uniform1f(this.blit.u.uA, a); gl.uniform1f(this.blit.u.uNeg, neg ? 1 : 0);
    this.quad(this.qa[1]);
  }
  destroy() {
    this.dead = true;
    const gl = this.gl;
    if (!gl) return;
    gl.deleteTexture(this.tex); gl.deleteBuffer(this.vb); gl.deleteBuffer(this.ib); gl.deleteBuffer(this.qb);
    [this.pp, this.post, this.blit].forEach((p) => p && gl.deleteProgram(p.p));
    if (this.fbs) this.fbs.all.forEach(([f, t]) => { gl.deleteFramebuffer(f); gl.deleteTexture(t); });
  }
}
