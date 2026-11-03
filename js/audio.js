// AudioEngine — one context, one master bus, analysers on the output.
import { asset } from './assets.js';
// Every visual in the deck reads what is actually playing from here.

const AC = window.AudioContext || window.webkitAudioContext;

function rampTo(param, v, sec, ctx) {
  const t = ctx.currentTime;
  param.cancelScheduledValues(t);
  param.setValueAtTime(param.value, t);
  param.linearRampToValueAtTime(v, t + Math.max(0.01, sec));
}

function makeIR(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

// Every source is brought to the same average level (-18 dB RMS) so slides don't jump in volume.
// The boost is capped so peaks land at most ~3 dB into the limiter, and never more than +18 dB.
const TARGET_DB = -18;
function loudnessGain(buf) {
  let ss = 0, pk = 0, n = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i += 9) { const v = d[i]; ss += v * v; n++; if (Math.abs(v) > pk) pk = Math.abs(v); }
  }
  const rmsDb = 10 * Math.log10(ss / n + 1e-12), pkDb = 20 * Math.log10(pk + 1e-9);
  const db = Math.min(TARGET_DB - rmsDb, 2 - pkDb, 18);
  return Math.pow(10, db / 20);
}

export class Engine {
  constructor() {
    const c = (this.ctx = new AC({ latencyHint: 'playback' }));
    this.master = c.createGain();
    this.master.gain.value = 0.92;
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 3;
    this.limiter.ratio.value = 10;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.2;
    this.bedBus = c.createGain();
    this.bedMute = c.createGain();
    this.fxBus = c.createGain();
    // page dynamics sit between the beds and the master: loud while a page arrives, settled under the
    // voice while it is being explained, with a dip where speech lives so the two don't compete
    this.bedDyn = c.createGain();
    this.talkEQ = c.createBiquadFilter();
    this.talkEQ.type = 'peaking';
    this.talkEQ.frequency.value = 2400;
    this.talkEQ.Q.value = 0.8;
    this.talkEQ.gain.value = 0;
    this.bedBus.connect(this.bedDyn).connect(this.talkEQ).connect(this.bedMute).connect(this.master);
    this.fxBus.connect(this.master);
    this.verb = c.createConvolver();
    this.verb.buffer = makeIR(c, 5, 2.4);
    this.verbSend = c.createGain();
    const verbOut = c.createGain();
    verbOut.gain.value = 0.8;
    this.verbSend.connect(this.verb).connect(verbOut).connect(this.master);
    this.master.connect(this.limiter).connect(c.destination);

    const split = c.createChannelSplitter(2);
    this.limiter.connect(split);
    this.anL = c.createAnalyser();
    this.anR = c.createAnalyser();
    this.anL.fftSize = this.anR.fftSize = 2048;
    this.anL.smoothingTimeConstant = this.anR.smoothingTimeConstant = 0;
    split.connect(this.anL, 0);
    split.connect(this.anR, 1);
    this.anM = c.createAnalyser();
    this.anM.fftSize = 4096;
    this.anM.smoothingTimeConstant = 0.6;
    this.limiter.connect(this.anM);

    this.freq = new Uint8Array(this.anM.frequencyBinCount);
    this.wl = new Float32Array(2048);
    this.wr = new Float32Array(2048);
    this.bands = { low: 0, mid: 0, high: 0, rms: 0, kick: 0, sLow: 0, sMid: 0, sHigh: 0, sRms: 0 };
    this._lastLow = 0;
    this.noise = (() => {
      const b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    })();
    this.buffers = {};
    this.norm = {};
    this.pending = {};
    this.srcs = {};
    this.peaks = {};
    this.bed = null;
    this.bedKey = null;
    this.bedMuted = false;
    this.pos = {};
    this.ana = {};
  }

  get now() { return this.ctx.currentTime; }
  resume() { return this.ctx.resume(); }

  register(name, src) { this.srcs[name] = src; }

  // fetch + decode once; later calls share the same promise
  need(name) {
    if (this.buffers[name]) return Promise.resolve(this.buffers[name]);
    if (this.pending[name]) return this.pending[name];
    const src = this.srcs[name];
    if (!src) return Promise.resolve(null);
    return (this.pending[name] = fetch(asset(src))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
      .then((ab) => new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej)))
      .then((b) => { this.norm[name] = loudnessGain(b); return (this.buffers[name] = b); })
      .catch(() => null));
  }

  // ---------- analysis ----------
  update() {
    this.anM.getByteFrequencyData(this.freq);
    this.anL.getFloatTimeDomainData(this.wl);
    this.anR.getFloatTimeDomainData(this.wr);
    const B = this.bands;
    B.low = this.range(25, 160);
    B.mid = this.range(160, 2500);
    B.high = this.range(2500, 12000);
    let r = 0;
    for (let i = 0; i < 2048; i += 2) r += this.wl[i] * this.wl[i] + this.wr[i] * this.wr[i];
    B.rms = Math.sqrt(r / 2048);
    const flux = B.low - this._lastLow;
    this._lastLow = B.low;
    B.kick = flux > 0.045 ? 1 : B.kick * 0.9;
    B.sLow += (B.low - B.sLow) * 0.12;
    B.sMid += (B.mid - B.sMid) * 0.12;
    B.sHigh += (B.high - B.sHigh) * 0.12;
    B.sRms += (B.rms - B.sRms) * 0.1;
    return B;
  }
  range(a, b) {
    const hz = this.ctx.sampleRate / this.anM.fftSize;
    const i0 = Math.max(1, Math.floor(a / hz)), i1 = Math.min(this.freq.length - 1, Math.floor(b / hz));
    let s = 0;
    for (let i = i0; i <= i1; i++) s += this.freq[i];
    return s / ((i1 - i0 + 1) * 255);
  }
  // n log-spaced bands between f0 and f1, 0..1
  logBands(n, f0 = 30, f1 = 14000, out = new Float32Array(n)) {
    for (let k = 0; k < n; k++) out[k] = this.range(f0 * Math.pow(f1 / f0, k / n), f0 * Math.pow(f1 / f0, (k + 1) / n));
    return out;
  }

  // ---------- beds: the continuous layer under each slide ----------
  async setBed(spec, fade = 1.8) {
    const key = spec ? spec.id : null;
    const c = this.ctx;
    if (key && key === this.bedKey && !spec.restart && this.bed) {
      rampTo(this.bed.out.gain, spec.gain ?? 1, fade, c);
      return this.bed;
    }
    if (this.bed) {
      const old = this.bed;
      this.pos[this.bedKey] = old.position();
      rampTo(old.out.gain, 0, fade, c);
      old.stop(c.currentTime + fade + 0.05);
    }
    this.bed = null;
    this.bedKey = key;
    if (!key) return null;
    const token = (this._token = (this._token || 0) + 1);
    const buf = await this.need(key);
    if (!buf || token !== this._token) return null;
    const offset = spec.offset ?? (spec.keepPos ? this.pos[key] || 0 : 0);
    const bed = new BufferBed(this, buf, { loop: spec.loop ?? true, offset, level: this.norm[key] ?? 1 });
    bed.key = key;
    const t = c.currentTime;
    bed.out.gain.setValueAtTime(0, t);
    bed.out.gain.linearRampToValueAtTime(spec.gain ?? 1, t + (spec.fadeIn ?? fade));
    bed.out.connect(this.bedBus);
    bed.start();
    this.bed = bed;
    return bed;
  }
  bedPos(key) { return this.bedKey === key && this.bed ? this.bed.position() : this.pos[key] || 0; }
  toggleBedMute() {
    this.bedMuted = !this.bedMuted;
    rampTo(this.bedMute.gain, this.bedMuted ? 0 : 1, 0.6, this.ctx);
    return this.bedMuted;
  }

  // ---------- musical dynamics ----------
  // rise to a level over sec (an exponential ramp, so it moves in even decibels)
  swell(level, sec = 0.8) {
    const t = this.ctx.currentTime, g = this.bedDyn.gain, q = this.talkEQ.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.001, g.value), t);
    g.exponentialRampToValueAtTime(Math.max(0.001, level), t + Math.max(0.05, sec));
    q.cancelScheduledValues(t);
    q.setValueAtTime(q.value, t);
    q.linearRampToValueAtTime(0, t + Math.max(0.05, sec));
    this.dynLevel = level;
  }
  // settle under the voice, starting at context time `at` (normally a bar line)
  settle(level, at, ramp, dip = -5) {
    const now = this.ctx.currentTime, g = this.bedDyn.gain, q = this.talkEQ.gain;
    at = Math.max(at, now + 0.02);
    g.setValueAtTime(Math.max(0.001, this.dynLevel ?? g.value), at);
    g.exponentialRampToValueAtTime(Math.max(0.001, level), at + ramp);
    q.setValueAtTime(0, at);
    q.linearRampToValueAtTime(dip, at + ramp);
    this.dynLevel = level;
  }
  // context time of the current bed's first bar line at least `after` seconds from now
  nextBar(after = 0) {
    const now = this.ctx.currentTime, A = this.bed && this.analyze(this.bedKey);
    if (!A) return now + after;
    const p = this.bed.position();
    const k = Math.ceil((p + after - A.phase) / A.bar - 1e-3);
    return now + (A.phase + k * A.bar - p);
  }
  barLen() { const A = this.bed && this.analyze(this.bedKey); return A ? A.bar : 2; }

  // where a track should come in: a bar line where it gets loud. Repeated calls rotate through the
  // strongest bars so returning to a track doesn't land on the same moment.
  entry(name, lead = 0) {
    const A = this.analyze(name);
    if (!A) return null;
    const ok = A.entries.filter((t) => t - lead >= A.lo);
    return ok.length ? ok[A.k++ % ok.length] : null;
  }
  // is the next stretch of this track one of its quiet passages?
  quietAhead(name, pos, sec = 4) {
    const A = this.analyze(name);
    return !!A && A.mean(pos, pos + sec) < A.loud * 0.7;
  }

  // ---------- one-shot instruments ----------
  pluck(freq, o = {}) {
    const c = this.ctx, t = o.when ?? c.currentTime, dec = o.decay ?? 1.6;
    const g = c.createGain(), f = c.createBiquadFilter(), p = c.createStereoPanner();
    const a = c.createOscillator(), b = c.createOscillator(), bg = c.createGain();
    a.type = o.type ?? 'triangle';
    b.type = 'sine';
    a.frequency.value = freq;
    b.frequency.value = freq * 2.002;
    bg.gain.value = 0.3;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(o.bright ?? 4000, t);
    f.frequency.exponentialRampToValueAtTime(380, t + dec * 0.6);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.gain ?? 0.16, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    p.pan.value = o.pan ?? 0;
    a.connect(f);
    b.connect(bg).connect(f);
    f.connect(g).connect(p).connect(this.fxBus);
    if (o.verb) { const s = c.createGain(); s.gain.value = o.verb; p.connect(s).connect(this.verbSend); }
    a.start(t); b.start(t); a.stop(t + dec + 0.1); b.stop(t + dec + 0.1);
  }
  thump(o = {}) {
    const c = this.ctx, t = o.when ?? c.currentTime, dec = o.decay ?? 1.1;
    const osc = c.createOscillator(), g = c.createGain();
    osc.frequency.setValueAtTime(o.f0 ?? 130, t);
    osc.frequency.exponentialRampToValueAtTime(o.f1 ?? 36, t + 0.35);
    g.gain.setValueAtTime(o.gain ?? 0.6, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    osc.connect(g).connect(this.fxBus);
    osc.start(t); osc.stop(t + dec + 0.05);
  }
  noiseHit(o = {}) {
    const c = this.ctx, t = o.when ?? c.currentTime, atk = o.attack ?? 0.005, dur = o.dur ?? 1;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), p = c.createStereoPanner();
    src.buffer = this.noise;
    f.type = 'bandpass';
    f.Q.value = o.q ?? 1.2;
    f.frequency.setValueAtTime(o.f0 ?? 3000, t);
    f.frequency.exponentialRampToValueAtTime(o.f1 ?? 300, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(o.gain ?? 0.3, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dur);
    p.pan.value = o.pan ?? 0;
    src.connect(f).connect(g).connect(p).connect(this.fxBus);
    if (o.verb) { const s = c.createGain(); s.gain.value = o.verb; p.connect(s).connect(this.verbSend); }
    src.start(t, Math.random() * 1.5);
    src.stop(t + atk + dur + 0.05);
  }
  chirp(f0, f1, dur, o = {}) {
    const c = this.ctx, t = o.when ?? c.currentTime;
    const osc = c.createOscillator(), g = c.createGain(), p = c.createStereoPanner();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(f0, t);
    if (o.mid) {
      osc.frequency.exponentialRampToValueAtTime(o.mid, t + dur * 0.4);
      osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    } else osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const peak = o.gain ?? 0.12;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + Math.min(0.02 + dur * 0.15, 0.6));
    g.gain.setValueAtTime(peak, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, t + dur);
    p.pan.value = o.pan ?? 0;
    osc.connect(g).connect(p).connect(this.fxBus);
    if (o.verb) { const s = c.createGain(); s.gain.value = o.verb; p.connect(s).connect(this.verbSend); }
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  // ---------- offline analysis of a decoded track ----------
  getPeaks(name, n = 1400) {
    const key = name + ':' + n;
    if (this.peaks[key]) return this.peaks[key];
    const buf = this.buffers[name];
    if (!buf) return null;
    const a = buf.getChannelData(0), b = buf.numberOfChannels > 1 ? buf.getChannelData(1) : a;
    const step = Math.floor(a.length / n), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let mx = 0;
      for (let j = 0, s = i * step; j < step; j += 8) mx = Math.max(mx, Math.abs((a[s + j] + b[s + j]) * 0.5));
      out[i] = mx;
    }
    return (this.peaks[key] = out);
  }

  envelope(name, hop = 0.05) {
    const buf = this.buffers[name], a = buf.getChannelData(0), sr = buf.sampleRate;
    const win = Math.floor(sr * hop), n = Math.floor(a.length / win), env = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < win; j += 4) s += a[i * win + j] ** 2;
      env[i] = Math.sqrt(s / (win / 4));
    }
    return env;
  }

  // tempo from the autocorrelation of the onset envelope, 70–170 BPM
  estimateBPM(name) {
    const env = this.envelope(name, 0.01), n = env.length;
    const on = new Float32Array(n);
    for (let i = 1; i < n; i++) on[i] = Math.max(0, env[i] - env[i - 1]);
    let best = 0, bestLag = 0;
    for (let bpm = 70; bpm <= 170; bpm += 0.5) {
      const lag = Math.round(6000 / bpm);
      let s = 0;
      for (let i = 0; i + lag < n; i += 2) s += on[i] * on[i + lag];
      if (s > best) { best = s; bestLag = lag; }
    }
    return bestLag ? 6000 / bestLag : 120;
  }

  // tempo, downbeat phase, and the bars where the track gets loud
  analyze(name) {
    if (this.ana[name]) return this.ana[name];
    const buf = this.buffers[name];
    if (!buf) return null;
    const hop = 0.01, env = this.envelope(name, hop), n = env.length, dur = buf.duration;
    const bpm = this.estimateBPM(name), beat = 60 / bpm, bar = beat * 4;
    const on = new Float32Array(n);
    for (let i = 1; i < n; i++) on[i] = Math.max(0, env[i] - env[i - 1]);
    const at = (t) => on[Math.round(t / hop)] || 0;
    // the downbeat: of all grid offsets inside one bar, the one whose bar lines collect the most attack
    let best = -1, phase = 0;
    for (let ph = 0; ph < bar; ph += hop) {
      let s = 0;
      for (let t = ph; t < dur; t += bar) s += at(t) + 0.5 * (at(t - hop) + at(t + hop));
      if (s > best) { best = s; phase = ph; }
    }
    const mean = (a, b) => {
      let s = 0, k = 0;
      for (let i = Math.max(0, Math.round(a / hop)); i < Math.min(n, Math.round(b / hop)); i++) { s += env[i]; k++; }
      return k ? s / k : 0;
    };
    const short = dur < 90;   // 30-second previews loop, so stay clear of their trimmed head and tail
    const lo = short ? HEAD + 0.3 : 0, hi = short ? dur - TAIL - XF - 5 : dur - 6;
    const bars = [];
    for (let t = phase; t < hi; t += bar) {
      if (t < lo + 0.6) continue;
      const next = mean(t, t + 3), prev = mean(t - 1.5, t);
      bars.push({ t, score: next * (0.65 + 0.35 * Math.max(0, Math.min(1, (next - prev) / (next + 1e-6)))) });
    }
    const top = Math.max(1e-6, ...bars.map((b) => b.score));
    const entries = bars.filter((b) => b.score > top * 0.72).sort((a, b) => b.score - a.score).map((b) => b.t);
    const sorted = Float32Array.from(env).sort();
    return (this.ana[name] = { bpm, beat, bar, phase, lo, entries: entries.length ? entries : [lo + 0.6], k: 0, loud: sorted[Math.floor(n * 0.7)], mean });
  }

  // three structural moments: where energy arrives, where it peaks, where it breathes out
  autoMarkers(name) {
    if (!this.buffers[name]) return [];
    const env = this.envelope(name, 0.5), n = env.length, span = 4, gap = Math.max(16, Math.floor(n * 0.15));
    const sm = env.map((_, i) => (env[Math.max(0, i - 1)] + env[i] + env[Math.min(n - 1, i + 1)]) / 3);
    let peak = 0;
    for (let i = 0; i < n; i++) if (sm[i] > sm[peak]) peak = i;
    let entry = 0, best = -1;
    for (let i = 0; i < n - span; i++) {
      const d = sm[i + span] - sm[i];
      if (d > best && Math.abs(i + span - peak) > gap) { best = d; entry = i + span; }
    }
    let space = -1;
    best = -1;
    for (let i = 0; i < n - span; i++) {
      const d = sm[i] - sm[i + span], j = i + span;
      if (d > best && Math.abs(j - peak) > gap && Math.abs(j - entry) > gap) { best = d; space = j; }
    }
    if (space < 0) space = Math.floor(n / 2);
    return [
      { t: entry * 0.5, label: '에너지가 들어오는 곳', sub: 'ENTRY' },
      { t: peak * 0.5, label: '가장 강한 곳', sub: 'PEAK' },
      { t: space * 0.5, label: '숨을 고르는 곳', sub: 'BREATH' },
    ].sort((x, y) => x.t - y.t);
  }
}

// One playing source. Short previews loop by crossfading into a fresh copy of themselves,
// trimming the fade-in/out Apple puts on every 30-second preview, so long slides never dip.
const HEAD = 1.2, TAIL = 1.8, XF = 2.2;
class BufferBed {
  constructor(eng, buffer, o) {
    this.e = eng;
    this.buffer = buffer;
    this.loop = o.loop;
    this.level = o.level ?? 1;
    this.xloop = this.loop && buffer.duration < 90;
    this.offset = (o.offset || 0) % buffer.duration;
    if (this.xloop && this.offset > buffer.duration - TAIL - XF - 0.5) this.offset = HEAD;
    this.out = eng.ctx.createGain();
    this.inner = eng.ctx.createGain();
    this.inner.gain.value = this.level;
    this.inner.connect(this.out);
    this.segs = [];
    this.timer = null;
    this.ended = false;
  }
  get duration() { return this.buffer.duration; }
  _seg(offset, when, fadeIn) {
    const c = this.e.ctx, s = c.createBufferSource(), g = c.createGain();
    s.buffer = this.buffer;
    s.loop = this.loop && !this.xloop;
    s.connect(g).connect(this.inner);
    g.gain.setValueAtTime(fadeIn ? 0 : 1, when);
    if (fadeIn) g.gain.linearRampToValueAtTime(1, when + XF);
    s.start(when, offset);
    const seg = { s, g, when, offset };
    s.onended = () => { this.segs = this.segs.filter((x) => x !== seg); if (!this.loop && !this.segs.length) this.ended = true; };
    this.segs.push(seg);
    this.cur = seg;
    if (this.xloop) {
      const end = when + (this.duration - TAIL - offset);
      g.gain.setValueAtTime(1, end - XF);
      g.gain.linearRampToValueAtTime(0, end);
      s.stop(end + 0.05);
      const lead = Math.max(0, (end - XF - c.currentTime) * 1000 - 300);
      this.timer = setTimeout(() => this._seg(HEAD, end - XF, true), lead);
    }
  }
  start() { this._seg(this.offset, this.e.ctx.currentTime, false); }
  position() {
    if (this.ended) return this.duration;
    const seg = this.cur;
    if (!seg) return 0;
    const p = seg.offset + Math.max(0, this.e.ctx.currentTime - seg.when);
    return this.loop && !this.xloop ? p % this.duration : Math.min(p, this.duration);
  }
  _clear(at) {
    clearTimeout(this.timer);
    this.segs.forEach((x) => { x.s.onended = null; try { x.s.stop(at); } catch (e) {} });
    this.segs = [];
  }
  seek(t) {
    const now = this.e.ctx.currentTime;
    this.inner.gain.cancelScheduledValues(now);
    this.inner.gain.setValueAtTime(this.inner.gain.value, now);
    this.inner.gain.linearRampToValueAtTime(0, now + 0.015);
    this._clear(now + 0.016);
    this.ended = false;
    this._seg(Math.max(0, Math.min(t, this.duration - 0.05)), now + 0.016, false);
    this.inner.gain.linearRampToValueAtTime(this.level, now + 0.04);
  }
  stop(at) {
    this._clear(at);
    setTimeout(() => this.out.disconnect(), Math.max(0, (at - this.e.ctx.currentTime) * 1000) + 200);
  }
}
