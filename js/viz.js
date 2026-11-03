// 2D visuals. Each owns one canvas, draws in stage pixels, and reads only the AudioEngine.
import { t } from './i18n.js';

export const C = {
  paperInk: '#0F0F11', paper2: '#47484D', paperRule: '#A8A9AD', crush: '#2F55D8',
  nightInk: '#EDE4D6', night2: '#9C9184', nightRule: '#2B2621', ember: '#C8924A', ill: '#D2302C',
  blackInk: '#F2EFEA', black2: '#8D8880', blackRule: '#232220', me: '#E5482F',
};
let RS = 1;
export const setRenderScale = (s) => { RS = s; };
export const renderScale = () => RS;
const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export const rgba = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; };
export const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const SANS = '"Pretendard", "ZhSans", sans-serif';

export class Base {
  constructor(cv, o = {}) { this.cv = cv; this.g = cv.getContext('2d'); this.o = o; this.fit(); }
  fit() {
    this.w = parseFloat(this.cv.style.width) || this.cv.offsetWidth || 1920;
    this.h = parseFloat(this.cv.style.height) || this.cv.offsetHeight || 1080;
    this.cv.width = Math.round(this.w * RS);
    this.cv.height = Math.round(this.h * RS);
    this.g.setTransform(RS, 0, 0, RS, 0, 0);
  }
  clear() { this.g.clearRect(0, 0, this.w, this.h); }
  fade(a) {
    const g = this.g;
    g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(0, 0, this.w, this.h); g.restore();
  }
  text(s, x, y, o = {}) {
    const g = this.g;
    g.font = `${o.weight || 450} ${Math.round((o.size || 14) * 1.15)}px ${SANS}`;   // read from the back of the room
    g.fillStyle = o.color || C.paper2;
    g.textAlign = o.align || 'left';
    g.textBaseline = o.base || 'alphabetic';
    g.fillText(t(s), x, y);
  }
}

// ------------------------------------------------------------ spike raster of the music (fp-neuro)
export class Raster extends Base {
  constructor(cv, o = {}) {
    super(cv, o);
    this.n = 10;
    this.prev = new Float32Array(this.n);
    this.cur = new Float32Array(this.n);
    this.spikes = [];
    this.labels = ['14k', '', '', '', '1k', '', '', '', '', '40'];
  }
  draw(A, t) {
    const { g, w, h, n } = this, left = 46, top = 6, rh = (h - top - 26) / n, speed = 120;
    A.logBands(n, 40, 14000, this.cur);
    for (let k = 0; k < n; k++) {
      const d = this.cur[k] - this.prev[k];
      if (d > 0.035 + k * 0.002) this.spikes.push({ k, t, a: Math.min(1, d * 9) });
      this.prev[k] = this.prev[k] * 0.6 + this.cur[k] * 0.4;
    }
    this.clear();
    const span = (w - left) / speed;
    this.spikes = this.spikes.filter((s) => t - s.t < span);
    g.fillStyle = C.paperRule;
    for (let k = 0; k <= n; k++) g.fillRect(left, top + k * rh, w - left, 1);
    for (const s of this.spikes) {
      const x = w - (t - s.t) * speed, row = n - 1 - s.k;
      g.fillStyle = rgba(C.paperInk, 0.35 + s.a * 0.65);
      g.fillRect(x, top + row * rh + rh * 0.15, 1.6, rh * 0.7);
    }
    this.labels.forEach((l, i) => l && this.text(l + (i === 9 ? ' Hz' : ''), left - 10, top + i * rh + rh * 0.68, { align: 'right', size: 12 }));
  }
}

// ------------------------------------------------------------ one continuous pen line (fp-elaenia)
export class InkLine extends Base {
  constructor(cv, o = {}) {
    super(cv, o);
    this.x = this.w * 0.5; this.y = this.h * 0.5; this.a = 0; this.va = 0;
  }
  draw(A, t, dt) {
    const { g, w, h } = this, B = A.bands;
    const steps = 8;
    g.strokeStyle = rgba(C.paperInk, 0.72);
    g.lineWidth = 1.5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(this.x, this.y);
    for (let i = 0; i < steps; i++) {
      // curvature follows the music: onsets make loops, sustained mids make long arcs
      this.va += (Math.sin(t * 0.9 + i) * 0.6 + (B.kick > 0.8 ? (Math.random() - 0.5) * 10 : 0) + (B.mid - 0.25) * 4) * dt;
      this.va *= 0.96;
      this.a += this.va * 0.6;
      const cx = w / 2 - this.x, cy = h / 2 - this.y;
      const pull = Math.atan2(cy, cx), far = Math.hypot(cx / w, cy / h);
      if (far > 0.4) this.a += Math.sin(pull - this.a) * 0.08;
      const sp = (0.6 + B.sRms * 9) * 2.3;
      this.x += Math.cos(this.a) * sp;
      this.y += Math.sin(this.a) * sp;
      g.lineTo(this.x, this.y);
    }
    g.stroke();
  }
}

// ------------------------------------------------------------ Promises as a score of nine movements (fp-score)
export class Score extends Base {
  constructor(cv, o = {}) {
    super(cv, o);
    this.mv = o.movements;
    this.total = this.mv.reduce((s, m) => s + m.len, 0);
    this.sel = 0;
    this.hover = -1;
    let x = 0;
    this.mv.forEach((m) => { m.x0 = (x / this.total) * this.w; x += m.len; m.x1 = (x / this.total) * this.w; });
    const pick = (e) => { const r = cv.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * this.w; return this.mv.findIndex((m) => px >= m.x0 && px < m.x1); };
    cv.style.cursor = 'pointer';
    cv.onpointermove = (e) => (this.hover = pick(e));
    cv.onpointerleave = () => (this.hover = -1);
    cv.onpointerdown = (e) => { const i = pick(e); if (i >= 0) { this.sel = i; o.onSelect && o.onSelect(i); } };
  }
  draw(A, t) {
    const { g, w, h } = this, by = 150, bh = 70, B = A.bands;
    this.clear();
    // motif recurrences: about every ten seconds for half the piece (reviewers' description)
    for (let s = 6; s < this.total * 0.5; s += 10) {
      const x = (s / this.total) * w, live = s < 384 ? 0.35 + B.sMid * 2 : 0.35;
      g.fillStyle = rgba(C.paperInk, Math.min(0.9, live));
      g.fillRect(x, by - 26, 1.2, 14);
    }
    this.mv.forEach((m, i) => {
      const on = i === this.sel, hv = i === this.hover;
      g.fillStyle = on ? C.paperInk : hv ? rgba(C.paperInk, 0.35) : rgba(C.paperInk, 0.12);
      g.fillRect(m.x0 + 1, by, m.x1 - m.x0 - 2, bh);
      this.text(String(m.n), m.x0 + 10, by + 30, { size: 18, weight: 600, color: on ? '#C6C6C8' : C.paperInk });
      this.text(fmt(m.len), m.x0 + 10, by + 54, { size: 13, color: on ? 'rgba(198,198,200,.75)' : C.paper2 });
      if (m.note) {
        g.fillStyle = C.paperInk;
        g.beginPath(); g.arc((m.x0 + m.x1) / 2, by + bh + 22, on ? 6 : 4, 0, Math.PI * 2); g.fill();
      }
    });
    // the string climax in movement 6, drawn as a swell
    const m6 = this.mv[5];
    g.strokeStyle = rgba(C.paperInk, 0.5);
    g.beginPath();
    for (let x = m6.x0; x <= m6.x1; x += 4) {
      const u = (x - m6.x0) / (m6.x1 - m6.x0), y = by - 50 - Math.pow(Math.sin(Math.PI * Math.pow(u, 1.4)), 2) * 60;
      x === m6.x0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
    // sax ends at the close of movement 7
    const m7 = this.mv[6];
    g.fillStyle = C.paperInk;
    g.fillRect(m7.x1 - 1, by - 8, 2, bh + 16);
    // now-listening hint inside movement 1
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    g.strokeStyle = rgba(C.crush, 0.5 + pulse * 0.4);
    g.lineWidth = 2;
    g.strokeRect(this.mv[0].x0 + 2, by + 2, this.mv[0].x1 - this.mv[0].x0 - 4, bh - 4);
    g.lineWidth = 1;
    this.text('0:00', 0, h - 6, { size: 12 });
    this.text('46:33', w, h - 6, { size: 12, align: 'right' });
  }
}

// ------------------------------------------------------------ a club track in three layers (fp-crush)
export class Layers extends Base {
  constructor(cv, o = {}) { super(cv, o); this.hist = []; }
  draw(A) {
    const { g, w, h } = this, B = A.bands, n = 200;
    this.hist.push([B.low, B.mid, B.high]);
    if (this.hist.length > n) this.hist.shift();
    this.clear();
    const rows = [['킥 · 베이스', '160Hz 이하', 0, C.paperInk], ['신스 · 화음', '160Hz–2.5kHz', 1, C.crush], ['하이햇 · 노이즈', '2.5kHz 이상', 2, C.paper2]];
    const rh = h / 3, x0 = 170;
    rows.forEach(([name, range, k, col], r) => {
      const base = (r + 1) * rh - 10;
      this.text(name, 0, r * rh + 30, { size: 17, weight: 600, color: C.paperInk });
      this.text(range, 0, r * rh + 52, { size: 13 });
      g.fillStyle = rgba(col, 0.85);
      g.beginPath();
      g.moveTo(x0, base);
      this.hist.forEach((v, i) => g.lineTo(x0 + (i / (n - 1)) * (w - x0), base - Math.min(1, v[k] * (k === 2 ? 3.2 : 1.6)) * (rh - 18)));
      g.lineTo(w, base);
      g.closePath();
      g.fill();
      g.fillStyle = C.paperRule;
      g.fillRect(x0, base, w - x0, 1);
    });
  }
}

// ------------------------------------------------------------ spin to make an explosion (am-story)
export class Spin extends Base {
  constructor(cv, o = {}) {
    super(cv, o);
    this.p = [];
    this.last = null;
    this.angVel = 0;
    this.energy = 0;
    this.eng = o.eng;
    this.whoosh = 0;
    this.vol = 1;
  }
  move(x, y, t) {
    if (this.last) {
      const cx = this.cx ?? x, cy = this.cy ?? y;
      this.cx = cx * 0.96 + x * 0.04;
      this.cy = cy * 0.96 + y * 0.04;
      const a0 = Math.atan2(this.last.y - this.cy, this.last.x - this.cx), a1 = Math.atan2(y - this.cy, x - this.cx);
      let d = a1 - a0;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      const r = Math.hypot(x - this.cx, y - this.cy);
      if (r > 40) this.angVel += Math.abs(d);
    }
    this.last = { x, y };
    this.mx = x; this.my = y;
  }
  draw(A, t, dt) {
    const { g } = this;
    this.angVel *= Math.pow(0.12, dt);
    this.energy = clamp(this.energy + this.angVel * dt * 0.9 - dt * 0.35, 0, 1.2);
    if (this.angVel > 0.08 && this.mx != null) {
      for (let i = 0; i < 3 + this.energy * 10; i++) {
        const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 120 * (1 + this.energy);
        this.p.push({ x: this.mx, y: this.my, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6 + Math.random() * 0.6, k: Math.random() });
      }
      if (t - this.whoosh > 0.25) {
        this.whoosh = t;
        this.eng.noiseHit({ f0: 500 + this.energy * 2500, f1: 300, dur: 0.4, attack: 0.08, gain: (0.05 + this.energy * 0.1) * this.vol, pan: (this.mx - 960) / 960 });
      }
    }
    if (this.energy >= 1) {
      this.energy = 0.2;
      for (let i = 0; i < 700; i++) {
        const a = Math.random() * Math.PI * 2, s = Math.pow(Math.random(), 0.5) * 1100;
        this.p.push({ x: this.mx, y: this.my, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.2 + Math.random(), k: Math.random() });
      }
      this.eng.thump({ gain: 0.9 * this.vol });
      this.eng.noiseHit({ f0: 3000, f1: 140, dur: 2, gain: 0.3 * this.vol, verb: 0.6 });
    }
    this.fade(0.25);
    g.globalCompositeOperation = 'lighter';
    for (const q of this.p) {
      q.vx *= Math.pow(0.05, dt); q.vy *= Math.pow(0.05, dt); q.vy += 30 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
      g.fillStyle = rgba(q.k > 0.8 ? '#FFE8C0' : C.ember, clamp(q.life) * 0.9);
      g.fillRect(q.x, q.y, 1.5 + q.k * 1.5, 1.5 + q.k * 1.5);
    }
    this.p = this.p.filter((q) => q.life > 0);
    g.globalCompositeOperation = 'source-over';
    if (this.energy > 0.02 && this.mx != null) {
      g.strokeStyle = rgba(C.ember, 0.5);
      g.lineWidth = 2;
      g.beginPath(); g.arc(this.mx, this.my, 26, -Math.PI / 2, -Math.PI / 2 + this.energy * Math.PI * 2); g.stroke();
    }
  }
}

// ------------------------------------------------------------ spectrogram (am-ill)
export class Spectrogram extends Base {
  constructor(cv, o = {}) {
    super(cv, o);
    this.min = o.min ?? 40; this.max = o.max ?? 12000;
    this.pal = [];
    for (let i = 0; i < 256; i++) { const v = i / 255; this.pal.push(rgba(v < 0.6 ? C.ember : mix(C.ember, '#FFF3E0', (v - 0.6) / 0.4), clamp(Math.pow(v, 1.5) * 1.3))); }
    this.axisDone = false;
  }
  draw(A) {
    const { g, w, h } = this, sp = 2;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'copy'; g.drawImage(this.cv, -Math.round(sp * RS), 0); g.restore();
    g.clearRect(w - sp, 0, sp, h);
    const hz = A.ctx.sampleRate / A.anM.fftSize, F = A.freq;
    for (let y = 0; y < h; y += 3) {
      const f = this.min * Math.pow(this.max / this.min, 1 - y / h), v = F[Math.min(F.length - 1, Math.round(f / hz))];
      if (v < 8) continue;
      g.fillStyle = this.pal[v];
      g.fillRect(w - sp, y, sp, 3);
    }
    g.save();
    g.clearRect(0, 0, 54, h);
    [100, 400, 1600, 6400].forEach((f) => {
      const y = h - (Math.log(f / this.min) / Math.log(this.max / this.min)) * h;
      this.text(f >= 1000 ? f / 1000 + 'k' : String(f), 46, y + 4, { size: 12, align: 'right', color: C.night2 });
    });
    this.text('Hz', 46, 14, { size: 12, align: 'right', color: C.night2 });
    g.restore();
  }
}

// ------------------------------------------------------------ low end vs the rest (am-whale)
export class LowVsHigh extends Base {
  constructor(cv, o = {}) { super(cv, o); this.hist = []; }
  draw(A) {
    const { g, w, h } = this, n = 360, x0 = 1000, y0 = 880, hh = 130;
    this.hist.push([A.range(20, 200), A.range(200, 8000)]);
    if (this.hist.length > n) this.hist.shift();
    this.clear();
    const line = (k, col, width, scale) => {
      g.strokeStyle = col; g.lineWidth = width; g.beginPath();
      this.hist.forEach((v, i) => { const x = x0 + (i / (n - 1)) * (w - x0 - 120), y = y0 - Math.min(1, v[k] * scale) * hh; i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke();
    };
    line(1, rgba(C.nightInk, 0.45), 1.2, 1.8);
    line(0, C.ill, 3, 1.2);
    g.fillStyle = rgba(C.nightInk, 0.18);
    g.fillRect(x0, y0, w - x0 - 120, 1);
    this.text('200Hz 이하 — 저음', x0, y0 + 30, { size: 15, weight: 600, color: C.ill });
    this.text('200Hz 이상 — 나머지 전부', x0 + 230, y0 + 30, { size: 15, color: C.night2 });
  }
}

// ------------------------------------------------------------ linear waveform with markers (me-totem)
export class Scrub extends Base {
  constructor(cv, o = {}) {
    super(cv, o);
    this.peaks = o.peaks; this.dur = o.duration; this.markers = o.markers || []; this.hover = -1;
    const toT = (e) => { const r = cv.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width) * this.dur; };
    let drag = false;
    cv.style.cursor = 'pointer';
    cv.onpointerdown = (e) => { drag = true; cv.setPointerCapture(e.pointerId); o.onSeek(toT(e)); };
    cv.onpointermove = (e) => { this.hover = toT(e); if (drag) o.onSeek(this.hover); };
    cv.onpointerup = () => (drag = false);
    cv.onpointerleave = () => (this.hover = -1);
  }
  draw() {
    const { g, w, h, peaks } = this, pos = this.o.getPos();
    this.clear();
    if (!peaks) return;
    const n = peaks.length, mid = h - 22, px = (pos / this.dur) * w;
    for (let i = 0; i < n; i += 2) {
      const x = (i / n) * w, a = Math.max(1, peaks[i] * (h - 30));
      g.fillStyle = x < px ? C.me : rgba(C.blackInk, 0.22);
      g.fillRect(x, mid - a, Math.max(1, (w / n) * 1.4), a);
    }
    g.fillStyle = C.blackInk;
    g.fillRect(px, 0, 1.5, mid + 4);
    this.markers.forEach((m) => {
      const x = (m.t / this.dur) * w;
      g.fillStyle = pos >= m.t ? C.me : C.black2;
      g.fillRect(x - 0.5, mid + 6, 1, 6);
      this.text(m.label, Math.min(w - 2, Math.max(2, x)), h - 1, { size: 12, color: pos >= m.t ? C.blackInk : C.black2, align: x > w * 0.8 ? 'right' : x < w * 0.15 ? 'left' : 'center' });
    });
    if (this.hover >= 0) { g.fillStyle = rgba(C.blackInk, 0.4); g.fillRect((this.hover / this.dur) * w, 0, 1, mid); }
  }
}

// ------------------------------------------------------------ the whole track wound into a spiral (me-114514)
export class Spiral extends Base {
  constructor(cv, o = {}) {
    super(cv, o);
    this.peaks = o.peaks; this.dur = o.duration; this.rev = o.revolution;
    this.cx = this.w / 2; this.cy = this.h / 2; this.r0 = 70; this.r1 = Math.min(this.w, this.h) / 2 - 30;
    this.turns = this.dur / this.rev;
    cv.style.cursor = 'pointer';
    cv.onpointerdown = (e) => {
      const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * this.w - this.cx, y = ((e.clientY - r.top) / r.height) * this.h - this.cy;
      const ang = (Math.atan2(y, x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2), rad = Math.hypot(x, y);
      let best = 0, bd = 1e9;
      for (let k = 0; k <= Math.ceil(this.turns); k++) {
        const t = (k + ang / (Math.PI * 2)) * this.rev;
        if (t > this.dur) break;
        const d = Math.abs(this.radius(t) - rad);
        if (d < bd) { bd = d; best = t; }
      }
      o.onSeek(best);
    };
  }
  radius(t) { return this.r0 + (this.r1 - this.r0) * (t / this.dur); }
  pt(t, extra = 0) {
    const r0 = this.radius(t);
    // after 3:41 the spiral warps like something seen through water
    const a = (t / this.rev) * Math.PI * 2 - Math.PI / 2 + (this.warp || 0) * Math.sin(r0 * 0.035 - (this.now || 0) * 2.2) * 0.6, r = r0 + extra;
    return [this.cx + Math.cos(a) * r, this.cy + Math.sin(a) * r, a];
  }
  draw(A, t) {
    const { g, peaks } = this, pos = this.o.getPos(), dim = this.dim ?? 1, play = this.playColor || C.me;
    this.now = t;
    this.clear();
    if (!peaks) return;
    const n = peaks.length, gap = (this.r1 - this.r0) / this.turns;
    if (!this.norm) { let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, peaks[i]); this.norm = 1 / (m || 1); }
    // beat grid: 8 spokes = 8 bars
    g.strokeStyle = rgba(C.blackInk, 0.06);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
      g.beginPath(); g.moveTo(this.cx + Math.cos(a) * this.r0 * 0.6, this.cy + Math.sin(a) * this.r0 * 0.6); g.lineTo(this.cx + Math.cos(a) * (this.r1 + 20), this.cy + Math.sin(a) * (this.r1 + 20)); g.stroke();
    }
    for (let i = 0; i < n; i++) {
      const v = Math.pow(peaks[i] * this.norm, 1.4), tt = (i / n) * this.dur, len = Math.max(1, v * gap * 0.95);
      const [x0, y0] = this.pt(tt, -len / 2), [x1, y1] = this.pt(tt, len / 2);
      g.strokeStyle = tt <= pos ? rgba(play, (0.5 + v * 0.5) * dim) : rgba(C.blackInk, (0.12 + v * 0.7) * dim);
      g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    const [hx, hy] = this.pt(pos);
    const pr = 5 + A.bands.sRms * 20;
    g.fillStyle = C.blackInk;
    g.beginPath(); g.arc(hx, hy, pr, 0, Math.PI * 2); g.fill();
  }
}

// ------------------------------------------------------------ heard vs made: average spectra (me-ab)
export class ABSpectrum extends Base {
  constructor(cv, o = {}) {
    super(cv, o);
    this.n = 64; this.live = new Float32Array(this.n);
    this.avg = { A: new Float32Array(this.n), B: new Float32Array(this.n) };
    this.seen = { A: 0, B: 0 };
  }
  draw(A, t, dt) {
    const { g, w, h, n } = this, side = this.o.side(), cols = this.o.colors();
    A.logBands(n, 30, 14000, this.live);
    if (A.bands.rms > 0.005) {
      const av = this.avg[side];
      for (let k = 0; k < n; k++) av[k] += (this.live[k] - av[k]) * Math.min(1, dt * 0.6);
      this.seen[side] = Math.min(1, this.seen[side] + dt * 0.25);
    }
    this.clear();
    const bw = w / n, base = h - 40, H = h - 80;
    for (let k = 0; k < n; k++) {
      const v = this.live[k];
      g.fillStyle = rgba(side === 'A' ? cols.A : cols.B, 0.35);
      g.fillRect(k * bw + 2, base - v * H, bw - 4, v * H);
    }
    ['A', 'B'].forEach((s) => {
      if (this.seen[s] < 0.05) return;
      g.strokeStyle = rgba(cols[s], 0.25 + this.seen[s] * 0.75);
      g.lineWidth = s === side ? 3 : 2;
      g.setLineDash(s === side ? [] : [6, 6]);
      g.beginPath();
      for (let k = 0; k < n; k++) { const x = k * bw + bw / 2, y = base - this.avg[s][k] * H; k ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
    });
    g.setLineDash([]);
    g.fillStyle = rgba(C.blackInk, 0.2);
    g.fillRect(0, base, w, 1);
    [[0, '30Hz'], [0.33, '200Hz'], [0.66, '1.6kHz'], [1, '14kHz']].forEach(([u, l]) => this.text(l, u * w, base + 26, { size: 12, color: C.black2, align: u === 1 ? 'right' : u === 0 ? 'left' : 'center' }));
  }
}

// ------------------------------------------------------------ coda: two lines become one, then a point
export class Coda extends Base {
  constructor(cv, o = {}) { super(cv, o); this.k = 0; this.dot = 0; }
  draw(A, t, dt) {
    const { g, w, h } = this, cy = h / 2 - 20;
    this.fade(0.3);
    let ss = 0;
    for (let i = 0; i < 2048; i += 4) ss += A.wl[i] * A.wl[i];
    const rms = Math.sqrt(ss / 512);
    this.lvl = (this.lvl ?? rms) + (rms - (this.lvl ?? rms)) * (1 - Math.exp(-dt * 3));
    const amp = Math.min(220, 36 / Math.max(this.lvl, 0.002));
    const line = (data, color, yOff, alpha) => {
      if (alpha < 0.01) return;
      const span = w * (1 - this.dot * 0.995), x0 = (w - span) / 2;
      g.beginPath();
      for (let i = 0; i < 600; i++) {
        const u = i / 599, x = x0 + u * span, env = Math.sin(Math.PI * u);
        const y = cy + yOff + (data[i * 3] || 0) * amp * env * (1 - this.dot);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.strokeStyle = rgba(color, 0.9 * alpha);
      g.lineWidth = 1.4;
      g.stroke();
    };
    const sep = 150 * (1 - this.k);
    line(A.wl, C.blackInk, -sep, 1 - this.k * 0.95);
    line(A.wr, C.ember, sep, 1 - this.k * 0.95);
    line(A.wl, C.me, 0, this.k);
    if (this.dot > 0.6) {
      const a = clamp((this.dot - 0.6) / 0.4), r = 4 + Math.sin(t * 1.1) * 1.2 + A.bands.sRms * 40;
      g.fillStyle = rgba(C.me, a);
      g.beginPath(); g.arc(w / 2, cy, r, 0, Math.PI * 2); g.fill();
    }
  }
}

// ---------------------------------------------------------------- Totem: the Latin layer
// papel picado: cut-paper flags on a string. Each kick in the music knocks them; the wind settles them.
export class Picado extends Base {
  constructor(cv, o = {}) {
    super(cv, o);
    const cols = [C.me, C.ember, '#EFECE6', C.ill];
    this.x0 = o.x0 ?? 0;
    this.flags = [];
    for (let i = 0, x = this.x0 + 30; x < this.w - 330; i++, x += 148) {
      this.flags.push({ x: x + 60, a: 0, v: 0, img: this.cut(120, 128, cols[i % cols.length], i) });
    }
    this.lastKick = 0;
  }
  cordY(x) { const u = (x - this.x0) / (this.w - this.x0); return 16 + 30 * 4 * u * (1 - u); }
  gust(k = 1) { this.flags.forEach((f, i) => (f.v += (1.5 + Math.random() * 2) * k * (i % 2 ? 1 : -1))); }
  // one sheet of tissue paper with its pattern cut out
  cut(w, h, col, seed) {
    const c = document.createElement('canvas');
    c.width = Math.round(w * 2); c.height = Math.round(h * 2);
    const g = c.getContext('2d');
    g.scale(2, 2);
    g.fillStyle = col;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    const dot = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
    for (let x = 6; x < w; x += 12) dot(x, h, 6);                 // scalloped hem
    for (let x = 10; x < w - 4; x += 10) dot(x, 12, 1.8);          // pin holes under the fold
    for (let x = 12; x < w - 6; x += 12) dot(x, h - 16, 2.2);
    const cx = w / 2, cy = h / 2 + 4;
    const kind = seed % 3;
    if (kind === 0) {             // sun
      dot(cx, cy, 14);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        g.save(); g.translate(cx + Math.cos(a) * 28, cy + Math.sin(a) * 28); g.rotate(a);
        g.beginPath(); g.moveTo(-8, 0); g.lineTo(0, -3.5); g.lineTo(8, 0); g.lineTo(0, 3.5); g.closePath(); g.fill(); g.restore();
      }
    } else if (kind === 1) {      // diamond lattice
      for (let y = 30; y < h - 26; y += 16) for (let x = 14 + ((y / 16) % 2) * 8; x < w - 8; x += 16) {
        g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 5, y); g.lineTo(x, y + 6); g.lineTo(x - 5, y); g.closePath(); g.fill();
      }
    } else {                      // flower
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        g.beginPath(); g.ellipse(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17, 11, 5, a, 0, Math.PI * 2); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = col; dot(cx, cy, 8);
      g.globalCompositeOperation = 'destination-out';
      dot(cx, cy, 3.5);
      [[14, 34], [w - 14, 34], [14, h - 34], [w - 14, h - 34]].forEach(([x, y]) => dot(x, y, 4));
    }
    return c;
  }
  draw(A, t, dt) {
    const g = this.g;
    this.clear();
    const kick = A.bands.kick === 1 && t - this.lastKick > 0.12;
    if (kick) this.lastKick = t;
    g.strokeStyle = rgba(C.blackInk, 0.45);
    g.lineWidth = 1.2;
    g.beginPath();
    for (let x = this.x0; x <= this.w; x += 20) (x === this.x0 ? g.moveTo(x, this.cordY(x)) : g.lineTo(x, this.cordY(x)));
    g.stroke();
    this.flags.forEach((f, i) => {
      if (kick) f.v += (0.5 + Math.random()) * 0.9 * (i % 2 ? 1 : -1) * (0.4 + A.bands.sLow);
      const wind = Math.sin(t * 0.8 + i * 1.3) * 0.04 + Math.sin(t * 2.1 + i) * 0.015;
      f.v += (-(f.a - wind) * 30 - f.v * 3.2) * dt;
      f.a += f.v * dt;
      g.save();
      g.translate(f.x, this.cordY(f.x));
      g.rotate(f.a * 0.6);
      g.transform(1, 0, Math.sin(f.a) * 0.4, 1, 0, 0);     // the paper skews as it swings
      g.globalAlpha = 0.94;
      g.drawImage(f.img, -60, 0, 120, 128);
      g.restore();
    });
  }
}

// son clave 3-2 laid over the track's own tempo: two bars of eighth notes, five strokes
export class Clave extends Base {
  constructor(cv, o = {}) {
    super(cv, o);
    this.steps = [0, 3, 6, 10, 12];
    this.cur = -1;
    this.hitAt = new Float32Array(16).fill(-9);
    this.sched = -1;
  }
  draw(A, t) {
    const g = this.g, { w, h } = this, o = this.o, pos = o.getPos(), step = 60 / o.bpm / 2;
    const k = Math.floor((pos - o.phase) / step), cur = ((k % 16) + 16) % 16;
    // the next stroke is scheduled at its exact time so the click doesn't wobble with the frame rate
    if (o.sound() && o.playing()) {
      const next = k + 1, ni = ((next % 16) + 16) % 16;
      if (this.steps.includes(ni) && this.sched !== next) { this.sched = next; o.onHit(o.phase + next * step - pos); }
    }
    if (cur !== this.cur) { this.cur = cur; if (this.steps.includes(cur)) this.hitAt[cur] = t; }
    this.clear();
    const sp = w / 16, y = h / 2 + 6;
    g.strokeStyle = rgba(C.blackInk, 0.18);
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(sp * 8, y - 18); g.lineTo(sp * 8, y + 18); g.stroke();
    this.text('3', 0, 12, { size: 12, color: C.black2 });
    this.text('2', sp * 8 + 8, 12, { size: 12, color: C.black2 });
    for (let i = 0; i < 16; i++) {
      const x = i * sp + sp / 2, on = this.steps.includes(i), age = t - this.hitAt[i];
      if (on) {
        const flash = Math.max(0, 1 - age / 0.35);
        g.fillStyle = rgba(C.me, 0.35 + flash * 0.65);
        g.beginPath(); g.arc(x, y, 9 + flash * 4, 0, Math.PI * 2); g.fill();
      } else {
        g.fillStyle = rgba(C.blackInk, i === cur ? 0.7 : 0.2);
        g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill();
      }
      if (i === cur) { g.strokeStyle = rgba(C.blackInk, 0.8); g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.stroke(); }
    }
  }
}

// ---------------------------------------------------------------- Прокофьев: the Soviet layer
// 5 March 1953: the leading Soviet music magazine gave Stalin pages 1–115 and Prokofiev page 116
export class Page116 extends Base {
  draw(A, t) {
    const g = this.g, { w } = this, n = 116, gap = 1.5, bw = (w - gap * (n - 1)) / n, top = 12, bh = 40;
    const t0 = this.t0 ?? (this.t0 = t), e = t - t0 - (this.o.delay || 0);
    this.clear();
    const shown = Math.max(0, Math.min(115, Math.floor(e * 70)));
    // o.level(): 0 still, up to 1 the pages jump with the music, -1 they lie flat (the silences)
    const L = this.o.level ? this.o.level() : 0;
    this.lv = (this.lv ?? 0) + (L - (this.lv ?? 0)) * (L < 0 ? 0.08 : 0.3);
    g.fillStyle = rgba(C.blackInk, 0.26);
    // every bar on whole device pixels, or 115 thin bars beat against the pixel grid and read as a broken waveform
    const px = (v) => Math.round(v * RS) / RS;
    for (let i = 0; i < shown; i++) {
      const k = this.lv < 0 ? 1 + this.lv * 0.94 : 1 - this.lv * (0.2 + 0.8 * Math.abs(Math.sin(i * 0.37 + t * (5 + this.lv * 9) + Math.sin(i * 1.7) * 2)));
      const x0 = px(i * (bw + gap)), x1 = Math.max(x0 + 1 / RS, px(i * (bw + gap) + bw)), y0 = px(top + bh * (1 - k));
      g.fillRect(x0, y0, x1 - x0, px(top + bh) - y0);
    }
    const red = e - 115 / 70 - 0.9;
    if (red > 0) {
      g.fillStyle = rgba(C.me, Math.min(1, red * 3));
      g.fillRect(115 * (bw + gap), top - 10, bw + 1, bh + 10);
      if (!this.rang) { this.rang = true; this.o.onLand && this.o.onLand(); }
    }
    this.text('1–115쪽 · 스탈린', 0, top + bh + 22, { size: 13, color: C.black2 });
    if (red > 0) this.text('116쪽 · 프로코피예프', w, top + bh + 22, { size: 13, color: C.me, align: 'right', weight: 600 });
  }
}

// ------------------------------------------------------------ the singing dune (fp-mojave): sand blown off the ridge, the low end is the wind
export class Sand extends Base {
  constructor(cv, o = {}) {
    super(cv, o);
    this.gust = 0.5;
    this.ps = Array.from({ length: 900 }, (_, i) => Object.assign(this.spawn({}, true), { haze: i < 70 }));
  }
  spawn(p, anywhere) {
    p.x = anywhere ? Math.random() * this.w : this.w + Math.random() * 120;
    p.y = this.h * (0.42 + Math.pow(Math.random(), 0.7) * 0.58);
    p.v = 0.5 + Math.random();
    p.a = 0.25 + Math.random() * 0.5;
    p.s = 0.8 + Math.random() * 1.6;
    p.ph = Math.random() * 6.28;
    return p;
  }
  draw(A, t, dt) {
    const g = this.g;
    this.gust += (0.35 + A.bands.sLow * 2.4 - this.gust) * Math.min(1, dt * 3);
    this.clear();
    g.lineCap = 'round';
    for (const p of this.ps) {
      const vx = -(150 + 320 * p.v) * this.gust, vy = Math.sin(t * 1.7 + p.ph) * 14 - 6 * this.gust;
      p.x += vx * dt; p.y += vy * dt;
      if (p.x < -40 || p.y < this.h * 0.3) this.spawn(p);
      // grains fade out over the paper side so the text stays clean
      const fade = Math.min(1, Math.max(0, (p.x - this.w * 0.36) / (this.w * 0.2)));
      if (fade <= 0) continue;
      // a few long soft veils of blown sand, the rest single grains
      const L = p.haze ? 0.32 : 0.05;
      g.strokeStyle = `rgba(252,240,220,${(p.haze ? 0.06 : p.a) * fade})`;
      g.lineWidth = p.haze ? 7 + p.s * 5 : p.s;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - vx * L, p.y - vy * L); g.stroke();
    }
  }
}

// ------------------------------------------------------------ the score of the Прокофьев track (me-114514, before 3:38)
// Along the bottom, the string quartet as engraved: the user's own score, cut bar by bar from its pages
// (tools/pro_cut.py, assets/collage/pro-bars.webp) and put where each bar sounds in the recording (tools/pro_align.py,
// js/pro-score.js). The bars keep their engraved width; the strip moves as fast as the notes come (quicker through a
// bar of semiquavers, slower through a long note), so every note crosses the red playhead (on the clock's axis) when
// it sounds, and lights red as it does. Where the strings rest and only the
// electronics play, the same strip shows the recording's spectrogram. The high clicks (0:34-0:44) also scratch the
// whole frame for a moment, like a scratch on film, and each low hit sends a ring out from the clock
// (js/pro-events.js).
export class Stave extends Base {
  // o.pos(): the song position as heard; o.ev: the events; o.score: where the bars sound; o.bars: the sheet's layout;
  // o.sheet, o.spectrum: the images' urls; o.show(): whether it shows
  constructor(cv, o) {
    super(cv, o);
    this.ev = o.ev; this.sc = o.score; this.L = o.bars;
    this.a = 0;
    this.scratch = []; this.rings = [];
    this.last = -1;
    // the sheet comes as light ink on black: made into paper-coloured ink (and a red copy) that is see-through between
    const sheet = new Image();
    sheet.onload = () => { this.ink = this.tint(sheet, [239, 236, 230]); this.red = this.tint(sheet, [229, 72, 47]); };
    sheet.src = o.sheet;
    const sp = new Image();
    // the spectrogram drawn like the score: paper-coloured ink on the dark band (its brightness is the ink), the
    // loudest parts going red
    sp.onload = () => {
      const c = document.createElement('canvas'); c.width = sp.naturalWidth; c.height = sp.naturalHeight;
      const x = c.getContext('2d');
      x.drawImage(sp, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        const v = p[i] / 255, hot = Math.max(0, (v - 0.72) / 0.28);
        p[i] = 239 - hot * 10; p[i + 1] = 236 - hot * 164; p[i + 2] = 230 - hot * 183; p[i + 3] = Math.round(255 * Math.pow(v, 1.4));
      }
      x.putImageData(d, 0, 0);
      this.spec = c;
    };
    sp.src = o.spectrum;
    // the strip's length is the bars side by side at their engraved width, and between them, where the
    // electronics play, so much per second; T/U: the song's time against the place along the strip, note by note
    const GAP = 220, T = [], U = [];
    let u = 0, tl = 0;
    this.occ = [];
    for (const [k, t0, t1, beats] of this.sc.bars) {
      const [, , w, on] = this.L.bars[k];
      if (t0 > tl) { u += (t0 - tl) * (T.length ? GAP : 0); }
      const pts = [[t0, 0]];
      for (const [b, f] of on) if (b > 0 && b < beats) pts.push([t0 + (b / beats) * (t1 - t0), f]);
      pts.push([t1, 1]);
      let fl = 0;
      for (const [pt, f] of pts) { fl = Math.max(fl, f); if (!T.length || pt > T[T.length - 1] + 1e-4) { T.push(pt); U.push(u + fl * w); } }
      this.occ.push({ k, t0, t1, w, u0: u, hits: on.map(([b, f]) => [t0 + (b / beats) * (t1 - t0), f]) });
      u += w; tl = t1;
    }
    T.push(tl + 60); U.push(u + 60 * GAP);
    T.unshift(-60); U.unshift(-60 * GAP);
    this.T = T; this.U = U; this.GAP = GAP;
  }
  // the place along the strip at a time of the song
  at(t) {
    const T = this.T, U = this.U;
    let lo = 0, hi = T.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; }
    return U[lo] + ((U[hi] - U[lo]) * (t - T[lo])) / (T[hi] - T[lo]);
  }
  tint(im, [r, g, b]) {
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const v = p[i]; p[i] = r; p[i + 1] = g; p[i + 2] = b; p[i + 3] = v; }
    x.putImageData(d, 0, 0);
    return c;
  }
  // the events of a sorted list ([time, ...]) in (a, b]
  between(list, a, b) {
    let lo = 0, hi = list.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (list[m][0] <= a) lo = m + 1; else hi = m; }
    const out = [];
    for (let i = lo; i < list.length && list[i][0] <= b; i++) out.push(list[i]);
    return out;
  }
  draw(A, t, dt) {
    const g = this.g, pos = this.o.pos(), E = this.ev;
    this.a += ((this.o.show() ? 1 : 0) - this.a) * Math.min(1, dt * 5);
    this.clear();
    // what sounded since the last frame (a jump along the spiral sets nothing off)
    const step = pos - this.last;
    if (step > 0 && step < 0.25) {
      this.between(E.click, this.last, pos).forEach(([, s]) => {
        for (let k = 0, n = s > 25 ? 3 : s > 14 ? 2 : 1; k < n; k++) this.scratch.push({ x: Math.random() * 1920, t, w: 0.6 + Math.random() * 1.2, a: 0.25 + Math.min(0.5, s / 60) });
      });
      this.between(E.beat, this.last, pos).forEach(([, s]) => this.rings.push({ t, s: Math.min(1, s / 25) }));
    }
    this.last = pos;
    this.scratch = this.scratch.filter((s) => t - s.t < 0.06);
    this.rings = this.rings.filter((r) => t - r.t < 0.9);
    if (this.a < 0.01) return;
    g.save();
    g.globalAlpha = this.a;
    // the scratches, the whole height of the frame
    g.globalCompositeOperation = 'lighter';
    for (const s of this.scratch) { g.fillStyle = `rgba(239,236,230,${s.a})`; g.fillRect(s.x, 0, s.w, 1080); }
    g.globalCompositeOperation = 'source-over';
    // the rings out of the clock
    for (const r of this.rings) {
      const k = (t - r.t) / 0.9, e = 1 - Math.pow(1 - k, 3);
      g.strokeStyle = `rgba(229,72,47,${(1 - k) * (0.3 + 0.45 * r.s)})`;
      g.lineWidth = (2 + 4 * r.s) * (1 - k);
      g.beginPath(); g.arc(1400, 540, 120 + e * (500 + 500 * r.s), 0, Math.PI * 2); g.stroke();
    }
    // the strip
    const PX = 1400, H = this.L.h, Y = 1076 - H, u0 = this.at(pos), X = (s) => PX + this.at(s) - u0, XU = (u) => PX + u - u0;
    // the strip lies on its own dark band, so nothing of the hall shows through the score; a short fade above it and
    // a fine rule along its top edge
    if (!this.shade) {
      this.shade = g.createLinearGradient(0, Y - 70, 0, Y - 16);
      this.shade.addColorStop(0, 'rgba(6,6,6,0)'); this.shade.addColorStop(1, 'rgba(6,6,6,.94)');
    }
    g.fillStyle = this.shade; g.fillRect(0, Y - 70, 1920, 54);
    g.fillStyle = 'rgba(6,6,6,.94)'; g.fillRect(0, Y - 16, 1920, 1080 - Y + 16);
    g.fillStyle = 'rgba(239,236,230,.22)'; g.fillRect(0, Y - 16, 1920, 1);
    // the electronics: the spectrogram, with soft ends
    if (this.spec) {
      const im = this.spec, fps = im.width / 218.45;
      for (const [a, b] of this.sc.electronic) {
        const Xa = X(a), Xb = X(b);
        const xa = Math.max(0, Xa), xb = Math.min(1920, Xb);
        if (xb <= xa) continue;
        // in the electronics the strip moves at an even speed: screen x back to the song's time is a straight line
        const ta = a + ((xa - Xa) / (Xb - Xa)) * (b - a), tb = a + ((xb - Xa) / (Xb - Xa)) * (b - a);
        g.save();
        g.globalAlpha = this.a * 0.9;
        g.drawImage(im, ta * fps, 0, Math.max(1, (tb - ta) * fps), im.height, xa, Y + 6, xb - xa, H - 12);
        const fade = (x0, dir) => { const gr = g.createLinearGradient(x0, 0, x0 + dir * 50, 0); gr.addColorStop(0, 'rgba(6,6,6,.95)'); gr.addColorStop(1, 'rgba(6,6,6,0)'); g.fillStyle = gr; g.fillRect(dir > 0 ? x0 : x0 - 50, Y, 50, H); };
        g.globalAlpha = this.a;
        if (X(a) > 0) fade(X(a), 1);
        if (X(b) < 1920) fade(X(b), -1);
        g.restore();
      }
    }
    // the bars, each at its engraved width; what has sounded dims as it goes left
    if (this.ink) {
      const L = this.L.bars;
      for (const o of this.occ) {
        const xa = XU(o.u0), xb = xa + o.w;
        if (xb < 0 || xa > 1920) continue;
        const [sx, sy] = L[o.k];
        g.globalAlpha = this.a * (o.t1 < pos ? Math.max(0.3, 0.95 - (pos - o.t1) * 0.1) : o.t0 > pos ? 0.62 : 0.9);
        g.drawImage(this.ink, sx, sy, o.w, H, xa, Y, o.w, H);
        // the notes being played light red
        for (const [ht, f] of o.hits) {
          const d = pos - ht;
          if (d < 0 || d > 0.22) continue;
          const cx = xa + f * o.w, cw = 16;
          g.globalAlpha = this.a * (1 - d / 0.22);
          g.drawImage(this.red, sx + f * o.w - cw / 2, sy, cw, H, cx - cw / 2, Y, cw, H);
        }
      }
      g.globalAlpha = this.a;
    }
    // clicks: x-heads above the strip
    g.lineWidth = 1.3;
    for (const [s, st] of this.between(E.click, pos - 8, pos + 4)) {
      const Xc = X(s), r = 2.2 + Math.min(2, st / 20), now = pos - s >= 0 && pos - s < 0.15, y = Y - 12;
      if (Xc < -10 || Xc > 1930) continue;
      g.strokeStyle = now ? 'rgba(229,72,47,1)' : `rgba(239,236,230,${s > pos ? 0.35 : 0.6})`;
      g.beginPath(); g.moveTo(Xc - r, y - r); g.lineTo(Xc + r, y + r); g.moveTo(Xc + r, y - r); g.lineTo(Xc - r, y + r); g.stroke();
    }
    // the playhead, on the clock's axis
    g.fillStyle = 'rgba(229,72,47,.9)';
    g.fillRect(PX - 1, Y - 22, 2, H + 26);
    g.restore();
  }
}

// ------------------------------------------------------------ the explosion (am-story)
// Behind the story of the boy who made "explosions": the music's spectrum as a burst. Every band is a ray out of one
// point, as long as the band is loud, leaving an afterglow as it falls back; each hard hit sends a shock ring out and
// flings sparks along the rays. hit and bass are read by the page to shake the title.
export class Blast extends Base {
  constructor(cv, o = {}) {
    super(cv, o);
    this.n = 72;
    this.bands = new Float32Array(this.n);
    this.rings = []; this.sparks = [];
    this.hit = 0; this.bass = 0; this.lastHit = -9; this.rot = 0;
    this.cx = o.x ?? 1420; this.cy = o.y ?? 380;
  }
  draw(A, t, dt) {
    const g = this.g, { cx, cy, n } = this;
    A.logBands(n, 40, 14000, this.bands);
    const B = A.bands;
    this.bass += ((B.sLow || 0) - this.bass) * Math.min(1, dt * 10);
    if (B.kick === 1 && t - this.lastHit > 0.16) {
      this.lastHit = t;
      const s = Math.min(1, 0.4 + (B.rms || 0) * 3);
      this.hit = Math.max(this.hit, s);
      this.rings.push({ t, s });
      for (let k = 0, m = 50 + Math.floor(s * 90); k < m; k++) {
        const a = Math.random() * Math.PI * 2, v = 500 + Math.random() * 1300 * s;
        this.sparks.push({ x: cx + Math.cos(a) * 80, y: cy + Math.sin(a) * 80, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t, life: 0.5 + Math.random() * 0.9, hot: Math.random() < 0.35 });
      }
    }
    this.hit *= Math.exp(-dt * 5);
    this.rot += dt * (0.05 + this.bass * 0.4);
    // the afterglow: what was drawn fades rather than being wiped
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = `rgba(0,0,0,${0.16 + 0.1 * (1 - this.hit)})`;
    g.fillRect(0, 0, this.w, this.h);
    g.globalCompositeOperation = 'lighter';
    // the core
    const core = 40 + this.bass * 60 + this.hit * 110;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, core * 2.4);
    gr.addColorStop(0, `rgba(255,214,160,${0.05 + this.hit * 0.12})`); gr.addColorStop(0.35, 'rgba(200,146,74,.025)'); gr.addColorStop(1, 'rgba(200,146,74,0)');
    g.fillStyle = gr; g.fillRect(cx - core * 2.4, cy - core * 2.4, core * 4.8, core * 4.8);
    // the rays: the spectrum four times round the circle (mirrored each time, low to high and back), so the burst
    // goes off on every side; they jitter on the hits
    const r0 = 46 + this.bass * 30 + this.hit * 40, L = 460 * (1 + this.hit * 0.7);
    g.lineCap = 'round';
    for (let i = 0; i < n * 4; i++) {
      // only what stands out shoots: the band above a floor, sharpened
      const b = Math.floor(i / n) % 2 ? n - 1 - (i % n) : i % n, v = Math.pow(Math.max(0, this.bands[b] - 0.18) / 0.82, 1.7), a = (i / (n * 4)) * Math.PI * 2 + this.rot + (Math.random() - 0.5) * 0.02 * this.hit;
      if (v < 0.03) continue;
      const r1 = r0 + v * L;
      const hi = b / n;
      g.strokeStyle = hi > 0.6 ? `rgba(237,228,214,${0.06 + v * 0.3})` : `rgba(200,146,74,${0.07 + v * 0.32})`;
      g.lineWidth = 1 + v * 2.4;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
    }
    // the shock rings
    this.rings = this.rings.filter((r) => t - r.t < 1.2);
    for (const r of this.rings) {
      const k = (t - r.t) / 1.2, e = 1 - Math.pow(1 - k, 3);
      g.strokeStyle = `rgba(255,220,170,${Math.pow(1 - k, 1.6) * (0.12 + 0.2 * r.s)})`;
      g.lineWidth = (4 + 16 * r.s) * (1 - k);
      g.beginPath(); g.arc(cx, cy, 90 + e * (700 + 700 * r.s), 0, Math.PI * 2); g.stroke();
    }
    // the sparks: streaks that slow down and go out
    this.sparks = this.sparks.filter((p) => t - p.t < p.life);
    g.lineWidth = 1.6;
    for (const p of this.sparks) {
      const drag = Math.exp(-dt * 2.6);
      p.vx *= drag; p.vy *= drag; p.vy += 120 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const k = (t - p.t) / p.life;
      g.strokeStyle = p.hot ? `rgba(255,236,200,${(1 - k) * 0.5})` : `rgba(200,146,74,${(1 - k) * 0.4})`;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); g.stroke();
    }
    g.restore();
  }
}

// ------------------------------------------------------------ the night sky in the arch (fp-lessons)
// A dark field of grain and small stars, a few four-pointed sparks, constellation lines between some of the stars and
// a cyan dot or two, all twinkling slowly; when the lesson is lit (lit()) the sky brightens.
export class Arch extends Base {
  constructor(cv, o) {
    super(cv, o);
    const R = (k) => { const x = Math.sin(k * 91.7 + 7.3) * 43758.5453; return x - Math.floor(x); };
    this.stars = Array.from({ length: 320 }, (_, i) => ({ x: R(i) * this.w, y: R(i + 999) * this.h, r: 0.4 + R(i + 77) * 1.3, p: R(i + 5) * 6.3, f: 0.6 + R(i + 3) * 2 }));
    this.sparks = Array.from({ length: 7 }, (_, i) => ({ x: 40 + R(i + 300) * (this.w - 80), y: 60 + R(i + 400) * (this.h - 120), s: 6 + R(i + 500) * 12, p: R(i + 600) * 6 }));
    this.links = Array.from({ length: 14 }, (_, i) => [Math.floor(R(i + 700) * 320), Math.floor(R(i + 800) * 320)]);
    this.grain = document.createElement('canvas');
    this.grain.width = this.w; this.grain.height = this.h;
    const g = this.grain.getContext('2d'), d = g.createImageData(this.w, this.h);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() < 0.06 ? 30 + Math.random() * 60 : 11; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    this.light = 0;
  }
  draw(A, t, dt) {
    const g = this.g;
    this.light += ((this.o.lit() ? 1 : 0) - this.light) * Math.min(1, dt * 2);
    const L = 0.55 + 0.45 * this.light;
    g.drawImage(this.grain, 0, 0, this.w, this.h);
    g.strokeStyle = `rgba(244,244,246,${0.18 + 0.25 * this.light})`; g.lineWidth = 1;
    for (const [a, b] of this.links) { const p = this.stars[a], q = this.stars[b]; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); }
    for (const s of this.stars) {
      g.fillStyle = `rgba(244,244,246,${(0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * s.f + s.p))) * L})`;
      g.fillRect(s.x, s.y, s.r, s.r);
    }
    for (const s of this.sparks) {
      const k = (0.6 + 0.4 * Math.sin(t * 0.9 + s.p)) * L, r = s.s * k;
      g.fillStyle = `rgba(244,244,246,${0.5 + 0.5 * k})`;
      g.beginPath(); g.moveTo(s.x, s.y - r); g.quadraticCurveTo(s.x, s.y, s.x + r, s.y); g.quadraticCurveTo(s.x, s.y, s.x, s.y + r); g.quadraticCurveTo(s.x, s.y, s.x - r, s.y); g.quadraticCurveTo(s.x, s.y, s.x, s.y - r); g.fill();
    }
    g.fillStyle = `rgba(79,209,232,${0.6 * L})`;
    g.fillRect(this.w * 0.18, this.h * 0.22, 3, 3); g.fillRect(this.w * 0.81, this.h * 0.61, 3, 3);
  }
}

// ------------------------------------------------------------ Muybridge's birds (fp-lessons)
// Birds cut from Muybridge's Animal Locomotion (1887): each one crosses the page beating its wings with the frames of
// its own species, one after another, as the camera caught them. Most stay grey photographs; a few go the page's
// cobalt, one or two white, as on a star chart.
export class Flock extends Base {
  // o.birds: [id, species, x, y, w, h] in the sheet; o.sheet: its url
  constructor(cv, o) {
    super(cv, o);
    const by = {};
    o.birds.forEach((b) => (by[b[1]] = by[b[1]] || []).push(b));
    this.kinds = Object.values(by).filter((f) => f.length >= 2);
    const im = new Image();
    im.onload = () => { this.sheets = { photo: im, blue: this.tint(im, '#2F55D8'), white: this.tint(im, '#F4F4F6') }; };
    im.src = o.sheet;
    const R = (k) => { const x = Math.sin(k * 78.233 + 1.7) * 43758.5453; return x - Math.floor(x); };
    // seven birds at their own height (over the top half, clear of the lessons), size, speed and colour, already
    // spread along their paths
    this.birds = Array.from({ length: 7 }, (_, i) => ({
      kind: this.kinds[i % this.kinds.length], y: 150 + R(i) * 330, h: 60 + R(i + 9) * 95, v: 70 + R(i + 3) * 90,
      x: R(i + 5) * 2200 - 200, ph: R(i + 7) * 6, fps: 7 + R(i + 11) * 4, look: i === 2 || i === 5 ? 'blue' : i === 4 ? 'white' : 'photo',
    }));
  }
  tint(im, colour) {
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = colour; x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  draw(A, t, dt) {
    const g = this.g;
    this.clear();
    if (!this.sheets) return;
    for (const b of this.birds) {
      b.x += b.v * dt;
      if (b.x > 2100) { b.x = -260; }
      const f = b.kind, n = f.length, k = Math.floor((t + b.ph) * b.fps) % (2 * n - 2 || 1), [, , sx, sy, w, h] = f[k < n ? k : 2 * n - 2 - k];
      const s = b.h / h, y = b.y + Math.sin(t * 0.7 + b.ph) * 18 - b.x * 0.06;
      g.globalAlpha = b.look === 'photo' ? 0.92 : 1;
      g.drawImage(this.sheets[b.look], sx, sy, w, h, b.x - (w * s) / 2, y - (h * s) / 2, w * s, h * s);
    }
    g.globalAlpha = 1;
  }
}
