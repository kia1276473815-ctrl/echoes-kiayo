// The medium between pages: one full-stage WebGL layer that floods the old page with the next
// page's paper, then lets the new page precipitate out of it. Each side of the record has its
// own medium, and all of them listen to whatever is playing.
//   phase  — prologue, interludes, coda: the first deck's noise dissolve
//   signal — Side A, Floating Points: the front is the live oscilloscope trace with three echo
//            taps; the page then opens row by row as a frozen spectrum (bottom rows = low notes)
//   ink    — Side B, Alon Mor: domain-warped ink blooming out of the next page's subject; bass
//            stirs it
//   inter  — Side C, me: two wave sources (white = FP, gold = AM); the page appears through
//            their nodal lines and the crests where both agree burn vermillion
//   groove — side changes: a lathe cuts grooves around the record's spindle, then unwinds them

const VERT = `attribute vec2 p; varying vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;

const FRAG = `precision highp float;
varying vec2 uv;
uniform float uP, uQ, uPhase, uMode, uDir, uSeed, uT, uLow, uKick, uRms, uMaxR;
uniform vec2 uRes, uO, uS1, uS2;
uniform vec3 uBg, uEdge, uInk, uWarm;
uniform sampler2D uWave, uRows;

float hash(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 q){
  vec2 i = floor(q), f = fract(q); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
float fbm(vec2 q){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a * noise(q); q = q * 2.03 + 1.7; a *= .5; } return v / .9375; }
vec4 over(vec4 top, vec4 bot){ return top + bot * (1. - top.a); }   // premultiplied

const float TAU = 6.2831853;

void main(){
  float asp = uRes.x / uRes.y;
  vec2 q = vec2(uv.x * asp, uv.y);
  float x = uDir > 0. ? uv.x : 1. - uv.x;
  float prog = uPhase < .5 ? uP : uQ;
  float live = step(.001, prog) * step(prog, .999);
  float cover = 0., edge = 0.;
  vec3 ec = uEdge, body = uBg;
  int m = int(uMode + .5);

  if (m == 0) {
    // ---- phase: noise with a sweep bias, a lit seam and scanlines
    float f = fbm(q * 2.6 + uSeed * 17.3 + uPhase * 5.1) * .62 + x * .38;
    float pp = prog * 1.22 - .11;
    cover = uPhase < .5 ? smoothstep(pp + .012, pp - .012, f) : smoothstep(pp - .012, pp + .012, f);
    float d = abs(f - pp);
    edge = (smoothstep(.014, 0., d) * .85 + smoothstep(.07, 0., d) * .1) * live * (.9 + .1 * sin(uv.y * uRes.y * 1.5));

  } else if (m == 1) {
    // ---- signal
    float A = .022 + min(uRms * .55, .075);
    if (uPhase < .5) {
      float pp = uP * 1.16 - .06;
      float tr = pp + (texture2D(uWave, vec2(uv.y, .5)).r * 2. - 1.) * A;
      cover = smoothstep(tr + .0012, tr - .0012, x);
      float d = abs(x - tr) * uRes.x;
      edge = exp(-d * .55) + exp(-d * .06) * .07;
      for (int k = 1; k <= 3; k++) {
        float fk = float(k);
        float tk = pp - fk * .048 + (texture2D(uWave, vec2(fract(uv.y + fk * .071), .5)).r * 2. - 1.) * A * (1. - fk * .22);
        edge += exp(-abs(x - tk) * uRes.x * .6) * pow(.42, fk) * step(x, tr);
      }
      edge *= live;
      // raster lines left in the wake, fading out behind the front
      float wake = clamp((tr - x) / .24, 0., 1.);
      float ras = step(.84, fract(uv.y * uRes.y / 7.)) * (1. - wake) * step(0., tr - x);
      body = mix(uBg, uInk, ras * .09);
    } else {
      float R = 40.;
      float row = floor(uv.y * R), fy = fract(uv.y * R);
      float e = texture2D(uRows, vec2((row + .5) / R, .5)).r;
      float h = (1. - e) * .4 + hash(vec2(row, uSeed)) * .14;
      float l = clamp((uQ - h) / .44, 0., 1.);
      l = 1. - pow(1. - l, 3.);
      float bar = l * 1.04;
      float moving = step(.001, l) * step(l, .999);
      float gap = smoothstep(0., .07, fy) * smoothstep(1., .93, fy);
      cover = step(bar, x) * mix(1., gap, smoothstep(0., .04, l));
      edge = exp(-abs(x - bar) * uRes.x * .7) * moving * (.55 + e * .7);
      for (int k = 1; k <= 3; k++) {
        float fk = float(k);
        edge += exp(-abs(x - (bar - fk * .024 * l)) * uRes.x * .8) * pow(.38, fk) * moving * step(x, bar) * gap;
      }
    }

  } else if (m == 2) {
    // ---- ink
    vec2 o = vec2(uO.x * asp, uO.y);
    float r = length(q - o) / uMaxR;
    vec2 wv = vec2(fbm(q * 1.4 + uSeed), fbm(q * 1.4 + uSeed + 4.7));
    float amp = 1.3 + uLow * 1.8;
    if (uPhase < .5) {
      float f = r * .62 + fbm(q * 2. + wv * amp + vec2(0., uT * .05)) * .5 - .08;
      float pp = uP * 1.18 - .08;
      cover = smoothstep(pp + .018, pp - .018, f);
      float fil = fbm(q * 11. + wv * 3. + uSeed);
      edge = smoothstep(.036, 0., abs(f - pp)) * (.3 + fil * fil * 1.5) * (1. + uKick * .6) * live;
      float depth = clamp((pp - f) * 5., 0., 1.);
      body = mix(uBg, uWarm, .09 * (1. - depth) * fil);   // warm smoke just behind the front
    } else {
      float f = r * .38 + fbm(q * 2.4 + wv * amp + 9.1 + vec2(uT * .04, 0.)) * .72 - .05;
      float pp = uQ * 1.2 - .1;
      cover = smoothstep(pp - .075, pp + .075, f);          // soft: the ink thins like smoke
      edge = smoothstep(.06, 0., abs(f - pp)) * .45 * (1. - uQ) * (1. + uKick * .4);
    }

  } else if (m == 3) {
    // ---- interference
    vec2 s1 = vec2(uS1.x * asp, uS1.y), s2 = vec2(uS2.x * asp, uS2.y);
    float d1 = length(q - s1), d2 = length(q - s2);
    float k = 44. * (1. + uLow * .12);
    float s = (cos(d1 * k - uT * 4.) + cos(d2 * k - uT * 4.)) * .5;
    float near = min(d1, d2) / uMaxR;
    vec3 src = mix(uInk, uWarm, smoothstep(-.12, .12, d1 - d2));
    float meet = 1. - smoothstep(0., .2, abs(d1 - d2));   // where the two waves are equally strong: me
    if (uPhase < .5) {
      float f = near * .74 + (.5 - s * .5) * .26;
      float pp = uP * 1.14 - .07;
      cover = smoothstep(pp + .01, pp - .01, f);
      edge = smoothstep(.035, 0., abs(f - pp)) * live;
      ec = mix(src, uEdge, max(smoothstep(.2, .9, s) * .6, meet));
      float inside = clamp((pp - f) * 6., 0., 1.) * (1. - clamp((pp - f) * 1.6, 0., 1.));
      body = mix(uBg, uEdge, smoothstep(.82, 1., s) * inside * .18);
    } else {
      float f = (.5 + s * .5) * .58 + fbm(q * 3. + uSeed) * .22 + (1. - near) * .2;
      float pp = uQ * 1.16 - .08;
      cover = smoothstep(pp - .012, pp + .012, f);
      edge = smoothstep(.04, 0., abs(f - pp)) * live;
      ec = mix(src, uEdge, max(smoothstep(0., .8, s) * .5, meet));
    }

  } else {
    // ---- groove
    vec2 v = q - vec2(uO.x * asp, uO.y);
    float r = length(v), th = atan(v.y, v.x);
    float bw = 18. / 1080.;
    float gi = floor(r / bw), fr = fract(r / bw);
    float ang = fract(th / TAU + .25 + hash(vec2(gi, uSeed)));
    ang = uDir > 0. ? ang : 1. - ang;
    float win = .07;
    float pp = prog * (1. + win) * 1.04 - .02;
    float lp = clamp((pp - gi * bw / uMaxR) / win, 0., 1.);
    cover = uPhase < .5 ? step(ang, lp) : step(lp, ang);
    float inGroove = smoothstep(0., .25, fr) * smoothstep(1., .75, fr);
    edge = smoothstep(.014, 0., abs(ang - lp)) * step(.001, lp) * step(lp, .999) * inGroove * live;
    float line = 1. - smoothstep(0., .14, fr) * smoothstep(1., .86, fr);
    float sheen = pow(max(0., cos(th * 2. - uT * 1.6)), 7.);   // the two light wedges on a spinning record
    body = mix(uBg, uInk, line * .07 + sheen * .07 * (1. - line));
  }

  vec4 c = vec4(body * cover, cover);
  edge = clamp(edge, 0., 1.);
  gl_FragColor = over(vec4(ec * edge, edge), c);
}`;

const hex3 = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const MODES = { phase: 0, signal: 1, ink: 2, inter: 3, groove: 4 };
const io = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const out = (k) => 1 - Math.pow(1 - k, 3);

export class Medium {
  constructor(cv, eng) {
    this.cv = cv;
    this.eng = eng;
    const gl = (this.gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }));
    if (!gl) return;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p);
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      this.u[info.name] = gl.getUniformLocation(p, info.name);
    }
    const tex = (unit, w) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, w, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(w).fill(128));
      return t;
    };
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.waveTex = tex(0, 512);
    this.rowTex = tex(1, 40);
    gl.uniform1i(this.u.uWave, 0);
    gl.uniform1i(this.u.uRows, 1);
    this.wave = new Uint8Array(512);
    this.rows = new Uint8Array(40);
    this.bands = new Float32Array(40);
    this.fit(1);
  }

  fit(rs) {
    if (!this.gl) return;
    const s = Math.min(1, rs) * 0.66;
    this.cv.width = Math.round(1920 * s);
    this.cv.height = Math.round(1080 * s);
    this.gl.viewport(0, 0, this.cv.width, this.cv.height);
  }

  // the rows of the signal medium open in the order of the spectrum at the moment of the swap
  freezeRows() {
    const b = this.eng.logBands(40, 30, 14000, this.bands);
    let mx = 0;
    for (let i = 0; i < 40; i++) mx = Math.max(mx, b[i]);
    for (let i = 0; i < 40; i++) this.rows[i] = Math.round((mx > 0.02 ? b[i] / mx : 0.5 + 0.5 * Math.sin(i * 0.7)) * 255);
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 40, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.rows);
  }

  draw(S, p, q, phase, t) {
    const gl = this.gl, u = this.u, E = this.eng, B = E.bands;
    const wl = E.wl, gain = 1 / Math.max(0.12, Math.min(1, B.sRms * 4));   // quiet music still draws a readable trace
    for (let i = 0; i < 512; i++) this.wave[i] = Math.max(0, Math.min(255, 128 + wl[i * 4] * gain * 127));
    gl.activeTexture(gl.TEXTURE0);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 512, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.wave);
    gl.uniform1f(u.uP, p);
    gl.uniform1f(u.uQ, q);
    gl.uniform1f(u.uPhase, phase);
    gl.uniform1f(u.uMode, MODES[S.mode]);
    gl.uniform1f(u.uDir, S.dir);
    gl.uniform1f(u.uSeed, S.seed);
    gl.uniform1f(u.uT, t);
    gl.uniform1f(u.uLow, B.sLow);
    gl.uniform1f(u.uKick, B.kick);
    gl.uniform1f(u.uRms, B.sRms);
    gl.uniform1f(u.uMaxR, S.maxR);
    gl.uniform2f(u.uRes, this.cv.width, this.cv.height);
    gl.uniform2f(u.uO, S.origin[0], S.origin[1]);
    gl.uniform2f(u.uS1, S.s1[0], S.s1[1]);
    gl.uniform2f(u.uS2, S.s2[0], S.s2[1]);
    gl.uniform3fv(u.uBg, hex3(S.bg));
    gl.uniform3fv(u.uEdge, hex3(S.edge));
    gl.uniform3fv(u.uInk, hex3(S.ink));
    gl.uniform3fv(u.uWarm, hex3(S.warm));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // S: { mode, dir, bg, edge, ink, warm, origin:[u,v], s1, s2, cover, uncover }. swap() runs fully covered.
  run(S, swap) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!this.gl || reduce) { swap(); return Promise.resolve(); }
    S = { dir: 1, origin: [0.5, 0.5], s1: [0.28, 0.66], s2: [0.74, 0.32], warm: '#C8924A', ...S, seed: Math.random() * 10 };
    S.maxR = this.reach(S);
    this.cv.style.display = 'block';
    this.sound(S);
    return new Promise((res) => {
      const t0 = performance.now();
      let t1 = 0, held = 0, prev = 0;
      const step = (now) => {
        const t = now / 1000;
        if (!held) {
          const k = Math.min(1, (now - t0) / S.cover);
          this.draw(S, io(k), 0, 0, t);
          if (k >= 1) {
            try { swap(); } catch (e) { console.error(e); }
            this.freezeRows();
            held = prev = performance.now();
          }
        } else if (!t1) {
          // stay fully covered until the new page's first heavy frames (scene builds, shader compiles,
          // texture uploads) are behind us, so the uncover never stutters
          this.draw(S, 1, 0, 1, t);
          const smooth = now - prev < 24;
          prev = now;
          if ((smooth && now - held > 50) || now - held > 450) t1 = now;
        } else {
          const k = Math.min(1, (now - t1) / S.uncover);
          this.draw(S, 1, out(k), 1, t);
          if (k >= 1) { this.cv.style.display = 'none'; res(); return; }
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // farthest distance (in stage heights) the front has to travel so the whole frame is reached
  reach(S) {
    const asp = 16 / 9;
    let m = 0;
    for (let i = 0; i <= 16; i++) for (let j = 0; j <= 9; j++) {
      const x = (i / 16) * asp, y = j / 9;
      const d = S.mode === 'inter'
        ? Math.min(Math.hypot(x - S.s1[0] * asp, y - S.s1[1]), Math.hypot(x - S.s2[0] * asp, y - S.s2[1]))
        : Math.hypot(x - S.origin[0] * asp, y - S.origin[1]);
      m = Math.max(m, d);
    }
    return m * 1.02;
  }

  // every medium has a sound, quiet enough to sit under the bed
  sound(S) {
    const E = this.eng, c = E.ctx;
    if (!c || c.state !== 'running' || E.bedMuted) return;
    const t = c.currentTime, T1 = S.cover / 1000, T = T1 + S.uncover / 1000;
    const env = (g, peak, at, end) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + at); g.gain.linearRampToValueAtTime(0, t + end); };
    const noise = () => { const s = c.createBufferSource(); s.buffer = E.noise; s.loop = true; return s; };
    if (S.mode === 'signal') {
      // a band of noise that crosses the room with the trace
      const s = noise(), f = c.createBiquadFilter(), g = c.createGain(), p = c.createStereoPanner();
      f.type = 'bandpass'; f.Q.value = 7;
      f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(4200, t + T1);
      p.pan.setValueAtTime(-0.85 * S.dir, t); p.pan.linearRampToValueAtTime(0.85 * S.dir, t + T1);
      env(g, 0.06, T1 * 0.6, T1 + 0.15);
      s.connect(f).connect(g).connect(p).connect(E.fxBus);
      s.start(t, Math.random()); s.stop(t + T1 + 0.2);
    } else if (S.mode === 'ink') {
      // a low breath that swells as the ink closes and leaves as it thins
      const s = noise(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'lowpass'; f.Q.value = 0.7;
      f.frequency.setValueAtTime(140, t); f.frequency.exponentialRampToValueAtTime(900, t + T1); f.frequency.exponentialRampToValueAtTime(180, t + T);
      env(g, 0.08, T1, T);
      s.connect(f).connect(g).connect(E.fxBus);
      s.start(t, Math.random()); s.stop(t + T + 0.05);
    } else if (S.mode === 'inter') {
      // two sines 3.5 Hz apart: the interference is audible as beating
      [[196, -0.55], [199.5, 0.55]].forEach(([hz, pan]) => {
        const o = c.createOscillator(), g = c.createGain(), p = c.createStereoPanner();
        o.frequency.value = hz; p.pan.value = pan * S.dir;
        env(g, 0.032, T1, T);
        o.connect(g).connect(p).connect(E.fxBus);
        o.start(t); o.stop(t + T + 0.05);
      });
    } else if (S.mode === 'groove') {
      // surface crackle while the lathe cuts, then the needle drops
      for (let i = 0; i < 34; i++) {
        const w = t + Math.random() * T1, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        s.buffer = E.noise; f.type = 'bandpass'; f.frequency.value = 2500 + Math.random() * 4000; f.Q.value = 1.4;
        g.gain.setValueAtTime(0.02 + Math.random() * 0.06, w); g.gain.exponentialRampToValueAtTime(0.0001, w + 0.006 + Math.random() * 0.01);
        s.connect(f).connect(g).connect(E.fxBus);
        s.start(w, Math.random() * 2); s.stop(w + 0.03);
      }
      E.thump({ when: t + T1, gain: 0.32, f0: 92, f1: 38, decay: 0.9 });
    }
  }
}
